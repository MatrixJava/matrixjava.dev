type StatusTone = "default" | "loading" | "warning" | "error";
type PageView = "main" | "portfolio" | "github" | "network" | "resume";

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  html_url: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
}

interface GitHubOrg {
  login: string;
  name: string | null;
  description: string | null;
  html_url: string;
  public_repos: number;
  followers: number;
}

interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  fork: boolean;
}

interface GitHubEvent {
  type: string;
  created_at: string;
  repo: {
    name: string;
    url: string;
  };
  payload?: {
    action?: string;
    ref_type?: string;
  };
}

interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: "NONE" | "FIRST_QUARTILE" | "SECOND_QUARTILE" | "THIRD_QUARTILE" | "FOURTH_QUARTILE";
}

interface ContributionApiResponse {
  contributions: ContributionDay[][];
  totalContributions: number;
}

interface PortfolioSnapshot {
  savedAt: string;
  user?: GitHubUser;
  org?: GitHubOrg;
  userRepos?: GitHubRepo[];
  orgRepos?: GitHubRepo[];
  events?: GitHubEvent[];
  contributions?: ContributionApiResponse;
}

const DEFAULT_USER = "MatrixJava";
const DEFAULT_ORG = "ByteBashersLabs";
const STORAGE_USER_KEY = "portfolio.github.user";
const STORAGE_ORG_KEY = "portfolio.github.org";
const SNAPSHOT_KEY = "portfolio.github.snapshot.v1";

const form = document.querySelector<HTMLFormElement>("#github-form");
const userInput = document.querySelector<HTMLInputElement>("#github-user");
const orgInput = document.querySelector<HTMLInputElement>("#github-org");
const statusText = document.querySelector<HTMLElement>("#status-text");

const displayName = document.querySelector<HTMLElement>("#display-name");
const headline = document.querySelector<HTMLElement>("#headline");
const bio = document.querySelector<HTMLElement>("#bio");
const orgLine = document.querySelector<HTMLElement>("#org-line");
const githubProfileLink = document.querySelector<HTMLAnchorElement>("#github-profile-link");
const emailRevealTrigger = document.querySelector<HTMLAnchorElement>("#email-reveal-trigger");
const contactGithubLink = document.querySelector<HTMLAnchorElement>("#contact-github-link");
const contactOrgLink = document.querySelector<HTMLAnchorElement>("#contact-org-link");

const userMetrics = document.querySelector<HTMLElement>("#profile-metrics");
const orgSummary = document.querySelector<HTMLElement>("#org-summary");

const userReposTitle = document.querySelector<HTMLElement>("#user-repos-title");
const orgReposTitle = document.querySelector<HTMLElement>("#org-repos-title");
const userReposGrid = document.querySelector<HTMLElement>("#user-repos-grid");
const orgReposGrid = document.querySelector<HTMLElement>("#org-repos-grid");

const activityTitle = document.querySelector<HTMLElement>("#activity-title");
const activityList = document.querySelector<HTMLElement>("#activity-list");
const contribChart = document.querySelector<HTMLElement>("#contrib-chart");
const opsClock = document.querySelector<HTMLElement>("#ops-clock");
const opsUptime = document.querySelector<HTMLElement>("#ops-uptime");
const opsDate = document.querySelector<HTMLElement>("#ops-date");
const opsTabMain = document.querySelector<HTMLElement>("#ops-tab-main");
const opsTabPortfolio = document.querySelector<HTMLElement>("#ops-tab-portfolio");
const opsTabGithub = document.querySelector<HTMLElement>("#ops-tab-github");
const opsTabNetwork = document.querySelector<HTMLElement>("#ops-tab-network");
const opsTabResume = document.querySelector<HTMLElement>("#ops-tab-resume");
const opsNetworkState = document.querySelector<HTMLElement>("#ops-network-state");
const opsFilesSummary = document.querySelector<HTMLElement>("#ops-files-summary");
const opsFileFeed = document.querySelector<HTMLElement>("#ops-file-feed");
const opsFilesFoot = document.querySelector<HTMLElement>("#ops-files-foot");
const resumeStatus = document.querySelector<HTMLElement>("#resume-status");
const resumeMarkdown = document.querySelector<HTMLElement>("#resume-markdown");

const bootStartedAt = Date.now();
const PAGE_VIEWS: PageView[] = ["main", "portfolio", "github", "network", "resume"];
const pageSections = Array.from(document.querySelectorAll<HTMLElement>("[data-pages]"));
const opsTabLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".ops-tab[data-page]"));
const PUBLIC_EMAIL = "terrillmoyo@me.com";

function sanitizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "");
}

function resolvePageView(pathname: string): PageView {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (first && PAGE_VIEWS.includes(first as PageView)) {
    return first as PageView;
  }
  return "main";
}

function parseSectionPages(rawPages: string | undefined): PageView[] {
  if (!rawPages) return [];
  return rawPages
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is PageView => PAGE_VIEWS.includes(value as PageView));
}

function applyPageView(view: PageView): void {
  for (const section of pageSections) {
    const pages = parseSectionPages(section.dataset.pages);
    const isVisible = pages.length === 0 || pages.includes(view);
    section.hidden = !isVisible;
  }

  for (const link of opsTabLinks) {
    const route = (link.dataset.page ?? "").toLowerCase();
    const isActive = route === view;
    link.classList.toggle("ops-tab-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readSnapshot(): PortfolioSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioSnapshot;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: PortfolioSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage errors (private mode/quota/etc.)
  }
}

function isRateLimitMessage(text: string): boolean {
  return /rate limit/i.test(text);
}

function githubEndpoint(path: string): string {
  return `/api/github?endpoint=${encodeURIComponent(path)}`;
}

function setStatus(message: string, tone: StatusTone = "default"): void {
  if (!statusText) return;
  statusText.textContent = message;
  statusText.classList.remove("loading", "warning", "error");
  if (tone !== "default") statusText.classList.add(tone);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function setSectionLabels(userHandle: string, orgHandle: string): void {
  if (userReposTitle) {
    userReposTitle.textContent = userHandle
      ? `Personal Repositories (@${userHandle})`
      : "Personal Repositories (Not Loaded)";
  }
  if (orgReposTitle) {
    orgReposTitle.textContent = orgHandle
      ? `Organization Repositories (@${orgHandle})`
      : "Organization Repositories (Not Loaded)";
  }
  if (activityTitle) {
    activityTitle.textContent = userHandle
      ? `Personal Public Activity (@${userHandle})`
      : "Personal Public Activity (Not Loaded)";
  }
}

function initEmailReveal(): void {
  if (!emailRevealTrigger) return;

  const defaultLabel = "Email";
  const defaultAriaLabel = "Reveal email address";
  let revealed = false;
  emailRevealTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    revealed = !revealed;
    if (revealed) {
      emailRevealTrigger.textContent = PUBLIC_EMAIL;
      emailRevealTrigger.href = `mailto:${PUBLIC_EMAIL}`;
      emailRevealTrigger.classList.add("revealed");
      emailRevealTrigger.setAttribute("aria-label", `Email ${PUBLIC_EMAIL}`);
      emailRevealTrigger.title = "Click again to hide email";
      return;
    }

    emailRevealTrigger.textContent = defaultLabel;
    emailRevealTrigger.href = "#";
    emailRevealTrigger.classList.remove("revealed");
    emailRevealTrigger.setAttribute("aria-label", defaultAriaLabel);
    emailRevealTrigger.removeAttribute("title");
  });
}

function setOpsTabMain(handle: string): void {
  if (!opsTabMain) return;
  opsTabMain.textContent = `${handle.toLowerCase()}@devstack`;
}

function setOpsTabGithub(userHandle: string, orgHandle: string): void {
  if (!opsTabGithub) return;
  opsTabGithub.textContent = `@${userHandle.toLowerCase()} | @${orgHandle.toLowerCase()}`;
}

function setOpsPortfolioSummary(userCount: number | null, orgCount: number | null): void {
  if (!opsTabPortfolio) return;

  if (userCount === null && orgCount === null) {
    opsTabPortfolio.textContent = "repos unavailable";
    return;
  }
  if (userCount !== null && orgCount !== null) {
    opsTabPortfolio.textContent = `repos ${userCount}/${orgCount}`;
    return;
  }
  if (userCount !== null) {
    opsTabPortfolio.textContent = `repos ${userCount}/--`;
    return;
  }
  opsTabPortfolio.textContent = `repos --/${orgCount}`;
}

function setOpsNetworkState(label: string, tone: "online" | "warning" | "degraded", detail: string): void {
  if (opsNetworkState) {
    opsNetworkState.textContent = label;
    opsNetworkState.classList.remove("ops-state-online", "ops-state-warning", "ops-state-degraded");
    if (tone === "online") opsNetworkState.classList.add("ops-state-online");
    if (tone === "warning") opsNetworkState.classList.add("ops-state-warning");
    if (tone === "degraded") opsNetworkState.classList.add("ops-state-degraded");
  }
  if (opsTabNetwork) {
    opsTabNetwork.textContent = detail;
  }
}

function setOpsResumeSummary(status: string): void {
  if (!opsTabResume) return;
  opsTabResume.textContent = status;
}

function formatDateBadge(date: Date): string {
  return date
    .toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
    .toUpperCase();
}

function formatClockValue(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatUptimeValue(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function startOpsTelemetryClock(): void {
  if (!opsClock && !opsUptime && !opsDate) return;

  const tick = () => {
    const now = new Date();
    if (opsClock) opsClock.textContent = formatClockValue(now);
    if (opsDate) opsDate.textContent = formatDateBadge(now);
    if (opsUptime) {
      const uptime = formatUptimeValue(Date.now() - bootStartedAt);
      opsUptime.textContent = `uptime ${uptime}`;
    }
  };

  tick();
  window.setInterval(tick, 1000);
}

function updateUrl(): void {
  const url = new URL(window.location.href);
  history.replaceState(null, "", `${url.pathname}${url.hash}`);
}

function placeholder(message: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = message;
  return p;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMarkdownInline(value: string): string {
  let formatted = escapeHtml(value);
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return formatted;
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const compact = line.trim();

    if (!compact) {
      closeList();
      continue;
    }

    const h1 = compact.match(/^#\s+(.+)/);
    if (h1) {
      closeList();
      html.push(`<h1>${formatMarkdownInline(h1[1])}</h1>`);
      continue;
    }

    const h2 = compact.match(/^##\s+(.+)/);
    if (h2) {
      closeList();
      html.push(`<h2>${formatMarkdownInline(h2[1])}</h2>`);
      continue;
    }

    const h3 = compact.match(/^###\s+(.+)/);
    if (h3) {
      closeList();
      html.push(`<h3>${formatMarkdownInline(h3[1])}</h3>`);
      continue;
    }

    const list = compact.match(/^[-*]\s+(.+)/);
    if (list) {
      if (!inList) {
        inList = true;
        html.push("<ul>");
      }
      html.push(`<li>${formatMarkdownInline(list[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${formatMarkdownInline(compact)}</p>`);
  }

  closeList();
  return html.join("\n");
}

async function loadResumeMarkdown(): Promise<void> {
  if (!resumeMarkdown || !resumeStatus) return;
  resumeStatus.textContent = "Loading work experience markdown...";
  resumeStatus.classList.remove("error", "warning");
  resumeStatus.classList.add("loading");
  setOpsResumeSummary("loading");

  try {
    const response = await fetch("/content/work-experience.md", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load markdown (${response.status}).`);
    }
    const markdown = await response.text();
    const rendered = renderMarkdown(markdown);
    resumeMarkdown.innerHTML = rendered;
    resumeStatus.textContent = "Experience dossier loaded from work-experience.md";
    resumeStatus.classList.remove("loading", "error", "warning");
    setOpsResumeSummary("loaded");
  } catch (error) {
    resumeMarkdown.innerHTML = "";
    resumeMarkdown.append(placeholder("Unable to load work experience markdown right now."));
    resumeStatus.textContent = errorMessage(error);
    resumeStatus.classList.remove("loading", "warning");
    resumeStatus.classList.add("error");
    setOpsResumeSummary("error");
  }
}

function renderOpsFileRows(rows: Array<{ name: string; type: string; updated: string }>): void {
  if (!opsFileFeed) return;
  opsFileFeed.innerHTML = "";
  for (const row of rows) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const type = document.createElement("span");
    const updated = document.createElement("span");
    name.textContent = row.name;
    type.textContent = row.type;
    updated.textContent = row.updated;
    item.append(name, type, updated);
    opsFileFeed.append(item);
  }
}

function setOpsFilePanelLoading(): void {
  if (opsFilesSummary) opsFilesSummary.textContent = "loading";
  if (opsFilesFoot) opsFilesFoot.textContent = "Mount /github syncing...";
  renderOpsFileRows([{ name: "syncing...", type: "stream", updated: "--" }]);
}

function renderOpsFilePanel(repos: GitHubRepo[]): void {
  if (!opsFileFeed) return;
  const rows = repos.slice(0, 9).map((repo) => ({
    name: repo.name,
    type: repo.language ? repo.language.toLowerCase() : "repo",
    updated: formatDate(repo.pushed_at),
  }));

  if (rows.length === 0) {
    renderOpsFileRows([{ name: "no-public-repos", type: "empty", updated: "--" }]);
    if (opsFilesSummary) opsFilesSummary.textContent = "0 entries";
    if (opsFilesFoot) opsFilesFoot.textContent = "Mount /github idle";
    return;
  }

  renderOpsFileRows(rows);
  if (opsFilesSummary) opsFilesSummary.textContent = `${rows.length} entries`;
  if (opsFilesFoot) opsFilesFoot.textContent = `Mount /github used ${Math.min(95, rows.length * 9)}%`;
}

function renderOpsFilePanelFallback(): void {
  renderOpsFileRows([
    { name: "matrixjava.dev", type: "site", updated: "cached" },
    { name: "github-stream", type: "api", updated: "offline" },
    { name: "portfolio-state", type: "cache", updated: "stale" },
  ]);
  if (opsFilesSummary) opsFilesSummary.textContent = "fallback";
  if (opsFilesFoot) opsFilesFoot.textContent = "Mount /github degraded";
}

function createMetricCard(label: string, value: string): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "metric";

  const labelElement = document.createElement("span");
  labelElement.className = "label";
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "value";
  valueElement.textContent = value;

  card.append(labelElement, valueElement);
  return card;
}

function resolveOrgDescription(org: GitHubOrg): string {
  const explicitDescription = org.description?.trim();
  if (explicitDescription) return explicitDescription;

  if (org.login.toLowerCase() === "bytebasherslabs") {
    return "ByteBashersLabs is a builder-focused software org creating practical products, open-source tools, and real-world learning projects in public.";
  }

  return "No organization description provided.";
}

function renderUserMetrics(user: GitHubUser): void {
  if (!userMetrics) return;
  userMetrics.innerHTML = "";

  const items = [
    { label: "Public Repos", value: user.public_repos.toString() },
    { label: "Public Gists", value: user.public_gists.toString() },
    { label: "Followers", value: user.followers.toString() },
    { label: "Following", value: user.following.toString() },
  ];

  for (const item of items) {
    userMetrics.append(createMetricCard(item.label, item.value));
  }
}

function renderOrgSummary(org: GitHubOrg): void {
  if (!orgSummary) return;
  orgSummary.innerHTML = "";

  const heading = document.createElement("p");
  heading.className = "org-heading";
  heading.textContent = `Organization Snapshot (@${org.login})`;

  const cards = document.createElement("div");
  cards.className = "org-summary-grid";
  cards.append(
    createMetricCard("Org Name", org.name ?? org.login),
    createMetricCard("Public Repos", org.public_repos.toString()),
    createMetricCard("Followers", org.followers.toString()),
  );

  const description = document.createElement("p");
  description.className = "org-description";
  description.textContent = resolveOrgDescription(org);

  orgSummary.append(heading, cards, description);
}

function renderOrgSummaryFallback(message: string): void {
  if (!orgSummary) return;
  orgSummary.innerHTML = "";
  orgSummary.append(placeholder(message));
}

function renderRepoCard(repo: GitHubRepo): HTMLElement {
  const card = document.createElement("article");
  card.className = "repo-card";

  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = repo.html_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = repo.name;
  title.append(link);

  const description = document.createElement("p");
  description.textContent = repo.description ?? "No description provided.";

  const meta = document.createElement("div");
  meta.className = "repo-meta";

  const language = document.createElement("span");
  const languageStrong = document.createElement("strong");
  languageStrong.textContent = repo.language ?? "n/a";
  language.append(languageStrong);

  const stars = document.createElement("span");
  stars.textContent = `Stars: ${repo.stargazers_count}`;

  const forks = document.createElement("span");
  forks.textContent = `Forks: ${repo.forks_count}`;

  const updated = document.createElement("span");
  updated.textContent = `Updated: ${formatDate(repo.pushed_at)}`;

  meta.append(language, stars, forks, updated);
  card.append(title, description, meta);
  return card;
}

function normalizeRepos(repos: GitHubRepo[]): GitHubRepo[] {
  return repos
    .filter((repo) => !repo.fork)
    .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, 12);
}

function renderRepoGrid(container: HTMLElement | null, repos: GitHubRepo[], emptyMessage: string): void {
  if (!container) return;
  container.innerHTML = "";
  if (repos.length === 0) {
    container.append(placeholder(emptyMessage));
    return;
  }

  for (const repo of repos) {
    container.append(renderRepoCard(repo));
  }
}

function eventLabel(event: GitHubEvent): string {
  const repoName = event.repo.name;
  switch (event.type) {
    case "PushEvent":
      return `Pushed commits to ${repoName}`;
    case "PullRequestEvent":
      return `${event.payload?.action ?? "Updated"} pull request in ${repoName}`;
    case "IssuesEvent":
      return `${event.payload?.action ?? "Updated"} issue in ${repoName}`;
    case "IssueCommentEvent":
      return `Commented on an issue in ${repoName}`;
    case "PullRequestReviewEvent":
      return `Reviewed a pull request in ${repoName}`;
    case "CreateEvent":
      return `Created ${event.payload?.ref_type ?? "item"} in ${repoName}`;
    default:
      return `${event.type.replace(/Event$/, "")} in ${repoName}`;
  }
}

function toRepoUrl(apiUrl: string): string {
  return apiUrl.replace("https://api.github.com/repos/", "https://github.com/");
}

function renderEvents(events: GitHubEvent[]): void {
  if (!activityList) return;
  activityList.innerHTML = "";

  const visibleEvents = events.slice(0, 8);
  if (visibleEvents.length === 0) {
    activityList.append(placeholder("No recent public activity yet."));
    return;
  }

  for (const event of visibleEvents) {
    const item = document.createElement("article");
    item.className = "activity-item";

    const link = document.createElement("a");
    link.href = toRepoUrl(event.repo.url);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = eventLabel(event);

    const time = document.createElement("time");
    time.dateTime = event.created_at;
    time.textContent = formatDate(event.created_at);

    item.append(link, document.createElement("br"), time);
    activityList.append(item);
  }
}

function contributionLevel(day: ContributionDay): number {
  switch (day.contributionLevel) {
    case "FIRST_QUARTILE":
      return 1;
    case "SECOND_QUARTILE":
      return 2;
    case "THIRD_QUARTILE":
      return 3;
    case "FOURTH_QUARTILE":
      return 4;
    default:
      return 0;
  }
}

function contributionLabel(date: string, count: number): string {
  const prettyDate = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (count === 0) return `${prettyDate}: no contributions`;
  if (count === 1) return `${prettyDate}: 1 contribution`;
  return `${prettyDate}: ${count} contributions`;
}

async function fetchContributions(userHandle: string): Promise<ContributionApiResponse> {
  const encoded = encodeURIComponent(userHandle);
  const response = await fetch(`https://github-contributions-api.deno.dev/${encoded}.json`);
  if (!response.ok) {
    if (response.status === 404) throw new Error(`Contribution history for @${userHandle} was not found.`);
    throw new Error(`Contribution history request failed (${response.status}).`);
  }
  return (await response.json()) as ContributionApiResponse;
}

function renderContributionChart(data: ContributionApiResponse, userHandle: string): void {
  if (!contribChart) return;
  contribChart.innerHTML = "";

  const recentWeeks = data.contributions.slice(-53);
  const weeks = recentWeeks.map((week) => {
    const padded = [...week];
    while (padded.length < 7) {
      padded.push({
        date: "",
        contributionCount: 0,
        contributionLevel: "NONE",
      });
    }
    return padded;
  });

  const months = document.createElement("div");
  months.className = "contrib-months";
  months.style.gridTemplateColumns = `repeat(${weeks.length}, var(--contrib-cell-size))`;

  let lastMonth = "";
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const firstValidDay = weeks[weekIndex].find((day) => day.date);
    if (!firstValidDay) continue;
    const month = new Date(firstValidDay.date).toLocaleDateString(undefined, { month: "short" });
    if (month !== lastMonth) {
      const label = document.createElement("span");
      label.textContent = month;
      label.style.gridColumnStart = `${weekIndex + 1}`;
      months.append(label);
      lastMonth = month;
    }
  }

  const body = document.createElement("div");
  body.className = "contrib-body";

  const weekdays = document.createElement("div");
  weekdays.className = "contrib-weekdays";
  weekdays.innerHTML = "<span>Mon</span><span>Wed</span><span>Fri</span>";

  const grid = document.createElement("div");
  grid.className = "contrib-grid";
  grid.style.gridTemplateColumns = `repeat(${weeks.length}, var(--contrib-cell-size))`;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const day = weeks[weekIndex][dayIndex];
      const cell = document.createElement("span");
      cell.className = "contrib-cell";

      if (!day.date) {
        cell.classList.add("is-empty");
      } else {
        const level = contributionLevel(day);
        if (level === 0) {
          cell.classList.add("is-empty");
        } else {
          cell.classList.add("is-filled");
          cell.dataset.level = String(level);
        }
        cell.title = contributionLabel(day.date, day.contributionCount);
      }

      grid.append(cell);
    }
  }

  body.append(weekdays, grid);
  contribChart.append(months, body);
  contribChart.setAttribute(
    "aria-label",
    `${userHandle} contribution grid with ${data.totalContributions} total contributions in the last year.`,
  );
}

async function setContributionChart(userHandle: string): Promise<ContributionApiResponse> {
  const data = await fetchContributions(userHandle);
  renderContributionChart(data, userHandle);
  return data;
}

function clearContributionChart(message: string): void {
  if (!contribChart) return;
  contribChart.innerHTML = "";
  contribChart.append(placeholder(message));
  contribChart.setAttribute("aria-label", message);
}

function applyOrgLinks(orgHandle: string, orgUrl?: string): void {
  const url = orgUrl ?? `https://github.com/${orgHandle}`;
  const inlineOrgLink = document.querySelector<HTMLAnchorElement>("#org-profile-link");
  if (inlineOrgLink) {
    inlineOrgLink.href = url;
    inlineOrgLink.textContent = `@${orgHandle}`;
  }
  if (contactOrgLink) {
    contactOrgLink.href = url;
    contactOrgLink.textContent = url.replace(/^https?:\/\//, "");
  }
  if (!inlineOrgLink && orgLine) {
    const link = document.createElement("a");
    link.id = "org-profile-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `@${orgHandle}`;
    orgLine.append(document.createTextNode(" "));
    orgLine.append(link);
  }
}

function applyUserProfile(user: GitHubUser, orgHandle: string): void {
  const displayHandle = user.login.toLowerCase();
  if (displayName) {
    displayName.textContent = "";
    displayName.append(document.createTextNode(`${displayHandle} `));
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = "_";
    displayName.append(cursor);
  }

  if (headline) headline.textContent = user.bio ?? "Builder, debugger, and open-source collaborator.";
  if (bio) {
    bio.textContent = `Tracking public work from @${user.login}, plus open-source builds with @${orgHandle}.`;
  }

  if (githubProfileLink) {
    githubProfileLink.href = user.html_url;
    githubProfileLink.textContent = `GitHub @${user.login}`;
  }
  if (contactGithubLink) {
    contactGithubLink.href = user.html_url;
    contactGithubLink.textContent = user.html_url.replace(/^https?:\/\//, "");
  }
}

function applyUserFallback(userHandle: string, orgHandle: string): void {
  const displayHandle = userHandle.toLowerCase();
  if (displayName) {
    displayName.textContent = "";
    displayName.append(document.createTextNode(`${displayHandle} `));
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = "_";
    displayName.append(cursor);
  }

  if (headline) headline.textContent = "Builder, debugger, and open-source collaborator.";
  if (bio) bio.textContent = `Unable to load @${userHandle} profile right now. Organization feed still available below.`;

  const userUrl = `https://github.com/${userHandle}`;
  if (githubProfileLink) {
    githubProfileLink.href = userUrl;
    githubProfileLink.textContent = `GitHub @${userHandle}`;
  }
  if (contactGithubLink) {
    contactGithubLink.href = userUrl;
    contactGithubLink.textContent = userUrl.replace(/^https?:\/\//, "");
  }
  applyOrgLinks(orgHandle);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error while loading GitHub data.";
}

async function fetchJson<T>(url: string, resource: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error(`${resource} was not found.`);
    if (response.status === 403) throw new Error(`GitHub API rate limit reached while loading ${resource}.`);
    throw new Error(`${resource} request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

async function loadPortfolio(userHandle: string, orgHandle: string): Promise<void> {
  const cleanUser = sanitizeHandle(userHandle);
  const cleanOrg = sanitizeHandle(orgHandle);
  if (!cleanUser || !cleanOrg) {
    setStatus("Please provide both a GitHub user and organization.", "error");
    return;
  }

  setSectionLabels(cleanUser, cleanOrg);
  setStatus(`Loading @${cleanUser} and @${cleanOrg}...`, "loading");
  setOpsTabMain(cleanUser);
  setOpsTabGithub(cleanUser, cleanOrg);
  setOpsPortfolioSummary(null, null);
  setOpsNetworkState("SYNCING", "warning", "api syncing");

  if (userReposGrid) userReposGrid.innerHTML = "";
  if (orgReposGrid) orgReposGrid.innerHTML = "";
  if (activityList) activityList.innerHTML = "";
  if (userMetrics) userMetrics.innerHTML = "";
  if (orgSummary) orgSummary.innerHTML = "";
  setOpsFilePanelLoading();

  const encodedUser = encodeURIComponent(cleanUser);
  const encodedOrg = encodeURIComponent(cleanOrg);

  const [orgResult, orgReposResult, userResult, userReposResult, eventsResult] = await Promise.allSettled([
    fetchJson<GitHubOrg>(githubEndpoint(`/orgs/${encodedOrg}`), `Organization @${cleanOrg}`),
    fetchJson<GitHubRepo[]>(
      githubEndpoint(`/orgs/${encodedOrg}/repos?sort=updated&per_page=100&type=public`),
      `Organization repositories for @${cleanOrg}`,
    ),
    fetchJson<GitHubUser>(githubEndpoint(`/users/${encodedUser}`), `User @${cleanUser}`),
    fetchJson<GitHubRepo[]>(
      githubEndpoint(`/users/${encodedUser}/repos?sort=updated&per_page=100&type=owner`),
      `Repositories for @${cleanUser}`,
    ),
    fetchJson<GitHubEvent[]>(
      githubEndpoint(`/users/${encodedUser}/events/public?per_page=30`),
      `Public activity for @${cleanUser}`,
    ),
  ]);

  let resolvedUser = cleanUser;
  let resolvedOrg = cleanOrg;
  let userRepoCount: number | null = null;
  let orgRepoCount: number | null = null;
  const warnings: string[] = [];

  if (orgResult.status === "fulfilled") {
    resolvedOrg = orgResult.value.login;
    renderOrgSummary(orgResult.value);
    applyOrgLinks(resolvedOrg, orgResult.value.html_url);
  } else {
    warnings.push(`Org error: ${errorMessage(orgResult.reason)}`);
    renderOrgSummaryFallback(`Organization summary unavailable for @${cleanOrg}.`);
    applyOrgLinks(cleanOrg);
  }

  if (orgReposResult.status === "fulfilled") {
    const repos = normalizeRepos(orgReposResult.value);
    orgRepoCount = repos.length;
    renderRepoGrid(orgReposGrid, repos, "No public organization repositories found.");
  } else {
    warnings.push(`Org repos: ${errorMessage(orgReposResult.reason)}`);
    if (orgReposGrid) {
      orgReposGrid.innerHTML = "";
      orgReposGrid.append(placeholder("Organization repositories unavailable right now."));
    }
  }

  if (userResult.status === "fulfilled") {
    resolvedUser = userResult.value.login;
    applyUserProfile(userResult.value, resolvedOrg);
    renderUserMetrics(userResult.value);
    try {
      await setContributionChart(resolvedUser);
    } catch (error) {
      warnings.push(`Contribution chart: ${errorMessage(error)}`);
      clearContributionChart("GitHub contribution chart unavailable right now.");
    }
  } else {
    warnings.push(`User error: ${errorMessage(userResult.reason)}`);
    applyUserFallback(cleanUser, resolvedOrg);
    if (userMetrics) {
      userMetrics.innerHTML = "";
      userMetrics.append(placeholder("Personal profile metrics unavailable right now."));
    }
    clearContributionChart("GitHub contribution chart unavailable.");
  }

  if (userReposResult.status === "fulfilled") {
    const repos = normalizeRepos(userReposResult.value);
    userRepoCount = repos.length;
    renderRepoGrid(userReposGrid, repos, "No public personal repositories found.");
    renderOpsFilePanel(repos);
  } else {
    warnings.push(`User repos: ${errorMessage(userReposResult.reason)}`);
    if (userReposGrid) {
      userReposGrid.innerHTML = "";
      userReposGrid.append(placeholder("Personal repositories unavailable right now."));
    }
    renderOpsFilePanelFallback();
  }

  if (eventsResult.status === "fulfilled") {
    renderEvents(eventsResult.value);
  } else {
    warnings.push(`Activity: ${errorMessage(eventsResult.reason)}`);
    if (activityList) {
      activityList.innerHTML = "";
      activityList.append(placeholder("Personal activity feed unavailable right now."));
    }
  }

  setSectionLabels(resolvedUser, resolvedOrg);
  setOpsTabMain(resolvedUser);
  setOpsTabGithub(resolvedUser, resolvedOrg);
  setOpsPortfolioSummary(userRepoCount, orgRepoCount);
  updateUrl();
  if (userInput) userInput.value = resolvedUser;
  if (orgInput) orgInput.value = resolvedOrg;

  if (userResult.status === "fulfilled") {
    localStorage.setItem(STORAGE_USER_KEY, resolvedUser);
  }
  if (orgResult.status === "fulfilled") {
    localStorage.setItem(STORAGE_ORG_KEY, resolvedOrg);
  }

  if (warnings.length === 0) {
    setOpsNetworkState("ONLINE", "online", "api stable");
    setStatus(`Loaded @${resolvedUser} and @${resolvedOrg}.`, "default");
    return;
  }

  const bothProfilesFailed = userResult.status === "rejected" && orgResult.status === "rejected";
  const prefix = bothProfilesFailed ? "Failed to load GitHub profiles." : "Loaded with warnings.";
  if (bothProfilesFailed) {
    setOpsNetworkState("DEGRADED", "degraded", "api limited");
  } else {
    setOpsNetworkState("WARN", "warning", "partial data");
  }
  setStatus(`${prefix} ${warnings.join(" ")}`, bothProfilesFailed ? "error" : "warning");
}

function init(): void {
  if (!form || !userInput || !orgInput) return;

  const view = resolvePageView(window.location.pathname);
  applyPageView(view);
  startOpsTelemetryClock();
  initEmailReveal();
  if (view === "resume") {
    void loadResumeMarkdown();
  } else {
    setOpsResumeSummary("ready");
  }

  const params = new URLSearchParams(window.location.search);
  const queryUser = sanitizeHandle(params.get("user") ?? "");
  const queryOrg = sanitizeHandle(params.get("org") ?? "");
  const storedUser = sanitizeHandle(localStorage.getItem(STORAGE_USER_KEY) ?? "");
  const storedOrg = sanitizeHandle(localStorage.getItem(STORAGE_ORG_KEY) ?? "");

  const initialUser = queryUser || storedUser || DEFAULT_USER;
  const initialOrg = queryOrg || storedOrg || DEFAULT_ORG;

  userInput.value = initialUser;
  orgInput.value = initialOrg;
  void loadPortfolio(initialUser, initialOrg);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextUser = sanitizeHandle(userInput.value);
    const nextOrg = sanitizeHandle(orgInput.value);
    if (!nextUser || !nextOrg) {
      setStatus("Please provide both a GitHub user and organization.", "error");
      return;
    }
    userInput.value = nextUser;
    orgInput.value = nextOrg;
    void loadPortfolio(nextUser, nextOrg);
  });
}

init();

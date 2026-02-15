type StatusTone = "default" | "loading" | "warning" | "error";

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

const DEFAULT_USER = "MatrixJava";
const DEFAULT_ORG = "ByteBashersLabs";
const STORAGE_USER_KEY = "portfolio.github.user";
const STORAGE_ORG_KEY = "portfolio.github.org";

const form = document.querySelector<HTMLFormElement>("#github-form");
const userInput = document.querySelector<HTMLInputElement>("#github-user");
const orgInput = document.querySelector<HTMLInputElement>("#github-org");
const statusText = document.querySelector<HTMLElement>("#status-text");

const displayName = document.querySelector<HTMLElement>("#display-name");
const headline = document.querySelector<HTMLElement>("#headline");
const bio = document.querySelector<HTMLElement>("#bio");
const orgLine = document.querySelector<HTMLElement>("#org-line");
const githubProfileLink = document.querySelector<HTMLAnchorElement>("#github-profile-link");
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
const contribChart = document.querySelector<HTMLImageElement>("#contrib-chart");

function sanitizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "");
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
  if (userReposTitle) userReposTitle.textContent = `Personal Repositories (@${userHandle})`;
  if (orgReposTitle) orgReposTitle.textContent = `Organization Repositories (@${orgHandle})`;
  if (activityTitle) activityTitle.textContent = `Personal Public Activity (@${userHandle})`;
}

function updateUrl(userHandle: string, orgHandle: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("user", userHandle);
  url.searchParams.set("org", orgHandle);
  history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

function placeholder(message: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = message;
  return p;
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
  description.textContent = org.description ?? "No organization description provided.";

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

function setContributionChart(userHandle: string): void {
  if (!contribChart) return;
  contribChart.src = `https://ghchart.rshah.org/ff3b3b/${encodeURIComponent(userHandle)}`;
  contribChart.alt = `GitHub contributions for ${userHandle}`;
}

function clearContributionChart(message: string): void {
  if (!contribChart) return;
  contribChart.removeAttribute("src");
  contribChart.alt = message;
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
  if (displayName) {
    displayName.textContent = "";
    displayName.append(document.createTextNode(`${user.name ?? user.login} `));
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
  if (displayName) {
    displayName.textContent = "";
    displayName.append(document.createTextNode(`${userHandle} `));
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

  if (userReposGrid) userReposGrid.innerHTML = "";
  if (orgReposGrid) orgReposGrid.innerHTML = "";
  if (activityList) activityList.innerHTML = "";
  if (userMetrics) userMetrics.innerHTML = "";
  if (orgSummary) orgSummary.innerHTML = "";

  const encodedUser = encodeURIComponent(cleanUser);
  const encodedOrg = encodeURIComponent(cleanOrg);

  const [orgResult, orgReposResult, userResult, userReposResult, eventsResult] = await Promise.allSettled([
    fetchJson<GitHubOrg>(`https://api.github.com/orgs/${encodedOrg}`, `Organization @${cleanOrg}`),
    fetchJson<GitHubRepo[]>(
      `https://api.github.com/orgs/${encodedOrg}/repos?sort=updated&per_page=100&type=public`,
      `Organization repositories for @${cleanOrg}`,
    ),
    fetchJson<GitHubUser>(`https://api.github.com/users/${encodedUser}`, `User @${cleanUser}`),
    fetchJson<GitHubRepo[]>(
      `https://api.github.com/users/${encodedUser}/repos?sort=updated&per_page=100&type=owner`,
      `Repositories for @${cleanUser}`,
    ),
    fetchJson<GitHubEvent[]>(
      `https://api.github.com/users/${encodedUser}/events/public?per_page=30`,
      `Public activity for @${cleanUser}`,
    ),
  ]);

  let resolvedUser = cleanUser;
  let resolvedOrg = cleanOrg;
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
    setContributionChart(resolvedUser);
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
    renderRepoGrid(userReposGrid, repos, "No public personal repositories found.");
  } else {
    warnings.push(`User repos: ${errorMessage(userReposResult.reason)}`);
    if (userReposGrid) {
      userReposGrid.innerHTML = "";
      userReposGrid.append(placeholder("Personal repositories unavailable right now."));
    }
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
  updateUrl(resolvedUser, resolvedOrg);
  if (userInput) userInput.value = resolvedUser;
  if (orgInput) orgInput.value = resolvedOrg;

  if (userResult.status === "fulfilled") {
    localStorage.setItem(STORAGE_USER_KEY, resolvedUser);
  }
  if (orgResult.status === "fulfilled") {
    localStorage.setItem(STORAGE_ORG_KEY, resolvedOrg);
  }

  if (warnings.length === 0) {
    setStatus(`Loaded @${resolvedUser} and @${resolvedOrg}.`, "default");
    return;
  }

  const bothProfilesFailed = userResult.status === "rejected" && orgResult.status === "rejected";
  const prefix = bothProfilesFailed ? "Failed to load GitHub profiles." : "Loaded with warnings.";
  setStatus(`${prefix} ${warnings.join(" ")}`, bothProfilesFailed ? "error" : "warning");
}

function init(): void {
  if (!form || !userInput || !orgInput) return;

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

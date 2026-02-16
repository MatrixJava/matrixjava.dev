const PORT = Number(Bun.env.PORT ?? 3000);
const transpiler = new Bun.Transpiler({ loader: "ts" });
const SPA_ROUTES = new Set(["/", "/index.html", "/main", "/main/", "/portfolio", "/portfolio/", "/github", "/github/", "/network", "/network/", "/resume", "/resume/"]);

async function serveFile(path: string, contentType: string): Promise<Response> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(file, { headers: { "content-type": contentType } });
}

async function proxyGitHub(endpoint: string): Promise<Response> {
  if (!endpoint || !endpoint.startsWith("/")) {
    return new Response(JSON.stringify({ message: "Invalid GitHub endpoint." }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const target = `https://api.github.com${endpoint}`;
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "matrixjava-dev-portfolio",
  });

  if (Bun.env.GITHUB_TOKEN) {
    headers.set("Authorization", `Bearer ${Bun.env.GITHUB_TOKEN}`);
  }

  const upstream = await fetch(target, { headers });
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (SPA_ROUTES.has(url.pathname)) {
      return serveFile("index.html", "text/html; charset=utf-8");
    }

    if (url.pathname === "/styles.css") {
      return serveFile("styles.css", "text/css; charset=utf-8");
    }

    if (url.pathname === "/content/work-experience.md") {
      return serveFile("content/work-experience.md", "text/markdown; charset=utf-8");
    }

    if (url.pathname === "/main.js") {
      const tsSource = await Bun.file("src/main.ts").text();
      const jsSource = transpiler.transformSync(tsSource);
      return new Response(jsSource, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/github") {
      const endpoint = url.searchParams.get("endpoint") ?? "";
      return proxyGitHub(endpoint);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Portfolio running on http://localhost:${server.port}`);

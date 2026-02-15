const PORT = Number(Bun.env.PORT ?? 3000);
const transpiler = new Bun.Transpiler({ loader: "ts" });

async function serveFile(path: string, contentType: string): Promise<Response> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(file, { headers: { "content-type": contentType } });
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveFile("index.html", "text/html; charset=utf-8");
    }

    if (url.pathname === "/styles.css") {
      return serveFile("styles.css", "text/css; charset=utf-8");
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

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Portfolio running on http://localhost:${server.port}`);

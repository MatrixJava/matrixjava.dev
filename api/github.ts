export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") ?? "";

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

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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

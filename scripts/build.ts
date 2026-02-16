import { copyFile, mkdir, rm } from "node:fs/promises";

async function build(): Promise<void> {
  const pageRoutes = ["main", "portfolio", "github", "network", "resume"];

  await rm("dist", { recursive: true, force: true });
  await mkdir("dist", { recursive: true });

  const result = await Bun.build({
    entrypoints: ["src/main.ts"],
    outdir: "dist",
    target: "browser",
    minify: true,
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  await Promise.all(
    [
      copyFile("index.html", "dist/index.html"),
      copyFile("styles.css", "dist/styles.css"),
      mkdir("dist/content", { recursive: true }).then(() =>
        copyFile("content/work-experience.md", "dist/content/work-experience.md"),
      ),
      ...pageRoutes.map(async (route) => {
        await mkdir(`dist/${route}`, { recursive: true });
        await copyFile("index.html", `dist/${route}/index.html`);
      }),
    ],
  );

  console.log("Built static site in dist/");
}

void build();

import { copyFile, mkdir, rm } from "node:fs/promises";

async function build(): Promise<void> {
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

  await Promise.all([
    copyFile("index.html", "dist/index.html"),
    copyFile("styles.css", "dist/styles.css"),
  ]);

  console.log("Built static site in dist/");
}

void build();

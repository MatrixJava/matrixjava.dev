# Bun TypeScript Portfolio

Terminal-inspired portfolio web app with:
- Live GitHub repository cards (public repos, sorted by recent updates)
- Public activity feed from GitHub events
- Public contributions calendar embed
- Username picker stored in `localStorage`

## Run

```bash
bun install
bun run dev
```

Then open `http://localhost:3000`.

## Type Check

```bash
bun run check
```

## Build (Static)

```bash
bun run build
```

Build output is generated in `dist/`.

## Deploy to Vercel

This project is configured for Vercel via `vercel.json`.

1. Push this repo to GitHub.
2. In Vercel, import the repo as a new project.
3. Vercel will run:
   - `bun install`
   - `bun run build`
4. Vercel will serve `dist/`.

Note: Vercel deploys this app as a static site. Keep `server.ts` for local Bun development.

## Customize

- Update static personal text in `index.html`
- Update theme/design in `styles.css`
- Update GitHub fetch/render logic in `src/main.ts`

## Notes

- This app uses the unauthenticated GitHub REST API, which has public rate limits.
- Contribution heatmap is served from `ghchart.rshah.org` for a public visual calendar.

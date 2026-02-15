# matrixjava.dev

Tron-inspired terminal portfolio built with Bun + TypeScript.

Live site: [https://matrixjava.dev](https://matrixjava.dev)

## What It Includes

- Personal and organization GitHub profile loading (`user` + `org`)
- Live repository sections for both:
  - personal repos
  - org repos
- Public GitHub activity feed
- Custom contribution visualization:
  - dark circular cells for empty days
  - red ring intensity for active days
- Persistent profile selection via `localStorage`
- Responsive layout for desktop and mobile

## Tech Stack

- Bun (runtime + build)
- TypeScript
- Vanilla HTML/CSS/TS
- Vercel (deployment)

## Local Development

### Prerequisites

- [Bun](https://bun.sh) installed

### Run

```bash
bun install
bun run dev
```

Open: `http://localhost:3000`

### Type Check

```bash
bun run check
```

### Production Build (Static Output)

```bash
bun run build
```

Build output goes to `dist/`.

## Deployment

This repo is configured for Vercel using `vercel.json`.

- Install command: `bun install`
- Build command: `bun run build`
- Output directory: `dist`

## Project Structure

```text
.
├─ index.html          # page structure
├─ styles.css          # visual system/theme
├─ src/
│  └─ main.ts          # data loading + rendering logic
├─ server.ts           # local Bun dev server
├─ scripts/
│  └─ build.ts         # static build script for Vercel
├─ vercel.json         # Vercel project config
├─ package.json
└─ tsconfig.json
```

## Data Sources

- GitHub REST API (`api.github.com`) for profile, repos, and events
- Contribution history API: `github-contributions-api.deno.dev`

Notes:
- API calls are client-side.
- Unauthenticated GitHub API usage is rate-limited by GitHub.

## Customization Guide

- Edit profile text and section content in `index.html`
- Edit theme and terminal styling in `styles.css`
- Edit GitHub data flow and render behavior in `src/main.ts`

## Domain

Production domain is `matrixjava.dev` on Vercel with custom DNS records managed at Squarespace Domains.

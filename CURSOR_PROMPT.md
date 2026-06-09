# PitWall — Cursor kickoff prompt

Paste this into Cursor's chat (Composer / Agent mode) when you start a fresh build.
It gives the model the whole picture so it stops guessing.

---

## The prompt

You are helping me build **PitWall**, a multiview F1 race-watching tool — a DIY pit wall.
The goal: live timing, a track map, driver telemetry, and (later) onboard video, all running
at once in one interface, turning race day into a home engineering experience.

### What I'm building

A monorepo with:
- A **Python FastAPI backend** that ingests F1 data and pushes it to clients over WebSocket.
- A **Next.js web app** with a draggable/resizable multi-panel dashboard.
- An **Expo (React Native) mobile app** that reuses the same backend.

### Data sources (and their limits — respect these)

- **OpenF1 API** (https://openf1.org) — free, near-real-time timing, car positions, intervals,
  telemetry, team radio. This is the live workhorse. Poll it, cache in Redis, fan out over WebSocket.
- **FastF1** (Python lib) — historical + post-session telemetry and circuit geometry. Use it for
  **replay mode** and to build the track-map SVG. Do NOT rely on it for live data.
- **Video / onboards** — there is no legal public API for F1 onboard streams. Leave a clean,
  swappable `StreamService` interface but do not scrape or bypass DRM. Default to a placeholder
  panel and an optional F1 TV embed.

### Build order (do not skip ahead)

0. Monorepo scaffold + FastAPI skeleton + OpenF1 client + WebSocket hub + Redis. One live number on screen.
1. Live timing leaderboard: position, gap, interval, last/best lap, tyre, sector colors.
2. Track map: SVG circuit from FastF1 geometry, live car dots from position data.
3. Telemetry panel: speed, throttle, brake, gear, DRS for a selected driver.
4. Multiview layout: react-grid-layout panel grid the user can rearrange.
5. Expo mobile: timing + track map first.
6. Video seam: F1 TV embed or replay sync.

### How I want you to work

- Work in **small, reviewable steps**. Build one panel or one endpoint, then stop and let me run it.
- After each step, tell me exactly what command to run to see it working.
- Always read `.cursorrules`, `ARCHITECTURE.md`, and `brand.md` before generating UI or backend code.
- Prefer typed contracts: share types between backend (Pydantic) and frontend (TypeScript) — keep a
  single source of truth in `packages/shared-types`.
- When you touch the WebSocket message format, update the shared types in the same change.
- Use `uv` for Python deps and `pnpm` for JS deps.
- Never invent OpenF1 endpoints — if unsure, ask me to confirm against the docs.

### Start here

Scaffold the monorepo and Phase 0. Show me the folder tree first and wait for my OK before writing files.

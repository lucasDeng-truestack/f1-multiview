# PitWall — Project Plan

A phased roadmap. Build top to bottom; don't skip ahead. Each phase ends with something you can run.

## Phase 0 — Foundation
- [ ] Monorepo scaffold: pnpm workspaces + Turborepo, `apps/`, `packages/`, `backend/`.
- [ ] FastAPI skeleton with health check and one WebSocket route.
- [ ] OpenF1 async client (httpx) with a single working endpoint call.
- [ ] Redis running locally (docker-compose), snapshot read/write helper.
- [ ] WebSocket hub: connect, track clients, broadcast.
- [ ] Web app boots, connects to socket, prints one live value on screen.
- **Done when:** a real OpenF1 number updates in the browser over WebSocket.

## Phase 1 — Live timing
- [ ] TimingService polls OpenF1, normalizes to `TimingRow[]`.
- [ ] `timing.update` flows source → Redis → hub → store → panel.
- [ ] Leaderboard panel: position, driver, gap, interval, last, best, tyre.
- [ ] Sector color flashes (purple/green) per brand.md.
- [ ] Empty state: "No live session."
- **Done when:** during a session, the leaderboard mirrors the real timing tower.

## Phase 2 — Track map
- [ ] Pull circuit geometry via FastF1, ship as `track.geometry`.
- [ ] Render circuit as SVG, scaled to panel.
- [ ] Live car dots from `track.positions`, colored by team/driver.
- **Done when:** dots move around the correct circuit shape in real time.

## Phase 3 — Telemetry
- [ ] TelemetryService: live (OpenF1) + replay (FastF1).
- [ ] `select_driver` client message wires through.
- [ ] Panel: speed, throttle, brake, gear, DRS, with a rolling trace.
- **Done when:** selecting a driver shows their live/replay telemetry.

## Phase 4 — Multiview layout
- [ ] react-grid-layout grid; panels become draggable/resizable.
- [ ] Layout persists to localStorage.
- [ ] Panel picker: add/remove timing, track, telemetry, video.
- **Done when:** you can arrange your own pit wall and it survives reload.

## Phase 5 — Mobile (Expo)
- [ ] Expo app reuses shared-types + ws client logic.
- [ ] Timing panel first, then track map.
- [ ] Test on a physical device (socket + background behavior).
- **Done when:** the phone shows live timing reliably.

## Phase 6 — Video seam
- [ ] StreamService `EmbedStream` returns an F1 TV embed URL.
- [ ] Video panel renders the embed (web first).
- [ ] Replay sync: align replay clock with a recorded broadcast (optional, advanced).
- **Done when:** a video panel sits in the grid alongside live data.

## Replay mode (build alongside Phase 1+, your dev lifeline)
- [ ] `load_replay` loads a past session via FastF1.
- [ ] Virtual clock emits the same message types on a timer.
- **Why:** races are rare. Replay lets you develop every day against real data.

## Backlog / nice-to-have
- [ ] Team radio panel (OpenF1 has radio).
- [ ] Tyre strategy / stint history.
- [ ] Race control messages (flags, penalties).
- [ ] Lap-time delta chart between two drivers.
- [ ] Pit window estimator.

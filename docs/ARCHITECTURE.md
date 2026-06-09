# PitWall — Architecture

The reference doc for how data moves through the system. Cursor should read this before
writing backend services or the WebSocket client.

## Layers

1. **Sources** — OpenF1 API (live), FastF1 (replay + geometry), Stream provider (video, swappable).
2. **Backend** — FastAPI app. Per-concern services poll/process sources, write to Redis, and a
   WebSocket hub fans updates out to all clients. Clients never touch sources directly.
3. **Clients** — Next.js web (multi-panel grid) and Expo mobile. Both speak the same WebSocket
   protocol and share TypeScript payload types.

## Data flow (live timing example)

```
OpenF1 API
   │  httpx async poll (interval from config)
   ▼
TimingService ──writes──► Redis (latest snapshot + pub/sub channel)
   │                                   │
   │                                   ▼
   └──────────────────────────► WebSocket Hub ──broadcast──► all clients
                                                              │
                                          Zustand timing store (web)
                                                              │
                                                  Live timing panel re-renders
```

- Redis holds the **latest snapshot** per data domain so a newly-connected client gets current
  state immediately, then receives deltas over the socket.
- Pub/sub decouples the polling services from the hub: a service publishes, the hub forwards.

## Backend services

- **TimingService** — polls OpenF1 timing/position/interval endpoints; emits `timing.update`.
- **TelemetryService** — polls OpenF1 `/car_data` for the selected driver (live or replay); emits
  batched `telemetry.update` messages with a rolling sample window.
- **StreamService** — interface only by default. Implementations: `NoopStream` (placeholder),
  `EmbedStream` (returns an F1 TV embed URL the client renders). No scraping implementations.
- **SessionService** — tracks whether a session is live, which circuit, session type; emits
  `session.update`. Drives every panel's empty state.

## WebSocket protocol

JSON, discriminated by `type`:

```ts
type ServerMessage =
  | { type: "session.update"; data: Session }
  | { type: "timing.update"; data: TimingRow[] }
  | { type: "telemetry.update"; data: TelemetryUpdate }
  | { type: "track.geometry"; data: TrackGeometry }   // sent once on circuit load
  | { type: "track.positions"; data: CarPosition[] }
  | { type: "error"; message: string };

type ClientMessage =
  | { type: "subscribe"; channels: string[] }
  | { type: "select_driver"; driver: number }
  | { type: "load_replay"; year: number; round: number; session: string };
```

When this schema changes, update `packages/shared-types` and the Pydantic models in the SAME change.

## Replay mode

FastF1 loads a past session, the backend steps a virtual clock, and emits the same message types
on a timer as if live. The client cannot tell the difference — this is how you develop between races.

## Client architecture (web)

- One `wsClient` module: connect, reconnect with exponential backoff, parse, dispatch into stores.
- Zustand stores per domain: `useSessionStore`, `useTimingStore`, `useTelemetryStore`, `useTrackStore`.
- Panels are pure consumers of stores. Each panel owns loading / empty / error rendering.
- react-grid-layout persists the user's layout (localStorage) so their pit wall arrangement sticks.

## Deployment (later, not Phase 0)

- Backend + Redis containerized; deploy to a small VPS or Fly.io.
- Web on Vercel. Mobile via Expo EAS.
- Single `.env`-driven config; document every var in `.env.example`.

## Hard constraints

- Clients never call OpenF1 or FastF1 directly.
- No video scraping or DRM bypass, ever. Video is embed-or-nothing.
- Be a good OpenF1 citizen: cache, respect intervals, back off on errors.

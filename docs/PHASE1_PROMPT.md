# PitWall — Phase 1 prompt (Live timing)

Paste into Cursor after Phase 0. Read `.cursorrules`, `ARCHITECTURE.md`, `brand.md` first.

---

We're building **Phase 1: the live timing leaderboard**. Phase 0 (FastAPI + WebSocket hub +
Redis + OpenF1 client) is done.

## What changed about our data source — respect this

- OpenF1 **live window** data (30 min before session → 30 min after) needs a free OAuth2
  bearer token (3 req/s, 30 req/min). **Historical data (2023+) is free and keyless.** So:
  - Develop and test against **replay** (a past `session_key`, free). This is the default.
  - Live mode = OAuth2 token + `session_key=latest`. Paid tier only doubles rate limits.
  - Detailed telemetry is post-session only; positions and lap times are live.
  - Token foot-gun: `expires_in` in the OAuth response is a string — cast to `int`.
- Every OpenF1 endpoint returns an **append-only time series**, not current state. There is no
  "current leaderboard" endpoint. The TimingService must **assemble a snapshot**: latest record
  per driver across several endpoints, joined with driver metadata.

## The snapshot to assemble (per driver)

Pull these for one `session_key`, reduce to the latest value per driver, and join:

| Field source | Endpoint | What to take |
|---|---|---|
| identity, team colour | `/drivers` | one record per driver (static for the session) |
| position | `/position` | latest record per driver by `date` |
| gap to leader, interval | `/intervals` | latest record per driver by `date` (race only) |
| last lap, best lap, sectors | `/laps` | last = max `lap_number` with a `lap_duration`; best = min `lap_duration` |
| tyre compound + age | `/stints` | current stint = max `stint_number`; age = `tyre_age_at_start` + laps run |

Watch the union types: `gap_to_leader` and `interval` are `number`, the string `"+1 LAP"`, or
`null` for the leader. Sector segment codes: 2048 yellow, 2049 green, 2051 purple, 2064 pitlane.

## Build, in order

1. Pydantic `TimingRow` model + the `TimingService.build_snapshot(session_key, as_of=None)` method.
   `as_of` (a UTC datetime) filters records to `date <= as_of` — that's how replay works.
2. Mirror `TimingRow` in `packages/shared-types/timing.ts`. Same change, both files.
3. Wire `timing.update` through Redis → hub → web store, polling every ~4s (config value).
4. Build `LiveTimingPanel` per `brand.md`: tabular monospace numbers, sector flash on best,
   tyre dot colours, leader accent edge, and a real "No live session" empty state.
5. Replay driver: step a virtual clock and call `build_snapshot(session_key, as_of=clock)` on a timer.

Reference implementations were wired into:

- `backend/src/pitwall/models/timing.py`
- `backend/src/pitwall/services/timing.py`
- `packages/shared-types/src/timing.ts`
- `apps/web/src/components/live-timing-panel.tsx`
- `apps/web/src/components/timing-panel.css`

Ask before changing the WebSocket message schema.

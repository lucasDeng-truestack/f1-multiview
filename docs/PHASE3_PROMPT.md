# PitWall — Phase 3 prompt (Telemetry)

Paste into Cursor after Phase 2. Read `.cursorrules`, `ARCHITECTURE.md`, `brand.md` first.

---

We're building **Phase 3: the telemetry panel** — speed, throttle, brake, gear, RPM, and DRS for
a selected driver, with a rolling trace.

## Source + shape decisions (respect these)

- Use OpenF1 `/car_data` for BOTH live and replay. Do NOT use FastF1 here — it's a separate path
  with different field names; one source = one contract. Live = token + `session_key=latest`;
  replay = historical key + the `as_of` clock.
- `/car_data` is a time series (~3.7 Hz). Fields: `speed` (km/h), `throttle` (0–100),
  `brake` (0 or 100 — on/off, store as a bool, NOT a percentage), `n_gear` (1–8, 0 = neutral) →
  we expose it as `gear`, `rpm`, `drs` (a status CODE, decode it), `date` (ISO string → `ts`).
- DRS code → state: `>= 10` = on, `== 8` = eligible, else off.
- Unlike timing/track (latest-per-driver snapshots), telemetry needs a ROLLING WINDOW. Each
  `telemetry.update` carries a small batch of new samples for the selected driver; the client keeps
  a ring buffer (~30 s) and trims old samples by `ts`.
- Live `/car_data` can lag; replay is reliable. Develop against replay.

## OpenF1 date-filter gotcha (this bit bytes if you skip it)

Comparison filters (`date>`, `date<=`) must be appended to the URL RAW — operator literal, value
URL-encoded. Do NOT pass them through httpx `params`, because httpx encodes the `>` and the `+` in
the `+00:00` offset, and OpenF1 then silently ignores the filter and returns the wrong window.
`OpenF1Client.fetch_car_data` takes a `filters` list of `(field, op, value)` and builds the URL by
hand. Same approach as Phase 2's location window — keep it consistent.

## select_driver flow

- Client sends `{ type: "select_driver", driver: <number> }` over the WebSocket.
- Backend stores the selected driver; the telemetry timer polls `/car_data` for that driver only.
- The driver picker reads acronyms from the timing store (we already have them there).

## Backend: TelemetryService

- `fetch_live(driver_number, since)` → polls `session_key=latest` for samples after the `since`
  cursor; returns the batch plus the advanced cursor (max sample ts) to pass next call.
- `fetch_replay_window(session_key, driver_number, as_of, window_seconds=30)` → trailing window up
  to the virtual clock.
- `_to_sample` decodes `brake` (0/100 → bool), `drs` (code → state), maps `n_gear` → `gear`.

## Frontend

- `useTelemetryStore`: ring buffer keyed to the selected driver. `applyUpdate` appends samples
  (live) or replaces (replay), trims to the last 30 s by `ts`, and ignores updates for a driver
  we're no longer watching.
- `TelemetryPanel` per brand.md: big speed readout, gear + RPM, a DRS pill (green OPEN / amber ELIG
  / dim), throttle + brake pedal bars, and a dependency-free `<canvas>` trace of speed (cyan) /
  throttle (green) / brake (red) over the window. Empty state when no driver is selected.

## Build order

1. `fetch_replay_window` against a known replay (session_key 9165, driver 1 or 16) — log a few
   decoded samples and confirm the date window is right (this is where the filter bug shows up).
2. Store + ring buffer; verify it trims to 30 s.
3. Panel + canvas trace. Then wire `select_driver` and the telemetry timer.

Test: `cd backend && uv run python scripts/test_fetch_replay_window.py`

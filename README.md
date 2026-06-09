# PitWall

Multiview F1 race-watching tool — live timing, track map, telemetry, and more.

## Quick start (Phase 0)

### Prerequisites

- Node 20+, pnpm
- Python 3.12, [uv](https://docs.astral.sh/uv/)
- Docker (for Redis)

### 1. Redis

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # optional — defaults work for local dev
uv sync
uv run uvicorn pitwall.main:app --reload --port 8000
```

Health check: http://localhost:8000/health

### 3. Web

```bash
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
pnpm --filter web dev
```

Open http://localhost:3000 — you should see the **live timing leaderboard** (replay mode by default: Singapore 2023, session 9165).

### WSL notes

- Docker Desktop for Windows exposes Redis on `localhost:6379` inside WSL — `docker compose up -d` works as-is.
- If Redis connection fails, confirm Docker Desktop is running and WSL integration is enabled for your distro.

### Phase 2 — test track geometry

```bash
cd backend
uv run python scripts/test_build_geometry.py
# First run fetches /location per driver (~60s); cached after that.
```

Scratch route: http://localhost:3000/track-scratch

### Phase 1 — test the snapshot assembler

```bash
cd backend
uv run python scripts/test_build_snapshot.py
# Singapore 2023 race at lap ~20:
uv run python scripts/test_build_snapshot.py --session-key 9165 --as-of 2023-09-17T13:00:00+00:00
```

### Live mode (optional, free OAuth2 tier)

Required only inside the live window (30 min before session → 30 min after).
Outside that window, historical data needs no auth.

```bash
# backend/.env
REPLAY_MODE=false
OPENF1_USERNAME=your_openf1_username
OPENF1_PASSWORD=your_openf1_password
# Or supply a pre-issued bearer: OPENF1_TOKEN=...
```

Token docs: https://openf1.org/auth.html

## Monorepo layout

```
f1-multiview/
├─ apps/
│  ├─ web/              # Next.js 14 dashboard
│  └─ mobile/           # Expo (Phase 5)
├─ packages/
│  ├─ shared-types/     # WebSocket payload types
│  └─ ui/               # Shared components (Phase 4+)
├─ backend/             # FastAPI + OpenF1 + Redis + WebSocket
└─ docs/                # Architecture, brand, project plan
```

## Docs

- [Architecture](docs/ARCHITECTURE.md) — data flow and WebSocket protocol
- [Brand](docs/brand.md) — design tokens and UI voice
- [Project plan](docs/PROJECT_PLAN.md) — phased roadmap

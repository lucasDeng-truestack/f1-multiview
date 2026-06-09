"""Verify TelemetryService.fetch_replay_window against session 9165.

Usage (from backend/):
    uv run python scripts/test_fetch_replay_window.py
    uv run python scripts/test_fetch_replay_window.py --driver 1 --as-of 2023-09-17T13:30:00+00:00
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import UTC, datetime

import httpx

from pitwall.clients.openf1 import OpenF1Client
from pitwall.services.telemetry import TelemetryService


class _NoCache:
    async def write_snapshot(self, *_: object) -> None:
        pass

    async def publish(self, *_: object) -> None:
        pass


async def main(session_key: int, driver: int, as_of: str) -> None:
    as_of_dt = datetime.fromisoformat(as_of)
    if as_of_dt.tzinfo is None:
        as_of_dt = as_of_dt.replace(tzinfo=UTC)

    async with httpx.AsyncClient(timeout=60.0) as client:
        openf1 = OpenF1Client(client)
        service = TelemetryService(openf1, _NoCache())  # type: ignore[arg-type]
        update = await service.fetch_replay_window(session_key, driver, as_of_dt)

    print(f"driver={update.driver_number} is_live={update.is_live}")
    print(f"samples={len(update.samples)}")
    if update.samples:
        first = update.samples[0]
        last = update.samples[-1]
        print(f"window: {first.ts} → {last.ts}")
        for sample in update.samples[:3]:
            print(
                f"  ts={sample.ts} speed={sample.speed} throttle={sample.throttle} "
                f"brake={sample.brake} gear={sample.gear} rpm={sample.rpm} drs={sample.drs}"
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-key", type=int, default=9165)
    parser.add_argument("--driver", type=int, default=16)
    parser.add_argument(
        "--as-of",
        type=str,
        default="2023-09-17T13:30:00+00:00",
        help="UTC replay clock position",
    )
    args = parser.parse_args()
    asyncio.run(main(args.session_key, args.driver, args.as_of))

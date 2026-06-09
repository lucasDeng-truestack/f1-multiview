"""Run build_snapshot against a known historical session_key.

Usage (from backend/):
    uv run python scripts/test_build_snapshot.py
    uv run python scripts/test_build_snapshot.py --session-key 9165
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime

import httpx

from pitwall.clients.openf1 import OpenF1Client
from pitwall.services.timing import TimingService


class _NoCache:
    async def write_snapshot(self, *_: object) -> None:
        pass

    async def publish(self, *_: object) -> None:
        pass


async def main(session_key: int, as_of: str | None) -> None:
    async with httpx.AsyncClient(timeout=60.0) as client:
        openf1 = OpenF1Client(client)
        service = TimingService(openf1, _NoCache())  # type: ignore[arg-type]

        as_of_dt = datetime.fromisoformat(as_of) if as_of else None
        snapshot = await service.build_snapshot(session_key, as_of=as_of_dt)

        print(f"session_key={snapshot.session_key} is_live={snapshot.is_live}")
        print(f"rows={len(snapshot.rows)}")
        print()
        print(f"{'POS':>3}  {'DRV':>3}  {'GAP':>10}  {'LAST':>10}  {'BEST':>10}  {'TYRE':>6}")
        print("-" * 55)
        for row in snapshot.rows[:10]:
            gap = row.gap_to_leader if row.gap_to_leader is not None else "—"
            last = f"{row.last_lap:.3f}" if row.last_lap else "—"
            best = f"{row.best_lap:.3f}" if row.best_lap else "—"
            tyre = row.compound or "—"
            print(
                f"{row.position or '—':>3}  "
                f"{row.name_acronym or row.driver_number:>3}  "
                f"{str(gap):>10}  "
                f"{last:>10}  "
                f"{best:>10}  "
                f"{tyre:>6}"
            )
        if len(snapshot.rows) > 10:
            print(f"... and {len(snapshot.rows) - 10} more drivers")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-key", type=int, default=9165)
    parser.add_argument(
        "--as-of",
        type=str,
        default="2023-09-17T13:00:00+00:00",
        help="UTC cutoff for replay (filters records to date <= as_of)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.session_key, args.as_of))

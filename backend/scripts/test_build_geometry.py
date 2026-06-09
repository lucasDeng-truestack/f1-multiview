"""Run build_geometry against a known historical session.

Usage (from backend/):
    uv run python scripts/test_build_geometry.py
    uv run python scripts/test_build_geometry.py --session-key 9165
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime

import httpx

from pitwall.clients.openf1 import OpenF1Client
from pitwall.services.track import TrackService


class _NoCache:
    async def write_snapshot(self, *_: object) -> None:
        pass

    async def publish(self, *_: object) -> None:
        pass


async def main(session_key: int, as_of: str | None) -> None:
    async with httpx.AsyncClient(timeout=60.0) as client:
        openf1 = OpenF1Client(client)
        service = TrackService(openf1, _NoCache())  # type: ignore[arg-type]

        as_of_dt = datetime.fromisoformat(as_of) if as_of else None
        geometry = await service.build_geometry(session_key, as_of=as_of_dt)
        positions = await service.build_positions(session_key, as_of=as_of_dt)

        print(f"session_key={geometry.session_key}")
        print(f"points={len(geometry.points)}")
        print(f"viewBox={geometry.width:.1f} x {geometry.height:.1f}")
        print(f"cars={len(positions.cars)}")
        if positions.cars:
            sample = positions.cars[0]
            print(
                f"sample car {sample.name_acronym}: ({sample.x}, {sample.y})"
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-key", type=int, default=9165)
    parser.add_argument(
        "--as-of",
        type=str,
        default="2023-09-17T13:00:00+00:00",
        help="UTC cutoff for replay",
    )
    args = parser.parse_args()
    asyncio.run(main(args.session_key, args.as_of))

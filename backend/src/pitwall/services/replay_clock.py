"""ReplayClock — one shared replay time for every service.

Track positions, telemetry (brake/throttle/speed) and the timing tower all read
`now()` from this single clock, so they describe the same instant: the
brake/throttle you see matches where the car is on the track map. Previously
each service ran its own clock and they drifted apart.

The clock advances by real elapsed wall time scaled by `speed` (1.0 = real
time), so playback stays smooth regardless of poll jitter, and loops back to the
session start at the end.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

logger = logging.getLogger(__name__)


def parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


class ReplayClock:
    def __init__(self, speed: float = 1.0, tick_seconds: float = 0.1) -> None:
        self._speed = speed
        self._tick = tick_seconds
        self._now: datetime | None = None
        self._start: datetime | None = None
        self._end: datetime | None = None
        self._task: asyncio.Task[None] | None = None
        self._last: float | None = None

    def configure(self, start: datetime | None, end: datetime | None) -> None:
        """Set the session window and jump the clock to its start. Also used when
        switching sessions at runtime, so it always resets to `start`."""
        self._start = start
        self._end = end
        self._now = start
        logger.info("Replay clock configured: %s → %s (speed=%.2fx)", start, end, self._speed)

    def now(self) -> datetime | None:
        return self._now

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        loop = asyncio.get_running_loop()
        self._last = loop.time()
        while True:
            await asyncio.sleep(self._tick)
            t = loop.time()
            elapsed = (t - self._last) * self._speed
            self._last = t
            if self._now is None:
                continue
            self._now += timedelta(seconds=elapsed)
            if (
                self._end is not None
                and self._now > self._end
                and self._start is not None
            ):
                self._now = self._start
                logger.info("Replay looped to session start")

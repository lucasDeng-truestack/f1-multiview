"""TelemetryService — fetches /car_data for a selected driver and emits batched samples."""

from __future__ import annotations

import asyncio
import bisect
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from pitwall.cache.redis import RedisCache
from pitwall.clients.openf1 import OpenF1Client
from pitwall.config import settings
from pitwall.models.telemetry import TelemetrySample, TelemetryUpdate, drs_state
from pitwall.services.replay_clock import ReplayClock
from pitwall.services.replay_controller import ReplayController

logger = logging.getLogger(__name__)

TRACE_SECONDS = 30.0


@dataclass
class _CachedTrace:
    """A driver's full-session car_data, parsed once and held in memory.

    `ts` is epoch seconds parallel to `samples`, kept sorted so a replay window
    is a pair of binary searches — no OpenF1 call per poll."""

    ts: list[float]
    samples: list[TelemetrySample]


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except ValueError:
        return None


def _to_sample(rec: dict[str, Any]) -> TelemetrySample:
    return TelemetrySample(
        driver_number=rec["driver_number"],
        ts=rec.get("date", ""),
        speed=rec.get("speed"),
        throttle=rec.get("throttle"),
        brake=bool(rec.get("brake")),
        gear=rec.get("n_gear"),
        rpm=rec.get("rpm"),
        drs=drs_state(rec.get("drs")),
    )


class TelemetryService:
    def __init__(
        self,
        openf1: OpenF1Client,
        cache: RedisCache,
        clock: ReplayClock | None = None,
        controller: ReplayController | None = None,
    ) -> None:
        self._openf1 = openf1
        self._cache = cache
        self._clock = clock
        self._controller = controller
        self._synced_version = 0
        self._task: asyncio.Task[None] | None = None
        self._selected_driver: int | None = None
        self._live_cursor: datetime | None = None
        # Replay car_data is immutable — fetch each driver's whole session once,
        # then serve every window from memory. Decouples playback frequency from
        # OpenF1's rate limit. Keyed by driver_number.
        self._trace_cache: dict[int, _CachedTrace] = {}

    def _replay_session_key(self) -> int:
        return (
            self._controller.session_key
            if self._controller is not None
            else settings.replay_session_key
        )

    def _sync_session(self) -> None:
        """Drop the cached car_data traces when the active session changed."""
        if self._controller is None:
            return
        if self._controller.version != self._synced_version:
            self._trace_cache.clear()
            self._synced_version = self._controller.version

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def select_driver(self, driver_number: int) -> None:
        self._selected_driver = driver_number
        self._live_cursor = None
        logger.info("Telemetry driver selected: %d", driver_number)

    async def _run(self) -> None:
        await asyncio.sleep(5)
        interval = settings.telemetry_poll_interval_ms / 1000
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Telemetry poll failed")
            await asyncio.sleep(interval)

    async def _poll_once(self) -> None:
        if settings.replay_mode:
            self._sync_session()
            # Sample the telemetry at the SAME instant the track map and timing
            # tower are showing (shared ReplayClock), so brake/throttle/speed
            # line up with the car's position on the track.
            as_of = self._clock.now() if self._clock else None
            if as_of is None or self._selected_driver is None:
                return
            update = await self.fetch_replay_window(
                self._replay_session_key(),
                self._selected_driver,
                as_of,
            )
        else:
            if self._selected_driver is None:
                return
            update, self._live_cursor = await self.fetch_live(
                self._selected_driver, self._live_cursor
            )

        if not update.samples:
            return

        payload = {"type": "telemetry.update", "data": update.model_dump()}
        await self._cache.write_snapshot("telemetry", payload)
        await self._cache.publish("telemetry", payload)

    async def fetch_live(
        self, driver_number: int, since: datetime | None
    ) -> tuple[TelemetryUpdate, datetime | None]:
        filters = [("date", ">", since.isoformat())] if since is not None else None
        records = await self._openf1.fetch_car_data(
            {"session_key": "latest", "driver_number": driver_number},
            filters,
        )
        samples = [_to_sample(r) for r in records]
        samples.sort(key=lambda s: s.ts)
        new_cursor = since
        if samples:
            last = _parse_date(samples[-1].ts)
            if last is not None:
                new_cursor = last
        return (
            TelemetryUpdate(
                driver_number=driver_number, is_live=True, samples=samples
            ),
            new_cursor,
        )

    async def _ensure_trace_cache(
        self, session_key: int, driver_number: int
    ) -> _CachedTrace:
        """Fetch a driver's full-session car_data once; reuse it thereafter."""
        cached = self._trace_cache.get(driver_number)
        if cached is not None:
            return cached
        records = await self._openf1.fetch_car_data(
            {"session_key": session_key, "driver_number": driver_number}
        )
        pairs: list[tuple[float, TelemetrySample]] = []
        for rec in records:
            dt = _parse_date(rec.get("date"))
            if dt is None:
                continue
            pairs.append((dt.timestamp(), _to_sample(rec)))
        pairs.sort(key=lambda p: p[0])
        trace = _CachedTrace(
            ts=[p[0] for p in pairs], samples=[p[1] for p in pairs]
        )
        self._trace_cache[driver_number] = trace
        logger.info(
            "Replay car_data cached: driver=%d samples=%d", driver_number, len(pairs)
        )
        return trace

    async def fetch_replay_window(
        self,
        session_key: int,
        driver_number: int,
        as_of: datetime,
        window_seconds: float = TRACE_SECONDS,
    ) -> TelemetryUpdate:
        trace = await self._ensure_trace_cache(session_key, driver_number)
        if not trace.ts:
            return TelemetryUpdate(
                driver_number=driver_number, is_live=False, samples=[]
            )
        end_ts = as_of.timestamp()
        start_ts = end_ts - window_seconds
        # Window is (start, end] — matches the previous date>/date<= filters.
        lo = bisect.bisect_right(trace.ts, start_ts)
        hi = bisect.bisect_right(trace.ts, end_ts)
        return TelemetryUpdate(
            driver_number=driver_number,
            is_live=False,
            samples=trace.samples[lo:hi],
        )

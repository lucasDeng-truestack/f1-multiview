"""TelemetryService — fetches /car_data for a selected driver and emits batched samples."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from pitwall.cache.redis import RedisCache
from pitwall.clients.openf1 import OpenF1Client
from pitwall.config import settings
from pitwall.models.telemetry import TelemetrySample, TelemetryUpdate, drs_state

logger = logging.getLogger(__name__)

TRACE_SECONDS = 30.0


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
    def __init__(self, openf1: OpenF1Client, cache: RedisCache) -> None:
        self._openf1 = openf1
        self._cache = cache
        self._task: asyncio.Task[None] | None = None
        self._selected_driver: int | None = None
        self._live_cursor: datetime | None = None
        self._replay_clock: datetime | None = None
        self._replay_start: datetime | None = None
        self._replay_end: datetime | None = None

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
        if settings.replay_mode:
            await self._init_replay_clock()
        interval = settings.telemetry_poll_interval_ms / 1000
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Telemetry poll failed")
            await asyncio.sleep(interval)

    async def _init_replay_clock(self) -> None:
        sessions = await self._openf1.fetch_list(
            "sessions", session_key=settings.replay_session_key
        )
        if not sessions:
            logger.warning("Replay session %s not found", settings.replay_session_key)
            return
        session = sessions[0]
        start = _parse_date(session.get("date_start"))
        end_raw = session.get("date_end")
        self._replay_start = start
        self._replay_clock = start
        self._replay_end = _parse_date({"date": end_raw}) if end_raw else None

    async def _poll_once(self) -> None:
        if self._selected_driver is None:
            return

        if settings.replay_mode:
            if self._replay_clock is None:
                await self._init_replay_clock()
            if self._replay_clock is None:
                return
            update = await self.fetch_replay_window(
                settings.replay_session_key,
                self._selected_driver,
                self._replay_clock,
            )
            await self._advance_replay_clock()
        else:
            update, self._live_cursor = await self.fetch_live(
                self._selected_driver, self._live_cursor
            )

        if not update.samples:
            return

        payload = {"type": "telemetry.update", "data": update.model_dump()}
        await self._cache.write_snapshot("telemetry", payload)
        await self._cache.publish("telemetry", payload)

    async def _advance_replay_clock(self) -> None:
        if self._replay_clock is None:
            return
        self._replay_clock += timedelta(seconds=settings.replay_step_seconds)
        if (
            self._replay_end is not None
            and self._replay_clock > self._replay_end
            and self._replay_start is not None
        ):
            self._replay_clock = self._replay_start

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

    async def fetch_replay_window(
        self,
        session_key: int,
        driver_number: int,
        as_of: datetime,
        window_seconds: float = TRACE_SECONDS,
    ) -> TelemetryUpdate:
        start = as_of - timedelta(seconds=window_seconds)
        records = await self._openf1.fetch_car_data(
            {"session_key": session_key, "driver_number": driver_number},
            [
                ("date", ">", start.isoformat()),
                ("date", "<=", as_of.isoformat()),
            ],
        )
        samples = [_to_sample(r) for r in records]
        samples.sort(key=lambda s: s.ts)
        return TelemetryUpdate(
            driver_number=driver_number, is_live=False, samples=samples
        )

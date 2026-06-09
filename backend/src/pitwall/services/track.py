"""TrackService — circuit outline and live car dots from OpenF1 /location."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

from pitwall.cache.redis import RedisCache
from pitwall.clients.openf1 import OpenF1Client
from pitwall.config import settings
from pitwall.models.track import CarPosition, TrackGeometry, TrackPositions

logger = logging.getLogger(__name__)

VIEWBOX_WIDTH = 1000.0
PADDING = 40.0
# Narrow window per driver — avoids downloading full-session /location (~40k rows each).
# Only needs to span a few sample intervals back from the replay clock to find each
# driver's latest fix; kept small so 1s polling doesn't refetch a huge overlapping window.
LOCATION_LOOKBACK = timedelta(seconds=10)


@dataclass
class _Transform:
    """Maps raw /location (x, y) into normalized SVG frame. Flips Y for SVG."""

    min_x: float
    max_y: float
    scale: float
    width: float
    height: float

    def apply(self, x: float, y: float) -> tuple[float, float]:
        nx = (x - self.min_x) * self.scale + PADDING
        ny = (self.max_y - y) * self.scale + PADDING
        return nx, ny


def _parse_date(rec: dict[str, Any]) -> datetime | None:
    raw = rec.get("date") or rec.get("date_start")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except ValueError:
        return None


class TrackService:
    def __init__(self, openf1: OpenF1Client, cache: RedisCache) -> None:
        self._openf1 = openf1
        self._cache = cache
        self._task: asyncio.Task[None] | None = None
        self._transforms: dict[str, _Transform] = {}
        self._drivers_cache: dict[str, dict[int, dict[str, Any]]] = {}
        self._endpoint_cache: dict[str, list[dict[str, Any]]] = {}
        self._geometry_sent_for: str | None = None
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

    async def _init_replay_clock(self) -> None:
        sessions = await self._fetch_endpoint("sessions", settings.replay_session_key)
        if not sessions:
            logger.warning("Replay session %s not found", settings.replay_session_key)
            return
        session = sessions[0]
        start = _parse_date(session)
        end_raw = session.get("date_end")
        self._replay_start = start
        self._replay_clock = start
        self._replay_end = _parse_date({"date": end_raw}) if end_raw else None

    async def _emit_geometry(self) -> None:
        try:
            session_key = (
                settings.replay_session_key if settings.replay_mode else "latest"
            )
            geometry = await self.build_geometry(session_key)
            payload = {"type": "track.geometry", "data": geometry.model_dump()}
            await self._cache.write_snapshot("track_geometry", payload)
            await self._cache.publish("track_geometry", payload)
            self._geometry_sent_for = str(geometry.session_key)
            logger.info(
                "Track geometry emitted: session=%s points=%d viewBox=%.0fx%.0f",
                geometry.session_key,
                len(geometry.points),
                geometry.width,
                geometry.height,
            )
        except Exception:
            logger.exception("Failed to build track geometry")

    async def _run(self) -> None:
        # Let session/timing finish their startup burst before geometry + positions.
        await asyncio.sleep(4)
        if settings.replay_mode:
            await self._init_replay_clock()
        await self._emit_geometry()
        interval = settings.track_poll_interval_ms / 1000
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Track positions poll failed")
            await asyncio.sleep(interval)

    async def _poll_once(self) -> None:
        if settings.replay_mode:
            positions = await self.build_positions(
                settings.replay_session_key, as_of=self._replay_clock
            )
            await self._advance_replay_clock()
        else:
            positions = await self.build_positions("latest")

        payload = {"type": "track.positions", "data": positions.model_dump()}
        await self._cache.write_snapshot("track_positions", payload)
        await self._cache.publish("track_positions", payload)
        logger.debug(
            "Track positions updated: session=%s cars=%d live=%s",
            positions.session_key,
            len(positions.cars),
            positions.is_live,
        )

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
            self._geometry_sent_for = None
            await self._emit_geometry()

    async def _fetch_endpoint(
        self, endpoint: str, session_key: int | str
    ) -> list[dict[str, Any]]:
        cache_key = f"{session_key}:{endpoint}"
        if cache_key in self._endpoint_cache:
            return self._endpoint_cache[cache_key]
        rows = await self._openf1.fetch_list(endpoint, session_key=session_key)
        if str(session_key).isdigit():
            self._endpoint_cache[cache_key] = rows
        return rows

    async def _drivers(self, session_key: int | str) -> dict[int, dict[str, Any]]:
        key = str(session_key)
        if key not in self._drivers_cache:
            rows = await self._fetch_endpoint("drivers", session_key)
            self._drivers_cache[key] = {r["driver_number"]: r for r in rows}
        return self._drivers_cache[key]

    def _location_window(
        self, as_of: datetime | None
    ) -> tuple[datetime, datetime]:
        if as_of is not None:
            return as_of - LOCATION_LOOKBACK, as_of + timedelta(seconds=1)
        end = datetime.now(UTC)
        return end - LOCATION_LOOKBACK, end

    def _latest_location_per_driver(
        self, locs: list[dict[str, Any]], as_of: datetime | None
    ) -> dict[int, dict[str, Any]]:
        latest: dict[int, dict[str, Any]] = {}
        latest_dt: dict[int, datetime] = {}
        for point in locs:
            dn = point.get("driver_number")
            if dn is None or point.get("x") is None or point.get("y") is None:
                continue
            dt = _parse_date(point)
            if dt is None:
                continue
            if as_of is not None and dt > as_of:
                continue
            if dn not in latest_dt or dt >= latest_dt[dn]:
                latest_dt[dn] = dt
                latest[dn] = point
        return latest

    async def build_geometry(
        self, session_key: int | str = "latest", as_of: datetime | None = None
    ) -> TrackGeometry:
        # Outline is static for the session — pick the fastest clean lap from the
        # full session, not filtered by replay clock (replay starts at date_start
        # before any laps exist). as_of is accepted but ignored here.
        _ = as_of
        laps = await self._fetch_endpoint("laps", session_key)
        candidates = [
            lap
            for lap in laps
            if lap.get("lap_duration")
            and not lap.get("is_pit_out_lap")
            and lap.get("date_start")
        ]
        if not candidates:
            raise ValueError("No clean reference lap available to build geometry")

        ref = min(candidates, key=lambda lap: lap["lap_duration"])
        start = _parse_date(ref)
        if start is None:
            raise ValueError("Reference lap missing date_start")
        end = start + timedelta(seconds=ref["lap_duration"] + 1)

        locs = await self._openf1.fetch_location_window(
            session_key, ref["driver_number"], start, end
        )
        locs = [p for p in locs if p.get("x") is not None and p.get("y") is not None]
        locs.sort(key=lambda p: p["date"])
        if len(locs) < 10:
            raise ValueError("Not enough location samples to build geometry")

        xs = [p["x"] for p in locs]
        ys = [p["y"] for p in locs]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        span_x = max(max_x - min_x, 1.0)
        span_y = max(max_y - min_y, 1.0)
        scale = (VIEWBOX_WIDTH - 2 * PADDING) / max(span_x, span_y)
        width = span_x * scale + 2 * PADDING
        height = span_y * scale + 2 * PADDING

        transform = _Transform(min_x=min_x, max_y=max_y, scale=scale, width=width, height=height)
        self._transforms[str(session_key)] = transform

        sk = int(locs[0].get("session_key", 0))
        points = [list(transform.apply(p["x"], p["y"])) for p in locs]
        return TrackGeometry(session_key=sk, width=width, height=height, points=points)

    async def build_positions(
        self, session_key: int | str = "latest", as_of: datetime | None = None
    ) -> TrackPositions:
        transform = self._transforms.get(str(session_key))
        if transform is None:
            await self.build_geometry(session_key)
            transform = self._transforms[str(session_key)]

        drivers = await self._drivers(session_key)
        start, end = self._location_window(as_of)
        locs = await self._openf1.fetch_location_window(session_key, None, start, end)
        latest = self._latest_location_per_driver(locs, as_of)

        cars: list[CarPosition] = []
        sk = 0
        for dn, point in latest.items():
            nx, ny = transform.apply(point["x"], point["y"])
            meta = drivers.get(dn, {})
            sk = int(point.get("session_key", sk))
            cars.append(
                CarPosition(
                    driver_number=dn,
                    name_acronym=meta.get("name_acronym", ""),
                    team_colour=meta.get("team_colour", ""),
                    x=round(nx, 1),
                    y=round(ny, 1),
                )
            )

        is_live = str(session_key) == "latest" and as_of is None
        return TrackPositions(session_key=sk, is_live=is_live, cars=cars)

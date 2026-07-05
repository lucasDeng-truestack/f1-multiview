"""TimingService — assembles a leaderboard snapshot from OpenF1 time-series endpoints."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any, Iterable

from pitwall.cache.redis import RedisCache
from pitwall.clients.openf1 import OpenF1Client
from pitwall.config import settings
from pitwall.models.timing import SEGMENT_CODES, SegmentColor, TimingRow, TimingSnapshot
from pitwall.services.replay_clock import ReplayClock
from pitwall.services.replay_controller import ReplayController

logger = logging.getLogger(__name__)


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


def _latest_per_driver(
    records: Iterable[dict[str, Any]], as_of: datetime | None
) -> dict[int, dict[str, Any]]:
    latest: dict[int, dict[str, Any]] = {}
    latest_dt: dict[int, datetime] = {}
    for rec in records:
        dn = rec.get("driver_number")
        if dn is None:
            continue
        dt = _parse_date(rec)
        if as_of is not None and dt is not None and dt > as_of:
            continue
        if dt is None:
            latest.setdefault(dn, rec)
            continue
        if dn not in latest_dt or dt >= latest_dt[dn]:
            latest_dt[dn] = dt
            latest[dn] = rec
    return latest


def _dominant_segment(segments: list[int]) -> SegmentColor:
    colors = [SEGMENT_CODES.get(code, "unknown") for code in segments]
    for priority in ("purple", "green", "yellow", "pitlane"):
        if priority in colors:
            return priority
    return "none"


class TimingService:
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
        self._drivers_cache: dict[str, dict[int, dict[str, Any]]] = {}
        self._endpoint_cache: dict[str, list[dict[str, Any]]] = {}

    def _replay_session_key(self) -> int:
        return (
            self._controller.session_key
            if self._controller is not None
            else settings.replay_session_key
        )

    def _sync_session(self) -> None:
        """Drop cached endpoints when the active session changed under us."""
        if self._controller is None:
            return
        if self._controller.version != self._synced_version:
            self._endpoint_cache.clear()
            self._drivers_cache.clear()
            self._synced_version = self._controller.version

    async def start(self) -> None:
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _poll_loop(self) -> None:
        interval = settings.timing_poll_interval_ms / 1000
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Timing poll failed")
            await asyncio.sleep(interval)

    async def _poll_once(self) -> None:
        if settings.replay_mode:
            self._sync_session()
            as_of = self._clock.now() if self._clock else None
            if as_of is None:
                return  # shared clock not configured yet
            snapshot = await self.build_snapshot(
                self._replay_session_key(), as_of=as_of
            )
        else:
            # Live path: session_key=latest. OAuth bearer (free tier) is required
            # inside the live window (30 min before → 30 min after session). Outside
            # that window, historical data needs no auth. ~5 requests per 4s poll
            # is well within the free 3 req/s limit.
            if not settings.live_auth_configured:
                logger.debug(
                    "No OpenF1 OAuth credentials — historical data only; "
                    "set OPENF1_USERNAME/PASSWORD for the live session window"
                )
            snapshot = await self.build_snapshot("latest")

        payload = {"type": "timing.update", "data": snapshot.model_dump()}
        await self._cache.write_snapshot("timing", payload)
        await self._cache.publish("timing", payload)
        logger.debug(
            "Timing updated: session=%s rows=%d live=%s",
            snapshot.session_key,
            len(snapshot.rows),
            snapshot.is_live,
        )

    async def _drivers(self, session_key: int | str) -> dict[int, dict[str, Any]]:
        key = str(session_key)
        if key not in self._drivers_cache:
            rows = await self._fetch_endpoint("drivers", session_key)
            self._drivers_cache[key] = {r["driver_number"]: r for r in rows}
        return self._drivers_cache[key]

    async def _fetch_endpoint(
        self, endpoint: str, session_key: int | str
    ) -> list[dict[str, Any]]:
        cache_key = f"{session_key}:{endpoint}"
        if cache_key in self._endpoint_cache:
            return self._endpoint_cache[cache_key]
        rows = await self._openf1.fetch_list(endpoint, session_key=session_key)
        # Historical sessions are immutable — cache to avoid rate limits during replay.
        if str(session_key).isdigit():
            self._endpoint_cache[cache_key] = rows
        return rows

    async def build_snapshot(
        self, session_key: int | str = "latest", as_of: datetime | None = None
    ) -> TimingSnapshot:
        drivers = await self._drivers(session_key)
        positions = _latest_per_driver(
            await self._fetch_endpoint("position", session_key), as_of
        )
        intervals = _latest_per_driver(
            await self._fetch_endpoint("intervals", session_key), as_of
        )
        all_laps = await self._fetch_endpoint("laps", session_key)
        all_stints = await self._fetch_endpoint("stints", session_key)

        laps_by_driver: dict[int, list[dict[str, Any]]] = {}
        for lap in all_laps:
            if as_of is not None:
                dt = _parse_date(lap)
                if dt is not None and dt > as_of:
                    continue
            laps_by_driver.setdefault(lap["driver_number"], []).append(lap)

        stints_by_driver: dict[int, list[dict[str, Any]]] = {}
        for stint in all_stints:
            if as_of is not None:
                dt = _parse_date(stint)
                if dt is not None and dt > as_of:
                    continue
            stints_by_driver.setdefault(stint["driver_number"], []).append(stint)

        rows: list[TimingRow] = []
        for dn, meta in drivers.items():
            row = TimingRow(
                driver_number=dn,
                name_acronym=meta.get("name_acronym", ""),
                full_name=meta.get("full_name", ""),
                team_name=meta.get("team_name", ""),
                team_colour=meta.get("team_colour", ""),
            )

            if dn in positions:
                row.position = positions[dn].get("position")

            if dn in intervals:
                row.gap_to_leader = intervals[dn].get("gap_to_leader")
                row.interval = intervals[dn].get("interval")

            self._apply_laps(row, laps_by_driver.get(dn, []))
            self._apply_stint(row, stints_by_driver.get(dn, []))
            rows.append(row)

        rows.sort(key=lambda r: (r.position is None, r.position or 9999))

        is_live = str(session_key) == "latest" and as_of is None
        sk = await self._resolve_session_key(session_key, positions, intervals)
        return TimingSnapshot(session_key=sk, is_live=is_live, rows=rows)

    async def _resolve_session_key(
        self,
        session_key: int | str,
        positions: dict[int, dict[str, Any]],
        intervals: dict[int, dict[str, Any]],
    ) -> int:
        if str(session_key).isdigit():
            return int(session_key)
        for src in (positions, intervals):
            for rec in src.values():
                if "session_key" in rec:
                    return int(rec["session_key"])
        sessions = await self._fetch_endpoint("sessions", session_key)
        if sessions:
            return int(sessions[0]["session_key"])
        return 0

    @staticmethod
    def _apply_laps(row: TimingRow, laps: list[dict[str, Any]]) -> None:
        completed = [lap for lap in laps if lap.get("lap_duration") is not None]
        if not completed:
            return
        last = max(completed, key=lambda lap: lap.get("lap_number", 0))
        best = min(completed, key=lambda lap: lap["lap_duration"])
        row.last_lap = last.get("lap_duration")
        row.best_lap = best.get("lap_duration")
        row.last_lap_number = last.get("lap_number")
        row.in_pit = bool(last.get("is_pit_out_lap"))

        for sector_key in ("segments_sector_1", "segments_sector_2", "segments_sector_3"):
            segs = last.get(sector_key) or []
            row.sector_colors.append(_dominant_segment(segs))

        for sec in ("duration_sector_1", "duration_sector_2", "duration_sector_3"):
            last_sec = last.get(sec)
            best_sec = min(
                (lap[sec] for lap in completed if lap.get(sec) is not None),
                default=None,
            )
            row.sector_is_best.append(
                last_sec is not None and best_sec is not None and last_sec <= best_sec
            )

    @staticmethod
    def _apply_stint(row: TimingRow, stints: list[dict[str, Any]]) -> None:
        if not stints:
            return
        current = max(stints, key=lambda s: s.get("stint_number", 0))
        row.compound = current.get("compound")
        age_at_start = current.get("tyre_age_at_start") or 0
        laps_run = (current.get("lap_end", 0) or 0) - (current.get("lap_start", 1) or 1)
        row.tyre_age = age_at_start + max(laps_run, 0)

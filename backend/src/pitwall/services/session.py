import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from pitwall.cache.redis import RedisCache
from pitwall.clients.openf1 import OpenF1Client
from pitwall.config import settings
from pitwall.models.messages import Session, SessionUpdateMessage

logger = logging.getLogger(__name__)

# OpenF1 live window: 30 min before session start → 30 min after session end.
LIVE_BUFFER = timedelta(minutes=30)


def _parse_iso(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _is_session_live(date_start: str | None, date_end: str | None) -> bool:
    start = _parse_iso(date_start)
    end = _parse_iso(date_end)
    if start is None or end is None:
        return False
    now = datetime.now(UTC)
    return (start - LIVE_BUFFER) <= now <= (end + LIVE_BUFFER)


def _to_session(raw: dict[str, Any] | None) -> Session:
    if raw is None:
        return Session(is_live=False)
    return Session(
        session_key=raw.get("session_key"),
        session_name=raw.get("session_name"),
        session_type=raw.get("session_type"),
        circuit_short_name=raw.get("circuit_short_name"),
        country_name=raw.get("country_name"),
        year=raw.get("year"),
        is_live=_is_session_live(raw.get("date_start"), raw.get("date_end")),
        date_start=raw.get("date_start"),
        date_end=raw.get("date_end"),
    )


class SessionService:
    def __init__(self, openf1: OpenF1Client, cache: RedisCache) -> None:
        self._openf1 = openf1
        self._cache = cache
        self._task: asyncio.Task[None] | None = None

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
        interval = settings.poll_interval_ms / 1000
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Session poll failed")
            await asyncio.sleep(interval)

    async def _poll_once(self) -> None:
        if settings.replay_mode:
            raw = await self._openf1.get_session(settings.replay_session_key)
            session = _to_session(raw)
            session.is_live = False
        else:
            raw = await self._openf1.get_latest_session()
            session = _to_session(raw)
        message = SessionUpdateMessage(data=session)
        payload = message.model_dump(by_alias=False)
        # Serialize with camelCase keys for the frontend contract
        client_payload = {
            "type": "session.update",
            "data": {
                "sessionKey": session.session_key,
                "sessionName": session.session_name,
                "sessionType": session.session_type,
                "circuitShortName": session.circuit_short_name,
                "countryName": session.country_name,
                "year": session.year,
                "isLive": session.is_live,
                "dateStart": session.date_start,
                "dateEnd": session.date_end,
            },
        }
        await self._cache.write_snapshot("session", client_payload)
        await self._cache.publish("session", client_payload)
        logger.debug(
            "Session updated: %s @ %s (live=%s)",
            session.session_name,
            session.circuit_short_name,
            session.is_live,
        )

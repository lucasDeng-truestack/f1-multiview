"""SessionCatalog — lists OpenF1 sessions grouped by Grand Prix, for the picker.

Historical schedules are immutable, so each year is fetched once and cached. The
client browses year → meeting (GP) → session and then sends a `load_session`
command with the chosen session_key.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel

from pitwall.clients.openf1 import OpenF1Client

logger = logging.getLogger(__name__)


class CatalogSession(BaseModel):
    session_key: int
    name: str | None  # "Practice 1", "Qualifying", "Race", …
    type: str | None  # "Practice", "Qualifying", "Race", …
    date_start: str | None


class CatalogMeeting(BaseModel):
    meeting_key: int | None
    name: str  # country / location, e.g. "Monaco"
    circuit: str  # e.g. "Monte Carlo"
    sessions: list[CatalogSession]


class SessionCatalog(BaseModel):
    year: int
    meetings: list[CatalogMeeting]


class SessionCatalogService:
    def __init__(self, openf1: OpenF1Client) -> None:
        self._openf1 = openf1
        self._cache: dict[int, SessionCatalog] = {}

    async def by_year(self, year: int) -> SessionCatalog:
        cached = self._cache.get(year)
        if cached is not None:
            return cached

        rows = await self._openf1.fetch_list("sessions", year=year)
        grouped: dict[Any, CatalogMeeting] = {}
        for r in rows:
            sk = r.get("session_key")
            if sk is None:
                continue
            mk = r.get("meeting_key")
            meeting = grouped.get(mk)
            if meeting is None:
                meeting = CatalogMeeting(
                    meeting_key=mk,
                    name=r.get("country_name") or r.get("location") or "—",
                    circuit=r.get("circuit_short_name") or "",
                    sessions=[],
                )
                grouped[mk] = meeting
            meeting.sessions.append(
                CatalogSession(
                    session_key=sk,
                    name=r.get("session_name"),
                    type=r.get("session_type"),
                    date_start=r.get("date_start"),
                )
            )

        def first_date(m: CatalogMeeting) -> str:
            return min((s.date_start or "" for s in m.sessions), default="")

        meetings = sorted(grouped.values(), key=first_date)
        for m in meetings:
            m.sessions.sort(key=lambda s: s.date_start or "")

        catalog = SessionCatalog(year=year, meetings=meetings)
        # Only cache non-empty years (an in-progress/empty year may fill in later).
        if meetings:
            self._cache[year] = catalog
        logger.info("Session catalog for %d: %d meetings", year, len(meetings))
        return catalog

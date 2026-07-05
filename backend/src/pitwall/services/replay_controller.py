"""ReplayController — the single, switchable source of the active replay session.

Instead of every service reading `settings.replay_session_key` directly, they
read `controller.session_key`. A `load_session` WebSocket command calls
`switch()`, which points the controller at a new session and reconfigures the
shared ReplayClock — so you can change which Grand Prix you're watching at
runtime without editing `.env` or restarting.

Services notice a switch by comparing `controller.version`; when it changes they
drop their per-session caches and rebuild for the new session.
"""

from __future__ import annotations

import asyncio
import logging

from pitwall.clients.openf1 import OpenF1Client
from pitwall.services.replay_clock import ReplayClock, parse_iso

logger = logging.getLogger(__name__)


class ReplayController:
    def __init__(
        self, openf1: OpenF1Client, clock: ReplayClock, session_key: int
    ) -> None:
        self._openf1 = openf1
        self._clock = clock
        self._session_key = session_key
        self._version = 0
        self._lock = asyncio.Lock()

    @property
    def session_key(self) -> int:
        return self._session_key

    @property
    def version(self) -> int:
        return self._version

    async def configure_initial(self) -> None:
        """Point the clock at the boot session (from config) before services start."""
        await self._apply_clock(self._session_key)

    async def switch(self, session_key: int) -> bool:
        async with self._lock:
            if session_key == self._session_key:
                return False
            self._session_key = session_key
            self._version += 1
            await self._apply_clock(session_key)
            logger.info(
                "Replay switched to session %s (version %d)",
                session_key,
                self._version,
            )
            return True

    async def _apply_clock(self, session_key: int) -> None:
        sessions = await self._openf1.fetch_list("sessions", session_key=session_key)
        if not sessions:
            logger.warning("Session %s not found — clock unchanged", session_key)
            return
        s = sessions[0]
        self._clock.configure(
            parse_iso(s.get("date_start")), parse_iso(s.get("date_end"))
        )

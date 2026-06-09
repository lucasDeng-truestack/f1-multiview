"""Pydantic models for the live timing snapshot.

Source of truth for the `timing.update` WebSocket payload. When you change anything here,
update packages/shared-types/src/timing.ts in the SAME commit.
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel

# gap_to_leader / interval: seconds (float), "+1 LAP" (lapped), or null (leader).
GapValue = Union[float, str, None]

SegmentColor = Literal["none", "yellow", "green", "purple", "pitlane", "unknown"]

SEGMENT_CODES: dict[int, SegmentColor] = {
    0: "none",
    2048: "yellow",
    2049: "green",
    2051: "purple",
    2064: "pitlane",
}


class TimingRow(BaseModel):
    driver_number: int
    position: int | None = None

    name_acronym: str = ""
    full_name: str = ""
    team_name: str = ""
    team_colour: str = ""

    gap_to_leader: GapValue = None
    interval: GapValue = None

    last_lap: float | None = None
    best_lap: float | None = None
    last_lap_number: int | None = None
    sector_colors: list[SegmentColor] = []
    sector_is_best: list[bool] = []

    compound: str | None = None
    tyre_age: int | None = None

    in_pit: bool = False


class TimingSnapshot(BaseModel):
    session_key: int
    is_live: bool
    rows: list[TimingRow]

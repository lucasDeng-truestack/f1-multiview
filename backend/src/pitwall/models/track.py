"""Pydantic models for the track map: circuit geometry + live car positions.

Source of truth for `track.geometry` and `track.positions` WebSocket payloads.
Mirror changes in packages/shared-types/src/track.ts in the same commit.
"""

from __future__ import annotations

from pydantic import BaseModel


class TrackGeometry(BaseModel):
    session_key: int
    width: float
    height: float
    points: list[list[float]]


class CarPosition(BaseModel):
    driver_number: int
    name_acronym: str = ""
    team_colour: str = ""
    x: float
    y: float


class TrackPositions(BaseModel):
    session_key: int
    is_live: bool
    cars: list[CarPosition]

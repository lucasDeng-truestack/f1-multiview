// Mirrors backend/src/pitwall/models/track.py. Keep both in sync in the same commit.

export interface TrackGeometry {
  session_key: number;
  width: number;
  height: number;
  points: [number, number][];
}

export interface CarPosition {
  driver_number: number;
  name_acronym: string;
  team_colour: string;
  x: number;
  y: number;
}

export interface TrackPositions {
  session_key: number;
  is_live: boolean;
  cars: CarPosition[];
}

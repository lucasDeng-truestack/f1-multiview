// Mirrors backend/src/pitwall/models/timing.py. Keep both in sync in the same commit.

export type GapValue = number | string | null;

export type SegmentColor =
  | "none"
  | "yellow"
  | "green"
  | "purple"
  | "pitlane"
  | "unknown";

export interface TimingRow {
  driver_number: number;
  position: number | null;

  name_acronym: string;
  full_name: string;
  team_name: string;
  team_colour: string;

  gap_to_leader: GapValue;
  interval: GapValue;

  last_lap: number | null;
  best_lap: number | null;
  last_lap_number: number | null;
  sector_colors: SegmentColor[];
  sector_is_best: boolean[];

  compound: string | null;
  tyre_age: number | null;

  in_pit: boolean;
}

export interface TimingSnapshot {
  session_key: number;
  is_live: boolean;
  rows: TimingRow[];
}

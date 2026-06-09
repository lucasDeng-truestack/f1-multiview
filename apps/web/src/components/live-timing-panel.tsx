"use client";

import { useEffect, useRef } from "react";
import type { GapValue, SegmentColor, TimingRow } from "@pitwall/shared-types";

import { selectDriver } from "@/lib/ws-client";
import { useTelemetryStore } from "@/lib/stores/telemetry-store";
import { useTimingStore } from "@/lib/stores/timing-store";

import "./timing-panel.css";
import "./telemetry-panel.css";

const TYRE_COLORS: Record<string, string> = {
  SOFT: "#E8443B",
  MEDIUM: "#F2C94C",
  HARD: "#F2F4F8",
  INTERMEDIATE: "#34C759",
  WET: "#3B8BD4",
};

const SECTOR_COLORS: Record<SegmentColor, string> = {
  purple: "var(--purple)",
  green: "var(--green)",
  yellow: "var(--yellow)",
  pitlane: "var(--text-low)",
  none: "var(--border)",
  unknown: "var(--border)",
};

function fmtLap(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${s}` : s;
}

function fmtGap(gap: GapValue): string {
  if (gap == null) return "—";
  if (typeof gap === "string") return gap;
  return gap === 0 ? "—" : `+${gap.toFixed(3)}`;
}

export function LiveTimingPanel() {
  const snapshot = useTimingStore((s) => s.snapshot);
  const selectedDriver = useTelemetryStore((s) => s.driverNumber);
  const setDriver = useTelemetryStore((s) => s.setDriver);

  const handleSelectDriver = (driverNumber: number) => {
    setDriver(driverNumber);
    selectDriver(driverNumber);
  };

  if (!snapshot || snapshot.rows.length === 0) {
    return (
      <div className="pw-panel pw-empty">
        <span className="pw-panel-title">Live timing</span>
        <p className="pw-empty-text">
          No live session. Load a replay to explore timing.
        </p>
      </div>
    );
  }

  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Live timing</span>
        <span className="pw-panel-meta">
          {snapshot.is_live ? "LIVE" : "REPLAY"} · {snapshot.rows.length} cars
        </span>
      </div>

      <div className="pw-table" role="table" aria-label="Live timing leaderboard">
        <div className="pw-row pw-row-head" role="row">
          <span>Pos</span>
          <span>Driver</span>
          <span className="pw-num">Gap</span>
          <span className="pw-num">Int</span>
          <span className="pw-num">Last</span>
          <span className="pw-num">Best</span>
          <span>Sectors</span>
          <span>Tyre</span>
        </div>
        {snapshot.rows.map((row, i) => (
          <TimingRowView
            key={row.driver_number}
            row={row}
            leader={i === 0}
            selected={row.driver_number === selectedDriver}
            onSelect={() => handleSelectDriver(row.driver_number)}
          />
        ))}
      </div>
    </div>
  );
}

function TimingRowView({
  row,
  leader,
  selected,
  onSelect,
}: {
  row: TimingRow;
  leader: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const prevBest = useRef<boolean[]>(row.sector_is_best);
  const flashing = row.sector_is_best.map(
    (best, i) => best && !prevBest.current[i],
  );
  useEffect(() => {
    prevBest.current = row.sector_is_best;
  }, [row.sector_is_best]);

  const teamColor = row.team_colour ? `#${row.team_colour}` : "var(--text-low)";

  return (
    <div
      className={`pw-row pw-row-selectable${selected ? " pw-row-selected" : ""}`}
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={
        leader ? { boxShadow: "inset 2px 0 0 var(--purple)" } : undefined
      }
    >
      <span className="pw-pos">{row.position ?? "—"}</span>
      <span className="pw-driver">
        <span
          className="pw-team-bar"
          style={{ background: teamColor }}
          aria-hidden
        />
        {row.name_acronym || row.driver_number}
      </span>
      <span className="pw-num">{fmtGap(row.gap_to_leader)}</span>
      <span className="pw-num">{fmtGap(row.interval)}</span>
      <span className="pw-num">{fmtLap(row.last_lap)}</span>
      <span className="pw-num pw-best">{fmtLap(row.best_lap)}</span>
      <span className="pw-sectors">
        {row.sector_colors.map((color, i) => (
          <span
            key={i}
            className={`pw-sector${flashing[i] ? " pw-flash" : ""}`}
            style={{ background: SECTOR_COLORS[color] }}
            aria-label={`Sector ${i + 1}: ${color}`}
          />
        ))}
      </span>
      <span className="pw-tyre">
        {row.compound ? (
          <>
            <span
              className="pw-tyre-dot"
              style={{
                background: TYRE_COLORS[row.compound] ?? "var(--text-low)",
              }}
              aria-hidden
            />
            <span className="pw-tyre-age">{row.tyre_age ?? "—"}</span>
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}

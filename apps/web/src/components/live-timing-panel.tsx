"use client";

import { type CSSProperties, memo, useEffect, useRef } from "react";
import type { GapValue, SegmentColor, TimingRow } from "@pitwall/shared-types";

import { selectDriver } from "@/lib/ws-client";
import { useStale } from "@/lib/use-stale";
import { useValueChanged } from "@/lib/use-value-changed";
import { useTelemetryStore } from "@/lib/stores/telemetry-store";
import { useTimingStore } from "@/lib/stores/timing-store";

import "./panel.css";
import "./timing-panel.css";

const STALE_MS = 8000;

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
  const receivedAt = useTimingStore((s) => s.receivedAt);
  const selectedDriver = useTelemetryStore((s) => s.driverNumber);
  const setDriver = useTelemetryStore((s) => s.setDriver);
  const stale = useStale(receivedAt, STALE_MS);

  const handleSelectDriver = (driverNumber: number) => {
    setDriver(driverNumber);
    selectDriver(driverNumber);
  };

  // session==null is handled by the app-level home screen; inside the grid a
  // null snapshot means the feed hasn't landed yet → loading, not empty.
  if (!snapshot) {
    return <TimingSkeleton />;
  }

  if (snapshot.rows.length === 0) {
    return (
      <div className="pw-panel pw-empty">
        <span className="pw-panel-title">Live timing</span>
        <p className="pw-empty-text">
          Session up, no cars on track yet. Timing fills as drivers go out.
        </p>
      </div>
    );
  }

  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Live timing</span>
        <span className="pw-panel-meta">
          <span>
            {snapshot.is_live ? "Live" : "Replay"} · {snapshot.rows.length} cars
          </span>
          {stale && <span className="pw-stale">· stale</span>}
        </span>
      </div>

      <div className="pw-table" role="table" aria-label="Live timing leaderboard">
        <div className="pw-row pw-row-head" role="row">
          <span className="pw-num">Pos</span>
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

/** One cell that ticks (brief text-hi flash) when its value changes. */
function TickCell({ gap }: { gap: GapValue }) {
  const changed = useValueChanged(gap);
  return (
    <span
      key={String(gap)}
      className={`pw-num${changed ? " pw-tick" : ""}`}
    >
      {fmtGap(gap)}
    </span>
  );
}

function TimingRowViewInner({
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
  // Sector personal-best flash (purple). Toggles off→on so the animation replays.
  const sectorWasBest = useRef<boolean[]>(row.sector_is_best);
  const sectorFlash = row.sector_is_best.map(
    (best, i) => best && !sectorWasBest.current[i],
  );
  useEffect(() => {
    sectorWasBest.current = row.sector_is_best;
  }, [row.sector_is_best]);

  // Best-lap improvement flashes the Best figure green (keyed remount replays).
  const prevBest = useRef(row.best_lap);
  const bestImproved =
    row.best_lap != null &&
    prevBest.current != null &&
    row.best_lap < prevBest.current;
  useEffect(() => {
    prevBest.current = row.best_lap;
  }, [row.best_lap]);

  // Position change — green up, red down. Rare and meaningful.
  const prevPos = useRef(row.position);
  let posDir: "up" | "down" | null = null;
  if (
    row.position != null &&
    prevPos.current != null &&
    row.position !== prevPos.current
  ) {
    posDir = row.position < prevPos.current ? "up" : "down";
  }
  useEffect(() => {
    prevPos.current = row.position;
  }, [row.position]);

  const teamColor = row.team_colour ? `#${row.team_colour}` : "var(--text-low)";

  return (
    <div
      className={`pw-row pw-row-selectable${selected ? " pw-row-selected" : ""}${
        row.in_pit ? " pw-row-pit" : ""
      }`}
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      // Leader holds a thin team-colour edge at low opacity — a marker, not a
      // stripe. Purple stays reserved for personal bests.
      style={
        leader
          ? {
              boxShadow: `inset 2px 0 0 color-mix(in srgb, ${teamColor} 70%, transparent)`,
            }
          : undefined
      }
    >
      <span
        key={`${row.position}`}
        className={`pw-pos${
          posDir === "up" ? " pw-pos-up" : posDir === "down" ? " pw-pos-down" : ""
        }`}
      >
        {row.position ?? "—"}
      </span>
      <span className="pw-driver">
        <span
          className="pw-team-bar"
          style={{ background: teamColor }}
          aria-hidden
        />
        {row.name_acronym || row.driver_number}
      </span>
      <TickCell gap={row.gap_to_leader} />
      <TickCell gap={row.interval} />
      <span className="pw-num">{fmtLap(row.last_lap)}</span>
      <span
        key={`best-${row.best_lap}`}
        className={`pw-num pw-best${bestImproved ? " pw-best-flash" : ""}`}
      >
        {fmtLap(row.best_lap)}
      </span>
      <span className="pw-sectors">
        {row.sector_colors.map((color, i) => (
          <span
            key={i}
            className={`pw-sector${sectorFlash[i] ? " pw-flash" : ""}`}
            style={{ background: SECTOR_COLORS[color] }}
            aria-label={`Sector ${i + 1}: ${color}`}
          />
        ))}
      </span>
      <span className="pw-tyre">
        {row.compound ? (
          <span
            className="pw-tyre-pill"
            style={
              {
                "--tyre-colour": TYRE_COLORS[row.compound] ?? "var(--text-low)",
              } as CSSProperties
            }
            aria-label={`${row.compound.toLowerCase()} tyre, ${row.tyre_age ?? "unknown"} laps`}
          >
            <span className="pw-tyre-compound">{row.compound[0]}</span>
            <span className="pw-tyre-age">{row.tyre_age ?? "—"}</span>
          </span>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}

/* Rows re-render on every snapshot because each WS message parses fresh row
   objects. Compare the fields the row actually renders so 20Hz updates only
   touch rows whose data changed. onSelect is identity-unstable but only
   captures the stable driver_number — safe to ignore. */
const TimingRowView = memo(TimingRowViewInner, (prev, next) => {
  const a = prev.row;
  const b = next.row;
  return (
    prev.leader === next.leader &&
    prev.selected === next.selected &&
    a.driver_number === b.driver_number &&
    a.position === b.position &&
    a.name_acronym === b.name_acronym &&
    a.team_colour === b.team_colour &&
    a.gap_to_leader === b.gap_to_leader &&
    a.interval === b.interval &&
    a.last_lap === b.last_lap &&
    a.best_lap === b.best_lap &&
    a.compound === b.compound &&
    a.tyre_age === b.tyre_age &&
    a.in_pit === b.in_pit &&
    a.sector_colors.join() === b.sector_colors.join() &&
    a.sector_is_best.join() === b.sector_is_best.join()
  );
});

function TimingSkeleton() {
  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Live timing</span>
        <span className="pw-panel-meta">connecting…</span>
      </div>
      <div className="pw-table" aria-hidden>
        {Array.from({ length: 10 }).map((_, i) => (
          <div className="pw-skel-row" key={i}>
            <span className="pw-skel pw-skel-cell" style={{ width: "60%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "70%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "80%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "80%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "85%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "85%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "90%" }} />
            <span className="pw-skel pw-skel-cell" style={{ width: "50%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

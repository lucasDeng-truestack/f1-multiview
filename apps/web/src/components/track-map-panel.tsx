"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import type { CarPosition, TrackGeometry } from "@pitwall/shared-types";

import { useStale } from "@/lib/use-stale";
import { useTrackStore } from "@/lib/stores/track-store";

import "./panel.css";
import "./track-map.css";

const STALE_MS = 8000;

// Glide each car from its previous position to the new one over roughly the
// time until the next update, so the dot moves continuously instead of
// snapping and freezing between polls. We don't know the next interval yet, so
// we predict it from the last one. Clamped to keep a stalled feed from
// freezing mid-track or a burst from teleporting.
function useMoveDurationMs(cars: CarPosition[]): number {
  const lastAt = useRef(0);
  const [durationMs, setDurationMs] = useState(0);
  useEffect(() => {
    const now = performance.now();
    if (lastAt.current !== 0) {
      const delta = now - lastAt.current;
      setDurationMs(Math.min(Math.max(delta, 200), 6000));
    }
    lastAt.current = now;
  }, [cars]);
  return durationMs;
}

export function TrackMapPanel() {
  const geometry = useTrackStore((s) => s.geometry);
  const cars = useTrackStore((s) => s.cars);
  const receivedAt = useTrackStore((s) => s.receivedAt);
  const stale = useStale(receivedAt, STALE_MS);

  // session==null → app home. A null geometry inside the grid means the outline
  // is still being built from /location → loading skeleton, not empty.
  if (!geometry) {
    return <TrackSkeleton />;
  }

  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Track map</span>
        <span className="pw-panel-meta">
          <span>{cars.length} cars</span>
          {stale && <span className="pw-stale">· stale</span>}
        </span>
      </div>
      <div className="pw-track-wrap">
        <TrackSvg geometry={geometry} cars={cars} />
      </div>
    </div>
  );
}

function TrackSkeleton() {
  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Track map</span>
        <span className="pw-panel-meta">building track…</span>
      </div>
      <div className="pw-track-wrap">
        <svg
          viewBox="0 0 1000 600"
          width="100%"
          className="pw-track-svg pw-track-skel"
          aria-hidden
        >
          {/* Generic loop placeholder in hairline ink — shaped like a circuit,
              not a grey box. Replaced by the real outline once geometry lands. */}
          <path
            d="M 180 420 C 120 320 160 180 320 160 C 520 135 560 300 700 300 C 840 300 880 180 820 420 C 780 540 540 520 480 440 C 420 360 300 560 180 420 Z"
            fill="none"
            stroke="var(--border-hi)"
            strokeWidth={6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function TrackSvg({
  geometry,
  cars,
}: {
  geometry: TrackGeometry;
  cars: CarPosition[];
}) {
  const path =
    "M " + geometry.points.map(([x, y]) => `${x},${y}`).join(" L ") + " Z";
  const moveDurationMs = useMoveDurationMs(cars);

  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      width="100%"
      role="img"
      aria-label="Track map with live car positions"
      className="pw-track-svg"
      style={{ "--car-move-ms": `${moveDurationMs}ms` } as CSSProperties}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--border-hi)"
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--bg-raised)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {cars.map((car) => (
        <CarDot key={car.driver_number} car={car} />
      ))}
    </svg>
  );
}

function CarDot({ car }: { car: CarPosition }) {
  const color = car.team_colour ? `#${car.team_colour}` : "var(--text-mid)";
  return (
    <g
      className="pw-car"
      style={{ transform: `translate(${car.x}px, ${car.y}px)` }}
    >
      <circle r={9} fill={color} stroke="var(--bg-base)" strokeWidth={1.5} />
      <text x={0} y={3} textAnchor="middle" className="pw-car-label">
        {car.name_acronym || car.driver_number}
      </text>
    </g>
  );
}

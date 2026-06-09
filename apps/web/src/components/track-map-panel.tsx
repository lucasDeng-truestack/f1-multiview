"use client";

import type { CarPosition, TrackGeometry } from "@pitwall/shared-types";

import { useTrackStore } from "@/lib/stores/track-store";

import "./track-map.css";

export function TrackMapPanel() {
  const geometry = useTrackStore((s) => s.geometry);
  const cars = useTrackStore((s) => s.cars);

  if (!geometry) {
    return (
      <div className="pw-panel pw-empty">
        <span className="pw-panel-title">Track map</span>
        <p className="pw-empty-text">
          No live session. Load a replay to see the track.
        </p>
      </div>
    );
  }

  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Track map</span>
        <span className="pw-panel-meta">{cars.length} cars</span>
      </div>
      <div className="pw-track-wrap">
        <TrackSvg geometry={geometry} cars={cars} />
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

  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      width="100%"
      role="img"
      aria-label="Track map with live car positions"
      className="pw-track-svg"
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

"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CarPosition, TrackGeometry } from "@pitwall/shared-types";

import { selectDriver } from "@/lib/ws-client";
import { useStale } from "@/lib/use-stale";
import { useTelemetryStore } from "@/lib/stores/telemetry-store";
import { useTimingStore } from "@/lib/stores/timing-store";
import { useTrackStore } from "@/lib/stores/track-store";

import "./panel.css";
import "./track-map.css";

const STALE_MS = 8000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const FOCUS_ZOOM = 2.5;

interface DriverInfo {
  position: number | null;
  full_name: string;
  team_name: string;
}

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

  const timing = useTimingStore((s) => s.snapshot);
  const selectedDriver = useTelemetryStore((s) => s.driverNumber);
  const setDriver = useTelemetryStore((s) => s.setDriver);

  const [hoveredDriver, setHoveredDriver] = useState<number | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [follow, setFollow] = useState(false);

  // session==null → app home. A null geometry inside the grid means the outline
  // is still being built from /location → loading skeleton, not empty.
  if (!geometry) {
    return <TrackSkeleton />;
  }

  const info: Record<number, DriverInfo> = {};
  for (const row of timing?.rows ?? []) {
    info[row.driver_number] = {
      position: row.position,
      full_name: row.full_name,
      team_name: row.team_name,
    };
  }

  const onSelect = (driver: number) => {
    setDriver(driver);
    selectDriver(driver);
  };

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const zoomOut = () =>
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, z - ZOOM_STEP);
      if (next <= MIN_ZOOM) setFollow(false);
      return next;
    });
  const toggleFocus = () => {
    if (follow) {
      setFollow(false);
      setZoom(MIN_ZOOM);
    } else {
      setFollow(true);
      setZoom((z) => Math.max(z, FOCUS_ZOOM));
    }
  };

  // The driver the header should name: whatever's under the cursor/keyboard,
  // else the selected one.
  const activeDriver = hoveredDriver ?? selectedDriver;
  const activeCar =
    activeDriver != null
      ? cars.find((c) => c.driver_number === activeDriver)
      : undefined;

  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Track map</span>
        <div className="pw-track-head-right">
        <span className="pw-panel-meta">
          {activeCar ? (
            <DriverTag car={activeCar} info={info[activeCar.driver_number]} />
          ) : (
            <span>
              {cars.length > 0
                ? `${cars.length} cars`
                : "waiting for positions…"}
            </span>
          )}
          {stale && <span className="pw-stale">· stale</span>}
        </span>
        <div
          className="pw-track-ctrls"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="pw-track-ctrl"
            aria-label="Zoom out"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
          >
            −
          </button>
          <span className="pw-track-zoom">{zoom.toFixed(1)}×</span>
          <button
            type="button"
            className="pw-track-ctrl"
            aria-label="Zoom in"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
          >
            +
          </button>
          <button
            type="button"
            className={`pw-track-ctrl pw-track-focus${follow ? " is-on" : ""}`}
            onClick={toggleFocus}
            disabled={selectedDriver == null}
            aria-pressed={follow}
            title={
              selectedDriver == null
                ? "Select a driver to follow"
                : "Zoom in and follow the selected driver"
            }
          >
            {follow ? "Following" : "Focus"}
          </button>
        </div>
        </div>
      </div>
      <div className="pw-track-wrap">
        <TrackSvg
          geometry={geometry}
          cars={cars}
          info={info}
          selectedDriver={selectedDriver}
          hoveredDriver={hoveredDriver}
          zoom={zoom}
          follow={follow}
          onHover={setHoveredDriver}
          onSelect={onSelect}
          onStopFollow={() => setFollow(false)}
        />
      </div>
    </div>
  );
}

function DriverTag({
  car,
  info,
}: {
  car: CarPosition;
  info: DriverInfo | undefined;
}) {
  const color = car.team_colour ? `#${car.team_colour}` : "var(--text-mid)";
  return (
    <span className="pw-driver-tag">
      <span
        className="pw-driver-tag-bar"
        style={{ background: color }}
        aria-hidden
      />
      {info?.position != null && (
        <span className="pw-driver-tag-pos">P{info.position}</span>
      )}
      <span className="pw-driver-tag-acr">
        {car.name_acronym || car.driver_number}
      </span>
      <span className="pw-driver-tag-num">#{car.driver_number}</span>
      {info?.team_name && (
        <span className="pw-driver-tag-team">{info.team_name}</span>
      )}
    </span>
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
            stroke="var(--border)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function TrackSvg({
  geometry,
  cars,
  info,
  selectedDriver,
  hoveredDriver,
  zoom,
  follow,
  onHover,
  onSelect,
  onStopFollow,
}: {
  geometry: TrackGeometry;
  cars: CarPosition[];
  info: Record<number, DriverInfo>;
  selectedDriver: number | null;
  hoveredDriver: number | null;
  zoom: number;
  follow: boolean;
  onHover: (driver: number | null) => void;
  onSelect: (driver: number) => void;
  onStopFollow: () => void;
}) {
  const path =
    "M " + geometry.points.map(([x, y]) => `${x},${y}`).join(" L ") + " Z";
  const moveDurationMs = useMoveDurationMs(cars);

  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    id: number;
  } | null>(null);
  const moved = useRef(false);

  // Full view → no pan offset makes sense; reset it when zoomed back out.
  useEffect(() => {
    if (zoom <= MIN_ZOOM) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const pannable = zoom > MIN_ZOOM;
  const clampX = (zoom * geometry.width) / 2;
  const clampY = (zoom * geometry.height) / 2;

  // Record the press, but don't capture the pointer or touch follow yet — a tap
  // without movement must stay a click-to-select on the dot underneath.
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    moved.current = false;
    if (!pannable || e.button !== 0) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      id: e.pointerId,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !svgRef.current) return;
    const dxs = e.clientX - d.x;
    const dys = e.clientY - d.y;

    if (!moved.current) {
      if (Math.abs(dxs) <= 3 && Math.abs(dys) <= 3) return; // still a click
      // A real drag begins now: capture the pointer, suppress the click, and if
      // we were following a car seed the pan from its position so the view
      // doesn't jump as control hands over to the drag.
      moved.current = true;
      setDragging(true);
      try {
        svgRef.current.setPointerCapture(d.id);
      } catch {
        // capture is best-effort
      }
      if (follow && selectedDriver != null) {
        const car = cars.find((c) => c.driver_number === selectedDriver);
        if (car) {
          d.panX = zoom * (geometry.width / 2 - car.x);
          d.panY = zoom * (geometry.height / 2 - car.y);
        }
        onStopFollow();
      }
    }

    const rect = svgRef.current.getBoundingClientRect();
    const ratio = geometry.width / rect.width; // viewBox units per screen px
    setPan({
      x: clamp(d.panX + dxs * ratio, -clampX, clampX),
      y: clamp(d.panY + dys * ratio, -clampY, clampY),
    });
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    try {
      svgRef.current?.releasePointerCapture(d.id);
    } catch {
      // already released
    }
  };

  // A drag shouldn't also select the car under the release point.
  const handleSelect = (driver: number) => {
    if (moved.current) return;
    onSelect(driver);
  };

  // Centre on the followed car (only once zoomed in), otherwise the track
  // centre, plus any manual pan. point' = zoom*point + (tx, ty).
  const focusCar =
    follow && pannable && selectedDriver != null
      ? cars.find((c) => c.driver_number === selectedDriver)
      : undefined;
  const cx = focusCar ? focusCar.x : geometry.width / 2;
  const cy = focusCar ? focusCar.y : geometry.height / 2;
  const tx = geometry.width / 2 - zoom * cx + pan.x;
  const ty = geometry.height / 2 - zoom * cy + pan.y;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      width="100%"
      role="img"
      aria-label="Track map with live car positions"
      className={`pw-track-svg${pannable ? " pw-track-pannable" : ""}${
        dragging ? " pw-track-dragging" : ""
      }`}
      style={{ "--car-move-ms": `${moveDurationMs}ms` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <g
        className="pw-track-view"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transition: dragging ? "none" : undefined,
        }}
      >
        {/* Crisp circuit line — non-scaling stroke stays hairline at any zoom. */}
        <path
          d={path}
          fill="none"
          stroke="var(--border-hi)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />
        {cars.map((car) => {
          const dn = car.driver_number;
          return (
            <CarDot
              key={dn}
              car={car}
              info={info[dn]}
              selected={dn === selectedDriver}
              hovered={dn === hoveredDriver}
              dimmed={hoveredDriver != null && dn !== hoveredDriver}
              onHover={onHover}
              onSelect={handleSelect}
            />
          );
        })}
      </g>
    </svg>
  );
}

function CarDot({
  car,
  info,
  selected,
  hovered,
  dimmed,
  onHover,
  onSelect,
}: {
  car: CarPosition;
  info: DriverInfo | undefined;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onHover: (driver: number | null) => void;
  onSelect: (driver: number) => void;
}) {
  const dn = car.driver_number;
  const color = car.team_colour ? `#${car.team_colour}` : "var(--text-mid)";
  const label = car.name_acronym || String(dn);
  const ariaLabel =
    info?.position != null
      ? `${label}, position ${info.position}`
      : `Driver ${label}`;

  return (
    <g
      className={`pw-car${selected ? " pw-car-selected" : ""}${
        hovered ? " pw-car-hovered" : ""
      }${dimmed ? " pw-car-dim" : ""}`}
      style={{ transform: `translate(${car.x}px, ${car.y}px)` }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      onMouseEnter={() => onHover(dn)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(dn)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(dn)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(dn);
        }
      }}
    >
      {/* Invisible, larger hit target so the small dot is easy to grab. */}
      <circle className="pw-car-hit" r={14} fill="transparent" />
      {/* Highlight ring — only painted when hovered/focused/selected. */}
      <circle className="pw-car-ring" r={13} fill="none" stroke={color} />
      <circle
        className="pw-car-dot"
        r={9}
        fill={color}
        stroke="var(--bg-base)"
        strokeWidth={1.5}
      />
      <text x={0} y={3} textAnchor="middle" className="pw-car-label">
        {label}
      </text>
    </g>
  );
}

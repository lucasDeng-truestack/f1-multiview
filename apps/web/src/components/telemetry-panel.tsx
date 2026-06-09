"use client";

import { useEffect, useRef } from "react";
import type { TelemetrySample } from "@pitwall/shared-types";

import { useTelemetryStore } from "@/lib/stores/telemetry-store";

import "./telemetry-panel.css";

const TRACE_SECONDS = 30;

function tsMs(s: TelemetrySample): number {
  const t = Date.parse(s.ts);
  return Number.isNaN(t) ? 0 : t;
}

export function TelemetryPanel() {
  const driver = useTelemetryStore((s) => s.driverNumber);
  const buffer = useTelemetryStore((s) => s.buffer);
  const isLive = useTelemetryStore((s) => s.isLive);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const latest = buffer.length ? buffer[buffer.length - 1] : null;

  useEffect(() => {
    drawTrace(canvasRef.current, buffer);
  }, [buffer]);

  if (driver == null) {
    return (
      <div className="pw-panel pw-tel-empty">
        <span className="pw-panel-title">Telemetry</span>
        <p className="pw-empty-text">
          No driver selected. Pick a driver from the timing panel.
        </p>
      </div>
    );
  }

  return (
    <div className="pw-panel pw-tel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Telemetry · #{driver}</span>
        <span className="pw-panel-meta">{isLive ? "LIVE" : "REPLAY"}</span>
      </div>

      <div className="pw-tel-readouts">
        <div className="pw-tel-speed">
          <span className="pw-tel-value">{latest?.speed ?? "—"}</span>
          <span className="pw-tel-unit">km/h</span>
        </div>
        <div className="pw-tel-side">
          <Readout label="Gear" value={latest?.gear ?? "—"} />
          <Readout
            label="RPM"
            value={latest?.rpm != null ? latest.rpm.toLocaleString() : "—"}
          />
          <DrsPill state={latest?.drs ?? "off"} />
        </div>
      </div>

      <Pedal label="Throttle" pct={latest?.throttle ?? 0} color="var(--green)" />
      <Pedal label="Brake" pct={latest?.brake ? 100 : 0} color="var(--red)" />

      <div className="pw-tel-trace-wrap">
        <canvas ref={canvasRef} className="pw-tel-trace" width={640} height={120} />
        <span className="pw-tel-trace-label">
          last {TRACE_SECONDS}s · speed / throttle / brake
        </span>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pw-readout">
      <span className="pw-readout-label">{label}</span>
      <span className="pw-readout-value">{value}</span>
    </div>
  );
}

function DrsPill({ state }: { state: "off" | "eligible" | "on" }) {
  const color =
    state === "on"
      ? "var(--green)"
      : state === "eligible"
        ? "var(--yellow)"
        : "var(--text-low)";
  return (
    <div className="pw-readout">
      <span className="pw-readout-label">DRS</span>
      <span className="pw-drs" style={{ color }}>
        {state === "on" ? "OPEN" : state === "eligible" ? "ELIG" : "—"}
      </span>
    </div>
  );
}

function Pedal({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="pw-pedal">
      <span className="pw-pedal-label">{label}</span>
      <div className="pw-pedal-track">
        <div
          className="pw-pedal-fill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="pw-pedal-pct">{Math.round(clamped)}</span>
    </div>
  );
}

function drawTrace(canvas: HTMLCanvasElement | null, buffer: TelemetrySample[]) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (buffer.length < 2) return;

  const now = tsMs(buffer[buffer.length - 1]);
  const span = TRACE_SECONDS * 1000;
  const x = (s: TelemetrySample) => ((tsMs(s) - (now - span)) / span) * w;

  const line = (
    accessor: (s: TelemetrySample) => number,
    max: number,
    stroke: string,
    width = 1.5,
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    buffer.forEach((s, i) => {
      const px = x(s);
      const py = h - (accessor(s) / max) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  };

  const css = getComputedStyle(canvas);
  const cyan = css.getPropertyValue("--cyan").trim() || "#36d7e0";
  const green = css.getPropertyValue("--green").trim() || "#2bd96b";
  const red = css.getPropertyValue("--red").trim() || "#ff4d4d";

  line((s) => s.speed ?? 0, 360, cyan);
  line((s) => s.throttle ?? 0, 100, green, 1);
  line((s) => (s.brake ? 100 : 0), 100, red, 1);
}

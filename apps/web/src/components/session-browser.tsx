"use client";

import { useEffect, useRef, useState } from "react";

import { loadSession } from "@/lib/ws-client";

interface CatalogSession {
  session_key: number;
  name: string | null;
  type: string | null;
  date_start: string | null;
}
interface CatalogMeeting {
  meeting_key: number | null;
  name: string;
  circuit: string;
  sessions: CatalogSession[];
}
interface SessionCatalog {
  year: number;
  meetings: CatalogMeeting[];
}

const FIRST_YEAR = 2023;

// The REST base is the WS URL minus the ws scheme + /ws path.
function apiBase(): string {
  const ws = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
  return ws.replace(/^ws/, "http").replace(/\/ws$/, "");
}

export function SessionBrowser({ label = "Sessions" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [catalog, setCatalog] = useState<SessionCatalog | null>(null);
  const [meetingKey, setMeetingKey] = useState<number | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const ref = useRef<HTMLDivElement>(null);

  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) years.push(y);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Fetch the year's schedule when opened or the year changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setCatalog(null);
    setMeetingKey("");
    fetch(`${apiBase()}/api/sessions?year=${year}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<SessionCatalog>;
      })
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, year]);

  const meeting = catalog?.meetings.find((m) => m.meeting_key === meetingKey);

  const pick = (sessionKey: number) => {
    loadSession(sessionKey);
    setOpen(false);
  };

  return (
    <div className="pw-menu" ref={ref}>
      <button
        type="button"
        className="pw-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="pw-browser" role="dialog" aria-label="Load a session">
          <label className="pw-browser-field">
            <span>Year</span>
            <select
              autoFocus
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="pw-browser-field">
            <span>Grand Prix</span>
            <select
              value={meetingKey}
              aria-busy={status === "loading"}
              disabled={status !== "idle" || !catalog?.meetings.length}
              onChange={(e) =>
                setMeetingKey(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">
                {status === "loading"
                  ? "Loading…"
                  : status === "error"
                    ? "Failed to load"
                    : catalog && !catalog.meetings.length
                      ? "No sessions"
                      : "Select…"}
              </option>
              {catalog?.meetings.map((m) => (
                <option key={m.meeting_key} value={m.meeting_key ?? ""}>
                  {m.name} · {m.circuit}
                </option>
              ))}
            </select>
          </label>

          <label className="pw-browser-field">
            <span>Session</span>
            <select
              value=""
              disabled={!meeting}
              onChange={(e) => {
                const k = Number(e.target.value);
                if (k) pick(k);
              }}
            >
              <option value="" disabled>
                {meeting ? "Select…" : "Pick a Grand Prix first"}
              </option>
              {meeting?.sessions.map((s) => (
                <option key={s.session_key} value={s.session_key}>
                  {s.name ?? `#${s.session_key}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

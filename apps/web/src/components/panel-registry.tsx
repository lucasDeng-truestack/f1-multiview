"use client";

import type { ReactNode } from "react";

import { LiveTimingPanel } from "@/components/live-timing-panel";
import { TelemetryPanel } from "@/components/telemetry-panel";
import { TrackMapPanel } from "@/components/track-map-panel";
import { VideoPanel } from "@/components/video-panel";

export interface PanelDef {
  id: string;
  title: string;
  render: () => ReactNode;
  defaults: { w: number; h: number; minW: number; minH: number };
}

export const PANELS: Record<string, PanelDef> = {
  timing: {
    id: "timing",
    title: "Live timing",
    render: () => <LiveTimingPanel />,
    defaults: { w: 6, h: 9, minW: 4, minH: 5 },
  },
  track: {
    id: "track",
    title: "Track map",
    render: () => <TrackMapPanel />,
    defaults: { w: 6, h: 9, minW: 3, minH: 5 },
  },
  telemetry: {
    id: "telemetry",
    title: "Telemetry",
    render: () => <TelemetryPanel />,
    defaults: { w: 12, h: 6, minW: 4, minH: 4 },
  },
  video: {
    id: "video",
    title: "Video",
    render: () => <VideoPanel />,
    defaults: { w: 6, h: 6, minW: 3, minH: 4 },
  },
};

export const PANEL_IDS = Object.keys(PANELS);

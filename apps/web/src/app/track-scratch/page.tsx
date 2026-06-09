"use client";

import { useEffect } from "react";

import { TrackMapPanel } from "@/components/track-map-panel";
import { startWsClient, stopWsClient } from "@/lib/ws-client";

/** Dev scratch route — raw track geometry + positions from WebSocket. */
export default function TrackScratchPage() {
  useEffect(() => {
    startWsClient();
    return () => stopWsClient();
  }, []);

  return (
    <main className="min-h-screen bg-base p-2">
      <TrackMapPanel />
    </main>
  );
}

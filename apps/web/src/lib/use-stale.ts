"use client";

import { useEffect, useState } from "react";

/**
 * True when the last update is older than `thresholdMs`. Re-evaluates on a
 * coarse timer so a frozen feed surfaces a "stale" indicator without any
 * change to the WebSocket schema — receipt time is tracked client-side.
 */
export function useStale(
  receivedAt: number | null,
  thresholdMs: number,
): boolean {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (receivedAt == null) return false;
  return now - receivedAt > thresholdMs;
}

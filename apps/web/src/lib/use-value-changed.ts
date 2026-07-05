"use client";

import { useEffect, useRef } from "react";

/**
 * True on the render where `value` differs from the previous render's value.
 * Pair with a keyed element + a flash class so the change replays its
 * animation: the brand's "live data breathes" tick for gaps and intervals.
 * First render returns false — arriving data is not a change.
 */
export function useValueChanged<T>(value: T): boolean {
  const prev = useRef<{ set: boolean; value: T }>({ set: false, value });
  const changed = prev.current.set && !Object.is(prev.current.value, value);
  useEffect(() => {
    prev.current = { set: true, value };
  });
  return changed;
}

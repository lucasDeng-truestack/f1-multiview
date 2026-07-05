"use client";

import { useEffect, useState } from "react";

/** True below `px` wide. SSR-safe: false until mounted. */
export function useNarrow(px = 768): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [px]);
  return narrow;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";

import { PANELS } from "@/components/panel-registry";

const STORAGE_KEY = "pitwall.workspace.v1";

export interface Workspace {
  active: string[];
  layout: LayoutItem[];
}

const DEFAULT_WORKSPACE: Workspace = {
  active: ["timing", "track", "telemetry"],
  layout: [
    { i: "timing", x: 0, y: 0, w: 6, h: 9, minW: 4, minH: 5 },
    { i: "track", x: 6, y: 0, w: 6, h: 9, minW: 3, minH: 5 },
    { i: "telemetry", x: 0, y: 9, w: 12, h: 6, minW: 4, minH: 4 },
  ],
};

export function useGridLayout() {
  const [workspace, setWorkspace] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Workspace;
        if (Array.isArray(parsed.active) && Array.isArray(parsed.layout)) {
          setWorkspace(parsed);
        }
      }
    } catch {
      // Corrupt or unavailable storage — fall back to defaults.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Workspace) => {
    setWorkspace(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked — keep in-memory layout only.
    }
  }, []);

  const onLayoutChange = useCallback(
    (layout: Layout) => {
      persist({ active: workspace.active, layout: [...layout] });
    },
    [persist, workspace.active],
  );

  const addPanel = useCallback(
    (id: string) => {
      if (workspace.active.includes(id)) return;
      const def = PANELS[id];
      if (!def) return;
      const maxY = workspace.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      const item: LayoutItem = {
        i: id,
        x: 0,
        y: maxY,
        w: def.defaults.w,
        h: def.defaults.h,
        minW: def.defaults.minW,
        minH: def.defaults.minH,
      };
      persist({
        active: [...workspace.active, id],
        layout: [...workspace.layout, item],
      });
    },
    [persist, workspace],
  );

  const removePanel = useCallback(
    (id: string) => {
      persist({
        active: workspace.active.filter((a) => a !== id),
        layout: workspace.layout.filter((l) => l.i !== id),
      });
    },
    [persist, workspace],
  );

  const reset = useCallback(() => persist(DEFAULT_WORKSPACE), [persist]);

  return { workspace, hydrated, onLayoutChange, addPanel, removePanel, reset };
}

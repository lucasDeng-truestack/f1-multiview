"use client";

import { useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { NoSessionHome } from "@/components/no-session-home";
import { PanelFrame } from "@/components/panel-frame";
import { PANELS, PANEL_IDS } from "@/components/panel-registry";
import { SessionBrowser } from "@/components/session-browser";
import { SessionStatus } from "@/components/session-status";
import { useGridLayout } from "@/lib/use-grid-layout";
import { useNarrow } from "@/lib/use-narrow";
import { useSessionStore } from "@/lib/stores/session-store";

import "./panel.css";
import "./grid.css";

const Grid = WidthProvider(GridLayout);

export function PitWallGrid() {
  const {
    workspace,
    hydrated,
    onLayoutChange,
    addPanel,
    removePanel,
    reset,
    applyPreset,
  } = useGridLayout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const session = useSessionStore((s) => s.session);
  const narrow = useNarrow();

  const inactive = PANEL_IDS.filter((id) => !workspace.active.includes(id));

  // No session at all → the designed idle home, not a wall of empty panels.
  if (hydrated && session == null) {
    return <NoSessionHome />;
  }

  return (
    <div className="pw-grid-root">
      <div className="pw-bar">
        <SessionStatus />
        <div className="pw-bar-controls">
          <SessionBrowser />
          {/* Layout editing is a desktop affordance; the narrow view stacks. */}
          {!narrow && (
            <>
              <div className="pw-menu">
                <button
                  type="button"
                  className="pw-btn"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                  disabled={inactive.length === 0}
                >
                  Add panel
                </button>
                {menuOpen && inactive.length > 0 && (
                  <ul className="pw-menu-list" role="menu">
                    {inactive.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          role="menuitem"
                          className="pw-menu-item"
                          onClick={() => {
                            addPanel(id);
                            setMenuOpen(false);
                          }}
                        >
                          {PANELS[id].title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="pw-menu">
                <button
                  type="button"
                  className="pw-btn"
                  aria-haspopup="menu"
                  aria-expanded={layoutMenuOpen}
                  onClick={() => setLayoutMenuOpen((o) => !o)}
                >
                  Layout
                </button>
                {layoutMenuOpen && (
                  <ul className="pw-menu-list" role="menu">
                    {["engineer", "viewer", "telemetry focus"].map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          role="menuitem"
                          className="pw-menu-item"
                          onClick={() => {
                            applyPreset(name);
                            setLayoutMenuOpen(false);
                          }}
                        >
                          {name[0].toUpperCase() + name.slice(1)}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        className="pw-menu-item"
                        onClick={() => {
                          reset();
                          setLayoutMenuOpen(false);
                        }}
                      >
                        Reset default
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {hydrated && narrow && (
        <div className="pw-stack">
          {workspace.active.map((id) => {
            const def = PANELS[id];
            if (!def) return null;
            return (
              <div key={id} className="pw-stack-item">
                {def.render()}
              </div>
            );
          })}
        </div>
      )}

      {hydrated && !narrow && (
        <Grid
          className="pw-layout"
          layout={workspace.layout}
          cols={12}
          rowHeight={36}
          margin={[8, 8]}
          draggableHandle=".pw-panel-head"
          onLayoutChange={onLayoutChange}
          compactType="vertical"
        >
          {workspace.active.map((id) => {
            const def = PANELS[id];
            if (!def) return null;
            return (
              <div key={id} className="pw-grid-item">
                <PanelFrame onRemove={() => removePanel(id)}>
                  {def.render()}
                </PanelFrame>
              </div>
            );
          })}
        </Grid>
      )}
    </div>
  );
}

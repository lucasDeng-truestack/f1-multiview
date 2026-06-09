# PitWall — Phase 4 prompt (Multiview grid)

Paste into Cursor after Phase 3. Read `.cursorrules`, `ARCHITECTURE.md`, `brand.md` first.

---

We're building **Phase 4: the multiview grid** — the three existing panels (timing, track,
telemetry) plus a video placeholder, arranged in a draggable/resizable grid that persists.

This is frontend only. No new OpenF1 work. Wrap the existing panels; don't rewrite them.

## Decisions to respect

- Use `react-grid-layout`. Install it and import its CSS (`react-grid-layout/css/styles.css` and
  `react-resizable/css/styles.css`) once.
- **Drag by the header, not the panel.** Set `draggableHandle=".pw-panel-head"` so the existing
  panel title bars are the drag handles and panel bodies stay clickable (driver selection etc.).
  This means the Phase 1–3 panels need NO edits.
- **localStorage is SSR-unsafe in Next.js.** Never read it during render. Start from the default
  layout, load the saved one in a `useEffect` after mount (see `useGridLayout`). Persist on every
  layout/active-panel change under a versioned key.
- **Video panel is a placeholder.** No scraping, no DRM. It's a seam for a future F1 TV embed and
  shows "No stream connected" for now.
- One WebSocket connection at the app shell; panels read from their stores (see ARCHITECTURE.md).
  The grid does not open sockets.

## Pieces

- `panel-registry.tsx` — id → { title, render(), defaults }. Single source of what panels exist.
- `use-grid-layout.ts` — `{ active: string[], layout: Layout[] }` state + SSR-safe localStorage
  persistence. Versioned key so a layout-shape change doesn't load stale geometry.
- `panel-frame.tsx` — thin wrapper adding a floating remove (×) button over each panel; stops the
  mousedown from starting a drag. No second header.
- `video-panel.tsx` — the placeholder.
- `pitwall-grid.tsx` — the grid: renders active panels, add-panel menu, remove, persistence.
- `grid.css` — fills each grid cell with `.pw-panel`, styles the rgl placeholder + resize handles
  to the dark theme.

## Build order

1. Registry + `useGridLayout` (verify persistence: rearrange, reload, layout sticks).
2. `PitWallGrid` with the three real panels, drag + resize working, header-drag only.
3. Add-panel menu + remove button + the video placeholder.

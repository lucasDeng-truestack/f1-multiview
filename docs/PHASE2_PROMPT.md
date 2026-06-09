# PitWall — Phase 2 prompt (Track map)

Paste into Cursor after Phase 1. Read `.cursorrules`, `ARCHITECTURE.md`, `brand.md` first.

---

We're building **Phase 2: the track map** — an SVG circuit outline with live car dots moving on it.

## The one rule that makes or breaks this

The track outline and the car dots MUST come from the **same coordinate frame**, or the dots
won't sit on the line. So derive BOTH from OpenF1 `/location` (x, y):

- **Outline:** trace ONE car's `/location` points over a single clean flying lap → an ordered
  list of (x, y) → an SVG path. Do NOT use FastF1 geometry for this; its coordinate system
  differs from `/location` and the dots won't align.
- **Dots:** latest `/location` per driver, transformed with the SAME normalization the outline used.

Reference implementations wired into:

- `backend/src/pitwall/models/track.py`
- `backend/src/pitwall/services/track.py`
- `packages/shared-types/src/track.ts`
- `apps/web/src/components/track-map-panel.tsx`
- `apps/web/src/components/track-map.css`

Test geometry: `uv run python scripts/test_build_geometry.py`
Scratch route: http://localhost:3000/track-scratch

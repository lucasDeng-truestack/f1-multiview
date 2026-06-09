# PitWall — Brand & Design Identity

This is the design source of truth. Read it before building any UI.
Every color and type decision in the app derives from here.

## The thesis

PitWall is not a sports app. It's an **instrument cluster**. The reference is the actual FIA pit wall
— a row of engineers behind a bank of dark screens, dense with live numbers, reading the race through
data. The feeling we want: calm, precise, high-density, slightly clinical. Information you trust at a
glance under pressure. Nothing decorative competes with the data.

Audience: F1 fans who want to watch a race the way an engineer does. They want signal, not chrome.

The single job of the screen: **let me read the race at a glance, with everything live at once.**

## Aesthetic direction

Dark instrument panel. Deep near-black surfaces so telemetry colors glow. Hairline borders, not cards
with heavy shadows. Data is monospace and tabular so digits don't jitter as they update. Labels are a
clean grotesque, set small and quiet. The interface recedes; the numbers advance.

The signature element: **live data that breathes** — sector times flash purple/green on a new best,
gaps tick in tabular figures, the leading car's row holds a thin accent edge. Motion is functional,
never ornamental.

## Color tokens

Surfaces (dark, layered — darker = lower):
- `--bg-base:    #0A0C0F`   /* page */
- `--bg-panel:   #12151A`   /* panel surface */
- `--bg-raised:  #1A1E25`   /* rows, controls */
- `--border:     #262B33`   /* hairline */
- `--border-hi:  #38404B`   /* hover / focus */

Text:
- `--text-hi:    #E8EBF0`   /* primary readouts */
- `--text-mid:   #9AA3B0`   /* labels */
- `--text-low:   #5B6472`   /* hints, units */

Telemetry / status (the only saturated colors — reserve them for meaning):
- `--purple:     #B14CFF`   /* personal best / fastest sector */
- `--green:      #2BD96B`   /* personal best lap, DRS open, gain */
- `--yellow:     #FFD23F`   /* yellow flag, caution, off-pace */
- `--red:        #FF4D4D`   /* red flag, loss, brake */
- `--cyan:       #36D7E0`   /* throttle / speed trace */
- `--white-best: #F2F4F8`   /* overall session best */

Tyre compounds (use the real F1 mapping):
- soft `#E8443B` · medium `#F2C94C` · hard `#F2F4F8` · intermediate `#34C759` · wet `#3B8BD4`

Rule: surfaces and text are neutral. A color appearing anywhere means *something happened*. Never use
the telemetry palette for decoration.

## Typography

- **Data face (display + all numbers):** a monospaced grotesque — `JetBrains Mono` or `IBM Plex Mono`.
  Use `font-variant-numeric: tabular-nums` everywhere a number can change so columns don't shift.
- **Label face (UI text, headings):** a neutral grotesque — `Inter` or `IBM Plex Sans`.
- Type scale (px): 11 unit/hint · 13 label · 15 body · 20 panel title · 28 hero readout.
- Weights: 400 labels, 500 data, 600 reserved for the single most important number on a panel.
- Letter-spacing: +0.02em on small uppercase labels only. Never uppercase body text.

## Layout

- Everything sits in a resizable panel grid (react-grid-layout). Panels share one visual language:
  hairline border, `--bg-panel`, a small quiet title row, dense content below.
- 8px base spacing unit. Internal panel padding 12px. Gap between panels 8px.
- Tables are king: tabular numerals, right-aligned numbers, zebra via `--bg-raised` at low opacity.
- Radius: 6px on panels and controls. Keep it tight — this is instrumentation, not a consumer toy.

## Motion

- Value changes: 120ms ease, color flash that fades over ~600ms (best sector → purple → fade to neutral).
- No page transitions, no parallax, no spring bounce. The race moves; the chrome doesn't.
- Respect `prefers-reduced-motion`: drop the flashes, keep the value updates instant.

## Voice (UI copy)

- Terse, factual, engineer's register. "No live session" not "Oops, nothing here yet!"
- Label by what the user reads: "Gap", "Interval", "Last", "Best", "Tyre". No marketing words.
- Empty states give direction: "No live session. Load a replay to explore telemetry."

## What to avoid

- Cream/serif/terracotta editorial looks. Bright single-accent-on-black startup looks. Newspaper columns.
- Card shadows, gradients, glassmorphism, glow. Flat dark surfaces with hairlines only.
- Team logos / driver photos as decoration (and mind their licensing). Let the data be the hero.

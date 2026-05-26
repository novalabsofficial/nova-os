# Nova OS — future ideas

Casual backlog of features floated post-v8.0. Not prioritized, not scheduled,
not committed to. Living document — add to it freely.

---

## 1. Liquid Glass + dark/light mode (iOS style)

The iOS 17/18 "Liquid Glass" aesthetic — frosted translucent surfaces with
realistic light-refraction edges, "pane of glass" tactile feel. Plus a
system-wide light mode toggle that flips the entire palette (Nova OS is
currently dark-only).

**Considerations**
- Every component currently assumes dark backgrounds. Implementing light
  mode would need either a CSS-variable theme system or a theme prop
  threaded through all the shared styles.
- Wallpapers like Drift / Zen would shine in light mode.
- Liquid Glass effect can be approximated with `backdrop-filter`,
  `mask-image`, and SVG `feDisplacementMap` filters for the refraction
  on edges.

---

## 2. Wi-Fi + system sound settings

OS-level controls — actual Wi-Fi network selection, audio output device
selection, system master volume — surfaced inside Nova OS the way they
appear in the Windows / macOS quick settings panel.

**Considerations**
- Tauri desktop build: possible via Rust-side helpers (the `sysinfo` crate
  for networks, `cpal` or platform-specific APIs for audio devices).
- Web build: no access at the OS level. Could partially fake it (show the
  browser's audio output picker which is sandboxed).
- Cross-platform consistency is rough — Windows / macOS / Linux all expose
  network/audio differently.

---

## 3. Profile picture editor

Currently the profile avatar is the first letter of the username on a
colored circle. Add a real avatar editor: upload an image, crop it to a
circle, save as the user's avatar.

**Considerations**
- Storage: Firestore docs cap at ~1 MB. Need to downsample heavily before
  saving — same pattern as the custom-wallpaper handler in SettingsApp.
- UI: reuse the canvas-based crop approach. A `<canvas>` with a draggable
  circular crop region, scale slider, save → base64 data URL → write to
  `data.avatar` field.
- Render: ProfileApp + the user-chip avatar + start menu user card + chat
  message avatars would all need to switch from the letter-circle to the
  saved image when present.

---

## 4. Redo Store app icons (especially Roblox)

The Store currently uses Clearbit's logo API for external apps
(`StoreIcon` component in `src/ui/icons.jsx`). For brands like Roblox,
Xbox Cloud, Steam, etc., Clearbit returns generic / dated logos that
don't match the in-store look-and-feel.

**Considerations**
- Hand-draw stylized SVG icons for the top ~10 store apps (Roblox first)
  in the same iOS-aesthetic family as the built-in app icons.
- Keep Clearbit as the fallback for the long tail of apps where a custom
  icon isn't worth the effort.
- Need a small registry mapping store-app id → custom SVG id, checked
  before falling back to Clearbit.

---

## 5. Actually-functioning System Info widget

The SysInfo widget currently shows pseudo-CPU/RAM percentages that drift
based on `performance.now()`. Replace with real OS metrics.

**Considerations**
- Tauri desktop build: the Rust `sysinfo` crate exposes real CPU %, RAM
  usage, GPU info (via vendor-specific libs), disk usage, etc. Add a
  Tauri command that returns a snapshot every N seconds; JS reads it on
  an interval.
- Web build: very limited. `navigator.deviceMemory` (rounded to powers
  of 2), `performance.memory` (Chrome-only, JS heap not real RAM), no
  CPU access at all. Probably best to hide the live numbers on web and
  show a "Desktop app only" badge, or keep the fake numbers as a fallback.
- GPU: Tauri can shell out to `nvidia-smi` / `rocm-smi` / read sysfs on
  Linux. Cross-platform GPU reading is annoying but doable.

---

## 6. Rework Paint into a real MS-Paint competitor

Requested by a beta tester. The current PaintApp is a minimal sketch tool
(pen, eraser, size slider, color picker, undo, clear, save). Goal: turn
it into something that can genuinely replace MS Paint — and ideally do
some things better.

**Feature set to aim for**
- **Tools:** pen, brush (multiple textures — airbrush, marker, calligraphy,
  watercolor), pencil, eraser, fill bucket (flood fill), eyedropper
  (color picker), text with font selection, selection tool (rectangular
  + freeform with move/copy/paste).
- **Shapes:** line, rectangle (filled + outline), circle/ellipse, polygon,
  arrow, with adjustable stroke width and separate fill / stroke colors.
- **Canvas controls:** resizable canvas (set custom width/height),
  zoom in/out, pan via space-drag or middle-click drag.
- **Layers** (this is where we'd beat MS Paint — Paint doesn't have them):
  multiple layers with opacity, blend modes, show/hide, reorder, merge.
- **History:** the current 30-snapshot undo stack works for v8.0 but for
  a real Paint replacement we'd want redo too, plus a history panel
  showing the action list.
- **Files:** save as PNG (already works), JPG, SVG (if we keep stroke
  data structured), load existing image to edit.
- **Quality of life:** grid overlay toggle, ruler guides, snap-to-grid,
  keyboard shortcuts (B for brush, E for eraser, etc.).

**Considerations**
- Current PaintApp is a single `<canvas>` with raw drawing operations.
  Adding shapes and selection means tracking a layer of structured
  drawable objects on top, or compositing multiple canvases.
- Layers via stacked `<canvas>` elements is the simplest implementation;
  each layer is its own canvas, the visible result is the stack.
- Fill bucket is a flood-fill algorithm on the canvas's ImageData buffer
  (BFS from the clicked pixel matching color within a tolerance).
- Storage: don't try to save .psd-style multi-layer files to Firestore.
  Export to flat PNG. For now, layers exist only during the session.
- This is a big undertaking — probably its own minor version (v8.x or v9.0).

---

## How to add to this

Edit this file directly, or just mention an idea in conversation and ask
me to "drop it into IDEAS.md" — I'll update it.

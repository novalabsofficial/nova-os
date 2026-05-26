# Nova OS — future ideas

Casual backlog of features floated post-v8.0. Not prioritized, not scheduled,
not committed to. Living document — add to it freely.

---

# 🗺️ v8.3 — next up (playtester feedback)

Scheduled batch. Mix of bug fixes and small features surfaced by playtesters.
Bug fixes first (they're the priority), then the smaller features.

## Bug fixes

### B1. Space Invaders stops shooting after stage 1
After clearing the first wave, the player can no longer shoot on the next
stage. Almost certainly the wave-transition logic doesn't reset/re-enable
the player-bullet state (or leaves a "can't fire" flag set, or never clears
the previous wave's bullet array so the cap is hit forever).
- **Where:** `src/apps/SpaceInvadersApp.jsx` — the wave-advance code.
- **Approach:** trace what state gates firing (a `canShoot` flag, a bullets
  array length cap, etc.) and make sure the new-wave handler resets all of it.

### B2. Chess never sends a challenge to the other user
Challenging a user by name appears to do nothing on the recipient's side.
Playtester suspects a PWA-vs-Chrome difference (could be an auth/uid
mismatch between the two session types, or the recipient's `watchMyGames`
query not matching the created doc).
- **Where:** `src/lib/chess-game.js` (`challengeUserByName`, `watchMyGames`),
  `firestore.rules` (`nova_chess_games` block), and the auth/uid layer.
- **Approach:** verify the created game doc's `participantUids` includes BOTH
  the challenger's and the recipient's Auth uid (resolved via the username
  index), confirm the Firestore rule allows the recipient to read it, and
  check whether the PWA session has a valid `getDbUid()` (the suspected
  PWA-vs-Chrome difference). Likely the recipient uid isn't being resolved
  correctly, OR the recipient's `array-contains` query needs the rule to
  permit listing.

### B3. "Large Text" setting doesn't change text size
The Settings → Display → Large Text toggle flips `settings.largeFont` but
the change isn't visibly applied across the OS / apps.
- **Where:** `src/NovaOS.jsx` reads `largeFnt` and applies `fontSize` only on
  the root desktop container — it doesn't cascade into windows/apps (which
  set their own explicit font sizes everywhere).
- **Approach:** rather than chasing every hardcoded fontSize, apply a root
  `font-size` bump + use `rem`-relative sizing, OR apply a CSS zoom/scale on
  the app content area when largeFont is on. Simplest robust fix: set a CSS
  custom property / root font-size and have a global rule scale things.
  (Note: lots of inline styles use px, so a true fix may mean a zoom
  transform on the window content area.)

## Features

### F1. Drag the title bar to un-maximize (Windows-style)
When a window is maximized (or app-fullscreen), grabbing the title bar and
dragging should restore it to normal size and let you move it — exactly like
Windows. Currently the title-bar drag is disabled while maximized
(`onPointerDown={e=>!isMax&&startDrag(...)}`).
- **Where:** `src/NovaOS.jsx` window title-bar `onPointerDown` + `startDrag`.
- **Approach:** allow the drag to start when maximized; on first movement,
  flip the window to "normal" state, position it centered under the cursor
  (preserving the grab offset proportionally), then continue the normal
  move-drag. This is the standard "tear off from maximized" gesture.

### F2. Hide the top bar in fullscreen
When in fullscreen (the v7.8 OS-level fullscreen), the top info/title bar
shouldn't show. The only ways out should be the fullscreen toggle (F11 /
Settings) or a dedicated button in the start menu.
- **Where:** `src/NovaOS.jsx` — gate the relevant top bar on `isFullscreen()`
  state, and add an "Exit fullscreen" item to the start menu footer.
- **Approach:** subscribe to `onFullscreenChange` (from lib/fullscreen.js) at
  the NovaOS level, hide the bar when fullscreen is active, and surface an
  exit affordance in the start menu so the user is never trapped.

### F3. AFK screensaver
After ~1 minute of no input (no key, no mouse move/click), fade in a
screensaver: blur the entire desktop and show a large clock (reuse the
ClockWidget styling). Dismiss on any key press or mouse movement.
- **Where:** new component in `src/NovaOS.jsx` or a small `Screensaver.jsx`.
- **Approach:** an idle timer reset on `keydown`/`pointermove`/`pointerdown`;
  when it fires, render a fixed full-screen overlay with `backdrop-filter:
  blur()` + a centered live clock. Any input clears the overlay and resets
  the timer. Make the timeout a Setting (default 60s, "off" option).

### F4. Hold backspace to continue deleting
Holding the Backspace key should continuously delete, like every OS text
field. Native inputs already do this, so the broken case is likely a
custom input somewhere (Terminal command line? a canvas-based field?).
- **Where:** find the input(s) that swallow key-repeat — check Terminal
  (`src/apps/TerminalApp.jsx`) and any custom `onKeyDown` handlers that
  `preventDefault()` on Backspace.
- **Approach:** make sure custom key handlers don't block the browser's
  native key-repeat, or implement an explicit repeat timer for fields that
  manage their own value outside a native `<input>`.

---

# Unscheduled backlog

Bigger ideas, not yet slotted into a version.

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

## 7. Window snap layouts

Drag a window to a screen edge → it snaps to half the screen. Drag to
a corner → snaps to a quarter. Keyboard: `Win+←/→/↑/↓` and equivalents
on Mac. Plus **Windows 11-style snap groups** — save a window arrangement
as a named "workspace" and restore it with one click.

**Considerations**
- Edge-snap is straightforward — already track drag in NovaOS.jsx via
  `drag` state; just compare `e.clientX/Y` to screen edges on `pointerUp`
  and snap if within a threshold (e.g., 20px).
- The "saved workspace" feature needs storage: `data.savedWorkspaces[]`
  with each entry containing app id + position/size for every window
  in the group.
- Visual feedback during edge-snap: show a translucent "ghost" overlay
  where the window will land, like Windows 11 does.
- Quarter snaps need a slight pause-on-corner gesture so casual edge
  drags don't trigger them by accident.

---

## 8. Screenshot tool with annotation

Capture region / single window / full screen → opens an annotation
overlay where you can draw arrows, highlight rectangles, add text, blur
sensitive areas. Saves directly to the Photos app gallery.

**Considerations**
- Browser-only screen capture: `navigator.mediaDevices.getDisplayMedia()`
  for the full screen; regions and per-window need custom logic
  (overlay a transparent canvas, let the user drag-select, then
  composite from the captured frame).
- Annotation reuses the canvas drawing patterns from PaintApp — same
  pointer-based stroke handler, plus shape tools (arrow, rect, text)
  and a one-shot Gaussian blur via filter.
- Keyboard shortcut: `Shift+Win+S` (Windows convention) or
  `Cmd+Shift+4` (macOS convention). Detect the platform and bind both.
- Tauri build can use a more direct OS API; web build uses the
  Display Media path (user has to grant permission each time).

---

## 9. Wallpaper from your Photos

Pick any photo from the Photos app and use it as your desktop wallpaper.
Cross-pollinates two existing apps in a really natural way.

**Considerations**
- The "custom wallpaper" plumbing already exists from v6.2 — accepts a
  base64 data URL. Just need a "Set as wallpaper" button in the Photos
  full-size viewer that runs the photo through the same downsample
  pipeline (max 900px, JPEG quality 0.72) the SettingsApp upload uses
  and writes to the user-data wallpaper field.
- The Photos app stores photos as blob URLs (session-only) — for the
  "set as wallpaper" flow we'd actually need to bake the photo into the
  user's wallpaper data, so it survives a refresh. The downsampled
  base64 lives in Firestore on the user data doc; same shape as
  current custom wallpapers.

---

## 10. Notification badges on app icons

Chat icon shows unread DM count. Atmos icon shows active NWS-alert
count. Store shows new-app count. Small numeric badge on both the
desktop icon **and** the taskbar chip.

**Considerations**
- Need a small per-app badge-count system in NovaOS.jsx — probably a
  `useState` map keyed by app id, populated by each app's
  notification logic (Chat watches DM unread counts via the existing
  Firestore subscription, Atmos counts active alerts, etc.).
- Render: small red circle with white number in the top-right corner
  of the icon (similar to the notification bell's existing badge in
  the taskbar). Capped at 9+ for high counts.
- Auto-clear when the user opens the app (chat marks DMs as read,
  Atmos opens the alerts list, etc.). Each app gets a `clearBadge`
  callback in its props.

---

## 11. Battery widget

Small widget showing current battery percentage + charging state +
estimated time remaining (when available). Only visible/relevant on
laptops in the PWA install or Tauri desktop on a battery-powered device.

**Considerations**
- API: `navigator.getBattery()` returns a `BatteryManager` with
  `level` (0-1), `charging` (bool), `dischargingTime`, `chargingTime`.
  Listen for change events to update the UI.
- Chromium-only — Firefox / Safari deprecated this API. Need a
  graceful fallback (hide the widget) on browsers without it.
- Desktops without a battery report `level=1` and `charging=true`
  perpetually — detect that case and hide the widget rather than show
  a useless "100% plugged in" forever.
- Visual: small horizontal battery glyph with fill level, optional
  lightning bolt icon when charging.

---

## 12. Drag-and-drop between apps

Drag a photo from Photos → drop onto Chat → it gets attached/embedded
in the message. Drag selected text from Notes → drop into a DM. Drag a
file from Files → into Chat. Etc.

**Considerations**
- Native HTML5 drag-and-drop API works across browser windows but is
  awkward within a single page (which is what Nova OS is). Custom
  pointer-based drag is more flexible — we already have the muscle
  memory from icon drag, window drag, widget drag.
- Need a generic "dragged item" registry — a `useState` for what's
  currently being dragged, with type (`photo`, `text`, `file`) and
  payload. Drop targets register handlers that accept certain types.
- Cross-app data shape: standardize the payload. E.g., dragging a
  photo passes `{type:"photo", url, name, w, h}`; receiving Chat
  embeds it as a message attachment.
- Discoverability: subtle visual hint when a drag is active (drop
  targets highlight in accent color).

---

## 13. Dynamic wallpapers

Three flavors, picked per wallpaper or globally:
- **Time-of-day swap:** Lumen during day, Ember at sunset, Halcyon at
  dusk, Night/Tide at night. Auto-switches based on local time.
- **Animated parallax:** subtle continuous motion — Mesh's blobs drift
  slowly, Aurora's curtains shimmer, Prism's colors rotate. A few
  pixels of motion at low FPS so it's noticeable but never distracting.
- **Reactive:** wallpaper subtly responds to system state — pulses
  faster when CPU is high (when we implement real sys info), shifts
  hue with the accent color, etc.

**Considerations**
- Time-of-day: easy — pick a time bucket from `new Date().getHours()`
  and map to a wallpaper id, re-check every 15 minutes. Per-bucket
  override stored in settings.
- Parallax: implement via CSS animations on the SVG layers. Mesh,
  Aurora, and Cascade are SVG-based so we can animate filter offsets,
  gradient transforms, etc. The Bliss / static-gradient wallpapers
  would need to stay non-animated.
- Performance: cap animation at ~30fps and pause when the window is
  not focused (`visibilitychange` event) so it doesn't drain battery.
- Reactive ties in with the System Info Tauri integration (#5).

---

## How to add to this

Edit this file directly, or just mention an idea in conversation and ask
me to "drop it into IDEAS.md" — I'll update it.

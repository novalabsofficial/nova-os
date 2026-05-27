# Nova OS — future ideas

Casual backlog of features floated post-v8.0. Not prioritized, not scheduled,
not committed to. Living document — add to it freely.

---

# ✅ v8.6 — shipped (capture & flow batch)

Three self-contained backlog items.

### ✅ AFK screensaver (backlog #14) — SHIPPED
Idle → blurred desktop + large live clock; any input wakes it. Timeout is a
Setting (Off / 1 / 3 / 5 / 10 min, default 1). See `src/NovaOS.jsx` (idle
timer + overlay), `src/apps/SettingsApp.jsx` (Screen Saver picker).

### ✅ Screenshot tool with annotation (backlog #8) — SHIPPED
New Screenshot app: capture via `getDisplayMedia`, annotate (pen, box, arrow,
text, blur, color/size, undo), then Download PNG / Set as wallpaper / Save to
Photos. `src/apps/ScreenshotApp.jsx`, shared `src/lib/photoStore.js` (Photos
seeds + subscribes), registered in constants + NovaOS.
- **Deferred:** region/per-window cropping beyond the browser's share picker;
  a global capture shortcut.

### ✅ Drag-and-drop between apps (backlog #12) — SHIPPED
Drag a photo from Photos onto the **desktop** (→ set wallpaper) or a **Profile
window** (→ set avatar), with a floating ghost following the cursor. Generic
pointer-based infra in `src/lib/dragStore.js`; drops resolve via `data-drop`
attributes; handled in `src/NovaOS.jsx`.
- **Deferred:** more flows (photo → Paint to edit, text → DM, file → Chat) —
  the Chat/DM ones need attachment support; the infra is now in place for them.

---

# ✅ v8.5 — shipped (desktop-feel batch)

Three backlog items knocked out together — all make Nova feel more like a
real OS.

### ✅ Window snap layouts (backlog #7) — SHIPPED
Drag a window to a screen edge/corner and a ghost preview shows where it'll
land; release to snap. Edges → halves, corners → quarters, top → maximize.
Keyboard: **Alt + ←/→** (halves), **Alt + ↑** (maximize), **Alt + ↓**
(un-maximize / minimize) — the web-safe stand-in for Win+Arrow, which the OS
itself intercepts.
- **Where:** `src/NovaOS.jsx` — `computeSnapZone` / `snapZoneRect` / `applySnap`
  / `snapDown`, the move-drag effect (live ghost), the keyboard handler, and
  the snap-preview overlay. Desktop-mode only.
- **Deferred:** saved "workspaces" (named window arrangements) — future.

### ✅ Profile picture editor (backlog #3) — SHIPPED
Upload a photo, pan + zoom to frame it in a circular crop, save a downsampled
256² JPEG to `data.avatar`. The new shared `<UserAvatar>` renders it on the
Profile app, the top-right user chip, and the start-menu user card (falls
back to the letter circle when none is set).
- **Where:** `src/ui/icons.jsx` (`UserAvatar`), `src/apps/ProfileApp.jsx`
  (cropper), `src/NovaOS.jsx` (two chip sites).
- **Deferred:** showing *other* users' avatars in Chat / DMs / reviews needs a
  public avatar registry — future.

### ✅ Dynamic wallpapers (backlog #13) — SHIPPED
Two flavors: an **"Auto"** wallpaper that swaps by time of day (night →
dawn → morning → midday → sunset → dusk, re-checked every 5 min), and an
**"Animate wallpaper"** toggle that adds a slow, subtle drift to whatever
wallpaper is active.
- **Where:** `src/ui/wallpapers.jsx` (`autoWallpaperId`, `Wallpaper` rework),
  `src/ui/styles.js` (`wp-drift` keyframes), `src/ui/constants.js` (`auto`
  swatch), `src/apps/SettingsApp.jsx` (toggle).
- **Deferred:** CPU-reactive wallpapers — ties to real System Info (#5).

---

# ✅ v8.4 — shipped (Store revamp)

A full rebuild of the Nova Store into a real, professional app-store
experience — plus written reviews and a cohesive custom icon set.

### ✅ Professional Store UI — SHIPPED
The old flat tabbed card-grid (which read like "something out of Roblox")
was rebuilt borrowing the Google Play / App Store structure.
- **Home** with a Featured hero carousel + horizontal category "shelves"
  (Top Games, Essential Apps, Social & News, From the Community).
- **Games / Apps** browse views (Apps has Media/Tools/Social/News sub-chips).
- **Unified search** across the curated catalog and community apps.
- **App detail pages** — gradient hero tinted with the brand accent, big
  icon, developer + tagline, rating summary with a 5-bar histogram, and
  Open / Add-to-Desktop actions.
- Community / Submit / Moderation kept and restyled to match.
- **Where:** `src/apps/StoreApp.jsx` (full rewrite), `src/ui/constants.js`
  (`STORE_META`, `STORE_FEATURED`).

### ✅ Written reviews — SHIPPED
Users can write a text review alongside their star rating (optional).
- One doc per user per app in `nova_ratings` now carries an optional `text`
  field; a star-picker + textarea composer posts/edits it, and the detail
  page shows a feed of everyone's reviews (avatar, @user, stars, relative
  time). Quick re-rating uses `merge:true` so it never wipes the written
  review.
- **Where:** `src/apps/StoreApp.jsx`, `firestore.rules` (ratings block now
  allows an optional `text` ≤ 1000 chars).

### ✅ Revamped Store app icons (backlog #4) — SHIPPED
Replaced the inconsistent Clearbit logo PNGs with a unified, hand-drawn
brand-icon set in the Nova aesthetic. Recognizable brands (Roblox, YouTube,
Spotify, Discord, Reddit, X, Twitch, GitHub, Steam, Xbox, PlayStation,
Figma, Notion) get custom glyphs; the rest get clean monogram tiles tinted
with the brand accent. Used in the Store *and* on the desktop / taskbar.
- **Where:** `src/ui/icons.jsx` (`StoreBrandIcon`, `storeBrandSvg`),
  `AppIconDisplay` now routes store apps through it.

---

# ✅ v8.3 — shipped (playtester feedback)

Scheduled batch of bug fixes + small features surfaced by playtesters.
Six of the seven items shipped; the screensaver (originally F3) was deferred
and now lives in the Unscheduled backlog below.

## Bug fixes

### ✅ B1. Space Invaders stops shooting after stage 1 — FIXED
After clearing the first wave the player could no longer shoot. Root cause:
`lastFire` lived in the persistent `keysRef` while the per-stage `tick`
counter reset to 0 on wave advance, so the `tick - lastFire > cooldown`
gate was permanently false (lastFire from the previous stage was a larger
number than the new stage's tick).
- **Where:** `src/apps/SpaceInvadersApp.jsx`.
- **Fix:** moved `lastFire` into the game state object (`initState` returns
  `lastFire: 0`), so it resets with the rest of the stage state. Fire check
  is now `if (k.fire && s.tick - s.lastFire > 18) { …; s.lastFire = s.tick; }`
  and `keysRef` is back to just `{ left, right, fire }`.

### ✅ B2. Chess never sends a challenge to the other user — FIXED
Challenging by name silently did nothing on the recipient's side. Root cause:
`watchMyGames` used `where(array-contains) + orderBy("lastMoveAt","desc")`,
which Firestore requires a **composite index** for. That index didn't exist,
so the query errored silently and the recipient's listener never fired — not
a PWA-vs-Chrome difference after all.
- **Where:** `src/lib/chess-game.js` (`watchMyGames`).
- **Fix:** dropped the server-side `orderBy` (and its import), sort
  client-side instead — `games.sort((a,b)=>(b.lastMoveAt||0)-(a.lastMoveAt||0))`
  — and added a `console.warn` error handler on the snapshot listener so a
  future silent failure is at least visible.

### ✅ B3. "Large Text" setting doesn't change text size — FIXED
The Settings → Display → Large Text toggle flipped `settings.largeFont` but
nothing visibly changed, because apps set their own explicit px font sizes
everywhere and a root `fontSize` bump didn't cascade.
- **Where:** `src/NovaOS.jsx` window content area.
- **Fix:** apply CSS `zoom: largeFnt ? 1.18 : 1` on the app content wrapper.
  `zoom` scales the whole rendered subtree (text + layout) without the
  overflow problems a `transform: scale()` would cause.

## Features

### ✅ F1. Drag the title bar to un-maximize (Windows-style) — SHIPPED
Grabbing the title bar of a maximized window now restores it to normal size
and lets you move it, positioned proportionally under the cursor — the
standard Windows "tear off from maximized" gesture.
- **Where:** `src/NovaOS.jsx` `startDrag` + title-bar `onPointerDown`.
- **Fix:** `startDrag` detects `state==="maximized"`, computes a restore
  size (from `prevBounds` or `DEFAULT_SIZES`), positions the restored window
  under the cursor (`frac = clientX/innerWidth`), flips it to `normal`, then
  continues a normal move-drag. Title-bar `onPointerDown` no longer guards
  on `!isMax`; cursor is always grab/grabbing.

### ✅ F2. Hide the top bar in fullscreen — SHIPPED
In OS-level fullscreen the top bar is hidden; the taskbar slides off-screen
and reveals on a bottom-edge hover, and the start menu has an "Exit
Fullscreen" button so the user is never trapped.
- **Where:** `src/NovaOS.jsx` (subscribes to `onFullscreenChange`), start menu footer.
- **Fix:** `isFs` state tracks fullscreen; taskbar gets
  `transform: translateY(110%)` when fullscreen and not peeking; a
  bottom-edge pointer tracker (`tbPeek`) reveals it within 6px and hides it
  past `TASKBAR_H + 20`; start menu footer toggles fullscreen.

### ✅ F4. Hold backspace to continue deleting — SHIPPED
The Calculator was button-only (one delete per click). Added full keyboard
support so holding Backspace deletes continuously via native key-repeat.
- **Where:** `src/apps/CalculatorApp.jsx`.
- **Fix:** focusable wrapper (`tabIndex=0` + autofocus `wrapRef`) with an
  `onKeyDown` handler wiring digits, `.`, operators, Enter/`=`, Escape/clear,
  `%`, and Backspace. Each native Backspace key-repeat calls `pressBackspace`,
  giving continuous deletion. `preventDefault` on handled keys stops
  browser back-nav and double-firing of focused buttons.

### ⏸️ F3. AFK screensaver — DEFERRED (see Unscheduled backlog #14)
Moved out of v8.3 at the user's request to keep the release tight. Full
write-up is in the backlog below.

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

## 3. Profile picture editor — ✅ SHIPPED in v8.5

> Done: upload → pan/zoom circular crop → 256² JPEG saved to `data.avatar`,
> rendered via the shared `<UserAvatar>` on the profile, user chip, and start
> menu. Cross-user avatars (chat/DMs) deferred. Original notes below.

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

## 4. Redo Store app icons (especially Roblox) — ✅ SHIPPED in v8.4

> Done: replaced Clearbit logos with the hand-drawn `StoreBrandIcon` set
> (custom glyphs for the big brands incl. Roblox, monogram tiles for the
> rest). Original notes kept below for reference.


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

## 7. Window snap layouts — ✅ SHIPPED in v8.5

> Done: edge/corner drag-snap with a ghost preview + Alt+Arrow keyboard
> snapping. The "saved workspaces" part is still open (see below).

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

## 8. Screenshot tool with annotation — ✅ SHIPPED in v8.6

> Done: getDisplayMedia capture + annotation (pen/box/arrow/text/blur) +
> Download / Wallpaper / Save to Photos. Region cropping deferred.


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

## 12. Drag-and-drop between apps — ✅ SHIPPED in v8.6 (more flows to come)

> Done: generic pointer-drag infra + Photos → desktop (wallpaper) / Profile
> (avatar). Photo→Paint and text/file→Chat/DM flows deferred (the latter need
> chat attachments). Original notes below.


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

## 13. Dynamic wallpapers — ✅ SHIPPED in v8.5 (reactive flavor deferred)

> Done: time-of-day "Auto" wallpaper + an "Animate wallpaper" drift toggle.
> The reactive (system-state) flavor is deferred — it depends on real System
> Info (#5). Original notes below.

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

## 14. AFK screensaver (deferred from v8.3) — ✅ SHIPPED in v8.6

> Done: idle → blurred clock overlay, wake on any input, timeout Setting.


After ~1 minute of no input (no key, no mouse move/click), fade in a
screensaver: blur the entire desktop and show a large clock (reuse the
ClockWidget styling). Dismiss on any key press or mouse movement.

**Considerations**
- An idle timer reset on `keydown` / `pointermove` / `pointerdown`; when it
  fires, render a fixed full-screen overlay with `backdrop-filter: blur()`
  + a centered live clock. Any input clears the overlay and resets the timer.
- Make the timeout a Setting (default 60s, with an "off" option).
- New component — either inline in `src/NovaOS.jsx` or a small
  `Screensaver.jsx`.
- Deferred out of v8.3 to keep that release focused on the bug fixes; pick
  it up in a later batch.

---

## How to add to this

Edit this file directly, or just mention an idea in conversation and ask
me to "drop it into IDEAS.md" — I'll update it.

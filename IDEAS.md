# Nova OS — future ideas

Casual backlog of features floated post-v8.0. Not prioritized, not scheduled,
not committed to. Living document — add to it freely.

---

# 🔭 Planned — 11.0 — the big UI release (long, phased on `nova-11`)

Nova 11 is a long flagship release, not a single drop. It's built in themed
sub-batches on the long-lived `nova-11` branch, shipping as each batch becomes
solid. This combined release **absorbs everything that was tentatively scoped as
"10.11"** (the desktop-power features) into one big 11.0.

### 🔗 Build order — the pipeline (each step builds on the one before)
```
1 ✅ Design tokens + primitives ── the shared values + components.
        │                          Unlocks everything below. (DONE)
        ▼
2 Unified dialogs ── swap browser-native confirm()/alert() + ad-hoc
        │             modals for the <Dialog> primitive.        (needs 1)
        ▼
3 All-SVG icon set ── replace emoji icons across desktop / Start /
        │              Store / taskbar. Sets the visual tone.   (independent)
        ▼
4 Unified window chrome ── one title-bar + controls frame for every
        │                   window.                  (needs 1; uses 3's glyphs)
        ▼
5 App migration ── sweep the ~35 apps onto the tokens / primitives +
        │           motion language for consistency. (needs 1; smoother after 3–4)
        ▼
6 Light mode ── build the light theme on the tokens.  (AFTER 5 — only works
        │         once surfaces actually use the tokens)
        ▼
7 Full visual-redesign polish ── the holistic "looks shipped, not
        │   generated" pass once icons + chrome + motion + light are all in.
        ▼   (this caps Phase A — the UI refresh)
8 Phase B · Desktop power ── pinning whitelist + first-run wizard, app
        │   folders, snap workspaces, drag-to-desktop, multi-select, widgets,
        ▼   sticky notes/clipboard, backup/export. (new UI uses the finished system)
9 Phase C · Flagship apps ── video editor, code editor, etc. (biggest; last)

   Phase D · Smaller wins (Asset Studio paste/drop, achievements) slots in as
   filler between the big steps — no dependencies.
```

> **Status (2026-06, `nova-11`):** **Phase A COMPLETE (steps 1–7).** Design tokens +
> primitives, unified dialogs, all-SVG icons, unified window chrome, app→token
> migration, **light mode** (Bloom light/dark wallpaper pair, per-theme auto-switch +
> custom-safe slots), and the **step-7 polish pass** — elevation cohesion
> (`--nv-popover-shadow`), motion cohesion (one `var(--nv-ease)`), spacing/type audits
> (foundation already consistent; aligned the few outliers), and accent-aware focus
> rings (`--nv-accent`). **Next: Phase B · Desktop power** (first-run wizard +
> whitelist pinning, app folders, snap workspaces, multi-select, sticky notes,
> backup/export).

## A · Design foundation — the bedrock everything else sits on
- **Design system / tokens.** One shared scale for spacing, corner radius,
  shadows, typography and accent usage (extends the existing `--nv-*` vars in
  styles.js), plus reusable primitives — then migrate all ~35 apps onto it so
  everything feels cut from the same cloth.
- **Motion language.** One consistent set of easing curves + durations for
  window open/close/minimize, snapping, panels, hovers and transitions.
- **All-SVG icon set.** A cohesive, professional vector icon family (Windows-10
  level polish) that keeps Nova's personality — replacing today's emoji
  fallbacks across desktop / Start / Store / taskbar.
- **Unified window chrome + dialogs.** One window-frame component (title bar +
  controls) every app shares, plus a Nova-styled confirm / alert / prompt that
  replaces the browser's native boxes and the ad-hoc per-app modals.
- **Light mode.** A real, polished light theme built on the token system.
- **Full visual redesign — "looks shipped, not generated."** A deliberate
  overhaul so Nova reads as a serious, professional OS: intentional layout +
  alignment everywhere, real material depth, refined type hierarchy, considered
  spacing, cohesive icon + motion craft — keeping the accent system, wallpapers
  and sounds that make Nova unique.

## B · Desktop power (formerly "10.11")
- **Desktop pinning → whitelist + first-run wizard.** Flip pinning from the
  current *blacklist* (everything shows unless hidden) to a Windows-style
  *whitelist* (nothing unless added). New accounts get a setup wizard choosing
  which apps land on the desktop, with a note that more can be added anytime;
  existing accounts migrate gracefully (keep their current set).
- **App folders** on the desktop (group icons, iOS/Windows-style).
- **Snap saved workspaces** — save & restore window layouts.
- **Drag Files / Photos → desktop** (plus more drag-and-drop flows).
- **Multi-select icon move** — box-select and move several desktop icons at once.
- **More widgets.**
- **Sticky notes + clipboard manager.**
- **Backup / export profile** — export and re-import your account data.

## C · Flagship + bigger apps (11.x stretch within the release)
- **Video editor (CapCut-style).** Timeline-based editor — import clips,
  trim/split, multi-track timeline, text overlays, transitions, audio track,
  export. Match CapCut's exact UI typeface. Heavy lift (canvas + WebCodecs /
  ffmpeg.wasm for export).
- Code editor · Whiteboard · Mini Spreadsheet · full Paint competitor.

## D · Smaller wins to fold in
- **Asset Studio — paste & drop images.** Ctrl/Cmd+V a copied image and
  drag-drop image files onto the canvas, to edit / cut out immediately.
- **Achievements / badges.**

---

# ✅ v9.8 — shipped ("Game revamps + leaderboards")

- **Snake — Google Snake style.** Input buffering (queues up to 2 turns) so
  fast double-turns register; constant fast tempo; checkerboard grass board;
  rounded connected body. Settings: board size (S/M/L) + apple count (1/3/5).
- **Minesweeper — global best-time leaderboard** per difficulty (lower =
  better) + cleaner readout/UI polish.
- **Flappy Bird — graphics overhaul** (parallax sky/clouds/hills, classic
  shaded pipes with caps, rounder animated bird, scrolling ground) + global
  high-score leaderboard.
- **Leaderboards (#28)** — new `nova_scores` collection: one tiny doc per
  (game, user), written only on a personal best, top-N read with a single
  index-free query. Very low Firestore footprint.

**Required Firestore rules update (deploy):** the new `nova_scores` block.
Deploy via the Firebase Console rules editor (or `firebase deploy --only
firestore:rules`).

---

# ✅ v9.7 — shipped ("Creative tools + polish")

Two big app builds plus a batch of fixes.

**Photos — overhaul + Canva-style editor (#20)**
- Two-pane Library / Recently Added / Albums sidebar; session albums.
- The editor became a **layered compositor**: configurable background (color
  or transparent → PNG export), the photo as a movable layer, add more image
  layers from your PC or by **pasting** (Ctrl/⌘+V). Drag layers freely with
  **smart alignment guides** that snap to the canvas + other layers. Per-layer
  opacity, rotate, flip, brightness/contrast/saturation/warmth, 8 filter
  presets, z-order. Exports a flattened new copy.

**Slides — new presentation app (#23)**
- Deck home + editor (slide rail + 16:9 canvas + properties). Text / rect /
  ellipse / line / image elements, drag-move + resize, 6 themes, presenter
  fullscreen mode. Decks save to `data.slides` on the user doc. **.pptx
  export** via lazy-loaded `pptxgenjs` (opens in PowerPoint / Google Slides).

**Calculator — Canva-era reuse:** N/A (calc shipped in 9.5).

**Bug-fix / polish batches**
- Screenshot: region-snip is the primary action with a full-screen
  Snipping-Tool-style overlay (dim, crosshair, live W×H badge, Esc).
- Calculator hold-backspace now repeats via pointer press-and-hold (works on
  ChromeOS/PWA where physical key-repeat is suppressed).
- Community-app desktop query hardened (no silent doc-drop).
- **Desktop drag-select** — left-drag empty desktop draws a Windows-style
  selection box that highlights icons (fixed the surface-layer bug).
- **Pong** — local 2-player hot-seat (P1 = W/S, P2 = ↑/↓), no networking.
- **Chess — chess.com-style revamp:** consistent solid pieces (fixed the
  mixed outline/filled glyphs), green/cream board with coordinates +
  last-move highlight, captured-piece trays with material lead, and a
  numbered move-history list.

**Dependency added:** `pptxgenjs` (lazy-loaded, export-only).
**Firebase:** no rules change for v9.7.

---

# ✅ v9.6 — shipped ("Servers & Social polish")

A focused follow-up to v9.5's servers launch — finishing the social surfaces.

- **Server member list + roles + nicknames.** The 👥 header button opens a
  roster everyone can see. Roles: **owner / admin / member**. Owner
  promotes/demotes admins (▲▼) and kicks members (✕); admins can delete any
  message. **Per-server nicknames** — members set their own (✏️), owner can
  rename anyone; nicknames show in messages with the real @username beneath
  in the panel. `nova_servers` gains a `members` map; legacy v9.5 servers
  auto-backfill when the owner opens them.
- **Reactions on server messages.** New `nova_server_reactions` collection
  (mirrors DM reactions). All three surfaces — global / DM / server — now
  react identically.
- **@mention highlighting + notifications.** `@username` renders as a pill
  in every chat view; messages that ping *you* get a yellow accent band.
  An OS-level global-chat listener pushes a Notification Center entry when
  you're mentioned — even with Chat closed.
- **Unread badges.** Red dots on DM rows + a count by "Direct Messages";
  per-server unread dots in the sidebar; both feed the existing taskbar/
  desktop app-icon badge. DM read tracked per-thread via `data.lastRead`;
  servers via a `lastActivityTs`/`lastSenderUid` stamp on the server doc.

**Required Firestore rules update (deploy):** members-map-aware
join/leave/nickname branches + an activity-bump branch on `nova_servers`,
admin message-delete, members map required on create, and the new
`nova_server_reactions` collection. Deploy via the Firebase Console rules
editor (or `firebase deploy --only firestore:rules`).

---

# ✅ v9.5 — shipped

A two-part release: **part 1** revamped four under-loved apps into real-OS
two-pane experiences, **part 2** added the long-requested social + workflow
features.

**Part 1 — app revamps**
- **Tasks** — full rewrite into a Todoist-style two-pane app. Smart views
  (Today / Upcoming / No date / All / Completed), user-created Lists with
  color tags, per-task due dates + priorities + notes, inline detail
  editor. Backwards-compatible data shape.
- **Calendar** — Apple/Google Calendar-style. Sidebar with mini-month +
  "Up next" agenda, main pane toggles between Month / Week / Agenda. Event
  color tags, full-screen event editor, notes per event.
- **PDF Viewer** — sidebar with session recents, drag-and-drop drop zone,
  iframe-rendered viewer with download + close toolbar.
- **Nova AI** — sidebar with chats grouped by recency, double-click to
  rename, inline provider picker dropdown, 6 starter-prompt chips on
  empty state, polished message bubbles with per-message copy.

**Part 3 — bonus app revamps (pre-deploy round)**
- **Calculator** — rebuilt as a real multi-mode app with a sidebar mode
  picker: **Standard** (with session history), **Scientific** (trig, logs,
  exponents, factorial, π/e, DEG/RAD toggle), **Programmer** (HEX/DEC/OCT/BIN
  simultaneous display with AND/OR/XOR/NOT/<</>>), and **Converter**
  (length, weight, temperature, time, data size, speed). Content stays
  centered with `max-width` so fullscreen no longer stretches buttons into
  ugly rectangles. Optional history side-panel.
- **Browser** — chrome refresh to match the v9.5 OS look. New BrowserNav
  with a pill URL bar (🔒/🔍 glyph flips based on URL detection), inline
  bookmarks rail, theme-token everywhere. New home page: centered 540px
  hero, quick-pick site tiles (Wikipedia / Hacker News / MDN / archive.org /
  itch.io / YouTube), and a session "Recent" list. Search results got
  bigger cards with proper section headers. "Site can't be embedded"
  error now offers a "Search instead" escape hatch.

**Part 2 — new features**
- **User-created servers (Discord-style).** New `nova_servers` collection.
  Anyone can create a server with custom name + icon; gets a 6-char
  invite code. Owner can add/remove channels (`#general`, `#bots`, …),
  rename, regenerate the invite, kick (via deletion), or delete the whole
  server. Members join by code, send messages per channel, and can leave.
  Server messages support delete-own + delete-by-owner. Rules-enforced
  membership + invite-code gating.
- **DM reactions.** Mirrors the v9.4 global-chat reactions but for direct
  messages. New `nova_dm_reactions` collection with membership rules
  matching the parent thread. Same 5-emoji preset.
- **Music — shuffle / repeat / queue.** Real play queue (separate from
  library order). Shuffle reshuffles the *unplayed* tail so the current
  track stays put. Repeat off / all / one. New Queue view in the sidebar
  shows the order, lets you reorder/remove/jump.
- **Notes — markdown shortcuts.** Live preview toggle, full markdown
  toolbar (H1/H2/H3, bold, italic, inline code, lists, quote, link, hr),
  Ctrl+B / Ctrl+I / Ctrl+K keyboard shortcuts. Custom <200 line markdown
  renderer (no library bloat).
- **Pomodoro widget.** New desktop widget. 25/5/15 cycle (Focus → Short
  break × 3 → Focus → Long break), wall-clock-anchored countdown so
  background-throttled tabs stay accurate. Soft chime at end of each
  phase. Cycle dots show progress.

**Required Firestore rules update (deploy):** `nova_servers/{serverId}`
(+ messages subcollection), `nova_server_invites/{code}`, and
`nova_dm_reactions/{rxId}`. Deploy via `firebase deploy --only firestore:rules`
or the Firebase Console rules editor.

---

# ✅ v9.0 + v9.1 + v9.2 + v9.3 + v9.4 — shipped

**v9.0 — "Liquid Glass" release**
- Liquid Glass surface toggle + full colorless glass icon set; light mode
  scrapped, dark forced.
- Sound engine rewrite (master bus: lowpass → limiter → convolution reverb).
- macOS-style login + Windows-style boot screen; 30-sec screensaver option.
- Floating glass taskbar dock (centered apps, bigger chips, glass tray
  glyphs, Windows 11-style weather pill).
- Settings two-pane refresh + taskbar quick-settings flyout (network status
  tile + Nova volume/mute + Liquid Glass toggle).
- Custom community app logos; community apps on desktop; mod review
  deletion; hold-backspace fix.

**v9.1 — File Explorer + housekeeping**
- File Explorer rebuilt as a Windows-style two-pane layout (Home / My Files
  / Documents / Tasks / Pictures / Applications). Installed apps —
  built-in, catalog, and community — now live in **Applications**, grouped
  by category.
- Trademarks & attributions footer in Settings → About.
- Fix: newly installed community apps now reliably appear on the desktop
  (spread-order id bug + legacy-id fallback).

**v9.2 — Notes / Music / Chat reworks**
- Notes rebuilt as a three-pane editor (folder rail + note list + editor
  with auto-save) sharing folders with File Explorer.
- Music rebuilt Spotify-style (sidebar + persistent now-playing bar +
  per-track gradient album-art tiles).
- Chat reworked to true Discord style (flat left-aligned messages with
  consecutive-message grouping, 32 px avatars, hover-revealed actions).
- Fixes for DM persistence (composite-index issue) + Music narrow-window
  overflow.

**v9.3 — playtester bug-fix pass**
- Minesweeper right-click no longer reveals the cell (#18).
- Photos persist across close/reopen for the session (#19).
- Store shows link target before opening (#20).
- Desktop icons stop dancing + leaving gaps on resize (#21).
- Dedicated volume button on the taskbar (#22).
- Chess board squares now genuinely equal (`minmax(0, 1fr)`).
- Community-app install bug — surfaced silent snapshot errors via
  console.warn + added a runtime [nova-install-debug] diagnostic to pin
  the cause if it still recurs.

**v9.4 — Alarms / Reactions / Severe Alerts / Spotlight**
- Spotlight (Ctrl+K) — global search across apps, notes, tasks, folders,
  photos, Store, Settings panes. Taskbar button + keybind.
- Alarms — fourth tab in Clock app with recurring schedule, three built-in
  alarm sounds (sunrise / pulse / classic), OS-level scheduler poller.
- Chat — emoji reactions on global chat (new `nova_chat_reactions`
  collection) + DM typing indicators via TTL'd `typing` field on the
  thread doc.
- Atmos — lock-screen severe-weather card on Severe/Extreme NWS alerts,
  with new EAS-style 853+960 Hz dual-tone sawtooth alarm (FCC §11.31 spec,
  flat envelope, dry path).
- Volume preview chime — soft two-note plays when adjusting the volume
  slider so you can hear the level.

---

# ✅ v8.7 — shipped

### ✅ Region snip (backlog #15) — SHIPPED
The Screenshot app now offers **Snip a region** alongside Capture full: after
grabbing the frame it shows a crop view where you drag a rectangle (dimmed
outside) to keep just that area, then drops into the annotation editor. "Use
full image" / Back escape hatches included.
- **Where:** `src/apps/ScreenshotApp.jsx` (capture(region) + crop view).
- **Note:** still goes through the browser's one share prompt first (web
  can't read screen pixels otherwise); a true promptless live-desktop snip
  remains a Tauri-only future.

### ✅ Real System Info widget — desktop only (backlog #5) — SHIPPED
On the **Tauri desktop build** the System Info widget shows real CPU %, RAM
used/total, and core count via a new Rust `system_info` command (the
`sysinfo` crate). The **web build keeps its simulated numbers** (no OS access
in a browser).
- **Where:** `src-tauri/src/lib.rs` + `Cargo.toml` (sysinfo), `src/lib/sysinfo.js`
  (Tauri-guarded invoke), `src/widgets/widgets.jsx` (real vs simulated).
- **Deferred:** GPU/disk metrics; Wi-Fi + audio device controls (#2).

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

## 2. Wi-Fi + system sound settings — ⏳ PARTIAL in v9.0

> v9.0 added a **taskbar quick-settings flyout** (network status tile + Nova
> volume slider/mute + Liquid Glass toggle) and a **Network section** in the
> refreshed Settings app. These are the *web-honest* versions: network is
> read-only (online/offline + connection type/speed where the browser exposes
> it — a browser can't list or switch Wi-Fi), and "volume" controls Nova's own
> system sounds (a web page can't set the OS master volume). The Tauri-native
> bits below (real network/audio device control) are still open. Original
> notes follow.

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

## 5. Actually-functioning System Info widget — ✅ SHIPPED in v8.7 (desktop)

> Done: real CPU/RAM/cores on the Tauri desktop build via the `sysinfo` crate
> + a `system_info` command; web keeps simulated numbers. GPU/disk deferred.


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

## 9. Wallpaper from your Photos — ✅ SHIPPED in v8.1

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

## 10. Notification badges on app icons — ✅ SHIPPED in v8.1

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

## 11. Battery widget — ✅ SHIPPED in v8.1

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

## 15. Region snip (Windows Snipping Tool style) — ✅ SHIPPED in v8.7

> Done: "Snip a region" in the Screenshot app — capture a frame, drag-select
> a rectangle, crop into the annotation editor. Promptless live-desktop snip
> (Tauri-native) still future.


A "snip" mode for the Screenshot tool: instead of the browser's share picker,
dim the whole screen and let the user drag a rectangle to capture just that
highlighted portion → straight into the annotation editor.

**Considerations**
- This is the region-crop piece deferred from #8 (v8.6 shipped full-screen /
  window / tab capture via `getDisplayMedia`, but not region select).
- Web reality: we can't capture arbitrary screen pixels without
  `getDisplayMedia`. The practical path: still call `getDisplayMedia` once to
  get a frame, then overlay a dimmed full-screen canvas and let the user
  drag-select a rectangle to crop from that captured frame. (A true "snip the
  live desktop without a share prompt" only works in the Tauri desktop build
  via a Rust screen-capture command.)
- UX: `Shift`-drag from a corner, show dimensions while dragging, Enter/click
  to confirm, Esc to cancel. Feed the cropped region into the existing
  ScreenshotApp annotation canvas.
- Tauri build: use a native capture command (no permission prompt) + the same
  drag-select overlay for a real Snipping-Tool feel.

---

## 16. Nova OS Mobile — a real phone-OS experience — ✅ SHIPPED in v10.x (iOS-style mobile shell)

Make Nova OS, on a phone, fullscreen and behave like an actual mobile OS
(home screen of app icons, one app fullscreen at a time, status bar, swipe
gestures, app switcher) — instead of the current "best viewed on a larger
screen" notice.

**Verdict: yes, and it should stay in THIS project — not a fork.** Nova OS
already renders a single component tree (`NovaOS.jsx`) that branches on
`deviceMode`; a phone OS is a *third rendering branch* (a new mobile "shell"),
not a parallel codebase. All ~30 apps, Firebase auth/sync, the sound system,
theming, wallpapers, Store, DMs, chess, etc. would be shared. A fork would
mean building and maintaining everything twice forever.

**Groundwork that already exists (the head start)**
- `detectDevice()` returns a `mobile` mode (< 600px), and `effectiveDeviceMode()`
  + the `displayMode` setting can force it. (`src/lib/device.js`)
- `deviceMode==="mobile"` already drives behavior in `NovaOS.jsx`:
  force-maximize windows, compact taskbar, hidden chip labels, the
  centered-apps width cap, mobile-first focus state, etc.
- Input is already Pointer Events everywhere (v5.0 refactor) → touch-ready.
- PWA is already set up: `public/manifest.webmanifest` + `index.html` link →
  installs to the home screen and runs standalone/chromeless. Fullscreen
  plumbing landed in v7.8.
- Apps are self-contained React components that render in any container — they
  don't care whether they're in a draggable window or a fullscreen sheet.

**What the mobile-OS mode actually needs (the work)**
- **A mobile shell** that *replaces* the desktop + window-manager when
  `deviceMode==="mobile"`: a home screen (app-icon grid / pages), a top status
  bar (time, battery, signal-ish), and a bottom gesture/nav bar.
- **Window manager → app stack.** Reuse the existing `wins` state, but each
  open app becomes a fullscreen "screen" you push/pop, not a tiled window.
  Swap the window chrome (title bar, resize handles, snap) for mobile nav.
- **Touch navigation:** home gesture, back, swipe-down for notifications /
  quick settings, an app-switcher (card stack of open apps).
- **Per-app responsive passes at ~390px.** Many apps already flex/scroll fine;
  the dense ones (Store, Chess board, Atmos radar, Paint toolbars) need mobile
  layouts. This is the tedious long-tail, not the hard part.
- **Flip the `MobileNotice`** from "go away" into the actual entry point (or
  make it opt-in / first-run only).

**Honest caveats**
- This is a *big* feature — on the order of the v8.0 UI refresh. Best as its
  own major version (v9.x / v10), built on a branch like v8.0 / v9.0.
- The window-manager → app-stack swap is the interesting architecture; the
  per-app responsive cleanup is the long, unglamorous part.
- A few apps will never be great on a phone (full Paint, Chess on a tiny
  board) — that's fine, just lower priority.
- Plain mobile-browser gestures fight the OS's own edge-swipes; running as an
  installed PWA (standalone) reclaims them, which is why the manifest matters.
- Tauri 2 also has iOS/Android targets, so the *same repo* could one day ship a
  native app store build — but that's a separate, much larger lift (native
  build pipeline, signing, store review) and not required for a great
  installed-PWA phone experience.

---

## 17. Custom domain (e.g. `novaoslabs.com`)

Replace the long `*.vercel.app` URL with a real domain (~$10/yr). Two
motivations: (a) `*.vercel.app` is blocked on most school-managed Chromebooks,
which is where Nova's actual users are; (b) it's a lot to type. A custom
domain on `.com` / `.app` / `.dev` is short, professional, and escapes the
blanket `vercel.app` block.

**Steps when ready**
- Buy at Porkbun / Cloudflare Registrar / Namecheap (avoid GoDaddy).
- Vercel → Project → **Settings → Domains → Add**; paste the DNS records
  Vercel shows at your registrar (typically apex `A → 76.76.21.21`, `www
  CNAME → cname.vercel-dns.com`), or point nameservers to Vercel.
- **Firebase Console → Authentication → Settings → Authorized domains → Add
  the new domain.** Sign-in breaks on the new host otherwise.
- Set the custom domain as primary in Vercel so the old `vercel.app`
  redirects.

**Considerations**
- Codebase needs zero changes — no hardcoded `vercel.app`, manifest paths
  are relative, `authDomain` is an env var pointing at `firebaseapp.com`.
- Recurring (~$10/yr); just don't renew if the project ever goes dormant.
- Won't *guarantee* it's unblocked on managed Chromebooks (a school filter
  could still block any domain), but it escapes the blanket `*.vercel.app`
  rule — which is the relevant cause today.

---

## 18. Sandboxed scripting / real terminal

A real code-execution environment inside Nova OS so users can write scripts
to customize their setup — extend the existing Terminal app and/or add a
Scripts app — with hard guarantees: can't run anything malicious, can't
breach data, can't affect other accounts or the site.

**Yes, this is possible.** The design that gives those guarantees:
- Run user-written JS inside a **Web Worker**. Workers are isolated threads
  with no DOM, no cookies, no access to the parent page's localStorage /
  IndexedDB / Firebase SDK / React tree. They can only communicate via
  `postMessage`. Everything not explicitly exposed is unreachable.
- Expose a curated **`nova.*` API** (e.g. `nova.wallpaper(id)`,
  `nova.notes.add(text)`, `nova.toast(msg)`, `nova.theme.accent(hex)`,
  `nova.onAppOpen(fn)`, …). This API is the *only* thing user code can call,
  so the surface area = the API surface.
- **Execution timeouts:** terminate the worker after N ms per run (e.g.
  3 s); a separate "long-runner" mode requires an explicit user prompt.
  Mitigates infinite loops + CPU spinning.
- **All writes go through the existing data layer** (`updateData` /
  `updateSettings`), which is uid-stamped and already protected by
  Firestore security rules — so a worker physically cannot write to another
  user's docs because the rules reject any uid mismatch.
- A **Scripts app** to save / name / re-run snippets (synced via Firestore
  the same way Notes are).

**What the security model actually guarantees**
- ✅ **Can't breach data** — workers have no Firebase SDK, no cookies, no
  parent storage; only the curated API. The API only writes to the user's
  own uid-stamped docs.
- ✅ **Can't affect other accounts** — Firestore rules already enforce uid
  ownership on every write. A worker calling the API can only write to its
  own account; cross-account writes are rejected at the rules layer.
- ✅ **Can't affect the site / other users' sessions** — workers run in
  isolated threads in the *user's own browser*. Their script can't reach
  anyone else's tab. Even if it crashes or loops, only the worker dies; the
  main page is untouched and we just spawn a new worker.
- ⚠️ *Can* affect the user's **own** account — by design. If their script
  fills their notes with junk, that's recoverable (clear notes, re-run).
- ⚠️ Performance abuse — mitigated by per-run timeouts + termination.
- ⚠️ "Paste this script from a stranger" — same risk as any user-script
  community; the curated API caps the blast radius at "annoying" not
  "dangerous." The Store-style moderation pattern could apply to a future
  script gallery.

**Effort**
- MVP (extend Terminal with `run <code>` that posts to a worker and prints
  the result, plus a tiny `nova.*` API): ~a day.
- Full feature (Scripts app, saved snippets, hooks like `onAppOpen` /
  `onLogin`, autocomplete, in-app `nova.*` docs panel): about a week of
  focused work.

**Best fit:** probably **Supernova** — alongside the Paint rework and the
mobile pass. Medium-size feature; not blocking anything.

---

## 19. File Explorer revamp + apps in folders (v9.1 candidate)

A two-part rework of the Files app, on the same "two-pane Windows-style"
pattern the v9.0 Settings refresh used.

**Part A — Installed apps live in File Explorer**
- New virtual **Applications** location showing every installed app as a
  launchable icon — double-click → `openApp(app.id)`.
- Built-in apps from the `APPS` constant + community apps the user has
  installed (`data.installedApps` + the live `commApps` subscription added
  in v9.0). No new data model, no Firestore changes.
- Optionally grouped by category using `STORE_CATALOG` categories
  (`Applications/Games/`, `Applications/Productivity/`, etc.) so it feels
  like a real "Program Files."
- Reuse existing app context-menu actions (Open / Pin to taskbar / Add to
  desktop).

**Part B — Windows-style UI revamp (Nova-flavored)**
- **Left rail** with monochrome glass glyphs: Home / My Files / Documents
  / Tasks / Pictures / **Applications** / (maybe This PC).
- **Top bar:** back / forward / up navigation, breadcrumb path
  ("Home › Applications › Games"), search input, view toggle (Large
  icons / List).
- **Right pane:** icon grid (Win11-style tiles) or list rows depending on
  view; per-section empty states.
- Uses theme tokens (`var(--nv-surface)`, etc.) so it adapts to glass
  on/off like Settings does.

**Effort:** ~1–2 days of focused work. Sized as a clean v9.1 release.

**Worth noting while we're here:** if we ever wire drag-and-drop from File
Explorer into Chat / DMs (IDEAS #12), the revamp is the right moment to
make items first-class draggable. Not required for v9.1, just an alignment
point.

---

## 20. Photos — real editor + better browsing — 🚧 BUILT in v9.7 (feature/v9.7)

Shipped on the branch: two-pane sidebar (Library / Recently Added / Albums),
a canvas editor (crop + aspect presets, rotate, flip, brightness / contrast /
saturation / warmth sliders, filter presets, auto-enhance, save-as-new-copy),
and session albums. "Memories / On this day" + slideshow music deferred.

Lift the Photos app from "gallery viewer" to a genuine competitor to the
Windows 11 Photos app / Apple Photos.

**Editor (the big addition)**
- Crop (with aspect-ratio presets), rotate, flip.
- One-tap **Auto enhance** (canvas filters).
- Sliders for brightness, contrast, saturation, warmth.
- A handful of **filters / presets** (Mono, Sepia, Vivid, Noir, Fade) —
  cheap to implement via canvas filter strings.
- Save edits as a new copy in Photos (preserve the original).

**Better browsing**
- Sidebar (mirroring File Explorer): Library / Albums / Recently Added.
- **Albums** — user-created groupings of photos.
- A "Memories" or "On this day" view if time is left.
- Slideshow mode (fullscreen, ken-burns subtle pan, music optional).

**Considerations**
- The non-editor canvas patterns are already proven in PaintApp + the
  Screenshot annotation editor — reuse them.
- Storage: avoid re-encoding originals every edit; store the edit pipeline
  (an array of operations) separately and apply on render, OR just save
  the JPEG output as a new photo (simpler; current Photos store already
  handles base64).
- File-size: cap exports at ~1600px JPEG quality 0.85 so multi-megabyte
  iPhone photos don't bloat user docs.

---

## 21. Real browser tabs via Tauri webview — ✅ SHIPPED in v10.0

The Browser app currently iframes pages, which is why so many store
entries are flagged `newTab: true` — the big sites set
`X-Frame-Options: DENY` and won't load in an iframe at all. On the
**Tauri desktop build**, Tauri 2 supports spawning real webview windows /
embedded webviews that don't have iframe restrictions. That unlocks a real
"open this in Nova's browser" experience for every site.

**Plan**
- Detect the Tauri environment (existing `isTauri()` helper).
- On Tauri: open a Tauri **WebviewWindow** (or a child webview embedded in
  the Browser window) targeted at the URL. Real cookies, real sessions,
  real history, no `X-Frame-Options` problems.
- On web: keep the existing iframe behaviour. Be honest in the UI that
  full-fidelity browsing is a desktop feature.
- Browser app gains: **tabs**, **back/forward** (already partially there),
  **reload**, **address bar**, **history**, **bookmarks** sync via
  Firestore. With real webviews this becomes a credible browser.
- Drop `newTab: true` flags for sites that now load inside Nova on
  desktop — but keep them on web.

**Considerations**
- Tauri 2 webview APIs are still maturing; check current capabilities.
- Permission model — must respect the user's OS-level security; Tauri
  isolation between webviews matters.
- Add a small "Open externally" button so the user can always escape to
  their system browser.

---

## 22. Calculator — genuine competitor to Windows 11 Calculator — ✅ SHIPPED in v9.5

The current Calculator is solid for the basics (and got the hold-backspace
fix in v8.3). v9.x can lift it to feature parity with Windows 11's
Calculator app.

**Modes (tabs / segmented control along the top)**
- **Standard** — what exists today.
- **Scientific** — sin/cos/tan, log/ln, x^y, factorial, π/e, parentheses,
  degree/radian toggle.
- **Programmer** — hex/dec/oct/bin views, bitwise ops, shift, byte/word size.
- **Date** — date difference, date + days.
- **Converter** — currency (offline rates table), length, weight, volume,
  temperature, area, speed, time, energy, power, pressure, angle, data.

**Polish**
- **History rail** showing recent calculations (collapsible) — click to
  re-run. Persist in user data so it syncs across devices.
- Keyboard mappings for the new operators.
- Copy/paste integration with the OS clipboard.

**Considerations**
- All math is local — no external services needed.
- Currency rates table can be a static JSON (acceptable lag) or fetched
  once a day from a free FX API (with offline fallback).
- Layout shouldn't bloat the window — the segmented mode picker keeps the
  per-mode UI focused.

---

## 23. Slides — a free, exportable PowerPoint competitor — 🚧 BUILT (v1) in v9.7 (feature/v9.7)

Shipped a v1 on the branch: deck home, editor (slide rail + 16:9 canvas +
properties panel), text / rect / ellipse / line / image elements with
drag-move + corner-resize, six themes, presenter fullscreen mode (arrow
keys), decks saved to `data.slides` on the user doc, and **.pptx export**
via lazy-loaded `pptxgenjs`. Deferred: PDF export, speaker notes, drag-to-
reorder beyond the ↑↓ buttons, more templates.

A new presentation app: build slide decks, edit text/images/shapes per
slide, present in fullscreen, and **export to a real `.pptx`** file that
opens in PowerPoint / Keynote / Google Slides.

**Editor**
- Slide list rail (left) + canvas (center) + properties panel (right).
- Per-slide content: text boxes, images, shapes (rect, ellipse, line,
  arrow), bulleted lists.
- Themes / templates (a handful — Modern, Mono, Pastel, Bold, etc.).
- Reorder slides by drag.

**Presenter mode**
- Fullscreen one-slide-per-screen, arrow keys / clicker to advance.
- Speaker-notes view (if there's a second monitor on Tauri desktop) —
  desktop-only refinement.

**Export (the differentiator)**
- **PPTX** export via the `pptxgenjs` library (well-maintained, runs in
  the browser, no server). Real Office-compatible file that opens in
  PowerPoint and Google Slides cleanly.
- Also export to **PDF** (via the same canvas-to-PDF approach the
  Screenshot app uses for printable exports, or `jsPDF`).
- Save the deck itself in Firestore (`nova_slides`?) so it syncs across
  devices — same pattern as Notes.

**Considerations**
- `pptxgenjs` is ~200 KB minified — meaningful but acceptable; lazy-load
  the export path so it only loads when the user actually clicks Export.
- Image handling: store at modest sizes (max ~1200px) in the deck doc;
  exports embed them at full resolution.
- This is a **big** feature — comparable to the Paint rework. Sized for
  a major release of its own (maybe Supernova alongside Paint and the
  mobile pass) rather than a v9.x point release.

---

## 24. Nova OS as a real bootable Linux distribution

**The endgame** — the most ambitious thing on this whole list. Parked
explicitly for after everything else (post-Supernova, post v9.x polish).
A summer-project-or-longer effort to take Nova from "browser-based OS" to
*an actual OS you boot from a USB stick or run as a VM*, with Nova as the
entire desktop environment on top of a minimal Linux base.

This effectively combines and supersedes IDEAS #2 (Wi-Fi + system sound)
and IDEAS #21 (Tauri webview tabs) — once Nova owns the underlying OS,
both of those become trivially solvable.

**What "real OS" means here**
- **Bootable**: ships as a `.iso` that works in a VM (VirtualBox / QEMU /
  VMware) and writes to a USB stick (via Ventoy / Rufus / dd) for direct
  boot on real hardware.
- **Real shutdown / power settings**: a system power menu with Shut
  down / Restart / Sleep / Sign out — the actual Windows-style options
  backed by real `systemctl` calls. Lock screen on resume. Power-button
  capture so the lid doesn't kill the machine ungracefully.
- **Real app installer**: a Store where "Install" actually installs.
  Hooks into the underlying package manager (Flatpak is the best fit —
  sandboxed, cross-distro, no root needed) so the user can install
  Firefox, VLC, GIMP, Steam, etc. directly from Nova's Store and have
  them appear as real launchable entries (with real launcher icons
  alongside Nova's built-in apps).
- **Real browser, no iframe limits**: when Nova owns the desktop, the
  Browser app can spawn actual Firefox/Chromium windows (or embed real
  webviews) — no `X-Frame-Options` problems, real cookies/sessions/
  history. Sites that today are stuck on `newTab: true` finally work
  inside Nova.

**Architecture (the realistic shape)**
- **Base distro:** Debian-minimal or Arch (broad hardware support) — not
  Alpine, because the hardware story matters once it's on real laptops.
- **Display server:** Wayland session.
- **Nova as the desktop environment:** Tauri build of Nova OS launched
  at session start as the *only* GUI app — no GNOME/KDE underneath.
  Replaces the traditional DE entirely.
- **OS bridge layer:** new Tauri commands (Rust) for shutdown / restart /
  sleep / lock, network listing + connect, audio device + volume,
  brightness, battery, package install/uninstall via Flatpak.
- **Settings → real settings:** the existing v9.0 Settings panes
  (Network / Sound / Display / Account) get their stubs replaced with
  the genuine system-level controls via those Tauri commands.

**Honest prerequisites (do these first, independent of Linux work)**
- **Offline mode / graceful Firebase degradation.** A bootable USB run
  on a plane / school network / fresh machine has no internet on boot.
  Nova OS today expects Firebase to be reachable. The UI needs to load
  + work locally; sync/auth degrade gracefully when offline.
- **Bundled assets.** The `dist/` build needs to be packed into the
  ISO so the OS loads without ever fetching from Vercel.
- **Polish the Tauri build.** Today it's a downloadable wrapper around
  the web app. For a Linux DE it needs to be the *session* — survives a
  crash gracefully, can be relaunched without losing state, etc.

**Build phases (one project, three milestones — NOT three alternatives)**

This is a single goal — get Nova running as the OS on real laptop hardware
— built in three escalating phases. Each phase is shippable but only
Phase 2 is a usable daily-driver. Phase 1 alone is a demo / kiosk
appliance, not a real OS.

1. **Phase 1 — fast VM kiosk (~4–6 weeks).** Minimal Linux + Chromium
   kiosk pointed at a locally-bundled Nova OS. Goal is to **prove the
   pipeline works**: ISO boots, Nova loads, Wi-Fi reaches Firebase, the
   build artifact is a real `.iso` that runs in VirtualBox. **Not** a
   daily-driver — power button still kills the machine, Wi-Fi has to be
   set up outside Nova's UI, no real system controls. Think of this as
   "verify the foundation," not "final product."
2. **Phase 2 — Nova as the daily-driver desktop environment
   (~2–3 months on top of Phase 1).** Tauri build replaces the Linux
   desktop session. *This* is the line where you can actually use the
   laptop:
   - Real power menu (Shut down / Restart / Sleep / Lock — graceful
     shutdown, no more hard power-off).
   - Real Wi-Fi management from inside Nova's Settings → Network.
   - Real system volume from the taskbar quick-settings.
   - Brightness + battery actually wired up.
   - Real Store that installs Flatpak apps (Firefox, VLC, etc.).
   - Browser app uses real webviews — no iframe limits.
3. **Phase 3 — polish into a distributable distro (open-ended).**
   Custom installer, Plymouth boot splash, hardware QA across a couple
   of laptop models, optional code signing, release on a website.
   ChromeOS-style polish. Months/years of work if you want it that good;
   easy to defer until you've actually used Phase 2 daily for a while.

**For your goal — "run Nova on my old laptop as my actual OS" — Phase 2
is the target. Phase 1 is the stepping stone we build on the way there.**

**Build environment + what you supply**

Nothing Linux-specific. The build tool (`live-build` / `archiso`) pulls
the base Linux packages from official mirrors at build time — you don't
host a Linux ISO, you don't pick a kernel, the build script handles it.

What you'd need on your end:
- **VirtualBox or VMware Player** (free) — to boot the ISO in a VM.
- **WSL2** (optional, ~10 min one-time install) — for fast local ISO
  builds. Skipping this is fine; the GitHub Actions CI workflow can
  build the ISO on every tag push and you download it from the release
  page. Slower iteration (~5–10 min per build) but zero local lift.

That's it. No Linux setup, no kernel choices, no driver wrangling on
your side. The configs in the repo do all the assembly.

**Workload split (honest)**
- ~**80 % on me** (Claude): writing the build configs, the Plymouth
  splash theme, the Rust system-bridge for Phase 2, the JS glue
  threading real settings into Nova's existing Settings panes, the CI
  workflow, the docs.
- ~**20 % on you**: booting the ISO in a VM, telling me what's broken,
  taste calls on branding, optional WSL2 setup, eventually testing on
  the real old laptop.

The actual bottleneck isn't typing, it's the **test cycle**: ISO build
+ VM boot is minutes, not seconds. Pace is "evening sessions" rather
than "lunch break" iteration. That's the real human cost.

**Caveats**
- Hardware drivers are Linux's eternal headache (Wi-Fi chips, GPUs,
  laptop function keys). Stick to a major upstream like Debian/Ubuntu
  rather than ultra-minimal bases — inherit their hardware stack.
- USB persistence (saving user state across boots from a live USB) is
  its own feature — decide upfront, probably for Phase 2.
- VM target first, real hardware second. VM removes the driver
  variable entirely while you build the rest.

**Status:** explicitly deferred. The kind of thing to spend a summer on
once v9.x / Supernova have landed and Nova OS proper is stable enough
to stand on its own.

---

## 25. Music — shuffle, repeat, queue — ✅ SHIPPED in v9.5

Shipped with a play-queue separate from library order, shuffle that
reshuffles the unplayed tail (current track stays put), three-state
repeat (off / all / one), and a Queue view with reorder/remove/jump.

---

## 26. Notes — light markdown shortcuts — ✅ SHIPPED in v9.5

Shipped with a preview toggle, full markdown toolbar (H1/H2/H3, bold,
italic, code, lists, quote, link, hr), Ctrl+B/I/K keyboard shortcuts,
and a <200-line custom renderer (no library dep).

---

## 27. Achievements / first-week badges

Gentle, optional gamification. Reuse the existing notification toast
system as the "you earned this!" surface.

- A small set of unlock-able badges: "Welcome to Nova" (first sign-in),
  "Customizer" (changed wallpaper + accent + glass), "Communicator"
  (sent 10 chat messages), "Creator" (made a note + a task), "Gamer"
  (played each game once), "Mod" (auto-granted to mods), etc.
- Badges live on the user data doc (`data.badges: [...]`).
- A new "Achievements" pane in Profile (or a small modal launched from
  the start menu) shows earned + locked badges.
- On unlock: a celebratory toast + the achievement sound from v9.0's
  sound engine.

**Considerations**
- Keep it gentle — opt-out toggle in Settings → Display.
- No leaderboards / public badges (this is personal flair, not social
  pressure).

---

## 28. High-score leaderboards for the games — ✅ SHIPPED (v9.8 start → ALL games in v10.10)

Shipped the `nova_scores` infrastructure + leaderboards for Minesweeper
(best time) and Flappy (high score) in v9.8. Wiring the same `submitScore`/
`fetchLeaderboard` helpers into the other games (Snake, Tetris, 2048,
Invaders, Pac-Man) is now a trivial follow-up whenever wanted.

Snake, Tetris, 2048, Space Invaders, Pac-Man, Flappy Bird, Minesweeper
(fastest-time) — each has a clear scoring model but no public leaderboard.

- A `nova_scores/<gameId>` collection in Firestore. Each user keeps one
  doc per game with their personal best; the leaderboard is a single
  query for the top 10 (ordered by score desc).
- A "Leaderboard" button in each game's UI opens a small modal showing
  global top 10 + your personal best + your rank.
- Game-end flow: if the new score beats personal best, write it; if it
  also reaches top 10, show "🎉 You're on the board!"

**Considerations**
- Anti-cheat is real: scores write from the client, so a determined user
  can submit anything. Mitigations:
  - Soft validation (a Minesweeper "3-second easy win" is implausible —
    flag for mod review).
  - Cap submissions to plausible upper bounds in Firestore rules.
  - Accept that this is a low-stakes leaderboard, not a competitive one.
- Rules pattern mirrors `nova_ratings` (uid-stamped, owner-only writes).

---

## 29. Pomodoro / focus-timer widget — ✅ SHIPPED in v9.5

Shipped as a desktop widget with the classic 25/5/15 cycle (4 focus
rounds with short breaks, then a long break). Wall-clock-anchored
countdown stays accurate under tab throttling. Cycle dots show
progress; soft chime fires at every phase transition. Future polish
(custom durations, DND mode) deferred.

---

## 30. Multiple desktops + Linux-style window overview — 🚧 PARTIAL (virtual desktops + keyboard switching shipped v10.x; Exposé-style overview still open)

A real virtual-desktops system plus a Mission-Control / GNOME Activities
style overview. This turns Nova OS from "one big desktop" into a
multi-context workspace.

**Multiple desktops**
- A new dedicated key (e.g., **Super / Win key**, or **Alt + Tab**
  variant) zooms the current desktop out, blurs the background, and
  shrinks it to a tile alongside thumbnails of every other desktop you
  have. Smooth transition animation.
- Arrow keys or mouse navigate between desktops; **Enter** activates the
  selected one with a "zoom into" animation.
- Each desktop has its own:
  - Set of open windows (windows can be moved between desktops via
    drag-to-edge or right-click → "Move to Desktop 2").
  - Optional separate wallpaper.
  - Same shared apps + data (it's not multiple sessions — just multiple
    workspace contexts).
- The Start menu / taskbar shows windows from the current desktop only;
  a small indicator in the taskbar shows which desktop you're on.

**Window overview (within a single desktop)**
- A separate key (e.g., **F3** or **3-finger swipe up**) zooms the
  current desktop out and arranges every open window as a tile grid
  with a blurred background. Click a window thumbnail to focus it;
  press Enter to focus the highlighted one. Smooth zoom transition.
- Pairs with the existing snap-layout work (v8.5 / Alt+Arrow) — pick a
  window from the overview, then snap it into a quadrant.

**Considerations**
- Storage: `data.desktops: [{id, wallpaper, windowIds: [...]}, ...]` +
  `data.activeDesktop`. Windows already have ids; add a `desktopId`
  field to each window.
- This is a Supernova-sized feature — touches the core window manager,
  the taskbar render, and the desktop layout simultaneously.
- The animations are doable in CSS (transform: scale + transition) +
  a slide between desktops; nothing exotic required.

---

## 31. AI command bar — function-calling Nova AI

The single biggest "Nova OS feels intelligent" upgrade. Turn Nova AI
from a chat into an *agent* that can actually act on the OS.

**What it does**
- A floating command bar (Cmd/Ctrl + J, or a dedicated taskbar button)
  accepts natural-language commands:
  - "Open Notes and write down 'pick up milk'"
  - "DM @alex saying I'll be late"
  - "Set wallpaper to Ember"
  - "What's the weather in Brooklyn?"
  - "Summarize my notes from this week"
  - "Play the next track"
  - "Take a screenshot"
- The model gets a curated **toolbox** of safe Nova OS operations and
  decides which to call (often multiple in sequence).

**Architecture (Anthropic SDK + Gemini both support tool use)**
- Define a small set of tools matching Nova's existing actions: `openApp`,
  `createNote`, `sendDm`, `setWallpaper`, `playSound`, `searchSpotlight`,
  `getWeather`, `setVolume`, etc. Each tool has a JSON schema and a JS
  handler that calls the corresponding Nova function.
- The streamed conversation interleaves tool calls and natural-language
  responses — UI shows each action as it executes ("Opening Notes…",
  "Creating note 'pick up milk'…", "Done.").
- Every action is **undoable** for ~10 seconds via a toast ("Undo last
  AI action"). Critical for trust.
- Safety: destructive operations (delete note, send DM) require an
  explicit confirm step before execution.

**Considerations**
- Biggest UX challenge is *latency masking* — make tool calls feel
  instant via optimistic local actions, only roll back if the AI
  contradicts.
- Extends the existing v6.0 AI integration / v7.6 Gemini provider work;
  same BYOK pattern stays.
- Sized for Supernova alongside Paint + the mobile pass.

---

## 32. Backup / Export your profile

One-click export of your entire Nova account as a single JSON file.
Restore on any account (yours or a fresh one) to bring everything back.

**What's exported**
- Notes, tasks, folders (the whole `data.folders` / `data.notes` / etc.).
- Settings (accent, wallpaper, glass, displayMode, etc.).
- Custom wallpaper image (base64).
- Installed app list (`installedApps`).
- Avatar image (base64).
- Pinned-to-taskbar / hidden-from-desktop arrays.

**What's NOT exported (and why)**
- Chat messages / DMs — those live in shared collections and aren't
  the user's to export.
- Community-app submissions — same reason.
- Photos (session-only blob URLs).
- Firebase Auth credentials.

**Usage**
- Settings → Account → "Export profile" button. Downloads
  `nova-profile-<username>-<date>.json`.
- Settings → Account → "Import profile" button. Picks a JSON, validates
  the schema (graceful on missing fields), shows a "this will overwrite
  X notes, Y tasks…" confirmation, then writes the merged state.

**Considerations**
- Doubles as cloud-independence insurance: even if Firebase
  goes away one day, your data is yours.
- Small feature, *huge* trust signal — "your stuff is portable."
- Implementation is mostly serialize/deserialize + a confirm modal;
  ~200 lines including the import UI.

---

## How to add to this

Edit this file directly, or just mention an idea in conversation and ask
me to "drop it into IDEAS.md" — I'll update it.

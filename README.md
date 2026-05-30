# Nova OS - Supernova Edition (v10.4)

A browser-based operating system, built with React + Vite, backed by Firebase,
and shippable four ways: boot it in a tab, **install it on your phone** (PWA),
get the **native Android app** (free APK), or run it as a native desktop app
with Tauri. Windows, a taskbar, a start menu, real multitasking, a shelf of
built-in apps, cross-device accounts, an AI command bar, virtual desktops, a
real tabbed browser, a sandboxed shell - and a full, polished iOS-style mobile
edition.

v10.1 delivered the Mobile edition, v10.2 polished it, v10.3 shipped a real
native Android app (free APK on GitHub Releases, reliable haptics), and **v10.4
deepens the native app** with immersive fullscreen, a true in-app browser, real
notifications, and smoother on-device motion. Still on the long-term horizon: a
bootable Linux distribution.

---

## What's new in 10.4 (native app polish)

- **Working fullscreen / immersive** - the Control Center fullscreen button now
  hides the phone's system UI (Android immersive mode); Nova OS also goes
  immersive on launch so it owns the whole screen.
- **True in-app browser** - external links and the Browser app's "Open
  externally" open a real Chrome Custom Tab (Capacitor Browser) in the app.
- **Real notifications** - Nova OS notifications also raise actual Android system
  notifications.
- **Hardware back button** - routes into the OS (close the open overlay/app, then
  Home); at the Home screen it backgrounds the app instead of quitting.
- **Close Nova OS** - a quit button in Settings (native app only).
- **Smoother animations on device** - dropped the WebView-janky backdrop blur and
  the animated wallpaper inside the native app.

---

## What's new in 10.3 (native Android app)

- **Native Android app** - Nova OS wrapped with [Capacitor](https://capacitorjs.com/)
  and shipped as a **free APK** attached to each GitHub Release. Install it from
  the release page or the in-app **Download Android app** button (Control Center,
  on Android). No Google Play account or fee required.
- **Reliable haptics** - the native app uses the real OS haptic engine, so the
  tactile feedback that the web Vibration API couldn't deliver now works
  properly (taps, drags, toggles).
- **Automated APK builds** - pushing a `vX.Y.Z` tag builds the APK on CI
  (`android-release.yml`) and attaches `nova-os.apk` to the same release as the
  desktop installers. No local Android SDK needed.
- The PWA, desktop, and web builds are all unchanged - this is purely additive.

---

## What's new in 10.2 (mobile polish)

- **App folders** - long-press to enter jiggle mode, tap "Folder" to make one,
  then drag apps onto it. Open a folder to launch, rename, or remove apps; it
  dissolves back to Home when emptied.
- **Lock screen** - a clock/date wake screen on launch (swipe up to enter);
  re-lockable from Control Center.
- **Pull-down Notifications** - swipe down from the top-left for the Notification
  Center (top-right still opens Control Center, iOS-style). Tap a notification to
  jump to its app, swipe/clear to dismiss.
- **Landscape + tablet layout** - the springboard now scales its columns and
  rows to the screen, and a phone stays in the mobile UI when rotated to
  landscape instead of flipping to the desktop layout.
- **Haptics** - tactile feedback is wired throughout (taps, drags, toggles).
  Web vibration is unreliable across devices, so haptics become fully reliable
  in v10.3 via the native layer.
- **Sturdier app loading** - a failed app-code chunk now retries and self-heals
  after a deploy instead of dead-ending.

---

## What's new in 10.1

- **Nova OS Mobile** - a complete iOS-style touch edition that takes over
  automatically on phones (and via Settings -> Display -> Mobile). It keeps
  Nova's personality while feeling clean, fast, and fully animated:
  - **Springboard** home screen with paginated app pages, a 4-app dock, and a
    widget row.
  - **App Library** (swipe up) with search, and a **Pixel-style App Switcher**
    (hold the gesture bar) showing live, shrunken previews of running apps.
  - **Home-screen customization** - long-press to enter iOS-style jiggle mode,
    then drag to reorder, drop onto the dock to pin, tap "-" to remove, and
    "+ Add apps" to bring hidden ones back. Layout syncs to your account.
  - **Control Center** (swipe down) with controls that actually work: sound /
    silent, Liquid Glass, live wallpaper, fullscreen, brightness (software
    dimmer), volume, flashlight, rotation lock, reload, plus live network and
    battery status.
  - Native touch gestures throughout, safe-area / notch handling, and a crash
    boundary so a single misbehaving app can never black-screen the shell.
- **Installable PWA** - Nova OS is now a Progressive Web App. On Android Chrome
  use the in-app "Install Nova OS" button (or the browser menu); on iPhone use
  Share -> Add to Home Screen. It installs with its own icon, launches
  fullscreen, works offline, and updates the moment the web deploy updates. This
  is also the foundation for a Google Play Store listing (see MOBILE-APP.md).

---

## Supernova foundation (v10.0)

- **AI command bar** (Ctrl/Cmd+J, or the "Ask Nova" taskbar button) - type
  plain English and Nova turns it into real OS actions. BYOK (Claude / ChatGPT /
  Gemini); requests go browser -> provider, never through a server.
- **Virtual desktops + Task View** - multiple workspaces that slide between each
  other; windows stay alive across desktops.
- **Real browser tabs** - on the Tauri desktop build each tab is a real native
  webview (no iframe embedding limits); on the web build, tabs use iframes.
- **Sandboxed terminal** - a genuine shell over an isolated virtual filesystem.
  Fully sandboxed: it never touches your real machine.
- **Paint, reworked** - brush, eraser, shapes, fill, eyedropper, opacity, full
  undo/redo, import / save PNG / set-as-wallpaper.
- **Motion polish** - a cohesive ease-out-quint animation language across the
  OS. Honors prefers-reduced-motion.
- **Signature wallpapers** - Supernova (default: a cool blue/cyan stellar glow)
  and Nebula.

---

## Built-in apps

Notes, Tasks, Files, Paint, Browser, Calculator, Clock, Calendar, Music, Photos
(with a Canva-style editor), Slides, PDF Viewer, Screenshot, Weather (Atmos),
Terminal, Settings, Store, Profile, Chat (DMs + Discord-style servers), and Nova
AI (BYOK) - plus games: Snake, 2048, Minesweeper, Wordle, Tetris, Tic-Tac-Toe,
Pong, Flappy Bird, Space Invaders, Pac-Man, Chess.

---

## Tech stack

- **React 18 + Vite** - UI and build.
- **Firebase** - Auth + Firestore (accounts, chat, servers, leaderboards). Bring
  your own Firebase project (src/firebase.js).
- **PWA** - web app manifest + a network-first service worker (public/sw.js)
  make it installable and offline-capable. The service worker is web-only and is
  never registered inside the Tauri desktop build.
- **Tauri 2** - optional native desktop builds (macOS / Windows / Linux), with
  native multi-webview browser tabs (the "unstable" feature).
- **BYOK Nova AI** - Claude, ChatGPT, or Gemini via your own API key, stored
  locally. No keys are bundled or transmitted to any Nova server.

---

## Run it

### Web (development)
```bash
npm install
npm run dev          # http://localhost:5173
```

### Web (production build)
```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

### Install on a phone
- **Android - native app (recommended):** download `nova-os.apk` from the latest
  GitHub Release (or the in-app **Download Android app** button in Control
  Center) and install it. Gets you reliable native haptics.
- **Android / iPhone - PWA:** open the deployed (HTTPS) URL and install it from
  the browser. Android (Chrome): Control Center -> "Install Nova OS", or menu ->
  "Install app". iPhone (Safari): Share -> "Add to Home Screen".

See MOBILE-APP.md for the full Capacitor / APK build + distribution guide.

### Desktop (Tauri)
Requires the Rust toolchain plus the Tauri prerequisites for your OS.
```bash
npm run tauri dev    # run the native desktop app in dev
npm run tauri build  # produce installers / binaries
```

### Tests
```bash
npm run test         # vitest (watch)
npm run test:run     # vitest (single run)
```

---

## Roadmap

1. **Nova OS Mobile** - shipped in 10.1, polished in 10.2 (touch-first phone
   edition + installable PWA, app folders, lock screen, notifications, landscape).
2. **Native Android app** - shipped in 10.3 (Capacitor + free APK on GitHub
   Releases, reliable haptics). Publishing to the Google Play Store later is an
   optional, additive step (one-time $25); see MOBILE-APP.md.
3. **Nova Linux** - a bootable Linux distribution for PC/laptop.

---

## Notes

- The terminal is a sandbox - its filesystem is virtual and never touches the
  host machine, even on the desktop build.
- The native browser webview always paints above the DOM, so it hides whenever
  the Browser isn't the focused window (a "click to resume" placeholder shows in
  its place) - this keeps web pages from covering the rest of the OS.
- Keep your Firebase service-account credentials out of the repo.

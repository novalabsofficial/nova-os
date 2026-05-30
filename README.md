# Nova OS - Supernova Edition (v10.1)

A browser-based operating system, built with React + Vite, backed by Firebase,
and shippable three ways: boot it in a tab, **install it on your phone** as an
app, or run it as a native desktop app with Tauri. Windows, a taskbar, a start
menu, real multitasking, a shelf of built-in apps, cross-device accounts, an AI
command bar, virtual desktops, a real tabbed browser, a sandboxed shell - and
now a full iOS-style mobile edition.

v10.0 "Supernova" was the foundation of the next era; **v10.1 delivers the
Mobile edition** that builds on it. Still ahead: a future bootable Linux
distribution.

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

### Install on a phone (PWA)
Open the deployed (HTTPS) URL on your phone:
- **Android (Chrome):** swipe down for Control Center -> "Install Nova OS", or
  the Chrome menu -> "Install app".
- **iPhone (Safari):** Share -> "Add to Home Screen".

See MOBILE-APP.md for the full install guide and the Google Play Store (TWA)
publishing recipe.

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

1. **Nova OS Mobile** - shipped in 10.1 (touch-first phone edition + installable
   PWA).
2. **Google Play Store** - publish the PWA as a TWA (MOBILE-APP.md).
3. **Native capabilities** - wrap with Capacitor for real device hardware
   (flashlight, brightness) and a true in-app browser.
4. **Nova Linux** - a bootable Linux distribution for PC/laptop.

---

## Notes

- The terminal is a sandbox - its filesystem is virtual and never touches the
  host machine, even on the desktop build.
- The native browser webview always paints above the DOM, so it hides whenever
  the Browser isn't the focused window (a "click to resume" placeholder shows in
  its place) - this keeps web pages from covering the rest of the OS.
- Keep your Firebase service-account credentials out of the repo.

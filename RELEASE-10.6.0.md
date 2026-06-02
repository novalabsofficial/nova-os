# Nova OS v10.6

A browser-based operating system — windows, a taskbar, a start menu, real
multitasking, a shelf of built-in apps, cross-device accounts, and a full
iOS-style mobile edition. Run it in a browser tab, install it as a PWA, grab the
free Android APK, or install the native desktop app.

10.6 adds **Atlas** (a real maps app), fixes a pile of mobile + desktop bugs, and
gives several games proper touch controls.

---

## What's new in 10.6

### 🗺️ Atlas — a maps app (new)
A real, interactive map — no API key, no billing:
- **Pan / zoom** map (Leaflet + OpenStreetMap), works great on touch and desktop.
- **Search** places & addresses with a results list, fly-to, and a **detail card**
  (category, address, opening hours, phone, website, plus a Wikipedia summary &
  photo when available). **Tap the map** to drop a pin and reverse-geocode it.
- **Directions** with **live autocomplete** on the start & destination, **multiple
  alternative routes** drawn at once (fastest highlighted, others tap-to-switch),
  and each route's **distance + estimated drive time**.
- A **📍 My location** button. *(Drive-time estimates are free-flow — they don't
  include live traffic, which no keyless provider offers.)*

### 📱 Mobile
- **Touch controls for games** — 2048 (swipe to move tiles), Snake & Pac-Man
  (swipe to steer), and Space Invaders (on-screen move/fire buttons). They were
  keyboard-only and unplayable on a phone before.
- **Notes** — fully usable on mobile now: a master-detail layout (list → tap a
  note → editor with a back button) so the editor is reachable and the new-note
  button isn't cut off. Edits also **save when the app is backgrounded/closed**,
  fixing lost notes on mobile.
- **Tasks** — master-detail layout so task titles get the full width instead of
  being clipped to a few characters by the sidebar.

### 🖥️ Desktop & cross-platform fixes
- **Taskbar** no longer overlaps the Search/clock clusters on small screens — the
  app row now scrolls within the available space when crowded.
- **Minesweeper** — the 🚩 flag is visible again.
- **Chess** — white pieces render correctly (they were showing dark on Windows).
- **Snake** — new **Slow / Normal / Fast** speed setting (all devices).

### 🟩 Infinite Wordle
A **Daily / Infinite** toggle — Infinite draws endless random words with a *New
word* button, alongside the once-a-day puzzle.

---

## Downloads

Grab the file for your platform from the **Assets** list on this release:

| Platform | File |
| --- | --- |
| Windows | `...x64-setup.exe` (installer) or `...x64_en-US.msi` |
| macOS (Apple Silicon) | `...aarch64.dmg` |
| macOS (Intel) | `...x64.dmg` |
| Linux | `...amd64.AppImage` or `...amd64.deb` |
| Android | `nova-os.apk` |

> **No install, no warnings:** you can also just open Nova OS in a browser, or
> install it as a PWA — that path never triggers the security prompts below.

---

## Installing & getting past the security warnings

The desktop installers and the Android APK are **not signed with a paid publisher
certificate**, so your OS shows an "unknown publisher" caution the first time you
open them. This is expected for an independent app — it's a *"we don't recognize
who made this"* notice, **not** a virus detection. You clear it once per install.

### 🪟 Windows — Microsoft Defender SmartScreen
1. If your browser warns on download, choose **Keep** → **Keep anyway**.
2. Running it shows a blue **"Windows protected your PC"** box.
3. Click **More info**, then **Run anyway**.

*If Defender quarantines it (rare):* **Windows Security → Virus & threat
protection → Protection history** → **Restore / Allow on device**, then re-run.

### 🍎 macOS — Gatekeeper
1. Open the `.dmg` and drag **Nova OS** into Applications.
2. First launch: **right-click (or Control-click) the app → Open → Open** (a plain
   double-click won't show the override). Or **System Settings → Privacy &
   Security → Open Anyway**.

*If you get "Nova OS is damaged" on Apple Silicon* (the download quarantine flag),
open **Terminal** and run, then reopen:
```bash
xattr -cr "/Applications/Nova OS.app"
```

### 🐧 Linux
- **AppImage:** `chmod +x "Nova OS_10.6.0_amd64.AppImage"` then run it. (If it
  needs FUSE: `sudo apt install libfuse2`.)
- **Debian/Ubuntu (.deb):** `sudo apt install ./nova-os_10.6.0_amd64.deb`

### 🤖 Android — "unknown sources" + Play Protect
1. Download `nova-os.apk` and tap it; Android warns the source isn't allowed.
2. Tap **Settings** on the prompt → enable **Allow from this source** → back →
   **Install**.
3. If **Play Protect** appears, tap **More details → Install anyway**.
4. Updates install in place — every release is signed with the same key.

---

## Is it safe?

Yes. The warnings come from the apps not carrying a paid code-signing certificate
(Windows Authenticode / Apple Developer ID), which the OS uses to show a known
publisher name. The project is open source — you can review the code and build
the installers yourself with `npm run tauri build`. Your data lives in your own
account; no keys are bundled or sent to any Nova server.

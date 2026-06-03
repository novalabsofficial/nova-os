# Nova OS v10.10

A browser-based operating system — windows, a taskbar, a start menu, real
multitasking, a shelf of built-in apps, cross-device accounts, and a full
iOS-style mobile edition. Run it in a browser tab, install it as a PWA, grab the
free Android APK, or install the native desktop app.

10.10 is a games & media drop: new apps, a Chrome-style Browser, and
leaderboards on every game.

---

## What's new in 10.10

### 🌐 Browser — session restore
- Your open tabs now **persist when you close and reopen the Browser**
  (Chrome-style). They stick around until you close them with the **×**, and
  survive a full reload. Restored search tabs re-run their search automatically.

### 🎮 New games
- **🧩 Sudoku** — Easy / Medium / Hard with a guaranteed-unique-solution
  generator, pencil-mark notes, conflict highlighting, keyboard play, and a
  per-difficulty fastest-time leaderboard.
- **⌨️ Typing Test** — 15 / 30 / 60-second runs with live WPM + accuracy,
  per-character coloring, and a top-WPM leaderboard.
- **🃏 Solitaire** — full Klondike: click-to-move, draw-1/draw-3, double-click
  to a foundation, and a fastest-win leaderboard.

### 📷 New media apps
- **Camera** — live preview, snapshot capture with an optional 3-second
  self-timer, front/back switch, mirror toggle, and a gallery you can view,
  download, or delete.
- **🎙️ Voice Recorder** — record mic audio with a live level meter + timer,
  then play back, download, or delete each take.

### 🏆 Leaderboards everywhere
- Every game now has a global leaderboard. Added them to **2048, Tetris, Space
  Invaders, Pac-Man** (high scores), **Pong** (wins vs the AI), and **Wordle**
  (best win streak) — joining the games that already had one. Your own entry is
  highlighted in the rankings.

> Camera and Voice Recorder need camera/mic permission (granted in the browser
> or the desktop app).

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
- **AppImage:** `chmod +x "Nova OS_10.10.0_amd64.AppImage"` then run it. (If it
  needs FUSE: `sudo apt install libfuse2`.)
- **Debian/Ubuntu (.deb):** `sudo apt install ./nova-os_10.10.0_amd64.deb`

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

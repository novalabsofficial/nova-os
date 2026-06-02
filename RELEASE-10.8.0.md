# Nova OS v10.8

A browser-based operating system — windows, a taskbar, a start menu, real
multitasking, a shelf of built-in apps, cross-device accounts, and a full
iOS-style mobile edition. Run it in a browser tab, install it as a PWA, grab the
free Android APK, or install the native desktop app.

10.8 makes notifications actually notify, and polishes a few apps.

---

## What's new in 10.8

### 🔔 Notifications
- **Desktop toasts** — a notification now pops a Windows-style banner in the
  bottom-right (the app's icon, title, body, and a subtle accent stripe), which
  opens the app on click and auto-dismisses after a few seconds. It still logs
  to the Notification Center too.
- **Global @mentions now work.** The mention listener was watching the *oldest*
  40 chat messages (a window that never updates), so new pings were never seen —
  fixed, so an `@you` in global chat now notifies (toast + sound + badge).
- **DMs notify** — a direct message raises a notification with the sender + a
  preview.
- **Chess challenges notify** — when someone starts a match with you, you get a
  "♟ Chess challenge" notification.
- All three are **offline-safe**: anything you missed while signed out notifies
  on your next login (not the whole history — just what's new since last time).

### ♟️ Chess
- **Real SVG pieces.** Pieces are now drawn as vector art colored by fill, so the
  white side is reliably light on every platform (previously the glyphs rendered
  as dark emoji on Windows, making white pieces look black).

### 💬 Chat
- **@mention autocomplete** — type `@` and pick a name from the suggestion list
  (people in the conversation: server roster, your DM partner, recent authors).

### 🗺️ Atlas
- **Search autocomplete** — live suggestions as you type in the Search box.
- **Directions From / To here** — a selected place now offers both, not just
  "to here".

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
- **AppImage:** `chmod +x "Nova OS_10.8.0_amd64.AppImage"` then run it. (If it
  needs FUSE: `sudo apt install libfuse2`.)
- **Debian/Ubuntu (.deb):** `sudo apt install ./nova-os_10.8.0_amd64.deb`

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

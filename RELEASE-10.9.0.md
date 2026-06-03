# Nova OS v10.9

A browser-based operating system — windows, a taskbar, a start menu, real
multitasking, a shelf of built-in apps, cross-device accounts, and a full
iOS-style mobile edition. Run it in a browser tab, install it as a PWA, grab the
free Android APK, or install the native desktop app.

10.9 adds background music to Atmos and a pack of five handy utility apps.

---

## What's new in 10.9

### 🎵 Atmos — background music
- A new **🎵 toggle** (next to the °F/°C button) plays relaxing background
  tracks while Atmos is open, with a **Now Playing** strip — track title,
  volume slider, next, and stop.
- Ships with **5 starter tracks**, shuffled. It starts only when you press play
  (no surprise autoplay) and stops when you close the app; your volume is
  remembered.
- Built to grow: dropping a new `.mp3` into the music folder makes it show up
  automatically — no code changes needed.

### 🧰 Five new utility apps
- **💱 Currency** — convert between ~30 world currencies with live daily rates.
  Amount, from/to, a one-tap swap, and the exact conversion rate.
- **📖 Dictionary** — definitions, parts of speech, examples, tap-a-synonym to
  jump words, 🔊 pronunciation audio, and your recent lookups.
- **🗣️ Translate** — translate between 27 languages, swap source/target, and
  copy the result.
- **🪙 Crypto** — live prices for the top 100 coins: 24h change, a 7-day
  sparkline, market cap, and USD / EUR / GBP.
- **🔳 QR Codes** — **generate** a QR from any text or link (download as PNG),
  and **scan** one with your camera *or* by uploading an image. Works fully
  offline.

> Every utility uses free, keyless data sources — nothing to sign up for, no API
> keys to manage.

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
- **AppImage:** `chmod +x "Nova OS_10.9.0_amd64.AppImage"` then run it. (If it
  needs FUSE: `sudo apt install libfuse2`.)
- **Debian/Ubuntu (.deb):** `sudo apt install ./nova-os_10.9.0_amd64.deb`

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

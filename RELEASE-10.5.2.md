# Nova OS v10.5.2

A browser-based operating system — Windows, a taskbar, a start menu, real
multitasking, a shelf of built-in apps, cross-device accounts, and a full
iOS-style mobile edition. Run it in a browser tab, install it as a PWA, grab the
free Android APK, or install the native desktop app.

This release rounds out the new **Asset Studio** — a Canva-style image/decal
editor built for game and UI art (transparent PNGs, preset decal sizes, shapes,
snapping) — and ships the mobile fixes from the 10.5 line.

---

## What's new in 10.5

### 🪄 Asset Studio (new app)
A standalone editor, separate from Photos, aimed at Roblox-style asset work:

- **Transparent backgrounds by default** and one-click **transparent PNG export**.
- **Preset decal sizes** — Decal 1024²/512², Game icon 512², Square 256²,
  Thumbnail 1920×1080, plus Tall and Wide.
- **Image layers** — add (file or paste), move, resize, rotate, opacity, and
  **flip horizontal / vertical**.
- **Colorable shapes** — rectangle, rounded rectangle, ellipse, line, triangle,
  diamond, pentagon, and star, each with fill, stroke color, and stroke width.
- **Alignment snapping with guides** — drag a layer and it snaps to the canvas
  centre, edges, and to other layers, with on-screen guide lines. Align buttons
  snap the selection to any edge or centre.
- **Multi-select** — box-select by dragging empty canvas, or Shift/Ctrl-click;
  move, color, align, flip, and delete act on the whole selection.
- **Snip a region** — export just part of the canvas (snipping-tool style) with a
  live pixel readout, then exit straight back to the editor.
- **Natural resizing** — eight handles (corners + edges) that anchor the opposite
  side and stay accurate even when a layer is rotated. Images keep their aspect
  ratio on corner-drag (hold Shift to free-stretch); on touch, **pinch to resize**.
- **Delete control** — a delete button plus the **Backspace / Delete** key remove
  the selected item; **Escape** clears the selection or exits Snip mode.

### 📱 Mobile fixes
- **Settings** now has a proper back button on phones (tap a category to open it,
  back to return).
- **Chess** board fits the screen — the games list stacks above a full-width
  board instead of being cut off.
- **Pong** has touch controls — drag to move your paddle (two-player splits the
  board into halves).
- **App switcher** no longer opens an app by mistake when you tap empty space to
  dismiss it.

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
> install it as a PWA from the deployed site — that path never triggers any of
> the security prompts below.

---

## Installing & getting past the security warnings

**Short version:** the desktop installers and the Android APK are **not signed
with a paid publisher certificate**, so your operating system shows an "unknown
publisher" caution the first time you open them. This is expected for an
independent app — it's a *"we don't recognize who made this"* notice, **not** a
virus detection. You only have to clear it once per install.

### 🪟 Windows — Microsoft Defender SmartScreen
1. When you download the `.exe`/`.msi`, your browser may say it "isn't commonly
   downloaded" or "could harm your device." Choose **Keep** → **Keep anyway**.
2. When you run it, you'll see a blue **"Windows protected your PC"** box.
3. Click the **More info** link, then the **Run anyway** button that appears.
4. The installer proceeds normally; you won't be prompted again for that install.

*If Defender quarantines the file outright (rare):* open **Windows Security →
Virus & threat protection → Protection history**, find the item, and choose
**Restore / Allow on device**, then run it again.

### 🍎 macOS — Gatekeeper
1. Open the `.dmg` and drag **Nova OS** into Applications.
2. The first launch may say it "cannot be opened because Apple cannot check it
   for malicious software." **Right-click (or Control-click) the app → Open →
   Open.** (A plain double-click won't show the override button.)
3. Alternatively: **System Settings → Privacy & Security**, scroll down, and
   click **Open Anyway** next to the Nova OS notice.

*If you get "Nova OS is damaged and can't be opened" on Apple Silicon,* that's
the download quarantine flag. Open **Terminal** and run:
```bash
xattr -cr "/Applications/Nova OS.app"
```
then open the app again.

### 🐧 Linux
- **AppImage:** make it executable, then run it.
  ```bash
  chmod +x "Nova OS_10.5.2_amd64.AppImage"
  ./"Nova OS_10.5.2_amd64.AppImage"
  ```
  (If it complains about FUSE, install `libfuse2` — e.g. `sudo apt install libfuse2`.)
- **Debian/Ubuntu (.deb):**
  ```bash
  sudo apt install ./nova-os_10.5.2_amd64.deb
  # or: sudo dpkg -i nova-os_10.5.2_amd64.deb
  ```

### 🤖 Android — "unknown sources" + Play Protect
1. Download `nova-os.apk` and tap it. Android will warn that this source isn't
   allowed to install apps.
2. Tap **Settings** on that prompt and enable **Allow from this source** for the
   app you downloaded with (Chrome, Files, etc.), then go **back** and tap
   **Install**.
3. If **Play Protect** pops up ("Unsafe app blocked" or an offer to scan), tap
   **More details → Install anyway** (or **Install without scanning**).
4. Updates install in place — every release is signed with the same key, so a new
   APK upgrades the old one without uninstalling.

---

## Is it safe?

Yes. The warnings above come from the apps not carrying a paid code-signing
certificate (Windows Authenticode / Apple Developer ID), which the OS uses to
display a known publisher name. The project is open source, so if you'd rather
not trust the prebuilt binaries you can review the code and build the installers
yourself with `npm run tauri build`. Your data lives in your own account; no
keys are bundled or sent to any Nova server.

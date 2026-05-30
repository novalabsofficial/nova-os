# Nova OS — Installable App & Play Store Guide

Nova OS ships as an installable **PWA** (Progressive Web App). That makes it
installable on phones today and is also the foundation for a **Google Play Store
listing** (via a TWA — Trusted Web Activity).

The key property: **the app loads from your live web deploy (Vercel).** So your
normal workflow is unchanged —

```
edit code  →  git push  →  Vercel deploys  →  every install gets it on next open
```

You only touch the Play Store again for *native-shell* changes (icon, name,
permissions). Day-to-day feature/bugfix updates never require a store
submission.

---

## What was added to the repo

| File | Purpose |
|------|---------|
| `public/sw.js` | Service worker. Makes the app installable + offline. Network-first for navigations (deploys are always fresh), stale-while-revalidate for hashed assets, and it **never** intercepts Firebase/API/cross-origin calls. |
| `public/manifest.webmanifest` | Web App Manifest (name, icons, standalone display, theme). Updated with `id`, explicit 192/512 icons, and a dark theme color. |
| `src/main.jsx` | Registers `sw.js` — **production + web only, never inside the Tauri desktop app.** |
| `index.html` | `theme-color` aligned with the manifest (dark). |

None of this affects the desktop **web** build behavior (beyond adding offline +
install) or the **Tauri** desktop build (the SW is explicitly skipped there).

---

## 1. Install on a phone (available now — no store needed)

**Android (Chrome):**
1. Open the live Nova OS URL.
2. Menu (⋮) → **Install app** / **Add to Home screen**.
3. It installs with its own icon and launches fullscreen (no address bar).

**iPhone (Safari):**
1. Open the live URL.
2. Share button → **Add to Home Screen**.
3. Launches fullscreen from the home-screen icon.

> Requirements for the Android "Install" prompt: served over HTTPS (Vercel is),
> a valid manifest (✓), and a registered service worker with a fetch handler
> (✓). All set once this is deployed.

---

## 2. Native Android app (Capacitor) — free APK via GitHub Releases

This is the **v10.3** distribution path: a real native Android app (via
[Capacitor](https://capacitorjs.com/)) that unlocks reliable device haptics and
hardware — **no Google Play fee.** The APK is built automatically by CI and
attached to the GitHub Release; users download it from the release page or the
in-app "Download Android app" button (shown in Control Center on Android).

### How it builds (automatic)
`.github/workflows/android-release.yml` runs on every `v*` tag (same trigger as
the desktop build). On GitHub's runners it:
1. `npm ci` + `npm run build`
2. `npx cap add android` (generates the native project fresh — not committed)
3. brands the launcher icon from `public/nova-icon.png`
4. `./gradlew assembleDebug`
5. attaches the result as **`nova-os.apk`** to the release.

So you don't need Android Studio / the SDK locally — just push a tag:
```bash
git tag v10.3.0 && git push origin v10.3.0
```
The APK appears on the release within a few minutes.

### How users install it
- In Nova OS on Android: swipe down → Control Center → **Download Android app**
  (links to `releases/latest/download/nova-os.apk`).
- Or directly from the GitHub Releases page.
- Android asks them to allow installs from that source once, then it installs
  like any app — its own icon, fullscreen, native haptics.

### Build it locally instead (optional)
```bash
npm run build
npx cap add android        # first time only
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### Notes
- The current workflow ships a **debug-signed** APK — fine for direct download.
  For a polished release, generate a keystore once and switch the Gradle step to
  `assembleRelease` with the signing secrets stored in GitHub Actions secrets.
- By default the APK **bundles** the web build (`webDir: dist`), so it's
  offline-capable and updates when you publish a new APK. To make it load the
  live site instead (instant web updates, like the PWA), add
  `"server": { "url": "https://YOUR-NOVA-OS-URL" }` to `capacitor.config.json` —
  native haptics still work because the Capacitor bridge is injected.

---

## 3. Optional later: Google Play Store

If you ever want store discoverability/trust, the same Capacitor project can be
published to Google Play (one-time $25 USD): switch CI to `bundleRelease` (an
`.aab`), sign it, and upload via the Play Console. Nothing here needs to change
to do that later — it's purely additive.

---

## Updating, in one line

- **App content (99% of changes):** `git push origin main` → Vercel. The PWA and
  (if you set `server.url`) the Android app pick it up immediately.
- **Bundled APK / icon / native plugins:** push a new `vX.Y.Z` tag → CI rebuilds
  `nova-os.apk` and attaches it to the new release. The in-app download button
  always points at the latest.

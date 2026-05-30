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

## 2. Publish to the Google Play Store (TWA via Bubblewrap)

A TWA wraps the PWA in a thin Android app that's just a fullscreen Chrome window
pointed at your URL. **Because it loads from Vercel, web updates appear instantly
in the installed app with no new store submission.**

### Prerequisites
- Node.js (already installed)
- A Google Play Console account (one-time $25 USD)
- Java JDK 17+ (Bubblewrap will prompt / can install it)

### Steps

```bash
# 1. Install Google's TWA generator
npm install -g @bubblewrap/cli

# 2. Initialize from the live manifest (use your real deployed URL)
bubblewrap init --manifest https://YOUR-NOVA-OS-URL/manifest.webmanifest
#    - Bubblewrap reads the manifest and generates all Android icon sizes
#      from /nova-icon.png automatically.
#    - Pick an application id like: app.novaos.twa  (this is permanent)
#    - It creates/uses a signing keystore — BACK THIS UP, you need it for
#      every future store update.

# 3. Build the Android App Bundle
bubblewrap build
#    → produces app-release-bundle.aab  (this is what you upload)
```

### Digital Asset Links (removes the browser address bar)
After `bubblewrap init`, it prints a **SHA-256 fingerprint** of your signing key.
Create this file and deploy it to the web root so Android trusts the link:

`public/.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.novaos.twa",
    "sha256_cert_fingerprints": ["PASTE_FINGERPRINT_FROM_BUBBLEWRAP_HERE"]
  }
}]
```
Vercel serves `public/` at the root, so it becomes
`https://YOUR-URL/.well-known/assetlinks.json` after a normal `git push`.
(`bubblewrap fingerprint` re-prints the value if you need it again.)

### Upload
Play Console → Create app → upload `app-release-bundle.aab` → fill the listing
(screenshots, description) → submit. First review takes a few hours to ~2 days;
later updates are usually reviewed within hours.

---

## 3. Later: native hardware + a real browser (Capacitor)

When you want genuine native capabilities — real flashlight, screen brightness,
true in-app browser tabs (native WebView), push notifications — wrap the same
build with [Capacitor](https://capacitorjs.com/) instead of a TWA. It reuses all
the existing code and adds native plugins. This is a separate, additive phase;
the PWA/TWA above keeps working in the meantime.

---

## Updating, in one line

- **App content (99% of changes):** `git push` → Vercel. Done. No store action.
- **App icon / name / permissions:** rebuild the `.aab` with Bubblewrap, bump the
  version, re-upload to Play Console.

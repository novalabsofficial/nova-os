// v7.0.3 — open external URLs in whichever way actually works for the current
// runtime. Three flavors:
//
//   • web build (browser tab):  window.open(url, '_blank') — standard
//   • Tauri desktop build:      shell.open(url) → OS hands it to Chrome/Edge/etc.
//   • SSR / no window:          best-effort no-op
//
// Background: Tauri's webview blocks window.open() to external origins by
// default, so anywhere we used to do `window.open(url, '_blank')` would
// silently fail inside the desktop app. The fix is to route through Tauri's
// shell plugin, which delegates to the user's actual default browser.
//
// The Tauri plugin is dynamically imported so the web build doesn't bundle
// any Tauri code — Vite tree-shakes the import away when isTauri() is false.

function isTauri() {
  // In Tauri 2, the marker is __TAURI_INTERNALS__ on the window object.
  // (Older Tauri 1 used __TAURI__; we check both for safety.)
  return typeof window !== "undefined" && (
    "__TAURI_INTERNALS__" in window || "__TAURI__" in window
  );
}

// Capacitor Browser plugin (Chrome Custom Tab) — a real in-app browser on the
// native Android build. Reached via the injected global so nothing is bundled
// on the web.
function capacitorBrowser() {
  try {
    const c = typeof window !== "undefined" ? window.Capacitor : null;
    if (c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.Browser) return c.Plugins.Browser;
  } catch {}
  return null;
}

/**
 * Open a URL the user can actually see. Picks browser tab on web, system
 * browser on Tauri desktop.
 *
 * @param {string} url   absolute http(s) or mailto URL
 * @returns {Promise<void>}
 */
export async function openExternalUrl(url) {
  if (!url || typeof url !== "string") return;
  if (typeof window === "undefined") return;        // SSR safety, no-op

  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch (e) {
      // If the plugin fails (e.g. permission missing or URL not allowlisted
      // in capabilities/default.json), fall back to window.open as a best
      // effort — at minimum the failure becomes visible in DevTools rather
      // than a silent dead button.
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
      // eslint-disable-next-line no-console
      console.warn("[openExternalUrl] shell.open failed, falling back:", e);
    }
    return;
  }

  // Native Android: open in the in-app browser (Chrome Custom Tab).
  const B = capacitorBrowser();
  if (B && B.open) {
    try { await B.open({ url }); return; } catch {}
  }

  // Web: standard new-tab open.
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {}
}

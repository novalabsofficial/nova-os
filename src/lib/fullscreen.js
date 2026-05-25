// v7.8 — Cross-runtime fullscreen helper.
//
// Three runtime targets, three different APIs:
//
//   1. Tauri desktop  → Tauri's window plugin can put the OS-level window
//                       into "real" fullscreen, hiding title bars and
//                       borders entirely. This is what users expect from a
//                       desktop app's fullscreen mode.
//
//   2. Browser tab    → The HTML Fullscreen API
//                       (document.documentElement.requestFullscreen).
//                       Browser overlays the standard "Press Esc to exit"
//                       toast on entry.
//
//   3. Installed PWA  → Same HTML Fullscreen API as the browser tab. The
//                       PWA shell already drops browser chrome; fullscreen
//                       additionally hides any remaining system UI (taskbar
//                       on Windows, dock on macOS in some cases).
//
// We try the Tauri path first if available, fall back to the web API
// otherwise. The Tauri import is lazy / try-caught so the web bundle
// doesn't pull in any Tauri code (Vite tree-shakes the dynamic import
// when the bundle is built for web).

function isTauri() {
  return typeof window !== "undefined" && (
    "__TAURI_INTERNALS__" in window || "__TAURI__" in window
  );
}

/**
 * Returns whether the app is currently in fullscreen mode. Synchronous —
 * checks document.fullscreenElement for web, which is true on Tauri too
 * if it entered fullscreen via the HTML API. For Tauri's *native* fullscreen
 * (setFullscreen true) the document API may not reflect state, so we also
 * read from our own remembered state set by enter/exitFullscreen.
 */
let _lastKnownFullscreen = false;
export function isFullscreen() {
  if (typeof document === "undefined") return false;
  return !!document.fullscreenElement || _lastKnownFullscreen;
}

/**
 * Enter fullscreen. On Tauri uses native window fullscreen; on web uses
 * the HTML Fullscreen API. Returns a promise that resolves after the
 * transition completes (or rejects if denied by the browser / OS).
 */
export async function enterFullscreen() {
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setFullscreen(true);
      _lastKnownFullscreen = true;
      _notify();
      return;
    } catch (e) {
      // Permission missing in capabilities, or unsupported — fall through
      // to the web path. The webview-level fullscreen still hides everything
      // *inside* the Tauri window, just not the OS title bar.
      // eslint-disable-next-line no-console
      console.warn("[fullscreen] Tauri setFullscreen failed, falling back:", e);
    }
  }
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if (el.webkitRequestFullscreen) {
    // Safari (desktop + iOS) still needs the prefixed name.
    await el.webkitRequestFullscreen();
  }
  _lastKnownFullscreen = true;
  _notify();
}

/**
 * Exit fullscreen via whichever API put us in it.
 */
export async function exitFullscreen() {
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setFullscreen(false);
      _lastKnownFullscreen = false;
      _notify();
      return;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[fullscreen] Tauri setFullscreen(false) failed:", e);
    }
  }
  if (typeof document === "undefined") return;
  if (document.exitFullscreen && document.fullscreenElement) {
    await document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    await document.webkitExitFullscreen();
  }
  _lastKnownFullscreen = false;
  _notify();
}

/**
 * Toggle current state. Convenience for the F11 handler and Settings toggle.
 */
export async function toggleFullscreen() {
  if (isFullscreen()) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
}

// ── Reactive state subscription ─────────────────────────────────────────
//
// Components that want to render based on the current fullscreen state
// (e.g. the Settings toggle showing the correct on/off position) subscribe
// to changes via onFullscreenChange. We bridge two event sources into one
// stream:
//   • document `fullscreenchange` — fires on web + when Tauri enters via
//     the HTML API
//   • our own `_notify()` after Tauri's `setFullscreen` resolves — fires
//     for native-Tauri transitions that don't bubble through the document
//     event (since they bypass the HTML API entirely)

const _listeners = new Set();
function _notify() {
  for (const cb of _listeners) {
    try { cb(isFullscreen()); } catch {}
  }
}
if (typeof document !== "undefined") {
  // Sync our remembered state with the browser's whenever it changes —
  // important for the Esc-to-exit case (user dismisses fullscreen via the
  // browser overlay; we'd otherwise stay stuck thinking we're still in it).
  document.addEventListener("fullscreenchange", () => {
    _lastKnownFullscreen = !!document.fullscreenElement;
    _notify();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    _lastKnownFullscreen = !!document.fullscreenElement;
    _notify();
  });
}

/**
 * Subscribe to fullscreen state changes. Returns an unsubscribe function.
 * @param {(fs: boolean) => void} cb
 */
export function onFullscreenChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

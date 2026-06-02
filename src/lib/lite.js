// Nova OS "lite mode" — a lightweight rendering profile for low-power /
// software-rendered environments. The motivating case is Nova OS running as
// the Linux desktop session inside a VM under a kiosk browser, where there's
// no real GPU and the normal chrome stutters.
//
// Activated with `?kiosk=1` (or `?lite=1`) in the URL. It drops the two most
// GPU-expensive effects:
//   • backdrop-filter blur (panels, taskbar, overlays)  — re-blurs every frame
//   • the animated-wallpaper "drift"                     — re-composites a huge
//                                                          gaussian-blurred SVG
// Everything still works and looks the same structurally; it just renders
// flatter and far smoother without a GPU. No-ops on a normal desktop/web load.

let _lite = null;

/** True when the app was launched in lite mode (?kiosk=1 / ?lite=1). Cached. */
export function isLiteMode() {
  if (_lite !== null) return _lite;
  try {
    const p = new URLSearchParams(window.location.search);
    const on = (k) => {
      const v = p.get(k);
      return v !== null && v !== "0" && v !== "false"; // present, not explicitly off
    };
    _lite = on("kiosk") || on("lite");
  } catch {
    _lite = false;
  }
  return _lite;
}

/**
 * Tag the document so the CSS overrides (html.nova-lite … in styles.js) apply
 * before first paint. Call this as early as possible. Safe no-op otherwise.
 */
export function initLite() {
  try {
    if (isLiteMode() || litePrefOn()) document.documentElement.classList.add("nova-lite");
  } catch {}
}

// ── User preference (Settings toggle) ───────────────────────────────────────
// Kept SEPARATE from the URL/kiosk detection above: a normal user turning on
// "Lite mode" for performance must NOT flip on the kiosk-only power controls
// that key off isLiteMode(). This preference only drives the `nova-lite` CSS
// class (which disables backdrop blur + wallpaper drift), applied live.
function litePrefOn() { try { return localStorage.getItem("nova-lite-pref") === "1"; } catch { return false; } }
export function getLitePref() { return litePrefOn(); }
export function setLitePref(on) {
  try {
    localStorage.setItem("nova-lite-pref", on ? "1" : "0");
    // keep the class on if the URL/kiosk path also wants lite
    document.documentElement.classList.toggle("nova-lite", !!on || isLiteMode());
  } catch {}
}

/**
 * Force lite mode on without a URL param or a page reload. Used by the Nova
 * Linux kiosk (Tauri): we can't reload to add `?kiosk=1` because that reload
 * drops the Tauri IPC bridge on the production custom protocol (tauri://) — it
 * survives over http in dev but breaks on tauri://, killing the power controls
 * + native detection. So once the kiosk session is confirmed we just flip lite
 * mode on in place, before first paint.
 */
export function forceLite() {
  _lite = true;
  try { document.documentElement.classList.add("nova-lite"); } catch {}
}

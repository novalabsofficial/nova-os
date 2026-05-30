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
    if (isLiteMode()) document.documentElement.classList.add("nova-lite");
  } catch {}
}

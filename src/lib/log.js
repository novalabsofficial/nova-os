// Nova OS unified logging.
//
// PRIMARY troubleshooting channel for the desktop / Nova Linux build:
//   • forwards every line to Rust via the `js_log` command -> tauri-plugin-log
//     writes it to stdout + a file
//     (~/.local/share/com.novalabsofficial.novaos/logs/*.log)
//   • mirrors every line to an ON-SCREEN overlay (desktop only) so a screenshot
//     of the boot IS the diagnostic — no terminal / journalctl / VT switching
//     needed. The overlay auto-hides ~6 s after a healthy boot (it STAYS if
//     anything errored or the app never mounted, so a failed boot is still
//     screenshot-able).
//   • on web / PWA / Android: just the browser console (no overlay, no bridge).
//
// initLogging() also captures uncaught errors + unhandled promise rejections.

const isTauri = typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

let _invokeReady = null;
function invoker() {
  if (!isTauri) return Promise.resolve(null);
  if (_invokeReady) return _invokeReady;
  _invokeReady = import("@tauri-apps/api/core").then((m) => m.invoke).catch(() => null);
  return _invokeReady;
}

function str(a) {
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.stack || a.message || String(a);
  try { return JSON.stringify(a); } catch { return String(a); }
}

// ---- on-screen boot-log overlay (desktop only) -----------------------------
let _overlay = null;
let _hidden = false;
let _hadError = false;

function overlayEl() {
  if (!isTauri || _hidden || typeof document === "undefined") return null;
  if (_overlay) return _overlay;
  const el = document.createElement("div");
  el.id = "nova-boot-log";
  el.style.cssText = [
    "position:fixed", "left:0", "top:0", "right:0", "max-height:60vh",
    "overflow:auto", "z-index:2147483647", "pointer-events:none",
    "margin:0", "padding:8px 10px",
    "font-family:monospace", "font-size:12px", "line-height:1.45",
    "white-space:pre-wrap", "word-break:break-word",
    "background:rgba(0,0,0,0.82)", "color:#cfe",
  ].join(";");
  // documentElement is always present, even before <body> exists.
  (document.body || document.documentElement).appendChild(el);
  _overlay = el;
  return el;
}

function paint(level, msg) {
  const el = overlayEl();
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = "[" + level + "] " + msg;
  if (level === "error") line.style.color = "#ff8a8a";
  else if (level === "warn") line.style.color = "#ffd479";
  el.appendChild(line);
}

function emit(level, args) {
  const msg = args.map(str).join(" ");
  if (level === "error") _hadError = true;
  try { (console[level] || console.log).call(console, "[nova]", msg); } catch {}
  paint(level, msg);
  if (isTauri) invoker().then((inv) => { try { if (inv) inv("js_log", { level, msg }); } catch {} });
}

export const log = {
  info: (...a) => emit("info", a),
  warn: (...a) => emit("warn", a),
  error: (...a) => emit("error", a),
  debug: (...a) => emit("debug", a),
};

/** True if any error has been logged this session. */
export function bootLogHadError() { return _hadError; }

/** Remove the on-screen boot-log overlay (call once the app is confirmed healthy). */
export function hideBootLog() {
  _hidden = true;
  if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
  _overlay = null;
}

/**
 * Install global capture of uncaught errors + promise rejections (full stack),
 * and emit a startup line. Safe to call once, early, in main.jsx.
 */
export function initLogging() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    const tail = e && e.error && e.error.stack
      ? "\n" + e.error.stack
      : ` (${e.filename || "?"}:${e.lineno || 0}:${e.colno || 0})`;
    emit("error", ["uncaught: " + ((e && e.message) || "error") + tail]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    emit("error", ["unhandledrejection: " + str(e && e.reason)]);
  });
  log.info("logging ready (tauri=" + isTauri + ")");
}

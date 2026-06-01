// Nova OS unified logging.
//
// PRIMARY troubleshooting channel for the desktop / Nova Linux build:
//   • forwards every line to Rust via the `js_log` command -> tauri-plugin-log
//     writes it to stdout + a file
//     (~/.local/share/com.novalabsofficial.novaos/logs/*.log)
//   • mirrors every line to an ON-SCREEN overlay (desktop only) so a screenshot
//     of the boot IS the diagnostic — no terminal / journalctl / VT switching.
//   • the overlay's lines are ALSO persisted to sessionStorage and restored on
//     load, so if the page RELOADS (chunk retry, web-process crash, etc.) the
//     overlay keeps the full multi-load history instead of flashing + vanishing.
//   • auto-hides ~6 s after a healthy boot; STAYS if anything errored.
//   • on web / PWA / Android: just the browser console (no overlay, no bridge).
//
// initLogging() also captures uncaught errors + unhandled promise rejections.

const isTauri = typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
const SS_KEY = "nova:bootlog";

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

function paintLine(el, level, msg, dim) {
  const line = document.createElement("div");
  line.textContent = "[" + level + "] " + msg;
  if (level === "error") line.style.color = "#ff8a8a";
  else if (level === "warn") line.style.color = "#ffd479";
  if (dim) line.style.opacity = "0.55";
  el.appendChild(line);
}

function overlayEl() {
  if (!isTauri || _hidden || typeof document === "undefined") return null;
  if (_overlay) return _overlay;
  const el = document.createElement("div");
  el.id = "nova-boot-log";
  el.style.cssText = [
    "position:fixed", "left:0", "top:0", "right:0", "max-height:70vh",
    "overflow:auto", "z-index:2147483647", "pointer-events:none",
    "margin:0", "padding:8px 10px",
    "font-family:monospace", "font-size:12px", "line-height:1.4",
    "white-space:pre-wrap", "word-break:break-word",
    "background:rgba(0,0,0,0.85)", "color:#cfe",
  ].join(";");
  (document.body || document.documentElement).appendChild(el);
  _overlay = el;
  // Restore lines saved before a reload (sessionStorage survives reloads), so a
  // reload/crash that wipes the page keeps the trace instead of flashing away.
  try {
    const arr = JSON.parse(sessionStorage.getItem(SS_KEY) || "[]");
    if (arr.length) {
      paintLine(el, "info", "— " + arr.length + " line(s) from before a reload —", true);
      for (const l of arr) paintLine(el, l.level, l.msg, true);
      paintLine(el, "info", "— current load —", true);
    }
  } catch {}
  return el;
}

function persist(level, msg) {
  if (!isTauri) return;
  try {
    const arr = JSON.parse(sessionStorage.getItem(SS_KEY) || "[]");
    arr.push({ level, msg });
    if (arr.length > 150) arr.splice(0, arr.length - 150);
    sessionStorage.setItem(SS_KEY, JSON.stringify(arr));
  } catch {}
}

function emit(level, args) {
  const msg = args.map(str).join(" ");
  if (level === "error") _hadError = true;
  try { (console[level] || console.log).call(console, "[nova]", msg); } catch {}
  persist(level, msg);
  const el = overlayEl();
  if (el) paintLine(el, level, msg, false);
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

/** Remove the on-screen boot-log overlay + clear its saved history (call once
 *  the app is confirmed healthy). */
export function hideBootLog() {
  _hidden = true;
  try { sessionStorage.removeItem(SS_KEY); } catch {}
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
  // Wrap async callback schedulers: a synchronous throw inside one is logged
  // with the REAL error (our own try/catch isn't subject to the cross-origin
  // window.onerror masking — "Script error. (?:0:0)" — that tauri:// triggers).
  const wrap = (name) => {
    const orig = window[name];
    if (typeof orig !== "function") return;
    window[name] = function (cb, ...rest) {
      if (typeof cb !== "function") return orig.call(this, cb, ...rest);
      return orig.call(this, function (...a) {
        try { return cb.apply(this, a); }
        catch (e) {
          emit("error", ["callback(" + name + ") threw: " + ((e && e.message) || e) + ((e && e.stack) ? "\n" + e.stack : "")]);
          throw e;
        }
      }, ...rest);
    };
  };
  ["setTimeout", "setInterval", "requestAnimationFrame", "requestIdleCallback", "queueMicrotask"].forEach(wrap);
  log.info("logging ready (tauri=" + isTauri + ")");
}

// Nova OS unified logging.
//
// This is the PRIMARY troubleshooting channel for the desktop / Nova Linux
// build. On the Tauri build every log line is forwarded to the Rust side via the
// `js_log` command, where tauri-plugin-log writes it to BOTH:
//   • stdout  (→ journald when launched as a systemd service: journalctl -u …)
//   • a file:  ~/.local/share/com.novalabsofficial.novaos/logs/*.log
// so the workflow is simply "pull the log file, send it over."
//
// On web / PWA / Android (no Tauri bridge) it just uses the browser console.
//
// initLogging() also installs global capture of uncaught errors + unhandled
// promise rejections WITH full stacks — so a crash that used to show only a
// masked "Script error." now lands in the log with the real message + trace.

const isTauri = typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

let _invokeReady = null;
function invoker() {
  if (!isTauri) return Promise.resolve(null);
  if (_invokeReady) return _invokeReady;
  _invokeReady = import("@tauri-apps/api/core")
    .then((m) => m.invoke)
    .catch(() => null);
  return _invokeReady;
}

function str(a) {
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.stack || a.message || String(a);
  try { return JSON.stringify(a); } catch { return String(a); }
}

function emit(level, args) {
  const msg = args.map(str).join(" ");
  // Always mirror to the console (dev + web + WebKit console).
  try { (console[level] || console.log).call(console, "[nova]", msg); } catch {}
  // Forward to the Rust log sink (file + stdout) when running under Tauri.
  if (isTauri) {
    invoker().then((inv) => {
      try { if (inv) inv("js_log", { level, msg }); } catch {}
    });
  }
}

export const log = {
  info: (...a) => emit("info", a),
  warn: (...a) => emit("warn", a),
  error: (...a) => emit("error", a),
  debug: (...a) => emit("debug", a),
};

/**
 * Install global capture of uncaught errors + promise rejections (full stack),
 * and emit a startup line. Safe to call once, early, in main.jsx.
 */
export function initLogging() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    const tail = e && e.error && e.error.stack
      ? "\n" + e.error.stack
      : ` (${e.filename}:${e.lineno}:${e.colno})`;
    emit("error", ["uncaught: " + ((e && e.message) || "error") + tail]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    emit("error", ["unhandledrejection: " + str(e && e.reason)]);
  });
  log.info("logging ready (tauri=" + isTauri + ")");
}

// Native bridge — thin wrappers over Capacitor plugins, reached through the
// injected `window.Capacitor.Plugins` global so the WEB bundle imports nothing
// from Capacitor. Every call no-ops gracefully when not running in the app.

function caps() { try { return (typeof window !== "undefined" && window.Capacitor) || null; } catch { return null; } }
export function isNative() { const c = caps(); return !!(c && c.isNativePlatform && c.isNativePlatform()); }
function plugin(name) { const c = caps(); return (c && c.Plugins && c.Plugins[name]) || null; }

// ── Immersive / fullscreen (hide the phone's system UI) ─────────────────────
let _immersive = false;
export function setImmersive(on) {
  _immersive = !!on;
  const SB = plugin("StatusBar");
  if (!SB) return;
  try {
    if (on) { SB.setOverlaysWebView && SB.setOverlaysWebView({ overlay: true }); SB.hide && SB.hide(); }
    else { SB.show && SB.show(); SB.setOverlaysWebView && SB.setOverlaysWebView({ overlay: false }); }
  } catch {}
}
export function isImmersive() { return _immersive; }
export function toggleImmersive() { setImmersive(!_immersive); return _immersive; }

// ── App lifecycle ───────────────────────────────────────────────────────────
export function exitApp() { const A = plugin("App"); try { A && A.exitApp && A.exitApp(); } catch {} }
export function minimizeApp() { const A = plugin("App"); try { A && A.minimizeApp && A.minimizeApp(); } catch {} }

// ── Real in-app browser (Chrome Custom Tab) ─────────────────────────────────
export function openExternal(url) {
  const B = plugin("Browser");
  if (B && B.open) { try { B.open({ url }); return true; } catch {} }
  return false;
}

// ── System notifications ────────────────────────────────────────────────────
let _notifId = 1, _notifPermAsked = false, _notifGranted = false;
export async function notify({ title, body }) {
  const LN = plugin("LocalNotifications");
  if (!LN) return false;
  try {
    if (!_notifPermAsked) {
      _notifPermAsked = true;
      const p = await LN.requestPermissions();
      _notifGranted = !p || p.display === "granted" || p.display === undefined;
    }
    if (!_notifGranted) return false;
    _notifId = (_notifId % 2000000000) + 1;
    await LN.schedule({ notifications: [{ id: _notifId, title: title || "Nova OS", body: body || "", smallIcon: "ic_stat_icon_config_sample" }] });
    return true;
  } catch { return false; }
}

// ── One-time init (called from main.jsx) ────────────────────────────────────
let _inited = false;
export function initNative() {
  if (_inited || !isNative()) return;
  _inited = true;
  try { document.documentElement.classList.add("nova-native"); } catch {}
  setImmersive(true);   // hide the phone's system UI while Nova OS is active
  const A = plugin("App");
  if (A && A.addListener) {
    try {
      A.addListener("backButton", () => {
        // Let the shell consume the back press (close an overlay / go Home). If
        // nothing handled it (dispatchEvent returns true), background the app
        // instead of hard-exiting.
        const handled = !window.dispatchEvent(new CustomEvent("nova-back", { cancelable: true }));
        if (!handled) minimizeApp();
      });
    } catch {}
  }
}

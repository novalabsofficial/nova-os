// Mobile haptics.
//
// In the native Android app (Capacitor) we use the @capacitor/haptics plugin —
// the real OS haptic engine, reliable on every device. On the plain web we fall
// back to the Vibration API (works on some Android browsers, no-op elsewhere —
// iOS Safari exposes neither).
//
// The native plugin is reached via the injected `window.Capacitor` global, so
// the WEB bundle imports nothing from Capacitor; the plugin only ships inside
// the Android build. Toggle persists in localStorage.

const KEY = "nova:mobile:haptics";
let enabled = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();

// Web Vibration API fallback patterns (ms). >= ~25ms to be felt where supported.
const PATTERNS = {
  tap: 35, toggle: 45, open: 45, pick: [0, 60], move: 25, drop: 45,
  remove: [0, 45, 50, 45], unlock: [0, 40, 70, 50], confirm: [0, 50, 70, 50], error: [0, 50, 60, 50],
};

// Map each kind to a native Capacitor Haptics call (crisp, OS-native feel).
const IMPACT = { tap: "LIGHT", toggle: "LIGHT", move: "LIGHT", open: "MEDIUM", pick: "MEDIUM", drop: "MEDIUM", unlock: "MEDIUM", remove: "HEAVY" };

function nativeHaptics() {
  try {
    const cap = typeof window !== "undefined" ? window.Capacitor : null;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Haptics) return cap.Plugins.Haptics;
  } catch {}
  return null;
}

export function hapticsEnabled() { return enabled; }
export function setHapticsEnabled(v) {
  enabled = !!v;
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch {}
  if (enabled) haptic("confirm");   // confirmation buzz so you can verify it works
}

export function haptic(kind = "tap") {
  if (!enabled) return;
  const H = nativeHaptics();
  if (H) {
    try {
      if (kind === "confirm") return void H.notification({ type: "SUCCESS" });
      if (kind === "error") return void H.notification({ type: "ERROR" });
      return void H.impact({ style: IMPACT[kind] || "LIGHT" });
    } catch {}
    return;
  }
  // web fallback
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(PATTERNS[kind] ?? 35); } catch {}
}

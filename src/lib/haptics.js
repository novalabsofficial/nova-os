// Mobile haptics — thin wrapper over the Vibration API.
//
// Works on Android (incl. installed PWA); iOS Safari doesn't expose vibration to
// the web, so it's a graceful no-op there. Patterns are intentionally tiny so
// interactions feel "tactile," not buzzy. Toggle persists in localStorage.

const KEY = "nova:mobile:haptics";
let enabled = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();

// Durations in ms. Many Android motors barely register anything under ~25ms,
// so these are deliberately punchy; "feels like a tap" sits around 30-45ms.
const PATTERNS = {
  tap: 35,             // light UI tap
  toggle: 45,          // switch flipped
  open: 45,            // app launched
  pick: [0, 60],       // icon lifted into a drag (firm)
  move: 25,            // crossed into a new reorder slot (light tick)
  drop: 45,            // dropped
  remove: [0, 45, 50, 45],   // removed from home (buzz)
  unlock: [0, 40, 70, 50],   // lock screen released
  confirm: [0, 50, 70, 50],  // strong, unmistakable test buzz
  error: [0, 50, 60, 50],
};

export function hapticsEnabled() { return enabled; }
export function setHapticsEnabled(v) {
  enabled = !!v;
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch {}
  if (enabled) haptic("confirm");   // distinct double-buzz so you can verify it works
}

export function haptic(kind = "tap") {
  if (!enabled) return;
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(PATTERNS[kind] ?? 6); } catch {}
}

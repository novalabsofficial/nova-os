// Mobile haptics — thin wrapper over the Vibration API.
//
// Works on Android (incl. installed PWA); iOS Safari doesn't expose vibration to
// the web, so it's a graceful no-op there. Patterns are intentionally tiny so
// interactions feel "tactile," not buzzy. Toggle persists in localStorage.

const KEY = "nova:mobile:haptics";
let enabled = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();

// Durations in ms. Android's vibrator effectively ignores anything under
// ~15ms, so everything here is >= 18ms; "feels like a tap" lives around 20-35ms.
const PATTERNS = {
  tap: 20,             // light UI tap
  toggle: 28,          // switch flipped
  open: 30,            // app launched
  pick: 45,            // icon lifted into a drag (firm)
  move: 16,            // crossed into a new reorder slot (light tick)
  drop: 30,            // dropped
  remove: [0, 35, 45, 35],   // removed from home (buzz)
  unlock: [0, 25, 60, 35],   // lock screen released
  error: [0, 45, 60, 45],
};

export function hapticsEnabled() { return enabled; }
export function setHapticsEnabled(v) {
  enabled = !!v;
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch {}
  if (enabled) haptic("tap");
}

export function haptic(kind = "tap") {
  if (!enabled) return;
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(PATTERNS[kind] ?? 6); } catch {}
}

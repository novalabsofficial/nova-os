// Mobile haptics — thin wrapper over the Vibration API.
//
// Works on Android (incl. installed PWA); iOS Safari doesn't expose vibration to
// the web, so it's a graceful no-op there. Patterns are intentionally tiny so
// interactions feel "tactile," not buzzy. Toggle persists in localStorage.

const KEY = "nova:mobile:haptics";
let enabled = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();

const PATTERNS = {
  tap: 6,          // light UI tap
  toggle: 10,      // switch flipped
  open: 12,        // app launched
  pick: 18,        // icon lifted into a drag
  move: 4,         // crossed into a new reorder slot
  drop: 12,        // dropped
  remove: [0, 20], // removed from home
  unlock: [0, 14, 30, 10], // lock screen released
  error: [0, 30, 40, 30],
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

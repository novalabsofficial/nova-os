// Device-mode detection.
//
// "Mode" is the layout/UX class Nova OS uses, not the raw device type. There
// are three:
//   desktop  - full windowed UX, mouse-sized touch targets
//   tablet   - same windowed UX but larger touch targets, pointer events
//   mobile   - phones; we show a "best viewed on larger screen" notice
//
// The detection heuristic uses viewport width plus a touch/coarse-pointer
// signal. The thresholds are chosen so the typical iPad Pro (1024px wide in
// landscape) reads as "tablet" with touch and "desktop" without, and phones
// (< 600px) always read as "mobile".
//
// We keep the function pure-ish by accepting overrides via the `opts`
// parameter — that's how the test suite exercises it without mocking globals.

const VALID_MODES = ["desktop", "tablet", "mobile"];

/**
 * Detect the device mode from the current viewport + input capability.
 *
 * @param {object} [opts] - test overrides:
 *   - width: viewport width in px (default: window.innerWidth)
 *   - hasTouch: boolean, is touch input available
 *   - coarsePointer: boolean, does CSS report a coarse pointer
 * @returns {"desktop"|"tablet"|"mobile"}
 */
export function detectDevice(opts = {}) {
  const width =
    opts.width !== undefined
      ? opts.width
      : typeof window !== "undefined"
        ? window.innerWidth
        : 1280;

  const height =
    opts.height !== undefined
      ? opts.height
      : typeof window !== "undefined"
        ? window.innerHeight
        : 800;

  const hasTouch =
    opts.hasTouch !== undefined
      ? opts.hasTouch
      : typeof window !== "undefined" &&
        ("ontouchstart" in window ||
          (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

  const coarsePointer =
    opts.coarsePointer !== undefined
      ? opts.coarsePointer
      : typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;

  const touchy = !!hasTouch || !!coarsePointer;
  const shortSide = Math.min(width, height);

  // A touch device whose *shorter* edge is phone-sized is a phone in ANY
  // orientation — this keeps the iOS-style shell when the phone is rotated to
  // landscape (where width alone would otherwise exceed the 600px threshold).
  if (touchy && shortSide < 500) return "mobile";
  if (width < 600) return "mobile";
  // Tablet only if the input is touchy. A 1000px-wide laptop with no touch is desktop.
  if (width < 1200 && touchy) return "tablet";
  return "desktop";
}

/**
 * Resolve the *effective* mode after applying the user's saved preference.
 *
 * - If setting is one of "desktop", "tablet", "mobile" → use that explicit choice
 * - If setting is "auto", null, undefined, or any other value → use detected
 *
 * @param {string} setting - user's saved displayMode preference
 * @param {string} detected - the result of detectDevice()
 * @returns {"desktop"|"tablet"|"mobile"}
 */
export function effectiveDeviceMode(setting, detected) {
  if (VALID_MODES.includes(setting)) return setting;
  if (VALID_MODES.includes(detected)) return detected;
  return "desktop";
}

/** Convenience: is the mode one that uses touch-first UI sizing? */
export function isTouchMode(mode) {
  return mode === "tablet" || mode === "mobile";
}

export { VALID_MODES };

// Pure calculator helpers. The CalculatorApp keeps state for the running value
// and pending operator; these functions just do the math and the display
// formatting. Kept separate so the math is unit-testable without touching React.

/**
 * Apply a binary operator to two numbers. Returns a number, or NaN/Infinity
 * for invalid inputs (e.g. divide by zero). Callers should check Number.isFinite.
 *
 * @param {number} a   left operand
 * @param {string} op  one of "+", "-", "×", "*", "÷", "/"
 * @param {number} b   right operand
 * @returns {number}
 */
export function applyOp(a, op, b) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*":
    case "×": return a * b;
    case "/":
    case "÷": return a / b;
    default: return NaN;
  }
}

/**
 * Format a number for the calculator display. Trims trailing zeros, falls
 * back to scientific notation for huge/tiny values, and handles non-finite
 * inputs gracefully so the display never shows "NaN" or "Infinity".
 *
 * @param {number} n
 * @returns {string}
 */
export function formatDisplay(n) {
  if (n === null || n === undefined) return "0";
  if (typeof n !== "number" || Number.isNaN(n)) return "Error";
  if (!Number.isFinite(n)) return "Error";
  const abs = Math.abs(n);
  // Use exponential notation for extremes so they fit in the display
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) {
    return n.toExponential(6).replace(/0+e/, "e").replace(/\.e/, "e");
  }
  // Otherwise, fixed with up to 10 fractional digits, trailing zeros stripped
  const s = n.toFixed(10);
  return s.replace(/\.?0+$/, "");
}

/**
 * Toggle the sign of the input string (the calculator's current entry).
 * Returns the new string. Leaves "0" and empty inputs alone.
 *
 * @param {string} s  display string (e.g. "42", "-3.14", "0")
 * @returns {string}
 */
export function toggleSign(s) {
  if (!s || s === "0" || s === "0." || s === "Error") return s;
  if (s.startsWith("-")) return s.slice(1);
  return "-" + s;
}

/**
 * Append a digit or decimal to the current entry string. Enforces "no two
 * decimals" and "leading zero gets replaced" rules.
 *
 * @param {string} cur   current display string
 * @param {string} key   digit "0"-"9" or "."
 * @returns {string}
 */
export function appendKey(cur, key) {
  if (cur === "Error") cur = "0";
  if (key === ".") {
    if (cur.includes(".")) return cur;
    if (cur === "" || cur === "-") return cur + "0.";
    return cur + ".";
  }
  // Digit
  if (cur === "0") return key;
  if (cur === "-0") return "-" + key;
  return cur + key;
}

// ── v9.5: scientific helpers ───────────────────────────────────────────
// Each scientific function takes the current numeric value and returns
// the result. Wrapped in try/catch by the caller — these can return
// NaN/Infinity for out-of-domain inputs (e.g. log of a negative).
//
// Trig functions default to radians. If the calculator is in "degrees"
// mode, the caller should convert before/after as appropriate.
export function applyScientific(fn, x, degMode = false) {
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  switch (fn) {
    case "sin":  return Math.sin(degMode ? toRad(x) : x);
    case "cos":  return Math.cos(degMode ? toRad(x) : x);
    case "tan":  return Math.tan(degMode ? toRad(x) : x);
    case "asin": return degMode ? toDeg(Math.asin(x)) : Math.asin(x);
    case "acos": return degMode ? toDeg(Math.acos(x)) : Math.acos(x);
    case "atan": return degMode ? toDeg(Math.atan(x)) : Math.atan(x);
    case "ln":   return Math.log(x);
    case "log":  return Math.log10(x);
    case "exp":  return Math.exp(x);
    case "sqrt": return Math.sqrt(x);
    case "cube": return Math.cbrt(x);
    case "sq":   return x * x;
    case "cbe":  return x * x * x;
    case "inv":  return 1 / x;
    case "fact": {
      if (x < 0 || !Number.isInteger(x) || x > 170) return NaN;
      let r = 1; for (let i = 2; i <= x; i++) r *= i; return r;
    }
    case "abs":  return Math.abs(x);
    case "neg":  return -x;
    default: return NaN;
  }
}

// ── v9.5: programmer-mode helpers ──────────────────────────────────────
// Programmer mode works in 32-bit signed integer space. JavaScript's
// bitwise operators are 32-bit, so they're a natural fit. We round
// floats to ints on entry into bitwise ops; negative values use two's
// complement.
export function applyBitwise(a, op, b) {
  const ai = a | 0, bi = b | 0;
  switch (op) {
    case "AND": return ai & bi;
    case "OR":  return ai | bi;
    case "XOR": return ai ^ bi;
    case "<<":  return ai << bi;
    case ">>":  return ai >> bi;
    default: return NaN;
  }
}
/** Format an integer in a given base, signed. */
export function formatInBase(n, base) {
  const i = Math.trunc(n) | 0;
  if (base === 10) return String(i);
  if (i < 0) {
    // Show two's-complement representation for non-base-10 displays.
    const unsigned = i >>> 0;
    return unsigned.toString(base).toUpperCase();
  }
  return i.toString(base).toUpperCase();
}
/** Parse a string in a given base. Returns NaN on garbage input. */
export function parseInBase(s, base) {
  if (!s || s === "Error") return NaN;
  const n = parseInt(s, base);
  if (Number.isNaN(n)) return NaN;
  // Re-interpret as a 32-bit signed int so high bit acts as a sign bit.
  return n | 0;
}

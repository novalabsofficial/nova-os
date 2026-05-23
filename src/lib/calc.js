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

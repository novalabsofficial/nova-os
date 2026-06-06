// Mini-spreadsheet formula engine for the Sheets app. Cells are a flat map
// { "A1": rawString }. A raw value is plain text, a number, or a formula that
// starts with "=". A leading apostrophe forces text ("'007" → 007).
//
// Supports: + - * / ^ % & (concat), comparisons (= <> < > <= >=), parentheses,
// cell refs (A1), ranges (A1:B3), and a library of functions (SUM, AVERAGE, IF,
// MIN/MAX, COUNT, ROUND, …). Circular references resolve to #CIRC rather than
// hanging. Errors surface as #DIV/0, #NAME, #VALUE, #REF, #NUM, #ERR.

export const colName = (i) => {
  let s = ""; i = i | 0;
  do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
  return s;
};
export const colIndex = (name) => {
  let n = 0; for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
export const rcToRef = (r, c) => colName(c) + (r + 1);
export const refToRC = (ref) => {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref); if (!m) return null;
  return { c: colIndex(m[1]), r: parseInt(m[2], 10) - 1 };
};

class FErr extends Error { constructor(code) { super(code); this.code = code; } }
const RANGE = (arr) => ({ __range: arr });
const isRange = (v) => v && typeof v === "object" && Array.isArray(v.__range);

// ── tokenizer ───────────────────────────────────────────────────────────────
function tokenize(src) {
  const toks = []; let i = 0; const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    if ((ch >= "0" && ch <= "9") || (ch === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      let j = i + 1; while (j < n && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      toks.push({ t: "num", v: parseFloat(src.slice(i, j)) }); i = j; continue;
    }
    if (ch === '"') {
      let j = i + 1, s = ""; while (j < n && src[j] !== '"') { s += src[j]; j++; }
      toks.push({ t: "str", v: s }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j); i = j;
      if (/^[A-Za-z]+[0-9]+$/.test(word)) toks.push({ t: "ref", v: word.toUpperCase() });
      else toks.push({ t: "name", v: word.toUpperCase() });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") { toks.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/^(),:%<>=&".includes(ch)) { toks.push({ t: "op", v: ch }); i++; continue; }
    throw new FErr("#ERR");
  }
  toks.push({ t: "eof", v: null });
  return toks;
}

// ── value coercion ────────────────────────────────────────────────────────
const fmtNum = (n) => Math.round(n * 1e10) / 1e10;
function toNum(v) {
  if (isRange(v)) throw new FErr("#VALUE");
  if (v === "" || v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v); if (isNaN(n)) throw new FErr("#VALUE");
  return n;
}
function toStr(v) {
  if (isRange(v)) throw new FErr("#VALUE");
  if (v == null) return "";
  if (typeof v === "number") return String(fmtNum(v));
  return String(v);
}
function truthy(v) {
  if (isRange(v)) v = v.__range[0];
  if (typeof v === "number") return v !== 0;
  if (v === "" || v == null) return false;
  const n = Number(v); if (!isNaN(n)) return n !== 0;
  return String(v).toUpperCase() === "TRUE";
}
const flat = (args) => { const o = []; for (const a of args) { if (isRange(a)) o.push(...a.__range); else o.push(a); } return o; };
const nums = (args) => {
  const o = [];
  for (const v of flat(args)) {
    if (typeof v === "number") { if (isFinite(v)) o.push(v); }
    else if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) o.push(Number(v));
  }
  return o;
};

// ── function library ────────────────────────────────────────────────────────
const FUNCS = {
  SUM: (a) => nums(a).reduce((s, x) => s + x, 0),
  AVERAGE: (a) => { const n = nums(a); if (!n.length) throw new FErr("#DIV/0"); return n.reduce((s, x) => s + x, 0) / n.length; },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => flat(a).filter(v => v !== "" && v != null).length,
  MIN: (a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  PRODUCT: (a) => nums(a).reduce((s, x) => s * x, 1),
  ABS: (a) => Math.abs(toNum(a[0])),
  ROUND: (a) => { const f = Math.pow(10, a[1] != null ? toNum(a[1]) : 0); return Math.round(toNum(a[0]) * f) / f; },
  ROUNDUP: (a) => { const f = Math.pow(10, a[1] != null ? toNum(a[1]) : 0); return Math.ceil(toNum(a[0]) * f) / f; },
  ROUNDDOWN: (a) => { const f = Math.pow(10, a[1] != null ? toNum(a[1]) : 0); return Math.trunc(toNum(a[0]) * f) / f; },
  INT: (a) => Math.floor(toNum(a[0])),
  FLOOR: (a) => Math.floor(toNum(a[0])),
  CEILING: (a) => Math.ceil(toNum(a[0])),
  SQRT: (a) => { const x = toNum(a[0]); if (x < 0) throw new FErr("#NUM"); return Math.sqrt(x); },
  POWER: (a) => Math.pow(toNum(a[0]), toNum(a[1])),
  MOD: (a) => { const d = toNum(a[1]); if (d === 0) throw new FErr("#DIV/0"); return toNum(a[0]) % d; },
  PI: () => Math.PI,
  IF: (a) => truthy(a[0]) ? (a[1] ?? 0) : (a[2] ?? 0),
  AND: (a) => flat(a).every(truthy) ? 1 : 0,
  OR: (a) => flat(a).some(truthy) ? 1 : 0,
  NOT: (a) => truthy(a[0]) ? 0 : 1,
  CONCAT: (a) => flat(a).map(toStr).join(""),
  CONCATENATE: (a) => flat(a).map(toStr).join(""),
  LEN: (a) => toStr(a[0]).length,
  LOWER: (a) => toStr(a[0]).toLowerCase(),
  UPPER: (a) => toStr(a[0]).toUpperCase(),
  TRIM: (a) => toStr(a[0]).trim(),
};

// ── parser (recursive descent) ───────────────────────────────────────────────
function parse(toks, resolve) {
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const eat = (v) => { const t = toks[p]; if (t.t === "op" && t.v === v) { p++; return; } throw new FErr("#ERR"); };

  const expr = () => compare();
  function compare() {
    let l = concat();
    while (peek().t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek().v)) { const op = next().v; l = cmp(op, l, concat()); }
    return l;
  }
  function concat() { let l = add(); while (peek().t === "op" && peek().v === "&") { next(); l = toStr(l) + toStr(add()); } return l; }
  function add() {
    let l = mul();
    while (peek().t === "op" && (peek().v === "+" || peek().v === "-")) { const op = next().v; const r = mul(); l = op === "+" ? toNum(l) + toNum(r) : toNum(l) - toNum(r); }
    return l;
  }
  function mul() {
    let l = pow();
    while (peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = next().v; const r = pow();
      if (op === "*") l = toNum(l) * toNum(r);
      else { const d = toNum(r); if (d === 0) throw new FErr("#DIV/0"); l = toNum(l) / d; }
    }
    return l;
  }
  function pow() { let l = unary(); while (peek().t === "op" && peek().v === "^") { next(); l = Math.pow(toNum(l), toNum(unary())); } return l; }
  function unary() {
    if (peek().t === "op" && (peek().v === "-" || peek().v === "+")) { const op = next().v; const v = unary(); return op === "-" ? -toNum(v) : toNum(v); }
    return primary();
  }
  function primary() {
    const t = peek();
    if (t.t === "num") { next(); return t.v; }
    if (t.t === "str") { next(); return t.v; }
    if (t.t === "op" && t.v === "(") { next(); const v = expr(); eat(")"); return v; }
    if (t.t === "ref") {
      next();
      if (peek().t === "op" && peek().v === ":") {
        next(); const t2 = next(); if (t2.t !== "ref") throw new FErr("#REF");
        const ra = refToRC(t.v), rb = refToRC(t2.v); if (!ra || !rb) throw new FErr("#REF");
        const r1 = Math.min(ra.r, rb.r), r2 = Math.max(ra.r, rb.r), c1 = Math.min(ra.c, rb.c), c2 = Math.max(ra.c, rb.c);
        const arr = [];
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) arr.push(resolve(rcToRef(r, c)));
        return RANGE(arr);
      }
      return resolve(t.v);
    }
    if (t.t === "name") {
      next();
      if (peek().t === "op" && peek().v === "(") {
        next(); const args = [];
        if (!(peek().t === "op" && peek().v === ")")) { args.push(expr()); while (peek().t === "op" && peek().v === ",") { next(); args.push(expr()); } }
        eat(")");
        const f = FUNCS[t.v]; if (!f) throw new FErr("#NAME");
        return f(args);
      }
      if (t.v === "TRUE") return 1;
      if (t.v === "FALSE") return 0;
      throw new FErr("#NAME");
    }
    throw new FErr("#ERR");
  }
  function cmp(op, a, b) {
    let x = a, y = b;
    if (!(typeof a === "number" && typeof b === "number")) { x = toStr(a).toLowerCase(); y = toStr(b).toLowerCase(); }
    switch (op) {
      case "=": return x === y ? 1 : 0; case "<>": return x !== y ? 1 : 0;
      case "<": return x < y ? 1 : 0; case ">": return x > y ? 1 : 0;
      case "<=": return x <= y ? 1 : 0; case ">=": return x >= y ? 1 : 0;
    }
    return 0;
  }
  const out = expr();
  if (peek().t !== "eof") throw new FErr("#ERR");
  return out;
}

// ── evaluator with memo + cycle detection ─────────────────────────────────────
export function makeEvaluator(cells) {
  const cache = new Map();
  function resolve(ref) {
    if (cache.has(ref)) {
      const c = cache.get(ref);
      if (c && c.__pending) throw new FErr("#CIRC");
      return c;
    }
    const raw = cells[ref];
    if (raw === undefined || raw === null || raw === "") { cache.set(ref, ""); return ""; }
    if (typeof raw === "string" && raw[0] === "'") { const s = raw.slice(1); cache.set(ref, s); return s; }
    if (typeof raw === "string" && raw[0] === "=") {
      cache.set(ref, { __pending: true });
      let v;
      try { v = parse(tokenize(raw.slice(1)), resolve); }
      catch (e) { v = (e instanceof FErr) ? e.code : "#ERR"; }
      cache.set(ref, v);
      return v;
    }
    const s = String(raw).trim();
    const num = Number(s);
    const v = (s !== "" && !isNaN(num)) ? num : raw;
    cache.set(ref, v);
    return v;
  }
  const display = (ref) => {
    let v; try { v = resolve(ref); } catch (e) { return (e instanceof FErr) ? e.code : "#ERR"; }
    if (v == null) return "";
    if (isRange(v)) return "#VALUE";
    if (typeof v === "number") return isFinite(v) ? String(fmtNum(v)) : "#NUM";
    return String(v);
  };
  return { value: resolve, display };
}

// Aggregate helper for the selection status bar (Sum / Avg / Count).
export function aggregateRefs(refs, ev) {
  const ns = [];
  let count = 0;
  for (const ref of refs) {
    const v = ev.value(ref);
    if (v !== "" && v != null) count++;
    if (typeof v === "number" && isFinite(v)) ns.push(v);
    else if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) ns.push(Number(v));
  }
  const sum = ns.reduce((s, x) => s + x, 0);
  return { sum: fmtNum(sum), avg: ns.length ? fmtNum(sum / ns.length) : null, count, numCount: ns.length };
}

// v9.5 — Calculator rebuilt as a real multi-mode calculator (Windows 11
// Calculator + macOS Calculator as references). Sidebar mode picker
// switches between four self-contained calculator experiences:
//
//   • Standard    — everyday arithmetic, with a session history strip
//   • Scientific  — trig, logs, exponents, factorial, π / e
//   • Programmer  — DEC/HEX/BIN/OCT with bitwise ops (AND/OR/XOR/<</>>)
//   • Converter   — unit conversions (length, weight, temperature, time)
//
// Layout goals:
//   • Rail on the left (~180 px) with mode icons + history toggle.
//   • Main pane keeps the keypad centered with `max-width: 460px` so a
//     maximized window doesn't stretch buttons into ugly rectangles.
//   • Theme tokens everywhere — matches the v9.5 OS look.

import { useState, useRef, useEffect, useMemo } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import {
  applyOp, formatDisplay, toggleSign, appendKey,
  applyScientific, applyBitwise, formatInBase, parseInBase,
} from "../lib/calc.js";

const MODES = [
  { id: "standard",  label: "Standard",   icon: <StandardGlyph/> },
  { id: "scientific", label: "Scientific", icon: <ScientificGlyph/> },
  { id: "programmer", label: "Programmer", icon: <ProgrammerGlyph/> },
  { id: "converter",  label: "Converter",  icon: <ConverterGlyph/> },
];

export function CalculatorApp({ AC }) {
  const [mode, setMode] = useState("standard");
  const [showHistory, setShowHistory] = useState(false);
  // History is a flat list across modes: { id, mode, expr, result }
  const [history, setHistory] = useState([]);
  function pushHistory(entry) {
    setHistory(h => [{ id: Date.now() + Math.random(), ...entry }, ...h].slice(0, 50));
  }
  function clearHistory() { setHistory([]); }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* ───── SIDEBAR ───── */}
      <div style={{
        width: 180, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        padding: "16px 10px", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 2,
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ padding: "2px 10px 12px", fontFamily: FFB, fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Calculator</div>

        {MODES.map(m => (
          <RailButton
            key={m.id}
            ac={AC}
            active={mode === m.id}
            onClick={() => setMode(m.id)}
            icon={m.icon}
            label={m.label}
          />
        ))}

        <div style={{ height: 14 }} />
        <RailButton
          ac={AC}
          active={showHistory}
          onClick={() => setShowHistory(v => !v)}
          icon={<HistoryGlyph/>}
          label="History"
          badge={history.length || null}
        />
      </div>

      {/* ───── MAIN PANE ───── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Calculator surface — centered, capped width so fullscreen stays usable */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{
            // Center horizontally with a sensible max-width. The window can
            // grow but the buttons stay reasonable.
            flex: 1, minHeight: 0,
            display: "flex", justifyContent: "center", alignItems: "stretch",
            padding: "14px 18px",
            overflow: "auto",
          }}>
            <div style={{
              width: "100%",
              maxWidth: mode === "converter" ? 520 : mode === "programmer" ? 540 : mode === "scientific" ? 560 : 440,
              display: "flex", flexDirection: "column",
              minHeight: 0,
            }}>
              {mode === "standard"   && <StandardCalc   AC={AC} pushHistory={pushHistory} />}
              {mode === "scientific" && <ScientificCalc AC={AC} pushHistory={pushHistory} />}
              {mode === "programmer" && <ProgrammerCalc AC={AC} pushHistory={pushHistory} />}
              {mode === "converter"  && <ConverterCalc  AC={AC} />}
            </div>
          </div>
        </div>

        {/* History side panel */}
        {showHistory && (
          <div style={{
            width: 220, flexShrink: 0,
            borderLeft: "1px solid var(--nv-border)",
            background: "rgba(255,255,255,0.02)",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--nv-border)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)" }}>History</div>
              <div style={{ flex: 1 }}/>
              {history.length > 0 && (
                <button onClick={clearHistory} className="dl" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.5)", fontSize: 10.5, fontFamily: FFB, fontWeight: 600 }}>Clear</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px 12px", minHeight: 0 }}>
              {history.length === 0 ? (
                <div style={{ padding: "20px 8px", fontSize: 11, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center", lineHeight: 1.6 }}>
                  No history yet
                </div>
              ) : history.map(h => (
                <div key={h.id} style={{ padding: "8px 10px", marginBottom: 4, borderRadius: 7, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)" }}>
                  <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 2 }}>{h.mode}</div>
                  <div style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.expr}</div>
                  <div style={{ fontFamily: FFM, fontSize: 14, color: "var(--nv-text-strong)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>= {h.result}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── shared bits ──────────────────────────────────

function RailButton({ ac, active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8,
      background: active ? fill(ac) : "transparent",
      border: "1px solid " + (active ? bdr(ac) : "transparent"),
      cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
      color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%",
      transition: "background 0.12s, color 0.12s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ display: "flex", flexShrink: 0, color: active ? ac : "var(--nv-text-dim)" }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && <span style={{ fontFamily: FFM, fontSize: 10.5, color: active ? ac : "var(--nv-text-dim)", opacity: 0.85 }}>{badge}</span>}
    </button>
  );
}

// Display panel — used by Standard / Scientific / Programmer.
function Display({ value, sub, AC, large = false, mono = true }) {
  return (
    <div style={{
      flexShrink: 0,
      padding: "26px 18px 22px",
      background: "rgba(0,0,0,0.25)",
      borderRadius: 14,
      border: "1px solid var(--nv-border)",
      textAlign: "right",
      minHeight: large ? 110 : 90,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      overflow: "hidden",
      marginBottom: 12,
    }}>
      {sub && (
        <div style={{ fontFamily: FFM, fontSize: 12, color: "var(--nv-text-dim)", marginBottom: 6, minHeight: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      )}
      <div style={{
        fontFamily: mono ? FFM : FF,
        fontWeight: 500,
        // Scale font down for long values so nothing wraps mid-digit.
        fontSize: value.length > 12 ? 30 : value.length > 8 ? 38 : 44,
        color: "var(--nv-text-strong)",
        letterSpacing: 1,
        lineHeight: 1.05,
        wordBreak: "break-all",
      }}>{value}</div>
    </div>
  );
}

// Standard button. Variants:
//   • default — neutral key
//   • op      — operator (×, ÷, +, -)
//   • accent  — = button
//   • danger  — AC
//   • muted   — subtle (scientific extras, etc.)
function KeyBtn({ children, onClick, variant, span, AC, height, fontSize, title }) {
  const styles = {
    default: { background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", color: "var(--nv-text-strong)" },
    op:      { background: "rgba(255,255,255,0.10)", border: "1px solid var(--nv-border-strong)", color: "var(--nv-text-strong)" },
    accent:  { background: AC, border: "1px solid " + AC, color: "#fff" },
    danger:  { background: fill(AC), border: "1px solid " + bdr(AC), color: AC },
    muted:   { background: "transparent", border: "1px solid var(--nv-border)", color: "var(--nv-text-dim)" },
  };
  const s = styles[variant || "default"];
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        height: height || 52,
        borderRadius: 12,
        cursor: "pointer",
        fontFamily: FFB, fontWeight: 600,
        fontSize: fontSize || 17,
        gridColumn: span ? "span " + span : undefined,
        transition: "background 0.12s, transform 0.06s",
        touchAction: "manipulation",
        userSelect: "none",
        ...s,
      }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >{children}</button>
  );
}

// ───────────────────────── Standard ─────────────────────────────────────

function StandardCalc({ AC, pushHistory }) {
  const [display, setDisplay] = useState("0");
  const [pending, setPending] = useState(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => { wrapRef.current?.focus(); }, []);

  // Hold-to-repeat backspace via interval (same approach as the v9.0 fix).
  const repeatRef = useRef(null);
  const bsRef = useRef(null);
  function stopRepeat() { if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; } }
  useEffect(() => () => stopRepeat(), []);

  function pressDigit(d) {
    if (justEvaluated) { setDisplay(d === "." ? "0." : d); setJustEvaluated(false); return; }
    setDisplay(prev => appendKey(prev, d));
  }
  function pressOp(op) {
    const cur = parseFloat(display);
    if (pending && !justEvaluated) {
      const r = applyOp(pending.prev, pending.op, cur);
      setDisplay(formatDisplay(r));
      setPending({ prev: r, op });
    } else {
      setPending({ prev: cur, op });
    }
    setJustEvaluated(true);
  }
  function pressEquals() {
    if (!pending) return;
    const cur = parseFloat(display);
    const r = applyOp(pending.prev, pending.op, cur);
    const result = formatDisplay(r);
    pushHistory({ mode: "Standard", expr: formatDisplay(pending.prev) + " " + pending.op + " " + display, result });
    setDisplay(result); setPending(null); setJustEvaluated(true);
  }
  function pressClear() { setDisplay("0"); setPending(null); setJustEvaluated(false); }
  function pressSign() { setDisplay(s => toggleSign(s)); }
  function pressPercent() { const n = parseFloat(display); setDisplay(formatDisplay(n / 100)); setJustEvaluated(true); }
  function pressBackspace() {
    if (justEvaluated) { pressClear(); return; }
    setDisplay(s => (s.length <= 1 || (s.length === 2 && s.startsWith("-"))) ? "0" : s.slice(0, -1));
  }
  bsRef.current = pressBackspace;

  function onKeyDown(e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) { e.preventDefault(); pressDigit(k); return; }
    if (k === ".") { e.preventDefault(); pressDigit("."); return; }
    if (k === "+") { e.preventDefault(); pressOp("+"); return; }
    if (k === "-") { e.preventDefault(); pressOp("-"); return; }
    if (k === "*") { e.preventDefault(); pressOp("×"); return; }
    if (k === "/") { e.preventDefault(); pressOp("÷"); return; }
    if (k === "Enter" || k === "=") { e.preventDefault(); pressEquals(); return; }
    if (k === "Backspace") { e.preventDefault(); if (e.repeat) return; pressBackspace(); stopRepeat(); repeatRef.current = setInterval(() => { bsRef.current && bsRef.current(); }, 90); return; }
    if (k === "Escape") { e.preventDefault(); pressClear(); return; }
    if (k === "%") { e.preventDefault(); pressPercent(); return; }
  }

  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown} onKeyUp={stopRepeat} onBlur={stopRepeat}
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, outline: "none" }}>
      <Display value={display} sub={pending ? formatDisplay(pending.prev) + " " + pending.op : ""} AC={AC}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, flex: 1 }}>
        <KeyBtn variant="danger" AC={AC} onClick={pressClear}>AC</KeyBtn>
        <KeyBtn onClick={pressSign}>±</KeyBtn>
        <KeyBtn onClick={pressPercent}>%</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("÷")}>÷</KeyBtn>

        <KeyBtn onClick={() => pressDigit("7")}>7</KeyBtn>
        <KeyBtn onClick={() => pressDigit("8")}>8</KeyBtn>
        <KeyBtn onClick={() => pressDigit("9")}>9</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("×")}>×</KeyBtn>

        <KeyBtn onClick={() => pressDigit("4")}>4</KeyBtn>
        <KeyBtn onClick={() => pressDigit("5")}>5</KeyBtn>
        <KeyBtn onClick={() => pressDigit("6")}>6</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("-")}>−</KeyBtn>

        <KeyBtn onClick={() => pressDigit("1")}>1</KeyBtn>
        <KeyBtn onClick={() => pressDigit("2")}>2</KeyBtn>
        <KeyBtn onClick={() => pressDigit("3")}>3</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("+")}>+</KeyBtn>

        <KeyBtn span={2} onClick={() => pressDigit("0")}>0</KeyBtn>
        <KeyBtn onClick={() => pressDigit(".")}>.</KeyBtn>
        <KeyBtn variant="accent" AC={AC} onClick={pressEquals}>=</KeyBtn>

        <KeyBtn span={4} height={38} fontSize={13} onClick={pressBackspace}>⌫</KeyBtn>
      </div>
    </div>
  );
}

// ───────────────────────── Scientific ───────────────────────────────────

function ScientificCalc({ AC, pushHistory }) {
  const [display, setDisplay] = useState("0");
  const [pending, setPending] = useState(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [degMode, setDegMode] = useState(true);     // false = radians

  function pressDigit(d) {
    if (justEvaluated) { setDisplay(d === "." ? "0." : d); setJustEvaluated(false); return; }
    setDisplay(prev => appendKey(prev, d));
  }
  function pressOp(op) {
    const cur = parseFloat(display);
    if (pending && !justEvaluated) {
      const r = applyOp(pending.prev, pending.op, cur);
      setDisplay(formatDisplay(r));
      setPending({ prev: r, op });
    } else {
      setPending({ prev: cur, op });
    }
    setJustEvaluated(true);
  }
  function pressEquals() {
    if (!pending) return;
    const cur = parseFloat(display);
    const r = applyOp(pending.prev, pending.op, cur);
    const result = formatDisplay(r);
    pushHistory({ mode: "Scientific", expr: formatDisplay(pending.prev) + " " + pending.op + " " + display, result });
    setDisplay(result); setPending(null); setJustEvaluated(true);
  }
  function pressClear() { setDisplay("0"); setPending(null); setJustEvaluated(false); }
  function unary(fn, label) {
    const cur = parseFloat(display);
    const r = applyScientific(fn, cur, degMode);
    const result = formatDisplay(r);
    pushHistory({ mode: "Scientific", expr: label + "(" + display + ")", result });
    setDisplay(result); setJustEvaluated(true);
  }
  function insertConstant(val, label) {
    setDisplay(formatDisplay(val)); setJustEvaluated(true);
  }
  function power() {
    // x^y → set up a pending operator. Use "^" so the routing below knows how.
    pressOp("^");
  }
  // Extend applyOp for "^"
  function applyOpExt(a, op, b) {
    if (op === "^") return Math.pow(a, b);
    return applyOp(a, op, b);
  }
  // Override equals to honor ^.
  function pressEqualsExt() {
    if (!pending) return;
    const cur = parseFloat(display);
    const r = applyOpExt(pending.prev, pending.op, cur);
    const result = formatDisplay(r);
    pushHistory({ mode: "Scientific", expr: formatDisplay(pending.prev) + " " + pending.op + " " + display, result });
    setDisplay(result); setPending(null); setJustEvaluated(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* DEG/RAD toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexShrink: 0 }}>
        <button onClick={() => setDegMode(true)} style={pillBtn(degMode, AC)}>DEG</button>
        <button onClick={() => setDegMode(false)} style={pillBtn(!degMode, AC)}>RAD</button>
        <div style={{ flex: 1 }}/>
        <div style={{ alignSelf: "center", fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 0.4 }}>{degMode ? "Angles in degrees" : "Angles in radians"}</div>
      </div>

      <Display value={display} sub={pending ? formatDisplay(pending.prev) + " " + pending.op : ""} AC={AC}/>

      {/* Scientific row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 6 }}>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("sin", "sin")}>sin</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("cos", "cos")}>cos</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("tan", "tan")}>tan</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => unary("ln", "ln")}>ln</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => unary("log", "log₁₀")}>log</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => unary("exp", "e^")}>e<sup>x</sup></KeyBtn>

        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("sq", "sqr")}>x²</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("cbe", "cube")}>x³</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={power} title="x to the power of y">xʸ</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("sqrt", "√")}>√</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("inv", "1/")}>1/x</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("fact", "fact")}>n!</KeyBtn>

        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => insertConstant(Math.PI, "π")}>π</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => insertConstant(Math.E, "e")}>e</KeyBtn>
        <KeyBtn variant="muted" fontSize={13} height={42} onClick={() => unary("abs", "abs")}>|x|</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => unary("asin", "asin")}>sin⁻¹</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => unary("acos", "acos")}>cos⁻¹</KeyBtn>
        <KeyBtn variant="muted" fontSize={12} height={42} onClick={() => unary("atan", "atan")}>tan⁻¹</KeyBtn>
      </div>

      {/* Standard keypad — same layout as Standard */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, flex: 1 }}>
        <KeyBtn variant="danger" AC={AC} onClick={pressClear}>AC</KeyBtn>
        <KeyBtn onClick={() => setDisplay(s => toggleSign(s))}>±</KeyBtn>
        <KeyBtn onClick={() => { const n = parseFloat(display); setDisplay(formatDisplay(n / 100)); setJustEvaluated(true); }}>%</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("÷")}>÷</KeyBtn>

        <KeyBtn onClick={() => pressDigit("7")}>7</KeyBtn>
        <KeyBtn onClick={() => pressDigit("8")}>8</KeyBtn>
        <KeyBtn onClick={() => pressDigit("9")}>9</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("×")}>×</KeyBtn>

        <KeyBtn onClick={() => pressDigit("4")}>4</KeyBtn>
        <KeyBtn onClick={() => pressDigit("5")}>5</KeyBtn>
        <KeyBtn onClick={() => pressDigit("6")}>6</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("-")}>−</KeyBtn>

        <KeyBtn onClick={() => pressDigit("1")}>1</KeyBtn>
        <KeyBtn onClick={() => pressDigit("2")}>2</KeyBtn>
        <KeyBtn onClick={() => pressDigit("3")}>3</KeyBtn>
        <KeyBtn variant="op" onClick={() => pressOp("+")}>+</KeyBtn>

        <KeyBtn span={2} onClick={() => pressDigit("0")}>0</KeyBtn>
        <KeyBtn onClick={() => pressDigit(".")}>.</KeyBtn>
        <KeyBtn variant="accent" AC={AC} onClick={pressEqualsExt}>=</KeyBtn>
      </div>
    </div>
  );
}

function pillBtn(active, AC) {
  return {
    padding: "5px 14px", borderRadius: 8, cursor: "pointer",
    background: active ? fill(AC) : "var(--nv-elevated)",
    border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"),
    color: active ? AC : "var(--nv-text)",
    fontFamily: FFB, fontWeight: 600, fontSize: 11, letterSpacing: 0.4,
  };
}

// ───────────────────────── Programmer ───────────────────────────────────

function ProgrammerCalc({ AC, pushHistory }) {
  // Programmer mode keeps a single integer value `intValue` and renders it
  // in four bases simultaneously. The "display" string is the current
  // entry in the active base; switching base re-renders intValue.
  const [intValue, setIntValue] = useState(0);
  const [base, setBase] = useState(10);   // active input base: 10/16/2/8
  const [entry, setEntry] = useState("0"); // current input string in active base
  const [pending, setPending] = useState(null); // { prev, op }  — op may be standard or bitwise
  const [justEvaluated, setJustEvaluated] = useState(false);

  // Whenever base changes, re-format intValue into the new base for the entry.
  function switchBase(newBase) {
    if (newBase === base) return;
    setBase(newBase);
    setEntry(formatInBase(intValue, newBase));
    setJustEvaluated(true);
  }

  // Press a digit in the current base. Reject digits invalid for the base.
  function pressDigit(d) {
    const validChars = base === 16 ? /^[0-9A-F]$/i
                     : base === 10 ? /^[0-9]$/
                     : base === 8  ? /^[0-7]$/
                     :               /^[01]$/;
    if (!validChars.test(d)) return;
    if (justEvaluated) {
      setEntry(d.toUpperCase());
      const n = parseInBase(d.toUpperCase(), base);
      setIntValue(n); setJustEvaluated(false);
      return;
    }
    const next = entry === "0" ? d.toUpperCase() : entry + d.toUpperCase();
    setEntry(next);
    const n = parseInBase(next, base);
    if (!Number.isNaN(n)) setIntValue(n);
  }
  function pressBackspace() {
    if (justEvaluated) { setEntry("0"); setIntValue(0); setJustEvaluated(false); return; }
    setEntry(s => {
      const next = s.length <= 1 || (s.length === 2 && s.startsWith("-")) ? "0" : s.slice(0, -1);
      const n = parseInBase(next, base);
      if (!Number.isNaN(n)) setIntValue(n);
      return next;
    });
  }
  function pressClear() {
    setEntry("0"); setIntValue(0); setPending(null); setJustEvaluated(false);
  }
  function pressOp(op) {
    const cur = intValue;
    if (pending && !justEvaluated) {
      const r = isBitwise(pending.op) ? applyBitwise(pending.prev, pending.op, cur) : applyOp(pending.prev, pending.op, cur);
      const ri = Math.trunc(r) | 0;
      setIntValue(ri); setEntry(formatInBase(ri, base));
      setPending({ prev: ri, op });
    } else {
      setPending({ prev: cur, op });
    }
    setJustEvaluated(true);
  }
  function pressEquals() {
    if (!pending) return;
    const cur = intValue;
    const r = isBitwise(pending.op) ? applyBitwise(pending.prev, pending.op, cur) : applyOp(pending.prev, pending.op, cur);
    const ri = Math.trunc(r) | 0;
    pushHistory({
      mode: "Programmer",
      expr: formatInBase(pending.prev, base) + " " + pending.op + " " + formatInBase(cur, base) + "  (base " + base + ")",
      result: formatInBase(ri, base),
    });
    setIntValue(ri); setEntry(formatInBase(ri, base)); setPending(null); setJustEvaluated(true);
  }
  function isBitwise(op) { return ["AND", "OR", "XOR", "<<", ">>"].includes(op); }
  function pressNot() {
    const r = (~intValue) | 0;
    pushHistory({ mode: "Programmer", expr: "NOT " + formatInBase(intValue, base), result: formatInBase(r, base) });
    setIntValue(r); setEntry(formatInBase(r, base)); setJustEvaluated(true);
  }

  // Which digit keys are enabled in the current base?
  const digitEnabled = (d) => {
    const v = parseInt(d, 16);
    if (base === 2)  return v < 2;
    if (base === 8)  return v < 8;
    if (base === 10) return v < 10;
    return v < 16;
  };
  function progDigitBtn(d) {
    const enabled = digitEnabled(d);
    return (
      <button
        key={d}
        onClick={() => pressDigit(d)}
        disabled={!enabled}
        style={{
          height: 44, borderRadius: 10, cursor: enabled ? "pointer" : "default",
          background: enabled ? "var(--nv-elevated)" : "transparent",
          border: "1px solid " + (enabled ? "var(--nv-border)" : "var(--nv-border)"),
          color: enabled ? "var(--nv-text-strong)" : "rgba(255,255,255,0.18)",
          fontFamily: FFB, fontWeight: 600, fontSize: 14,
          opacity: enabled ? 1 : 0.55,
          transition: "background 0.12s",
        }}
      >{d}</button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Base switcher pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexShrink: 0 }}>
        {[{ b: 16, label: "HEX" }, { b: 10, label: "DEC" }, { b: 8, label: "OCT" }, { b: 2, label: "BIN" }].map(p => (
          <button key={p.b} onClick={() => switchBase(p.b)} style={pillBtn(base === p.b, AC)}>{p.label}</button>
        ))}
      </div>

      {/* Multi-base display */}
      <div style={{
        padding: "14px 16px",
        background: "rgba(0,0,0,0.25)",
        borderRadius: 14,
        border: "1px solid var(--nv-border)",
        marginBottom: 12,
        flexShrink: 0,
      }}>
        {[16, 10, 8, 2].map(b => {
          const isActive = b === base;
          const label = b === 16 ? "HEX" : b === 10 ? "DEC" : b === 8 ? "OCT" : "BIN";
          // For binary, group nibbles for readability.
          let val = isActive ? entry : formatInBase(intValue, b);
          if (b === 2) val = val.replace(/(.{4})(?=.)/g, "$1 ");
          return (
            <div key={b} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "3px 0" }}>
              <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9.5, color: "var(--nv-text-dim)", letterSpacing: 0.8, minWidth: 30 }}>{label}</span>
              <span style={{
                fontFamily: FFM,
                fontSize: isActive ? 22 : 12,
                color: isActive ? "var(--nv-text-strong)" : "var(--nv-text-dim)",
                letterSpacing: 0.5,
                fontWeight: isActive ? 500 : 400,
                flex: 1, minWidth: 0, textAlign: "right",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{val}</span>
            </div>
          );
        })}
        {pending && (
          <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 6, textAlign: "right" }}>
            {formatInBase(pending.prev, base)} {pending.op}
          </div>
        )}
      </div>

      {/* Bitwise ops row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 6 }}>
        <KeyBtn variant="muted" fontSize={11} height={40} onClick={() => pressOp("AND")}>AND</KeyBtn>
        <KeyBtn variant="muted" fontSize={11} height={40} onClick={() => pressOp("OR")}>OR</KeyBtn>
        <KeyBtn variant="muted" fontSize={11} height={40} onClick={() => pressOp("XOR")}>XOR</KeyBtn>
        <KeyBtn variant="muted" fontSize={11} height={40} onClick={pressNot}>NOT</KeyBtn>
        <KeyBtn variant="muted" fontSize={11} height={40} onClick={() => pressOp("<<")}>{"<<"}</KeyBtn>
        <KeyBtn variant="muted" fontSize={11} height={40} onClick={() => pressOp(">>")}>{">>"}</KeyBtn>
      </div>

      {/* Digit keypad: 4 cols of hex digits + standard ops on the right */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, flex: 1 }}>
        {progDigitBtn("D")}{progDigitBtn("E")}{progDigitBtn("F")}
        <KeyBtn variant="danger" AC={AC} fontSize={13} height={44} onClick={pressClear}>AC</KeyBtn>
        <KeyBtn fontSize={13} height={44} onClick={pressBackspace}>⌫</KeyBtn>
        <KeyBtn variant="op" fontSize={14} height={44} onClick={() => pressOp("÷")}>÷</KeyBtn>
        <KeyBtn variant="op" fontSize={14} height={44} onClick={() => pressOp("×")}>×</KeyBtn>

        {progDigitBtn("A")}{progDigitBtn("B")}{progDigitBtn("C")}
        {progDigitBtn("7")}{progDigitBtn("8")}{progDigitBtn("9")}
        <KeyBtn variant="op" fontSize={14} height={44} onClick={() => pressOp("-")}>−</KeyBtn>

        {progDigitBtn("4")}{progDigitBtn("5")}{progDigitBtn("6")}
        {progDigitBtn("1")}{progDigitBtn("2")}{progDigitBtn("3")}
        <KeyBtn variant="op" fontSize={14} height={44} onClick={() => pressOp("+")}>+</KeyBtn>

        {progDigitBtn("0")}
        <KeyBtn fontSize={13} height={44} onClick={() => { const r = (-intValue) | 0; setIntValue(r); setEntry(formatInBase(r, base)); setJustEvaluated(true); }}>±</KeyBtn>
        <button onClick={() => {}} style={{ visibility: "hidden", height: 44 }}></button>
        <KeyBtn variant="accent" AC={AC} span={4} fontSize={14} height={44} onClick={pressEquals}>=</KeyBtn>
      </div>
    </div>
  );
}

// ───────────────────────── Converter ────────────────────────────────────

// Conversion tables. Each entry maps a unit to a "base unit" multiplier.
// Temperature is special-cased because it's affine, not linear.
const CONV_CATEGORIES = {
  Length: {
    base: "Meters",
    units: {
      "Millimeters": 0.001, "Centimeters": 0.01, "Meters": 1, "Kilometers": 1000,
      "Inches": 0.0254, "Feet": 0.3048, "Yards": 0.9144, "Miles": 1609.344,
    },
  },
  Weight: {
    base: "Kilograms",
    units: {
      "Milligrams": 0.000001, "Grams": 0.001, "Kilograms": 1, "Metric tons": 1000,
      "Ounces": 0.0283495, "Pounds": 0.453592, "Stone": 6.35029,
    },
  },
  Temperature: {
    base: "Celsius",
    // Special handling in convert() — these multipliers aren't used directly.
    units: { "Celsius": 1, "Fahrenheit": 1, "Kelvin": 1 },
  },
  Time: {
    base: "Seconds",
    units: {
      "Milliseconds": 0.001, "Seconds": 1, "Minutes": 60, "Hours": 3600,
      "Days": 86400, "Weeks": 604800, "Years": 31557600,
    },
  },
  "Data size": {
    base: "Bytes",
    units: {
      "Bits": 0.125, "Bytes": 1, "Kilobytes": 1024, "Megabytes": 1048576,
      "Gigabytes": 1073741824, "Terabytes": 1099511627776,
    },
  },
  Speed: {
    base: "Meters per second",
    units: {
      "Meters per second": 1, "Kilometers per hour": 0.277778,
      "Miles per hour": 0.44704, "Knots": 0.514444, "Feet per second": 0.3048,
    },
  },
};

function convert(category, fromUnit, toUnit, value) {
  if (category === "Temperature") {
    // Convert into Celsius then out.
    let c;
    if (fromUnit === "Celsius")    c = value;
    else if (fromUnit === "Fahrenheit") c = (value - 32) * 5 / 9;
    else if (fromUnit === "Kelvin")     c = value - 273.15;
    if (toUnit === "Celsius")    return c;
    if (toUnit === "Fahrenheit") return c * 9 / 5 + 32;
    if (toUnit === "Kelvin")     return c + 273.15;
    return NaN;
  }
  const cat = CONV_CATEGORIES[category];
  if (!cat) return NaN;
  const fromMul = cat.units[fromUnit];
  const toMul = cat.units[toUnit];
  if (fromMul == null || toMul == null) return NaN;
  return (value * fromMul) / toMul;
}

function ConverterCalc({ AC }) {
  const [category, setCategory] = useState("Length");
  const cat = CONV_CATEGORIES[category];
  const unitList = Object.keys(cat.units);
  const [fromUnit, setFromUnit] = useState(unitList[0]);
  const [toUnit, setToUnit] = useState(unitList[1] || unitList[0]);
  const [fromVal, setFromVal] = useState("1");

  // Whenever the category changes, reset the picks so the dropdowns
  // don't show stale values.
  useEffect(() => {
    const list = Object.keys(CONV_CATEGORIES[category].units);
    setFromUnit(list[0]);
    setToUnit(list[1] || list[0]);
  }, [category]);

  const result = useMemo(() => {
    const n = parseFloat(fromVal);
    if (Number.isNaN(n)) return "";
    const r = convert(category, fromUnit, toUnit, n);
    return formatDisplay(r);
  }, [category, fromUnit, toUnit, fromVal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      {/* Category chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
        {Object.keys(CONV_CATEGORIES).map(k => (
          <button key={k} onClick={() => setCategory(k)} style={pillBtn(category === k, AC)}>{k}</button>
        ))}
      </div>

      {/* From */}
      <div>
        <label style={{ display: "block", fontFamily: FFB, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 0.6, marginBottom: 7, textTransform: "uppercase" }}>From</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={fromVal}
            onChange={e => setFromVal(e.target.value)}
            placeholder="0"
            style={{ ...INP, flex: 1, fontFamily: FFM, fontSize: 22, padding: "12px 14px", textAlign: "right" }}
          />
          <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} style={{ ...INP, width: 180, cursor: "pointer", fontSize: 13 }}>
            {unitList.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Swap */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => { const a = fromUnit, b = toUnit; setFromUnit(b); setToUnit(a); setFromVal(result || fromVal); }}
          title="Swap units"
          style={{
            width: 36, height: 36, borderRadius: 18,
            background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
            cursor: "pointer", color: "var(--nv-text)", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >⇅</button>
      </div>

      {/* To */}
      <div>
        <label style={{ display: "block", fontFamily: FFB, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 0.6, marginBottom: 7, textTransform: "uppercase" }}>To</label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, padding: "12px 14px",
            background: "rgba(0,0,0,0.25)", border: "1px solid var(--nv-border)",
            borderRadius: 9,
            fontFamily: FFM, fontSize: 22, color: "var(--nv-text-strong)",
            textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{result || "—"}</div>
          <select value={toUnit} onChange={e => setToUnit(e.target.value)} style={{ ...INP, width: 180, cursor: "pointer", fontSize: 13 }}>
            {unitList.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)", textAlign: "center", marginTop: "auto", paddingBottom: 8 }}>
        Pick a category, type a value, and the conversion updates live.
      </div>
    </div>
  );
}

// ───────────────────────── Glyphs ────────────────────────────────────────
const svgProps = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };
function StandardGlyph()   { return (<svg {...svgProps}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h3M13 12h3M8 17h3M13 17h3"/></svg>); }
function ScientificGlyph() { return (<svg {...svgProps}><path d="M4 4h16v6H4z"/><path d="M4 14l4 6 4-6 4 6 4-6"/></svg>); }
function ProgrammerGlyph() { return (<svg {...svgProps}><path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16"/></svg>); }
function ConverterGlyph()  { return (<svg {...svgProps}><path d="M7 4v6M4 7h6M14 17h6M16 14l-3 3 3 3"/></svg>); }
function HistoryGlyph()    { return (<svg {...svgProps}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></svg>); }

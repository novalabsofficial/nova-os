// v10.0 Supernova — Paint, reworked into a proper little editor.
//
// What's new vs the old single-row pen/eraser:
//   • Tool rail: brush, eraser, line, rectangle, ellipse, fill bucket,
//     eyedropper — each with a keyboard shortcut.
//   • Shape fill toggle + brush size + opacity.
//   • Full undo AND redo (snapshot stacks).
//   • Live shape preview on a separate overlay canvas (the in-progress
//     rectangle/ellipse/line is drawn on top and only committed on release).
//   • Recent-colors strip + palette + custom picker + eyedropper.
//   • Import an image onto the canvas, save as PNG, or set it as the wallpaper.
//
// Architecture: a fixed-resolution base canvas (committed pixels) with an
// overlay canvas stacked on top for previews. Pointer events live on the
// overlay; brush/eraser draw straight to base, shapes preview on the overlay
// and commit to base on pointer-up.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { PAINT_COLORS } from "../ui/constants.js";

const CW = 1000, CH = 680;          // internal canvas resolution
const BG = "#ffffff";               // paper / eraser color
const UNDO_LIMIT = 24;

const TOOLS = [
  { id: "brush",   label: "Brush",      key: "B" },
  { id: "eraser",  label: "Eraser",     key: "E" },
  { id: "line",    label: "Line",       key: "L" },
  { id: "rect",    label: "Rectangle",  key: "R" },
  { id: "ellipse", label: "Ellipse",    key: "O" },
  { id: "fill",    label: "Fill",       key: "G" },
  { id: "pick",    label: "Eyedropper", key: "I" },
];

// ── small color helpers ─────────────────────────────────────────────────
function hexToRgb(h) {
  let c = (h || "#000").replace("#", "");
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

// ── tool icons (crisp inline SVG, inherit currentColor) ──────────────────
function ToolIcon({ id, size = 18 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "brush":   return <svg {...p}><path d="M4 20s1-3 3-4M14.5 5.5l4 4M16 4.5l3.5 3.5c.6.6.6 1.5 0 2L11 18.5l-4-4 8.5-8.5c.5-.6 1.4-.6 2-0z" /><path d="M7 14.5C5 15 4 17 4 20c3 0 5-1 5.5-3" fill="currentColor" stroke="none" /></svg>;
    case "eraser":  return <svg {...p}><path d="M8 20h11" /><path d="M14.5 5.5 20 11 11 20H7l-3.5-3.5a1.5 1.5 0 0 1 0-2L13 5.5a1.5 1.5 0 0 1 1.5 0z" /></svg>;
    case "line":    return <svg {...p}><path d="M5 19 19 5" /></svg>;
    case "rect":    return <svg {...p}><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>;
    case "ellipse": return <svg {...p}><ellipse cx="12" cy="12" rx="8" ry="6" /></svg>;
    case "fill":    return <svg {...p}><path d="M5 11 12 4l7 7-7 7z" /><path d="M19 14c1.5 2 1.5 4 0 4s-1.5-2 0-4z" fill="currentColor" stroke="none" /><path d="M3 22h18" /></svg>;
    case "pick":    return <svg {...p}><path d="M19 3a2 2 0 0 1 2 2l-1.5 1.5-2-2L19 3zM16.5 6.5l1 1L8 17l-3 1 1-3 10.5-9.5z" /></svg>;
    default:        return null;
  }
}

export function PaintApp({ showToast, AC, onSetWallpaper }) {
  const baseRef = useRef(null);
  const overRef = useRef(null);
  const fileRef = useRef(null);
  const drawRef = useRef(null);                 // { x0,y0,lastX,lastY, active }
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [filled, setFilled] = useState(false);  // shape fill vs outline
  const [recent, setRecent] = useState([]);
  const [undoN, setUndoN] = useState(0);
  const [redoN, setRedoN] = useState(0);

  const ctxBase = () => baseRef.current.getContext("2d");
  const ctxOver = () => overRef.current.getContext("2d");

  // init paper
  useEffect(() => {
    const ctx = ctxBase();
    ctx.fillStyle = BG; ctx.fillRect(0, 0, CW, CH);
  }, []);

  // ── undo / redo (snapshot stacks) ──────────────────────────────────────
  const sync = () => { setUndoN(undoStack.current.length); setRedoN(redoStack.current.length); };
  const snapshot = () => ctxBase().getImageData(0, 0, CW, CH);
  const restore = (snap) => ctxBase().putImageData(snap, 0, 0);
  function beginAction() {
    undoStack.current.push(snapshot());
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    sync();
  }
  function undo() {
    if (!undoStack.current.length) return;
    redoStack.current.push(snapshot());
    restore(undoStack.current.pop());
    sync();
  }
  function redo() {
    if (!redoStack.current.length) return;
    undoStack.current.push(snapshot());
    restore(redoStack.current.pop());
    sync();
  }

  function useColor(c) {
    setColor(c);
    setRecent(r => [c, ...r.filter(x => x.toLowerCase() !== c.toLowerCase())].slice(0, 8));
    if (tool === "eraser" || tool === "pick") setTool("brush");
  }

  // ── coordinate mapping (display px → internal px) ──────────────────────
  function gp(e) {
    const r = overRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (CW / r.width), y: (e.clientY - r.top) * (CH / r.height) };
  }

  // configure a context for the current stroke
  function styleStroke(ctx, eraser) {
    ctx.globalAlpha = eraser ? 1 : opacity;
    ctx.strokeStyle = eraser ? BG : color;
    ctx.fillStyle = eraser ? BG : color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function drawShape(ctx, t, x0, y0, x1, y1) {
    if (t === "line") {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    } else if (t === "rect") {
      const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (filled) ctx.fillRect(x, y, w, h); else ctx.strokeRect(x, y, w, h);
    } else if (t === "ellipse") {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (filled) ctx.fill(); else ctx.stroke();
    }
  }

  // ── flood fill (4-neighbour, tolerance, visited guard) ─────────────────
  function floodFill(sx, sy) {
    sx = Math.floor(sx); sy = Math.floor(sy);
    if (sx < 0 || sy < 0 || sx >= CW || sy >= CH) return;
    const ctx = ctxBase();
    const img = ctx.getImageData(0, 0, CW, CH);
    const d = img.data;
    const start = (sy * CW + sx) * 4;
    const tr = d[start], tg = d[start + 1], tb = d[start + 2], ta = d[start + 3];
    const [fr, fg, fb] = hexToRgb(color);
    const fa = Math.round(opacity * 255);
    if (Math.abs(tr - fr) < 3 && Math.abs(tg - fg) < 3 && Math.abs(tb - fb) < 3 && Math.abs(ta - fa) < 3) return;
    const tol = 36;
    const match = (i) => Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol && Math.abs(d[i + 2] - tb) <= tol && Math.abs(d[i + 3] - ta) <= tol;
    const visited = new Uint8Array(CW * CH);
    const stack = [sy * CW + sx];
    while (stack.length) {
      const p = stack.pop();
      if (visited[p]) continue;
      visited[p] = 1;
      const i = p * 4;
      if (!match(i)) continue;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
      const x = p % CW;
      if (x > 0) stack.push(p - 1);
      if (x < CW - 1) stack.push(p + 1);
      if (p - CW >= 0) stack.push(p - CW);
      if (p + CW < CW * CH) stack.push(p + CW);
    }
    ctx.putImageData(img, 0, 0);
  }

  function pickColor(x, y) {
    const d = ctxBase().getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    useColor(hex);
    setTool("brush");
  }

  // ── pointer handlers ───────────────────────────────────────────────────
  function down(e) {
    e.stopPropagation();
    overRef.current.setPointerCapture?.(e.pointerId);
    const pos = gp(e);
    if (tool === "pick") { pickColor(pos.x, pos.y); return; }
    if (tool === "fill") { beginAction(); floodFill(pos.x, pos.y); return; }
    beginAction();
    drawRef.current = { x0: pos.x, y0: pos.y, lastX: pos.x, lastY: pos.y, active: true };
    if (tool === "brush" || tool === "eraser") {
      const ctx = ctxBase();
      styleStroke(ctx, tool === "eraser");
      ctx.beginPath(); ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.globalAlpha = tool === "eraser" ? 1 : opacity;
      ctx.fill();
    }
  }
  function move(e) {
    const dr = drawRef.current;
    if (!dr || !dr.active) return;
    e.stopPropagation();
    const pos = gp(e);
    if (tool === "brush" || tool === "eraser") {
      const ctx = ctxBase();
      styleStroke(ctx, tool === "eraser");
      ctx.beginPath(); ctx.moveTo(dr.lastX, dr.lastY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      dr.lastX = pos.x; dr.lastY = pos.y;
    } else {
      // live shape preview on the overlay
      const ov = ctxOver();
      ov.clearRect(0, 0, CW, CH);
      styleStroke(ov, false);
      drawShape(ov, tool, dr.x0, dr.y0, pos.x, pos.y);
    }
  }
  function up(e) {
    const dr = drawRef.current;
    if (!dr || !dr.active) return;
    e.stopPropagation();
    const pos = gp(e);
    if (tool === "line" || tool === "rect" || tool === "ellipse") {
      ctxOver().clearRect(0, 0, CW, CH);
      const ctx = ctxBase();
      styleStroke(ctx, false);
      drawShape(ctx, tool, dr.x0, dr.y0, pos.x, pos.y);
    }
    drawRef.current = null;
  }

  // ── actions ─────────────────────────────────────────────────────────────
  function clearCanvas() { beginAction(); const ctx = ctxBase(); ctx.globalAlpha = 1; ctx.fillStyle = BG; ctx.fillRect(0, 0, CW, CH); }
  function save() {
    const a = document.createElement("a");
    a.download = "nova-paint.png"; a.href = baseRef.current.toDataURL("image/png"); a.click();
    showToast?.("Saved ✓");
  }
  function setWallpaper() {
    if (!onSetWallpaper) return;
    onSetWallpaper(baseRef.current.toDataURL("image/png"));
  }
  function importImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      beginAction();
      const ctx = ctxBase();
      ctx.globalAlpha = 1; ctx.fillStyle = BG; ctx.fillRect(0, 0, CW, CH);
      const scale = Math.min(CW / img.width, CH / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (CW - w) / 2, (CH - h) / 2, w, h);
      URL.revokeObjectURL(url);
      showToast?.("Image imported ✓");
    };
    img.src = url;
    e.target.value = "";
  }

  // keyboard: undo/redo + tool shortcuts (ignored while typing)
  useEffect(() => {
    function onKey(e) {
      const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
      if (typing || mod) return;
      const t = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
      if (t) setTool(t.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const canUndo = undoN > 0, canRedo = redoN > 0;
  const shapeTool = tool === "rect" || tool === "ellipse";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: FF, minHeight: 0 }}>
      {/* Options bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--nv-border)" }}>
        {/* size */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9.5, letterSpacing: 1, color: "var(--nv-text-dim)" }}>SIZE</span>
          <input type="range" min={1} max={80} value={size} onChange={e => setSize(+e.target.value)} style={{ width: 92, accentColor: AC }} />
          <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text)", width: 22, textAlign: "right" }}>{size}</span>
        </div>
        {/* opacity */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9.5, letterSpacing: 1, color: "var(--nv-text-dim)" }}>OPACITY</span>
          <input type="range" min={5} max={100} value={Math.round(opacity * 100)} onChange={e => setOpacity(+e.target.value / 100)} style={{ width: 80, accentColor: AC }} />
          <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text)", width: 30, textAlign: "right" }}>{Math.round(opacity * 100)}%</span>
        </div>
        {/* shape fill toggle */}
        {shapeTool && (
          <button onClick={() => setFilled(f => !f)} title="Fill shape" style={{ padding: "5px 11px", background: filled ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (filled ? bdr(AC) : "var(--nv-border)"), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: filled ? AC : "var(--nv-text-dim)" }}>
            {filled ? "■ Filled" : "□ Outline"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {/* undo / redo */}
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={iconBtn(canUndo)}>↶</button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={iconBtn(canRedo)}>↷</button>
        <div style={{ width: 1, height: 22, background: "var(--nv-border)" }} />
        <button onClick={() => fileRef.current?.click()} title="Import image" style={ghostBtn}>⬆ Import</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={importImage} style={{ display: "none" }} />
        <button onClick={clearCanvas} style={ghostBtn}>Clear</button>
        {onSetWallpaper && <button onClick={setWallpaper} title="Set drawing as wallpaper" style={ghostBtn}>🖼 Wallpaper</button>}
        <button onClick={save} style={{ padding: "6px 13px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 11.5, color: AC }}>⬇ Save</button>
      </div>

      {/* Middle: tool rail + canvas */}
      <div style={{ flex: 1, display: "flex", gap: 12, minHeight: 0, padding: "12px 0" }}>
        {/* tool rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {TOOLS.map(t => {
            const on = tool === t.id;
            return (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label + " (" + t.key + ")"} className="sb"
                style={{ width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: on ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (on ? bdr(AC) : "var(--nv-border)"), color: on ? AC : "var(--nv-text-dim)" }}>
                <ToolIcon id={t.id} />
              </button>
            );
          })}
          {/* current color chip */}
          <div style={{ marginTop: 6, width: 42, height: 42, borderRadius: 11, background: color, border: "2px solid var(--nv-border-strong)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }} title={"Current color " + color} />
        </div>

        {/* canvas stage (checkerboard backdrop frames the paper). The base
            canvas scales to "contain" via intrinsic-size + max constraints
            (no distortion in any window shape); a shrink-wrap flex wrapper
            lets the overlay sit exactly on top. */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden", padding: 10, background: "repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, transparent 0% 50%) 50% / 22px 22px", border: "1px solid var(--nv-border)" }}>
          <div style={{ position: "relative", display: "flex", maxWidth: "100%", maxHeight: "100%" }}>
            <canvas ref={baseRef} width={CW} height={CH}
              style={{ display: "block", maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.45)", background: "#fff" }} />
            <canvas ref={overRef} width={CW} height={CH}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: tool === "pick" ? "crosshair" : tool === "fill" ? "cell" : "crosshair" }} />
          </div>
        </div>
      </div>

      {/* Palette */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--nv-border)" }}>
        {PAINT_COLORS.map(c => {
          const on = color.toLowerCase() === c.toLowerCase() && tool !== "eraser";
          return <div key={c} className="ps" onClick={() => useColor(c)} title={c}
            style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: "pointer", border: on ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.16)", boxSizing: "border-box" }} />;
        })}
        <label title="Custom color" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--nv-border-strong)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--nv-elevated)", marginLeft: 2, fontSize: 13, position: "relative", overflow: "hidden" }}>
          ➕
          <input type="color" value={color} onChange={e => useColor(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
        </label>
        {recent.length > 0 && <div style={{ width: 1, height: 22, background: "var(--nv-border)", margin: "0 4px" }} />}
        {recent.map((c, i) => (
          <div key={"r" + i} className="ps" onClick={() => useColor(c)} title={"Recent " + c}
            style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: "pointer", border: "2px solid rgba(255,255,255,0.14)", boxSizing: "border-box" }} />
        ))}
      </div>
    </div>
  );
}

// shared button styles
function iconBtn(enabled) {
  return { width: 32, height: 30, borderRadius: 7, background: enabled ? "var(--nv-elevated)" : "transparent", border: "1px solid " + (enabled ? "var(--nv-border)" : "transparent"), cursor: enabled ? "pointer" : "default", fontFamily: FFB, fontSize: 16, lineHeight: 1, color: enabled ? "var(--nv-text)" : "var(--nv-text-dim)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, opacity: enabled ? 1 : 0.4 };
}
const ghostBtn = { padding: "6px 11px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "var(--nv-text-dim)" };

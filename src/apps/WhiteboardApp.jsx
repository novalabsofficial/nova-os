// Whiteboard — v11.0 Phase C flagship. Infinite pan/zoom canvas with pen,
// marker, eraser, shapes (rect/ellipse/line/arrow), text, sticky notes, colors,
// stroke width, undo/redo and PNG export. Vector elements live in an SVG inside
// a CSS-transformed "world" (pan = translate, zoom = scale); text + notes are
// editable DOM nodes in that same world. Self-contained, no dependencies.

import { useState, useRef, useEffect } from "react";
import { FF, FFB } from "../ui/styles.js";

let _id = 1;
const uid = () => "w" + (_id++) + Math.random().toString(36).slice(2, 5);
const PALETTE = ["#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ffffff"];
const NOTE_COLORS = ["#fff3b0", "#ffd1dc", "#c8e3ff", "#c9f2d4", "#e3d4ff", "#ffe0b8"];
const WIDTHS = [2, 4, 8, 16];

const pathD = (pts) => pts.length ? "M " + pts.map(p => p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" L ") + (pts.length === 1 ? " L " + (pts[0].x + 0.1).toFixed(1) + " " + pts[0].y.toFixed(1) : "") : "";
function bbox(el) {
  if (el.type === "path") { const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
  if (el.type === "text" || el.type === "note") return { x: el.x, y: el.y, w: el.w || 160, h: el.h || 40 };
  return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
}

export function WhiteboardApp({ AC, showToast }) {
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#3b82f6");
  const [width, setWidth] = useState(4);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [elements, setElements] = useState([]);
  const [draft, setDraft] = useState(null);
  const [editId, setEditId] = useState(null);

  const boardRef = useRef(null);
  const worldRef = useRef(null);
  const viewRef = useRef(view); useEffect(() => { viewRef.current = view; }, [view]);
  const elsRef = useRef(elements); useEffect(() => { elsRef.current = elements; }, [elements]);
  const histRef = useRef([[]]);
  const hiRef = useRef(0);

  function pushHistory(next) {
    setElements(next);
    const h = histRef.current.slice(0, hiRef.current + 1);
    h.push(next); if (h.length > 80) h.shift();
    histRef.current = h; hiRef.current = h.length - 1;
  }
  function undo() { if (hiRef.current > 0) { hiRef.current--; setElements(histRef.current[hiRef.current]); setEditId(null); } }
  function redo() { if (hiRef.current < histRef.current.length - 1) { hiRef.current++; setElements(histRef.current[hiRef.current]); } }
  async function clearAll() { if (!elements.length) return; pushHistory([]); setEditId(null); showToast?.("Board cleared"); }

  const toWorld = (cx, cy) => { const r = boardRef.current.getBoundingClientRect(); const v = viewRef.current; return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom }; };

  // ── board pointer (draw / pan / erase / place) ──
  function onBoardDown(e) {
    if (e.button === 1 || e.button === 2) return;
    setEditId(null);
    const p = toWorld(e.clientX, e.clientY);
    if (tool === "select" || tool === "pan") { startPan(e); return; }
    if (tool === "text") { const el = { id: uid(), type: "text", x: p.x, y: p.y, w: 200, text: "", color, size: 22 }; pushHistory([...elsRef.current, el]); setEditId(el.id); return; }
    if (tool === "note") { const el = { id: uid(), type: "note", x: p.x - 80, y: p.y - 60, w: 170, h: 130, text: "", color: noteColor }; pushHistory([...elsRef.current, el]); setEditId(el.id); return; }
    if (tool === "eraser") { startErase(e); return; }
    // drawing tools
    let el;
    if (tool === "pen" || tool === "marker") el = { id: uid(), type: "path", points: [p], color, width: tool === "marker" ? Math.max(width * 3, 14) : width, opacity: tool === "marker" ? 0.4 : 1 };
    else el = { id: uid(), type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, width };
    setDraft(el);
    const move = (ev) => {
      const q = toWorld(ev.clientX, ev.clientY);
      setDraft(d => { if (!d) return d; if (d.type === "path") return { ...d, points: [...d.points, q] }; return { ...d, x2: q.x, y2: q.y }; });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setDraft(d => { if (d) pushHistory([...elsRef.current, d]); return null; });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function startPan(e) {
    const sx = e.clientX, sy = e.clientY, v0 = viewRef.current;
    const move = (ev) => { const nx = v0.x + (ev.clientX - sx), ny = v0.y + (ev.clientY - sy); if (worldRef.current) worldRef.current.style.transform = `translate(${nx}px,${ny}px) scale(${v0.zoom})`; if (boardRef.current) boardRef.current.style.backgroundPosition = nx + "px " + ny + "px"; viewRef.current = { ...v0, x: nx, y: ny }; };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setView(viewRef.current); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function startErase(e) {
    const removed = new Set();
    const eat = (ev) => { const p = toWorld(ev.clientX, ev.clientY); const r = 12 / viewRef.current.zoom; for (const el of elsRef.current) { if (removed.has(el.id)) continue; if (hit(el, p, r)) removed.add(el.id); } if (removed.size) setElements(els => els.filter(el => !removed.has(el.id))); };
    eat(e);
    const up = () => { window.removeEventListener("pointermove", eat); window.removeEventListener("pointerup", up); if (removed.size) pushHistory(elsRef.current.filter(el => !removed.has(el.id))); };
    window.addEventListener("pointermove", eat); window.addEventListener("pointerup", up);
  }
  function hit(el, p, r) {
    if (el.type === "path") return el.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < r + (el.width || 4));
    const b = bbox(el); return p.x >= b.x - r && p.x <= b.x + b.w + r && p.y >= b.y - r && p.y <= b.y + b.h + r;
  }

  // ── note / text move (select tool) ──
  function startMoveEl(e, id) {
    if (tool !== "select") return;
    e.stopPropagation();
    const node = e.currentTarget;
    const el0 = elsRef.current.find(x => x.id === id); if (!el0) return;
    const sx = e.clientX, sy = e.clientY, x0 = el0.x, y0 = el0.y, z = viewRef.current.zoom;
    let moved = false, nx = x0, ny = y0;
    const move = (ev) => { moved = true; nx = x0 + (ev.clientX - sx) / z; ny = y0 + (ev.clientY - sy) / z; node.style.left = nx + "px"; node.style.top = ny + "px"; };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (moved) pushHistory(elsRef.current.map(x => x.id === id ? { ...x, x: nx, y: ny } : x)); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ── wheel: pan, or ctrl/⌘ + wheel = zoom at cursor ──
  function onWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = boardRef.current.getBoundingClientRect();
      setView(v => { const nz = Math.max(0.2, Math.min(4, v.zoom * (e.deltaY < 0 ? 1.12 : 0.89))); const wx = (e.clientX - r.left - v.x) / v.zoom, wy = (e.clientY - r.top - v.y) / v.zoom; return { zoom: nz, x: e.clientX - r.left - wx * nz, y: e.clientY - r.top - wy * nz }; });
    } else { setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })); }
  }
  function zoomBy(f) { const r = boardRef.current.getBoundingClientRect(); setView(v => { const nz = Math.max(0.2, Math.min(4, v.zoom * f)); const cx = r.width / 2, cy = r.height / 2; const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom; return { zoom: nz, x: cx - wx * nz, y: cy - wy * nz }; }); }
  function resetView() { setView({ x: 0, y: 0, zoom: 1 }); }

  // delete selected note/text with Backspace handled inside the editable; Esc closes edit
  useEffect(() => {
    function onKey(e) {
      const a = document.activeElement, t = a && a.tagName;
      const typing = t === "INPUT" || t === "TEXTAREA" || (a && a.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === "Escape") setEditId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── export PNG ──
  function exportPng() {
    const els = elsRef.current;
    if (!els.length) { showToast?.("Nothing to export"); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of els) { const b = bbox(el); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
    const pad = 40, W = Math.max(1, Math.ceil(maxX - minX) + pad * 2), H = Math.max(1, Math.ceil(maxY - minY) + pad * 2);
    const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.translate(-minX + pad, -minY + pad);
    for (const el of els) drawToCtx(ctx, el);
    c.toBlob(b => { if (!b) { showToast?.("Export failed"); return; } const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "whiteboard-" + Date.now() + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); showToast?.("Exported PNG ✓"); }, "image/png");
  }
  function drawToCtx(ctx, el) {
    ctx.save();
    if (el.type === "path") {
      ctx.globalAlpha = el.opacity ?? 1; ctx.strokeStyle = el.color; ctx.lineWidth = el.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); el.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    } else if (el.type === "rect") { ctx.strokeStyle = el.color; ctx.lineWidth = el.width; ctx.strokeRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1)); }
    else if (el.type === "ellipse") { ctx.strokeStyle = el.color; ctx.lineWidth = el.width; ctx.beginPath(); ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    else if (el.type === "line" || el.type === "arrow") { ctx.strokeStyle = el.color; ctx.lineWidth = el.width; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke(); if (el.type === "arrow") { const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1), h = 10 + el.width * 1.5; ctx.beginPath(); ctx.moveTo(el.x2, el.y2); ctx.lineTo(el.x2 - h * Math.cos(a - 0.4), el.y2 - h * Math.sin(a - 0.4)); ctx.moveTo(el.x2, el.y2); ctx.lineTo(el.x2 - h * Math.cos(a + 0.4), el.y2 - h * Math.sin(a + 0.4)); ctx.stroke(); } }
    else if (el.type === "text") { ctx.fillStyle = el.color; ctx.font = "600 " + (el.size || 22) + "px 'Inter',system-ui,sans-serif"; ctx.textBaseline = "top"; (el.text || "").split("\n").forEach((ln, i) => ctx.fillText(ln, el.x, el.y + i * (el.size || 22) * 1.25)); }
    else if (el.type === "note") { ctx.fillStyle = el.color; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(el.x, el.y, el.w, el.h, 10); else ctx.rect(el.x, el.y, el.w, el.h); ctx.fill(); ctx.fillStyle = "#2a2a1e"; ctx.font = "500 15px 'Inter',system-ui,sans-serif"; ctx.textBaseline = "top"; (el.text || "").split("\n").forEach((ln, i) => ctx.fillText(ln.slice(0, 22), el.x + 12, el.y + 12 + i * 19)); }
    ctx.restore();
  }

  // ── render ──
  const vec = elements.filter(e => e.type !== "text" && e.type !== "note");
  const objs = elements.filter(e => e.type === "text" || e.type === "note");
  const boardCursor = tool === "pan" ? "grab" : tool === "select" ? "default" : tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair";
  const dot = "var(--nv-border-strong)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: "var(--nv-surface-solid)" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--nv-border)", flexWrap: "wrap", flexShrink: 0 }}>
        {[["select", "⤢", "Select / move"], ["pan", "✋", "Pan"], ["pen", "✏️", "Pen"], ["marker", "🖍", "Marker"], ["eraser", "🩹", "Eraser"], ["rect", "▭", "Rectangle"], ["ellipse", "◯", "Ellipse"], ["line", "／", "Line"], ["arrow", "↗", "Arrow"], ["text", "T", "Text"], ["note", "🗒", "Sticky note"]].map(([id, ic, label]) => (
          <button key={id} title={label} onClick={() => setTool(id)} style={tbtn(tool === id, AC)}>{ic}</button>
        ))}
        <span style={{ width: 1, height: 22, background: "var(--nv-border)", margin: "0 3px" }} />
        {PALETTE.map(c => <button key={c} title={c} onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: "50%", border: color === c ? "2px solid " + AC : "1px solid var(--nv-border-strong)", background: c, cursor: "pointer", padding: 0 }} />)}
        <input type="color" value={color} onChange={e => setColor(e.target.value)} title="Custom color" style={{ width: 24, height: 24, border: "1px solid var(--nv-border)", borderRadius: 5, background: "none", cursor: "pointer", padding: 0 }} />
        <span style={{ width: 1, height: 22, background: "var(--nv-border)", margin: "0 3px" }} />
        {WIDTHS.map(w => <button key={w} title={w + "px"} onClick={() => setWidth(w)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid " + (width === w ? AC : "var(--nv-border)"), background: width === w ? "var(--nv-elevated)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: Math.min(w, 16), height: Math.min(w, 16), borderRadius: "50%", background: "var(--nv-text)" }} /></button>)}
        {tool === "note" && <span style={{ display: "flex", gap: 4, marginLeft: 4 }}>{NOTE_COLORS.map(c => <button key={c} onClick={() => setNoteColor(c)} style={{ width: 18, height: 18, borderRadius: 4, border: noteColor === c ? "2px solid " + AC : "1px solid rgba(0,0,0,0.2)", background: c, cursor: "pointer", padding: 0 }} />)}</span>}
        <div style={{ flex: 1 }} />
        <button title="Undo (Ctrl+Z)" onClick={undo} style={ibtn}>↶</button>
        <button title="Redo (Ctrl+Shift+Z)" onClick={redo} style={ibtn}>↷</button>
        <button title="Zoom out" onClick={() => zoomBy(0.83)} style={ibtn}>−</button>
        <button title="Reset zoom" onClick={resetView} style={{ ...ibtn, width: "auto", padding: "0 8px", fontSize: 11, fontFamily: "ui-monospace,monospace" }}>{Math.round(view.zoom * 100)}%</button>
        <button title="Zoom in" onClick={() => zoomBy(1.2)} style={ibtn}>+</button>
        <button title="Clear board" onClick={clearAll} style={{ ...ibtn, color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }}>🗑</button>
        <button title="Export PNG" onClick={exportPng} style={{ padding: "0 12px", height: 30, borderRadius: 8, border: "1px solid " + AC, background: "rgba(99,102,241,0.08)", color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>⬇ PNG</button>
      </div>

      {/* board */}
      <div ref={boardRef} data-surface="1" onPointerDown={onBoardDown} onWheel={onWheel}
        style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", cursor: boardCursor, touchAction: "none", background: "var(--nv-surface)", backgroundImage: `radial-gradient(circle, ${dot} 1.1px, transparent 1.2px)`, backgroundSize: (24 * view.zoom) + "px " + (24 * view.zoom) + "px", backgroundPosition: view.x + "px " + view.y + "px" }}>
        <div ref={worldRef} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", pointerEvents: "none", transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})` }}>
          <svg style={{ position: "absolute", overflow: "visible", pointerEvents: "none" }} width="1" height="1">
            {[...vec, ...(draft ? [draft] : [])].map(el => <Shape key={el.id} el={el} />)}
          </svg>
          {objs.map(el => {
            const onCommit = (t) => { const tt = (t || "").trim(); pushHistory(elsRef.current.flatMap(x => x.id === el.id ? (tt ? [{ ...x, text: t }] : []) : [x])); setEditId(null); };
            const common = { el, editing: editId === el.id, tool, onDown: (e) => startMoveEl(e, el.id), onCommit, onOpen: () => tool === "select" && setEditId(el.id), AC };
            return el.type === "note" ? <NoteEl key={el.id} {...common} /> : <TextEl key={el.id} {...common} />;
          })}
        </div>
        {elements.length === 0 && !draft && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "var(--nv-text-dim)", textAlign: "center" }}>
            <div><div style={{ fontSize: 40, marginBottom: 8 }}>🖊️</div><div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text)" }}>Start drawing</div><div style={{ fontSize: 12, marginTop: 4 }}>Pick a tool · drag empty space (or ✋) to pan · Ctrl+scroll to zoom</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Shape({ el }) {
  if (el.type === "path") return <path d={pathD(el.points)} fill="none" stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round" opacity={el.opacity ?? 1} />;
  if (el.type === "rect") return <rect x={Math.min(el.x1, el.x2)} y={Math.min(el.y1, el.y2)} width={Math.abs(el.x2 - el.x1)} height={Math.abs(el.y2 - el.y1)} fill="none" stroke={el.color} strokeWidth={el.width} rx={4} />;
  if (el.type === "ellipse") return <ellipse cx={(el.x1 + el.x2) / 2} cy={(el.y1 + el.y2) / 2} rx={Math.abs(el.x2 - el.x1) / 2} ry={Math.abs(el.y2 - el.y1) / 2} fill="none" stroke={el.color} strokeWidth={el.width} />;
  if (el.type === "line") return <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.color} strokeWidth={el.width} strokeLinecap="round" />;
  if (el.type === "arrow") {
    const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1), h = 10 + el.width * 1.5;
    return (<g stroke={el.color} strokeWidth={el.width} strokeLinecap="round" fill="none">
      <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} />
      <path d={`M ${el.x2} ${el.y2} L ${el.x2 - h * Math.cos(a - 0.4)} ${el.y2 - h * Math.sin(a - 0.4)} M ${el.x2} ${el.y2} L ${el.x2 - h * Math.cos(a + 0.4)} ${el.y2 - h * Math.sin(a + 0.4)}`} />
    </g>);
  }
  return null;
}

function TextEl({ el, editing, tool, onDown, onCommit, onOpen, AC }) {
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); document.getSelection()?.selectAllChildren?.(ref.current); document.getSelection()?.collapseToEnd?.(); } }, [editing]);
  const active = tool === "select" || editing;
  return (
    <div onPointerDown={tool === "select" ? onDown : undefined} onDoubleClick={onOpen}
      style={{ position: "absolute", left: el.x, top: el.y, minWidth: 30, pointerEvents: active ? "auto" : "none", cursor: tool === "select" ? "move" : "text" }}>
      <div ref={ref} contentEditable={editing} suppressContentEditableWarning onBlur={e => onCommit(e.currentTarget.textContent)}
        style={{ outline: editing ? "2px dashed " + AC : "none", color: el.color, fontFamily: "'Inter',system-ui,sans-serif", fontWeight: 600, fontSize: el.size || 22, lineHeight: 1.25, whiteSpace: "pre", minHeight: el.size || 22, padding: 2 }}>
        {el.text || (editing ? "" : "Text")}
      </div>
    </div>
  );
}

function NoteEl({ el, editing, tool, onDown, onCommit, onOpen }) {
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  const active = tool === "select" || editing;
  return (
    <div onPointerDown={tool === "select" ? onDown : undefined} onDoubleClick={onOpen}
      style={{ position: "absolute", left: el.x, top: el.y, width: el.w, minHeight: el.h, background: el.color, borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.22)", padding: 12, boxSizing: "border-box", pointerEvents: active ? "auto" : "none", cursor: tool === "select" ? "move" : "default", transform: "rotate(-0.5deg)" }}>
      <div ref={ref} contentEditable={editing} suppressContentEditableWarning onBlur={e => onCommit(e.currentTarget.textContent)}
        style={{ outline: "none", color: "#2a2a1e", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 15, lineHeight: 1.35, minHeight: 24, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {el.text || (editing ? "" : "Note")}
      </div>
    </div>
  );
}

const tbtn = (active, AC) => ({ width: 32, height: 30, borderRadius: 7, border: "1px solid " + (active ? AC : "var(--nv-border)"), background: active ? "var(--nv-elevated)" : "transparent", color: active ? AC : "var(--nv-text)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 });
const ibtn = { width: 30, height: 30, borderRadius: 7, border: "1px solid var(--nv-border)", background: "transparent", color: "var(--nv-text)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" };

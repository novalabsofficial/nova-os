// Paint — v11.0 Phase C, rebuilt into a layered editor (a little Paint.NET).
//
// New vs the v10 single-canvas version:
//   • LAYERS — add / duplicate / delete / reorder / rename, per-layer visibility
//     and opacity. Each layer is its own stacked <canvas>; the browser composites
//     them. Drawing targets the active layer; export flattens the visible stack.
//   • Zoom & pan — wheel to zoom toward the cursor, Hand tool / hold-Space to pan,
//     Fit / 100% buttons.
//   • Tools — brush, eraser (true transparency), line, rectangle, ellipse, fill,
//     eyedropper (samples the composite), spray, and a text tool.
//   • Undo / redo scoped per-layer (pixel snapshots); structural layer ops reset
//     history.
//
// Canvas is fixed-resolution (CW×CH); a transformed wrapper handles zoom/pan, so
// pointer mapping divides by the live displayed size and stays correct at any zoom.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { PAINT_COLORS } from "../ui/constants.js";

const DEFAULT_W = 1000, DEFAULT_H = 680;   // fallback until the stage is measured
const UNDO_LIMIT = 20;
let _lid = 0;
const newLayerId = () => "L" + (++_lid);

const TOOLS = [
  { id: "brush", label: "Brush", key: "B" },
  { id: "eraser", label: "Eraser", key: "E" },
  { id: "line", label: "Line", key: "L" },
  { id: "rect", label: "Rectangle", key: "R" },
  { id: "ellipse", label: "Ellipse", key: "O" },
  { id: "fill", label: "Fill", key: "G" },
  { id: "spray", label: "Spray", key: "S" },
  { id: "text", label: "Text", key: "T" },
  { id: "pick", label: "Eyedropper", key: "I" },
  { id: "pan", label: "Pan / Hand", key: "H" },
];
const TEXT_FONTS = [
  { id: "Inter, system-ui, sans-serif", label: "Sans" },
  { id: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { id: "'Courier New', monospace", label: "Mono" },
  { id: "'Comic Sans MS', cursive", label: "Comic" },
];

function hexToRgb(h) { let c = (h || "#000").replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
function rgbToHex(r, g, b) { return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join(""); }

function ToolIcon({ id, size = 18 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "brush": return <svg {...p}><path d="M4 20s1-3 3-4M16 4.5l3.5 3.5c.6.6.6 1.5 0 2L11 18.5l-4-4 8.5-8.5c.5-.6 1.4-.6 2-0z" /></svg>;
    case "eraser": return <svg {...p}><path d="M8 20h11" /><path d="M14.5 5.5 20 11 11 20H7l-3.5-3.5a1.5 1.5 0 0 1 0-2L13 5.5a1.5 1.5 0 0 1 1.5 0z" /></svg>;
    case "line": return <svg {...p}><path d="M5 19 19 5" /></svg>;
    case "rect": return <svg {...p}><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>;
    case "ellipse": return <svg {...p}><ellipse cx="12" cy="12" rx="8" ry="6" /></svg>;
    case "fill": return <svg {...p}><path d="M5 11 12 4l7 7-7 7z" /><path d="M19 14c1.5 2 1.5 4 0 4s-1.5-2 0-4z" fill="currentColor" stroke="none" /><path d="M3 22h18" /></svg>;
    case "spray": return <svg {...p}><path d="M14 6 19 4v9l-5-2z" /><path d="M14 6 9 8v3l5-1z" /><circle cx="5" cy="14" r=".6" fill="currentColor" /><circle cx="7" cy="18" r=".6" fill="currentColor" /><circle cx="4" cy="19" r=".6" fill="currentColor" /><circle cx="9" cy="15" r=".6" fill="currentColor" /></svg>;
    case "text": return <svg {...p}><path d="M5 6h14M12 6v13M9 19h6" /></svg>;
    case "pick": return <svg {...p}><path d="M19 3a2 2 0 0 1 2 2l-1.5 1.5-2-2L19 3zM16.5 6.5l1 1L8 17l-3 1 1-3 10.5-9.5z" /></svg>;
    case "pan": return <svg {...p}><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-1.5a4 4 0 0 1-3-1.4L4 16s-1-1.4.2-2.3c.8-.6 1.8 0 2.3.6L8 16" /></svg>;
    default: return null;
  }
}

export function PaintApp({ showToast, AC, onSetWallpaper }) {
  const canvasEls = useRef({});           // { layerId: HTMLCanvasElement }
  const overRef = useRef(null);
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const drawRef = useRef(null);
  const undoStack = useRef([]);            // [{ id, img }]
  const redoStack = useRef([]);
  const panStart = useRef(null);
  const spaceRef = useRef(false);
  const initedRef = useRef(false);
  const pendingCopy = useRef(null);        // { src, dst }

  const [layers, setLayers] = useState(() => [{ id: newLayerId(), name: "Background", visible: true, opacity: 1 }]);
  const [activeId, setActiveId] = useState(() => null);
  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [filled, setFilled] = useState(false);
  const [recent, setRecent] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [textEdit, setTextEdit] = useState(null);   // { x, y, value }
  const [textSize, setTextSize] = useState(40);
  const [textFont, setTextFont] = useState(TEXT_FONTS[0].id);
  const [undoN, setUndoN] = useState(0);
  const [redoN, setRedoN] = useState(0);
  const [dim, setDim] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const CW = dim.w, CH = dim.h;            // alias so the rest of the app reads live dims
  const sizedRef = useRef("");

  const active = activeId || layers[0]?.id;
  const activeCanvas = () => canvasEls.current[active];
  const actx = () => activeCanvas()?.getContext("2d");

  // On first open, size the document to the display so it starts at 100% and
  // fills the window — no more tiny floating canvas at an odd zoom.
  useEffect(() => {
    if (initedRef.current) return;
    const stage = stageRef.current; if (!stage || !stage.clientWidth) return;
    initedRef.current = true;
    setDim({ w: Math.max(400, Math.round(stage.clientWidth)), h: Math.max(300, Math.round(stage.clientHeight)) });
  }, [layers]);

  // Paint the background white once the (newly measured) document size is applied
  // to the background canvas, then reset to a clean 100% view.
  useEffect(() => {
    const key = dim.w + "x" + dim.h;
    if (sizedRef.current === key) return;
    const el = canvasEls.current[layers[0]?.id];
    if (!el || el.width !== dim.w || el.height !== dim.h) return;
    sizedRef.current = key;
    const ctx = el.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, dim.w, dim.h);
    setActiveId(layers[0].id);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [dim, layers]);

  // duplicate copy once the new canvas mounts
  useEffect(() => {
    const pc = pendingCopy.current; if (!pc) return;
    const s = canvasEls.current[pc.src], d = canvasEls.current[pc.dst];
    if (s && d) { d.getContext("2d").drawImage(s, 0, 0); pendingCopy.current = null; }
  });

  const fitView = () => {
    const el = stageRef.current; if (!el) return;
    const z = Math.min(el.clientWidth / dim.w, el.clientHeight / dim.h) * 0.97;
    setZoom(z); setPan({ x: (el.clientWidth - dim.w * z) / 2, y: (el.clientHeight - dim.h * z) / 2 });
  };

  // ── undo / redo (per-layer pixel snapshots) ─────────────────────────────
  const sync = () => { setUndoN(undoStack.current.length); setRedoN(redoStack.current.length); };
  const beginAction = () => {
    const ctx = actx(); if (!ctx) return;
    undoStack.current.push({ id: active, img: ctx.getImageData(0, 0, CW, CH) });
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    redoStack.current = []; sync();
  };
  const resetHistory = () => { undoStack.current = []; redoStack.current = []; sync(); };
  const undo = () => {
    const e = undoStack.current.pop(); if (!e) return;
    const el = canvasEls.current[e.id]; if (!el) { sync(); return; }
    const ctx = el.getContext("2d");
    redoStack.current.push({ id: e.id, img: ctx.getImageData(0, 0, CW, CH) });
    ctx.putImageData(e.img, 0, 0);
    if (e.id !== active) setActiveId(e.id);
    sync();
  };
  const redo = () => {
    const e = redoStack.current.pop(); if (!e) return;
    const el = canvasEls.current[e.id]; if (!el) { sync(); return; }
    const ctx = el.getContext("2d");
    undoStack.current.push({ id: e.id, img: ctx.getImageData(0, 0, CW, CH) });
    ctx.putImageData(e.img, 0, 0);
    if (e.id !== active) setActiveId(e.id);
    sync();
  };

  const useColor = (c) => { setColor(c); setRecent(r => [c, ...r.filter(x => x.toLowerCase() !== c.toLowerCase())].slice(0, 10)); if (tool === "eraser" || tool === "pick") setTool("brush"); };

  // ── layer ops ────────────────────────────────────────────────────────────
  const addLayer = () => { const id = newLayerId(); setLayers(ls => [...ls, { id, name: "Layer " + (ls.length + 1), visible: true, opacity: 1 }]); setActiveId(id); resetHistory(); };
  const duplicateLayer = () => {
    const idx = layers.findIndex(l => l.id === active); if (idx < 0) return;
    const id = newLayerId();
    pendingCopy.current = { src: active, dst: id };
    setLayers(ls => { const n = [...ls]; n.splice(idx + 1, 0, { id, name: ls[idx].name + " copy", visible: true, opacity: ls[idx].opacity }); return n; });
    setActiveId(id); resetHistory();
  };
  const deleteLayer = () => {
    if (layers.length <= 1) { showToast?.("Can't delete the last layer"); return; }
    setLayers(ls => { const n = ls.filter(l => l.id !== active); return n; });
    setActiveId(prev => { const i = layers.findIndex(l => l.id === active); const rest = layers.filter(l => l.id !== active); return (rest[i] || rest[i - 1] || rest[0]).id; });
    delete canvasEls.current[active]; resetHistory();
  };
  const moveLayer = (dir) => {
    setLayers(ls => { const i = ls.findIndex(l => l.id === active); const j = i + dir; if (j < 0 || j >= ls.length) return ls; const n = [...ls]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };
  const setLayerProp = (id, prop, val) => setLayers(ls => ls.map(l => l.id === id ? { ...l, [prop]: val } : l));
  const renameLayer = (id) => { const cur = layers.find(l => l.id === id); const v = window.prompt("Layer name", cur?.name || ""); if (v != null) setLayerProp(id, "name", v.slice(0, 30) || cur.name); };

  // ── compositing ──────────────────────────────────────────────────────────
  const composite = (white) => {
    const tmp = document.createElement("canvas"); tmp.width = CW; tmp.height = CH;
    const c = tmp.getContext("2d");
    if (white) { c.fillStyle = "#fff"; c.fillRect(0, 0, CW, CH); }
    for (const L of layers) { if (!L.visible) continue; const el = canvasEls.current[L.id]; if (!el) continue; c.globalAlpha = L.opacity; c.drawImage(el, 0, 0); }
    c.globalAlpha = 1; return tmp;
  };

  // ── drawing primitives ───────────────────────────────────────────────────
  const gp = (e) => { const el = activeCanvas(); const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) * (CW / r.width), y: (e.clientY - r.top) * (CH / r.height) }; };
  const styleStroke = (ctx, eraser) => {
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.globalAlpha = eraser ? 1 : opacity;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
  };
  const drawShape = (ctx, t, x0, y0, x1, y1) => {
    if (t === "line") { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    else if (t === "rect") { const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); filled ? ctx.fillRect(x, y, w, h) : ctx.strokeRect(x, y, w, h); }
    else if (t === "ellipse") { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); filled ? ctx.fill() : ctx.stroke(); }
  };
  const spray = (ctx, x, y) => {
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = opacity; ctx.fillStyle = color;
    const n = Math.max(6, size); const r = size * 1.4;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * r; ctx.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.4, 1.4); }
  };
  const floodFill = (sx, sy) => {
    sx = Math.floor(sx); sy = Math.floor(sy); if (sx < 0 || sy < 0 || sx >= CW || sy >= CH) return;
    const ctx = actx(); const img = ctx.getImageData(0, 0, CW, CH); const d = img.data;
    const s = (sy * CW + sx) * 4; const tr = d[s], tg = d[s + 1], tb = d[s + 2], ta = d[s + 3];
    const [fr, fg, fb] = hexToRgb(color); const fa = Math.round(opacity * 255);
    if (Math.abs(tr - fr) < 3 && Math.abs(tg - fg) < 3 && Math.abs(tb - fb) < 3 && Math.abs(ta - fa) < 3) return;
    const tol = 36; const match = (i) => Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol && Math.abs(d[i + 2] - tb) <= tol && Math.abs(d[i + 3] - ta) <= tol;
    const visited = new Uint8Array(CW * CH); const stack = [sy * CW + sx];
    while (stack.length) {
      const p = stack.pop(); if (visited[p]) continue; visited[p] = 1; const i = p * 4; if (!match(i)) continue;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = fa;
      const x = p % CW; if (x > 0) stack.push(p - 1); if (x < CW - 1) stack.push(p + 1); if (p - CW >= 0) stack.push(p - CW); if (p + CW < CW * CH) stack.push(p + CW);
    }
    ctx.putImageData(img, 0, 0);
  };
  const pickColor = (x, y) => { const d = composite(true).getContext("2d").getImageData(Math.floor(x), Math.floor(y), 1, 1).data; useColor(rgbToHex(d[0], d[1], d[2])); setTool("brush"); };

  // ── pointer ────────────────────────────────────────────────────────────
  const isPanning = () => tool === "pan" || spaceRef.current;
  const down = (e) => {
    e.stopPropagation(); overRef.current.setPointerCapture?.(e.pointerId);
    if (isPanning()) { panStart.current = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y }; return; }
    const pos = gp(e);
    if (tool === "pick") { pickColor(pos.x, pos.y); return; }
    if (tool === "text") { setTextEdit({ x: pos.x, y: pos.y, value: "" }); return; }
    if (tool === "fill") { beginAction(); floodFill(pos.x, pos.y); return; }
    beginAction();
    drawRef.current = { x0: pos.x, y0: pos.y, lastX: pos.x, lastY: pos.y };
    const ctx = actx();
    if (tool === "brush" || tool === "eraser") { styleStroke(ctx, tool === "eraser"); ctx.beginPath(); ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2); ctx.fill(); }
    else if (tool === "spray") spray(ctx, pos.x, pos.y);
  };
  const move = (e) => {
    if (isPanning() && panStart.current) { const s = panStart.current; setPan({ x: s.x + (e.clientX - s.px), y: s.y + (e.clientY - s.py) }); return; }
    const dr = drawRef.current; if (!dr) return; e.stopPropagation();
    const pos = gp(e); const ctx = actx();
    if (tool === "brush" || tool === "eraser") { styleStroke(ctx, tool === "eraser"); ctx.beginPath(); ctx.moveTo(dr.lastX, dr.lastY); ctx.lineTo(pos.x, pos.y); ctx.stroke(); dr.lastX = pos.x; dr.lastY = pos.y; }
    else if (tool === "spray") spray(ctx, pos.x, pos.y);
    else { const ov = overRef.current.getContext("2d"); ov.clearRect(0, 0, CW, CH); styleStroke(ov, false); drawShape(ov, tool, dr.x0, dr.y0, pos.x, pos.y); }
  };
  const up = (e) => {
    if (panStart.current) { panStart.current = null; return; }
    const dr = drawRef.current; if (!dr) return; e.stopPropagation();
    const pos = gp(e);
    if (tool === "line" || tool === "rect" || tool === "ellipse") { overRef.current.getContext("2d").clearRect(0, 0, CW, CH); const ctx = actx(); styleStroke(ctx, false); drawShape(ctx, tool, dr.x0, dr.y0, pos.x, pos.y); }
    drawRef.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    const el = stageRef.current; const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nz = Math.max(0.1, Math.min(8, zoom * factor));
    const canvasX = (cx - pan.x) / zoom, canvasY = (cy - pan.y) / zoom;
    setPan({ x: cx - canvasX * nz, y: cy - canvasY * nz }); setZoom(nz);
  };

  const commitText = () => {
    const t = textEdit; setTextEdit(null);
    if (!t || !t.value.trim()) return;
    beginAction();
    const ctx = actx(); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = opacity; ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic"; ctx.font = `${textSize}px ${textFont}`;
    ctx.fillText(t.value, t.x, t.y);
  };

  // ── actions ────────────────────────────────────────────────────────────
  const clearLayer = () => { beginAction(); const ctx = actx(); ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, CW, CH); };
  const save = () => { const a = document.createElement("a"); a.download = "nova-paint.png"; a.href = composite(false).toDataURL("image/png"); a.click(); showToast?.("Saved ✓"); };
  const setWallpaper = () => { if (onSetWallpaper) onSetWallpaper(composite(true).toDataURL("image/png")); };
  const importImage = (e) => {
    const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); const img = new Image();
    img.onload = () => { beginAction(); const ctx = actx(); const scale = Math.min(CW / img.width, CH / img.height); const w = img.width * scale, h = img.height * scale; ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.drawImage(img, (CW - w) / 2, (CH - h) / 2, w, h); URL.revokeObjectURL(url); showToast?.("Image imported ✓"); };
    img.src = url; e.target.value = "";
  };

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === " " && !typing) { spaceRef.current = true; }
      if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
      if (typing || mod) return;
      const t = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
      if (t) setTool(t.id);
    };
    const onUp = (e) => { if (e.key === " ") spaceRef.current = false; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  });

  const canUndo = undoN > 0, canRedo = redoN > 0;
  const shapeTool = tool === "rect" || tool === "ellipse";
  const cursor = isPanning() ? (panStart.current ? "grabbing" : "grab") : tool === "pick" ? "crosshair" : tool === "text" ? "text" : "crosshair";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: FF, minHeight: 0 }}>
      {/* options bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--nv-border)" }}>
        <Slider label="SIZE" v={size} min={1} max={120} onChange={setSize} AC={AC} suffix="" w={92} />
        <Slider label="OPACITY" v={Math.round(opacity * 100)} min={5} max={100} onChange={v => setOpacity(v / 100)} AC={AC} suffix="%" w={80} />
        {shapeTool && (
          <button onClick={() => setFilled(f => !f)} style={{ padding: "5px 11px", background: filled ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (filled ? bdr(AC) : "var(--nv-border)"), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: filled ? AC : "var(--nv-text-dim)" }}>{filled ? "■ Filled" : "□ Outline"}</button>
        )}
        {tool === "text" && (<>
          <Slider label="TEXT" v={textSize} min={10} max={160} onChange={setTextSize} AC={AC} suffix="" w={80} />
          <select value={textFont} onChange={e => setTextFont(e.target.value)} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 12 }}>{TEXT_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        </>)}
        <div style={{ flex: 1 }} />
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={iconBtn(canUndo)}>↶</button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={iconBtn(canRedo)}>↷</button>
        <div style={{ width: 1, height: 22, background: "var(--nv-border)" }} />
        <button onClick={() => fileRef.current?.click()} style={ghostBtn}>⬆ Import</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={importImage} style={{ display: "none" }} />
        {onSetWallpaper && <button onClick={setWallpaper} style={ghostBtn}>🖼 Wallpaper</button>}
        <button onClick={save} style={{ padding: "6px 13px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 11.5, color: AC }}>⬇ Save</button>
      </div>

      {/* middle */}
      <div style={{ flex: 1, display: "flex", gap: 12, minHeight: 0, padding: "12px 0" }}>
        {/* tool rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {TOOLS.map(t => { const on = tool === t.id; return (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label + " (" + t.key + ")"} className="sb"
              style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: on ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (on ? bdr(AC) : "var(--nv-border)"), color: on ? AC : "var(--nv-text-dim)" }}>
              <ToolIcon id={t.id} />
            </button>
          ); })}
          <div style={{ marginTop: 4, width: 40, height: 40, borderRadius: 10, background: color, border: "2px solid var(--nv-border-strong)" }} title={"Color " + color} />
        </div>

        {/* canvas stage */}
        <div ref={stageRef} onWheel={onWheel} style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", borderRadius: 12, border: "1px solid var(--nv-border)", background: "repeating-conic-gradient(rgba(128,128,128,0.16) 0% 25%, transparent 0% 50%) 50% / 22px 22px" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH, transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, boxShadow: "0 10px 40px rgba(0,0,0,0.45)" }}>
            {/* white paper backing so transparent layers read as white visually under the stack base, but checkerboard shows through erased background */}
            {layers.map(L => (
              <canvas key={L.id} ref={el => { if (el) canvasEls.current[L.id] = el; }} width={CW} height={CH}
                style={{ position: "absolute", inset: 0, width: CW, height: CH, display: L.visible ? "block" : "none", opacity: L.opacity }} />
            ))}
            <canvas ref={overRef} width={CW} height={CH} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              style={{ position: "absolute", inset: 0, width: CW, height: CH, touchAction: "none", cursor }} />
            {textEdit && (
              <input autoFocus value={textEdit.value} onChange={e => setTextEdit(t => ({ ...t, value: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitText(); } else if (e.key === "Escape") setTextEdit(null); e.stopPropagation(); }}
                onBlur={commitText} onPointerDown={e => e.stopPropagation()}
                style={{ position: "absolute", left: textEdit.x, top: textEdit.y - textSize, minWidth: 40, font: `${textSize}px ${textFont}`, color, background: "rgba(127,127,127,0.12)", border: `1px dashed ${color}`, outline: "none", padding: 0, lineHeight: 1.1 }} />
            )}
          </div>

          {/* zoom controls */}
          <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 4, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 9, padding: 4 }}>
            <button onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} style={zoomBtn}>−</button>
            <button onClick={() => { setZoom(1); }} style={{ ...zoomBtn, width: 48, fontSize: 11 }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(z => Math.min(8, z * 1.2))} style={zoomBtn}>+</button>
            <button onClick={fitView} style={{ ...zoomBtn, width: 40, fontSize: 11 }}>Fit</button>
          </div>
        </div>

        {/* layers panel */}
        <div style={{ width: 186, flexShrink: 0, display: "flex", flexDirection: "column", border: "1px solid var(--nv-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--nv-border)" }}>
            <span style={{ fontFamily: FFB, fontSize: 12.5 }}>Layers</span>
            <div style={{ flex: 1 }} />
            <button onClick={addLayer} title="New layer" style={miniBtn}>＋</button>
            <button onClick={duplicateLayer} title="Duplicate" style={miniBtn}>⧉</button>
            <button onClick={() => moveLayer(1)} title="Move up" style={miniBtn}>↑</button>
            <button onClick={() => moveLayer(-1)} title="Move down" style={miniBtn}>↓</button>
            <button onClick={deleteLayer} title="Delete" style={{ ...miniBtn, color: "#ef4444" }}>🗑</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 5 }}>
            {layers.slice().reverse().map(L => {
              const on = L.id === active;
              return (
                <div key={L.id} onClick={() => setActiveId(L.id)} style={{ padding: "7px 8px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? bdr(AC) : "var(--nv-border)"), background: on ? fill(AC) : "var(--nv-elevated)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span onClick={e => { e.stopPropagation(); setLayerProp(L.id, "visible", !L.visible); }} title="Toggle visibility" style={{ cursor: "pointer", fontSize: 13, width: 16, textAlign: "center", opacity: L.visible ? 1 : 0.4 }}>{L.visible ? "👁" : "🙈"}</span>
                    <span onDoubleClick={e => { e.stopPropagation(); renameLayer(L.id); }} style={{ flex: 1, fontFamily: FFB, fontSize: 12, color: on ? AC : "var(--nv-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{L.name}</span>
                  </div>
                  {on && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 9, fontFamily: FFB, color: "var(--nv-text-dim)" }}>OPACITY</span>
                      <input type="range" min={0} max={100} value={Math.round(L.opacity * 100)} onClick={e => e.stopPropagation()} onChange={e => setLayerProp(L.id, "opacity", +e.target.value / 100)} style={{ flex: 1, accentColor: AC }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* palette */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--nv-border)" }}>
        {PAINT_COLORS.map(c => { const on = color.toLowerCase() === c.toLowerCase() && tool !== "eraser"; return <div key={c} className="ps" onClick={() => useColor(c)} title={c} style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: "pointer", border: on ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.16)", boxSizing: "border-box" }} />; })}
        <label title="Custom color" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--nv-border-strong)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--nv-elevated)", marginLeft: 2, fontSize: 13, position: "relative", overflow: "hidden" }}>➕<input type="color" value={color} onChange={e => useColor(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} /></label>
        {recent.length > 0 && <div style={{ width: 1, height: 22, background: "var(--nv-border)", margin: "0 4px" }} />}
        {recent.map((c, i) => <div key={"r" + i} className="ps" onClick={() => useColor(c)} title={c} style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: "pointer", border: "2px solid rgba(255,255,255,0.14)", boxSizing: "border-box" }} />)}
        <div style={{ flex: 1 }} />
        <button onClick={clearLayer} style={ghostBtn}>Clear layer</button>
      </div>
    </div>
  );
}

function Slider({ label, v, min, max, onChange, AC, suffix, w }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9.5, letterSpacing: 1, color: "var(--nv-text-dim)" }}>{label}</span>
      <input type="range" min={min} max={max} value={v} onChange={e => onChange(+e.target.value)} style={{ width: w, accentColor: AC }} />
      <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text)", width: 30, textAlign: "right" }}>{v}{suffix}</span>
    </div>
  );
}

function iconBtn(enabled) { return { width: 32, height: 30, borderRadius: 7, background: enabled ? "var(--nv-elevated)" : "transparent", border: "1px solid " + (enabled ? "var(--nv-border)" : "transparent"), cursor: enabled ? "pointer" : "default", fontFamily: FFB, fontSize: 16, lineHeight: 1, color: enabled ? "var(--nv-text)" : "var(--nv-text-dim)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, opacity: enabled ? 1 : 0.4 }; }
const ghostBtn = { padding: "6px 11px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "var(--nv-text-dim)" };
const miniBtn = { width: 24, height: 24, borderRadius: 6, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "var(--nv-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
const zoomBtn = { width: 28, height: 26, borderRadius: 6, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", cursor: "pointer", fontFamily: FFB, fontSize: 15, color: "var(--nv-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };

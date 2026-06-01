// Asset Studio — Canva-style editor for game/UI assets (Roblox decals):
// transparent background by default, preset decal sizes, image + shape layers,
// multi-select, alignment snapping with guide lines, flip, and one-click
// transparent-PNG download. Layers use normalized 0–1 coordinates so they scale
// with the on-screen preview and export crisply at the chosen pixel size.

import { useState, useRef, useEffect } from "react";
import { FF, FFB } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const PRESETS = [
  { id: "decal1024", label: "Decal 1024²", w: 1024, h: 1024 },
  { id: "decal512", label: "Decal 512²", w: 512, h: 512 },
  { id: "icon512", label: "Game icon 512²", w: 512, h: 512 },
  { id: "sq256", label: "Square 256²", w: 256, h: 256 },
  { id: "thumb", label: "Thumbnail 1920×1080", w: 1920, h: 1080 },
  { id: "tall", label: "Tall 512×1024", w: 512, h: 1024 },
  { id: "wide", label: "Wide 1024×512", w: 1024, h: 512 },
];

// Regular-polygon / star vertices in a 0–1 box, shared by the on-screen SVG
// render and the canvas export so the two always match.
const regPoly = (n) => { const p = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; p.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]); } return p; };
const starPts = (spikes, outer, inner) => { const p = []; for (let i = 0; i < spikes * 2; i++) { const r = i % 2 === 0 ? outer : inner; const a = -Math.PI / 2 + i * Math.PI / spikes; p.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]); } return p; };
const POLY = {
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  pentagon: regPoly(5),
  star: starPts(5, 0.5, 0.21),
};

const SHAPES = [
  { type: "rect", glyph: "▭", label: "Rectangle" },
  { type: "roundrect", glyph: "▢", label: "Rounded rectangle" },
  { type: "ellipse", glyph: "◯", label: "Ellipse" },
  { type: "triangle", glyph: "△", label: "Triangle" },
  { type: "diamond", glyph: "◇", label: "Diamond" },
  { type: "pentagon", glyph: "⬠", label: "Pentagon" },
  { type: "star", glyph: "★", label: "Star" },
  { type: "line", glyph: "╱", label: "Line" },
];

const CHECKER = "repeating-conic-gradient(#3a3f4b 0% 25%, #2a2e38 0% 50%) 50% / 22px 22px";
const GUIDE = "#ff3ea5";
const SNAP = 0.012; // normalized snap threshold (~1.2% of the canvas)

let _seq = 1;
const nid = () => "as-" + (_seq++) + "-" + Math.random().toString(36).slice(2, 6);
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// Snap one axis: given a layer's top-left `pos`, its handle offsets
// ([0, size/2, size] = near edge / center / far edge) and candidate target
// positions, return the closest snap within threshold (or null).
function snapAxis(pos, handles, targets) {
  let best = null;
  for (const off of handles) {
    const h = pos + off;
    for (const t of targets) {
      const d = Math.abs(h - t);
      if (d < SNAP && (best === null || d < best.d)) best = { d, snapped: t - off, guide: t };
    }
  }
  return best;
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function AssetStudioApp({ AC, showToast }) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState("#1b2030");
  const [layers, setLayers] = useState([]);
  const [selIds, setSelIds] = useState([]);
  const [guides, setGuides] = useState({ x: [], y: [] });
  const [marquee, setMarquee] = useState(null);
  const [shapeMenu, setShapeMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const layersRef = useRef(layers);
  const selRef = useRef(selIds);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { selRef.current = selIds; }, [selIds]);

  const ar = preset.w / preset.h;
  const isSel = (id) => selIds.includes(id);
  const selLayers = layers.filter(l => selIds.includes(l.id));
  const single = selLayers.length === 1 ? selLayers[0] : null;
  const allShapes = selLayers.length > 0 && selLayers.every(l => l.type !== "image");
  const anyImage = selLayers.some(l => l.type === "image");
  const ref0 = single || selLayers[0]; // value source for shared sliders

  const patch = (id, p) => setLayers(ls => ls.map(l => l.id === id ? { ...l, ...p } : l));
  const patchSel = (p) => setLayers(ls => ls.map(l => selIds.includes(l.id) ? { ...l, ...p } : l));
  const toggleSel = (key) => setLayers(ls => ls.map(l => selIds.includes(l.id) ? { ...l, [key]: !l[key] } : l));

  function addShape(type) {
    setShapeMenu(false);
    const w = 0.34, h = 0.34;
    const layer = { id: nid(), type, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h, rotation: 0, opacity: 100, flipH: false, flipV: false,
      fill: type === "line" ? null : AC, stroke: "#ffffff", strokeW: type === "line" ? 6 : 0 };
    setLayers(ls => [...ls, layer]); setSelIds([layer.id]);
  }
  function addImageFromSrc(src) {
    loadImage(src).then(img => {
      const iar = img.width / img.height;
      const w = 0.5, h = w * ar / iar;
      const layer = { id: nid(), type: "image", src, x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, opacity: 100, flipH: false, flipV: false };
      setLayers(ls => [...ls, layer]); setSelIds([layer.id]);
    }).catch(() => showToast?.("Couldn't load that image"));
  }
  function onFile(e) { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => addImageFromSrc(r.result); r.readAsDataURL(f); e.target.value = ""; }

  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items; if (!items) return;
      for (const it of items) {
        if (it.type?.startsWith("image/")) { const f = it.getAsFile(); if (f) { const r = new FileReader(); r.onload = () => addImageFromSrc(r.result); r.readAsDataURL(f); e.preventDefault(); showToast?.("Pasted image added"); } break; }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ar]);

  // Drag to move (a single layer or the whole multi-selection), with alignment
  // snapping to the canvas centre/edges and to other layers' edges/centres.
  function startMove(e, layer) {
    e.preventDefault(); e.stopPropagation(); setShapeMenu(false);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) { setSelIds(s => s.includes(layer.id) ? s.filter(i => i !== layer.id) : [...s, layer.id]); return; }
    const group = selRef.current.includes(layer.id) ? selRef.current : [layer.id];
    if (!selRef.current.includes(layer.id)) setSelIds([layer.id]);
    const rect = canvasRef.current.getBoundingClientRect();
    const starts = {}; layersRef.current.forEach(l => { if (group.includes(l.id)) starts[l.id] = { x: l.x, y: l.y }; });
    const prim = layersRef.current.find(l => l.id === layer.id);
    const s0 = { x: e.clientX, y: e.clientY };
    const mv = ev => {
      let dx = (ev.clientX - s0.x) / rect.width;
      let dy = (ev.clientY - s0.y) / rect.height;
      const others = layersRef.current.filter(o => !group.includes(o.id));
      const tX = [0, 0.5, 1]; const tY = [0, 0.5, 1];
      others.forEach(o => { tX.push(o.x, o.x + o.w / 2, o.x + o.w); tY.push(o.y, o.y + o.h / 2, o.y + o.h); });
      const sx = snapAxis(starts[layer.id].x + dx, [0, prim.w / 2, prim.w], tX);
      const sy = snapAxis(starts[layer.id].y + dy, [0, prim.h / 2, prim.h], tY);
      if (sx) dx = sx.snapped - starts[layer.id].x;
      if (sy) dy = sy.snapped - starts[layer.id].y;
      setGuides({ x: sx ? [sx.guide] : [], y: sy ? [sy.guide] : [] });
      setLayers(ls => ls.map(l => starts[l.id]
        ? { ...l, x: Math.min(Math.max(-l.w + 0.05, starts[l.id].x + dx), 0.95), y: Math.min(Math.max(-l.h + 0.05, starts[l.id].y + dy), 0.95) }
        : l));
    };
    const up = () => { setGuides({ x: [], y: [] }); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  function startResize(e, layer) {
    e.preventDefault(); e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const s = { x: e.clientX, y: e.clientY, lw: layer.w, lh: layer.h };
    const mv = ev => patch(layer.id, {
      w: Math.min(Math.max(0.04, s.lw + (ev.clientX - s.x) / rect.width), 2),
      h: Math.min(Math.max(0.04, s.lh + (ev.clientY - s.y) / rect.height), 2),
    });
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  // Drag across empty canvas = marquee box-select (works with touch and mouse).
  function startMarquee(e) {
    if (e.target !== e.currentTarget) return;
    e.stopPropagation(); setShapeMenu(false);
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width, sy = (e.clientY - rect.top) / rect.height;
    let moved = false;
    const mv = ev => {
      const cx = (ev.clientX - rect.left) / rect.width, cy = (ev.clientY - rect.top) / rect.height;
      if (Math.abs(cx - sx) > 0.008 || Math.abs(cy - sy) > 0.008) moved = true;
      setMarquee({ x0: Math.min(sx, cx), y0: Math.min(sy, cy), x1: Math.max(sx, cx), y1: Math.max(sy, cy) });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      setMarquee(m => {
        if (m && moved) {
          const hits = layersRef.current.filter(l => !(l.x > m.x1 || l.x + l.w < m.x0 || l.y > m.y1 || l.y + l.h < m.y0)).map(l => l.id);
          setSelIds(hits);
        } else setSelIds([]);
        return null;
      });
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  const align = (kind) => setLayers(ls => ls.map(l => {
    if (!selIds.includes(l.id)) return l;
    if (kind === "left") return { ...l, x: 0 };
    if (kind === "hcenter") return { ...l, x: 0.5 - l.w / 2 };
    if (kind === "right") return { ...l, x: 1 - l.w };
    if (kind === "top") return { ...l, y: 0 };
    if (kind === "vcenter") return { ...l, y: 0.5 - l.h / 2 };
    if (kind === "bottom") return { ...l, y: 1 - l.h };
    return l;
  }));

  const toFront = () => setLayers(ls => [...ls.filter(l => !selIds.includes(l.id)), ...ls.filter(l => selIds.includes(l.id))]);
  const toBack = () => setLayers(ls => [...ls.filter(l => selIds.includes(l.id)), ...ls.filter(l => !selIds.includes(l.id))]);
  function dup() { if (!selLayers.length) return; const copies = selLayers.map(l => ({ ...l, id: nid(), x: Math.min(l.x + 0.04, 0.9), y: Math.min(l.y + 0.04, 0.9) })); setLayers(ls => [...ls, ...copies]); setSelIds(copies.map(c => c.id)); }
  function del() { if (!selIds.length) return; setLayers(ls => ls.filter(l => !selIds.includes(l.id))); setSelIds([]); }

  async function download() {
    setBusy(true);
    try {
      const W = preset.w, H = preset.h;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H); }
      for (const l of layersRef.current) {
        ctx.save();
        ctx.globalAlpha = (l.opacity ?? 100) / 100;
        const dw = l.w * W, dh = l.h * H, cx = l.x * W + dw / 2, cy = l.y * H + dh / 2;
        ctx.translate(cx, cy);
        ctx.rotate((l.rotation || 0) * Math.PI / 180);
        ctx.scale(l.flipH ? -1 : 1, l.flipV ? -1 : 1);
        if (l.type === "image") { const img = await loadImage(l.src).catch(() => null); if (img) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh); }
        else if (l.type === "line") { ctx.strokeStyle = l.stroke || "#fff"; ctx.lineWidth = Math.max(1, l.strokeW || 4); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-dw / 2, 0); ctx.lineTo(dw / 2, 0); ctx.stroke(); }
        else {
          ctx.beginPath();
          if (l.type === "rect") ctx.rect(-dw / 2, -dh / 2, dw, dh);
          else if (l.type === "roundrect") roundRectPath(ctx, -dw / 2, -dh / 2, dw, dh, Math.min(dw, dh) * 0.16);
          else if (l.type === "ellipse") ctx.ellipse(0, 0, Math.abs(dw / 2), Math.abs(dh / 2), 0, 0, Math.PI * 2);
          else if (POLY[l.type]) { POLY[l.type].forEach(([px, py], i) => { const X = (px - 0.5) * dw, Y = (py - 0.5) * dh; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
          if (l.fill) { ctx.fillStyle = l.fill; ctx.fill(); }
          if (l.strokeW > 0) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeW; ctx.lineJoin = "round"; ctx.stroke(); }
        }
        ctx.restore();
      }
      c.toBlob(b => {
        if (!b) { showToast?.("Export failed"); setBusy(false); return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(b);
        a.download = "nova-asset-" + preset.w + "x" + preset.h + ".png"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        showToast?.("Downloaded PNG ✓"); setBusy(false);
      }, "image/png");
    } catch { showToast?.("Export failed — see console"); setBusy(false); }
  }

  function shapeInner(l, flip) {
    const border = l.strokeW > 0 ? l.strokeW + "px solid " + l.stroke : "none";
    if (l.type === "rect") return <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: border, boxSizing: "border-box", transform: flip }} />;
    if (l.type === "roundrect") return <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: border, borderRadius: "16%", boxSizing: "border-box", transform: flip }} />;
    if (l.type === "ellipse") return <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: border, borderRadius: "50%", boxSizing: "border-box", transform: flip }} />;
    if (l.type === "line") return <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: Math.max(2, l.strokeW || 4), background: l.stroke || "#fff", transform: "translateY(-50%)", borderRadius: 999 }} />;
    if (POLY[l.type]) return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible", transform: flip }}>
        <polygon points={POLY[l.type].map(([px, py]) => (px * 100) + "," + (py * 100)).join(" ")} fill={l.fill || "none"} stroke={l.strokeW > 0 ? l.stroke : "none"} strokeWidth={l.strokeW || 0} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    );
    return null;
  }

  function layerEl(l) {
    const flip = "scaleX(" + (l.flipH ? -1 : 1) + ") scaleY(" + (l.flipV ? -1 : 1) + ")";
    const box = { position: "absolute", left: l.x * 100 + "%", top: l.y * 100 + "%", width: l.w * 100 + "%", height: l.h * 100 + "%", transform: "rotate(" + (l.rotation || 0) + "deg)", opacity: (l.opacity ?? 100) / 100, cursor: "move", outline: isSel(l.id) ? "2px solid " + AC : "none", outlineOffset: 1 };
    const inner = l.type === "image"
      ? <img src={l.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", display: "block", transform: flip }} />
      : shapeInner(l, flip);
    return (
      <div key={l.id} onPointerDown={e => startMove(e, l)} style={box}>
        {inner}
        {single && single.id === l.id && <div onPointerDown={e => startResize(e, l)} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: AC, border: "2px solid #fff", borderRadius: 3, cursor: "se-resize" }} />}
      </div>
    );
  }

  const tbtn = (active) => ({ padding: "7px 11px", borderRadius: 8, border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.14)"), background: active ? fill(AC) : "rgba(255,255,255,0.06)", color: active ? AC : "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" });
  const ibtn = { padding: "6px 9px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontSize: 13, lineHeight: 1, minWidth: 30 };
  const lblS = { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--nv-text-dim)", fontFamily: FF };
  const swatch = { width: 28, height: 28, borderRadius: 6, border: "1px solid var(--nv-border)", background: "none", cursor: "pointer", padding: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: "var(--nv-surface-solid)" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--nv-border)" }}>
        <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", marginRight: 2 }}>🪄 Asset Studio</span>
        <button style={tbtn(false)} onClick={() => fileRef.current?.click()}>＋ Image</button>
        <div style={{ position: "relative" }}>
          <button style={tbtn(shapeMenu)} onClick={() => setShapeMenu(v => !v)}>◇ Shape ▾</button>
          {shapeMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, display: "grid", gridTemplateColumns: "repeat(4, 38px)", gap: 4, padding: 8, borderRadius: 12, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border-strong)", boxShadow: "0 14px 40px rgba(0,0,0,0.5)" }}>
              {SHAPES.map(s => <button key={s.type} title={s.label} onClick={() => addShape(s.type)} style={{ ...ibtn, height: 34, fontSize: 16 }}>{s.glyph}</button>)}
            </div>
          )}
        </div>
        <span style={{ width: 1, height: 22, background: "var(--nv-border)", margin: "0 2px" }} />
        <select value={preset.id} onChange={e => setPreset(PRESETS.find(p => p.id === e.target.value) || PRESETS[0])} style={{ padding: "7px 8px", borderRadius: 8, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 12.5, cursor: "pointer" }}>
          {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button style={tbtn(transparent)} onClick={() => setTransparent(t => !t)}>{transparent ? "✓ Transparent BG" : "Transparent BG"}</button>
        {!transparent && <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} title="Background color" style={swatch} />}
        <div style={{ flex: 1 }} />
        <button onClick={download} disabled={busy} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, cursor: busy ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, opacity: busy ? 0.5 : 1 }}>⬇ Download PNG</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16, background: "#0a0c14" }} onPointerDown={() => setShapeMenu(false)}>
        <div ref={canvasRef} onPointerDown={startMarquee}
          style={{ position: "relative", aspectRatio: preset.w + " / " + preset.h, width: "min(100%, " + (ar * 64).toFixed(0) + "vh)", maxWidth: "100%", background: transparent ? CHECKER : bgColor, borderRadius: 4, boxShadow: "0 16px 50px rgba(0,0,0,0.55)", overflow: "hidden", flexShrink: 0 }}>
          {layers.map(layerEl)}
          {guides.x.map((g, i) => <div key={"gx" + i} style={{ position: "absolute", left: g * 100 + "%", top: 0, bottom: 0, width: 1, background: GUIDE, pointerEvents: "none", zIndex: 99 }} />)}
          {guides.y.map((g, i) => <div key={"gy" + i} style={{ position: "absolute", top: g * 100 + "%", left: 0, right: 0, height: 1, background: GUIDE, pointerEvents: "none", zIndex: 99 }} />)}
          {marquee && <div style={{ position: "absolute", left: marquee.x0 * 100 + "%", top: marquee.y0 * 100 + "%", width: (marquee.x1 - marquee.x0) * 100 + "%", height: (marquee.y1 - marquee.y0) * 100 + "%", border: "1px solid " + AC, background: fill(AC), pointerEvents: "none", zIndex: 98 }} />}
        </div>
      </div>

      {/* Properties */}
      {selLayers.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: "1px solid var(--nv-border)", background: "rgba(255,255,255,0.02)" }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)", textTransform: "capitalize" }}>{single ? single.type : selLayers.length + " selected"}</span>

          {allShapes && selLayers.every(l => l.type !== "line") && (
            <span style={lblS}>Fill <input type="color" value={ref0.fill || "#000000"} onChange={e => patchSel({ fill: e.target.value })} style={swatch} /><button onClick={() => patchSel({ fill: null })} title="No fill" style={{ ...ibtn, fontSize: 11, padding: "4px 7px" }}>none</button></span>
          )}
          {allShapes && (
            <span style={lblS}>{selLayers.every(l => l.type === "line") ? "Color" : "Stroke"} <input type="color" value={ref0.stroke || "#ffffff"} onChange={e => patchSel({ stroke: e.target.value })} style={swatch} /></span>
          )}
          {allShapes && (
            <span style={lblS}>{selLayers.every(l => l.type === "line") ? "Thickness" : "Border"} <input type="range" min="0" max="40" value={ref0.strokeW || 0} onChange={e => patchSel({ strokeW: +e.target.value })} style={{ width: 72 }} /></span>
          )}

          <span style={lblS}>Opacity <input type="range" min="10" max="100" value={ref0.opacity ?? 100} onChange={e => patchSel({ opacity: +e.target.value })} style={{ width: 72 }} /></span>
          <span style={lblS}>Rotate <input type="range" min="0" max="360" value={ref0.rotation || 0} onChange={e => patchSel({ rotation: +e.target.value })} style={{ width: 72 }} /></span>

          {(anyImage || single) && (
            <span style={{ display: "flex", gap: 4 }}>
              <button style={ibtn} title="Flip horizontal" onClick={() => toggleSel("flipH")}>⇄</button>
              <button style={ibtn} title="Flip vertical" onClick={() => toggleSel("flipV")}>⇅</button>
            </span>
          )}

          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button style={ibtn} title="Align left" onClick={() => align("left")}>⇤</button>
            <button style={ibtn} title="Center horizontally" onClick={() => align("hcenter")}>⇔</button>
            <button style={ibtn} title="Align right" onClick={() => align("right")}>⇥</button>
            <button style={ibtn} title="Align top" onClick={() => align("top")}>⤒</button>
            <button style={ibtn} title="Center vertically" onClick={() => align("vcenter")}>⇕</button>
            <button style={ibtn} title="Align bottom" onClick={() => align("bottom")}>⤓</button>
          </span>

          <div style={{ flex: 1 }} />
          <button style={ibtn} onClick={toFront} title="Bring to front">⬆</button>
          <button style={ibtn} onClick={toBack} title="Send to back">⬇</button>
          <button style={ibtn} onClick={dup} title="Duplicate">⧉</button>
          <button style={{ ...ibtn, color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }} onClick={del} title="Delete">🗑</button>
        </div>
      ) : (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--nv-border)", fontSize: 11.5, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center" }}>
          Add an image or shape, drag to arrange — pink guides snap to centres &amp; edges. Drag empty space to box-select, or Shift-click to multi-select. Then ⬇ Download a transparent PNG.
        </div>
      )}
    </div>
  );
}

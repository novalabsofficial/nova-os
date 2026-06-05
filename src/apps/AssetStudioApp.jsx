// Asset Studio — Canva-style editor for game/UI assets (Roblox decals):
// transparent background by default, preset decal sizes, image + shape layers,
// multi-select, alignment snapping with guide lines, flip, an 8-handle
// rotation-aware resize (+ pinch on touch), snip-a-region export, and one-click
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
  { type: "curve", glyph: "⌒", label: "Curved line" },
];

// Resize handles: 4 corners (resize both axes) + 4 edge midpoints (one axis).
const HANDLES = [
  { id: "nw", hx: 0, hy: 0, ax: 1, ay: 1 }, { id: "n", hx: 0.5, hy: 0, ax: 0, ay: 1 }, { id: "ne", hx: 1, hy: 0, ax: 1, ay: 1 },
  { id: "e", hx: 1, hy: 0.5, ax: 1, ay: 0 }, { id: "se", hx: 1, hy: 1, ax: 1, ay: 1 }, { id: "s", hx: 0.5, hy: 1, ax: 0, ay: 1 },
  { id: "sw", hx: 0, hy: 1, ax: 1, ay: 1 }, { id: "w", hx: 0, hy: 0.5, ax: 1, ay: 0 },
];
const CURS = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

const CHECKER = "repeating-conic-gradient(#3a3f4b 0% 25%, #2a2e38 0% 50%) 50% / 22px 22px";
const GUIDE = "#ff3ea5";
const SNAP = 0.012; // normalized snap threshold (~1.2% of the canvas)

let _seq = 1;
const nid = () => "as-" + (_seq++) + "-" + Math.random().toString(36).slice(2, 6);
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const rot2 = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) }); // rotate a vector by a radians

// Snap one axis: given a layer's top-left `pos`, its handle offsets
// ([0, size/2, size] = near edge / centre / far edge) and candidate targets,
// return the closest snap within threshold (or null).
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

// v11.0 — recolor an uploaded image. Builds a solid-color silhouette that keeps
// the image's own alpha mask, then blends it over the original by `amt` (0–1):
// amt = 1 fully replaces the color (perfect for tinting a white icon to any
// color), lower values keep the original shading/detail. Full resolution → a
// crisp PNG data URL used by both the on-screen preview and the export.
function tintImage(img, color, amt) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sil = document.createElement("canvas"); sil.width = W; sil.height = H;
  const sx = sil.getContext("2d");
  sx.drawImage(img, 0, 0, W, H);
  sx.globalCompositeOperation = "source-in";          // paint solid color only where the image is opaque
  sx.fillStyle = color; sx.fillRect(0, 0, W, H);
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const ox = out.getContext("2d");
  ox.drawImage(img, 0, 0, W, H);                       // original underneath
  ox.globalAlpha = Math.min(1, Math.max(0, amt));      // blend the silhouette on top
  ox.drawImage(sil, 0, 0);
  return out.toDataURL("image/png");
}

// v11.0 — material presets (shininess). Each is a CSS filter string applied
// identically in the DOM preview (style.filter) and the canvas export
// (ctx.filter) so it's WYSIWYG, plus an optional specular "sheen" highlight
// clipped to the shape. Neon's glow color is the layer's own fill.
const MATERIALS = [
  { id: "flat", label: "Flat" },
  { id: "matte", label: "Matte", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.30)) saturate(0.94)" },
  { id: "glossy", label: "Glossy", filter: "drop-shadow(0 3px 7px rgba(0,0,0,0.38)) brightness(1.05) contrast(1.05)", sheen: "gloss", sheenA: 0.45 },
  { id: "shiny", label: "Shiny", filter: "drop-shadow(0 4px 9px rgba(0,0,0,0.42)) brightness(1.09) contrast(1.10) saturate(1.08)", sheen: "gloss", sheenA: 0.72 },
  { id: "metal", label: "Metallic", filter: "drop-shadow(0 3px 7px rgba(0,0,0,0.42)) contrast(1.14) brightness(1.04)", sheen: "metal", sheenA: 0.55 },
  { id: "glass", label: "Glass", filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.30)) brightness(1.08)", sheen: "gloss", sheenA: 0.40 },
  { id: "neon", label: "Neon", glow: true, filter: "brightness(1.12)" },
];
const matById = (id) => MATERIALS.find(m => m.id === id);

// v11.0 — text layers. A handful of default font stacks (no bundled webfonts —
// these are system families that render identically in the DOM preview and the
// canvas export). The text size scales with the layer box height.
const FONTS = [
  { id: "sans", label: "Sans", css: "'Inter','Segoe UI',system-ui,sans-serif" },
  { id: "serif", label: "Serif", css: "Georgia,'Times New Roman',serif" },
  { id: "mono", label: "Mono", css: "'JetBrains Mono',Consolas,monospace" },
  { id: "round", label: "Rounded", css: "'Trebuchet MS','Segoe UI',sans-serif" },
  { id: "display", label: "Display", css: "'Arial Black',Impact,sans-serif" },
];
const fontCss = (id) => (FONTS.find(f => f.id === id) || FONTS[0]).css;
const TEXT_FIT = 0.74;   // font size as a fraction of the layer-box height
const glowColor = (l) => l.fill || l.stroke || "#ffffff";
function matFilter(mat, l) {
  if (!mat || mat.id === "flat") return "none";
  if (mat.glow) { const c = glowColor(l); return "drop-shadow(0 0 5px " + c + ") drop-shadow(0 0 13px " + c + ") brightness(1.12)"; }
  return mat.filter || "none";
}
// Shared gloss/metal gradient stops — `addStop(offset0to1, cssColor)` is fed by
// both the DOM (linear-gradient) and the canvas (createLinearGradient).
function sheenGrad(kind, a, addStop) {
  if (kind === "metal") {
    addStop(0, "rgba(255,255,255,0)"); addStop(0.16, "rgba(255,255,255," + a + ")"); addStop(0.36, "rgba(255,255,255,0)");
    addStop(0.6, "rgba(0,0,0," + (a * 0.45) + ")"); addStop(0.84, "rgba(255,255,255," + (a * 0.85) + ")"); addStop(1, "rgba(255,255,255,0)");
  } else {
    addStop(0, "rgba(255,255,255," + a + ")"); addStop(0.34, "rgba(255,255,255," + (a * 0.35) + ")"); addStop(0.58, "rgba(255,255,255,0)");
  }
}
function sheenCss(mat) {
  const stops = [];
  sheenGrad(mat.sheen, mat.sheenA ?? 0.5, (o, c) => stops.push(c + " " + (o * 100) + "%"));
  return "linear-gradient(to bottom, " + stops.join(", ") + ")";
}
// The on-screen sheen overlay, clipped to the shape (area shapes only — a gloss
// over an image's transparent areas or a thin line reads wrong, so those rely on
// the filter alone).
function sheenOverlay(l, mat, flip) {
  if (!mat || !mat.sheen || l.type === "image" || l.type === "line") return null;
  const base = { position: "absolute", inset: 0, pointerEvents: "none", background: sheenCss(mat), mixBlendMode: "screen", transform: flip };
  if (l.type === "rect") return <div style={base} />;
  if (l.type === "roundrect") return <div style={{ ...base, borderRadius: "16%" }} />;
  if (l.type === "ellipse") return <div style={{ ...base, borderRadius: "50%" }} />;
  if (POLY[l.type]) {
    const a = mat.sheenA ?? 0.5, gid = "sheen-" + l.id;
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", transform: flip, mixBlendMode: "screen" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={a} /><stop offset="34%" stopColor="#fff" stopOpacity={a * 0.35} /><stop offset="58%" stopColor="#fff" stopOpacity="0" />
        </linearGradient></defs>
        <polygon points={POLY[l.type].map(([px, py]) => (px * 100) + "," + (py * 100)).join(" ")} fill={"url(#" + gid + ")"} />
      </svg>
    );
  }
  return null;
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
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);   // v11.0 — drag-drop image files onto the canvas
  const [canvasPx, setCanvasPx] = useState({ w: 0, h: 0 }); // on-screen canvas size, so text scales WYSIWYG
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const layersRef = useRef(layers);
  const selRef = useRef(selIds);
  const cropRef = useRef(cropMode);
  const hot = useRef(false);            // is the user interacting with this app?
  const ptrs = useRef(new Map());       // active pointerId -> {x,y} for move/pinch
  const gesture = useRef(null);         // current move/pinch descriptor
  const imgSrcCache = useRef(new Map()); // src -> decoded Image, so recolor doesn't re-decode each slider tick
  const clipRef = useRef([]);            // internal layer clipboard — Ctrl+C copies layers; pasted via onPaste only when the system clipboard has no image
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { selRef.current = selIds; }, [selIds]);
  useEffect(() => { cropRef.current = cropMode; }, [cropMode]);

  const ar = preset.w / preset.h;
  // Track the on-screen canvas size so text scales WYSIWYG (declared after `ar`,
  // which it depends on, to avoid a temporal-dead-zone error).
  useEffect(() => {
    const el = canvasRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => { const r = el.getBoundingClientRect(); setCanvasPx({ w: r.width, h: r.height }); };
    read(); const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, [ar]);
  const isSel = (id) => selIds.includes(id);
  const selLayers = layers.filter(l => selIds.includes(l.id));
  const single = selLayers.length === 1 ? selLayers[0] : null;
  const allShapes = selLayers.length > 0 && selLayers.every(l => l.type !== "image");
  const anyImage = selLayers.some(l => l.type === "image");
  const ref0 = single || selLayers[0];
  const imgSel = selLayers.filter(l => l.type === "image");
  const imgRef = imgSel[0];
  const anyText = selLayers.some(l => l.type === "text");
  const isText = !!(single && single.type === "text");
  const textRef = selLayers.find(l => l.type === "text");
  const everyLineLike = selLayers.length > 0 && selLayers.every(l => l.type === "line" || l.type === "curve");   // stroke-only shapes
  const curveRef = selLayers.find(l => l.type === "curve");

  const patch = (id, p) => setLayers(ls => ls.map(l => l.id === id ? { ...l, ...p } : l));
  const patchSel = (p) => setLayers(ls => ls.map(l => selIds.includes(l.id) ? { ...l, ...p } : l));
  const patchText = (p) => setLayers(ls => ls.map(l => (selIds.includes(l.id) && l.type === "text") ? { ...l, ...p } : l));   // text-only, so a mixed selection's shapes aren't clobbered
  const toggleSel = (key) => setLayers(ls => ls.map(l => selIds.includes(l.id) ? { ...l, [key]: !l[key] } : l));

  function addShape(type) {
    setShapeMenu(false);
    const w = 0.34, h = 0.34;
    const lineLike = (type === "line" || type === "curve");   // stroke-only, no fill
    const layer = { id: nid(), type, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h, rotation: 0, opacity: 100, flipH: false, flipV: false,
      fill: lineLike ? null : AC, stroke: "#ffffff", strokeW: lineLike ? 6 : 0,
      ...(type === "curve" ? { curve: 0.6 } : {}) };
    setLayers(ls => [...ls, layer]); setSelIds([layer.id]);
  }
  function addText() {
    setShapeMenu(false);
    const w = 0.5, h = 0.16;
    const layer = { id: nid(), type: "text", text: "Text", x: 0.5 - w / 2, y: 0.5 - h / 2, w, h, rotation: 0, opacity: 100, flipH: false, flipV: false, fill: "#ffffff", font: "sans", weight: 800, align: "center" };
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

  function del() { if (!selRef.current.length) return; setLayers(ls => ls.filter(l => !selRef.current.includes(l.id))); setSelIds([]); }

  // Paste image, scoped delete/escape keys, and the persistent move/pinch driver.
  useEffect(() => {
    function onPaste(e) {
      if (!hot.current) return;
      const ae = document.activeElement, at = ae && ae.tagName;
      if (at === "INPUT" || at === "TEXTAREA" || at === "SELECT" || (ae && ae.isContentEditable)) return;   // typing -> native paste
      const items = e.clipboardData?.items || [];
      // An image on the system clipboard always wins (e.g. a logo copied from a
      // webpage). Only when there's no image do we fall back to the internal
      // layer clipboard — so an external copy is never shadowed by an old in-app one.
      for (const it of items) {
        if (it.type?.startsWith("image/")) { const f = it.getAsFile(); if (f) { const r = new FileReader(); r.onload = () => addImageFromSrc(r.result); r.readAsDataURL(f); e.preventDefault(); showToast?.("Pasted image added"); } return; }
      }
      if (clipRef.current && clipRef.current.length) { e.preventDefault(); pasteInternal(); }
    }
    function onDown(e) { hot.current = !!rootRef.current && rootRef.current.contains(e.target); }
    function onKey(e) {
      if (!hot.current) return;
      if (e.key === "Escape") { if (cropRef.current) { setCropMode(false); setCropRect(null); } else setSelIds([]); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        const a = document.activeElement, t = a && a.tagName;
        if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || (a && a.isContentEditable)) return;   // let real text copy through
        if (window.getSelection && String(window.getSelection())) return;
        e.preventDefault();
        if (selRef.current.length) {   // copy the selected layers (faithful duplicate on paste)
          clipRef.current = layersRef.current.filter(l => selRef.current.includes(l.id)).map(l => ({ ...l }));
          showToast?.(clipRef.current.length > 1 ? clipRef.current.length + " layers copied" : "Layer copied");
        } else copyImage();           // nothing selected -> copy the whole image to the system clipboard
        return;
      }
      // Ctrl+V is handled in onPaste so the real system clipboard always takes
      // priority (a fresh image copied from elsewhere beats a stale internal copy).
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const el = document.activeElement, tag = el && el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el && el.isContentEditable)) return;
      if (!selRef.current.length || cropRef.current) return;
      e.preventDefault(); e.stopPropagation(); del();
    }
    function onMove(ev) {
      if (!ptrs.current.has(ev.pointerId)) return;
      ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const g = gesture.current; if (!g) return;
      if (g.mode === "move") {
        if (ptrs.current.size >= 2 && g.group.length <= 1) { // a second finger -> pinch-resize
          const L = layersRef.current.find(l => l.id === g.id); const pts = [...ptrs.current.values()];
          gesture.current = { mode: "pinch", id: g.id, dist0: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1, w0: L.w, h0: L.h, cx: L.x + L.w / 2, cy: L.y + L.h / 2 };
          setGuides({ x: [], y: [] }); return;
        }
        const cur = ptrs.current.get(g.pointerId); if (!cur) return;
        let dx = (cur.x - g.s0.x) / g.rect.width, dy = (cur.y - g.s0.y) / g.rect.height;
        const others = layersRef.current.filter(o => !g.group.includes(o.id));
        const tX = [0, 0.5, 1], tY = [0, 0.5, 1];
        others.forEach(o => { tX.push(o.x, o.x + o.w / 2, o.x + o.w); tY.push(o.y, o.y + o.h / 2, o.y + o.h); });
        const sx = snapAxis(g.starts[g.id].x + dx, [0, g.prim.w / 2, g.prim.w], tX);
        const sy = snapAxis(g.starts[g.id].y + dy, [0, g.prim.h / 2, g.prim.h], tY);
        if (sx) dx = sx.snapped - g.starts[g.id].x;
        if (sy) dy = sy.snapped - g.starts[g.id].y;
        setGuides({ x: sx ? [sx.guide] : [], y: sy ? [sy.guide] : [] });
        setLayers(ls => ls.map(l => g.starts[l.id]
          ? { ...l, x: Math.min(Math.max(-l.w + 0.05, g.starts[l.id].x + dx), 0.95), y: Math.min(Math.max(-l.h + 0.05, g.starts[l.id].y + dy), 0.95) }
          : l));
      } else if (g.mode === "pinch") {
        const pts = [...ptrs.current.values()]; if (pts.length < 2) return;
        const scale = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / g.dist0;
        const nw = Math.min(Math.max(0.04, g.w0 * scale), 2), nh = Math.min(Math.max(0.04, g.h0 * scale), 2);
        patch(g.id, { w: nw, h: nh, x: g.cx - nw / 2, y: g.cy - nh / 2 });
      }
    }
    function onUp(ev) {
      if (!ptrs.current.has(ev.pointerId)) return;
      ptrs.current.delete(ev.pointerId);
      if (ptrs.current.size === 0) { gesture.current = null; setGuides({ x: [], y: [] }); }
      else if (gesture.current && gesture.current.mode === "pinch" && ptrs.current.size < 2) gesture.current = null;
    }
    window.addEventListener("paste", onPaste);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [ar]); // re-bind paste sizing if the preset aspect changes

  // Press (or two-finger pinch) on a layer.
  function onLayerPointerDown(e, layer) {
    if (cropMode) return;
    e.preventDefault(); e.stopPropagation(); setShapeMenu(false);
    if (e.shiftKey || e.metaKey || e.ctrlKey) { setSelIds(s => s.includes(layer.id) ? s.filter(i => i !== layer.id) : [...s, layer.id]); return; }
    if (!selRef.current.includes(layer.id)) setSelIds([layer.id]);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = canvasRef.current.getBoundingClientRect();
    const group = selRef.current.includes(layer.id) ? selRef.current.slice() : [layer.id];
    if (ptrs.current.size >= 2 && group.length <= 1) {
      const L = layersRef.current.find(l => l.id === layer.id); const pts = [...ptrs.current.values()];
      gesture.current = { mode: "pinch", id: layer.id, dist0: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1, w0: L.w, h0: L.h, cx: L.x + L.w / 2, cy: L.y + L.h / 2 };
      return;
    }
    const starts = {}; layersRef.current.forEach(l => { if (group.includes(l.id)) starts[l.id] = { x: l.x, y: l.y }; });
    const prim = layersRef.current.find(l => l.id === layer.id);
    gesture.current = { mode: "move", pointerId: e.pointerId, id: layer.id, group, starts, prim: { w: prim.w, h: prim.h }, s0: { x: e.clientX, y: e.clientY }, rect };
  }

  // Rotation-aware resize: keep the opposite handle anchored in screen space and
  // work in the layer's local axes, so dragging feels natural even when rotated.
  function startResize(e, layer, h) {
    e.preventDefault(); e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const Wp = rect.width, Hp = rect.height, th = (layer.rotation || 0) * Math.PI / 180;
    const w0 = layer.w * Wp, h0 = layer.h * Hp;
    const C0 = { x: (layer.x + layer.w / 2) * Wp, y: (layer.y + layer.h / 2) * Hp };
    const aSignX = 1 - 2 * h.hx, aSignY = 1 - 2 * h.hy;          // direction of the anchor from centre
    const aL = rot2(aSignX * w0 / 2, aSignY * h0 / 2, th);
    const aWorld = { x: C0.x + aL.x, y: C0.y + aL.y };           // anchor stays fixed
    const isImg = layer.type === "image", ratio = w0 / Math.max(1, h0), corner = h.ax && h.ay, MIN = 8;
    const mv = ev => {
      const rel = { x: (ev.clientX - rect.left) - aWorld.x, y: (ev.clientY - rect.top) - aWorld.y };
      const d = rot2(rel.x, rel.y, -th);
      let nw = h.ax ? Math.abs(d.x) : w0;
      let nh = h.ay ? Math.abs(d.y) : h0;
      const lock = corner && (isImg ? !ev.shiftKey : ev.shiftKey); // images keep aspect (Shift frees); shapes free (Shift locks)
      if (lock) { const s = Math.max(nw / w0, nh / h0); nw = w0 * s; nh = h0 * s; }
      nw = Math.max(MIN, nw); nh = Math.max(MIN, nh);
      const off = rot2(aSignX * nw / 2, aSignY * nh / 2, th);
      const Cn = { x: aWorld.x - off.x, y: aWorld.y - off.y };
      patch(layer.id, { w: nw / Wp, h: nh / Hp, x: (Cn.x - nw / 2) / Wp, y: (Cn.y - nh / 2) / Hp });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  // Drag across empty canvas = marquee box-select (mouse + touch).
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
        if (m && moved) setSelIds(layersRef.current.filter(l => !(l.x > m.x1 || l.x + l.w < m.x0 || l.y > m.y1 || l.y + l.h < m.y0)).map(l => l.id));
        else setSelIds([]);
        return null;
      });
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  // Drag across the canvas while snipping = define the export region.
  function startCrop(e) {
    if (e.target !== e.currentTarget) return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = clamp01((e.clientX - rect.left) / rect.width), sy = clamp01((e.clientY - rect.top) / rect.height);
    const mv = ev => {
      const cx = clamp01((ev.clientX - rect.left) / rect.width), cy = clamp01((ev.clientY - rect.top) / rect.height);
      setCropRect({ x0: Math.min(sx, cx), y0: Math.min(sy, cy), x1: Math.max(sx, cx), y1: Math.max(sy, cy) });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
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

  async function getImg(src) {
    const c = imgSrcCache.current;
    if (c.has(src)) return c.get(src);
    const img = await loadImage(src).catch(() => null);
    if (img) c.set(src, img);
    return img;
  }
  // Recolor every selected image layer (color=null clears it). Re-tints from the
  // original src each time so strength is always relative to the source image.
  async function recolorSelected(color, amt = 1) {
    const imgs = layersRef.current.filter(l => selRef.current.includes(l.id) && l.type === "image");
    if (!imgs.length) return;
    if (!color) { setLayers(ls => ls.map(l => imgs.some(i => i.id === l.id) ? { ...l, tint: null, tintAmt: undefined, tintedSrc: null } : l)); return; }
    const made = {};
    for (const l of imgs) { const img = await getImg(l.src); if (img) made[l.id] = tintImage(img, color, amt); }
    setLayers(ls => ls.map(l => made[l.id] ? { ...l, tint: color, tintAmt: amt, tintedSrc: made[l.id] } : l));
  }
  // Paste the internally-copied layers as faithful duplicates (same type/size/
  // style), nudged so they don't sit exactly on the originals.
  function pasteInternal() {
    const src = clipRef.current;
    if (!src || !src.length) return;
    const copies = src.map(l => ({ ...l, id: nid(), x: Math.min((l.x || 0) + 0.04, 0.92), y: Math.min((l.y || 0) + 0.04, 0.92) }));
    setLayers(ls => [...ls, ...copies]); setSelIds(copies.map(c => c.id));
    showToast?.(copies.length > 1 ? copies.length + " layers pasted" : "Pasted");
  }

  // Draw every layer into ctx using CW×CH as the coordinate space.
  async function renderLayers(ctx, CW, CH) {
    for (const l of layersRef.current) {
      ctx.save();
      ctx.globalAlpha = (l.opacity ?? 100) / 100;
      const dw = l.w * CW, dh = l.h * CH, cx = l.x * CW + dw / 2, cy = l.y * CH + dh / 2;
      ctx.translate(cx, cy);
      ctx.rotate((l.rotation || 0) * Math.PI / 180);
      ctx.scale(l.flipH ? -1 : 1, l.flipV ? -1 : 1);
      const mat = matById(l.material); ctx.filter = matFilter(mat, l);
      if (l.type === "image") { const img = await loadImage(l.tintedSrc || l.src).catch(() => null); if (img) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh); }
      else if (l.type === "line") { ctx.strokeStyle = l.stroke || "#fff"; ctx.lineWidth = Math.max(1, l.strokeW || 4); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-dw / 2, 0); ctx.lineTo(dw / 2, 0); ctx.stroke(); }
      else if (l.type === "curve") { ctx.strokeStyle = l.stroke || "#fff"; ctx.lineWidth = Math.max(1, l.strokeW || 4); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-dw / 2, 0); ctx.quadraticCurveTo(0, -(l.curve ?? 0.6) * 0.5 * dh, dw / 2, 0); ctx.stroke(); }
      else if (l.type === "text") {
        const fs = Math.max(2, dh * TEXT_FIT);
        ctx.font = (l.weight || 700) + " " + fs + "px " + fontCss(l.font);
        ctx.fillStyle = l.fill || "#fff"; ctx.textBaseline = "middle";
        ctx.textAlign = l.align === "left" ? "left" : l.align === "right" ? "right" : "center";
        const tx = l.align === "left" ? -dw / 2 : l.align === "right" ? dw / 2 : 0;
        ctx.fillText(l.text || "", tx, 0);
      }
      else {
        ctx.beginPath();
        if (l.type === "rect") ctx.rect(-dw / 2, -dh / 2, dw, dh);
        else if (l.type === "roundrect") roundRectPath(ctx, -dw / 2, -dh / 2, dw, dh, Math.min(dw, dh) * 0.16);
        else if (l.type === "ellipse") ctx.ellipse(0, 0, Math.abs(dw / 2), Math.abs(dh / 2), 0, 0, Math.PI * 2);
        else if (POLY[l.type]) { POLY[l.type].forEach(([px, py], i) => { const X = (px - 0.5) * dw, Y = (py - 0.5) * dh; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
        if (l.fill) { ctx.fillStyle = l.fill; ctx.fill(); }
        if (l.strokeW > 0) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeW; ctx.lineJoin = "round"; ctx.stroke(); }
        if (mat && mat.sheen) {
          ctx.filter = "none"; ctx.save();
          ctx.beginPath();
          if (l.type === "rect") ctx.rect(-dw / 2, -dh / 2, dw, dh);
          else if (l.type === "roundrect") roundRectPath(ctx, -dw / 2, -dh / 2, dw, dh, Math.min(dw, dh) * 0.16);
          else if (l.type === "ellipse") ctx.ellipse(0, 0, Math.abs(dw / 2), Math.abs(dh / 2), 0, 0, Math.PI * 2);
          else if (POLY[l.type]) { POLY[l.type].forEach(([px, py], i) => { const X = (px - 0.5) * dw, Y = (py - 0.5) * dh; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
          ctx.clip(); ctx.globalCompositeOperation = "screen";
          const sg = ctx.createLinearGradient(0, -dh / 2, 0, dh / 2);
          sheenGrad(mat.sheen, mat.sheenA ?? 0.5, (o, c) => sg.addColorStop(o, c));
          ctx.fillStyle = sg; ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }
  function saveBlob(canvas, name, msg) {
    canvas.toBlob(b => {
      if (!b) { showToast?.("Export failed"); setBusy(false); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      showToast?.(msg); setBusy(false);
    }, "image/png");
  }
  async function download() {
    setBusy(true);
    try {
      const W = preset.w, H = preset.h;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H); }
      await renderLayers(ctx, W, H);
      saveBlob(c, "nova-asset-" + W + "x" + H + ".png", "Downloaded PNG ✓");
    } catch { showToast?.("Export failed — see console"); setBusy(false); }
  }
  // v11.0 — copy the composited image to the clipboard (Ctrl/Cmd+C or the Copy
  // button) so it can be pasted into another app. Falls back to a hint if the
  // browser blocks image-clipboard writes.
  async function copyImage() {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) { showToast?.("Copy unsupported here — use Download"); return; }
    setBusy(true);
    try {
      const W = preset.w, H = preset.h;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H); }
      await renderLayers(ctx, W, H);
      const blob = await new Promise(res => c.toBlob(res, "image/png"));
      if (!blob) { showToast?.("Copy failed"); setBusy(false); return; }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast?.("Copied to clipboard ✓"); setBusy(false);
    } catch { showToast?.("Copy failed — clipboard blocked"); setBusy(false); }
  }
  // v11.0 — drag image files from the OS / another app onto the canvas to add them.
  function onDropFiles(e) {
    e.preventDefault(); setDragActive(false);
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type?.startsWith("image/"));
    if (!files.length) return;
    files.forEach(f => { const r = new FileReader(); r.onload = () => addImageFromSrc(r.result); r.readAsDataURL(f); });
    showToast?.(files.length > 1 ? files.length + " images added" : "Image added");
  }
  async function downloadRegion() {
    if (!cropRect) return;
    setBusy(true);
    try {
      const cr = cropRect;
      const W = Math.max(1, Math.round((cr.x1 - cr.x0) * preset.w)), H = Math.max(1, Math.round((cr.y1 - cr.y0) * preset.h));
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H); }
      ctx.translate(-cr.x0 * preset.w, -cr.y0 * preset.h); // map the crop origin to (0,0)
      await renderLayers(ctx, preset.w, preset.h);
      saveBlob(c, "nova-asset-crop-" + W + "x" + H + ".png", "Downloaded selection ✓");
    } catch { showToast?.("Export failed — see console"); setBusy(false); }
  }

  function shapeInner(l, flip) {
    const border = l.strokeW > 0 ? l.strokeW + "px solid " + l.stroke : "none";
    if (l.type === "rect") return <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: border, boxSizing: "border-box", transform: flip }} />;
    if (l.type === "roundrect") return <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: border, borderRadius: "16%", boxSizing: "border-box", transform: flip }} />;
    if (l.type === "ellipse") return <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: border, borderRadius: "50%", boxSizing: "border-box", transform: flip }} />;
    if (l.type === "line") return <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: Math.max(2, l.strokeW || 4), background: l.stroke || "#fff", transform: "translateY(-50%)", borderRadius: 999 }} />;
    if (l.type === "curve") return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible", transform: flip }}>
        <path d={"M 0,50 Q 50," + ((0.5 - (l.curve ?? 0.6) * 0.5) * 100) + " 100,50"} fill="none" stroke={l.stroke || "#fff"} strokeWidth={Math.max(1, l.strokeW || 4)} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
    );
    if (POLY[l.type]) return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible", transform: flip }}>
        <polygon points={POLY[l.type].map(([px, py]) => (px * 100) + "," + (py * 100)).join(" ")} fill={l.fill || "none"} stroke={l.strokeW > 0 ? l.stroke : "none"} strokeWidth={l.strokeW || 0} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    );
    return null;
  }

  // Text layer preview — font size scales with the layer-box height (in on-screen
  // px) so it matches the export exactly.
  function textInner(l, flip) {
    const fs = Math.max(4, l.h * (canvasPx.h || 420) * TEXT_FIT);
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: l.align === "left" ? "flex-start" : l.align === "right" ? "flex-end" : "center", color: l.fill || "#fff", fontFamily: fontCss(l.font), fontWeight: l.weight || 700, fontSize: fs, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "visible", textAlign: l.align || "center", transform: flip, pointerEvents: "none", userSelect: "none" }}>{l.text || " "}</div>
    );
  }

  function layerEl(l) {
    const flip = "scaleX(" + (l.flipH ? -1 : 1) + ") scaleY(" + (l.flipV ? -1 : 1) + ")";
    const box = { position: "absolute", left: l.x * 100 + "%", top: l.y * 100 + "%", width: l.w * 100 + "%", height: l.h * 100 + "%", transform: "rotate(" + (l.rotation || 0) + "deg)", opacity: (l.opacity ?? 100) / 100, cursor: "move", outline: isSel(l.id) ? "2px solid " + AC : "none", outlineOffset: 1, pointerEvents: cropMode ? "none" : "auto", touchAction: "none" };
    const mat = matById(l.material);
    const inner = l.type === "image"
      ? <img src={l.tintedSrc || l.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", display: "block", transform: flip }} />
      : l.type === "text"
        ? textInner(l, flip)
        : shapeInner(l, flip);
    const showHandles = single && single.id === l.id && !cropMode;
    return (
      <div key={l.id} onPointerDown={e => onLayerPointerDown(e, l)} style={box}>
        <div style={{ position: "absolute", inset: 0, filter: matFilter(mat, l) }}>
          {inner}
          {sheenOverlay(l, mat, flip)}
        </div>
        {showHandles && HANDLES.map(h => (
          <div key={h.id} onPointerDown={e => startResize(e, l, h)} style={{ position: "absolute", left: h.hx * 100 + "%", top: h.hy * 100 + "%", width: 13, height: 13, transform: "translate(-50%,-50%)", background: "#fff", border: "2px solid " + AC, borderRadius: (h.ax && h.ay) ? 2 : 7, cursor: CURS[h.id], touchAction: "none", zIndex: 6 }} />
        ))}
      </div>
    );
  }

  const tbtn = (active) => ({ padding: "7px 11px", borderRadius: 8, border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.14)"), background: active ? fill(AC) : "rgba(255,255,255,0.06)", color: active ? AC : "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" });
  const ibtn = { padding: "6px 9px", borderRadius: 7, border: "1px solid var(--nv-border)", background:"var(--nv-elevated)", color: "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontSize: 13, lineHeight: 1, minWidth: 30 };
  const lblS = { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--nv-text-dim)", fontFamily: FF };
  const swatch = { width: 28, height: 28, borderRadius: 6, border: "1px solid var(--nv-border)", background: "none", cursor: "pointer", padding: 0 };
  const dlBtn = (disabled) => ({ padding: "8px 16px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, cursor: disabled ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, opacity: disabled ? 0.5 : 1 });
  const matSel = { padding: "5px 7px", borderRadius: 7, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 11.5, cursor: "pointer" };
  const cropArea = cropRect && (cropRect.x1 - cropRect.x0) > 0.01 && (cropRect.y1 - cropRect.y0) > 0.01;

  return (
    <div ref={rootRef}
      onDragOver={e=>{ if([...(e.dataTransfer?.items||[])].some(it=>it.kind==="file")){ e.preventDefault(); if(!dragActive) setDragActive(true); } }}
      onDragLeave={e=>{ if(e.target===e.currentTarget) setDragActive(false); }}
      onDrop={onDropFiles}
      style={{ position:"relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: "var(--nv-surface-solid)" }}>
      {dragActive && (
        <div style={{position:"absolute",inset:8,zIndex:60,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",background:fill(AC),border:"2.5px dashed "+AC,borderRadius:14}}>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:18,color:AC,background:"var(--nv-surface-solid)",padding:"10px 20px",borderRadius:10,boxShadow:"var(--nv-popover-shadow)"}}>Drop image to add</div>
        </div>
      )}
      {/* Toolbar — or the Snip bar while cropping */}
      {cropMode ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--nv-border)" }}>
          <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)" }}>✂ Snip</span>
          <span style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>{cropArea ? Math.round((cropRect.x1 - cropRect.x0) * preset.w) + " × " + Math.round((cropRect.y1 - cropRect.y0) * preset.h) + " px" : "Drag on the canvas to select an area to export"}</span>
          <div style={{ flex: 1 }} />
          <button onClick={downloadRegion} disabled={busy || !cropArea} style={dlBtn(busy || !cropArea)}>⬇ Download selection</button>
          <button style={tbtn(false)} onClick={() => { setCropMode(false); setCropRect(null); }}>Exit</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--nv-border)" }}>
          <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", marginRight: 2 }}>🪄 Asset Studio</span>
          <button style={tbtn(false)} onClick={() => fileRef.current?.click()}>＋ Image</button>
          <button style={tbtn(false)} onClick={addText}>T Text</button>
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
          <button style={tbtn(false)} onClick={() => { setCropMode(true); setCropRect(null); setSelIds([]); }}>✂ Snip</button>
          <button onClick={copyImage} disabled={busy} style={tbtn(false)} title="Copy the whole image to the clipboard">⧉ Copy</button>
          <button onClick={download} disabled={busy} style={dlBtn(busy)}>⬇ Download PNG</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16, background: "#0a0c14" }} onPointerDown={e => { setShapeMenu(false); if (e.target === e.currentTarget && !cropMode) setSelIds([]); }}>
        <div ref={canvasRef} onPointerDown={cropMode ? startCrop : startMarquee}
          style={{ position: "relative", aspectRatio: preset.w + " / " + preset.h, width: "min(100%, " + (ar * 64).toFixed(0) + "vh)", maxWidth: "100%", background: transparent ? CHECKER : bgColor, borderRadius: 4, boxShadow: "0 16px 50px rgba(0,0,0,0.55)", overflow: "hidden", flexShrink: 0, touchAction: "none" }}>
          {layers.map(layerEl)}
          {!cropMode && guides.x.map((g, i) => <div key={"gx" + i} style={{ position: "absolute", left: g * 100 + "%", top: 0, bottom: 0, width: 1, background: GUIDE, pointerEvents: "none", zIndex: 99 }} />)}
          {!cropMode && guides.y.map((g, i) => <div key={"gy" + i} style={{ position: "absolute", top: g * 100 + "%", left: 0, right: 0, height: 1, background: GUIDE, pointerEvents: "none", zIndex: 99 }} />)}
          {!cropMode && marquee && <div style={{ position: "absolute", left: marquee.x0 * 100 + "%", top: marquee.y0 * 100 + "%", width: (marquee.x1 - marquee.x0) * 100 + "%", height: (marquee.y1 - marquee.y0) * 100 + "%", border: "1px solid " + AC, background: fill(AC), pointerEvents: "none", zIndex: 98 }} />}
          {cropMode && (cropArea
            ? <div style={{ position: "absolute", left: cropRect.x0 * 100 + "%", top: cropRect.y0 * 100 + "%", width: (cropRect.x1 - cropRect.x0) * 100 + "%", height: (cropRect.y1 - cropRect.y0) * 100 + "%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", border: "1.5px solid #fff", pointerEvents: "none", zIndex: 97 }} />
            : <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", pointerEvents: "none", zIndex: 97, display: "flex", alignItems: "center", justifyContent: "center", color:"var(--nv-text-strong)", fontFamily: FFB, fontSize: 13 }}>Drag to select an area</div>)}
        </div>
      </div>

      {/* Properties (hidden while snipping) */}
      {cropMode ? null : selLayers.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: "1px solid var(--nv-border)", background:"var(--nv-elevated)" }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)", textTransform: "capitalize" }}>{single ? single.type : selLayers.length + " selected"}</span>

          {allShapes && !anyText && selLayers.every(l => l.type !== "line" && l.type !== "curve") && (
            <span style={lblS}>Fill <input type="color" value={ref0.fill || "#000000"} onChange={e => patchSel({ fill: e.target.value })} style={swatch} /><button onClick={() => patchSel({ fill: null })} title="No fill" style={{ ...ibtn, fontSize: 11, padding: "4px 7px" }}>none</button></span>
          )}
          {allShapes && !anyText && (
            <span style={lblS}>{everyLineLike ? "Color" : "Stroke"} <input type="color" value={ref0.stroke || "#ffffff"} onChange={e => patchSel({ stroke: e.target.value })} style={swatch} /></span>
          )}
          {allShapes && !anyText && (
            <span style={lblS}>{everyLineLike ? "Thickness" : "Border"} <input type="range" min="0" max="40" value={ref0.strokeW || 0} onChange={e => patchSel({ strokeW: +e.target.value })} style={{ width: 72 }} /></span>
          )}
          {curveRef && (
            <span style={lblS}>Curve <input type="range" min="-100" max="100" value={Math.round((curveRef.curve ?? 0.6) * 100)} onChange={e => patchSel({ curve: +e.target.value / 100 })} style={{ width: 72 }} /></span>
          )}

          {anyText && (
            <>
              {isText && <input value={single.text} onChange={e => patch(single.id, { text: e.target.value })} placeholder="Type here…" style={{ padding: "6px 9px", borderRadius: 7, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 12.5, minWidth: 120, maxWidth: 220 }} />}
              <span style={lblS}>Font
                <select value={textRef?.font || "sans"} onChange={e => patchText({ font: e.target.value })} style={matSel}>
                  {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </span>
              <span style={lblS}>Color <input type="color" value={textRef?.fill || "#ffffff"} onChange={e => patchText({ fill: e.target.value })} style={swatch} /></span>
              <span style={{ display: "flex", gap: 4 }}>
                <button style={{ ...ibtn, ...(textRef?.align === "left" ? { borderColor: bdr(AC), color: AC } : {}) }} title="Align left" onClick={() => patchText({ align: "left" })}>⇤</button>
                <button style={{ ...ibtn, ...((textRef?.align || "center") === "center" ? { borderColor: bdr(AC), color: AC } : {}) }} title="Align center" onClick={() => patchText({ align: "center" })}>≡</button>
                <button style={{ ...ibtn, ...(textRef?.align === "right" ? { borderColor: bdr(AC), color: AC } : {}) }} title="Align right" onClick={() => patchText({ align: "right" })}>⇥</button>
                <button style={{ ...ibtn, ...((textRef?.weight || 700) >= 700 ? { borderColor: bdr(AC), color: AC } : {}) }} title="Bold" onClick={() => patchText({ weight: (textRef?.weight || 700) >= 700 ? 400 : 800 })}><b>B</b></button>
              </span>
            </>
          )}

          {imgSel.length > 0 && (
            <span style={lblS} title="Recolor the image — full strength replaces its color, lower keeps the shading">Recolor
              <input type="color" value={imgRef.tint || "#ffffff"} onChange={e => recolorSelected(e.target.value, imgRef.tintAmt ?? 1)} style={swatch} />
              {imgRef.tint && <input type="range" min="15" max="100" value={Math.round((imgRef.tintAmt ?? 1) * 100)} onChange={e => recolorSelected(imgRef.tint, +e.target.value / 100)} style={{ width: 64 }} title="Strength" />}
              {imgRef.tint && <button onClick={() => recolorSelected(null)} title="Remove recolor" style={{ ...ibtn, fontSize: 11, padding: "4px 7px" }}>reset</button>}
            </span>
          )}

          <span style={lblS}>Opacity <input type="range" min="10" max="100" value={ref0.opacity ?? 100} onChange={e => patchSel({ opacity: +e.target.value })} style={{ width: 72 }} /></span>
          <span style={lblS}>Rotate <input type="range" min="0" max="360" value={ref0.rotation || 0} onChange={e => patchSel({ rotation: +e.target.value })} style={{ width: 72 }} /></span>
          <span style={lblS} title="Material — shadow, gloss, metallic, glass or neon">Material
            <select value={ref0.material || "flat"} onChange={e => patchSel({ material: e.target.value })} style={matSel}>
              {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </span>

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
          <button style={{ ...ibtn, color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }} onClick={del} title="Delete (or press Backspace)">🗑</button>
        </div>
      ) : (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--nv-border)", fontSize: 11.5, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center" }}>
          Drag to arrange (pink guides snap to centres &amp; edges); corner/edge handles or pinch to resize. Box-select or Shift-click for many; Backspace deletes. ✂ Snip exports just a region.
        </div>
      )}
    </div>
  );
}

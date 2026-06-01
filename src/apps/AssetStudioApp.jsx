// Asset Studio — a focused, Canva-style editor for game/UI assets, built for
// Roblox decals: transparent backgrounds by default, preset decal sizes, image
// layers + colorable shapes (rect / ellipse / line), and a one-click transparent
// PNG download. Reuses the layered-compositor approach from the Photos editor
// (normalized 0–1 coordinates so layers scale with the preview and export
// cleanly at the chosen pixel size) and adds vector shapes.

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

const CHECKER = "repeating-conic-gradient(#3a3f4b 0% 25%, #2a2e38 0% 50%) 50% / 22px 22px";
let _seq = 1;
const nid = () => "as-" + (_seq++) + "-" + Math.random().toString(36).slice(2, 6);
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export function AssetStudioApp({ AC, showToast }) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState("#1b2030");
  const [layers, setLayers] = useState([]);
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const sel = layers.find(l => l.id === selId) || null;
  const ar = preset.w / preset.h;

  const patch = (id, p) => setLayers(ls => ls.map(l => l.id === id ? { ...l, ...p } : l));

  function addShape(type) {
    const w = 0.34, h = 0.34;
    const layer = { id: nid(), type, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h, rotation: 0, opacity: 100,
      fill: type === "line" ? null : AC, stroke: "#ffffff", strokeW: type === "line" ? 6 : 0 };
    setLayers(ls => [...ls, layer]); setSelId(layer.id);
  }
  function addImageFromSrc(src) {
    loadImage(src).then(img => {
      const iar = img.width / img.height;
      const w = 0.5, h = w * ar / iar;
      const layer = { id: nid(), type: "image", src, x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, opacity: 100 };
      setLayers(ls => [...ls, layer]); setSelId(layer.id);
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

  function startMove(e, layer) {
    e.preventDefault(); e.stopPropagation(); setSelId(layer.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const s = { x: e.clientX, y: e.clientY, lx: layer.x, ly: layer.y };
    const mv = ev => {
      const nx = Math.min(Math.max(-layer.w + 0.05, s.lx + (ev.clientX - s.x) / rect.width), 0.95);
      const ny = Math.min(Math.max(-layer.h + 0.05, s.ly + (ev.clientY - s.y) / rect.height), 0.95);
      patch(layer.id, { x: nx, y: ny });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }
  function startResize(e, layer) {
    e.preventDefault(); e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const s = { x: e.clientX, y: e.clientY, lw: layer.w, lh: layer.h };
    const mv = ev => {
      patch(layer.id, {
        w: Math.min(Math.max(0.04, s.lw + (ev.clientX - s.x) / rect.width), 2),
        h: Math.min(Math.max(0.04, s.lh + (ev.clientY - s.y) / rect.height), 2),
      });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  function zorder(dir) {
    setLayers(ls => {
      const i = ls.findIndex(l => l.id === selId); if (i < 0) return ls;
      const j = i + dir; if (j < 0 || j >= ls.length) return ls;
      const copy = [...ls]; const [it] = copy.splice(i, 1); copy.splice(j, 0, it); return copy;
    });
  }
  function dup() { if (!sel) return; const c = { ...sel, id: nid(), x: Math.min(sel.x + 0.04, 0.9), y: Math.min(sel.y + 0.04, 0.9) }; setLayers(ls => [...ls, c]); setSelId(c.id); }
  function del() { if (!selId) return; setLayers(ls => ls.filter(l => l.id !== selId)); setSelId(null); }

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
        ctx.translate(cx, cy); ctx.rotate((l.rotation || 0) * Math.PI / 180);
        if (l.type === "image") { const img = await loadImage(l.src).catch(() => null); if (img) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh); }
        else if (l.type === "rect") { if (l.fill) { ctx.fillStyle = l.fill; ctx.fillRect(-dw / 2, -dh / 2, dw, dh); } if (l.strokeW > 0) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeW; ctx.strokeRect(-dw / 2, -dh / 2, dw, dh); } }
        else if (l.type === "ellipse") { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(dw / 2), Math.abs(dh / 2), 0, 0, Math.PI * 2); if (l.fill) { ctx.fillStyle = l.fill; ctx.fill(); } if (l.strokeW > 0) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeW; ctx.stroke(); } }
        else if (l.type === "line") { ctx.strokeStyle = l.stroke || "#fff"; ctx.lineWidth = Math.max(1, l.strokeW || 4); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-dw / 2, 0); ctx.lineTo(dw / 2, 0); ctx.stroke(); }
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

  function layerEl(l) {
    const isSel = l.id === selId;
    const box = { position: "absolute", left: l.x * 100 + "%", top: l.y * 100 + "%", width: l.w * 100 + "%", height: l.h * 100 + "%", transform: "rotate(" + (l.rotation || 0) + "deg)", opacity: (l.opacity ?? 100) / 100, cursor: "move", outline: isSel ? "2px solid " + AC : "none" };
    let inner = null;
    if (l.type === "image") inner = <img src={l.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", display: "block" }} />;
    else if (l.type === "rect") inner = <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: l.strokeW > 0 ? l.strokeW + "px solid " + l.stroke : "none", boxSizing: "border-box" }} />;
    else if (l.type === "ellipse") inner = <div style={{ width: "100%", height: "100%", background: l.fill || "transparent", border: l.strokeW > 0 ? l.strokeW + "px solid " + l.stroke : "none", borderRadius: "50%", boxSizing: "border-box" }} />;
    else if (l.type === "line") inner = <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: Math.max(2, l.strokeW || 4), background: l.stroke || "#fff", transform: "translateY(-50%)", borderRadius: 999 }} />;
    return (
      <div key={l.id} onPointerDown={e => startMove(e, l)} style={box}>
        {inner}
        {isSel && <div onPointerDown={e => startResize(e, l)} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: AC, border: "2px solid #fff", borderRadius: 3, cursor: "se-resize" }} />}
      </div>
    );
  }

  const tbtn = (active) => ({ padding: "7px 11px", borderRadius: 8, border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.14)"), background: active ? fill(AC) : "rgba(255,255,255,0.06)", color: active ? AC : "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" });
  const lbl = { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--nv-text-dim)", fontFamily: FF };
  const swatch = { width: 28, height: 28, borderRadius: 6, border: "1px solid var(--nv-border)", background: "none", cursor: "pointer", padding: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: "var(--nv-surface-solid)" }}>
      {/* Toolbar (wraps on narrow / mobile) */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--nv-border)" }}>
        <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", marginRight: 2 }}>🪄 Asset Studio</span>
        <button style={tbtn(false)} onClick={() => fileRef.current?.click()}>＋ Image</button>
        <button style={tbtn(false)} onClick={() => addShape("rect")}>▭ Rect</button>
        <button style={tbtn(false)} onClick={() => addShape("ellipse")}>◯ Ellipse</button>
        <button style={tbtn(false)} onClick={() => addShape("line")}>╱ Line</button>
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
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16, background: "#0a0c14" }}>
        <div ref={canvasRef}
          onPointerDown={e => { if (e.target === e.currentTarget) setSelId(null); e.stopPropagation(); }}
          style={{ position: "relative", aspectRatio: preset.w + " / " + preset.h, width: "min(100%, " + (ar * 64).toFixed(0) + "vh)", maxWidth: "100%", background: transparent ? CHECKER : bgColor, borderRadius: 4, boxShadow: "0 16px 50px rgba(0,0,0,0.55)", overflow: "hidden", flexShrink: 0 }}>
          {layers.map(layerEl)}
        </div>
      </div>

      {/* Properties (selected layer) */}
      {sel && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: "1px solid var(--nv-border)", background: "rgba(255,255,255,0.02)" }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)", textTransform: "capitalize" }}>{sel.type}</span>
          {sel.type !== "image" && sel.type !== "line" && (
            <span style={lbl}>Fill <input type="color" value={sel.fill || "#000000"} onChange={e => patch(sel.id, { fill: e.target.value })} style={swatch} /><button onClick={() => patch(sel.id, { fill: null })} title="No fill" style={{ ...tbtn(false), padding: "4px 7px", fontSize: 11 }}>none</button></span>
          )}
          {sel.type !== "image" && (
            <span style={lbl}>{sel.type === "line" ? "Color" : "Stroke"} <input type="color" value={sel.stroke || "#ffffff"} onChange={e => patch(sel.id, { stroke: e.target.value })} style={swatch} /></span>
          )}
          {sel.type !== "image" && (
            <span style={lbl}>{sel.type === "line" ? "Thickness" : "Border"} <input type="range" min="0" max="40" value={sel.strokeW || 0} onChange={e => patch(sel.id, { strokeW: +e.target.value })} style={{ width: 76 }} /></span>
          )}
          <span style={lbl}>Opacity <input type="range" min="10" max="100" value={sel.opacity ?? 100} onChange={e => patch(sel.id, { opacity: +e.target.value })} style={{ width: 76 }} /></span>
          <span style={lbl}>Rotate <input type="range" min="0" max="360" value={sel.rotation || 0} onChange={e => patch(sel.id, { rotation: +e.target.value })} style={{ width: 76 }} /></span>
          <div style={{ flex: 1 }} />
          <button style={{ ...tbtn(false), padding: "6px 9px" }} onClick={() => zorder(1)} title="Bring forward">⬆</button>
          <button style={{ ...tbtn(false), padding: "6px 9px" }} onClick={() => zorder(-1)} title="Send back">⬇</button>
          <button style={{ ...tbtn(false), padding: "6px 9px" }} onClick={dup} title="Duplicate">⧉</button>
          <button style={{ ...tbtn(false), padding: "6px 9px", color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }} onClick={del} title="Delete">🗑</button>
        </div>
      )}
      {!sel && (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--nv-border)", fontSize: 11.5, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center" }}>
          Add an image or a shape, drag to arrange (corner handle resizes), then ⬇ Download a transparent PNG. Tip: paste an image with Ctrl/⌘+V.
        </div>
      )}
    </div>
  );
}

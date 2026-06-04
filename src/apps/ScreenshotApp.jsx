import { useState, useRef, useEffect } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";
import { addStorePhoto } from "../lib/photoStore.js";

// v8.6 — Screenshot tool with annotation.
//
// Capture: browsers only expose screen capture via getDisplayMedia (the user
// picks a screen/window/tab in the native prompt). We grab a single frame off
// the resulting stream, stop it, and load it into an annotation canvas. Region
// / per-window cropping beyond what the picker offers isn't possible in a pure
// web build, so capture scope = whatever the user shares.
//
// Annotate: a destructive canvas with a snapshot-based undo stack (same model
// as PaintApp). Tools: pen, rectangle, arrow, text, and a rectangular blur
// (useful for hiding sensitive info). Export: download PNG, set as wallpaper,
// or save into the Photos gallery (via the shared photoStore).

const TOOLS = [
  { id: "pen",   label: "✏️ Pen" },
  { id: "rect",  label: "▭ Box" },
  { id: "arrow", label: "➔ Arrow" },
  { id: "text",  label: "T Text" },
  { id: "blur",  label: "◼ Blur" },
];
const CAP_MAX = 2200; // cap captured width for memory/undo sanity

import { novaPrompt } from "../ui/dialogs.jsx";

export function ScreenshotApp({ AC, showToast, onSetWallpaper }) {
  const [shot, setShot] = useState(null);     // captured image dataURL
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#ff3b3b");
  const [lineWidth, setLineWidth] = useState(5);
  const [capturing, setCapturing] = useState(false);
  const supported = typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;

  const canvasRef = useRef(null);
  const undoRef = useRef([]);
  const dragRef = useRef(null);
  // v8.7 region snip — `rawShot` is a captured full frame awaiting a crop; the
  // crop view lets the user drag a rectangle, then we crop into `shot`.
  const [rawShot, setRawShot] = useState(null);
  const [sel, setSel] = useState(null); // {x0,y0,x1,y1} in displayed px
  const cropImgRef = useRef(null);
  const cropDragRef = useRef(false);

  // v9.7 B1 — Esc cancels the snip overlay.
  useEffect(() => {
    if (shot || !rawShot) return;
    function onKey(e) { if (e.key === "Escape") { setSel(null); setRawShot(null); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shot, rawShot]);

  // Load the captured image onto the canvas whenever a new shot arrives.
  useEffect(() => {
    if (!shot) return;
    const cv = canvasRef.current; if (!cv) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, CAP_MAX / img.width);
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      undoRef.current = [];
    };
    img.src = shot;
  }, [shot]);

  async function capture(region) {
    if (!supported) { showToast?.("Screen capture isn't supported here"); return; }
    setCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise(r => setTimeout(r, 180)); // let dimensions settle
      const w = video.videoWidth || 1280, h = video.videoHeight || 720;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(video, 0, 0, w, h);
      stream.getTracks().forEach(t => t.stop());
      const url = c.toDataURL("image/png");
      if (region) setRawShot(url); else setShot(url);
      playSound?.("success");
    } catch (e) {
      if (e && e.name !== "NotAllowedError") showToast?.("Capture failed");
    }
    setCapturing(false);
  }

  // ── region snip: crop the captured frame to a dragged rectangle ──────────
  function cropDown(e) {
    e.preventDefault();
    const r = cropImgRef.current.getBoundingClientRect();
    cropDragRef.current = true;
    setSel({ x0: e.clientX - r.left, y0: e.clientY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }
  function cropMove(e) {
    if (!cropDragRef.current) return;
    const r = cropImgRef.current.getBoundingClientRect();
    setSel(s => s ? { ...s, x1: e.clientX - r.left, y1: e.clientY - r.top } : s);
  }
  function cropUp(e) {
    if (!cropDragRef.current) return;
    cropDragRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const s = sel; if (!s) return;
    if (Math.abs(s.x1 - s.x0) < 8 || Math.abs(s.y1 - s.y0) < 8) { setSel(null); return; }
    const img = cropImgRef.current; const r = img.getBoundingClientRect();
    const fx = img.naturalWidth / r.width, fy = img.naturalHeight / r.height;
    const x = Math.min(s.x0, s.x1), y = Math.min(s.y0, s.y1), w = Math.abs(s.x1 - s.x0), h = Math.abs(s.y1 - s.y0);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * fx)); c.height = Math.max(1, Math.round(h * fy));
    c.getContext("2d").drawImage(img, x * fx, y * fy, w * fx, h * fy, 0, 0, c.width, c.height);
    setSel(null); setRawShot(null); setShot(c.toDataURL("image/png"));
  }

  // ── canvas helpers ───────────────────────────────────────────────────────
  function ctxOf() { return canvasRef.current?.getContext("2d"); }
  function pushUndo() {
    const cv = canvasRef.current, ctx = ctxOf(); if (!cv || !ctx) return;
    undoRef.current.push(ctx.getImageData(0, 0, cv.width, cv.height));
    if (undoRef.current.length > 12) undoRef.current.shift();
  }
  function undo() {
    const ctx = ctxOf(); if (!ctx) return;
    const snap = undoRef.current.pop();
    if (snap) ctx.putImageData(snap, 0, 0);
  }
  function ptr(e) {
    const cv = canvasRef.current; const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
  }
  function drawArrow(ctx, x0, y0, x1, y1) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0); const hl = 8 + lineWidth * 2.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hl * Math.cos(ang - Math.PI / 7), y1 - hl * Math.sin(ang - Math.PI / 7));
    ctx.lineTo(x1 - hl * Math.cos(ang + Math.PI / 7), y1 - hl * Math.sin(ang + Math.PI / 7));
    ctx.closePath(); ctx.fill();
  }

  async function onDown(e) {
    const ctx = ctxOf(); if (!ctx || !shot) return;
    e.preventDefault();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const p = ptr(e);
    if (tool === "text") {
      const text = await novaPrompt({ title: "Add text", message: "Annotation text:", placeholder: "Type your annotation…", accent: AC });
      if (!text) return;
      pushUndo();
      ctx.fillStyle = color; ctx.font = "700 " + Math.max(16, lineWidth * 6) + "px 'Space Grotesk',sans-serif";
      ctx.textBaseline = "top"; ctx.fillText(text, p.x, p.y);
      return;
    }
    pushUndo();
    const base = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    dragRef.current = { x0: p.x, y0: p.y, base, tool };
    if (tool === "pen") { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  }
  function onMove(e) {
    const d = dragRef.current; const ctx = ctxOf(); if (!d || !ctx) return;
    const p = ptr(e);
    if (d.tool === "pen") { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
    ctx.putImageData(d.base, 0, 0); // clear previous preview
    if (d.tool === "rect") { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.strokeRect(d.x0, d.y0, p.x - d.x0, p.y - d.y0); }
    else if (d.tool === "arrow") { drawArrow(ctx, d.x0, d.y0, p.x, p.y); }
    else if (d.tool === "blur") { ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(d.x0, d.y0, p.x - d.x0, p.y - d.y0); ctx.setLineDash([]); }
  }
  function onUp(e) {
    const d = dragRef.current; const ctx = ctxOf(); dragRef.current = null;
    if (!d || !ctx) return;
    try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (d.tool === "blur") {
      const p = ptr(e);
      ctx.putImageData(d.base, 0, 0); // remove the dashed preview
      const rx = Math.min(d.x0, p.x), ry = Math.min(d.y0, p.y), rw = Math.abs(p.x - d.x0), rh = Math.abs(p.y - d.y0);
      if (rw > 4 && rh > 4) {
        const tmp = document.createElement("canvas"); tmp.width = rw; tmp.height = rh;
        const tctx = tmp.getContext("2d");
        tctx.filter = "blur(7px)";
        tctx.drawImage(canvasRef.current, rx, ry, rw, rh, 0, 0, rw, rh);
        ctx.drawImage(tmp, 0, 0, rw, rh, rx, ry, rw, rh);
      }
    }
  }

  // ── exports ────────────────────────────────────────────────────────────
  function downscale(maxW, quality) {
    const cv = canvasRef.current;
    const ratio = Math.min(1, maxW / cv.width);
    const o = document.createElement("canvas");
    o.width = Math.round(cv.width * ratio); o.height = Math.round(cv.height * ratio);
    o.getContext("2d").drawImage(cv, 0, 0, o.width, o.height);
    return o.toDataURL("image/jpeg", quality);
  }
  function download() {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = "nova-screenshot-" + Date.now() + ".png";
    a.click();
    showToast?.("Screenshot downloaded ✓");
  }
  function setWallpaper() {
    if (!onSetWallpaper) return;
    onSetWallpaper(downscale(1280, 0.82));
    showToast?.("Set as wallpaper ✓");
  }
  function saveToPhotos() {
    const cv = canvasRef.current;
    addStorePhoto({ id: "ss-" + Date.now(), name: "Screenshot " + new Date().toLocaleTimeString(), url: cv.toDataURL("image/png"), size: 0, w: cv.width, h: cv.height });
    showToast?.("Saved to Photos ✓");
  }

  const toolBtn = (active) => ({
    padding: "6px 11px", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12,
    background: active ? fill(AC) : "rgba(255,255,255,0.05)", border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.1)"),
    color: active ? AC : "rgba(255,255,255,0.6)",
  });
  const actBtn = { padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--nv-text)" };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 12, fontFamily: FF, minHeight: 0 }}>
      {!shot && !rawShot && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 30, color: "var(--nv-text-dim)" }}>
          <div style={{ fontSize: 60, marginBottom: 16, filter: "drop-shadow(0 0 24px " + fill(AC) + ")" }}>📸</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 17, color: "var(--nv-text)", marginBottom: 8 }}>Screenshot &amp; Annotate</div>
          <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", maxWidth: 340, lineHeight: 1.7, marginBottom: 20 }}>
            Capture your whole screen, or <strong style={{ color: "var(--nv-text)" }}>snip a region</strong>, then draw arrows, boxes, text and blur over it — save it to Photos or set it as your wallpaper.
          </div>
          {supported ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={() => capture(true)} disabled={capturing} style={{ padding: "11px 24px", borderRadius: 10, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 14, background: fill(AC), border: "1px solid " + bdr(AC), color: AC, opacity: capturing ? 0.5 : 1 }}>
                  {capturing ? "Waiting…" : "✂ Snip a region"}
                </button>
                <button onClick={() => capture(false)} disabled={capturing} style={{ padding: "11px 24px", borderRadius: 10, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--nv-text)", opacity: capturing ? 0.5 : 1 }}>
                  📸 Capture full
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", maxWidth: 360, lineHeight: 1.55 }}>
                Your browser will ask which screen/window to share — pick one, then drag a box over the part you want. (Browsers can't read the screen without that one-time prompt.)
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(255,180,80,0.8)", maxWidth: 320, lineHeight: 1.6 }}>Screen capture isn't available in this browser/runtime. Try the web app in Chrome or Edge.</div>
          )}
        </div>
      )}
      {!shot && rawShot && (
        // v9.7 B1 — full-screen Snipping-Tool-style overlay. The captured
        // frame fills the viewport dimmed; drag a crosshair box over the
        // part to keep, with a live W×H badge. Esc / Back cancels.
        <div style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", animation: "ss-fade 0.16s" }}>
          <div style={{ flexShrink: 0, textAlign: "center", padding: "14px 16px 8px", fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff" }}>
            ✂ Drag to select the area to keep
            <span style={{ fontFamily: FF, fontWeight: 400, fontSize: 11, color: "var(--nv-text-dim)", marginLeft: 8 }}>· Esc to cancel</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px 12px" }}>
            <div style={{ position: "relative", lineHeight: 0, touchAction: "none", maxWidth: "100%", maxHeight: "100%" }} onPointerDown={cropDown} onPointerMove={cropMove} onPointerUp={cropUp} onPointerCancel={cropUp}>
              <img ref={cropImgRef} src={rawShot} alt="" draggable={false} style={{ maxWidth: "92vw", maxHeight: "76vh", width: "auto", height: "auto", borderRadius: 4, display: "block", cursor: "crosshair", userSelect: "none", boxShadow: "0 10px 50px rgba(0,0,0,0.6)" }}/>
              {sel && (() => { const x = Math.min(sel.x0, sel.x1), y = Math.min(sel.y0, sel.y1), w = Math.abs(sel.x1 - sel.x0), h = Math.abs(sel.y1 - sel.y0);
                const img = cropImgRef.current; const r = img ? img.getBoundingClientRect() : null;
                const realW = r ? Math.round(w * (img.naturalWidth / r.width)) : Math.round(w);
                const realH = r ? Math.round(h * (img.naturalHeight / r.height)) : Math.round(h);
                return (
                <>
                  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, border: "2px solid " + AC, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", pointerEvents: "none" }}/>
                  {w > 10 && h > 10 && (
                    <div style={{ position: "absolute", left: x, top: Math.max(2, y - 24), background: AC, color: "#04122b", fontFamily: FFM, fontWeight: 700, fontSize: 11, padding: "2px 7px", borderRadius: 5, pointerEvents: "none", whiteSpace: "nowrap" }}>{realW} × {realH}</div>
                  )}
                </>
              ); })()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, padding: "0 16px 16px", justifyContent: "center" }}>
            <button onClick={() => { setSel(null); setRawShot(null); }} style={actBtn}>← Cancel</button>
            <button onClick={() => { setSel(null); setShot(rawShot); setRawShot(null); }} style={actBtn}>Use full image</button>
          </div>
        </div>
      )}
      {shot && (
        <>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", flexShrink: 0 }}>
            {TOOLS.map(t => <button key={t.id} onClick={() => setTool(t.id)} style={toolBtn(tool === t.id)}>{t.label}</button>)}
            <input type="color" value={color} onChange={e => setColor(e.target.value)} title="Color" style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(255,255,255,0.15)", background: "none", cursor: "pointer", padding: 0 }}/>
            <input type="range" min={1} max={24} value={lineWidth} onChange={e => setLineWidth(+e.target.value)} title="Size" style={{ width: 90, accentColor: AC }}/>
            <button onClick={undo} style={actBtn}>↶ Undo</button>
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", background: "rgba(0,0,0,0.3)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: 10 }}>
            <canvas ref={canvasRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ maxWidth: "100%", height: "auto", borderRadius: 6, cursor: "crosshair", touchAction: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}/>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            <button onClick={() => { setShot(null); capture(true); }} style={actBtn}>📸 Recapture</button>
            <div style={{ flex: 1 }}/>
            <button onClick={saveToPhotos} style={actBtn}>🖼 Save to Photos</button>
            {onSetWallpaper && <button onClick={setWallpaper} style={actBtn}>🖥 Set as wallpaper</button>}
            <button onClick={download} style={{ ...actBtn, background: fill(AC), border: "1px solid " + bdr(AC), color: AC }}>⬇ Download PNG</button>
          </div>
        </>
      )}
    </div>
  );
}

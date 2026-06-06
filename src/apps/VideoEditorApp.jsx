// Video Editor (CapCut-style) — v11.0 Phase C, Stage 1: the editing core.
// Import video/image clips, arrange them on a single main track, preview the
// composited frame on a canvas, play back with a moving playhead, and
// trim / split / delete / reorder. Playback is driven by a wall-clock playhead;
// the active clip's <video> element supplies synced audio + frames (re-synced on
// drift), so the preview canvas is the single source of truth for a frame —
// which makes a later MediaRecorder export drop-in. Text overlays, transitions
// and export land in Stage 2.

import { useState, useRef, useEffect } from "react";
import { FF, FFB } from "../ui/styles.js";

const MIN_CLIP = 0.3;            // shortest a clip can be trimmed to (seconds)
const IMG_DUR = 4;               // default on-timeline length for an imported image
const IMG_CAP = 600;            // images have no real duration; cap how long they can stretch
const CW = 960, CH = 540;        // preview render resolution (16:9)

let _seq = 1;
const uid = () => "c" + (_seq++) + Math.random().toString(36).slice(2, 5);
const clipLen = (c) => Math.max(MIN_CLIP, (c.outPt - c.inPt));
// Resolve sequential clip start times + the project total length.
function layoutClips(cs) {
  let t = 0; const items = [];
  for (const c of cs) { const len = clipLen(c); items.push({ ...c, start: t, len }); t += len; }
  return { items, total: t };
}
const fmt = (s) => {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
  return m + ":" + String(sec).padStart(2, "0") + "." + String(cs).padStart(2, "0");
};

export function VideoEditorApp({ AC, showToast }) {
  const [clips, setClips] = useState([]);   // {id, kind:"video"|"image", name, url, sourceDur, inPt, outPt, thumb}
  const [selId, setSelId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pps, setPps] = useState(64);        // timeline zoom — pixels per second
  const [time, setTime] = useState(0);       // playhead readout (throttled during playback)
  const [drop, setDrop] = useState(false);

  const clipsRef = useRef(clips); useEffect(() => { clipsRef.current = clips; }, [clips]);
  const ppsRef = useRef(pps); useEffect(() => { ppsRef.current = pps; }, [pps]);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const playheadRef = useRef(null);
  const fileRef = useRef(null);
  const vids = useRef(new Map());            // url -> HTMLVideoElement
  const imgs = useRef(new Map());            // url -> HTMLImageElement
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const readoutTsRef = useRef(0);
  const tickRef = useRef(null);
  const loopRef = useRef(null);
  if (!loopRef.current) loopRef.current = (ts) => { if (tickRef.current) tickRef.current(ts); };

  // ── frame compositing ────────────────────────────────────────────────────
  function frameAt(t) {
    const { items, total } = layoutClips(clipsRef.current);
    if (!items.length) return null;
    const tt = Math.min(t, total - 0.0001);
    for (const it of items) if (tt >= it.start && tt < it.start + it.len) return { clip: it, srcTime: it.inPt + (tt - it.start) };
    const last = items[items.length - 1];
    return { clip: last, srcTime: last.outPt - 0.0001 };
  }
  function drawFrame(t) {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CW, CH);
    const f = frameAt(t); if (!f) return;
    let el = null, ew = 0, eh = 0;
    if (f.clip.kind === "video") { el = vids.current.get(f.clip.url); if (el) { ew = el.videoWidth; eh = el.videoHeight; } }
    else { el = imgs.current.get(f.clip.url); if (el) { ew = el.naturalWidth; eh = el.naturalHeight; } }
    if (el && ew && eh) {
      const s = Math.min(CW / ew, CH / eh), dw = ew * s, dh = eh * s;
      try { ctx.drawImage(el, (CW - dw) / 2, (CH - dh) / 2, dw, dh); } catch { /* frame not ready */ }
    }
  }
  // Keep the active clip's <video> playing & in sync; pause everything else.
  function syncMedia(t, isPlaying) {
    const f = frameAt(t);
    const activeUrl = f && f.clip.kind === "video" ? f.clip.url : null;
    vids.current.forEach((v, url) => { if (url !== activeUrl && !v.paused) v.pause(); });
    if (activeUrl) {
      const v = vids.current.get(activeUrl);
      if (v) {
        if (Math.abs(v.currentTime - f.srcTime) > 0.25) { try { v.currentTime = f.srcTime; } catch { /* */ } if (!isPlaying) v.addEventListener("seeked", () => drawFrame(timeRef.current), { once: true }); }
        if (isPlaying && v.paused) v.play().catch(() => {});
        if (!isPlaying && !v.paused) v.pause();
      }
    }
  }
  function setHead(t) { if (playheadRef.current) playheadRef.current.style.left = (t * ppsRef.current) + "px"; }

  tickRef.current = (ts) => {
    if (!playingRef.current) return;
    const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
    lastTsRef.current = ts;
    let t = timeRef.current + dt;
    const { total } = layoutClips(clipsRef.current);
    if (t >= total) { timeRef.current = total; syncMedia(total, false); drawFrame(total); setHead(total); stopPlay(total); return; }
    timeRef.current = t;
    syncMedia(t, true);
    drawFrame(t);
    setHead(t);
    if (ts - readoutTsRef.current > 100) { readoutTsRef.current = ts; setTime(t); }
    rafRef.current = requestAnimationFrame(loopRef.current);
  };

  function stopPlay(t) { playingRef.current = false; setPlaying(false); cancelAnimationFrame(rafRef.current); vids.current.forEach(v => { if (!v.paused) v.pause(); }); setTime(t != null ? t : timeRef.current); }
  function play() {
    const { total } = layoutClips(clipsRef.current);
    if (!total) return;
    if (timeRef.current >= total - 0.02) { timeRef.current = 0; setHead(0); }
    playingRef.current = true; setPlaying(true); lastTsRef.current = 0; readoutTsRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }
  function togglePlay() { if (playingRef.current) stopPlay(); else play(); }
  function seek(t) {
    const { total } = layoutClips(clipsRef.current);
    t = Math.max(0, Math.min(t, total));
    timeRef.current = t; setHead(t); setTime(t);
    syncMedia(t, playingRef.current); drawFrame(t);
  }

  // ── import (file picker + drag-drop) ──────────────────────────────────────
  function addFiles(list) {
    const files = [...(list || [])];
    let added = 0;
    for (const file of files) {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith("video/")) {
        added++;
        const v = document.createElement("video");
        v.preload = "auto"; v.playsInline = true; v.src = url;
        v.addEventListener("loadeddata", () => {
          vids.current.set(url, v);
          const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
          // grab a thumbnail from the first moment
          const tc = document.createElement("canvas"); tc.width = 160; tc.height = 90;
          const tx = tc.getContext("2d");
          const grab = () => { try { const s = Math.min(160 / v.videoWidth, 90 / v.videoHeight), dw = v.videoWidth * s, dh = v.videoHeight * s; tx.fillStyle = "#000"; tx.fillRect(0, 0, 160, 90); tx.drawImage(v, (160 - dw) / 2, (90 - dh) / 2, dw, dh); } catch { /* */ } finishVid(tc.toDataURL("image/jpeg", 0.6)); };
          const finishVid = (thumb) => { v.currentTime = 0; setClips(cs => [...cs, { id: uid(), kind: "video", name: file.name, url, sourceDur: dur, inPt: 0, outPt: dur, thumb }]); };
          v.addEventListener("seeked", grab, { once: true });
          try { v.currentTime = Math.min(0.1, dur); } catch { finishVid(""); }
        }, { once: true });
        v.addEventListener("error", () => { showToast?.("Couldn't load " + file.name); }, { once: true });
        v.load();
      } else if (file.type.startsWith("image/")) {
        added++;
        const img = new Image();
        img.onload = () => { imgs.current.set(url, img); setClips(cs => [...cs, { id: uid(), kind: "image", name: file.name, url, sourceDur: IMG_CAP, inPt: 0, outPt: IMG_DUR, thumb: url }]); };
        img.onerror = () => showToast?.("Couldn't load " + file.name);
        img.src = url;
      } else URL.revokeObjectURL(url);
    }
    if (added) showToast?.(added > 1 ? added + " clips imported" : "Clip imported");
  }
  function onFiles(e) { addFiles(e.target.files); e.target.value = ""; }

  // ── clip edits ────────────────────────────────────────────────────────────
  function split() {
    const t = timeRef.current; const { items } = layoutClips(clipsRef.current);
    const it = items.find(x => t >= x.start && t < x.start + x.len);
    if (!it) { showToast?.("Move the playhead onto a clip to split"); return; }
    const srcT = it.inPt + (t - it.start);
    if (srcT <= it.inPt + 0.05 || srcT >= it.outPt - 0.05) { showToast?.("Move the playhead inside a clip to split"); return; }
    setClips(cs => { const idx = cs.findIndex(c => c.id === it.id); if (idx < 0) return cs; const c = cs[idx]; const next = [...cs]; next.splice(idx, 1, { ...c, outPt: srcT }, { ...c, id: uid(), inPt: srcT }); return next; });
    showToast?.("Clip split");
  }
  function delClip(id) {
    setClips(cs => {
      const gone = cs.find(c => c.id === id); const next = cs.filter(c => c.id !== id);
      if (gone && !next.some(c => c.url === gone.url)) { URL.revokeObjectURL(gone.url); vids.current.delete(gone.url); imgs.current.delete(gone.url); }
      return next;
    });
    if (selId === id) setSelId(null);
    setTimeout(() => drawFrame(timeRef.current), 0);
  }
  function moveClip(id, dir) {
    setClips(cs => { const i = cs.findIndex(c => c.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= cs.length) return cs; const next = [...cs];[next[i], next[j]] = [next[j], next[i]]; return next; });
    setTimeout(() => drawFrame(timeRef.current), 0);
  }
  function startTrim(e, id, edge) {
    e.stopPropagation(); e.preventDefault();
    const c0 = clipsRef.current.find(c => c.id === id); if (!c0) return;
    const startX = e.clientX, in0 = c0.inPt, out0 = c0.outPt;
    const move = (ev) => {
      const d = (ev.clientX - startX) / ppsRef.current;
      setClips(cs => cs.map(c => {
        if (c.id !== id) return c;
        if (edge === "right") return { ...c, outPt: Math.min(c.sourceDur, Math.max(in0 + MIN_CLIP, out0 + d)) };
        return { ...c, inPt: Math.max(0, Math.min(out0 - MIN_CLIP, in0 + d)) };
      }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); drawFrame(timeRef.current); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // redraw on edits / mount; tidy up on unmount
  useEffect(() => { drawFrame(timeRef.current); /* eslint-disable-next-line */ }, [clips, pps]);
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    vids.current.forEach((v, url) => { try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* */ } URL.revokeObjectURL(url); });
    imgs.current.forEach((_, url) => URL.revokeObjectURL(url));
  }, []);

  const { items, total } = layoutClips(clips);
  const sel = clips.find(c => c.id === selId);

  // ── styles ──
  const tBtn = (active) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid " + (active ? AC : "rgba(255,255,255,0.14)"), background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.05)", color: active ? AC : "#dfe3ee", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" });
  const iBtn = { width: 34, height: 30, borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#dfe3ee", cursor: "pointer", fontSize: 13, lineHeight: 1 };
  const secInterval = pps >= 80 ? 1 : pps >= 40 ? 2 : 5;
  const ticks = []; for (let s = 0; s <= Math.ceil(total) + secInterval; s += secInterval) ticks.push(s);

  return (
    <div ref={rootRef}
      onDragOver={e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === "file")) { e.preventDefault(); if (!drop) setDrop(true); } }}
      onDragLeave={e => { if (e.target === e.currentTarget) setDrop(false); }}
      onDrop={e => { e.preventDefault(); setDrop(false); addFiles(e.dataTransfer?.files); }}
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: "#0e0f15", color: "#e8eaf0", position: "relative" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, marginRight: 2 }}>🎬 Video Editor</span>
        <button style={tBtn(false)} onClick={() => fileRef.current?.click()}>＋ Import</button>
        <input ref={fileRef} type="file" accept="video/*,image/*" multiple style={{ display: "none" }} onChange={onFiles} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "#8b93a7" }}>Zoom</span>
        <button style={iBtn} title="Zoom out" onClick={() => setPps(p => Math.max(20, Math.round(p / 1.3)))}>−</button>
        <button style={iBtn} title="Zoom in" onClick={() => setPps(p => Math.min(220, Math.round(p * 1.3)))}>+</button>
        <button style={{ ...tBtn(false), opacity: 0.5, cursor: "default" }} title="Export arrives in the next stage">⬇ Export (soon)</button>
      </div>

      {/* Preview stage */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#06070b", padding: 16, position: "relative" }}>
        {clips.length === 0 && (
          <div style={{ textAlign: "center", color: "#727a8e", maxWidth: 360 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "#c8cde0" }}>Import to start editing</div>
            <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>Click <strong>＋ Import</strong> or drop video / image files here. Then trim, split and arrange them on the timeline below.</div>
          </div>
        )}
        <canvas ref={canvasRef} width={CW} height={CH} style={{ display: clips.length ? "block" : "none", maxWidth: "100%", maxHeight: "100%", aspectRatio: "16 / 9", borderRadius: 8, background: "#000", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }} />
        {drop && <div style={{ position: "absolute", inset: 12, border: "2.5px dashed " + AC, borderRadius: 14, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 700, fontSize: 17, color: AC, pointerEvents: "none" }}>Drop clips to import</div>}
      </div>

      {/* Transport */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "#0b0c12", flexShrink: 0 }}>
        <button style={iBtn} title="Back to start" onClick={() => seek(0)}>⏮</button>
        <button onClick={togglePlay} disabled={!clips.length} title={playing ? "Pause" : "Play"} style={{ width: 38, height: 32, borderRadius: 8, border: "1px solid " + AC, background: "rgba(255,255,255,0.06)", color: AC, cursor: clips.length ? "pointer" : "default", fontSize: 14, opacity: clips.length ? 1 : 0.5 }}>{playing ? "⏸" : "▶"}</button>
        <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5, color: "#aeb6ca", minWidth: 130 }}>{fmt(time)} / {fmt(total)}</span>
        <div style={{ flex: 1 }} />
        {sel ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "#8b93a7", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.name}</span>
            <button style={tBtn(false)} onClick={split}>✂ Split</button>
            <button style={iBtn} title="Move earlier" onClick={() => moveClip(sel.id, -1)}>◀</button>
            <button style={iBtn} title="Move later" onClick={() => moveClip(sel.id, 1)}>▶</button>
            <button style={{ ...iBtn, color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }} title="Delete clip" onClick={() => delClip(sel.id)}>🗑</button>
          </span>
        ) : <span style={{ fontSize: 11.5, color: "#6b7286" }}>Select a clip to edit it · drag clip edges to trim</span>}
      </div>

      {/* Timeline */}
      <div style={{ height: 132, background: "#0a0b11", borderTop: "1px solid rgba(255,255,255,0.08)", overflowX: "auto", overflowY: "hidden", flexShrink: 0 }}>
        <div style={{ position: "relative", height: "100%", width: Math.max(total * pps + 48, 100) + "px", minWidth: "100%" }}>
          {/* ruler (click/drag to scrub) */}
          <div onPointerDown={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const go = (cx) => seek((cx - r.left) / pps);
            go(e.clientX);
            const mv = (ev) => go(ev.clientX);
            const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
          }} style={{ position: "relative", height: 24, borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: "text", userSelect: "none" }}>
            {ticks.map(s => (
              <div key={s} style={{ position: "absolute", left: s * pps, top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: 4, fontSize: 10, color: "#6b7286", lineHeight: "24px" }}>{s}s</div>
            ))}
          </div>

          {/* main video track */}
          <div onPointerDown={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / pps); } }}
            style={{ position: "relative", height: 80, marginTop: 8, padding: "0 0 0 0" }}>
            {items.map(it => {
              const w = it.len * pps, on = it.id === selId;
              return (
                <div key={it.id} onPointerDown={e => { e.stopPropagation(); setSelId(it.id); }}
                  style={{ position: "absolute", left: it.start * pps, top: 0, width: Math.max(2, w), height: 76, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "2px solid " + (on ? AC : "rgba(255,255,255,0.12)"), background: "#1a1d28", boxShadow: on ? "0 0 0 2px rgba(255,255,255,0.06)" : "none", boxSizing: "border-box" }}>
                  {it.thumb && <img src={it.thumb} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55, pointerEvents: "none" }} />}
                  <div style={{ position: "absolute", left: 6, bottom: 4, right: 6, fontSize: 10.5, fontFamily: FFB, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>{it.kind === "image" ? "🖼 " : "🎞 "}{it.name}</div>
                  <div style={{ position: "absolute", left: 4, top: 4, fontSize: 9.5, color: "#cfd5e6", background: "rgba(0,0,0,0.45)", borderRadius: 4, padding: "1px 4px", pointerEvents: "none" }}>{it.len.toFixed(1)}s</div>
                  {/* trim handles */}
                  <div onPointerDown={e => startTrim(e, it.id, "left")} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize", background: on ? AC : "transparent" }} />
                  <div onPointerDown={e => startTrim(e, it.id, "right")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize", background: on ? AC : "transparent" }} />
                </div>
              );
            })}
          </div>

          {/* playhead */}
          <div ref={playheadRef} style={{ position: "absolute", top: 0, bottom: 0, left: time * pps, width: 2, background: "#ff4d6d", pointerEvents: "none", zIndex: 5 }}>
            <div style={{ position: "absolute", top: -1, left: -5, width: 12, height: 9, background: "#ff4d6d", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

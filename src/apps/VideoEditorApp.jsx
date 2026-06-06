// Video Editor (CapCut-style) — v11.0 Phase C.
// Stage 1: import / preview / playback / trim-split-delete on a single track.
// Stage 2: multi-track timeline (default Media + Sound + Text tracks, add as many
//          layers as you like), text/title overlays composited over the video,
//          audio clips mixed into playback, free clip positioning, Backspace to
//          delete the selected clip.
// Playback is a wall-clock playhead; every active video/audio clip's element is
// kept playing & synced (re-synced on >0.25s drift). The preview canvas is the
// single source of truth for a frame, so a MediaRecorder export (Stage 3) drops in.

import { useState, useRef, useEffect } from "react";
import { FF, FFB } from "../ui/styles.js";

const MIN_CLIP = 0.3;
const IMG_DUR = 4, TEXT_DUR = 3, IMG_CAP = 600;
const CW = 960, CH = 540;
const GUTTER = 78;

const TRACK = {
  media: { label: "Media", color: "#3b82f6", h: 60, icon: "🎞" },
  sound: { label: "Sound", color: "#22c55e", h: 42, icon: "🔊" },
  text:  { label: "Text",  color: "#f59e0b", h: 38, icon: "T" },
};

let _seq = 1;
const uid = () => "c" + (_seq++) + Math.random().toString(36).slice(2, 5);
const spd = (c) => c.speed || 1;
const clipDur = (c) => c.kind === "text" ? Math.max(MIN_CLIP, c.duration) : Math.max(MIN_CLIP, (c.outPt - c.inPt) / spd(c));
const clipEnd = (c) => c.start + clipDur(c);
const clipTrackKind = (c) => c.kind === "audio" ? "sound" : c.kind === "text" ? "text" : "media";
// Fade-in/out opacity (and audio-gain) factor at time t, 0..1.
const fadeAlpha = (c, t) => { const local = t - c.start, dur = clipDur(c); let a = 1; if (c.fadeIn > 0 && local < c.fadeIn) a = Math.min(a, local / c.fadeIn); if (c.fadeOut > 0 && dur - local < c.fadeOut) a = Math.min(a, (dur - local) / c.fadeOut); return Math.max(0, Math.min(1, a)); };
const projectTotal = (cs) => cs.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100); return m + ":" + String(sec).padStart(2, "0") + "." + String(cs).padStart(2, "0"); };
// Snap a time to the nearest reference line within tolerance (else unchanged).
const snapTime = (t, lines, tol) => { let best = t, bd = tol; for (const L of lines) { const d = Math.abs(t - L); if (d <= bd) { bd = d; best = L; } } return best; };

export function VideoEditorApp({ AC, showToast }) {
  const [tracks, setTracks] = useState(() => [{ id: uid(), kind: "text" }, { id: uid(), kind: "media" }, { id: uid(), kind: "sound" }]);
  const [clips, setClips] = useState([]);
  const [selId, setSelId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pps, setPps] = useState(64);
  const [time, setTime] = useState(0);
  const [drop, setDrop] = useState(false);

  const clipsRef = useRef(clips); useEffect(() => { clipsRef.current = clips; }, [clips]);
  const tracksRef = useRef(tracks); useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  const ppsRef = useRef(pps); useEffect(() => { ppsRef.current = pps; }, [pps]);
  const selRef = useRef(selId); useEffect(() => { selRef.current = selId; }, [selId]);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const canvasRef = useRef(null);
  const playheadRef = useRef(null);
  const fileRef = useRef(null);
  const vids = useRef(new Map());   // url -> <video>
  const auds = useRef(new Map());   // url -> <audio>
  const imgs = useRef(new Map());   // url -> <img>
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const readoutTsRef = useRef(0);
  // export (Stage 3) — WebAudio mix + MediaRecorder
  const audioCtxRef = useRef(null);
  const masterRef = useRef(null);
  const mixDestRef = useRef(null);
  const srcNodes = useRef(new Map());   // url -> MediaElementAudioSourceNode (created lazily during export)
  const exportingRef = useRef(false);
  const recRef = useRef(null);
  const recChunksRef = useRef([]);
  const [exporting, setExporting] = useState(false);
  const tickRef = useRef(null);
  const loopRef = useRef(null);
  if (!loopRef.current) loopRef.current = (ts) => { if (tickRef.current) tickRef.current(ts); };

  // ── compositing ───────────────────────────────────────────────────────────
  function drawMedia(ctx, c) {
    const el = c.kind === "video" ? vids.current.get(c.url) : imgs.current.get(c.url);
    if (!el) return;
    const ew = c.kind === "video" ? el.videoWidth : el.naturalWidth;
    const eh = c.kind === "video" ? el.videoHeight : el.naturalHeight;
    if (!ew || !eh) return;
    const s = Math.min(CW / ew, CH / eh), dw = ew * s, dh = eh * s;
    try { ctx.drawImage(el, (CW - dw) / 2, (CH - dh) / 2, dw, dh); } catch { /* not ready */ }
  }
  function drawText(ctx, c) {
    const fs = (c.fontSize || 0.09) * CH;
    ctx.font = (c.weight || 800) + " " + fs + "px 'Inter','Segoe UI',system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const x = (c.x ?? 0.5) * CW, y = (c.y ?? 0.82) * CH;
    ctx.lineJoin = "round"; ctx.lineWidth = fs * 0.14; ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeText(c.text || "", x, y);
    ctx.fillStyle = c.color || "#ffffff";
    ctx.fillText(c.text || "", x, y);
  }
  function drawFrame(t) {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CW, CH);
    const mediaTracks = tracksRef.current.filter(tr => tr.kind === "media");
    for (let i = mediaTracks.length - 1; i >= 0; i--) {       // upper timeline track paints last (on top)
      const act = clipsRef.current.filter(c => c.trackId === mediaTracks[i].id && (c.kind === "video" || c.kind === "image") && t >= c.start && t < clipEnd(c));
      const c = act[act.length - 1];
      if (c) { ctx.globalAlpha = fadeAlpha(c, t); drawMedia(ctx, c); ctx.globalAlpha = 1; }
    }
    for (const c of clipsRef.current) if (c.kind === "text" && t >= c.start && t < clipEnd(c)) { ctx.globalAlpha = fadeAlpha(c, t); drawText(ctx, c); ctx.globalAlpha = 1; }
  }
  function setHead(t) { if (playheadRef.current) playheadRef.current.style.left = (GUTTER + t * ppsRef.current) + "px"; }

  // Keep every active video/audio element playing & synced; pause the rest.
  function syncMedia(t, isPlaying) {
    const activeV = new Set(), activeA = new Set();
    for (const c of clipsRef.current) {
      if (c.kind !== "video" && c.kind !== "audio") continue;
      if (!(t >= c.start && t < clipEnd(c))) continue;
      const el = c.kind === "video" ? vids.current.get(c.url) : auds.current.get(c.url);
      (c.kind === "video" ? activeV : activeA).add(c.url);
      if (!el) continue;
      if (exportingRef.current) routeAudio(c.url, el);   // pull this clip's audio into the export mix
      const expected = c.inPt + (t - c.start) * spd(c);
      try { el.playbackRate = spd(c); } catch { /* */ }
      el.volume = Math.max(0, Math.min(1, (c.muted ? 0 : (c.volume ?? 1)) * fadeAlpha(c, t)));
      if (Math.abs(el.currentTime - expected) > 0.25) { try { el.currentTime = expected; } catch { /* */ } if (!isPlaying) el.addEventListener("seeked", () => drawFrame(timeRef.current), { once: true }); }
      if (isPlaying && el.paused) el.play().catch(() => {});
      if (!isPlaying && !el.paused) el.pause();
    }
    vids.current.forEach((v, url) => { if (!activeV.has(url) && !v.paused) v.pause(); });
    auds.current.forEach((a, url) => { if (!activeA.has(url) && !a.paused) a.pause(); });
  }

  tickRef.current = (ts) => {
    if (!playingRef.current) return;
    const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
    lastTsRef.current = ts;
    let t = timeRef.current + dt;
    const total = projectTotal(clipsRef.current);
    if (t >= total) { timeRef.current = total; syncMedia(total, false); drawFrame(total); setHead(total); stopPlay(total); return; }
    timeRef.current = t; syncMedia(t, true); drawFrame(t); setHead(t);
    if (ts - readoutTsRef.current > 100) { readoutTsRef.current = ts; setTime(t); }
    rafRef.current = requestAnimationFrame(loopRef.current);
  };

  function stopPlay(t) { playingRef.current = false; setPlaying(false); cancelAnimationFrame(rafRef.current); vids.current.forEach(v => { if (!v.paused) v.pause(); }); auds.current.forEach(a => { if (!a.paused) a.pause(); }); setTime(t != null ? t : timeRef.current); if (exportingRef.current && recRef.current && recRef.current.state !== "inactive") { try { recRef.current.stop(); } catch { /* */ } } }
  function play() { const total = projectTotal(clipsRef.current); if (!total) return; if (timeRef.current >= total - 0.02) { timeRef.current = 0; setHead(0); } playingRef.current = true; setPlaying(true); lastTsRef.current = 0; readoutTsRef.current = 0; rafRef.current = requestAnimationFrame(loopRef.current); }
  function togglePlay() { if (playingRef.current) stopPlay(); else play(); }
  function seek(t) { const total = projectTotal(clipsRef.current); t = Math.max(0, Math.min(t, total || 0)); timeRef.current = t; setHead(t); setTime(t); syncMedia(t, playingRef.current); drawFrame(t); }

  // ── export (Stage 3): record the preview canvas + a WebAudio mix to .webm ──
  function ensureAudioGraph() {
    if (audioCtxRef.current) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
      const ctx = new Ctx(); const master = ctx.createGain(); const dest = ctx.createMediaStreamDestination();
      master.connect(ctx.destination); master.connect(dest);
      audioCtxRef.current = ctx; masterRef.current = master; mixDestRef.current = dest; return true;
    } catch { return false; }
  }
  function routeAudio(url, el) {
    if (!audioCtxRef.current || !masterRef.current || srcNodes.current.has(url)) return;
    try { const n = audioCtxRef.current.createMediaElementSource(el); n.connect(masterRef.current); srcNodes.current.set(url, n); } catch { /* already routed elsewhere */ }
  }
  async function exportVideo() {
    if (exportingRef.current) return;
    if (!projectTotal(clipsRef.current)) { showToast?.("Add clips to export"); return; }
    const cv = canvasRef.current;
    if (!cv || !cv.captureStream || !window.MediaRecorder) { showToast?.("Export isn't supported in this browser"); return; }
    ensureAudioGraph(); try { await audioCtxRef.current?.resume(); } catch { /* */ }
    const trk = [...cv.captureStream(30).getVideoTracks()];
    if (mixDestRef.current) trk.push(...mixDestRef.current.stream.getAudioTracks());
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "video/webm";
    let rec; try { rec = new MediaRecorder(new MediaStream(trk), { mimeType: mime }); } catch { showToast?.("Export isn't supported here"); return; }
    recChunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(recChunksRef.current, { type: "video/webm" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nova-export-" + Date.now() + ".webm"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      exportingRef.current = false; setExporting(false); showToast?.("Exported .webm ✓");
    };
    recRef.current = rec;
    exportingRef.current = true; setExporting(true);
    timeRef.current = 0; setHead(0); setTime(0);
    showToast?.("Recording — playing through once…");
    try { rec.start(); } catch { exportingRef.current = false; setExporting(false); showToast?.("Export failed to start"); return; }
    play();
  }

  // ── import ──────────────────────────────────────────────────────────────
  function firstTrack(kind) { return tracksRef.current.find(t => t.kind === kind); }
  function trackEnd(trackId) { return clipsRef.current.filter(c => c.trackId === trackId).reduce((m, c) => Math.max(m, clipEnd(c)), 0); }
  function addFiles(list) {
    const files = [...(list || [])]; let added = 0;
    for (const file of files) {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith("video/")) {
        const tr = firstTrack("media"); if (!tr) { URL.revokeObjectURL(url); continue; }
        added++; const start = trackEnd(tr.id);
        const v = document.createElement("video"); v.preload = "auto"; v.playsInline = true; v.src = url;
        v.addEventListener("loadeddata", () => {
          vids.current.set(url, v);
          const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
          const tc = document.createElement("canvas"); tc.width = 160; tc.height = 90; const tx = tc.getContext("2d");
          const finish = (thumb) => { v.currentTime = 0; setClips(cs => [...cs, { id: uid(), trackId: tr.id, kind: "video", name: file.name, url, sourceDur: dur, inPt: 0, outPt: dur, start, thumb }]); };
          v.addEventListener("seeked", () => { try { const s = Math.min(160 / v.videoWidth, 90 / v.videoHeight), dw = v.videoWidth * s, dh = v.videoHeight * s; tx.fillStyle = "#000"; tx.fillRect(0, 0, 160, 90); tx.drawImage(v, (160 - dw) / 2, (90 - dh) / 2, dw, dh); } catch { /* */ } finish(tc.toDataURL("image/jpeg", 0.6)); }, { once: true });
          try { v.currentTime = Math.min(0.1, dur); } catch { finish(""); }
        }, { once: true });
        v.addEventListener("error", () => showToast?.("Couldn't load " + file.name), { once: true });
        v.load();
      } else if (file.type.startsWith("image/")) {
        const tr = firstTrack("media"); if (!tr) { URL.revokeObjectURL(url); continue; }
        added++; const start = trackEnd(tr.id);
        const img = new Image();
        img.onload = () => { imgs.current.set(url, img); setClips(cs => [...cs, { id: uid(), trackId: tr.id, kind: "image", name: file.name, url, sourceDur: IMG_CAP, inPt: 0, outPt: IMG_DUR, start }]); };
        img.onerror = () => showToast?.("Couldn't load " + file.name);
        img.src = url;
      } else if (file.type.startsWith("audio/")) {
        const tr = firstTrack("sound"); if (!tr) { URL.revokeObjectURL(url); continue; }
        added++; const start = timeRef.current;
        const a = document.createElement("audio"); a.preload = "auto"; a.src = url;
        a.addEventListener("loadedmetadata", () => { auds.current.set(url, a); const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : 10; setClips(cs => [...cs, { id: uid(), trackId: tr.id, kind: "audio", name: file.name, url, sourceDur: dur, inPt: 0, outPt: dur, start }]); }, { once: true });
        a.addEventListener("error", () => showToast?.("Couldn't load " + file.name), { once: true });
        a.load();
      } else URL.revokeObjectURL(url);
    }
    if (added) showToast?.(added > 1 ? added + " clips imported" : "Clip imported");
  }
  function onFiles(e) { addFiles(e.target.files); e.target.value = ""; }

  function addText() {
    const tr = firstTrack("text"); if (!tr) return;
    const id = uid();
    setClips(cs => [...cs, { id, trackId: tr.id, kind: "text", text: "Your title", color: "#ffffff", fontSize: 0.1, weight: 800, x: 0.5, y: 0.82, start: timeRef.current, duration: TEXT_DUR }]);
    setSelId(id); setTimeout(() => drawFrame(timeRef.current), 0);
  }

  // ── clip edits ──────────────────────────────────────────────────────────
  function patchClip(id, p) { setClips(cs => cs.map(c => c.id === id ? { ...c, ...p } : c)); setTimeout(() => drawFrame(timeRef.current), 0); }
  function split() {
    const t = timeRef.current; const c = clipsRef.current.find(x => x.id === selRef.current);
    if (!c || c.kind === "text") { showToast?.("Select a video/audio clip to split"); return; }
    if (!(t > c.start + 0.05 && t < clipEnd(c) - 0.05)) { showToast?.("Move the playhead inside the clip to split"); return; }
    const srcAt = c.inPt + (t - c.start);
    setClips(cs => { const i = cs.findIndex(x => x.id === c.id); if (i < 0) return cs; const next = [...cs]; next.splice(i, 1, { ...c, outPt: srcAt }, { ...c, id: uid(), inPt: srcAt, start: t }); return next; });
    showToast?.("Clip split");
  }
  function delClip(id) {
    setClips(cs => { const gone = cs.find(c => c.id === id); const next = cs.filter(c => c.id !== id); if (gone && gone.url && !next.some(c => c.url === gone.url)) { URL.revokeObjectURL(gone.url); vids.current.delete(gone.url); auds.current.delete(gone.url); imgs.current.delete(gone.url); } return next; });
    if (selRef.current === id) setSelId(null);
    setTimeout(() => drawFrame(timeRef.current), 0);
  }
  // Reference lines to snap to: t=0, the playhead, and every other clip's edges.
  function snapLines(exceptId) { const L = [0, timeRef.current]; for (const o of clipsRef.current) { if (o.id === exceptId) continue; L.push(o.start, clipEnd(o)); } return L; }
  function startMove(e, id) {
    e.stopPropagation(); setSelId(id);
    const c0 = clipsRef.current.find(c => c.id === id); if (!c0) return;
    const startX = e.clientX, s0 = c0.start, dur = clipDur(c0);
    const move = (ev) => {
      const pps = ppsRef.current, tol = 8 / pps;
      let ns = Math.max(0, s0 + (ev.clientX - startX) / pps);
      const lines = snapLines(id);   // snap whichever edge (start or end) lands closest to a line
      let best = null;
      for (const L of lines) {
        const ds = Math.abs(ns - L); if (ds <= tol && (!best || ds < best.d)) best = { v: L, d: ds };
        const de = Math.abs(ns + dur - L); if (de <= tol && L - dur >= 0 && (!best || de < best.d)) best = { v: L - dur, d: de };
      }
      if (best) ns = best.v;
      // move between tracks of a compatible kind (lane under the pointer)
      let trk = null;
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const lane = hit && hit.closest && hit.closest("[data-lane-kind]");
      if (lane && lane.dataset.laneKind === clipTrackKind(c0)) trk = lane.dataset.laneId;
      setClips(cs => cs.map(c => c.id === id ? { ...c, start: ns, ...(trk ? { trackId: trk } : {}) } : c));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); drawFrame(timeRef.current); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function startTrim(e, id, edge) {
    e.stopPropagation(); e.preventDefault();
    const c0 = clipsRef.current.find(c => c.id === id); if (!c0) return;
    const startX = e.clientX, s0 = c0.start, in0 = c0.inPt, out0 = c0.outPt, dur0 = c0.duration;
    const end0 = c0.kind === "text" ? s0 + (dur0 || 0) : s0 + (out0 - in0);
    const move = (ev) => {
      const pps = ppsRef.current, tol = 8 / pps, d = (ev.clientX - startX) / pps, lines = snapLines(id);
      setClips(cs => cs.map(c => {
        if (c.id !== id) return c;
        if (edge === "left") {
          const ds = snapTime(s0 + d, lines, tol);
          if (c.kind === "text") { const ns = Math.max(0, Math.min(ds, s0 + dur0 - MIN_CLIP)); return { ...c, start: ns, duration: dur0 - (ns - s0) }; }
          const ni = Math.max(0, Math.min(in0 + (ds - s0), out0 - MIN_CLIP)); return { ...c, inPt: ni, start: Math.max(0, s0 + (ni - in0)) };
        }
        const de = snapTime(end0 + d, lines, tol);
        if (c.kind === "text") return { ...c, duration: Math.max(MIN_CLIP, de - s0) };
        return { ...c, outPt: Math.min(c.sourceDur, Math.max(in0 + MIN_CLIP, in0 + (de - s0))) };
      }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); drawFrame(timeRef.current); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ── track management ──────────────────────────────────────────────────────
  function addTrackAfter(id, kind) { setTracks(ts => { const i = ts.findIndex(t => t.id === id); const next = [...ts]; next.splice(i < 0 ? ts.length : i + 1, 0, { id: uid(), kind }); return next; }); }
  function delTrack(id) { setTracks(ts => { const t = ts.find(x => x.id === id); if (!t || ts.filter(x => x.kind === t.kind).length <= 1) return ts; return ts.filter(x => x.id !== id); }); }

  // ── keyboard: Backspace/Delete removes the selected clip ──────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const a = document.activeElement, tag = a && a.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (a && a.isContentEditable)) return;
      if (!selRef.current) return;
      e.preventDefault(); delClip(selRef.current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { drawFrame(timeRef.current); /* eslint-disable-next-line */ }, [clips, tracks, pps]);
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    vids.current.forEach((v, url) => { try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* */ } URL.revokeObjectURL(url); });
    auds.current.forEach((a, url) => { try { a.pause(); } catch { /* */ } URL.revokeObjectURL(url); });
    imgs.current.forEach((_, url) => URL.revokeObjectURL(url));
    try { audioCtxRef.current?.close(); } catch { /* */ }
  }, []);

  const total = projectTotal(clips);
  const sel = clips.find(c => c.id === selId);
  const contentW = Math.max(total * pps + 60, 400);

  // styles
  const tBtn = (active) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid " + (active ? AC : "rgba(255,255,255,0.14)"), background: "rgba(255,255,255,0.05)", color: active ? AC : "#dfe3ee", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" });
  const iBtn = { width: 32, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#dfe3ee", cursor: "pointer", fontSize: 12.5, lineHeight: 1 };
  const lblS = { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b93a7" };
  const selS = { padding: "4px 6px", borderRadius: 6, background: "#171922", color: "#e8eaf0", border: "1px solid rgba(255,255,255,0.16)", fontFamily: FF, fontSize: 11.5, cursor: "pointer" };
  const secInterval = pps >= 80 ? 1 : pps >= 40 ? 2 : 5;
  const ticks = []; for (let s = 0; s <= Math.ceil(total) + secInterval; s += secInterval) ticks.push(s);

  return (
    <div
      onDragOver={e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === "file")) { e.preventDefault(); if (!drop) setDrop(true); } }}
      onDragLeave={e => { if (e.target === e.currentTarget) setDrop(false); }}
      onDrop={e => { e.preventDefault(); setDrop(false); addFiles(e.dataTransfer?.files); }}
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: "#0e0f15", color: "#e8eaf0" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, marginRight: 2 }}>🎬 Video Editor</span>
        <button style={tBtn(false)} onClick={() => fileRef.current?.click()}>＋ Import</button>
        <button style={tBtn(false)} onClick={addText}>T Text</button>
        <input ref={fileRef} type="file" accept="video/*,image/*,audio/*" multiple style={{ display: "none" }} onChange={onFiles} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "#8b93a7" }}>Zoom</span>
        <button style={iBtn} title="Zoom out" onClick={() => setPps(p => Math.max(20, Math.round(p / 1.3)))}>−</button>
        <button style={iBtn} title="Zoom in" onClick={() => setPps(p => Math.min(220, Math.round(p * 1.3)))}>+</button>
        <button style={{ ...tBtn(false), opacity: (exporting || !clips.length) ? 0.5 : 1, cursor: (exporting || !clips.length) ? "default" : "pointer" }} disabled={exporting || !clips.length} title="Export the timeline to a .webm video" onClick={exportVideo}>{exporting ? "● Exporting…" : "⬇ Export"}</button>
      </div>

      {/* Preview */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#06070b", padding: 14, position: "relative" }}>
        {clips.length === 0 && (
          <div style={{ textAlign: "center", color: "#727a8e", maxWidth: 380, pointerEvents: "none" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "#c8cde0" }}>Import to start editing</div>
            <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>Drop or <strong>＋ Import</strong> video, image and audio onto the tracks below, add titles with <strong>T Text</strong>, then trim, split and arrange.</div>
          </div>
        )}
        <canvas ref={canvasRef} width={CW} height={CH} style={{ display: clips.length ? "block" : "none", maxWidth: "100%", maxHeight: "100%", aspectRatio: "16 / 9", borderRadius: 8, background: "#000", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }} />
        {drop && <div style={{ position: "absolute", inset: 12, border: "2.5px dashed " + AC, borderRadius: 14, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 700, fontSize: 17, color: AC, pointerEvents: "none" }}>Drop clips to import</div>}
      </div>

      {/* Transport + properties */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "#0b0c12", flexShrink: 0, flexWrap: "wrap" }}>
        <button style={iBtn} title="Back to start" onClick={() => seek(0)}>⏮</button>
        <button onClick={togglePlay} disabled={!clips.length} title={playing ? "Pause" : "Play"} style={{ width: 38, height: 30, borderRadius: 8, border: "1px solid " + AC, background: "rgba(255,255,255,0.06)", color: AC, cursor: clips.length ? "pointer" : "default", fontSize: 14, opacity: clips.length ? 1 : 0.5 }}>{playing ? "⏸" : "▶"}</button>
        <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5, color: "#aeb6ca", minWidth: 124 }}>{fmt(time)} / {fmt(total)}</span>
        <div style={{ flex: 1 }} />
        {sel && sel.kind === "text" && (
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input value={sel.text} onChange={e => patchClip(sel.id, { text: e.target.value })} placeholder="Title…" spellCheck={false} style={{ width: 150, padding: "6px 9px", borderRadius: 7, background: "#171922", color: "#e8eaf0", border: "1px solid rgba(255,255,255,0.16)", fontFamily: FF, fontSize: 12.5, outline: "none" }} />
            <input type="color" value={sel.color || "#ffffff"} onChange={e => patchClip(sel.id, { color: e.target.value })} title="Color" style={{ width: 28, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.16)", background: "none", cursor: "pointer", padding: 0 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b93a7" }}>Size<input type="range" min="4" max="22" value={Math.round((sel.fontSize || 0.1) * 100)} onChange={e => patchClip(sel.id, { fontSize: +e.target.value / 100 })} style={{ width: 64 }} /></span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b93a7" }}>Y<input type="range" min="8" max="92" value={Math.round((sel.y ?? 0.82) * 100)} onChange={e => patchClip(sel.id, { y: +e.target.value / 100 })} style={{ width: 60 }} /></span>
            <span style={lblS} title="Fade in (s)">In<input type="range" min="0" max="30" value={Math.round((sel.fadeIn || 0) * 10)} onChange={e => patchClip(sel.id, { fadeIn: +e.target.value / 10 })} style={{ width: 46 }} /></span>
            <span style={lblS} title="Fade out (s)">Out<input type="range" min="0" max="30" value={Math.round((sel.fadeOut || 0) * 10)} onChange={e => patchClip(sel.id, { fadeOut: +e.target.value / 10 })} style={{ width: 46 }} /></span>
            <button style={{ ...iBtn, color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }} title="Delete (or Backspace)" onClick={() => delClip(sel.id)}>🗑</button>
          </span>
        )}
        {sel && sel.kind !== "text" && (
          <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 11.5, color: "#8b93a7", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.name}</span>
            {(sel.kind === "video" || sel.kind === "audio") && (
              <span style={lblS}>Speed<select value={sel.speed || 1} onChange={e => patchClip(sel.id, { speed: +e.target.value })} style={selS}>{[0.25, 0.5, 1, 1.5, 2, 4].map(s => <option key={s} value={s}>{s}×</option>)}</select></span>
            )}
            {(sel.kind === "video" || sel.kind === "audio") && (
              <button title={sel.muted ? "Unmute" : "Mute"} onClick={() => patchClip(sel.id, { muted: !sel.muted })} style={{ ...iBtn, color: sel.muted ? "#ff8a8a" : "#dfe3ee" }}>{sel.muted ? "🔇" : "🔊"}</button>
            )}
            {(sel.kind === "video" || sel.kind === "audio") && (
              <span style={lblS}>Vol<input type="range" min="0" max="100" value={Math.round((sel.volume ?? 1) * 100)} onChange={e => patchClip(sel.id, { volume: +e.target.value / 100 })} style={{ width: 54 }} /></span>
            )}
            <span style={lblS} title="Fade in (s)">In<input type="range" min="0" max="30" value={Math.round((sel.fadeIn || 0) * 10)} onChange={e => patchClip(sel.id, { fadeIn: +e.target.value / 10 })} style={{ width: 46 }} /></span>
            <span style={lblS} title="Fade out (s)">Out<input type="range" min="0" max="30" value={Math.round((sel.fadeOut || 0) * 10)} onChange={e => patchClip(sel.id, { fadeOut: +e.target.value / 10 })} style={{ width: 46 }} /></span>
            <button style={tBtn(false)} onClick={split}>✂ Split</button>
            <button style={{ ...iBtn, color: "#ff8a8a", borderColor: "rgba(255,80,80,0.3)" }} title="Delete (or Backspace)" onClick={() => delClip(sel.id)}>🗑</button>
          </span>
        )}
        {!sel && <span style={{ fontSize: 11.5, color: "#6b7286" }}>Select a clip to edit · drag a clip to move it, its edges to trim</span>}
      </div>

      {/* Timeline */}
      <div style={{ height: 178, background: "#0a0b11", borderTop: "1px solid rgba(255,255,255,0.08)", overflow: "auto", flexShrink: 0 }}>
        <div style={{ position: "relative", width: (GUTTER + contentW) + "px", minWidth: "100%" }}>
          {/* ruler */}
          <div style={{ display: "flex", height: 24 }}>
            <div style={{ width: GUTTER, flexShrink: 0, position: "sticky", left: 0, zIndex: 3, background: "#0a0b11", borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
            <div onPointerDown={e => { const r = e.currentTarget.getBoundingClientRect(); const go = c => seek((c - r.left) / pps); go(e.clientX); const mv = ev => go(ev.clientX); const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }}
              style={{ position: "relative", width: contentW, borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: "text", userSelect: "none" }}>
              {ticks.map(s => <div key={s} style={{ position: "absolute", left: s * pps, top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 4, fontSize: 10, color: "#6b7286", lineHeight: "24px" }}>{s}s</div>)}
            </div>
          </div>

          {/* track rows */}
          {tracks.map(tr => {
            const cfg = TRACK[tr.kind];
            const empty = !clips.some(c => c.trackId === tr.id);
            const canDel = empty && tracks.filter(x => x.kind === tr.kind).length > 1;
            return (
              <div key={tr.id} style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {/* gutter */}
                <div style={{ width: GUTTER, flexShrink: 0, position: "sticky", left: 0, zIndex: 3, background: "#0d0e16", borderRight: "1px solid rgba(255,255,255,0.08)", padding: "5px 6px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, height: cfg.h }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, fontFamily: FFB, fontWeight: 700, color: "#c2c8da", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cfg.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <button title={"Add another " + cfg.label.toLowerCase() + " track"} onClick={() => addTrackAfter(tr.id, tr.kind)} style={{ width: 18, height: 16, borderRadius: 4, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#aeb6ca", fontSize: 11, lineHeight: 1, cursor: "pointer", padding: 0 }}>+</button>
                    {canDel && <button title="Remove this empty track" onClick={() => delTrack(tr.id)} style={{ width: 18, height: 16, borderRadius: 4, border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,255,255,0.04)", color: "#ff9a9a", fontSize: 11, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>}
                  </div>
                </div>
                {/* lane */}
                <div data-lane-kind={tr.kind} data-lane-id={tr.id} onPointerDown={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / pps); } }}
                  style={{ position: "relative", width: contentW, height: cfg.h, background: tr.kind === "media" ? "rgba(59,130,246,0.05)" : tr.kind === "sound" ? "rgba(34,197,94,0.05)" : "rgba(245,158,11,0.05)" }}>
                  {clips.filter(c => c.trackId === tr.id).map(c => {
                    const w = clipDur(c) * pps, on = c.id === selId;
                    return (
                      <div key={c.id} onPointerDown={e => startMove(e, c.id)} title={c.kind === "text" ? c.text : c.name}
                        style={{ position: "absolute", left: c.start * pps, top: 3, width: Math.max(3, w), height: cfg.h - 6, borderRadius: 6, overflow: "hidden", cursor: "grab", boxSizing: "border-box", border: "2px solid " + (on ? AC : "rgba(255,255,255,0.14)"), background: tr.kind === "media" ? "#1a2436" : tr.kind === "sound" ? "#13301f" : "#332608" }}>
                        {c.kind === "video" && c.thumb && <img src={c.thumb} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.5, pointerEvents: "none" }} />}
                        <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", right: 6, fontSize: 10.5, fontFamily: FFB, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>{cfg.icon === "T" ? "T " : cfg.icon + " "}{c.kind === "text" ? (c.text || "Text") : c.name}</div>
                        <div onPointerDown={e => startTrim(e, c.id, "left")} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 7, cursor: "ew-resize", background: on ? AC : "transparent" }} />
                        <div onPointerDown={e => startTrim(e, c.id, "right")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 7, cursor: "ew-resize", background: on ? AC : "transparent" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* playhead spans every row */}
          <div ref={playheadRef} style={{ position: "absolute", top: 0, bottom: 0, left: GUTTER + time * pps, width: 2, background: "#ff4d6d", pointerEvents: "none", zIndex: 2 }}>
            <div style={{ position: "absolute", top: -1, left: -5, width: 12, height: 9, background: "#ff4d6d", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

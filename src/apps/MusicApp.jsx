import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { novaConfirm } from "../ui/dialogs.jsx";

// Nova Music — Spotify/Apple-Music-style player.
//   v9.2 real player · v9.5 shuffle/repeat/queue · v11.0 beat-reactive
//   visualizer (Web Audio), immersive Now Playing view, drag-drop + folder
//   import, refreshed UI.
//
// Playback model (unchanged): tracks[] (library) · playIds[] (queue, ordered) ·
// playPos (index into playIds). The audio element is ALWAYS mounted (src swaps
// per track) so the Web Audio MediaElementSource stays valid across tracks.

const hexToHue = (hex) => {
  const n = parseInt(String(hex).replace("#", ""), 16);
  if (!isFinite(n)) return 250;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return h;
};
function bar(ctx, x, y, w, h, r) { if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h); }

export function MusicApp({ AC, showToast }) {
  const [tracks, setTracks] = useState([]);
  const [playIds, setPlayIds] = useState([]);
  const [playPos, setPlayPos] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");
  const [view, setView] = useState("home");      // home | library | queue | now
  const [dragging, setDragging] = useState(false);
  const [eq, setEq] = useState({ bass: 0, mid: 0, treble: 0, preamp: 1 });   // mixer / EQ
  const [vocal, setVocal] = useState(false);                                 // vocal remover (karaoke)
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlVal, setUrlVal] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const folderRef = useRef(null);

  // Web Audio analyser (created lazily on first play gesture).
  const analyserRef = useRef(null);
  const eqRef = useRef({});                                     // live Web Audio nodes
  const eqValsRef = useRef({ bass: 0, mid: 0, treble: 0, preamp: 1 });
  const vocalRef = useRef(false);
  // Build the graph once: source → preamp → bass → mid → treble → [vocal] → analyser → out
  function ensureAnalyser() {
    try {
      if (eqRef.current.ctx) { eqRef.current.ctx.resume?.(); return; }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || !audioRef.current) return;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audioRef.current);
      const preamp = ctx.createGain();
      const bassF = ctx.createBiquadFilter(); bassF.type = "lowshelf"; bassF.frequency.value = 200;
      const midF = ctx.createBiquadFilter(); midF.type = "peaking"; midF.frequency.value = 1100; midF.Q.value = 0.9;
      const trebF = ctx.createBiquadFilter(); trebF.type = "highshelf"; trebF.frequency.value = 3200;
      const an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.82;
      const splitter = ctx.createChannelSplitter(2);
      const invGain = ctx.createGain(); invGain.gain.value = -1;
      const sumGain = ctx.createGain();
      src.connect(preamp); preamp.connect(bassF); bassF.connect(midF); midF.connect(trebF);
      trebF.connect(an); an.connect(ctx.destination);
      eqRef.current = { ctx, preamp, bassF, midF, trebF, an, splitter, invGain, sumGain, vocalOn: false };
      analyserRef.current = an;
      applyEq();
      ctx.resume?.();
    } catch { /* Web Audio unavailable */ }
  }
  function applyEq() {
    const e = eqRef.current; if (!e.ctx) return;
    const v = eqValsRef.current;
    e.preamp.gain.value = v.preamp; e.bassF.gain.value = v.bass; e.midF.gain.value = v.mid; e.trebF.gain.value = v.treble;
    wireVocal(vocalRef.current);
  }
  // Karaoke = center-channel cancellation: out = L − R (removes most lead vocals).
  function wireVocal(on) {
    const e = eqRef.current; if (!e.ctx || e.vocalOn === on) return;
    try {
      e.trebF.disconnect();
      if (on) { e.trebF.connect(e.splitter); e.splitter.connect(e.sumGain, 0); e.splitter.connect(e.invGain, 1); e.invGain.connect(e.sumGain); e.sumGain.connect(e.an); }
      else { try { e.splitter.disconnect(); } catch { /* */ } try { e.invGain.disconnect(); } catch { /* */ } try { e.sumGain.disconnect(); } catch { /* */ } e.trebF.connect(e.an); }
      e.vocalOn = on;
    } catch { /* */ }
  }

  const curId = playPos >= 0 ? playIds[playPos] : null;
  const cur = curId ? tracks.find(t => t.id === curId) : null;

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { eqValsRef.current = eq; vocalRef.current = vocal; applyEq(); }, [eq, vocal]);   // live-apply mixer to the graph
  useEffect(() => () => { tracks.forEach(t => URL.revokeObjectURL(t.url)); try { eqRef.current.ctx?.close(); } catch { /* */ } }, []); // eslint-disable-line

  // ── tracks ──
  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const audioFiles = files.filter(f => (f.type && f.type.startsWith("audio/")) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name));
    if (audioFiles.length === 0) { showToast?.("No audio files found"); return; }
    const now = Date.now();
    const next = audioFiles.map((f, i) => ({ id: now + i, name: f.name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(f), size: f.size, addedAt: now + i }));
    setTracks(prev => {
      const combined = [...prev, ...next];
      if (playIds.length === 0) { setPlayIds(next.map(t => t.id)); setPlayPos(p => p < 0 ? 0 : p); }
      return combined;
    });
    showToast?.(audioFiles.length + " track" + (audioFiles.length === 1 ? "" : "s") + " added");
  }
  function onPick(e) { addFiles(e.target.files); e.target.value = ""; }
  // Import a direct audio link. Fetched to a local blob so it plays fully and
  // works with the visualizer/mixer (needs a CORS-enabled host in the browser;
  // unrestricted in the desktop build).
  async function importUrl() {
    const url = urlVal.trim(); if (!url || urlBusy) return;
    setUrlBusy(true);
    try {
      const res = await fetch(url); if (!res.ok) throw new Error("status");
      const blob = await res.blob();
      const looksAudio = /audio\//.test(blob.type) || /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(url);
      if (!looksAudio) { showToast?.("That link doesn't look like an audio file"); setUrlBusy(false); return; }
      const raw = decodeURIComponent((url.split("/").pop() || "track").split(/[?#]/)[0]) || "Imported track";
      const t = { id: Date.now(), name: raw.replace(/\.[^.]+$/, "") || "Imported track", url: URL.createObjectURL(blob), size: blob.size, addedAt: Date.now() };
      setTracks(prev => { const combined = [...prev, t]; if (playIds.length === 0) { setPlayIds([t.id]); setPlayPos(p => p < 0 ? 0 : p); } return combined; });
      showToast?.("Imported “" + t.name + "”");
      setUrlVal(""); setUrlOpen(false);
    } catch {
      showToast?.("Couldn't fetch that link — the site may block downloads (CORS). Try a direct, CORS-enabled audio link.");
    }
    setUrlBusy(false);
  }
  function removeTrack(id) {
    const removed = tracks.find(t => t.id === id);
    if (removed) URL.revokeObjectURL(removed.url);
    setTracks(prev => prev.filter(t => t.id !== id));
    setPlayIds(prev => {
      const pos = prev.indexOf(id); if (pos === -1) return prev;
      const next = prev.filter(x => x !== id);
      if (pos === playPos) { setPlayPos(-1); setPlaying(false); }
      else if (pos < playPos) setPlayPos(p => p - 1);
      return next;
    });
  }

  // ── queue ──
  function startWithTrack(id) {
    ensureAnalyser();
    const lib = tracks.map(t => t.id); if (!lib.length) return;
    const startIdx = lib.indexOf(id); if (startIdx === -1) return;
    let order;
    if (shuffle) { const rest = lib.filter(x => x !== id); shuffleArray(rest); order = [id, ...rest]; }
    else order = [...lib.slice(startIdx), ...lib.slice(0, startIdx)];
    setPlayIds(order); setPlayPos(0);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
  }
  function addToQueue(id) {
    setPlayIds(prev => { const next = [...prev, id]; if (playPos < 0) { ensureAnalyser(); setPlayPos(0); setTimeout(() => audioRef.current?.play().catch(() => {}), 0); } return next; });
    showToast?.("Added to queue");
  }
  function removeFromQueue(pos) {
    if (pos === playPos) next();
    setPlayIds(prev => { const out = [...prev]; out.splice(pos, 1); if (pos < playPos) setPlayPos(p => p - 1); return out; });
  }
  function moveInQueue(pos, delta) {
    setPlayIds(prev => { const out = [...prev]; const target = pos + delta; if (target < 0 || target >= out.length) return prev; [out[pos], out[target]] = [out[target], out[pos]]; if (pos === playPos) setPlayPos(target); else if (target === playPos) setPlayPos(pos); return out; });
  }
  async function clearQueue() {
    if (!(await novaConfirm({ title: "Clear queue", message: "Clear the queue? The currently playing track stays.", confirmText: "Clear queue", accent: AC }))) return;
    setPlayIds(curId ? [curId] : []); setPlayPos(curId ? 0 : -1);
  }
  function toggleShuffle() {
    setShuffle(s => { const next = !s; if (next && playIds.length > 1 && playPos >= 0) { const head = playIds.slice(0, playPos + 1); const tail = playIds.slice(playPos + 1); shuffleArray(tail); setPlayIds([...head, ...tail]); } return next; });
  }
  function cycleRepeat() { setRepeat(r => r === "off" ? "all" : r === "all" ? "one" : "off"); }

  // ── controls ──
  function togglePlay() {
    ensureAnalyser();
    if (playPos < 0) { if (tracks.length > 0) startWithTrack(tracks[0].id); return; }
    if (playing) audioRef.current?.pause(); else audioRef.current?.play().catch(() => {});
  }
  function prev() {
    ensureAnalyser();
    if (playPos > 0) { setPlayPos(p => p - 1); setTimeout(() => audioRef.current?.play().catch(() => {}), 0); }
    else if (audioRef.current && audioRef.current.currentTime > 3) audioRef.current.currentTime = 0;
  }
  function next() {
    ensureAnalyser();
    if (playPos < 0 || playIds.length === 0) return;
    const nextPos = playPos + 1;
    if (nextPos < playIds.length) { setPlayPos(nextPos); setTimeout(() => audioRef.current?.play().catch(() => {}), 0); }
    else if (repeat === "all") { setPlayPos(0); setTimeout(() => audioRef.current?.play().catch(() => {}), 0); }
    else setPlaying(false);
  }
  function jumpTo(pos) { ensureAnalyser(); if (pos < 0 || pos >= playIds.length) return; setPlayPos(pos); setTimeout(() => audioRef.current?.play().catch(() => {}), 0); }
  function onTrackEnded() { if (repeat === "one") { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } return; } next(); }
  function seek(e) { const el = audioRef.current; if (!el || !duration) return; const r = e.currentTarget.getBoundingClientRect(); el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration; }

  function fmt(s) { if (!Number.isFinite(s)) return "0:00"; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ":" + String(sec).padStart(2, "0"); }
  function trackGradient(name) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return `linear-gradient(135deg, hsl(${h % 360},65%,42%), hsl(${(h >> 8) % 360},58%,24%))`; }

  const progPct = duration > 0 ? (progress / duration) * 100 : 0;
  const recent = [...tracks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 6);
  const queueItems = playIds.map(id => tracks.find(t => t.id === id)).filter(Boolean);

  return (
    <div
      onDragOver={e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === "file")) { e.preventDefault(); if (!dragging) setDragging(true); } }}
      onDragLeave={e => { if (e.target === e.currentTarget) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer?.files); }}
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, position: "relative" }}>
      <style>{"@keyframes nm-eq{0%,100%{height:3px}50%{height:11px}}"}</style>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* SIDEBAR */}
        <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--nv-border)", padding: "16px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, background: "var(--nv-elevated)" }}>
          <div style={{ padding: "2px 10px 14px", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 22 }}>🎵</span>
            <div><div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Nova Music</div><div style={{ fontSize: 9.5, color: "var(--nv-text-dim)", letterSpacing: 0.5 }}>Your library</div></div>
          </div>
          <RailItem ac={AC} active={view === "home"} onClick={() => setView("home")} icon={<HomeGlyph />} label="Home" />
          <RailItem ac={AC} active={view === "library"} onClick={() => setView("library")} icon={<LibraryGlyph />} label="Your Library" badge={tracks.length || null} />
          <RailItem ac={AC} active={view === "queue"} onClick={() => setView("queue")} icon={<QueueGlyph />} label="Queue" badge={queueItems.length || null} />
          <RailItem ac={AC} active={view === "now"} onClick={() => setView("now")} icon={<EqBars playing={playing && view !== "now"} color="currentColor" />} label="Now Playing" />
          <RailItem ac={AC} active={view === "mixer"} onClick={() => setView("mixer")} icon={<MixerGlyph />} label="Mixer / EQ" />

          <div style={{ height: 12 }} />
          <input ref={inputRef} type="file" accept="audio/*" multiple onChange={onPick} style={{ display: "none" }} />
          <input ref={folderRef} type="file" webkitdirectory="" directory="" multiple onChange={onPick} style={{ display: "none" }} />
          <button onClick={() => inputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add music
          </button>
          <button onClick={() => folderRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", marginTop: 4, background: "transparent", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, color: "var(--nv-text)" }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>📁</span> Add a folder
          </button>
          <button onClick={() => setUrlOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", marginTop: 4, background: urlOpen ? fill(AC) : "transparent", border: "1px solid " + (urlOpen ? bdr(AC) : "var(--nv-border)"), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, color: urlOpen ? AC : "var(--nv-text)" }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>🔗</span> Add from link
          </button>
          {urlOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <input value={urlVal} onChange={e => setUrlVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") importUrl(); }} placeholder="https://…/song.mp3" spellCheck={false} style={{ padding: "7px 9px", borderRadius: 7, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 11.5, outline: "none" }} />
              <button onClick={importUrl} disabled={urlBusy || !urlVal.trim()} style={{ padding: "7px 11px", borderRadius: 7, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 11.5, cursor: (urlBusy || !urlVal.trim()) ? "default" : "pointer", opacity: (urlBusy || !urlVal.trim()) ? 0.5 : 1 }}>{urlBusy ? "Importing…" : "Import"}</button>
            </div>
          )}
          <div style={{ padding: "8px 10px 0", fontSize: 9.5, color: "var(--nv-text-dim)", lineHeight: 1.55 }}>Drag &amp; drop audio anywhere. MP3, WAV, OGG, M4A, FLAC.</div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, minWidth: 0, overflowY: view === "now" ? "hidden" : "auto" }}>
          {view === "home" && <HomeView tracks={tracks} recent={recent} cur={cur} playing={playing} startWithTrack={startWithTrack} setView={setView} pick={() => inputRef.current?.click()} trackGradient={trackGradient} AC={AC} />}
          {view === "library" && <LibraryView tracks={tracks} curId={curId} playing={playing} startWithTrack={startWithTrack} addToQueue={addToQueue} removeTrack={removeTrack} duration={duration} fmt={fmt} trackGradient={trackGradient} pick={() => inputRef.current?.click()} AC={AC} />}
          {view === "queue" && <QueueView queueItems={queueItems} playIds={playIds} playPos={playPos} playing={playing} jumpTo={jumpTo} removeFromQueue={removeFromQueue} moveInQueue={moveInQueue} clearQueue={clearQueue} trackGradient={trackGradient} AC={AC} />}
          {view === "now" && <NowPlaying cur={cur} playing={playing} progress={progress} duration={duration} progPct={progPct} seek={seek} fmt={fmt} analyserRef={analyserRef} trackGradient={trackGradient} AC={AC} />}
          {view === "mixer" && <MixerView eq={eq} setEq={setEq} vocal={vocal} setVocal={setVocal} AC={AC} />}
        </div>
      </div>

      {/* NOW-PLAYING BAR */}
      <div style={{ flexShrink: 0, height: 86, borderTop: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", display: "flex", flexDirection: "column" }}>
        <div onClick={seek} style={{ height: 4, background: "var(--nv-elevated)", cursor: cur ? "pointer" : "default", position: "relative" }}>
          <div style={{ height: "100%", width: progPct + "%", background: AC, transition: "width 0.1s linear", boxShadow: cur ? `0 0 8px ${AC}` : "none" }} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "0 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "1 1 0", minWidth: 0 }}>
            <button onClick={() => cur && setView("now")} title={cur ? "Open Now Playing" : ""} style={{ width: 52, height: 52, borderRadius: 8, padding: 0, border: "1px solid var(--nv-border)", background: cur ? trackGradient(cur.name) : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, cursor: cur ? "pointer" : "default", boxShadow: cur ? "0 4px 14px rgba(0,0,0,0.4)" : "none", color: "#fff" }}>{cur ? "🎶" : "🎵"}</button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {playing && <EqBars playing color={AC} />}
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur ? cur.name : "Nothing playing"}</div>
              </div>
              <div style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 2 }}>{cur ? fmt(progress) + " / " + fmt(duration) : "Add files to start"}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={toggleShuffle} title={shuffle ? "Shuffle on" : "Shuffle off"} style={modeBtn(shuffle, AC)}><ShuffleGlyph /></button>
            <button onClick={prev} disabled={playPos <= 0 && (audioRef.current?.currentTime || 0) < 3} title="Previous" style={transportBtn(true)}>⏮</button>
            <button onClick={togglePlay} disabled={tracks.length === 0} title={playing ? "Pause" : "Play"} style={playBtn(tracks.length > 0)}>{playing ? "⏸" : "▶"}</button>
            <button onClick={next} disabled={playPos < 0 || (playPos >= playIds.length - 1 && repeat !== "all")} title="Next" style={transportBtn(true)}>⏭</button>
            <button onClick={cycleRepeat} title={"Repeat: " + repeat} style={modeBtn(repeat !== "off", AC)}><RepeatGlyph mode={repeat} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 0", justifyContent: "flex-end", minWidth: 0 }}>
            <span style={{ fontSize: 14, color: "var(--nv-text-dim)", flexShrink: 0 }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(+e.target.value)} style={{ flex: "1 1 0", minWidth: 40, maxWidth: 130, accentColor: AC }} title={Math.round(volume * 100) + "%"} />
          </div>
        </div>
      </div>

      {/* always-mounted audio element (keeps the Web Audio source valid) */}
      <audio ref={audioRef} src={cur ? cur.url : undefined} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={e => setProgress(e.currentTarget.currentTime)} onDurationChange={e => setDuration(e.currentTarget.duration)} onEnded={onTrackEnded} />

      {dragging && (
        <div style={{ position: "absolute", inset: 10, zIndex: 50, border: "2.5px dashed " + AC, borderRadius: 16, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 40 }}>🎧</div><div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 18, color: "#fff", marginTop: 8 }}>Drop to add to your library</div></div>
        </div>
      )}
    </div>
  );
}

function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ───────── Visualizer: vibrant, beat-reactive frequency bars ─────────
function Visualizer({ analyserRef, AC, height = 240 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const baseHue = hexToHue(AC);
    const data = new Uint8Array(256);
    let raf = 0, phase = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height, mid = H / 2;
      ctx.clearRect(0, 0, W, H);
      const an = analyserRef.current;
      let bass = 0;
      if (an) { an.getByteFrequencyData(data); for (let i = 0; i < 8; i++) bass += data[i]; bass = bass / 8 / 255; }
      phase += 0.7 + bass * 3;
      // bass-driven radial glow
      const g = ctx.createRadialGradient(W / 2, mid, 0, W / 2, mid, W * 0.55);
      g.addColorStop(0, `hsla(${baseHue},90%,55%,${0.04 + bass * 0.22})`); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const n = 64, gap = 3, bw = (W - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.pow(i / n, 1.45) * (an ? an.frequencyBinCount * 0.85 : 0));
        const v = an ? data[idx] / 255 : (0.1 + 0.07 * (0.5 + 0.5 * Math.sin(i * 0.5 + phase * 0.04)));
        const bh = Math.max(3, v * v * H * 0.94 + 3);
        const hue = (baseHue + i * 2.6 + phase) % 360;
        ctx.fillStyle = `hsl(${hue},92%,${50 + v * 22}%)`;
        ctx.shadowColor = `hsl(${hue},95%,62%)`; ctx.shadowBlur = 7 + bass * 26;
        bar(ctx, i * (bw + gap), mid - bh / 2, bw, bh, Math.min(bw / 2, 3.5));
      }
      ctx.shadowBlur = 0;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [AC]);
  return <canvas ref={ref} width={1000} height={300} style={{ width: "100%", height, display: "block" }} />;
}

// ───────── Now Playing (immersive) ─────────
function NowPlaying({ cur, playing, progress, duration, progPct, seek, fmt, analyserRef, trackGradient, AC }) {
  const hue = hexToHue(AC);
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: `radial-gradient(120% 80% at 50% 0%, hsla(${hue},55%,22%,0.9), #0a0b12 70%)` }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "26px 24px 8px", minHeight: 0 }}>
        <div style={{ width: "min(230px, 34vh)", aspectRatio: "1/1", borderRadius: 18, background: cur ? trackGradient(cur.name) : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 70, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", flexShrink: 0, transition: "transform 0.2s", transform: playing ? "scale(1)" : "scale(0.97)" }}>🎶</div>
        <div style={{ textAlign: "center", maxWidth: "90%" }}>
          <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur ? cur.name : "Nothing playing"}</div>
          <div style={{ fontFamily: FFM, fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, letterSpacing: 0.4 }}>{cur ? "Local file" : "Pick a track from your library"}</div>
        </div>
      </div>
      {/* visualizer */}
      <div style={{ height: 150, flexShrink: 0, padding: "0 4px" }}><Visualizer analyserRef={analyserRef} AC={AC} height={150} /></div>
      {/* progress */}
      <div style={{ padding: "6px 28px 26px", flexShrink: 0 }}>
        <div onClick={seek} style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.14)", cursor: cur ? "pointer" : "default", position: "relative", overflow: "hidden" }}>
          <div style={{ height: "100%", width: progPct + "%", background: `linear-gradient(90deg, hsl(${hue},90%,60%), hsl(${(hue + 60) % 360},90%,62%))`, transition: "width 0.1s linear" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: FFM, fontSize: 11, color: "rgba(255,255,255,0.6)" }}><span>{fmt(progress)}</span><span>{fmt(duration)}</span></div>
      </div>
    </div>
  );
}

// ───────── Views (Home / Library / Queue) ─────────
function HomeView({ tracks, recent, cur, playing, startWithTrack, setView, pick, trackGradient, AC }) {
  if (tracks.length === 0) return (
    <div style={{ padding: 28, height: "100%", boxSizing: "border-box" }}>
      <div onClick={pick} style={{ height: "100%", minHeight: 240, border: "2px dashed var(--nv-border-strong)", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", background: `linear-gradient(135deg, rgba(${hexRgb(AC)},0.10), transparent)`, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 50 }}>🎧</div>
        <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 20, color: "var(--nv-text-strong)" }}>Add your music to begin</div>
        <div style={{ fontSize: 13.5, color: "var(--nv-text-dim)", lineHeight: 1.6, maxWidth: 380 }}>Click to browse your PC, drop files anywhere, or use “Add a folder” in the sidebar. MP3, WAV, OGG, M4A, FLAC.</div>
        <div style={{ marginTop: 8, padding: "10px 20px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 24, fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC }}>Browse files</div>
      </div>
    </div>
  );
  return (
    <div style={{ padding: "28px 28px 24px" }}>
      <div style={{ background: `linear-gradient(135deg, rgba(${hexRgb(AC)},0.35), rgba(${hexRgb(AC)},0.06))`, border: "1px solid " + bdr(AC), borderRadius: 16, padding: "26px 28px", marginBottom: 24, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ width: 88, height: 88, borderRadius: 14, background: fill(AC), border: "1px solid " + bdr(AC), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>🎵</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FFM, fontSize: 11, color: AC, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: "clamp(17px, 3vw, 26px)", color: "var(--nv-text-strong)", lineHeight: 1.15, marginBottom: 8 }}>Your music, ready when you are</div>
          <div style={{ fontSize: 13, color: "var(--nv-text)", lineHeight: 1.55, opacity: 0.85, marginBottom: 14 }}>{tracks.length} track{tracks.length === 1 ? "" : "s"} in your library.</div>
          <button onClick={pick} style={{ padding: "9px 18px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: "var(--nv-text-strong)" }}>+ Add music</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 18, color: "var(--nv-text-strong)" }}>Recently added</div>
        <button onClick={() => setView("library")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontFamily: FFB, fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Show all</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
        {recent.map(t => {
          const isCurrent = cur?.id === t.id;
          return (
            <button key={t.id} onClick={() => startWithTrack(t.id)} className="sr" style={{ display: "flex", flexDirection: "column", gap: 9, padding: 10, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 11, cursor: "pointer", textAlign: "left", fontFamily: FF, color: "var(--nv-text)" }}>
              <div style={{ aspectRatio: "1/1", borderRadius: 8, background: trackGradient(t.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: "0 6px 20px rgba(0,0,0,0.35)", position: "relative" }}>🎶
                {isCurrent && playing && <div style={{ position: "absolute", bottom: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: AC, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px " + AC }}><EqBars playing color="#000" /></div>}
              </div>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
              <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontFamily: FFM, marginTop: -3 }}>Local file</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LibraryView({ tracks, curId, playing, startWithTrack, addToQueue, removeTrack, duration, fmt, trackGradient, pick, AC }) {
  const [q, setQ] = useState("");
  const shown = q ? tracks.filter(t => t.name.toLowerCase().includes(q.toLowerCase())) : tracks;
  return (
    <div style={{ padding: "24px 24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div><div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Your Library</div><div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3 }}>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</div></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {tracks.length > 0 && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ padding: "7px 12px", borderRadius: 8, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 12.5, outline: "none", width: 150 }} />}
          <button onClick={pick} style={{ padding: "7px 14px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text-strong)" }}>+ Add</button>
        </div>
      </div>
      {tracks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic" }}>No tracks yet<br /><span style={{ fontSize: 11 }}>Drop audio in or hit “Add”.</span></div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 60px 60px", gap: 10, alignItems: "center", padding: "8px 12px", fontFamily: FFB, fontWeight: 700, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid var(--nv-border)", position: "sticky", top: -24, background: "var(--nv-surface-solid)", zIndex: 1 }}>
            <div style={{ textAlign: "center" }}>#</div><div>Title</div><div>Date added</div><div style={{ textAlign: "right" }}>🕐</div><div></div>
          </div>
          {shown.map((t, i) => {
            const isCurrent = t.id === curId;
            return (
              <div key={t.id} onDoubleClick={() => startWithTrack(t.id)} onClick={() => startWithTrack(t.id)} className="sr" style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 60px 60px", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 7, cursor: "pointer", background: isCurrent ? `rgba(${hexRgb(AC)},0.14)` : "transparent" }}>
                <div style={{ textAlign: "center", fontFamily: FFM, fontSize: 11, color: isCurrent ? AC : "var(--nv-text-dim)" }}>{isCurrent && playing ? "♪" : i + 1}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 5, background: trackGradient(t.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎶</div>
                  <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: isCurrent ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div><div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 1 }}>Local file</div></div>
                </div>
                <div style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)" }}>{t.addedAt ? new Date(t.addedAt).toLocaleDateString() : "—"}</div>
                <div style={{ textAlign: "right", fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)" }}>{isCurrent && Number.isFinite(duration) ? fmt(duration) : "—:—"}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); addToQueue(t.id); }} title="Add to queue" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 14, padding: "2px 5px" }}>＋</button>
                  <button className="dl" onClick={e => { e.stopPropagation(); removeTrack(t.id); }} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.5)", fontSize: 13, padding: "2px 5px" }}>✕</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function QueueView({ queueItems, playIds, playPos, playing, jumpTo, removeFromQueue, moveInQueue, clearQueue, trackGradient, AC }) {
  return (
    <div style={{ padding: "24px 24px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
        <div><div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Queue</div><div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3 }}>{queueItems.length === 0 ? "Empty" : queueItems.length + (queueItems.length === 1 ? " track" : " tracks") + " · playing #" + (playPos + 1)}</div></div>
        {queueItems.length > 0 && <button onClick={clearQueue} className="dl" style={{ marginLeft: "auto", padding: "6px 12px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "#ff8b8b" }}>Clear queue</button>}
      </div>
      {queueItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--nv-text-dim)" }}><div style={{ fontSize: 44, opacity: 0.55, marginBottom: 12 }}>📃</div><div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)", marginBottom: 6 }}>Nothing queued</div><div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>Play a track from Your Library, or hit <strong style={{ color: "var(--nv-text)" }}>+</strong> on a track.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {queueItems.map((t, pos) => {
            const isCurrent = pos === playPos;
            return (
              <div key={pos + "-" + t.id} onClick={() => jumpTo(pos)} style={{ display: "grid", gridTemplateColumns: "30px 1fr 90px", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 7, cursor: "pointer", background: isCurrent ? `rgba(${hexRgb(AC)},0.14)` : "transparent", border: "1px solid " + (isCurrent ? `rgba(${hexRgb(AC)},0.35)` : "transparent") }}>
                <div style={{ textAlign: "center", fontFamily: FFM, fontSize: 11, color: isCurrent ? AC : "var(--nv-text-dim)" }}>{isCurrent && playing ? "♪" : pos + 1}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 5, background: trackGradient(t.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🎶</div>
                  <div style={{ minWidth: 0 }}><div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: isCurrent ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div><div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 1 }}>{pos < playPos ? "Played" : pos === playPos ? "Playing" : "Up next"}</div></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 3 }}>
                  <button onClick={e => { e.stopPropagation(); moveInQueue(pos, -1); }} disabled={pos === 0} title="Up" style={qBtn(pos !== 0)}>↑</button>
                  <button onClick={e => { e.stopPropagation(); moveInQueue(pos, 1); }} disabled={pos === playIds.length - 1} title="Down" style={qBtn(pos !== playIds.length - 1)}>↓</button>
                  <button className="dl" onClick={e => { e.stopPropagation(); removeFromQueue(pos); }} title="Remove" style={{ ...qBtn(true), color: "rgba(255,80,80,0.5)" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MixerView({ eq, setEq, vocal, setVocal, AC }) {
  const set = (k, v) => setEq(p => ({ ...p, [k]: v }));
  const presets = [
    { id: "flat", label: "Flat", eq: { bass: 0, mid: 0, treble: 0, preamp: 1 }, vocal: false },
    { id: "bass", label: "Bass Boost", eq: { bass: 9, mid: 0, treble: -1, preamp: 1 }, vocal: false },
    { id: "vocal", label: "Vocal Boost", eq: { bass: -2, mid: 5, treble: 2, preamp: 1 }, vocal: false },
    { id: "treble", label: "Treble", eq: { bass: -1, mid: 0, treble: 8, preamp: 1 }, vocal: false },
    { id: "lofi", label: "Lo-Fi", eq: { bass: 5, mid: -2, treble: -9, preamp: 1 }, vocal: false },
    { id: "karaoke", label: "Karaoke", eq: { bass: 2, mid: -3, treble: 1, preamp: 1.1 }, vocal: true },
  ];
  const band = (k, label, min, max, step, fmtv) => (
    <div key={k} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: FFB, fontWeight: 700, color: "var(--nv-text-strong)" }}>{label}</span>
        <span style={{ fontFamily: FFM, color: "var(--nv-text-dim)" }}>{fmtv(eq[k])}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={eq[k]} onChange={e => set(k, +e.target.value)} style={{ width: "100%", accentColor: AC }} />
    </div>
  );
  const db = v => (v > 0 ? "+" : "") + v + " dB";
  return (
    <div style={{ padding: "24px 24px 28px", maxWidth: 580 }}>
      <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)" }}>Mixer / EQ</div>
      <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3, marginBottom: 18 }}>Shape your sound in real time — it affects playback and the visualizer.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {presets.map(p => <button key={p.id} onClick={() => { setEq(p.eq); setVocal(p.vocal); }} style={{ padding: "7px 13px", borderRadius: 20, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text-strong)", fontFamily: FFB, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{p.label}</button>)}
      </div>
      {band("bass", "Bass", -12, 12, 1, db)}
      {band("mid", "Mids", -12, 12, 1, db)}
      {band("treble", "Treble", -12, 12, 1, db)}
      {band("preamp", "Preamp", 0.5, 2, 0.05, v => Math.round(v * 100) + "%")}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 16px", marginTop: 8, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12 }}>
        <div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)" }}>Vocal remover (Karaoke)</div>
          <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginTop: 2, lineHeight: 1.45, maxWidth: 380 }}>Cancels center-panned audio to strip most lead vocals. Collapses to mono and can dim centered bass/drums — it's an effect, not perfect isolation.</div>
        </div>
        <button onClick={() => setVocal(v => !v)} title={vocal ? "On" : "Off"} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: vocal ? AC : "var(--nv-border-strong)", position: "relative", flexShrink: 0, transition: "background 0.15s" }}>
          <span style={{ position: "absolute", top: 3, left: vocal ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
        </button>
      </div>
    </div>
  );
}
function MixerGlyph() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" /></svg>); }

function EqBars({ playing, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 13, flexShrink: 0 }}>
      {[0, 1, 2].map(i => <span key={i} style={{ width: 3, borderRadius: 1.5, background: color, height: playing ? 11 : 4, animation: playing ? `nm-eq 0.85s ${i * 0.16}s ease-in-out infinite` : "none" }} />)}
    </span>
  );
}
function qBtn(enabled) { return { width: 24, height: 24, borderRadius: 5, background: "transparent", border: "none", cursor: enabled ? "pointer" : "default", color: enabled ? "var(--nv-text-dim)" : "rgba(255,255,255,0.15)", fontSize: 12, fontFamily: FFB, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }; }
function RailItem({ ac, active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} className="sr" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, background: active ? fill(ac) : "transparent", border: "1px solid " + (active ? bdr(ac) : "transparent"), cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%" }}>
      <span style={{ display: "flex", flexShrink: 0, width: 18, justifyContent: "center" }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && <span style={{ fontFamily: FFM, fontSize: 10.5, color: active ? ac : "var(--nv-text-dim)", opacity: 0.85, flexShrink: 0 }}>{badge}</span>}
    </button>
  );
}
function transportBtn(enabled) { return { width: 36, height: 36, borderRadius: 18, background: "transparent", border: "1px solid var(--nv-border)", cursor: enabled ? "pointer" : "default", color: enabled ? "var(--nv-text-strong)" : "var(--nv-text-dim)", fontSize: 13, opacity: enabled ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }; }
function playBtn(enabled) { return { width: 44, height: 44, borderRadius: 22, background: enabled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.1)", border: "none", cursor: enabled ? "pointer" : "default", color: "#111", fontSize: 15, opacity: enabled ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: enabled ? "0 4px 14px rgba(0,0,0,0.3)" : "none", transition: "all 0.15s" }; }
function modeBtn(active, ac) { return { width: 32, height: 32, borderRadius: 16, background: active ? `rgba(${hexRgb(ac)},0.18)` : "transparent", border: "1px solid " + (active ? bdr(ac) : "var(--nv-border)"), cursor: "pointer", color: active ? ac : "var(--nv-text-dim)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }; }

function HomeGlyph() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></svg>); }
function LibraryGlyph() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M4 4h3v16H4zM10 4h3v16h-3zM16 6l4 14-3 1L13 7z" /></svg>); }
function QueueGlyph() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M3 6h13M3 12h13M3 18h9M21 8l-4 4 4 4" /></svg>); }
function ShuffleGlyph() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>); }
function RepeatGlyph({ mode }) {
  if (mode === "one") return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" /><text x="12" y="14.5" fontSize="6.5" fontFamily="sans-serif" fontWeight="800" textAnchor="middle" stroke="none" fill="currentColor">1</text></svg>);
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" /></svg>);
}

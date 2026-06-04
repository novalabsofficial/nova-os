import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";

// v9.2 — Music rebuilt as a real desktop music player (Spotify reference).
// v9.5 — Shuffle, repeat (off / all / one), and an explicit Queue view.
//
// Layout:
//   ┌──────────┬──────────────────────────┐
//   │ sidebar  │ main content (per view)  │
//   ├──────────┴──────────────────────────┤
//   │ persistent now-playing bar          │
//   └─────────────────────────────────────┘
//
// Playback model (v9.5)
// ─────────────────────
//   `tracks`    — every imported audio file. Indexed by id.
//   `playIds`   — the active play queue, ordered. Each entry is a track id.
//                 When you double-click a track in the library, playIds is
//                 rebuilt: [clicked, …rest-of-library] (or shuffled if
//                 shuffle is on). When you "Add to queue", the track id
//                 appends to playIds.
//   `playPos`   — index into playIds for the currently playing track.
//
// "Next" rule:
//   • repeat === "one"  → keep playPos (audio element replays).
//   • shuffle on        → pick a random un-played position; if all played,
//                         shuffle again (only if repeat === "all"), else stop.
//   • else              → playPos + 1; if past end, wrap when repeat === "all",
//                         otherwise stop.

import { novaConfirm } from "../ui/dialogs.jsx";

export function MusicApp({ AC, showToast }) {
  // ── State ─────────────────────────────────────────────────────────────
  const [tracks, setTracks] = useState([]);          // [{ id, name, url, size, addedAt }]
  const [playIds, setPlayIds] = useState([]);        // ordered list of track ids — the queue
  const [playPos, setPlayPos] = useState(-1);        // index into playIds
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume]     = useState(0.8);
  const [shuffle, setShuffle]   = useState(false);
  const [repeat, setRepeat]     = useState("off");   // "off" | "all" | "one"
  const [view, setView]         = useState("home");  // "home" | "library" | "queue"
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  // Derived: the currently-playing track object.
  const curId = playPos >= 0 ? playIds[playPos] : null;
  const cur = curId ? tracks.find(t => t.id === curId) : null;

  // Wire volume to the audio element.
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  // Free blob URLs on unmount.
  useEffect(() => () => { tracks.forEach(t => URL.revokeObjectURL(t.url)); }, []); // eslint-disable-line

  // ── Track management ──────────────────────────────────────────────────
  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const audioFiles = files.filter(f => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name));
    if (audioFiles.length === 0) { showToast?.("No audio files selected"); return; }
    const now = Date.now();
    const next = audioFiles.map((f, i) => ({ id: now + i, name: f.name, url: URL.createObjectURL(f), size: f.size, addedAt: now + i }));
    setTracks(prev => {
      const combined = [...prev, ...next];
      // If nothing was queued yet, queue up the new imports so the first
      // play starts on something the user just added.
      if (playIds.length === 0) {
        setPlayIds(next.map(t => t.id));
        setPlayPos(prev2 => prev2 < 0 ? 0 : prev2);
      }
      return combined;
    });
    e.target.value = "";
    showToast?.(audioFiles.length + " track" + (audioFiles.length === 1 ? "" : "s") + " added");
  }
  function removeTrack(id) {
    const removed = tracks.find(t => t.id === id);
    if (removed) URL.revokeObjectURL(removed.url);
    setTracks(prev => prev.filter(t => t.id !== id));
    // Drop the id from the queue, adjust playPos if it slides.
    setPlayIds(prev => {
      const pos = prev.indexOf(id);
      if (pos === -1) return prev;
      const next = prev.filter(x => x !== id);
      if (pos === playPos) { setPlayPos(-1); setPlaying(false); }
      else if (pos < playPos) setPlayPos(p => p - 1);
      return next;
    });
  }

  // ── Queue management ──────────────────────────────────────────────────
  /** Build a fresh queue from a starting track, honoring the shuffle toggle. */
  function startWithTrack(id) {
    const lib = tracks.map(t => t.id);
    if (lib.length === 0) return;
    const startIdx = lib.indexOf(id);
    if (startIdx === -1) return;
    let order;
    if (shuffle) {
      const rest = lib.filter(x => x !== id);
      shuffleArray(rest);
      order = [id, ...rest];
    } else {
      order = [...lib.slice(startIdx), ...lib.slice(0, startIdx)];
    }
    setPlayIds(order);
    setPlayPos(0);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
  }
  function addToQueue(id) {
    setPlayIds(prev => {
      const next = [...prev, id];
      // If nothing was playing, start with this one.
      if (playPos < 0) { setPlayPos(0); setTimeout(() => audioRef.current?.play().catch(() => {}), 0); }
      return next;
    });
    showToast?.("Added to queue");
  }
  function removeFromQueue(pos) {
    if (pos === playPos) {
      // Trying to remove the currently playing track — advance instead.
      next();
      // (next() handles the playPos shift; remove the now-stale entry below)
    }
    setPlayIds(prev => {
      const out = [...prev];
      out.splice(pos, 1);
      if (pos < playPos) setPlayPos(p => p - 1);
      return out;
    });
  }
  function moveInQueue(pos, delta) {
    setPlayIds(prev => {
      const out = [...prev];
      const target = pos + delta;
      if (target < 0 || target >= out.length) return prev;
      [out[pos], out[target]] = [out[target], out[pos]];
      if (pos === playPos) setPlayPos(target);
      else if (target === playPos) setPlayPos(pos);
      return out;
    });
  }
  async function clearQueue() {
    if (!(await novaConfirm({ title: "Clear queue", message: "Clear the queue? The currently playing track stays.", confirmText: "Clear queue", accent: AC }))) return;
    setPlayIds(curId ? [curId] : []);
    setPlayPos(curId ? 0 : -1);
  }

  // Toggle shuffle. Reshuffles the *rest* of the queue while keeping the
  // currently-playing track at its current position — feels more natural
  // than re-shuffling the whole list and losing your place.
  function toggleShuffle() {
    setShuffle(s => {
      const next = !s;
      if (next && playIds.length > 1 && playPos >= 0) {
        const head = playIds.slice(0, playPos + 1);
        const tail = playIds.slice(playPos + 1);
        shuffleArray(tail);
        setPlayIds([...head, ...tail]);
      }
      return next;
    });
  }
  function cycleRepeat() {
    setRepeat(r => r === "off" ? "all" : r === "all" ? "one" : "off");
  }

  // ── Playback controls ─────────────────────────────────────────────────
  function togglePlay() {
    if (playPos < 0) {
      // Nothing queued — start with the first library track.
      if (tracks.length > 0) startWithTrack(tracks[0].id);
      return;
    }
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play().catch(() => {});
  }
  function prev() {
    if (playPos > 0) {
      setPlayPos(p => p - 1);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
    } else if (audioRef.current && audioRef.current.currentTime > 3) {
      // > 3s into the track: jump to the start rather than going back a track.
      audioRef.current.currentTime = 0;
    }
  }
  function next() {
    if (playPos < 0 || playIds.length === 0) return;
    if (repeat === "one") {
      // "Repeat one" only kicks in on the natural end-of-track, not on
      // manually pressing next — pressing next should still advance.
      // Fall through to the normal logic.
    }
    const nextPos = playPos + 1;
    if (nextPos < playIds.length) {
      setPlayPos(nextPos);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
    } else if (repeat === "all") {
      setPlayPos(0);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
    } else {
      setPlaying(false);
    }
  }
  function jumpTo(pos) {
    if (pos < 0 || pos >= playIds.length) return;
    setPlayPos(pos);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
  }

  function onTrackEnded() {
    if (repeat === "one") {
      // Replay the current track from the top.
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
      return;
    }
    next();
  }
  function seek(e) {
    const el = audioRef.current; if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
  }

  // ── Formatting ────────────────────────────────────────────────────────
  function fmt(s) {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + String(sec).padStart(2, "0");
  }
  function trackGradient(name) {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const a = h % 360, b = (h >> 8) % 360;
    return `linear-gradient(135deg, hsl(${a},65%,38%), hsl(${b},58%,22%))`;
  }

  const progPct = duration > 0 ? (progress / duration) * 100 : 0;
  const recent = [...tracks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 6);
  // Items in the queue, expanded to track objects for rendering.
  const queueItems = playIds.map(id => tracks.find(t => t.id === id)).filter(Boolean);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* TOP — sidebar + main content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* ───── SIDEBAR ───── */}
        <div style={{
          width: 208, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
          padding: "16px 10px", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 2,
          background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{ padding: "2px 10px 14px", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 22 }}>🎵</span>
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Nova Music</div>
              <div style={{ fontSize: 9.5, color: "var(--nv-text-dim)", letterSpacing: 0.5 }}>Your library</div>
            </div>
          </div>

          <RailItem ac={AC} active={view === "home"}    onClick={() => setView("home")}    icon={<HomeGlyph />}    label="Home" />
          <RailItem ac={AC} active={view === "library"} onClick={() => setView("library")} icon={<LibraryGlyph />} label="Your Library" badge={tracks.length || null} />
          <RailItem ac={AC} active={view === "queue"}   onClick={() => setView("queue")}   icon={<QueueGlyph />}   label="Queue" badge={queueItems.length || null} />

          <div style={{ height: 12 }} />
          <input ref={inputRef} type="file" accept="audio/*" multiple onChange={handleFiles} style={{ display: "none" }} />
          <button onClick={() => inputRef.current?.click()} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
            background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8,
            cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC,
          }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            Add files
          </button>
          <div style={{ padding: "8px 10px 0", fontSize: 9.5, color: "var(--nv-text-dim)", lineHeight: 1.55 }}>
            MP3, WAV, OGG, M4A, FLAC. Tracks live for this session.
          </div>
        </div>

        {/* ───── MAIN CONTENT ───── */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {view === "home" && (
            <HomeView
              tracks={tracks} recent={recent}
              cur={cur} playing={playing}
              startWithTrack={startWithTrack}
              addToQueue={addToQueue}
              setView={setView}
              inputRef={inputRef}
              trackGradient={trackGradient}
              AC={AC}
            />
          )}

          {view === "library" && (
            <LibraryView
              tracks={tracks} cur={cur} curId={curId} playing={playing}
              startWithTrack={startWithTrack} addToQueue={addToQueue}
              removeTrack={removeTrack}
              duration={duration} fmt={fmt}
              trackGradient={trackGradient}
              inputRef={inputRef}
              AC={AC}
            />
          )}

          {view === "queue" && (
            <QueueView
              queueItems={queueItems} playIds={playIds} playPos={playPos}
              tracks={tracks} cur={cur} curId={curId} playing={playing}
              jumpTo={jumpTo} removeFromQueue={removeFromQueue} moveInQueue={moveInQueue}
              clearQueue={clearQueue}
              trackGradient={trackGradient}
              AC={AC}
            />
          )}
        </div>
      </div>

      {/* ───── PERSISTENT NOW-PLAYING BAR ───── */}
      <div style={{
        flexShrink: 0, height: 86,
        borderTop: "1px solid var(--nv-border)",
        background: "var(--nv-surface-solid)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Progress bar */}
        <div onClick={seek} style={{ height: 4, background: "rgba(255,255,255,0.06)", cursor: cur ? "pointer" : "default", position: "relative" }}>
          <div style={{ height: "100%", width: progPct + "%", background: AC, transition: "width 0.1s linear", boxShadow: cur ? `0 0 8px ${AC}` : "none" }} />
        </div>

        {/* Player row */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "0 18px" }}>
          {/* LEFT — current track info */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "1 1 0", minWidth: 0 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 7,
              background: cur ? trackGradient(cur.name) : "rgba(255,255,255,0.05)",
              border: "1px solid var(--nv-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0,
              boxShadow: cur ? "0 4px 14px rgba(0,0,0,0.4)" : "none",
            }}>{cur ? "🎶" : "🎵"}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur ? cur.name : "Nothing playing"}</div>
              <div style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 2 }}>{cur ? fmt(progress) + " / " + fmt(duration) : "Add files to start"}</div>
            </div>
          </div>

          {/* CENTER — shuffle + transport + repeat */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={toggleShuffle} title={shuffle ? "Shuffle on" : "Shuffle off"} style={modeBtn(shuffle, AC)}>
              <ShuffleGlyph/>
            </button>
            <button onClick={prev} disabled={playPos <= 0 && (audioRef.current?.currentTime || 0) < 3} title="Previous" style={transportBtn(true)}>⏮</button>
            <button onClick={togglePlay} disabled={tracks.length === 0} title={playing ? "Pause" : "Play"} style={playBtn(AC, tracks.length > 0)}>{playing ? "⏸" : "▶"}</button>
            <button onClick={next} disabled={playPos < 0 || (playPos >= playIds.length - 1 && repeat !== "all")} title="Next" style={transportBtn(true)}>⏭</button>
            <button onClick={cycleRepeat} title={"Repeat: " + repeat} style={modeBtn(repeat !== "off", AC)}>
              <RepeatGlyph mode={repeat}/>
            </button>
          </div>

          {/* RIGHT — volume */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 0", justifyContent: "flex-end", minWidth: 0 }}>
            {/* Queue jump button — visible only when there's more than one queued */}
            {playIds.length > 1 && (
              <button onClick={() => setView("queue")} title="Open queue" style={{
                padding: "5px 9px", borderRadius: 6, cursor: "pointer",
                background: view === "queue" ? fill(AC) : "var(--nv-elevated)",
                border: "1px solid " + (view === "queue" ? bdr(AC) : "var(--nv-border)"),
                color: view === "queue" ? AC : "var(--nv-text)",
                fontFamily: FFB, fontSize: 11, display: "flex", alignItems: "center", gap: 5,
              }}>
                <QueueGlyph small/> {playIds.length}
              </button>
            )}
            <span style={{ fontSize: 14, color: "var(--nv-text-dim)", flexShrink: 0 }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={volume} onChange={e => setVolume(+e.target.value)}
              style={{ flex: "1 1 0", minWidth: 40, maxWidth: 130, accentColor: AC }}
              title={Math.round(volume * 100) + "%"}
            />
          </div>
        </div>
      </div>

      {/* Audio element */}
      {cur && <audio
        ref={audioRef}
        src={cur.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={e => setProgress(e.currentTarget.currentTime)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
        onEnded={onTrackEnded}
      />}
    </div>
  );
}

// ── small array shuffler (Fisher-Yates) ─────────────────────────────────
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ───────────────────────── Views ────────────────────────────────────────

function HomeView({ tracks, recent, cur, playing, startWithTrack, addToQueue, setView, inputRef, trackGradient, AC }) {
  return (
    <div style={{ padding: "28px 28px 24px" }}>
      <div style={{
        background: `linear-gradient(135deg, rgba(${hexRgb(AC)},0.35), rgba(${hexRgb(AC)},0.06))`,
        border: "1px solid " + bdr(AC), borderRadius: 16,
        padding: "26px 28px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        overflow: "hidden",
      }}>
        <div style={{ width: 88, height: 88, borderRadius: 14, background: fill(AC), border: "1px solid " + bdr(AC), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>🎵</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FFM, fontSize: 11, color: AC, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{tracks.length === 0 ? "Get started" : "Welcome back"}</div>
          <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: "clamp(17px, 3vw, 26px)", color: "var(--nv-text-strong)", lineHeight: 1.15, marginBottom: 8, wordBreak: "break-word" }}>
            {tracks.length === 0 ? "Add your music to begin" : "Your music, ready when you are"}
          </div>
          <div style={{ fontSize: 13, color: "var(--nv-text)", lineHeight: 1.55, opacity: 0.85, marginBottom: 14, wordBreak: "break-word" }}>
            {tracks.length === 0
              ? "Pull in audio files from your device — MP3, WAV, OGG, M4A all work. They stay in this session."
              : tracks.length + " track" + (tracks.length === 1 ? "" : "s") + " in your library."}
          </div>
          <button onClick={() => inputRef.current?.click()} style={{ padding: "9px 18px", background: "rgba(255,255,255,0.95)", border: "none", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: "#111", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
            + Add music
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
            <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 18, color: "var(--nv-text-strong)" }}>Recently added</div>
            <button onClick={() => setView("library")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontFamily: FFB, fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Show all</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
            {recent.map(t => {
              const isCurrent = cur?.id === t.id;
              return (
                <button key={t.id} onClick={() => startWithTrack(t.id)} style={{
                  display: "flex", flexDirection: "column", gap: 9, padding: 10,
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--nv-border)",
                  borderRadius: 11, cursor: "pointer", textAlign: "left", fontFamily: FF,
                  color: "var(--nv-text)", transition: "background 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}>
                  <div style={{
                    aspectRatio: "1 / 1", borderRadius: 8, background: trackGradient(t.name),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30, color: "rgba(255,255,255,0.85)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                    position: "relative", overflow: "hidden",
                  }}>
                    🎶
                    {isCurrent && playing && (
                      <div style={{ position: "absolute", bottom: 6, right: 6, width: 20, height: 20, borderRadius: "50%", background: AC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000", boxShadow: "0 0 12px " + AC }}>▶</div>
                    )}
                  </div>
                  <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontFamily: FFM, marginTop: -3 }}>Local file</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LibraryView({ tracks, cur, curId, playing, startWithTrack, addToQueue, removeTrack, duration, fmt, trackGradient, inputRef, AC }) {
  return (
    <div style={{ padding: "24px 24px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Your Library</div>
          <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3 }}>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</div>
        </div>
        <button onClick={() => inputRef.current?.click()} style={{ marginLeft: "auto", padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text-strong)" }}>+ Add files</button>
      </div>

      {tracks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic" }}>
          No tracks yet<br /><span style={{ fontSize: 11 }}>Use "Add files" to bring in audio from your device</span>
        </div>
      ) : (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "36px 1fr 110px 60px 36px",
            gap: 10, alignItems: "center",
            padding: "8px 12px",
            fontFamily: FFB, fontWeight: 700, fontSize: 10, color: "var(--nv-text-dim)",
            letterSpacing: 1, textTransform: "uppercase",
            borderBottom: "1px solid var(--nv-border)",
            position: "sticky", top: -24, background: "var(--nv-surface-solid)",
            zIndex: 1,
          }}>
            <div style={{ textAlign: "center" }}>#</div>
            <div>Title</div>
            <div>Date added</div>
            <div style={{ textAlign: "right" }}>🕐</div>
            <div></div>
          </div>
          {tracks.map((t, i) => {
            const isCurrent = t.id === curId;
            return (
              <div key={t.id} onDoubleClick={() => startWithTrack(t.id)} onClick={() => startWithTrack(t.id)} className="sr" style={{
                display: "grid", gridTemplateColumns: "36px 1fr 110px 60px 36px",
                gap: 10, alignItems: "center",
                padding: "8px 12px", borderRadius: 7, cursor: "pointer",
                background: isCurrent ? `rgba(${hexRgb(AC)},0.14)` : "transparent",
                transition: "background 0.12s",
              }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.045)"; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ textAlign: "center", fontFamily: FFM, fontSize: 11, color: isCurrent ? AC : "var(--nv-text-dim)" }}>
                  {isCurrent && playing ? "▶" : i + 1}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 5, background: trackGradient(t.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎶</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: isCurrent ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 1 }}>Local file</div>
                  </div>
                </div>
                <div style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)" }}>
                  {t.addedAt ? new Date(t.addedAt).toLocaleDateString() : "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)" }}>
                    {isCurrent && Number.isFinite(duration) ? fmt(duration) : "—:—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); addToQueue(t.id); }} title="Add to queue" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 14, padding: "2px 5px" }}>＋</button>
                  <button className="dl" onClick={e => { e.stopPropagation(); removeTrack(t.id); }} title="Remove from library" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.45)", fontSize: 13, padding: "2px 5px" }}>✕</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function QueueView({ queueItems, playIds, playPos, cur, curId, playing, jumpTo, removeFromQueue, moveInQueue, clearQueue, trackGradient, AC }) {
  return (
    <div style={{ padding: "24px 24px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Queue</div>
          <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3 }}>
            {queueItems.length === 0 ? "Empty" : queueItems.length + (queueItems.length === 1 ? " track" : " tracks") + " · playing #" + (playPos + 1)}
          </div>
        </div>
        {queueItems.length > 0 && (
          <button onClick={clearQueue} className="dl" style={{ marginLeft: "auto", padding: "6px 12px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "#ff8b8b" }}>Clear queue</button>
        )}
      </div>

      {queueItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--nv-text-dim)" }}>
          <div style={{ fontSize: 44, opacity: 0.55, marginBottom: 12 }}>📃</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)", marginBottom: 6 }}>Nothing queued</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>Pick a track from Your Library to start playing, or hit the <strong style={{ color: "var(--nv-text)" }}>+</strong> on a track to add it to the queue.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {queueItems.map((t, pos) => {
            const isCurrent = pos === playPos;
            return (
              <div key={pos + "-" + t.id} style={{
                display: "grid", gridTemplateColumns: "30px 1fr 90px",
                gap: 10, alignItems: "center", padding: "8px 12px",
                borderRadius: 7, cursor: "pointer",
                background: isCurrent ? `rgba(${hexRgb(AC)},0.14)` : "transparent",
                border: "1px solid " + (isCurrent ? `rgba(${hexRgb(AC)},0.35)` : "transparent"),
                transition: "background 0.12s",
              }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.045)"; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                onClick={() => jumpTo(pos)}
              >
                <div style={{ textAlign: "center", fontFamily: FFM, fontSize: 11, color: isCurrent ? AC : "var(--nv-text-dim)" }}>
                  {isCurrent && playing ? "▶" : pos + 1}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 5, background: trackGradient(t.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🎶</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: isCurrent ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 1 }}>
                      {pos < playPos ? "Played" : pos === playPos ? "Playing" : "Up next"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 3 }}>
                  <button onClick={e => { e.stopPropagation(); moveInQueue(pos, -1); }} disabled={pos === 0} title="Move up" style={qBtn(pos !== 0)}>↑</button>
                  <button onClick={e => { e.stopPropagation(); moveInQueue(pos, 1); }} disabled={pos === playIds.length - 1} title="Move down" style={qBtn(pos !== playIds.length - 1)}>↓</button>
                  <button className="dl" onClick={e => { e.stopPropagation(); removeFromQueue(pos); }} title="Remove from queue" style={{ ...qBtn(true), color: "rgba(255,80,80,0.45)" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function qBtn(enabled) {
  return {
    width: 24, height: 24, borderRadius: 5,
    background: "transparent", border: "none",
    cursor: enabled ? "pointer" : "default",
    color: enabled ? "var(--nv-text-dim)" : "rgba(255,255,255,0.15)",
    fontSize: 12, fontFamily: FFB,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  };
}

// ── Sidebar rail item ───────────────────────────────────────────────────
function RailItem({ ac, active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8,
      background: active ? fill(ac) : "transparent",
      border: "1px solid " + (active ? bdr(ac) : "transparent"),
      cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
      color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%",
      transition: "background 0.12s, color 0.12s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && <span style={{ fontFamily: FFM, fontSize: 10.5, color: active ? ac : "var(--nv-text-dim)", opacity: 0.85, flexShrink: 0 }}>{badge}</span>}
    </button>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────
function transportBtn(enabled) {
  return {
    width: 36, height: 36, borderRadius: 18,
    background: "transparent", border: "1px solid var(--nv-border)",
    cursor: enabled ? "pointer" : "default",
    color: enabled ? "var(--nv-text-strong)" : "var(--nv-text-dim)",
    fontSize: 13, opacity: enabled ? 1 : 0.4,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  };
}
function playBtn(ac, enabled) {
  return {
    width: 44, height: 44, borderRadius: 22,
    background: enabled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.1)",
    border: "none",
    cursor: enabled ? "pointer" : "default",
    color: "#111",
    fontSize: 15, opacity: enabled ? 1 : 0.4,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: enabled ? "0 4px 14px rgba(0,0,0,0.3)" : "none",
    transition: "all 0.15s",
  };
}
function modeBtn(active, ac) {
  return {
    width: 32, height: 32, borderRadius: 16,
    background: active ? `rgba(${hexRgb(ac)},0.18)` : "transparent",
    border: "1px solid " + (active ? bdr(ac) : "var(--nv-border)"),
    cursor: "pointer",
    color: active ? ac : "var(--nv-text-dim)",
    fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  };
}

// ── Glyphs ──────────────────────────────────────────────────────────────
function HomeGlyph() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></svg>);
}
function LibraryGlyph() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M4 4h3v16H4zM10 4h3v16h-3zM16 6l4 14-3 1L13 7z" /></svg>);
}
function QueueGlyph({ small } = {}) {
  const s = small ? 13 : 18;
  return (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M3 6h13M3 12h13M3 18h9M21 8l-4 4 4 4"/></svg>);
}
function ShuffleGlyph() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>);
}
function RepeatGlyph({ mode }) {
  // "one" gets a small "1" overlay; "all"/"off" share the loop arrows.
  if (mode === "one") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
        <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
        <text x="12" y="14.5" fontSize="6.5" fontFamily="sans-serif" fontWeight="800" textAnchor="middle" stroke="none" fill="currentColor">1</text>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";

// v9.2 — Music rebuilt to feel like a real desktop music player (Spotify
// as the reference). Three-zone layout:
//
//   ┌──────────┬──────────────────────────┐
//   │ sidebar  │ main content (per view)  │
//   ├──────────┴──────────────────────────┤
//   │ persistent now-playing bar          │
//   └─────────────────────────────────────┘
//
// The now-playing bar sits at the bottom of the window for the lifetime of
// the app — playback state and the audio element live up here in the
// MusicApp component, not inside any view, so switching between Home and
// Library never interrupts what's playing.
//
// Tracks are loaded from the user's device via file picker; they live as
// blob URLs for the session (local-file *persistence* is deferred — see
// IDEAS.md for the "real music library" follow-up).

export function MusicApp({ AC, showToast }) {
  // ── State ─────────────────────────────────────────────────────────────
  const [tracks, setTracks] = useState([]);          // [{ id, name, url, size, addedAt }]
  const [idx, setIdx]       = useState(-1);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume]     = useState(0.8);
  const [view, setView]         = useState("home"); // "home" | "library"
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  // Wire volume to the audio element.
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  // Free blob URLs when the app unmounts.
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
      if (idx < 0) setIdx(prev.length); // queue up the first imported track if nothing was playing
      return combined;
    });
    e.target.value = "";
    showToast?.(audioFiles.length + " track" + (audioFiles.length === 1 ? "" : "s") + " added");
  }
  function removeTrack(i) {
    setTracks(prev => {
      const copy = [...prev];
      const removed = copy.splice(i, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      return copy;
    });
    if (i === idx) { setIdx(-1); setPlaying(false); }
    else if (i < idx) setIdx(idx - 1);
  }

  // ── Playback controls ─────────────────────────────────────────────────
  function playAt(i) {
    if (i < 0 || i >= tracks.length) return;
    setIdx(i);
    // play() must be invoked after a user gesture; this is one.
    setTimeout(() => { audioRef.current?.play().catch(() => {}); }, 0);
  }
  function togglePlay() {
    if (idx < 0) { if (tracks.length > 0) playAt(0); return; }
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play().catch(() => {});
  }
  function prev() { if (idx > 0) playAt(idx - 1); }
  function next() { if (idx >= 0 && idx < tracks.length - 1) playAt(idx + 1); }
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

  const cur = idx >= 0 ? tracks[idx] : null;
  const progPct = duration > 0 ? (progress / duration) * 100 : 0;

  // Build "Recently Added" view (last 6, most recent first).
  const recent = [...tracks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 6);

  // Render a gradient "album-art" tile for tracks (we don't have real artwork
  // — derive a stable gradient from the track name hash so each track gets a
  // distinct, repeatable color).
  function trackGradient(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const a = h % 360, b = (h >> 8) % 360;
    return `linear-gradient(135deg, hsl(${a},65%,38%), hsl(${b},58%,22%))`;
  }

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
            <div style={{ padding: "28px 28px 24px" }}>
              {/* Hero */}
              <div style={{
                background: `linear-gradient(135deg, rgba(${hexRgb(AC)},0.35), rgba(${hexRgb(AC)},0.06))`,
                border: "1px solid " + bdr(AC), borderRadius: 16,
                padding: "26px 28px", marginBottom: 24,
                display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
              }}>
                <div style={{ width: 88, height: 88, borderRadius: 14, background: fill(AC), border: "1px solid " + bdr(AC), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>🎵</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: FFM, fontSize: 11, color: AC, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{tracks.length === 0 ? "Get started" : "Welcome back"}</div>
                  <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 26, color: "var(--nv-text-strong)", lineHeight: 1.1, marginBottom: 8 }}>
                    {tracks.length === 0 ? "Add your music to begin" : "Your music, ready when you are"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--nv-text)", lineHeight: 1.55, opacity: 0.85, marginBottom: 14 }}>
                    {tracks.length === 0
                      ? "Pull in audio files from your device — MP3, WAV, OGG, M4A all work. They stay in this session."
                      : tracks.length + " track" + (tracks.length === 1 ? "" : "s") + " in your library."}
                  </div>
                  <button onClick={() => inputRef.current?.click()} style={{ padding: "9px 18px", background: "rgba(255,255,255,0.95)", border: "none", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: "#111", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
                    + Add music
                  </button>
                </div>
              </div>

              {/* Recently added */}
              {recent.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
                    <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 18, color: "var(--nv-text-strong)" }}>Recently added</div>
                    <button onClick={() => setView("library")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontFamily: FFB, fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Show all</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                    {recent.map(t => {
                      const i = tracks.indexOf(t);
                      const isCurrent = i === idx;
                      return (
                        <button key={t.id} onClick={() => playAt(i)} style={{
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
          )}

          {view === "library" && (
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
                  No tracks yet<br />
                  <span style={{ fontSize: 11 }}>Use “Add files” to bring in audio from your device</span>
                </div>
              ) : (
                <>
                  {/* Header row */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "36px 1fr 110px 60px",
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
                  </div>
                  {tracks.map((t, i) => {
                    const isCurrent = i === idx;
                    return (
                      <div key={t.id} onClick={() => playAt(i)} className="sr" style={{
                        display: "grid", gridTemplateColumns: "36px 1fr 110px 60px",
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
                          <button className="dl" onClick={e => { e.stopPropagation(); removeTrack(i); }} title="Remove from library" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.45)", fontSize: 13, padding: "2px 5px" }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
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
        {/* Progress bar — thin strip along the top of the bar */}
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
            }}>
              {cur ? "🎶" : "🎵"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur ? cur.name : "Nothing playing"}</div>
              <div style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 2 }}>{cur ? fmt(progress) + " / " + fmt(duration) : "Add files to start"}</div>
            </div>
          </div>

          {/* CENTER — transport controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={prev} disabled={idx <= 0} title="Previous" style={transportBtn(idx > 0)}>⏮</button>
            <button onClick={togglePlay} disabled={tracks.length === 0} title={playing ? "Pause" : "Play"} style={playBtn(AC, tracks.length > 0)}>{playing ? "⏸" : "▶"}</button>
            <button onClick={next} disabled={idx >= tracks.length - 1} title="Next" style={transportBtn(idx >= 0 && idx < tracks.length - 1)}>⏭</button>
          </div>

          {/* RIGHT — volume */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 0", justifyContent: "flex-end", minWidth: 0 }}>
            <span style={{ fontSize: 14, color: "var(--nv-text-dim)" }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={volume} onChange={e => setVolume(+e.target.value)}
              style={{ width: 110, accentColor: AC }}
              title={Math.round(volume * 100) + "%"}
            />
          </div>
        </div>
      </div>

      {/* Audio element — driven by refs. */}
      {cur && <audio
        ref={audioRef}
        src={cur.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={e => setProgress(e.currentTarget.currentTime)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
        onEnded={() => { if (idx < tracks.length - 1) playAt(idx + 1); else setPlaying(false); }}
      />}
    </div>
  );
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

// ── Button helpers for the now-playing bar ──────────────────────────────
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

// ── Sidebar glyphs ──────────────────────────────────────────────────────
function HomeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function LibraryGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M4 4h3v16H4zM10 4h3v16h-3zM16 6l4 14-3 1L13 7z" />
    </svg>
  );
}

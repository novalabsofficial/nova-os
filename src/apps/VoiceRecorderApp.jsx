// v10.10 — Voice Recorder. Captures mic audio via MediaRecorder with a live
// level meter + timer, then lists takes you can play back, download, or
// delete. Recordings live for the session (object URLs); download to keep.
import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

let REC_SEQ = 1;
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

export function VoiceRecorderApp({ AC, showToast }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [recordings, setRecordings] = useState([]); // { id, url, name, dur }
  const [err, setErr] = useState(null);

  const mrRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const acRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);

  const cleanupMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null;
    if (acRef.current) { try { acRef.current.close(); } catch (e) {} acRef.current = null; }
    setLevel(0);
  }, []);

  const stopAll = useCallback(() => {
    clearInterval(timerRef.current);
    cleanupMeter();
    if (mrRef.current && mrRef.current.state !== "inactive") { try { mrRef.current.stop(); } catch (e) {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, [cleanupMeter]);

  useEffect(() => () => stopAll(), [stopAll]);

  const start = async () => {
    setErr(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      setErr("Recording isn't supported on this device."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const id = REC_SEQ++;
        const dur = (Date.now() - startRef.current) / 1000;
        setRecordings((r) => [{ id, url, name: "recording-" + id + ".webm", dur }, ...r]);
        if (showToast) showToast("Recording saved");
      };
      mr.start();
      startRef.current = Date.now();
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 200);

      // level meter
      const AC2 = window.AudioContext || window.webkitAudioContext;
      if (AC2) {
        const ac = new AC2();
        acRef.current = ac;
        const src = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2.2));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      }
    } catch (e) {
      setErr("Couldn't access the microphone — check permissions.");
    }
  };

  const stop = () => {
    clearInterval(timerRef.current);
    cleanupMeter();
    if (mrRef.current && mrRef.current.state !== "inactive") { try { mrRef.current.stop(); } catch (e) {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setRecording(false);
  };

  const remove = (id) => {
    setRecordings((r) => { const hit = r.find((x) => x.id === id); if (hit) URL.revokeObjectURL(hit.url); return r.filter((x) => x.id !== id); });
  };
  const download = (rec) => { const a = document.createElement("a"); a.href = rec.url; a.download = rec.name; a.click(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)", flexShrink: 0 }}>🎙️ Voice Recorder</div>

      {/* recorder */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 18px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 14 }}>
        {err ? (
          <div style={{ color: "#ff8080", fontSize: 13, textAlign: "center" }}>{err}</div>
        ) : (
          <>
            <div style={{ fontFamily: FFM, fontSize: 34, fontWeight: 700, color: recording ? AC : "var(--nv-text-strong)", letterSpacing: 1 }}>{fmt(elapsed)}</div>
            {/* level meter */}
            <div style={{ width: "100%", maxWidth: 280, height: 8, borderRadius: 4, background: "var(--nv-input-bg)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: (recording ? Math.round(level * 100) : 0) + "%", background: AC, borderRadius: 4, transition: "width 0.08s linear" }} />
            </div>
            <button onClick={recording ? stop : start} style={{ width: 72, height: 72, borderRadius: "50%", border: "none", cursor: "pointer", background: recording ? "#ff6b6b" : AC, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px " + (recording ? "rgba(255,107,107,0.4)" : fill(AC)) }}>
              {recording ? <span style={{ width: 22, height: 22, borderRadius: 4, background: "#fff" }} /> : <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff" }} />}
            </button>
            <div style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>{recording ? "Recording… tap to stop" : "Tap to start recording"}</div>
          </>
        )}
      </div>

      {/* recordings list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {recordings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--nv-text-dim)" }}>
            <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>🎧</div>
            <div style={{ fontSize: 13 }}>Your recordings appear here.</div>
          </div>
        ) : recordings.map((rec) => (
          <div key={rec.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "11px 13px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🎵</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)" }}>Recording {rec.id}</div>
                <div style={{ fontSize: 11, color: "var(--nv-text-dim)", fontFamily: FFM }}>{fmt(rec.dur)}</div>
              </div>
              <button onClick={() => download(rec)} title="Download" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--nv-border)", background: "transparent", color: "var(--nv-text)", cursor: "pointer", fontSize: 13 }}>⤓</button>
              <button onClick={() => remove(rec.id)} title="Delete" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--nv-border)", background: "transparent", color: "#ff8080", cursor: "pointer", fontSize: 13 }}>🗑</button>
            </div>
            <audio src={rec.url} controls style={{ width: "100%", height: 34 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

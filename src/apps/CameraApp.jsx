// v10.10 — Camera. Live preview via getUserMedia, snapshot capture (with an
// optional 3s self-timer), front/back switch, mirror toggle, and an in-session
// gallery you can view full-screen, download, or delete. Needs camera
// permission (HTTPS / desktop app); shows a friendly message if unavailable.
import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

let SHOT_SEQ = 1;

export function CameraApp({ AC, showToast }) {
  const [facing, setFacing] = useState("user");
  const [mirror, setMirror] = useState(true);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const [shots, setShots] = useState([]);     // { id, url, name }
  const [viewing, setViewing] = useState(null);
  const [timerSec, setTimerSec] = useState(0); // 0 = off, else 3
  const [countdown, setCountdown] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const cdRef = useRef(null);

  const stop = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  // (re)start the stream whenever the camera side changes
  useEffect(() => {
    let cancelled = false;
    setReady(false); setErr(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr("This device has no accessible camera.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; v.play().then(() => setReady(true)).catch(() => setReady(true)); }
      })
      .catch(() => { if (!cancelled) setErr("Couldn't access the camera — check permissions and that no other app is using it."); });
    return () => { cancelled = true; stop(); };
  }, [facing, stop]);

  useEffect(() => () => { clearInterval(cdRef.current); }, []);

  const snap = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    const w = v.videoWidth, h = v.videoHeight;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const id = SHOT_SEQ++;
      setShots((s) => [{ id, url, name: "nova-photo-" + id + ".png" }, ...s]);
      if (showToast) showToast("Photo captured");
    }, "image/png");
  };

  const capture = () => {
    if (!ready) return;
    if (!timerSec) { snap(); return; }
    let n = timerSec; setCountdown(n);
    cdRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(cdRef.current); setCountdown(null); snap(); }
      else setCountdown(n);
    }, 1000);
  };

  const remove = (id) => {
    setShots((s) => {
      const hit = s.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return s.filter((x) => x.id !== id);
    });
  };
  const download = (shot) => {
    const a = document.createElement("a");
    a.href = shot.url; a.download = shot.name; a.click();
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 0, background: "#000", borderRadius: 14, overflow: "hidden", border: "1px solid var(--nv-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none", display: err ? "none" : "block" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {err && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", padding: 24 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>📷</div>
            <div style={{ fontSize: 13.5, maxWidth: 320, lineHeight: 1.6 }}>{err}</div>
          </div>
        )}
        {!ready && !err && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,0.7)" }}>
            <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Starting camera…</span>
          </div>
        )}
        {countdown != null && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
            <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 90, color: "#fff", textShadow: "0 4px 30px rgba(0,0,0,0.6)" }}>{countdown}</div>
          </div>
        )}
      </div>

      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={() => setMirror((m) => !m)} title="Mirror" style={ctlBtn(mirror, AC)}>🪞</button>
        <button onClick={() => setTimerSec((t) => (t ? 0 : 3))} title="Self-timer" style={ctlBtn(!!timerSec, AC)}>{timerSec ? "3s" : "⏱"}</button>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <button onClick={capture} disabled={!ready} title="Capture" style={{ width: 60, height: 60, borderRadius: "50%", border: "4px solid " + (ready ? AC : "var(--nv-border)"), background: ready ? "#fff" : "var(--nv-elevated)", cursor: ready ? "pointer" : "default", boxShadow: ready ? "0 0 0 3px " + fill(AC) : "none" }} />
        </div>
        <button onClick={() => { setFacing((f) => (f === "user" ? "environment" : "user")); setMirror((m) => !m); }} title="Switch camera" style={ctlBtn(false, AC)}>🔄</button>
        <div style={{ width: 40 }} />
      </div>

      {/* gallery */}
      {shots.length > 0 && (
        <div className="no-sb" style={{ display: "flex", gap: 8, overflowX: "auto", flexShrink: 0, paddingBottom: 2 }}>
          {shots.map((s) => (
            <div key={s.id} style={{ position: "relative", flexShrink: 0 }}>
              <img src={s.url} alt="" onClick={() => setViewing(s)} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 9, border: "1px solid var(--nv-border)", cursor: "pointer" }} />
              <button onClick={() => remove(s.id)} title="Delete" style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%", border: "none", background: "#ff6b6b", color: "#fff", fontSize: 11, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 30, padding: 20 }}>
          <img src={viewing.url} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "78%", borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} />
          <div style={{ display: "flex", gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => download(viewing)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>⤓ Download</button>
            <button onClick={() => { remove(viewing.id); setViewing(null); }} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Delete</button>
            <button onClick={() => setViewing(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ctlBtn(active, AC) {
  return { width: 40, height: 40, borderRadius: 10, border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"), background: active ? fill(AC) : "var(--nv-elevated)", color: active ? AC : "var(--nv-text)", cursor: "pointer", fontSize: 16, fontFamily: FFB, fontWeight: 600, flexShrink: 0 };
}

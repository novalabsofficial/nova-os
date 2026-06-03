import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// v10.9 — QR Codes.
// Generate (qrcode) and scan (jsqr) entirely on-device — no network, no
// external image service. Scanning supports both the live camera and
// uploading an image file (the reliable fallback when no camera / permission).

export function QrApp({ AC, showToast }) {
  const [tab, setTab] = useState("generate");

  // ── generate ──
  const [text, setText] = useState("https://");
  const [dataUrl, setDataUrl] = useState("");
  const [genErr, setGenErr] = useState(null);

  // ── scan ──
  const [scanResult, setScanResult] = useState("");
  const [scanErr, setScanErr] = useState(null);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  // generate QR whenever the text changes
  useEffect(() => {
    const t = text.trim();
    if (!t) { setDataUrl(""); setGenErr(null); return; }
    let alive = true;
    QRCode.toDataURL(t, { width: 320, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b0e16", light: "#ffffff" } })
      .then((url) => { if (alive) { setDataUrl(url); setGenErr(null); } })
      .catch(() => { if (alive) { setGenErr("That content is too long to encode in a QR code."); setDataUrl(""); } });
    return () => { alive = false; };
  }, [text]);

  const stopCam = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCamOn(false);
  };

  const tick = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (v && c && v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
      const w = v.videoWidth, h = v.videoHeight;
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(v, 0, 0, w, h);
      try {
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (code && code.data) { setScanResult(code.data); setScanErr(null); stopCam(); return; }
      } catch (e) {}
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const startCam = async () => {
    setScanErr(null); setScanResult("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanErr("Camera isn't available here. Upload an image instead."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamOn(true);
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setScanErr("Couldn't access the camera — check permissions, or upload an image.");
      setCamOn(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setScanErr(null); setScanResult("");
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const c = canvasRef.current || document.createElement("canvas");
      c.width = im.width; c.height = im.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(im, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, im.width, im.height);
        const code = jsQR(data.data, im.width, im.height);
        if (code && code.data) setScanResult(code.data);
        else setScanErr("No QR code found in that image.");
      } catch (err) { setScanErr("Couldn't read that image."); }
      URL.revokeObjectURL(url);
    };
    im.onerror = () => { setScanErr("Couldn't read that image."); URL.revokeObjectURL(url); };
    im.src = url;
    e.target.value = "";
  };

  useEffect(() => () => stopCam(), []);
  useEffect(() => { if (tab !== "scan") stopCam(); /* eslint-disable-next-line */ }, [tab]);

  const copy = (val) => { try { navigator.clipboard.writeText(val); if (showToast) showToast("Copied to clipboard"); } catch (e) {} };
  const resultIsUrl = /^https?:\/\//i.test((scanResult || "").trim());

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13, background: tab === id ? AC : "transparent", color: tab === id ? "#fff" : "var(--nv-text-dim)" }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 10, padding: 4, flexShrink: 0 }}>
        {tabBtn("generate", "✦ Generate")}
        {tabBtn("scan", "⛶ Scan")}
      </div>

      {/* hidden canvas shared by camera + upload decoding */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {tab === "generate" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter a link, text, Wi-Fi, anything…"
            style={{ width: "100%", height: 84, padding: "12px 14px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)", borderRadius: 12, color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.5, flexShrink: 0 }}
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {dataUrl ? (
              <>
                <div style={{ background: "#fff", padding: 14, borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}>
                  <img src={dataUrl} alt="QR code" width={240} height={240} style={{ display: "block" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={dataUrl} download="nova-qr.png" style={{ padding: "9px 18px", background: AC, borderRadius: 10, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13, textDecoration: "none", cursor: "pointer" }}>⤓ Download PNG</a>
                  <button onClick={() => copy(text)} style={{ padding: "9px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 10, color: AC, fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>⧉ Copy text</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--nv-text-dim)" }}>
                <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>🔳</div>
                <div style={{ fontSize: 14 }}>{genErr || "Type something above to make a QR code."}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", maxHeight: 280, background: "#000", borderRadius: 14, overflow: "hidden", border: "1px solid var(--nv-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: camOn ? "block" : "none" }} />
            {camOn && (
              <div style={{ position: "absolute", inset: "50% auto auto 50%", transform: "translate(-50%,-50%)", width: "55%", aspectRatio: "1", border: "3px solid rgba(255,255,255,0.85)", borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)", pointerEvents: "none" }} />
            )}
            {!camOn && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", padding: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 13 }}>Point your camera at a QR code</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {camOn ? (
              <button onClick={stopCam} style={{ flex: 1, padding: "11px 0", background: "var(--nv-hover)", border: "1px solid var(--nv-border)", borderRadius: 11, color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>■ Stop camera</button>
            ) : (
              <button onClick={startCam} style={{ flex: 1, padding: "11px 0", background: AC, border: "none", borderRadius: 11, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>▶ Start camera</button>
            )}
            <label style={{ flex: 1, padding: "11px 0", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 11, color: AC, fontFamily: FFB, fontWeight: 600, fontSize: 13.5, cursor: "pointer", textAlign: "center" }}>
              ⤒ Upload image
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
          </div>

          {scanErr && <div style={{ color: "#ff8080", fontSize: 13, textAlign: "center" }}>{scanErr}</div>}
          {scanResult && (
            <div style={{ background: "var(--nv-elevated)", border: "1px solid " + bdr(AC), borderRadius: 12, padding: "13px 14px", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontFamily: FFB, fontWeight: 600, letterSpacing: 1.2, color: AC, textTransform: "uppercase", marginBottom: 8 }}>Scanned result</div>
              <div style={{ fontSize: 14, color: "var(--nv-text-strong)", wordBreak: "break-all", fontFamily: FFM, lineHeight: 1.5 }}>{scanResult}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => copy(scanResult)} style={{ padding: "7px 14px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, color: AC, fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>⧉ Copy</button>
                {resultIsUrl && (
                  <button onClick={() => { try { window.open(scanResult.trim(), "_blank", "noopener"); } catch (e) {} }} style={{ padding: "7px 14px", background: AC, border: "none", borderRadius: 9, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>↗ Open link</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

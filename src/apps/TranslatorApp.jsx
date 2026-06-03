import { useState, useEffect, useRef } from "react";
import { FF, FFB } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// v10.9 — Translator.
// MyMemory translation API — keyless + CORS-friendly. Anonymous requests are
// capped at 500 characters each, which is plenty for a quick-translate
// utility. langpair format is "<from>|<to>".
const API = "https://api.mymemory.translated.net/get";
const MAX = 500;

const LANGS = [
  ["en", "English 🇬🇧"], ["es", "Spanish 🇪🇸"], ["fr", "French 🇫🇷"], ["de", "German 🇩🇪"],
  ["it", "Italian 🇮🇹"], ["pt", "Portuguese 🇵🇹"], ["ru", "Russian 🇷🇺"], ["ja", "Japanese 🇯🇵"],
  ["ko", "Korean 🇰🇷"], ["zh-CN", "Chinese 🇨🇳"], ["ar", "Arabic 🇸🇦"], ["hi", "Hindi 🇮🇳"],
  ["nl", "Dutch 🇳🇱"], ["pl", "Polish 🇵🇱"], ["tr", "Turkish 🇹🇷"], ["sv", "Swedish 🇸🇪"],
  ["da", "Danish 🇩🇰"], ["fi", "Finnish 🇫🇮"], ["no", "Norwegian 🇳🇴"], ["el", "Greek 🇬🇷"],
  ["he", "Hebrew 🇮🇱"], ["th", "Thai 🇹🇭"], ["vi", "Vietnamese 🇻🇳"], ["id", "Indonesian 🇮🇩"],
  ["uk", "Ukrainian 🇺🇦"], ["cs", "Czech 🇨🇿"], ["ro", "Romanian 🇷🇴"],
];

export function TranslatorApp({ AC, showToast }) {
  const [from, setFrom] = useState(() => localStorage.getItem("nova-tr-from") || "en");
  const [to, setTo] = useState(() => localStorage.getItem("nova-tr-to") || "es");
  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const debRef = useRef(null);

  useEffect(() => { localStorage.setItem("nova-tr-from", from); }, [from]);
  useEffect(() => { localStorage.setItem("nova-tr-to", to); }, [to]);

  useEffect(() => {
    const t = text.trim();
    if (!t) { setOut(""); setErr(null); setLoading(false); return; }
    if (from === to) { setOut(text); setErr(null); return; }
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setLoading(true); setErr(null);
      fetch(`${API}?q=${encodeURIComponent(t)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d && d.responseData && d.responseData.translatedText) {
            setOut(d.responseData.translatedText);
            if (typeof d.responseStatus === "number" && d.responseStatus !== 200 && !d.responseData.translatedText) {
              setErr("Translation limit reached — try again shortly.");
            }
          } else { setErr("Couldn't translate that text."); setOut(""); }
        })
        .catch(() => setErr("Network error — check your connection."))
        .finally(() => setLoading(false));
    }, 600);
    return () => clearTimeout(debRef.current);
  }, [text, from, to]);

  const swap = () => {
    setFrom(to); setTo(from);
    setText(out); setOut(text);
  };

  const copy = () => {
    if (!out) return;
    try {
      navigator.clipboard.writeText(out);
      if (showToast) showToast("Copied translation");
    } catch (e) {}
  };

  const selStyle = {
    flex: 1, padding: "10px 12px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)",
    borderRadius: 10, color: "var(--nv-text-strong)", fontFamily: FFB, fontWeight: 600, fontSize: 13.5,
    outline: "none", cursor: "pointer", minWidth: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <select value={from} onChange={(e) => setFrom(e.target.value)} style={selStyle}>
          {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <button onClick={swap} title="Swap languages" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: fill(AC), border: "1px solid " + bdr(AC), color: AC, cursor: "pointer", fontSize: 16 }}>⇄</button>
        <select value={to} onChange={(e) => setTo(e.target.value)} style={selStyle}>
          {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      </div>

      <div style={{ position: "relative", flexShrink: 0 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder="Enter text to translate…"
          autoFocus
          style={{ width: "100%", height: 130, padding: "13px 14px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)", borderRadius: 12, color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 15, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }}
        />
        <div style={{ position: "absolute", bottom: 8, right: 12, fontSize: 10.5, color: "var(--nv-text-dim)", fontFamily: FFB }}>{text.length}/{MAX}</div>
      </div>

      <div style={{ flex: 1, minHeight: 90, position: "relative", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12, padding: "13px 14px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--nv-text-dim)" }}>
            <div style={{ width: 15, height: 15, border: "2px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Translating…</span>
          </div>
        ) : err ? (
          <div style={{ color: "#ff8080", fontSize: 13 }}>{err}</div>
        ) : out ? (
          <div style={{ fontSize: 16, color: "var(--nv-text-strong)", lineHeight: 1.5, whiteSpace: "pre-wrap", paddingRight: 30 }}>{out}</div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--nv-text-dim)" }}>Translation appears here.</div>
        )}
        {out && !loading && (
          <button onClick={copy} title="Copy" style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 8, background: "var(--nv-hover)", border: "1px solid var(--nv-border)", color: "var(--nv-text)", cursor: "pointer", fontSize: 13 }}>⧉</button>
        )}
      </div>

      <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", textAlign: "center", flexShrink: 0 }}>
        Machine translation · best for short phrases. Up to {MAX} characters per translation.
      </div>
    </div>
  );
}

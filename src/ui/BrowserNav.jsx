// Browser app's address bar — used only by BrowserApp. Lives in ui/ because
// it shares the navBtn pattern with other top-level nav controls.
//
// v9.5 — refreshed to the v9.5 theme: theme tokens everywhere, pill-shaped
// nav buttons matched to the URL bar, a leading 🔒/🔍 glyph inside the URL
// bar that flips based on whether the entry parses as a URL.

import { useRef } from "react";
import { FFB, FFM } from "./styles.js";
import { fill, bdr, isUrl } from "../lib/format.js";

export function BrowserNav({ bar, setBar, onGo, onBack, onFwd, onRefresh, canBack, canFwd, canRefresh, AC, view }) {
  const inputRef = useRef(null);
  const looksLikeUrl = bar && isUrl(bar);

  function navBtn(enabled) {
    return {
      width: 32, height: 32, borderRadius: 8,
      background: enabled ? "var(--nv-elevated)" : "transparent",
      border: "1px solid " + (enabled ? "var(--nv-border)" : "var(--nv-border)"),
      cursor: enabled ? "pointer" : "default",
      color:  enabled ? "var(--nv-text)" : "var(--nv-text-dim)",
      fontSize: 14,
      opacity: enabled ? 1 : 0.45,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      transition: "background 0.15s, color 0.15s",
    };
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--nv-border)", background: "rgba(255,255,255,0.015)", flexShrink: 0 }}>
      <button onClick={onBack}    disabled={!canBack}    title="Back"    style={navBtn(canBack)}>‹</button>
      <button onClick={onFwd}     disabled={!canFwd}     title="Forward" style={navBtn(canFwd)}>›</button>
      <button onClick={onRefresh} disabled={!canRefresh} title="Refresh" style={navBtn(canRefresh)}>↻</button>

      {/* URL bar — a single pill with a leading glyph + the input. Clicking
          anywhere on the pill focuses the input (an Edge/Chrome touch). */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "0 14px", height: 34,
          background: "var(--nv-input-bg)",
          border: "1px solid var(--nv-border)",
          borderRadius: 17,
          cursor: "text",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--nv-border-strong)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--nv-border)"}
      >
        <span style={{ fontSize: 12, color: "var(--nv-text-dim)", flexShrink: 0, lineHeight: 1 }}>
          {looksLikeUrl ? <SecureGlyph/> : <SearchGlyph/>}
        </span>
        <input
          ref={inputRef}
          value={bar}
          onChange={e => setBar(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onGo()}
          onFocus={e => e.currentTarget.select()}
          placeholder="Search the web or enter a URL"
          style={{
            flex: 1, minWidth: 0,
            background: "transparent", border: "none",
            color: "var(--nv-text-strong)",
            fontFamily: FFM, fontSize: 12,
            outline: "none", padding: 0,
          }}/>
      </div>

      <button onClick={onGo} title="Go" style={{ padding: "0 16px", height: 32, background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 16, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC, flexShrink: 0 }}>Go</button>
    </div>
  );
}

const svgIcon = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };
function SearchGlyph() { return (<svg {...svgIcon}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>); }
function SecureGlyph() { return (<svg {...svgIcon}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>); }

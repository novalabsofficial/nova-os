// v11.0 Phase B — first-run setup wizard. Shows once for brand-new accounts
// (data.setupComplete === false). Reads like a real OS setup assistant: a
// branded header, mini desktop previews for the theme choice (no emojis), and
// a curated app picker that seeds the desktopApps whitelist. Everything is
// changeable later, so it stays short. Desktop shell only.

import { useState } from "react";
import { FF, FFB, FFM, RADIUS } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { AppIconDisplay, NovaLogo } from "./icons.jsx";
import { DEFAULT_DESKTOP_APPS, NOVA_VERSION } from "./constants.js";

// A tiny rendered desktop (wallpaper + window + dock) used as the theme preview —
// reads as "this is what your OS will look like" far better than a sun/moon glyph.
function ThemePreview({ mode }) {
  const dark = mode === "dark";
  const wall = dark ? "linear-gradient(135deg,#0b0b16,#1e1b4b)" : "linear-gradient(135deg,#f1f3fa,#cfd6e6)";
  const surf = dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)";
  const line = dark ? "rgba(255,255,255,0.22)" : "rgba(20,28,48,0.2)";
  const bar = dark ? "rgba(18,20,34,0.7)" : "rgba(255,255,255,0.82)";
  const edge = dark ? "rgba(255,255,255,0.08)" : "rgba(20,28,48,0.1)";
  return (
    <div style={{ position: "relative", height: 108, borderRadius: 10, background: wall, overflow: "hidden", border: "1px solid " + edge }}>
      <div style={{ position: "absolute", left: 16, top: 15, width: 82, height: 60, borderRadius: 8, background: surf, border: "1px solid " + line, padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 1 }}>
          <div style={{ width: 5, height: 5, borderRadius: 3, background: line }} />
          <div style={{ width: 5, height: 5, borderRadius: 3, background: line }} />
        </div>
        <div style={{ height: 4, width: "82%", borderRadius: 2, background: line }} />
        <div style={{ height: 4, width: "58%", borderRadius: 2, background: line }} />
        <div style={{ height: 4, width: "70%", borderRadius: 2, background: line }} />
      </div>
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 8, width: "66%", height: 12, borderRadius: 6, background: bar, border: "1px solid " + edge, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 2, background: line }} />)}
      </div>
    </div>
  );
}

export function SetupWizard({ AC, user, apps, theme, glass, onPickTheme, onComplete }) {
  const [step, setStep] = useState(0);
  const pickable = apps.filter(a => !a.storeApp);   // built-in apps only
  const [sel, setSel] = useState(() => new Set(DEFAULT_DESKTOP_APPS.filter(id => pickable.some(a => a.id === id))));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const next = () => setStep(s => Math.min(2, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const btn = (primary) => ({
    padding: "11px 24px", borderRadius: RADIUS.lg, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13.5,
    border: "1px solid " + (primary ? bdr(AC) : "var(--nv-border)"),
    background: primary ? fill(AC) : "var(--nv-elevated)", color: primary ? AC : "var(--nv-text)",
    transition: "all 0.18s var(--nv-ease)",
  });
  const eyebrow = { fontFamily: FFB, fontWeight: 700, fontSize: 10.5, letterSpacing: 1.8, textTransform: "uppercase", color: AC, marginBottom: 7 };
  const h = { fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)", marginBottom: 5, letterSpacing: 0.2 };
  const sub = { fontSize: 13, color: "var(--nv-text-dim)", marginBottom: 20, lineHeight: 1.5 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100060, background: "var(--nv-body-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF, padding: 20 }}>
      <div style={{ width: "min(740px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: RADIUS.xxl, boxShadow: "var(--nv-popover-shadow)", overflow: "hidden", animation: "pop-in 0.3s var(--nv-ease)" }}>

        <div style={{ display: "flex", gap: 6, padding: "16px 26px 0", flexShrink: 0 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 3.5, borderRadius: 2, background: i <= step ? AC : "var(--nv-elevated)", transition: "background 0.35s var(--nv-ease)" }} />)}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "30px 36px", minHeight: 0 }}>
          {step === 0 && (
            <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, filter: "drop-shadow(0 8px 26px rgba(99,102,241,0.4))" }}><NovaLogo size={66} /></div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 29, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Welcome to Nova OS</div>
              <div style={{ fontFamily: FFM, fontSize: 11, color: AC, letterSpacing: 2, marginTop: 8, textTransform: "uppercase" }}>Version {NOVA_VERSION}</div>
              <div style={{ fontSize: 14.5, color: "var(--nv-text)", lineHeight: 1.65, maxWidth: 440, margin: "18px auto 0" }}>Let's get you set up, <strong style={{ color: "var(--nv-text-strong)" }}>@{user}</strong>. Two quick choices — your look and your apps — and you're in. You can change everything later.</div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={eyebrow}>Step 2 of 3 · Appearance</div>
              <div style={h}>Choose your look</div>
              <div style={sub}>Light or dark — switch anytime in Settings.</div>
              <div style={{ display: "flex", gap: 16 }}>
                {["dark", "light"].map(m => {
                  const active = theme === m;
                  return (
                    <button key={m} onClick={() => onPickTheme(m)} style={{ flex: 1, padding: 10, borderRadius: RADIUS.xl, cursor: "pointer", border: "2px solid " + (active ? AC : "var(--nv-border)"), background: "var(--nv-elevated)", transition: "all 0.18s var(--nv-ease)", textAlign: "left" }}>
                      <ThemePreview mode={m} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 4px 3px" }}>
                        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: active ? AC : "var(--nv-text-strong)", textTransform: "capitalize" }}>{m}</span>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid " + (active ? AC : "var(--nv-border-strong)"), background: active ? AC : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {active && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.4 2.4 4.6-5" /></svg>}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={eyebrow}>Step 3 of 3 · Desktop</div>
              <div style={h}>Pick your desktop apps</div>
              <div style={sub}>{sel.size} selected · add or remove any app later by right-clicking the desktop.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(94px, 1fr))", gap: 10 }}>
                {pickable.map(a => {
                  const on = sel.has(a.id);
                  return (
                    <button key={a.id} onClick={() => toggle(a.id)} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "13px 6px", borderRadius: RADIUS.lg, cursor: "pointer", border: "1px solid " + (on ? bdr(AC) : "var(--nv-border)"), background: on ? fill(AC) : "var(--nv-elevated)", transition: "all 0.15s var(--nv-ease)" }}>
                      <AppIconDisplay app={{ id: a.id, icon: a.icon }} size={36} glass={glass} />
                      <span style={{ fontSize: 10.5, fontFamily: FFB, fontWeight: 600, color: on ? AC : "var(--nv-text)", textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{a.label}</span>
                      {on && <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: AC, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.4 2.4 4.6-5" /></svg></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 26px", borderTop: "1px solid var(--nv-border)", flexShrink: 0 }}>
          {step > 0 ? <button onClick={back} style={btn(false)}>Back</button> : <span />}
          <div style={{ flex: 1 }} />
          {step < 2
            ? <button onClick={next} style={btn(true)}>{step === 0 ? "Get started" : "Continue"}</button>
            : <button onClick={() => onComplete([...sel])} style={btn(true)}>Finish setup</button>}
        </div>
      </div>
    </div>
  );
}

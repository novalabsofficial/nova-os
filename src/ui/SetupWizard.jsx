// v11.0 Phase B — first-run setup wizard. Shows once for brand-new accounts
// (data.setupComplete === false). Two choices that shape the first impression:
// (1) light vs dark theme (applied live as you pick), and (2) which apps land on
// the desktop — seeding the desktopApps whitelist. Everything is changeable
// later (Settings + right-click), so it stays short. Desktop shell only.

import { useState } from "react";
import { FF, FFB, RADIUS } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { AppIconDisplay } from "./icons.jsx";
import { DEFAULT_DESKTOP_APPS } from "./constants.js";

export function SetupWizard({ AC, user, apps, theme, glass, onPickTheme, onComplete }) {
  const [step, setStep] = useState(0);
  // Built-in apps only for the picker (skip the catalog/community store tiles).
  const pickable = apps.filter(a => !a.storeApp);
  const [sel, setSel] = useState(() => new Set(DEFAULT_DESKTOP_APPS.filter(id => pickable.some(a => a.id === id))));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const next = () => setStep(s => Math.min(2, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const btn = (primary) => ({
    padding: "11px 22px", borderRadius: RADIUS.lg, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13.5,
    border: "1px solid " + (primary ? bdr(AC) : "var(--nv-border)"),
    background: primary ? fill(AC) : "var(--nv-elevated)", color: primary ? AC : "var(--nv-text)",
    transition: "all 0.18s var(--nv-ease)",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100060, background: "var(--nv-body-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF, padding: 20 }}>
      <div style={{ width: "min(720px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: RADIUS.xxl, boxShadow: "var(--nv-popover-shadow)", overflow: "hidden", animation: "pop-in 0.3s var(--nv-ease)" }}>

        {/* progress bars */}
        <div style={{ display: "flex", gap: 6, padding: "16px 22px 0", flexShrink: 0 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? AC : "var(--nv-elevated)", transition: "background 0.3s var(--nv-ease)" }} />)}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", minHeight: 0 }}>
          {step === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: 76, height: 76, margin: "0 auto 20px", borderRadius: 20, background: fill(AC), border: "1px solid " + bdr(AC), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>✨</div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 28, color: "var(--nv-text-strong)", marginBottom: 8 }}>Welcome to Nova OS</div>
              <div style={{ fontSize: 14.5, color: "var(--nv-text)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>Hey <strong style={{ color: AC }}>@{user}</strong> — let's set things up. Two quick choices and you're in, and you can change anything later.</div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 21, color: "var(--nv-text-strong)", marginBottom: 4 }}>Choose your look</div>
              <div style={{ fontSize: 13, color: "var(--nv-text-dim)", marginBottom: 20 }}>Switch anytime in Settings → Appearance.</div>
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  { id: "dark", label: "Dark", emoji: "🌙", bg: "linear-gradient(135deg,#0a0a14,#1e1b4b)" },
                  { id: "light", label: "Light", emoji: "☀️", bg: "linear-gradient(135deg,#eef1f8,#cfd6e6)" },
                ].map(t => {
                  const active = theme === t.id;
                  return (
                    <button key={t.id} onClick={() => onPickTheme(t.id)} style={{ flex: 1, padding: 0, borderRadius: RADIUS.xl, overflow: "hidden", cursor: "pointer", border: "2.5px solid " + (active ? AC : "var(--nv-border)"), background: "var(--nv-elevated)", transition: "all 0.18s var(--nv-ease)" }}>
                      <div style={{ height: 100, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>{t.emoji}</div>
                      <div style={{ padding: "12px", fontFamily: FFB, fontWeight: 700, fontSize: 14, color: active ? AC : "var(--nv-text-strong)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{t.label}{active && <span style={{ fontSize: 12 }}>✓</span>}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 21, color: "var(--nv-text-strong)", marginBottom: 4 }}>Pick your desktop apps</div>
              <div style={{ fontSize: 13, color: "var(--nv-text-dim)", marginBottom: 18 }}>{sel.size} selected · you can add or remove any app later by right-clicking the desktop.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 10 }}>
                {pickable.map(a => {
                  const on = sel.has(a.id);
                  return (
                    <button key={a.id} onClick={() => toggle(a.id)} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "12px 6px", borderRadius: RADIUS.lg, cursor: "pointer", border: "1px solid " + (on ? bdr(AC) : "var(--nv-border)"), background: on ? fill(AC) : "var(--nv-elevated)", transition: "all 0.15s var(--nv-ease)" }}>
                      <AppIconDisplay app={{ id: a.id, icon: a.icon }} size={34} glass={glass} />
                      <span style={{ fontSize: 10.5, fontFamily: FFB, fontWeight: 600, color: on ? AC : "var(--nv-text)", textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{a.label}</span>
                      {on && <div style={{ position: "absolute", top: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: AC, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* footer nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--nv-border)", flexShrink: 0 }}>
          {step > 0 ? <button onClick={back} style={btn(false)}>Back</button> : <span />}
          <div style={{ flex: 1 }} />
          {step < 2
            ? <button onClick={next} style={btn(true)}>{step === 0 ? "Get started" : "Next"}</button>
            : <button onClick={() => onComplete([...sel])} style={btn(true)}>Finish — {sel.size} app{sel.size === 1 ? "" : "s"}</button>}
        </div>
      </div>
    </div>
  );
}

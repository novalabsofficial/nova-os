import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { WALLPAPERS, ACCENT_PRESETS, WIDGET_CONFIGS, NOVA_VERSION } from "../ui/constants.js";
import { Toggle } from "../ui/Toggle.jsx";
import { getSoundConfig, setSoundConfig, playSound, setSoundWallpaper } from "../lib/audio.js";
import { db } from "../lib/db.js";
import { isFullscreen, toggleFullscreen, onFullscreenChange } from "../lib/fullscreen.js";
import { isNative, exitApp } from "../lib/native.js";
import { isDesktop, quitApp } from "../lib/system.js";
import { getLitePref, setLitePref } from "../lib/lite.js";
import { CUSTOM_LIGHT_WP } from "../ui/wallpapers.jsx";

// ── v9.0 sidebar glyphs ──────────────────────────────────────────────────
// Small monochrome line-icons for the left rail. Stroke uses currentColor so
// the active item (accent-colored) and inactive items (dim) both read right.
function SGlyph({ id, size = 18 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block", flexShrink: 0 } };
  switch (id) {
    case "appearance": return (<svg {...p}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>);
    case "display":    return (<svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>);
    case "sound":      return (<svg {...p}><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>);
    case "network":    return (<svg {...p}><path d="M5 12.55a11 11 0 0 1 14 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg>);
    case "widgets":    return (<svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>);
    case "keyboard":   return (<svg {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>);
    case "account":    return (<svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
    case "about":      return (<svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>);
    default: return null;
  }
}

// Read a snapshot of the network status. Web sandboxing means we can read the
// connection *status* (online/offline + type/speed where the browser exposes
// it via the Network Information API) but we can't list or switch Wi-Fi
// networks — that lives in the OS. Safe outside the browser.
function readNet() {
  if (typeof navigator === "undefined") return { online: true };
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  return {
    online: navigator.onLine !== false,
    type: c && c.type ? c.type : null,                 // "wifi" | "cellular" | "ethernet" | ... (often null on desktop)
    effectiveType: c && c.effectiveType ? c.effectiveType : null, // "4g" | "3g" | ...
    downlink: c && typeof c.downlink === "number" ? c.downlink : null, // Mbps estimate
    rtt: c && typeof c.rtt === "number" ? c.rtt : null,               // ms estimate
  };
}

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "display",    label: "Display" },
  { id: "sound",      label: "Sound" },
  { id: "network",    label: "Network" },
  { id: "widgets",    label: "Widgets" },
  { id: "keyboard",   label: "Keyboard" },
  { id: "account",    label: "Account" },
  { id: "about",      label: "About" },
];

export function SettingsApp({ user, data, updateSettings, showToast, AC, onCustomWallpaper, onLogout, initialSection }) {
  // v9.0: Settings is now a two-pane layout (Windows-style) — a left rail of
  // categories + a scrolling content pane. `section` tracks the active pane;
  // `initialSection` lets the taskbar quick-settings deep-link straight to
  // e.g. Network or Sound.
  // Mobile master-detail: "list" shows the section list, "detail" shows one
  // section with a Back button (the desktop two-pane has no back on a phone).
  const [mobilePane, setMobilePane] = useState("list");
  const [lite, setLite] = useState(() => getLitePref());   // v10.7 lite-mode toggle
  const [section, setSection] = useState(initialSection || "appearance");
  useEffect(() => { if (initialSection) setSection(initialSection); }, [initialSection]);

  // v7.8: live fullscreen state. Subscribes to fullscreenchange events so the
  // toggle stays in sync even when the user exits via Esc or F11.
  const [fs, setFs] = useState(() => isFullscreen());
  useEffect(() => { setFs(isFullscreen()); return onFullscreenChange(setFs); }, []);

  // Sound preferences live in localStorage (read inside playSound on each call)
  // so they take effect instantly. Mirror into local state for the slider.
  const [soundCfg, setSoundCfgState] = useState(() => getSoundConfig());
  function updateSoundCfg(patch) {
    const next = { ...soundCfg, ...patch };
    setSoundCfgState(next);
    setSoundConfig(next);
  }
  // v9.4 — volume-sample chime. Plays a short A5→C#6 ping at the new
  // volume so the user hears how loud the slider position actually is —
  // same trick Windows uses. Throttled to once per ~150 ms so a smooth
  // drag triggers a steady series of pings instead of overlapping audio.
  const lastVolPreviewRef = useRef(0);
  function previewVolume(newVolume) {
    const now = Date.now();
    if (now - lastVolPreviewRef.current < 150) return;
    if (!(newVolume > 0)) return;     // muted / zero: nothing to sample
    lastVolPreviewRef.current = now;
    playSound("volumeSample");
  }

  // v9.0: live network status for the Network pane.
  const [net, setNet] = useState(() => readNet());
  useEffect(() => {
    const refresh = () => setNet(readNet());
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    if (c && c.addEventListener) c.addEventListener("change", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      if (c && c.removeEventListener) c.removeEventListener("change", refresh);
    };
  }, []);

  const settings = data?.settings || {};
  const fileRef = useRef(null);
  function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast("File too large (max 8MB)"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 900; const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        onCustomWallpaper(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file); e.target.value = "";
  }
  // v11.0 — wallpaper is stored per-theme so Light/Dark each remember their own
  // pick (Light defaults to the new Lumina light wallpaper). The picker reads
  // and writes whichever slot matches the active theme.
  const isLightWp = settings.theme === "light";
  const wpKey = isLightWp ? "wallpaperLight" : "wallpaper";
  const wpId = isLightWp ? (settings.wallpaperLight || "bloom") : (settings.wallpaper || data?.wallpaper || "mesh");
  const widgets = settings.widgets || {};
  function setWidget(id, val) { updateSettings({ widgets: { ...widgets, [id]: val } }); }

  // Friendly connection label from whatever the browser exposes.
  const connLabel = !net.online ? "Offline"
    : net.type === "wifi" ? "Wi-Fi"
    : net.type === "ethernet" ? "Ethernet"
    : net.type === "cellular" ? "Cellular"
    : "Connected";

  const PANE_TITLE = { fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)", marginBottom: 3, letterSpacing: 0.2 };
  const PANE_SUB = { fontSize: 11.5, color: "var(--nv-text-dim)", marginBottom: 20, lineHeight: 1.5 };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100%", minHeight: 0, fontFamily: FF }}>
      {/* ── Left rail (mobile: the master list; hidden once a section opens) ── */}
      <div style={{
        width: isMobile ? "100%" : 184, flexShrink: 0,
        borderRight: isMobile ? "none" : "1px solid var(--nv-border)",
        padding: "16px 10px", overflowY: "auto",
        display: (isMobile && mobilePane !== "list") ? "none" : "flex",
        flexDirection: "column", gap: 2,
        background:"var(--nv-elevated)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 14px" }}>
          <UserBubble user={user} ac={AC} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>@{user}</div>
            <div style={{ fontSize: 9.5, color: "var(--nv-text-dim)" }}>Nova account</div>
          </div>
        </div>
        {SECTIONS.map(s => {
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => { setSection(s.id); if (isMobile) setMobilePane("detail"); }} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9,
              background: active ? fill(AC) : "transparent",
              border: "1px solid " + (active ? bdr(AC) : "transparent"),
              cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
              color: active ? AC : "var(--nv-text)", textAlign: "left", width: "100%",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <SGlyph id={s.id} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Content pane (mobile: shown once a section is picked, with Back) ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: isMobile ? "0 16px 24px" : "20px 24px", display: (isMobile && mobilePane === "list") ? "none" : "block" }}>

        {isMobile && (
          <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 10, padding: "12px 0", marginBottom: 6, background: "var(--nv-surface-solid)", borderBottom: "1px solid var(--nv-border)" }}>
            <button onClick={() => setMobilePane("list")} style={{ background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, padding: "7px 12px", color: "var(--nv-text-strong)", cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13 }}>← Settings</button>
            <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)" }}>{(SECTIONS.find(s => s.id === section) || {}).label}</span>
          </div>
        )}

        {section === "appearance" && (<>
          <div style={PANE_TITLE}>Appearance</div>
          <div style={PANE_SUB}>Personalize how Nova OS looks — glass, accent, wallpaper and the taskbar.</div>

          <div style={SEC}>Liquid Glass</div>
          <Toggle label="✨ Liquid Glass surfaces" value={!!settings.glass} onChange={v => { updateSettings({ glass: v }); showToast(v ? "Liquid Glass on ✨" : "Liquid Glass off"); }} ac={AC} />
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic", marginBottom: 20, marginTop: 2 }}>Frosts windows, the taskbar, menus &amp; widgets so the wallpaper glows through.</div>

          <div style={SEC}>Accent Color</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>{ACCENT_PRESETS.map(c => <div key={c} className="ad" onClick={() => { updateSettings({ accent: c }); showToast("Accent updated ✓"); }} style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: "pointer", border: AC === c ? "2.5px solid #fff" : "2.5px solid transparent", transition: "transform 0.12s,border 0.12s", boxSizing: "border-box" }} />)}<input type="color" value={AC} onChange={e => updateSettings({ accent: e.target.value })} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--nv-border)", cursor: "pointer", background: "none" }} title="Custom color" /></div>
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginBottom: 20, fontFamily: FFM }}>Current: {AC}</div>

          <div style={SEC}>Wallpaper</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>{Object.entries(WALLPAPERS).filter(([k]) => k !== "custom").map(([k, w]) => (<div key={k} className="ws" onClick={() => { updateSettings({ [wpKey]: k }); setSoundWallpaper(k); playSound("notification"); showToast("Wallpaper: " + w.name + " ✓"); }} style={{ height: 52, borderRadius: 8, background: (k === "bloom" && CUSTOM_LIGHT_WP) ? ('url("' + CUSTOM_LIGHT_WP + '") center/cover no-repeat') : w.preview, cursor: "pointer", border: wpId === k ? "2.5px solid #fff" : "2px solid transparent", transition: "border 0.14s", boxSizing: "border-box", display: "flex", alignItems: "flex-end", padding: "5px 7px" }}><span style={{ fontSize: 9, fontFamily: FFB, fontWeight: 600, color: "var(--nv-text)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{w.name}</span></div>))}</div>
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic", marginBottom: 10, fontFamily: FF }}>✨ Each wallpaper tunes the system sounds to a matching musical key. Pick one and listen to the chime.</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
          <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: "10px", background: wpId === "custom" ? fill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (wpId === "custom" ? bdr(AC) : "rgba(255,255,255,0.12)"), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: wpId === "custom" ? AC : "var(--nv-text)", marginBottom: 10 }}>{wpId === "custom" ? "✓ Custom Wallpaper Active — Click to Change" : "📁 Upload Custom Wallpaper"}</button>
          <Toggle label="Animate wallpaper" value={!!settings.wallpaperAnimated} onChange={v => updateSettings({ wallpaperAnimated: v })} ac={AC} />
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic", marginBottom: 22, marginTop: 2 }}>“Auto” changes the wallpaper through the day · “Animate” adds gentle motion.</div>

          <div style={SEC}>Taskbar Color</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>
            {[
              { id: "default", color: null, preview: "linear-gradient(180deg,#0e1018,#0a0c18)" },
              { id: "black", color: "#000000", preview: "#000000" },
              { id: "navy", color: "#0a1428", preview: "#0a1428" },
              { id: "slate", color: "#1e293b", preview: "#1e293b" },
              { id: "indigo", color: "#1e1b4b", preview: "#1e1b4b" },
              { id: "plum", color: "#2a0a2a", preview: "#2a0a2a" },
              { id: "forest", color: "#0a2a18", preview: "#0a2a18" },
            ].map(c => {
              const active = (settings.taskbarColor || null) === c.color;
              return (<div key={c.id} className="ad" onClick={() => { updateSettings({ taskbarColor: c.color }); showToast("Taskbar color set ✓"); }} title={c.id} style={{ width: 28, height: 28, borderRadius: 7, background: c.preview, cursor: "pointer", border: active ? "2.5px solid #fff" : "2.5px solid transparent", transition: "transform 0.12s,border 0.12s", boxSizing: "border-box" }} />);
            })}
            <input type="color" value={typeof settings.taskbarColor === "string" ? settings.taskbarColor : "#0a0a14"} onChange={e => updateSettings({ taskbarColor: e.target.value })} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--nv-border)", cursor: "pointer", background: "none" }} title="Custom color" />
          </div>
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginBottom: 20, fontFamily: FFM }}>{settings.taskbarColor ? "Current: " + settings.taskbarColor : "System default"}</div>

          <div style={SEC}>Window Blur</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><input type="range" min={0} max={30} value={settings.winBlur ?? 18} onChange={e => updateSettings({ winBlur: +e.target.value })} style={{ flex: 1, accentColor: AC }} /><span style={{ fontSize: 11, fontFamily: FFM, color: "var(--nv-text-dim)", width: 32 }}>{settings.winBlur ?? 18}px</span></div>
        </>)}

        {section === "display" && (<>
          <div style={PANE_TITLE}>Display</div>
          <div style={PANE_SUB}>Screen behavior, clock format, text size and how Nova sizes for your device.</div>

          <div style={SEC}>Appearance</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {[{ id: "dark", label: "🌙 Dark" }, { id: "light", label: "☀️ Light" }].map(t => {
              const active = (settings.theme === "light" ? "light" : "dark") === t.id;
              return (<button key={t.id} onClick={() => { updateSettings({ theme: t.id }); showToast(t.id === "light" ? "Light mode on ☀️" : "Dark mode on 🌙"); }}
                style={{ flex: 1, padding: "11px 12px", borderRadius: 10, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13, background: active ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"), color: active ? AC : "var(--nv-text)", transition: "all 0.15s" }}>{t.label}</button>);
            })}
          </div>
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginBottom: 10, fontStyle: "italic", marginTop: -2 }}>New in 11.0 — light mode is rolling out; some apps are still being polished. (The new-account setup wizard will offer this too.)</div>

          <div style={SEC}>Screen</div>
          <Toggle label="Fullscreen Mode" value={fs} onChange={() => { toggleFullscreen(); }} ac={AC} />
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginBottom: 10, fontStyle: "italic", marginTop: -4 }}>Tip: press <strong style={{ color: "var(--nv-text)" }}>F11</strong> any time to toggle.</div>
          <Toggle label="24-Hour Clock" value={!!settings.clock24h} onChange={v => updateSettings({ clock24h: v })} ac={AC} />
          <Toggle label="Large Text" value={!!settings.largeFont} onChange={v => updateSettings({ largeFont: v })} ac={AC} />
          <Toggle label="Restore open apps on sign-in" value={!!settings.restoreOnSignin} onChange={v => updateSettings({ restoreOnSignin: v })} ac={AC} />
          <Toggle label="Lite Mode" value={lite} onChange={v => { setLitePref(v); setLite(v); showToast(v ? "Lite mode on" : "Lite mode off"); }} ac={AC} />
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginBottom: 10, fontStyle: "italic", marginTop: -4 }}>⚠ For <strong style={{ color: "var(--nv-text)" }}>very low-end devices only</strong> — turns off background blur and wallpaper animation for smoother performance.</div>

          <div style={{ ...SEC, marginTop: 16 }}>Screen Saver</div>
          <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 9 }}>Show a clock over a blurred desktop after you're idle. Move the mouse or press a key to wake.</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            {[["Off", 0], ["30 sec", 0.5], ["1 min", 1], ["3 min", 3], ["5 min", 5], ["10 min", 10]].map(([label, mins]) => {
              const active = (settings.screensaverMins === undefined ? 1 : settings.screensaverMins) === mins;
              return (<button key={mins} onClick={() => { updateSettings({ screensaverMins: mins }); showToast(mins ? "Screen saver: " + label : "Screen saver off"); }} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, background: active ? fill(AC) : "rgba(255,255,255,0.05)", border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.1)"), color: active ? AC : "var(--nv-text)" }}>{label}</button>);
            })}
          </div>

          <div style={SEC}>Display Mode</div>
          <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 9, lineHeight: 1.55 }}>How Nova OS sizes for your device. "Auto" picks based on screen size + touch capability — override here if you want a specific look.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7, marginBottom: 6 }}>
            {[
              { id: "auto", label: "⚙ Auto", desc: "Detect from device" },
              { id: "desktop", label: "🖥 Desktop", desc: "Mouse-precision UI" },
              { id: "tablet", label: "📱 Tablet", desc: "Larger touch targets" },
              { id: "mobile", label: "📲 Mobile", desc: "iOS-style phone UI" },
            ].map(m => {
              const active = (settings.displayMode || "auto") === m.id;
              return (<button key={m.id} onClick={() => { updateSettings({ displayMode: m.id }); showToast("Display: " + m.label + " ✓"); }} style={{ textAlign: "left", padding: "10px 12px", background: active ? fill(AC) : "rgba(255,255,255,0.04)", border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.08)"), borderRadius: 8, cursor: "pointer", fontFamily: FF, color: active ? AC : "var(--nv-text)" }}>
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: active ? AC : "var(--nv-text-dim)", marginTop: 1, opacity: active ? 0.85 : 1 }}>{m.desc}</div>
              </button>);
            })}
          </div>
          <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginBottom: 4, fontStyle: "italic" }}>Resize the browser window to test — Nova will re-detect on the fly.</div>
        </>)}

        {section === "sound" && (<>
          <div style={PANE_TITLE}>Sound</div>
          <div style={PANE_SUB}>Nova OS's system sounds — the same volume you'll find in the taskbar's quick settings.</div>

          <div style={SEC}>System Sounds</div>
          <Toggle label="System sounds" value={soundCfg.enabled} onChange={v => updateSoundCfg({ enabled: v })} ac={AC} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 8, opacity: soundCfg.enabled ? 1 : 0.4, pointerEvents: soundCfg.enabled ? "auto" : "none" }}>
            <span style={{ fontSize: 11, fontFamily: FFM, color: "var(--nv-text-dim)", width: 54 }}>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={soundCfg.volume} onChange={e => { const v = +e.target.value; updateSoundCfg({ volume: v }); previewVolume(v); }} style={{ flex: 1, accentColor: AC }} />
            <span style={{ fontSize: 11, fontFamily: FFM, color: "var(--nv-text-dim)", width: 32 }}>{Math.round(soundCfg.volume * 100)}%</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", marginBottom: 12, lineHeight: 1.5 }}>This controls Nova's own UI sounds. Media volume (the Music app, videos) and your computer's master volume are set by your device.</div>
          <div style={SEC}>Preview</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8, opacity: soundCfg.enabled ? 1 : 0.4 }}>
            {["startup", "login", "logout", "notification", "appLaunch", "windowOpen", "windowClose", "toast", "error", "success", "message", "focus", "alert", "achievement", "click"].map(s => (
              <button key={s} onClick={() => playSound(s)} style={{ padding: "4px 10px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 6, cursor: "pointer", fontFamily: FFM, fontWeight: 500, fontSize: 10, color: "var(--nv-text)" }}>▶ {s}</button>
            ))}
          </div>
        </>)}

        {section === "network" && (<>
          <div style={PANE_TITLE}>Network</div>
          <div style={PANE_SUB}>Your current connection status.</div>

          {/* Status card */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12, marginBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: net.online ? fill(AC) : "rgba(255,90,90,0.12)", border: "1px solid " + (net.online ? bdr(AC) : "rgba(255,90,90,0.3)"), color: net.online ? AC : "#ff8b8b" }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text-strong)" }}>{connLabel}</div>
              <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginTop: 2 }}>{net.online ? "You're online" : "No internet connection"}</div>
            </div>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: net.online ? "#4cef90" : "#ff5555", boxShadow: net.online ? "0 0 8px #4cef90" : "0 0 8px #ff5555" }} />
          </div>

          {/* Details (only what the browser exposes) */}
          <div style={SEC}>Details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 16, padding: "4px 0", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 10 }}>
            {[
              ["Status", net.online ? "Connected" : "Offline"],
              ["Connection", net.type ? connLabel : "Unknown (not exposed by browser)"],
              ["Estimated speed", net.downlink != null ? net.downlink + " Mbps" : "Not available"],
              ["Quality", net.effectiveType ? net.effectiveType.toUpperCase() : "Not available"],
              ["Latency", net.rtt != null ? net.rtt + " ms" : "Not available"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--nv-border)" }}>
                <span style={{ fontSize: 12, color: "var(--nv-text)" }}>{k}</span>
                <span style={{ fontFamily: FFM, fontSize: 11.5, color: "var(--nv-text-strong)" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", lineHeight: 1.6, padding: "10px 12px", background: "rgba(255,200,80,0.05)", border: "1px solid rgba(255,200,0,0.14)", borderRadius: 8 }}>
            ℹ Nova OS runs in your browser, so it can show your connection status but can't list or switch Wi-Fi networks — that's managed by your device's own system settings. (Some details depend on browser support and may show "Not available.")
          </div>
        </>)}

        {section === "widgets" && (<>
          <div style={PANE_TITLE}>Widgets</div>
          <div style={PANE_SUB}>The floating panels on your desktop. Drag a header to move · drag edges to resize.</div>

          <div style={SEC}>Desktop Widgets</div>
          {Object.entries(WIDGET_CONFIGS).map(([id, cfg]) => (
            <Toggle key={id} label={cfg.emoji + "  " + cfg.label} value={!!widgets[id]} onChange={v => setWidget(id, v)} ac={AC} />
          ))}
          {widgets.weather && <div style={{ fontSize: 11, color: "rgba(255,200,80,0.7)", fontFamily: FF, padding: "7px 10px", background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.15)", borderRadius: 6, marginBottom: 6, marginTop: 8 }}>⚠ Weather needs location access — allow it in your browser when prompted.</div>}
        </>)}

        {section === "keyboard" && (<>
          <div style={PANE_TITLE}>Keyboard</div>
          <div style={PANE_SUB}>Global shortcuts. Browsers reserve ⌘/Ctrl combos like Cmd+W, so Nova uses Alt-based bindings.</div>

          <div style={SEC}>Shortcuts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "10px 12px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8 }}>
            {[
              ["⌘/Ctrl + K", "Spotlight global search"],
              ["⌘/Ctrl + ,", "Open Settings"],
              ["Esc", "Close start menu / dialogs"],
              ["Alt + W", "Close active window"],
              ["Alt + M", "Minimize active window"],
              ["Alt + ←/→", "Snap window left / right"],
              ["Alt + ↑/↓", "Maximize / restore window"],
              ["F11", "Toggle fullscreen"],
            ].map(([combo, action]) => (
              <div key={combo} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--nv-text)" }}>
                <span style={{ fontFamily: FFM, fontSize: 11, padding: "2px 7px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 4, color: "var(--nv-text-strong)", minWidth: 120, textAlign: "center" }}>{combo}</span>
                <span style={{ fontFamily: FF, opacity: 0.85 }}>{action}</span>
              </div>
            ))}
          </div>
        </>)}

        {section === "account" && (<>
          <div style={PANE_TITLE}>Account</div>
          <div style={PANE_SUB}>Your Nova OS sign-in. Your data syncs across devices.</div>

          <div style={{ padding: "11px 14px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, marginBottom: 8 }}><div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 2 }}>Signed in as</div><div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 16, color: "var(--nv-text-strong)" }}>@{user}</div></div>
          {onLogout && (
            <button onClick={onLogout} style={{ width: "100%", padding: "10px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "#ff8b8b" }}>Sign Out</button>
          )}
          {isNative() && (
            <button onClick={() => exitApp()} style={{ width: "100%", marginTop: 8, padding: "10px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text)" }}>Close Nova OS</button>
          )}
          {isDesktop() && (
            <button onClick={() => quitApp()} style={{ width: "100%", marginTop: 8, padding: "10px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text)" }}>Close Nova OS</button>
          )}
        </>)}

        {section === "about" && (<>
          <div style={PANE_TITLE}>About</div>
          <div style={PANE_SUB}>About this copy of Nova OS.</div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 18px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: fill(AC), border: "1px solid " + bdr(AC), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 800, fontSize: 30, color: AC }}>N</div>
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 20, color: "var(--nv-text-strong)", letterSpacing: 0.4 }}>Nova OS</div>
              <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 2, fontFamily: FFM }}>Version {NOVA_VERSION}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "4px 0", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 10, marginBottom: 18 }}>
            {[
              ["Edition", "Web + Desktop (Tauri)"],
              ["Built with", "React · Vite · Firebase"],
              ["Sync", "Firestore (cross-device)"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--nv-border)" }}>
                <span style={{ fontSize: 12, color: "var(--nv-text)" }}>{k}</span>
                <span style={{ fontFamily: FFM, fontSize: 11.5, color: "var(--nv-text-strong)" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* v9.1 — Trademarks & attributions. The Store lists shortcuts to
              third-party services (Roblox, YouTube, Spotify, Netflix, etc.)
              under nominative-fair-use; this footer makes the relationship
              explicit and disclaims any sponsorship/endorsement. */}
          <div style={SEC}>Trademarks &amp; Attributions</div>
          <div style={{ padding: "12px 14px", background:"var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 10, fontSize: 11.5, lineHeight: 1.6, color: "var(--nv-text-dim)" }}>
            Nova OS provides launchers to third-party services. All trademarks, logos and brand names are property of their respective owners. Nova OS is not affiliated with, endorsed by, or sponsored by any service listed in the Store.
          </div>
        </>)}

      </div>
    </div>
  );
}

// Small letter bubble for the rail header (avatar lives in the Profile app).
function UserBubble({ user, ac }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: fill(ac), border: "1px solid " + bdr(ac), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: ac }}>
      {(user || "?").charAt(0).toUpperCase()}
    </div>
  );
}

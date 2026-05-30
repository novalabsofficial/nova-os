// Mobile edition — an iOS-style shell rendered instead of the desktop
// windowing UI whenever Nova OS is on a phone (deviceMode === "mobile").
//
// Pieces:
//   • Status bar (top): time + signal / wifi / battery.
//   • Springboard: paginated home grid (4 columns), swipe horizontally between
//     pages, page dots above the dock.
//   • Dock (bottom): 4 customizable apps that persist across pages.
//   • App view: tap an app to open it fullscreen; a home indicator (tap or
//     swipe up) returns to the springboard.
//   • Control Center: swipe down from the very top — wifi / sound / etc.
//   • App Library + search: swipe down on the home body — every app + a
//     search field.
//
// Apps render through the same `renderApp` callback the desktop windows use,
// so every app works identically; it's only the shell around them that's
// different on mobile.

import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { Wallpaper } from "./wallpapers.jsx";
import { AppIconDisplay } from "./icons.jsx";
import { getSoundConfig, setSoundConfig } from "../lib/audio.js";

const COLS = 4;
const PAGE_SIZE = 24;            // 4 × 6
const DEFAULT_DOCK = ["files", "browser", "chat", "settings"];

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// ── status-bar glyphs ──────────────────────────────────────────────────────
function SignalGlyph() {
  return <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff">{[0,1,2,3].map(i=><rect key={i} x={i*4.4} y={8-i*2.4} width="3" height={3+i*2.4} rx="0.7"/>)}</svg>;
}
function WifiGlyph() {
  return <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"><path d="M1.6 3.8a10 10 0 0 1 12.8 0"/><path d="M4 6.5a6 6 0 0 1 8 0"/><path d="M6.4 9.1a2.4 2.4 0 0 1 3.2 0"/></svg>;
}
function BatteryGlyph({ level = 1 }) {
  const w = Math.max(2, Math.round(18 * level));
  return (
    <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
      <rect x="0.6" y="1.2" width="22" height="10.6" rx="3" stroke="#fff" strokeOpacity="0.5" strokeWidth="1"/>
      <rect x="2" y="2.6" width={w} height="7.8" rx="1.6" fill="#fff"/>
      <rect x="23.4" y="4.4" width="1.8" height="4.4" rx="0.9" fill="#fff" fillOpacity="0.6"/>
    </svg>
  );
}

function fmtTime(d) {
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "" : ""; void ap;
  const hr = ((h % 12) || 12);
  return hr + ":" + String(m).padStart(2, "0");
}

export function MobileShell({ AC, user, data, apps, wallpaperId, customWp, settings, updateSettings, renderApp, onAppOpen, onLogout }) {
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [control, setControl] = useState(false);
  const [library, setLibrary] = useState(false);
  const [search, setSearch] = useState("");
  const [pickSlot, setPickSlot] = useState(null);    // dock slot being edited (or null)
  const [battery, setBattery] = useState(1);
  const [vol, setVol] = useState(() => getSoundConfig().volume);
  const [dragX, setDragX] = useState(0);             // live horizontal page drag

  const dock = (settings?.mobileDock && settings.mobileDock.length === 4) ? settings.mobileDock : DEFAULT_DOCK;
  const dockSet = new Set(dock);
  const homeApps = apps.filter(a => !dockSet.has(a.id));
  const pages = chunk(homeApps, PAGE_SIZE);
  if (pages.length === 0) pages.push([]);
  const curPage = Math.min(page, pages.length - 1);

  const gest = useRef(null);     // { x0,y0,axis,moved }
  const swallowTap = useRef(false);

  // clock tick
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  // battery (best-effort)
  useEffect(() => {
    let dead = false, bm;
    if (navigator.getBattery) navigator.getBattery().then(b => {
      if (dead) return; bm = b;
      const upd = () => setBattery(b.level); upd(); b.addEventListener("levelchange", upd);
    }).catch(() => {});
    return () => { dead = true; try { bm && bm.removeEventListener && bm.removeEventListener("levelchange", () => {}); } catch {} };
  }, []);

  const appById = useCallback((id) => apps.find(a => a.id === id), [apps]);
  function openApp(id) {
    if (pickSlot !== null) { // assigning to a dock slot
      const next = [...dock]; next[pickSlot] = id;
      updateSettings?.({ mobileDock: next });
      setPickSlot(null); setLibrary(false); setSearch("");
      return;
    }
    onAppOpen?.(id);
    setOpenId(id);
    setLibrary(false); setControl(false); setSearch("");
  }
  function goHome() { setOpenId(null); }
  function setVolume(v) { setVol(v); setSoundConfig({ ...getSoundConfig(), volume: v }); }

  // ── gestures on the home surface ──────────────────────────────────────────
  function onDown(e) {
    if (openId || control || library) return;
    gest.current = { x0: e.clientX, y0: e.clientY, axis: null, moved: false };
    swallowTap.current = false;
  }
  function onMove(e) {
    const g = gest.current; if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      g.moved = true; swallowTap.current = true;
    }
    if (g.axis === "x") {
      // rubber-band at the ends
      let nx = dx;
      if ((curPage === 0 && dx > 0) || (curPage === pages.length - 1 && dx < 0)) nx = dx * 0.35;
      setDragX(nx);
    }
  }
  function onUp(e) {
    const g = gest.current; gest.current = null;
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.axis === "x") {
      const w = window.innerWidth || 390;
      if (dx < -w * 0.22 && curPage < pages.length - 1) setPage(curPage + 1);
      else if (dx > w * 0.22 && curPage > 0) setPage(curPage - 1);
      setDragX(0);
    } else if (g.axis === "y" && dy > 55) {
      if (g.y0 < 80) setControl(true);            // pulled from the very top
      else setLibrary(true);                       // pulled from the home body
    }
    setTimeout(() => { swallowTap.current = false; }, 30);
  }

  const statusDark = !openId;   // white status text over wallpaper; apps get their own bg

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", fontFamily: FF, background: "#05060f", userSelect: "none", WebkitUserSelect: "none" }}>
      <Wallpaper id={wallpaperId} customUrl={customWp} animate={!!settings?.wallpaperAnimated} />

      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", zIndex: 40, color: "#fff", pointerEvents: "none" }}>
        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, letterSpacing: 0.3, textShadow: statusDark ? "0 1px 3px rgba(0,0,0,0.4)" : "none" }}>{fmtTime(now)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, filter: statusDark ? "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" : "none" }}>
          <SignalGlyph /><WifiGlyph /><BatteryGlyph level={battery} />
        </span>
      </div>

      {/* ── Springboard (home) ─────────────────────────────────────── */}
      {!openId && (
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { gest.current = null; setDragX(0); }}
          style={{ position: "absolute", inset: 0, paddingTop: 54, display: "flex", flexDirection: "column", zIndex: 10, touchAction: "none" }}>
          {/* page track */}
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <div style={{ display: "flex", height: "100%", width: (pages.length * 100) + "%", transform: "translateX(calc(" + (-curPage * (100 / pages.length)) + "% + " + dragX + "px))", transition: dragX === 0 ? "transform 0.34s cubic-bezier(0.22,1,0.36,1)" : "none" }}>
              {pages.map((pg, pi) => (
                <div key={pi} style={{ width: (100 / pages.length) + "%", flexShrink: 0, padding: "8px 18px 0", display: "grid", gridTemplateColumns: "repeat(" + COLS + ",1fr)", gridAutoRows: "min-content", gap: "20px 8px", alignContent: "start" }}>
                  {pg.map(a => <IconTile key={a.id} app={a} onOpen={() => { if (!swallowTap.current) openApp(a.id); }} />)}
                </div>
              ))}
            </div>
          </div>

          {/* page dots */}
          {pages.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 7, padding: "10px 0 6px" }}>
              {pages.map((_, i) => <span key={i} style={{ width: i === curPage ? 7 : 6, height: i === curPage ? 7 : 6, borderRadius: "50%", background: i === curPage ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }} />)}
            </div>
          )}

          {/* dock */}
          <div style={{ margin: "4px 12px 14px", padding: "12px 14px", borderRadius: 30, background: "rgba(255,255,255,0.13)", backdropFilter: "blur(28px) saturate(160%)", WebkitBackdropFilter: "blur(28px) saturate(160%)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", justifyContent: "space-around" }}>
            {dock.map((id, i) => {
              const a = appById(id);
              if (!a) return <div key={i} style={{ width: 58 }} />;
              return <IconTile key={id} app={a} hideLabel onOpen={() => { if (!swallowTap.current) openApp(id); }} onHold={() => { setPickSlot(i); setLibrary(true); }} />;
            })}
          </div>
        </div>
      )}

      {/* ── Open app (fullscreen) ──────────────────────────────────── */}
      {openId && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", animation: "win-launch 0.26s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ height: 46, flexShrink: 0 }} />{/* status-bar spacer */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: 16 }}>
            {renderApp(openId)}
          </div>
          {/* home indicator */}
          <div onPointerDown={e => { e.currentTarget.dataset.y = e.clientY; }}
            onPointerUp={e => { const y0 = +e.currentTarget.dataset.y; if (!isNaN(y0) && y0 - e.clientY > 24) goHome(); }}
            onClick={goHome}
            style={{ height: 26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <div style={{ width: 134, height: 5, borderRadius: 3, background: "var(--nv-text-dim)" }} />
          </div>
        </div>
      )}

      {/* ── Control Center ─────────────────────────────────────────── */}
      {control && <ControlCenter AC={AC} vol={vol} setVolume={setVolume} onClose={() => setControl(false)} />}

      {/* ── App Library + search ───────────────────────────────────── */}
      {library && (
        <AppLibrary AC={AC} apps={apps} search={search} setSearch={setSearch} pickMode={pickSlot !== null}
          onPick={openApp} onClose={() => { setLibrary(false); setSearch(""); setPickSlot(null); }} />
      )}
    </div>
  );
}

// ── an app icon tile (icon + label), with tap + long-press ──────────────────
function IconTile({ app, onOpen, onHold, hideLabel }) {
  const holdRef = useRef(null);
  const start = () => { if (onHold) holdRef.current = setTimeout(() => { holdRef.current = "fired"; onHold(); }, 480); };
  const end = (fire) => {
    const h = holdRef.current; holdRef.current = null;
    if (h && h !== "fired") { clearTimeout(h); if (fire) onOpen(); }
    else if (h !== "fired" && fire) onOpen();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
      <div
        onPointerDown={start}
        onPointerUp={() => end(true)}
        onPointerLeave={() => { if (holdRef.current && holdRef.current !== "fired") { clearTimeout(holdRef.current); holdRef.current = null; } }}
        className="ps"
        style={{ cursor: "pointer", borderRadius: 15, overflow: "hidden", lineHeight: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.32)" }}
      >
        <AppIconDisplay app={app} size={58} />
      </div>
      {!hideLabel && <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.55)", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{app.label}</span>}
    </div>
  );
}

// ── Control Center (swipe down from top) ────────────────────────────────────
function ControlCenter({ AC, vol, setVolume, onClose }) {
  const toggles = [
    { id: "airplane", icon: "✈", label: "Airplane", on: false },
    { id: "wifi", icon: "📶", label: "Wi-Fi", on: true },
    { id: "cell", icon: "📱", label: "Cellular", on: true },
    { id: "bt", icon: "🔵", label: "Bluetooth", on: true },
  ];
  const [tg, setTg] = useState(() => Object.fromEntries(toggles.map(t => [t.id, t.on])));
  const startY = useRef(0);
  const tile = (on) => ({ flex: 1, aspectRatio: "1", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", background: on ? fill(AC) : "rgba(255,255,255,0.1)", color: on ? AC : "rgba(255,255,255,0.85)", fontFamily: FFB, fontWeight: 600, fontSize: 11 });
  return (
    <div
      onPointerDown={e => { startY.current = e.clientY; }}
      onPointerUp={e => { if (e.target === e.currentTarget && startY.current - e.clientY > 30) onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 60, padding: "54px 16px 0", background: "rgba(6,8,18,0.45)", backdropFilter: "blur(34px) saturate(150%)", WebkitBackdropFilter: "blur(34px) saturate(150%)", animation: "panel-down 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {toggles.map(t => (
            <div key={t.id} onClick={() => setTg(s => ({ ...s, [t.id]: !s[t.id] }))} style={tile(tg[t.id])}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}
            </div>
          ))}
        </div>
        <CCSlider icon="🔆" label="Brightness" value={0.8} onChange={() => {}} AC={AC} />
        <CCSlider icon="🔊" label="Volume" value={vol} onChange={setVolume} AC={AC} />
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 11.5, fontFamily: FFM, marginTop: 4 }}>swipe up or tap to close</div>
      </div>
    </div>
  );
}
function CCSlider({ icon, label, value, onChange, AC }) {
  const ref = useRef(null);
  const set = (clientX) => { const r = ref.current.getBoundingClientRect(); onChange(Math.max(0, Math.min(1, (clientX - r.left) / r.width))); };
  return (
    <div style={{ padding: "16px 16px", borderRadius: 20, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12 }}><span>{icon}</span>{label}</div>
      <div ref={ref} onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); set(e.clientX); }} onPointerMove={e => { if (e.buttons) set(e.clientX); }}
        style={{ height: 30, borderRadius: 15, background: "rgba(255,255,255,0.18)", position: "relative", cursor: "pointer", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.round(value * 100) + "%", background: "#fff", borderRadius: 15 }} />
      </div>
    </div>
  );
}

// ── App Library + search (swipe down on home) ───────────────────────────────
function AppLibrary({ AC, apps, search, setSearch, pickMode, onPick, onClose }) {
  const q = search.trim().toLowerCase();
  const list = q ? apps.filter(a => a.label.toLowerCase().includes(q) || a.id.includes(q)) : apps;
  const startY = useRef(0);
  return (
    <div
      onPointerDown={e => { if (e.target === e.currentTarget) startY.current = e.clientY; }}
      onPointerUp={e => { if (e.target === e.currentTarget && startY.current - e.clientY > 30) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 60, paddingTop: 50, background: "rgba(6,8,18,0.62)", backdropFilter: "blur(36px) saturate(150%)", WebkitBackdropFilter: "blur(36px) saturate(150%)", display: "flex", flexDirection: "column", animation: "panel-down 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
      <div style={{ padding: "8px 18px 12px" }}>
        {pickMode && <div style={{ textAlign: "center", color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Choose an app for the dock</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, background: "rgba(255,255,255,0.14)", borderRadius: 12 }}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>🔍</span>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: FF, fontSize: 15 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px 8px", alignContent: "start" }}>
          {list.map(a => <IconTile key={a.id} app={a} onOpen={() => onPick(a.id)} />)}
          {list.length === 0 && <div style={{ gridColumn: "span 4", textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>No apps found</div>}
        </div>
      </div>
    </div>
  );
}

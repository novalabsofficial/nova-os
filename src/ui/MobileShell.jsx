// Mobile edition — an iOS-style shell rendered instead of the desktop
// windowing UI whenever Nova OS is on a phone (deviceMode === "mobile").
//
// Layout:
//   • Status bar (top): time + signal / wifi / battery.
//   • Springboard: paginated home grid (4 cols), live horizontal swipe + dots,
//     a widget row on the first page, and a customizable 4-app dock.
//   • Persistent bottom bar (home indicator): swipe up to go home / open the
//     app drawer; LONG-PRESS to open the app switcher (all open apps).
//   • App view: tap an app to open it fullscreen.
//   • Control Center: swipe DOWN from the top — toggles + sliders; swipe UP to
//     close.
//   • App Library (drawer): swipe UP on the home — every app + search; swipe
//     down (or Done) to close.
//
// Apps render through the shared renderApp callback (same as desktop windows).

import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { Wallpaper } from "./wallpapers.jsx";
import { AppIconDisplay } from "./icons.jsx";
import { HAS_SVG_ICON } from "./constants.js";
import { getSoundConfig, setSoundConfig } from "../lib/audio.js";

const COLS = 4;
const PER_PAGE = 16;            // 4 × 4 fits comfortably on a phone without scroll
const DEFAULT_DOCK = ["files", "browser", "chat", "settings"];
const TILE_PALETTE = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#3b82f6", "#14b8a6", "#f43f5e"];

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
function hashColor(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return TILE_PALETTE[h % TILE_PALETTE.length]; }
function fmtTime(d) { const h = d.getHours(); return ((h % 12) || 12) + ":" + String(d.getMinutes()).padStart(2, "0"); }

// ── status-bar glyphs ──────────────────────────────────────────────────────
function SignalGlyph() { return <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff">{[0,1,2,3].map(i=><rect key={i} x={i*4.4} y={8-i*2.4} width="3" height={3+i*2.4} rx="0.7"/>)}</svg>; }
function WifiGlyph() { return <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"><path d="M1.6 3.8a10 10 0 0 1 12.8 0"/><path d="M4 6.5a6 6 0 0 1 8 0"/><path d="M6.4 9.1a2.4 2.4 0 0 1 3.2 0"/></svg>; }
function BatteryGlyph({ level = 1 }) {
  const w = Math.max(2, Math.round(18 * level));
  return (<svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.6" y="1.2" width="22" height="10.6" rx="3" stroke="#fff" strokeOpacity="0.5" strokeWidth="1"/><rect x="2" y="2.6" width={w} height="7.8" rx="1.6" fill="#fff"/><rect x="23.4" y="4.4" width="1.8" height="4.4" rx="0.9" fill="#fff" fillOpacity="0.6"/></svg>);
}

// ── a full-bleed iOS app icon ───────────────────────────────────────────────
// SVG-icon apps + glass mode already render as full rounded tiles via
// AppIconDisplay; emoji-only apps get a solid colored tile so they match
// (instead of the faint translucent box).
function MobileIcon({ app, size, glass }) {
  if (glass || app.storeApp || HAS_SVG_ICON.has(app.id)) return <AppIconDisplay app={app} size={size} glass={glass} />;
  const c = hashColor(app.id);
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.225), background: "linear-gradient(150deg," + c + ", rgba(0,0,0,0.25))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{app.icon || "📦"}</div>
  );
}

function IconTile({ app, glass, onOpen, onHold, hideLabel, size = 60 }) {
  const hold = useRef(null);
  const start = () => { if (onHold) hold.current = setTimeout(() => { hold.current = "fired"; onHold(); }, 480); };
  const clear = () => { if (hold.current && hold.current !== "fired") { clearTimeout(hold.current); hold.current = null; } };
  const up = () => { const h = hold.current; hold.current = null; if (h === "fired") return; if (h) clearTimeout(h); onOpen(); };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
      <div className="ps" onPointerDown={start} onPointerUp={up} onPointerLeave={clear} onPointerCancel={clear}
        style={{ cursor: "pointer", lineHeight: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.34))" }}>
        <MobileIcon app={app} size={size} glass={glass} />
      </div>
      {!hideLabel && <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.55)", maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{app.label}</span>}
    </div>
  );
}

export function MobileShell({ AC, user, data, apps, wallpaperId, customWp, settings, updateSettings, renderApp, onAppOpen, widgets }) {
  const glass = !!settings?.glass;
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [openApps, setOpenApps] = useState([]);       // recent/open stack
  const [control, setControl] = useState(false);
  const [library, setLibrary] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [search, setSearch] = useState("");
  const [pickSlot, setPickSlot] = useState(null);
  const [battery, setBattery] = useState(1);
  const [vol, setVol] = useState(() => getSoundConfig().volume);
  const [dragX, setDragX] = useState(0);

  const dock = (settings?.mobileDock && settings.mobileDock.length === 4) ? settings.mobileDock : DEFAULT_DOCK;
  const dockSet = new Set(dock);
  const homeApps = apps.filter(a => !dockSet.has(a.id));
  // page 0 holds fewer icons when a widget row is present (so nothing clips on
  // short phones, where the home grid can't scroll). Other pages hold PER_PAGE.
  const hasWidgets = widgets && widgets.length > 0;
  const cap0 = hasWidgets ? 8 : PER_PAGE;
  const pages = [homeApps.slice(0, cap0), ...chunk(homeApps.slice(cap0), PER_PAGE)].filter((p, i) => i === 0 || p.length);
  if (pages.length === 0) pages.push([]);
  const curPage = Math.min(page, pages.length - 1);
  const appById = useCallback((id) => apps.find(a => a.id === id), [apps]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let dead = false;
    if (navigator.getBattery) navigator.getBattery().then(b => { if (dead) return; const upd = () => setBattery(b.level); upd(); b.addEventListener("levelchange", upd); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  function openApp(id) {
    if (pickSlot !== null) { const next = [...dock]; next[pickSlot] = id; updateSettings?.({ mobileDock: next }); setPickSlot(null); setLibrary(false); setSearch(""); return; }
    onAppOpen?.(id);
    setOpenApps(s => [id, ...s.filter(x => x !== id)]);
    setOpenId(id); setLibrary(false); setControl(false); setSwitcher(false); setSearch("");
  }
  function goHome() { setOpenId(null); }
  function closeApp(id) { setOpenApps(s => s.filter(x => x !== id)); if (openId === id) setOpenId(null); }
  function setVolume(v) { setVol(v); setSoundConfig({ ...getSoundConfig(), volume: v }); }

  // ── springboard gestures ──────────────────────────────────────────────────
  const gest = useRef(null);
  const swallow = useRef(false);
  function onDown(e) { gest.current = { x0: e.clientX, y0: e.clientY, axis: null }; swallow.current = false; }
  function onMove(e) {
    const g = gest.current; if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) { g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; swallow.current = true; }
    if (g.axis === "x") { let nx = dx; if ((curPage === 0 && dx > 0) || (curPage === pages.length - 1 && dx < 0)) nx = dx * 0.35; setDragX(nx); }
  }
  function onUp(e) {
    const g = gest.current; gest.current = null; if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.axis === "x") {
      const w = window.innerWidth || 390;
      if (dx < -w * 0.2 && curPage < pages.length - 1) setPage(curPage + 1);
      else if (dx > w * 0.2 && curPage > 0) setPage(curPage - 1);
      setDragX(0);
    } else if (g.axis === "y") {
      if (dy > 55 && g.y0 < 80) setControl(true);     // pull down from top → Control Center
      else if (dy < -55) setLibrary(true);            // swipe up → App Library (drawer)
    }
    setTimeout(() => { swallow.current = false; }, 30);
  }

  // ── persistent bottom bar (home indicator) gestures ──────────────────────
  const bar = useRef(null);
  function barDown(e) { bar.current = { y0: e.clientY, moved: false, hold: setTimeout(() => { if (bar.current) { bar.current.hold = "fired"; setSwitcher(true); } }, 450) }; }
  function barMove(e) { const b = bar.current; if (!b) return; if (Math.abs(e.clientY - b.y0) > 8) { b.moved = true; if (b.hold && b.hold !== "fired") { clearTimeout(b.hold); b.hold = null; } } }
  function barUp(e) {
    const b = bar.current; bar.current = null; if (!b) return;
    if (b.hold === "fired") return;            // long-press already opened switcher
    if (b.hold) clearTimeout(b.hold);
    const dy = e.clientY - b.y0;
    if (dy < -22) { openId ? goHome() : setLibrary(true); }
    else if (!b.moved) { if (openId) goHome(); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", fontFamily: FF, background: "#05060f", userSelect: "none", WebkitUserSelect: "none" }}>
      <Wallpaper id={wallpaperId} customUrl={customWp} animate={!!settings?.wallpaperAnimated} />

      {/* Status bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", zIndex: 40, color: "#fff", pointerEvents: "none" }}>
        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, letterSpacing: 0.3, textShadow: openId ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }}>{fmtTime(now)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, filter: openId ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}><SignalGlyph /><WifiGlyph /><BatteryGlyph level={battery} /></span>
      </div>

      {/* Springboard */}
      {!openId && (
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { gest.current = null; setDragX(0); }}
          style={{ position: "absolute", inset: 0, paddingTop: 52, paddingBottom: 30, display: "flex", flexDirection: "column", zIndex: 10, touchAction: "none" }}>
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <div style={{ display: "flex", height: "100%", width: (pages.length * 100) + "%", transform: "translateX(calc(" + (-curPage * (100 / pages.length)) + "% + " + dragX + "px))", transition: dragX === 0 ? "transform 0.34s cubic-bezier(0.22,1,0.36,1)" : "none" }}>
              {pages.map((pg, pi) => (
                <div key={pi} style={{ width: (100 / pages.length) + "%", flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
                  {/* widget row on the first page */}
                  {pi === 0 && widgets && widgets.length > 0 && (
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 18px 14px", scrollbarWidth: "none" }}>
                      {widgets.map(w => (
                        <div key={w.id} style={{ flexShrink: 0, width: 168, height: 150, borderRadius: 20, overflow: "hidden", padding: 12, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(24px) saturate(150%)", WebkitBackdropFilter: "blur(24px) saturate(150%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 22px rgba(0,0,0,0.3)" }}>{w.content}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "4px 18px 0", display: "grid", gridTemplateColumns: "repeat(" + COLS + ",1fr)", gridAutoRows: "min-content", gap: "20px 8px", alignContent: "start" }}>
                    {pg.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => { if (!swallow.current) openApp(a.id); }} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {pages.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 7, padding: "8px 0 6px" }}>
              {pages.map((_, i) => <span key={i} style={{ width: i === curPage ? 7 : 6, height: i === curPage ? 7 : 6, borderRadius: "50%", background: i === curPage ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }} />)}
            </div>
          )}

          {/* dock */}
          <div style={{ margin: "4px 12px 6px", padding: "12px 14px", borderRadius: 30, background: "rgba(255,255,255,0.13)", backdropFilter: "blur(28px) saturate(160%)", WebkitBackdropFilter: "blur(28px) saturate(160%)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", justifyContent: "space-around" }}>
            {dock.map((id, i) => { const a = appById(id); if (!a) return <div key={i} style={{ width: 60 }} />; return <IconTile key={id} app={a} glass={glass} hideLabel onOpen={() => { if (!swallow.current) openApp(id); }} onHold={() => { setPickSlot(i); setLibrary(true); }} />; })}
          </div>
        </div>
      )}

      {/* Open app (fullscreen) */}
      {openId && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", animation: "win-launch 0.26s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ height: 46, flexShrink: 0 }} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "12px 14px 30px" }}>{renderApp(openId)}</div>
        </div>
      )}

      {/* Persistent bottom bar (home indicator) — always visible, big hit area */}
      <div onPointerDown={barDown} onPointerMove={barMove} onPointerUp={barUp} onPointerCancel={() => { if (bar.current?.hold && bar.current.hold !== "fired") clearTimeout(bar.current.hold); bar.current = null; }}
        title="Swipe up: home · Hold: open apps"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26, zIndex: 35, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: "pointer" }}>
        <div style={{ width: 138, height: 5, borderRadius: 3, background: openId ? "var(--nv-text-dim)" : "rgba(255,255,255,0.65)", boxShadow: openId ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }} />
      </div>

      {/* Control Center */}
      {control && <ControlCenter AC={AC} vol={vol} setVolume={setVolume} onClose={() => setControl(false)} />}

      {/* App Library + search */}
      {library && <AppLibrary AC={AC} apps={apps} glass={glass} search={search} setSearch={setSearch} pickMode={pickSlot !== null} onPick={openApp} onClose={() => { setLibrary(false); setSearch(""); setPickSlot(null); }} />}

      {/* App switcher */}
      {switcher && <AppSwitcher AC={AC} openApps={openApps} appById={appById} glass={glass} onPick={openApp} onClose={(id) => closeApp(id)} onDismiss={() => setSwitcher(false)} />}
    </div>
  );
}

// ── Control Center (swipe down from top; swipe up to close) ─────────────────
function ControlCenter({ AC, vol, setVolume, onClose }) {
  const toggles = [
    { id: "airplane", icon: "✈️", label: "Airplane" }, { id: "wifi", icon: "📶", label: "Wi-Fi" },
    { id: "cell", icon: "📡", label: "Cellular" }, { id: "bt", icon: "🔵", label: "Bluetooth" },
  ];
  const [tg, setTg] = useState({ wifi: true, cell: true, bt: true });
  const sy = useRef(0);
  const tile = (on) => ({ flex: 1, aspectRatio: "1", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", background: on ? fill(AC) : "rgba(255,255,255,0.1)", color: on ? AC : "rgba(255,255,255,0.85)", fontFamily: FFB, fontWeight: 600, fontSize: 11 });
  return (
    <div onPointerDown={e => { sy.current = e.clientY; }} onPointerUp={e => { if (sy.current - e.clientY > 38) onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 60, padding: "30px 16px 0", background: "rgba(6,8,18,0.5)", backdropFilter: "blur(34px) saturate(150%)", WebkitBackdropFilter: "blur(34px) saturate(150%)", animation: "panel-down 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}><div style={{ width: 38, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} /></div>
        <div style={{ display: "flex", gap: 12 }}>{toggles.map(t => (<div key={t.id} onClick={() => setTg(s => ({ ...s, [t.id]: !s[t.id] }))} style={tile(!!tg[t.id])}><span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}</div>))}</div>
        <CCSlider icon="🔆" label="Brightness" value={0.85} onChange={() => {}} />
        <CCSlider icon="🔊" label="Volume" value={vol} onChange={setVolume} />
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 11.5, fontFamily: FFM, marginTop: 2 }}>swipe up or tap to close</div>
      </div>
    </div>
  );
}
function CCSlider({ icon, label, value, onChange }) {
  const ref = useRef(null);
  const set = (x) => { const r = ref.current.getBoundingClientRect(); onChange(Math.max(0, Math.min(1, (x - r.left) / r.width))); };
  return (
    <div style={{ padding: "16px", borderRadius: 20, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12 }}><span>{icon}</span>{label}</div>
      <div ref={ref} onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); set(e.clientX); }} onPointerMove={e => { e.stopPropagation(); if (e.buttons) set(e.clientX); }} onPointerUp={e => e.stopPropagation()}
        style={{ height: 30, borderRadius: 15, background: "rgba(255,255,255,0.18)", position: "relative", cursor: "pointer", overflow: "hidden", touchAction: "none" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.round(value * 100) + "%", background: "#fff", borderRadius: 15 }} />
      </div>
    </div>
  );
}

// ── App Library (swipe up on home; swipe down on header / Done to close) ────
function AppLibrary({ AC, apps, glass, search, setSearch, pickMode, onPick, onClose }) {
  const q = search.trim().toLowerCase();
  const list = q ? apps.filter(a => a.label.toLowerCase().includes(q) || a.id.includes(q)) : apps;
  const sy = useRef(0);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, paddingTop: 48, background: "rgba(6,8,18,0.66)", backdropFilter: "blur(36px) saturate(150%)", WebkitBackdropFilter: "blur(36px) saturate(150%)", display: "flex", flexDirection: "column", animation: "panel-up 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
      {/* header (swipe DOWN here to close) */}
      <div onPointerDown={e => { sy.current = e.clientY; }} onPointerUp={e => { if (e.clientY - sy.current > 38) onClose(); }} style={{ padding: "6px 18px 12px", touchAction: "none" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}><div style={{ width: 38, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} /></div>
        {pickMode && <div style={{ textAlign: "center", color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Choose an app for the dock</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, background: "rgba(255,255,255,0.14)", borderRadius: 12 }}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>🔍</span>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: FF, fontSize: 15 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px 8px", alignContent: "start" }}>
          {list.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => onPick(a.id)} />)}
          {list.length === 0 && <div style={{ gridColumn: "span 4", textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>No apps found</div>}
        </div>
      </div>
    </div>
  );
}

// ── App switcher (long-press the bottom bar) ────────────────────────────────
function AppSwitcher({ AC, openApps, appById, glass, onPick, onClose, onDismiss }) {
  const sy = useRef(0);
  return (
    <div onPointerDown={e => { if (e.target === e.currentTarget) sy.current = e.clientY; }} onPointerUp={e => { if (e.target === e.currentTarget) onDismiss(); }}
      style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(5,7,16,0.72)", backdropFilter: "blur(30px) saturate(140%)", WebkitBackdropFilter: "blur(30px) saturate(140%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, animation: "ss-fade 0.16s" }}>
      <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: 0.3 }}>Open apps</div>
      {openApps.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontStyle: "italic" }}>No open apps</div>
      ) : (
        <div style={{ display: "flex", gap: 16, overflowX: "auto", maxWidth: "100%", padding: "0 24px 6px" }}>
          {openApps.map(id => { const a = appById(id); if (!a) return null; return <SwitcherCard key={id} app={a} glass={glass} onOpen={() => onPick(id)} onClose={() => onClose(id)} />; })}
        </div>
      )}
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11.5, fontFamily: FFM }}>tap a card to open · swipe a card up to close</div>
    </div>
  );
}
function SwitcherCard({ app, glass, onOpen, onClose }) {
  const sy = useRef(null);
  return (
    <div onPointerDown={e => { sy.current = e.clientY; }} onPointerUp={e => { if (sy.current != null && sy.current - e.clientY > 40) { onClose(); } else { onOpen(); } sy.current = null; }}
      style={{ flexShrink: 0, width: 150, height: 200, borderRadius: 20, background: "var(--nv-surface-solid)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, cursor: "pointer" }}>
      <MobileIcon app={app} size={64} glass={glass} />
      <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff" }}>{app.label}</span>
    </div>
  );
}

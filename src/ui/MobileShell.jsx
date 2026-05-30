// Mobile edition — an iOS-style shell rendered instead of the desktop
// windowing UI whenever Nova OS is on a phone (deviceMode === "mobile").
//
// Gestures use native TOUCH events (with a mouse fallback for desktop testing)
// rather than Pointer Events, which proved unreliable on real phones here.
//
// Layout: status bar · paginated springboard (4 cols) + widget row + dock ·
// persistent bottom bar (swipe up = home/drawer, long-press = app switcher) ·
// Control Center (swipe down from top, swipe up to close) · App Library
// (swipe up / down from the middle, search).

import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { Wallpaper } from "./wallpapers.jsx";
import { AppIconDisplay } from "./icons.jsx";
import { HAS_SVG_ICON } from "./constants.js";
import { getSoundConfig, setSoundConfig } from "../lib/audio.js";

const COLS = 4;
const PER_PAGE = 16;
const DEFAULT_DOCK = ["files", "browser", "chat", "settings"];
const TILE_PALETTE = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#3b82f6", "#14b8a6", "#f43f5e"];

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const hashColor = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return TILE_PALETTE[h % TILE_PALETTE.length]; };
const fmtTime = (d) => ((d.getHours() % 12) || 12) + ":" + String(d.getMinutes()).padStart(2, "0");
// coords from a touch OR mouse event
const pt = (e) => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;

function SignalGlyph() { return <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff">{[0,1,2,3].map(i=><rect key={i} x={i*4.4} y={8-i*2.4} width="3" height={3+i*2.4} rx="0.7"/>)}</svg>; }
function WifiGlyph() { return <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"><path d="M1.6 3.8a10 10 0 0 1 12.8 0"/><path d="M4 6.5a6 6 0 0 1 8 0"/><path d="M6.4 9.1a2.4 2.4 0 0 1 3.2 0"/></svg>; }
function BatteryGlyph({ level = 1 }) {
  const w = Math.max(2, Math.round(18 * level));
  return (<svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.6" y="1.2" width="22" height="10.6" rx="3" stroke="#fff" strokeOpacity="0.5" strokeWidth="1"/><rect x="2" y="2.6" width={w} height="7.8" rx="1.6" fill="#fff"/><rect x="23.4" y="4.4" width="1.8" height="4.4" rx="0.9" fill="#fff" fillOpacity="0.6"/></svg>);
}

// full-bleed iOS app icon
function MobileIcon({ app, size, glass }) {
  if (glass || app.storeApp || HAS_SVG_ICON.has(app.id)) return <AppIconDisplay app={app} size={size} glass={glass} />;
  const c = hashColor(app.id);
  return <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.225), background: "linear-gradient(150deg," + c + ", rgba(0,0,0,0.25))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{app.icon || "📦"}</div>;
}

// visual-only icon for the springboard (parent owns gestures via data-app)
function IconVisual({ app, glass, hideLabel, size = 60, ...rest }) {
  return (
    <div {...rest} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
      <div style={{ lineHeight: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.34))" }}><MobileIcon app={app} size={size} glass={glass} /></div>
      {!hideLabel && <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.55)", maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{app.label}</span>}
    </div>
  );
}

// tappable icon (used inside the App Library, which scrolls natively)
function IconTile({ app, glass, onOpen, size = 60 }) {
  const moved = useRef(false);
  return (
    <div className="ps" onTouchStart={() => { moved.current = false; }} onTouchMove={() => { moved.current = true; }} onTouchEnd={() => { if (!moved.current) onOpen(); }} onClick={() => onOpen()}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", cursor: "pointer" }}>
      <div style={{ lineHeight: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.34))" }}><MobileIcon app={app} size={size} glass={glass} /></div>
      <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.55)", maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{app.label}</span>
    </div>
  );
}

export function MobileShell({ AC, user, data, apps, wallpaperId, customWp, settings, updateSettings, renderApp, onAppOpen, widgets }) {
  const glass = !!settings?.glass;
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [openApps, setOpenApps] = useState([]);
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
  const hasWidgets = widgets && widgets.length > 0;
  const cap0 = hasWidgets ? 8 : PER_PAGE;
  const pages = [homeApps.slice(0, cap0), ...chunk(homeApps.slice(cap0), PER_PAGE)].filter((p, i) => i === 0 || p.length);
  if (pages.length === 0) pages.push([]);
  const curPage = Math.min(page, pages.length - 1);
  const appById = useCallback((id) => apps.find(a => a.id === id), [apps]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { let dead = false; if (navigator.getBattery) navigator.getBattery().then(b => { if (dead) return; const upd = () => setBattery(b.level); upd(); b.addEventListener("levelchange", upd); }).catch(() => {}); return () => { dead = true; }; }, []);

  function openApp(id) {
    if (pickSlot !== null) { const next = [...dock]; next[pickSlot] = id; updateSettings?.({ mobileDock: next }); setPickSlot(null); setLibrary(false); setSearch(""); return; }
    onAppOpen?.(id);
    setOpenApps(s => [id, ...s.filter(x => x !== id)]);
    setOpenId(id); setLibrary(false); setControl(false); setSwitcher(false); setSearch("");
  }
  const goHome = () => setOpenId(null);
  const closeApp = (id) => { setOpenApps(s => s.filter(x => x !== id)); if (openId === id) setOpenId(null); };
  const setVolume = (v) => { setVol(v); setSoundConfig({ ...getSoundConfig(), volume: v }); };

  // ── springboard gestures (touch + mouse) ──────────────────────────────────
  const gest = useRef(null);
  function onDown(e) {
    const p = pt(e);
    const el = e.target.closest ? e.target.closest("[data-app]") : null;
    const g = { x0: p.clientX, y0: p.clientY, axis: null, app: el?.getAttribute("data-app") || null, dock: el?.getAttribute("data-dock"), hold: null };
    if (g.dock != null) g.hold = setTimeout(() => { if (gest.current === g) { g.hold = "fired"; setPickSlot(+g.dock); setLibrary(true); } }, 470);
    gest.current = g;
  }
  function onMove(e) {
    const g = gest.current; if (!g) return;
    const p = pt(e); const dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (!g.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; if (g.hold && g.hold !== "fired") { clearTimeout(g.hold); g.hold = null; } }
    if (g.axis === "x") { let nx = dx; if ((curPage === 0 && dx > 0) || (curPage === pages.length - 1 && dx < 0)) nx = dx * 0.35; setDragX(nx); }
  }
  function onUp(e) {
    const g = gest.current; gest.current = null; if (!g) return;
    if (g.hold && g.hold !== "fired") clearTimeout(g.hold);
    if (g.hold === "fired") { setDragX(0); return; }
    const p = pt(e); const dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (g.axis === "x") {
      if (dx <= -40 && curPage < pages.length - 1) setPage(curPage + 1);
      else if (dx >= 40 && curPage > 0) setPage(curPage - 1);
      setDragX(0);
    } else if (g.axis === "y") {
      // direction-pure so up/down never get confused: UP → App Drawer,
      // DOWN → Control Center (from anywhere on the home screen).
      if (dy < -46) setLibrary(true);
      else if (dy > 46) setControl(true);
      setDragX(0);
    } else if (g.app) { openApp(g.app); }
  }
  const padEvents = { onTouchStart: onDown, onTouchMove: onMove, onTouchEnd: onUp, onTouchCancel: () => { gest.current = null; setDragX(0); }, onMouseDown: onDown, onMouseMove: onMove, onMouseUp: onUp };

  // ── bottom bar gestures ───────────────────────────────────────────────────
  const bar = useRef(null);
  function barDown(e) { const y0 = pt(e).clientY; bar.current = { y0, moved: false, hold: setTimeout(() => { if (bar.current) { bar.current.hold = "fired"; setSwitcher(true); } }, 400) }; }
  function barMove(e) { const b = bar.current; if (!b) return; if (Math.abs(pt(e).clientY - b.y0) > 14) { b.moved = true; if (b.hold && b.hold !== "fired") { clearTimeout(b.hold); b.hold = null; } } }
  function barUp(e) {
    const b = bar.current; bar.current = null; if (!b) return;
    if (b.hold === "fired") return;
    if (b.hold) clearTimeout(b.hold);
    const dy = pt(e).clientY - b.y0;
    if (dy < -20) { openId ? goHome() : setLibrary(true); }
    else if (!b.moved && openId) goHome();
  }
  const barEvents = { onTouchStart: barDown, onTouchMove: barMove, onTouchEnd: barUp, onTouchCancel: () => { bar.current = null; }, onMouseDown: barDown, onMouseMove: barMove, onMouseUp: barUp };

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
        <div {...padEvents} style={{ position: "absolute", inset: 0, paddingTop: 52, paddingBottom: 42, display: "flex", flexDirection: "column", zIndex: 10, touchAction: "none" }}>
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <div style={{ display: "flex", height: "100%", width: (pages.length * 100) + "%", transform: "translateX(calc(" + (-curPage * (100 / pages.length)) + "% + " + dragX + "px))", transition: dragX === 0 ? "transform 0.34s cubic-bezier(0.22,1,0.36,1)" : "none" }}>
              {pages.map((pg, pi) => (
                <div key={pi} style={{ width: (100 / pages.length) + "%", flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  {pi === 0 && hasWidgets && (
                    <div style={{ display: "flex", gap: 12, overflowX: "hidden", padding: "4px 18px 14px" }}>
                      {widgets.slice(0, 2).map(w => (
                        <div key={w.id} style={{ flex: 1, minWidth: 0, height: 150, borderRadius: 20, overflow: "hidden", padding: 12, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(24px) saturate(150%)", WebkitBackdropFilter: "blur(24px) saturate(150%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 22px rgba(0,0,0,0.3)" }}>{w.content}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "4px 18px 0", display: "grid", gridTemplateColumns: "repeat(" + COLS + ",1fr)", gridAutoRows: "min-content", gap: "20px 8px", alignContent: "start" }}>
                    {pg.map(a => <IconVisual key={a.id} app={a} glass={glass} data-app={a.id} />)}
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

          <div style={{ margin: "4px 12px 6px", padding: "12px 14px", borderRadius: 30, background: "rgba(255,255,255,0.13)", backdropFilter: "blur(28px) saturate(160%)", WebkitBackdropFilter: "blur(28px) saturate(160%)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", justifyContent: "space-around" }}>
            {dock.map((id, i) => { const a = appById(id); if (!a) return <div key={i} style={{ width: 60 }} />; return <IconVisual key={id} app={a} glass={glass} hideLabel data-app={id} data-dock={i} />; })}
          </div>
        </div>
      )}

      {/* Open app */}
      {openId && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", animation: "win-launch 0.26s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ height: 46, flexShrink: 0 }} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "12px 14px 40px" }}>{renderApp(openId)}</div>
        </div>
      )}

      {/* Persistent bottom bar */}
      <div {...barEvents} title="Swipe up: home · Hold: open apps"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, zIndex: 35, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: "pointer" }}>
        <div style={{ width: 138, height: 5, borderRadius: 3, background: openId ? "var(--nv-text-dim)" : "rgba(255,255,255,0.65)", boxShadow: openId ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }} />
      </div>

      {control && <ControlCenter AC={AC} vol={vol} setVolume={setVolume} onClose={() => setControl(false)} />}
      {library && <AppLibrary AC={AC} apps={apps} glass={glass} search={search} setSearch={setSearch} pickMode={pickSlot !== null} onPick={openApp} onClose={() => { setLibrary(false); setSearch(""); setPickSlot(null); }} />}
      {switcher && <AppSwitcher openApps={openApps} appById={appById} glass={glass} renderApp={renderApp} onPick={openApp} onCloseApp={closeApp} onDismiss={() => setSwitcher(false)} />}
    </div>
  );
}

// ── Control Center ──────────────────────────────────────────────────────────
function ControlCenter({ AC, vol, setVolume, onClose }) {
  const toggles = [{ id: "airplane", icon: "✈️", label: "Airplane" }, { id: "wifi", icon: "📶", label: "Wi-Fi" }, { id: "cell", icon: "📡", label: "Cellular" }, { id: "bt", icon: "🔵", label: "Bluetooth" }];
  const [tg, setTg] = useState({ wifi: true, cell: true, bt: true });
  const sy = useRef(null);
  const tile = (on) => ({ flex: 1, aspectRatio: "1", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", background: on ? fill(AC) : "rgba(255,255,255,0.1)", color: on ? AC : "rgba(255,255,255,0.85)", fontFamily: FFB, fontWeight: 600, fontSize: 11 });
  const down = (e) => { sy.current = pt(e).clientY; };
  const upClose = (e) => { if (sy.current != null && sy.current - pt(e).clientY > 34) onClose(); sy.current = null; };
  return (
    <div onTouchStart={down} onTouchEnd={upClose} onMouseDown={down} onMouseUp={upClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 60, padding: "28px 16px 0", background: "rgba(6,8,18,0.5)", backdropFilter: "blur(34px) saturate(150%)", WebkitBackdropFilter: "blur(34px) saturate(150%)", animation: "panel-down 0.3s cubic-bezier(0.22,1,0.36,1)", touchAction: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}><div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.55)" }} /></div>
        <div style={{ display: "flex", gap: 12 }}>{toggles.map(t => (<div key={t.id} onClick={() => setTg(s => ({ ...s, [t.id]: !s[t.id] }))} style={tile(!!tg[t.id])}><span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}</div>))}</div>
        <CCSlider icon="🔆" label="Brightness" value={0.85} onChange={() => {}} />
        <CCSlider icon="🔊" label="Volume" value={vol} onChange={setVolume} />
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontFamily: FFM, marginTop: 2 }}>swipe up or tap to close</div>
      </div>
    </div>
  );
}
function CCSlider({ icon, label, value, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const set = (x) => { const r = ref.current.getBoundingClientRect(); onChange(Math.max(0, Math.min(1, (x - r.left) / r.width))); };
  return (
    <div style={{ padding: "16px", borderRadius: 20, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12 }}><span>{icon}</span>{label}</div>
      <div ref={ref}
        onTouchStart={e => { e.stopPropagation(); set(pt(e).clientX); }} onTouchMove={e => { e.stopPropagation(); set(pt(e).clientX); }}
        onMouseDown={e => { e.stopPropagation(); dragging.current = true; set(e.clientX); }} onMouseMove={e => { if (dragging.current) set(e.clientX); }} onMouseUp={() => { dragging.current = false; }}
        style={{ height: 32, borderRadius: 16, background: "rgba(255,255,255,0.18)", position: "relative", cursor: "pointer", overflow: "hidden", touchAction: "none" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.round(value * 100) + "%", background: "#fff", borderRadius: 16 }} />
      </div>
    </div>
  );
}

// ── App Library ───────────────────────────────────────────────────────────
function AppLibrary({ AC, apps, glass, search, setSearch, pickMode, onPick, onClose }) {
  const q = search.trim().toLowerCase();
  const list = q ? apps.filter(a => a.label.toLowerCase().includes(q) || a.id.includes(q)) : apps;
  const sy = useRef(null);
  const down = (e) => { sy.current = pt(e).clientY; };
  const upClose = (e) => { if (sy.current != null && pt(e).clientY - sy.current > 34) onClose(); sy.current = null; };
  // swipe down anywhere in the grid (when it's scrolled to the top) → close
  const listSt = useRef(null);
  const listDown = (e) => { listSt.current = { y: pt(e).clientY, top: e.currentTarget.scrollTop }; };
  const listUp = (e) => { const s = listSt.current; listSt.current = null; if (s && s.top <= 2 && pt(e).clientY - s.y > 48) onClose(); };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, paddingTop: 48, background: "rgba(6,8,18,0.66)", backdropFilter: "blur(36px) saturate(150%)", WebkitBackdropFilter: "blur(36px) saturate(150%)", display: "flex", flexDirection: "column", animation: "panel-up 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
      <div onTouchStart={down} onTouchEnd={upClose} onMouseDown={down} onMouseUp={upClose} style={{ padding: "6px 18px 12px", touchAction: "none" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}><div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} /></div>
        {pickMode && <div style={{ textAlign: "center", color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Choose an app for the dock</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, background: "rgba(255,255,255,0.14)", borderRadius: 12 }}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: FF, fontSize: 15 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
        </div>
      </div>
      <div onTouchStart={listDown} onTouchEnd={listUp} style={{ flex: 1, overflowY: "auto", padding: "4px 18px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px 8px", alignContent: "start" }}>
          {list.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => onPick(a.id)} />)}
          {list.length === 0 && <div style={{ gridColumn: "span 4", textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>No apps found</div>}
        </div>
      </div>
    </div>
  );
}

// ── App Switcher (Pixel-style recents with live shrunken app previews) ──────
function AppSwitcher({ openApps, appById, glass, renderApp, onPick, onCloseApp, onDismiss }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onDismiss(); }} onTouchEnd={e => { if (e.target === e.currentTarget) onDismiss(); }}
      style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(5,7,16,0.74)", backdropFilter: "blur(30px) saturate(140%)", WebkitBackdropFilter: "blur(30px) saturate(140%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, animation: "ss-fade 0.16s" }}>
      <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: 0.3 }}>Recent apps</div>
      {openApps.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontStyle: "italic" }}>No open apps</div>
      ) : (
        <div style={{ display: "flex", gap: 18, overflowX: "auto", maxWidth: "100%", padding: "4px 24px 8px", alignItems: "center" }}>
          {openApps.map(id => { const a = appById(id); if (!a) return null; return <SwitcherCard key={id} app={a} glass={glass} renderApp={renderApp} onOpen={() => onPick(id)} onClose={() => onCloseApp(id)} />; })}
        </div>
      )}
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11.5, fontFamily: FFM }}>tap to open · swipe a card up to clear</div>
    </div>
  );
}
function SwitcherCard({ app, glass, renderApp, onOpen, onClose }) {
  const sy = useRef(null);
  const [gone, setGone] = useState(false);
  const W = 172, H = 312;
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const scale = W / vw;
  const down = (e) => { sy.current = pt(e).clientY; };
  const up = (e) => {
    const dy = sy.current != null ? pt(e).clientY - sy.current : 0; sy.current = null;
    if (dy < -50) { setGone(true); setTimeout(onClose, 180); }   // swipe up → clear
    else if (Math.abs(dy) < 12) onOpen();                         // tap → open
  };
  if (gone) return <div style={{ width: 0, transition: "width 0.18s" }} />;
  return (
    <div onTouchStart={down} onTouchEnd={up} onMouseDown={down} onMouseUp={up}
      style={{ flexShrink: 0, width: W, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer", touchAction: "none", animation: "win-launch 0.2s cubic-bezier(0.16,1,0.3,1)" }}>
      {/* live, shrunken running app */}
      <div style={{ width: W, height: H, borderRadius: 22, overflow: "hidden", position: "relative", background: "var(--nv-surface-solid)", border: "1px solid rgba(255,255,255,0.16)", boxShadow: "0 18px 46px rgba(0,0,0,0.55)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: vw, height: Math.round(H / scale), transform: "scale(" + scale + ")", transformOrigin: "top left", pointerEvents: "none", padding: "14px 16px", boxSizing: "border-box" }}>
          {renderApp(app.id)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <div style={{ lineHeight: 0 }}><MobileIcon app={app} size={22} glass={glass} /></div>
        <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff" }}>{app.label}</span>
      </div>
    </div>
  );
}

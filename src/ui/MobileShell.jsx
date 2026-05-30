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

import { useState, useEffect, useRef, useCallback, useMemo, Component } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { Wallpaper } from "./wallpapers.jsx";
import { AppIconDisplay } from "./icons.jsx";
import { HAS_SVG_ICON } from "./constants.js";
import { getSoundConfig, setSoundConfig } from "../lib/audio.js";

const COLS = 4;
const PER_PAGE = 16;
// Capped top inset: keeps the status bar near the very top edge (in the notch
// "ear" area, iOS-style) instead of dropping it below the full notch height.
const SAT = "min(env(safe-area-inset-top, 0px), 14px)";
const SAB = "env(safe-area-inset-bottom, 0px)";
const DEFAULT_DOCK = ["files", "browser", "chat", "settings"];
const TILE_PALETTE = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#3b82f6", "#14b8a6", "#f43f5e"];

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const hashColor = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return TILE_PALETTE[h % TILE_PALETTE.length]; };
const fmtTime = (d) => ((d.getHours() % 12) || 12) + ":" + String(d.getMinutes()).padStart(2, "0");
// coords from a touch OR mouse event
const pt = (e) => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
// timestamp of the last touch, so overlays can ignore the "ghost" click the
// browser fires ~0-300ms after a touch release (which would otherwise dismiss
// a menu the moment you lift the finger that opened it).
let lastTouchAt = 0;

// Screen brightness is a software dimmer (the web can't touch hardware
// backlight) — persisted in localStorage so it survives reloads without
// spamming Firestore on every slider move. Floor at 0.2 so you can always
// still see the slider to turn it back up.
const BRIGHT_KEY = "nova:mobile:brightness";
const getBrightness = () => { try { const v = parseFloat(localStorage.getItem(BRIGHT_KEY)); return isNaN(v) ? 1 : Math.max(0.2, Math.min(1, v)); } catch { return 1; } };
const saveBrightness = (v) => { try { localStorage.setItem(BRIGHT_KEY, String(v)); } catch {} };

// Stops a single crashing app from black-screening the whole mobile shell.
// Resets when the shown app changes (appKey).
class AppErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidUpdate(prev) { if (prev.appKey !== this.props.appKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: 24, textAlign: "center", color: "var(--nv-text)", fontFamily: FF }}>
        <div style={{ fontSize: 34 }}>😵</div>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text-strong)" }}>This app hit an error</div>
        <div style={{ fontSize: 12, color: "var(--nv-text-dim)", fontFamily: FFM, wordBreak: "break-word", maxWidth: 320 }}>{String(this.state.err?.message || this.state.err)}</div>
      </div>
    );
    return this.props.children;
  }
}

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

// tappable icon (used inside the App Library, which scrolls natively).
// Tap → open; long-press → onLong (customization sheet).
function IconTile({ app, glass, onOpen, onLong, size = 60 }) {
  const st = useRef({});
  const start = () => { st.current = { moved: false, hold: onLong ? setTimeout(() => { st.current.hold = "fired"; onLong(); }, 420) : null }; };
  const move = () => { st.current.moved = true; const h = st.current.hold; if (h && h !== "fired") { clearTimeout(h); st.current.hold = null; } };
  const end = () => { const h = st.current.hold; st.current.hold = null; if (h === "fired") return; if (h) clearTimeout(h); if (!st.current.moved) onOpen(); };
  return (
    <div className="ps"
      onTouchStart={() => { lastTouchAt = Date.now(); start(); }} onTouchMove={move} onTouchEnd={() => { lastTouchAt = Date.now(); end(); }}
      onMouseDown={() => { if (Date.now() - lastTouchAt < 700) return; start(); }} onMouseUp={() => { if (Date.now() - lastTouchAt < 700) return; end(); }}
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
  const [sheet, setSheet] = useState(null);   // { id } — long-press customization sheet
  const [battery, setBattery] = useState(1);
  const [vol, setVol] = useState(() => getSoundConfig().volume);
  const [bright, setBright] = useState(getBrightness);
  const setBrightness = (v) => { const c = Math.max(0.2, Math.min(1, v)); setBright(c); saveBrightness(c); };
  const [dragX, setDragX] = useState(0);
  // iOS-style jiggle/edit mode + drag-and-drop reorder
  const [editMode, setEditMode] = useState(false);
  const [editOrder, setEditOrder] = useState([]);
  const [dragId, setDragId] = useState(null);      // which app is being dragged (renders the floating clone)
  const [addPicker, setAddPicker] = useState(false);
  const editOrderRef = useRef([]);
  const dragRef = useRef(null);       // id currently dragged
  const dragFrom = useRef(null);      // dock slot the drag started from (null = from Home grid)
  const dragPt = useRef({ x: 0, y: 0 });  // last finger point (drives the clone via ref, no re-render)
  const dragCloneRef = useRef(null);  // the floating clone DOM node

  const dock = (settings?.mobileDock && settings.mobileDock.length === 4) ? settings.mobileDock : DEFAULT_DOCK;
  const dockSet = new Set(dock);
  const appById = useCallback((id) => apps.find(a => a.id === id), [apps]);

  // ── customization: hidden set + custom order ──────────────────────────────
  // Home shows non-hidden, non-dock apps in `mobileOrder` first, then any new
  // apps appended. The App Library (drawer) always shows everything.
  const hidden = new Set(settings?.mobileHidden || []);
  const order = settings?.mobileOrder || [];
  const homeIds = [
    ...order.filter(id => apps.some(a => a.id === id) && !hidden.has(id) && !dockSet.has(id)),
    ...apps.filter(a => !hidden.has(a.id) && !dockSet.has(a.id) && !order.includes(a.id)).map(a => a.id),
  ];
  // In edit mode the grid renders from the live working order (editOrder).
  const baseIds = editMode ? editOrder : homeIds;
  const homeApps = baseIds.map(id => appById(id)).filter(Boolean);
  const hasWidgets = widgets && widgets.length > 0 && !editMode;
  const cap0 = hasWidgets ? 8 : PER_PAGE;
  const pages = [homeApps.slice(0, cap0), ...chunk(homeApps.slice(cap0), PER_PAGE)].filter((p, i) => i === 0 || p.length);
  if (pages.length === 0) pages.push([]);
  const curPage = Math.min(page, pages.length - 1);

  // customization actions (persist to settings)
  const hideFromHome = (id) => updateSettings?.({ mobileHidden: [...(settings?.mobileHidden || []).filter(x => x !== id), id] });
  const addToHome = (id) => updateSettings?.({ mobileHidden: (settings?.mobileHidden || []).filter(x => x !== id) });
  const moveHome = (id, dir) => { const ids = [...homeIds]; const i = ids.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; updateSettings?.({ mobileOrder: ids }); };
  const pinToDock = (id, slot) => { const next = [...dock]; const prev = next[slot], at = next.indexOf(id); next[slot] = id; if (at >= 0 && at !== slot) next[at] = prev; updateSettings?.({ mobileDock: next }); };

  // Wallpaper is expensive (animated canvas/SVG) — memoize so it doesn't
  // re-render on every clock tick, page-drag or reorder.
  const wallpaperEl = useMemo(
    () => <Wallpaper id={wallpaperId} customUrl={customWp} animate={!!settings?.wallpaperAnimated} />,
    [wallpaperId, customWp, settings?.wallpaperAnimated]
  );

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { let dead = false; if (navigator.getBattery) navigator.getBattery().then(b => { if (dead) return; const upd = () => setBattery(b.level); upd(); b.addEventListener("levelchange", upd); }).catch(() => {}); return () => { dead = true; }; }, []);

  function openApp(id) {
    onAppOpen?.(id);
    setOpenApps(s => [id, ...s.filter(x => x !== id)]);
    setOpenId(id); setLibrary(false); setControl(false); setSwitcher(false); setSearch("");
  }
  const goHome = () => setOpenId(null);
  const closeApp = (id) => { setOpenApps(s => s.filter(x => x !== id)); if (openId === id) setOpenId(null); };
  const setVolume = (v) => { setVol(v); setSoundConfig({ ...getSoundConfig(), volume: v }); };

  // ── springboard gestures (touch + mouse) ──────────────────────────────────
  const gest = useRef(null);
  // editOrderRef is the *authoritative* working order, updated synchronously
  // inside event handlers (React state updaters run later, so we can't rely on
  // them being flushed before drop/commit — that caused reorders to snap back).
  const applyOrder = (next) => { editOrderRef.current = next; setEditOrder(next); };
  const commitOrder = () => updateSettings?.({ mobileOrder: editOrderRef.current });
  const enterEdit = () => { editOrderRef.current = homeIds; setEditOrder(homeIds); setEditMode(true); };
  // moves the floating drag clone via direct DOM write — no React re-render per
  // touchmove, which keeps the drag buttery instead of janky.
  const moveClone = () => { const n = dragCloneRef.current; if (n) n.style.transform = "translate(" + (dragPt.current.x - 33) + "px," + (dragPt.current.y - 46) + "px)"; };
  function onDown(e) {
    const p = pt(e);
    if (editMode) {
      const tgt = e.target;
      // taps on the edit toolbar buttons (Add apps / Done) handle themselves —
      // don't let the pad treat them as "tap empty → exit".
      if (tgt && tgt.closest && tgt.closest("button")) { gest.current = null; return; }
      const rem = tgt && tgt.closest ? tgt.closest("[data-remove]") : null;
      if (rem) { gest.current = { remove: rem.getAttribute("data-remove") }; return; }
      const el = tgt && tgt.closest ? tgt.closest("[data-app]") : null;
      if (el) {
        const dk = el.getAttribute("data-dock");
        dragRef.current = el.getAttribute("data-app");
        dragFrom.current = dk != null ? +dk : null;
        dragPt.current = { x: p.clientX, y: p.clientY };
        setDragId(dragRef.current);
        gest.current = { drag: true };
        return;
      }
      gest.current = { exit: true, x0: p.clientX, y0: p.clientY };
      return;
    }
    const el = e.target.closest ? e.target.closest("[data-app]") : null;
    const g = { x0: p.clientX, y0: p.clientY, axis: null, app: el?.getAttribute("data-app") || null, dock: el?.getAttribute("data-dock"), hold: null };
    if (g.app) g.hold = setTimeout(() => {
      if (gest.current !== g) return;
      g.hold = "fired";
      enterEdit();
      // iOS-style: the held icon "lifts" and immediately becomes the dragged
      // item, so you can keep dragging the SAME finger without lifting to
      // re-grab. (This was the snap-back bug — the in-progress press wasn't a
      // drag gesture, so motion after the long-press did nothing.)
      dragRef.current = g.app;
      dragFrom.current = g.dock != null ? +g.dock : null;
      dragPt.current = { x: g.x0, y: g.y0 };
      setDragId(g.app);
      gest.current = { drag: true };
    }, 400);
    gest.current = g;
  }
  // Handlers branch on the gesture SHAPE (g.drag / g.exit / g.remove vs a normal
  // swipe), not on the editMode flag — the flag is a stale closure for the frame
  // right after a long-press promotes the press into a drag.
  function onMove(e) {
    const g = gest.current; if (!g) return;
    const p = pt(e);
    if (g.drag) {
      if (!dragRef.current) return;
      dragPt.current = { x: p.clientX, y: p.clientY };
      moveClone();
      // Live reorder only while dragging a Home-grid app (dock apps swap on drop).
      if (dragFrom.current == null) {
        const t = document.elementFromPoint(p.clientX, p.clientY);
        const tEl = t && t.closest ? t.closest("[data-app]") : null;
        const tid = tEl && tEl.getAttribute("data-dock") == null ? tEl.getAttribute("data-app") : null;
        if (tid && tid !== dragRef.current) {
          const a = editOrderRef.current.filter(x => x !== dragRef.current);
          let i = a.indexOf(tid); if (i < 0) i = a.length;
          a.splice(i, 0, dragRef.current);
          applyOrder(a);
        }
      }
      return;
    }
    if (g.exit) { if (Math.abs(p.clientX - g.x0) > 8 || Math.abs(p.clientY - g.y0) > 8) g.exit = false; return; }
    const dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (!g.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; if (g.hold && g.hold !== "fired") { clearTimeout(g.hold); g.hold = null; } }
    if (g.axis === "x") { let nx = dx; if ((curPage === 0 && dx > 0) || (curPage === pages.length - 1 && dx < 0)) nx = dx * 0.35; setDragX(nx); }
  }
  function onUp(e) {
    const g = gest.current; gest.current = null; if (!g) return;
    if (g.remove) { const id = g.remove; applyOrder(editOrderRef.current.filter(x => x !== id)); hideFromHome(id); return; }
    if (g.drag) {
      const id = dragRef.current, from = dragFrom.current;
      dragRef.current = null; dragFrom.current = null; setDragId(null);
      const p = pt(e);
      const t = document.elementFromPoint(p.clientX, p.clientY);
      const zone = t && t.closest ? t.closest("[data-dockzone]") : null;
      if (zone && id) {
        // dropped on the dock → which of the 4 slots (by x position)
        const r = zone.getBoundingClientRect();
        const slot = Math.max(0, Math.min(3, Math.floor(((p.clientX - r.left) / r.width) * 4)));
        const nextDock = [...dock]; const bumped = nextDock[slot]; const at = nextDock.indexOf(id);
        nextDock[slot] = id; if (at >= 0 && at !== slot) nextDock[at] = bumped;   // swap within dock
        let a = editOrderRef.current.filter(x => x !== id);                         // dragged app leaves Home
        if (from == null && bumped && bumped !== id && !a.includes(bumped)) a.push(bumped); // bumped app returns to Home
        editOrderRef.current = a; setEditOrder(a);
        updateSettings?.({ mobileDock: nextDock, mobileOrder: a });
        return;
      }
      // dropped on the Home grid: a Home app was reordered live → commit;
      // a dock app dropped on Home just snaps back (dock stays full at 4).
      if (from == null) commitOrder();
      return;
    }
    if (g.exit) { commitOrder(); setEditMode(false); return; }
    if (g.hold && g.hold !== "fired") clearTimeout(g.hold);
    if (g.hold === "fired") { setDragX(0); return; }
    const p = pt(e); const dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (g.axis === "x") {
      if (dx <= -40 && curPage < pages.length - 1) setPage(curPage + 1);
      else if (dx >= 40 && curPage > 0) setPage(curPage - 1);
      setDragX(0);
    } else if (g.axis === "y") {
      if (dy < -46) setLibrary(true);
      else if (dy > 46) setControl(true);
      setDragX(0);
    } else if (g.app) { openApp(g.app); }
  }
  const padEvents = { onTouchStart: onDown, onTouchMove: onMove, onTouchEnd: onUp, onTouchCancel: () => { gest.current = null; setDragX(0); }, onMouseDown: onDown, onMouseMove: onMove, onMouseUp: onUp };

  // ── bottom bar gestures ───────────────────────────────────────────────────
  const bar = useRef(null);
  function barDown(e) { lastTouchAt = Date.now(); const y0 = pt(e).clientY; bar.current = { y0, moved: false, hold: setTimeout(() => { if (bar.current) { bar.current.hold = "fired"; setSwitcher(true); } }, 130) }; }
  function barMove(e) { const b = bar.current; if (!b) return; if (Math.abs(pt(e).clientY - b.y0) > 14) { b.moved = true; if (b.hold && b.hold !== "fired") { clearTimeout(b.hold); b.hold = null; } } }
  function barUp(e) {
    lastTouchAt = Date.now();
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
      {wallpaperEl}

      {/* Status bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "calc(" + SAT + " + 30px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: SAT + " 22px 0", zIndex: 40, color: "#fff", pointerEvents: "none" }}>
        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, letterSpacing: 0.3, textShadow: openId ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }}>{fmtTime(now)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, filter: openId ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}><SignalGlyph /><WifiGlyph /><BatteryGlyph level={battery} /></span>
      </div>

      {/* Springboard */}
      {!openId && (
        <div {...padEvents} style={{ position: "absolute", inset: 0, paddingTop: "calc(" + SAT + " + 40px)", paddingBottom: "calc(" + SAB + " + 56px)", display: "flex", flexDirection: "column", zIndex: 10, touchAction: "none", animation: "home-in 0.32s cubic-bezier(0.22,1,0.36,1)" }}>
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <div style={{ display: "flex", height: "100%", width: (pages.length * 100) + "%", willChange: "transform", transform: "translateX(calc(" + (-curPage * (100 / pages.length)) + "% + " + dragX + "px))", transition: dragX === 0 ? "transform 0.42s cubic-bezier(0.22,1,0.36,1)" : "none" }}>
              {pages.map((pg, pi) => (
                <div key={pi} style={{ width: (100 / pages.length) + "%", flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  {pi === 0 && hasWidgets && (
                    <div style={{ display: "flex", gap: 12, overflowX: "hidden", padding: "4px 18px 14px" }}>
                      {widgets.slice(0, 2).map(w => (
                        <div key={w.id} style={{ flex: 1, minWidth: 0, height: 150, borderRadius: 20, overflow: "hidden", padding: 12, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 22px rgba(0,0,0,0.3)" }}>{w.content}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "4px 18px 0", display: "grid", gridTemplateColumns: "repeat(" + COLS + ",1fr)", gridAutoRows: "min-content", gap: "20px 8px", alignContent: "start" }}>
                    {pg.map(a => (
                      <div key={a.id} data-app={a.id} className={editMode ? undefined : "mb-ic"} style={{ position: "relative", opacity: dragId === a.id ? 0 : 1, animation: editMode ? "icon-jiggle 0.34s ease-in-out infinite" : undefined, animationDelay: editMode ? "-" + ((a.id.length % 5) * 0.05) + "s" : undefined }}>
                        <IconVisual app={a} glass={glass} />
                        {editMode && <div data-remove={a.id} style={{ position: "absolute", top: -3, left: "calc(50% - 30px)", width: 22, height: 22, borderRadius: "50%", background: "#3a3a3c", border: "1.5px solid rgba(255,255,255,0.55)", color: "#fff", fontSize: 19, lineHeight: "17px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.45)" }}>−</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editMode ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "6px 16px 8px" }}>
              <button onClick={() => setAddPicker(true)} style={{ padding: "8px 16px", borderRadius: 20, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ Add apps</button>
              <button onClick={() => { commitOrder(); setEditMode(false); }} style={{ padding: "8px 22px", borderRadius: 20, background: fill(AC), border: "1px solid " + bdr(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Done</button>
            </div>
          ) : pages.length > 1 ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 7, padding: "8px 0 6px" }}>
              {pages.map((_, i) => <span key={i} style={{ width: i === curPage ? 7 : 6, height: i === curPage ? 7 : 6, borderRadius: "50%", background: i === curPage ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }} />)}
            </div>
          ) : null}

          <div data-dockzone style={{ margin: "4px 12px 6px", padding: "12px 14px", borderRadius: 30, background: editMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.13)", backdropFilter: "blur(20px) saturate(150%)", WebkitBackdropFilter: "blur(20px) saturate(150%)", border: "1px solid " + (editMode ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.14)"), display: "flex", justifyContent: "space-around", transition: "background 0.2s, border-color 0.2s" }}>
            {dock.map((id, i) => { const a = appById(id); if (!a) return <div key={i} style={{ width: 60 }} />; return (
              <div key={id} data-app={id} data-dock={i} className={editMode ? undefined : "mb-ic"} style={{ opacity: dragId === id ? 0 : 1, animation: editMode ? "icon-jiggle 0.34s ease-in-out infinite" : undefined, animationDelay: editMode ? "-" + ((id.length % 5) * 0.05) + "s" : undefined }}>
                <IconVisual app={a} glass={glass} hideLabel />
              </div>
            ); })}
          </div>
        </div>
      )}

      {/* Open app */}
      {openId && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", willChange: "transform, opacity", animation: "app-in 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
          <div style={{ height: "calc(" + SAT + " + 40px)", flexShrink: 0 }} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "12px 14px calc(" + SAB + " + 54px)" }}><AppErrorBoundary appKey={openId}>{renderApp(openId)}</AppErrorBoundary></div>
        </div>
      )}

      {/* Persistent bottom bar */}
      <div {...barEvents} title="Swipe up: home · Hold: open apps"
        style={{ position: "absolute", left: 0, right: 0, bottom: "env(safe-area-inset-bottom, 0px)", height: 50, zIndex: 35, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: "pointer" }}>
        <div style={{ width: 138, height: 5, borderRadius: 3, background: openId ? "var(--nv-text-dim)" : "rgba(255,255,255,0.65)", boxShadow: openId ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }} />
      </div>

      {control && <ControlCenter AC={AC} vol={vol} setVolume={setVolume} bright={bright} setBrightness={setBrightness} battery={battery} settings={settings} updateSettings={updateSettings} onClose={() => setControl(false)} />}

      {/* software brightness dimmer — sits above everything, never blocks touch */}
      {bright < 0.999 && <div style={{ position: "fixed", inset: 0, background: "#000", opacity: (1 - bright) * 0.82, pointerEvents: "none", zIndex: 95, transition: "opacity 0.12s linear" }} />}
      {library && <AppLibrary AC={AC} apps={apps} glass={glass} search={search} setSearch={setSearch} onPick={openApp} onLong={(id) => setSheet({ id })} onClose={() => { setLibrary(false); setSearch(""); }} />}
      {switcher && <AppSwitcher openApps={openApps} appById={appById} glass={glass} renderApp={renderApp} onPick={openApp} onCloseApp={closeApp} onDismiss={() => { setSwitcher(false); goHome(); }} />}
      {sheet && (() => {
        const a = appById(sheet.id); if (!a) return null;
        return <ActionSheet AC={AC} app={a} glass={glass} onHome={homeIds.includes(sheet.id)} isHidden={hidden.has(sheet.id)} dockSlot={dock.indexOf(sheet.id)}
          onOpen={() => { openApp(sheet.id); setSheet(null); }}
          onMove={(d) => moveHome(sheet.id, d)}
          onHide={() => { hideFromHome(sheet.id); setSheet(null); }}
          onAdd={() => { addToHome(sheet.id); setSheet(null); }}
          onPinDock={(slot) => { pinToDock(sheet.id, slot); setSheet(null); }}
          onClose={() => setSheet(null)} />;
      })()}

      {/* floating drag clone (jiggle/edit mode) — moved via ref in onMove */}
      {dragId && (() => { const a = appById(dragId); if (!a) return null; return (
        <div ref={dragCloneRef} style={{ position: "fixed", left: 0, top: 0, width: 66, zIndex: 80, pointerEvents: "none", willChange: "transform", transform: "translate(" + (dragPt.current.x - 33) + "px," + (dragPt.current.y - 46) + "px)" }}>
          <div style={{ transform: "scale(1.14)", opacity: 0.95, filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.5))" }}>
            <MobileIcon app={a} size={62} glass={glass} />
          </div>
        </div>
      ); })()}

      {/* Add-to-Home picker (from edit mode) — only hidden apps */}
      {addPicker && (() => {
        const hiddenApps = apps.filter(a => hidden.has(a.id));
        return (
          <div style={{ position: "absolute", inset: 0, zIndex: 78, background: "rgba(6,8,18,0.72)", backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", paddingTop: "calc(" + SAT + " + 40px)", display: "flex", flexDirection: "column", animation: "panel-up 0.34s cubic-bezier(0.22,1,0.36,1)" }}>
            <div style={{ textAlign: "center", color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 14, paddingBottom: 12 }}>Add to Home</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px 8px", alignContent: "start" }}>
                {hiddenApps.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => { addToHome(a.id); setEditOrder(prev => [...prev, a.id]); }} />)}
                {hiddenApps.length === 0 && <div style={{ gridColumn: "span 4", textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>Every app is already on your Home Screen</div>}
              </div>
            </div>
            <button onClick={() => setAddPicker(false)} style={{ margin: "0 18px calc(" + SAB + " + 16px)", padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Done</button>
          </div>
        );
      })()}
    </div>
  );
}

// ── Control Center ──────────────────────────────────────────────────────────
function ControlCenter({ AC, vol, setVolume, bright, setBrightness, battery, settings, updateSettings, onClose }) {
  const sy = useRef(null);
  const torchTrack = useRef(null);
  const [soundOn, setSoundOn] = useState(() => getSoundConfig().enabled);
  const [fs, setFs] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [torchOn, setTorchOn] = useState(false);
  const [rotLock, setRotLock] = useState(false);
  const glass = !!settings?.glass, animated = !!settings?.wallpaperAnimated;

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    const up = () => setOnline(true), dn = () => setOnline(false);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("online", up); window.addEventListener("offline", dn);
    return () => { document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, []);
  useEffect(() => () => { try { torchTrack.current?.stop(); } catch {} }, []);  // kill the camera if we unmount

  const toggleSound = () => { const v = !soundOn; setSoundOn(v); setSoundConfig({ ...getSoundConfig(), enabled: v }); };
  const toggleGlass = () => updateSettings?.({ glass: !glass });
  const toggleAnimate = () => updateSettings?.({ wallpaperAnimated: !animated });
  const toggleFs = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } catch {} };
  const toggleTorch = async () => {
    try {
      if (torchTrack.current) { torchTrack.current.stop(); torchTrack.current = null; setTorchOn(false); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) { await track.applyConstraints({ advanced: [{ torch: true }] }); torchTrack.current = track; setTorchOn(true); }
      else { track.stop(); }   // device/browser has no torch capability
    } catch {}
  };
  const toggleRotate = async () => {
    try {
      if (rotLock) { window.screen?.orientation?.unlock?.(); setRotLock(false); }
      else { await window.screen?.orientation?.lock?.("portrait"); setRotLock(true); }
    } catch {}
  };

  const down = (e) => { sy.current = pt(e).clientY; };
  const upClose = (e) => { if (sy.current != null && sy.current - pt(e).clientY > 34) onClose(); sy.current = null; };

  const tileBtn = (icon, label, on, onClick) => (
    <button onClick={onClick} className="mb-cc-tile" style={{ flex: 1, minWidth: 0, height: 70, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", border: "1px solid " + (on ? bdr(AC) : "rgba(255,255,255,0.12)"), background: on ? fill(AC) : "rgba(255,255,255,0.1)", color: on ? AC : "rgba(255,255,255,0.9)", fontFamily: FFB, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.2 }}>
      <span style={{ fontSize: 21, lineHeight: 1 }}>{icon}</span>{label}
    </button>
  );
  const roundBtn = (icon, label, on, onClick) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
      <button onClick={onClick} className="mb-cc-tile" style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "1px solid " + (on ? bdr(AC) : "rgba(255,255,255,0.14)"), background: on ? fill(AC) : "rgba(255,255,255,0.1)", color: on ? AC : "#fff", fontSize: 22 }}>{icon}</button>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: FFB, fontWeight: 600 }}>{label}</span>
    </div>
  );

  return (
    <div onTouchStart={down} onTouchEnd={upClose} onMouseDown={down} onMouseUp={upClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 60, padding: "calc(" + SAT + " + 18px) 14px 0", background: "rgba(6,8,18,0.62)", backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", animation: "panel-down 0.34s cubic-bezier(0.22,1,0.36,1)", touchAction: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 2 }}><div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} /></div>

        {/* header + live status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px", color: "rgba(255,255,255,0.92)", fontFamily: FFB, fontWeight: 700, fontSize: 13 }}>
          <span>Control Center</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 600, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#34d399" : "#f87171", boxShadow: online ? "0 0 8px #34d399" : "none" }} />{online ? "Online" : "Offline"}</span>
            <span>🔋 {Math.round(battery * 100)}%</span>
          </span>
        </div>

        {/* working toggle tiles */}
        <div style={{ display: "flex", gap: 10 }}>
          {tileBtn(soundOn ? "🔔" : "🔕", soundOn ? "Sound" : "Silent", soundOn, toggleSound)}
          {tileBtn("✨", "Glass", glass, toggleGlass)}
          {tileBtn("🌀", "Live BG", animated, toggleAnimate)}
          {tileBtn("⛶", "Full", fs, toggleFs)}
        </div>

        {/* sliders */}
        <CCSlider icon="🔆" label="Brightness" value={bright} onChange={setBrightness} />
        <CCSlider icon="🔊" label="Volume" value={vol} onChange={setVolume} />

        {/* utility round buttons */}
        <div style={{ display: "flex", gap: 8, padding: "2px 10px" }}>
          {roundBtn("🔦", "Flashlight", torchOn, toggleTorch)}
          {roundBtn("🔒", "Rotate Lock", rotLock, toggleRotate)}
          {roundBtn("🔃", "Reload", false, () => { try { window.location.reload(); } catch {} })}
        </div>

        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 11.5, fontFamily: FFM, marginTop: 2, paddingBottom: 16 }}>swipe up or tap to close</div>
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
function AppLibrary({ AC, apps, glass, search, setSearch, onPick, onLong, onClose }) {
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
    <div style={{ position: "absolute", inset: 0, zIndex: 60, paddingTop: "calc(" + SAT + " + 40px)", background: "rgba(6,8,18,0.72)", backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", display: "flex", flexDirection: "column", animation: "panel-up 0.34s cubic-bezier(0.22,1,0.36,1)" }}>
      <div onTouchStart={down} onTouchEnd={upClose} onMouseDown={down} onMouseUp={upClose} style={{ padding: "6px 18px 12px", touchAction: "none" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}><div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, background: "rgba(255,255,255,0.14)", borderRadius: 12 }}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: FF, fontSize: 15 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
        </div>
      </div>
      <div onTouchStart={listDown} onTouchEnd={listUp} style={{ flex: 1, overflowY: "auto", padding: "4px 18px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px 8px", alignContent: "start" }}>
          {list.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => onPick(a.id)} onLong={() => onLong(a.id)} />)}
          {list.length === 0 && <div style={{ gridColumn: "span 4", textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>No apps found</div>}
        </div>
      </div>
    </div>
  );
}

// ── App Switcher (Pixel-style recents with live shrunken app previews) ──────
function AppSwitcher({ openApps, appById, glass, renderApp, onPick, onCloseApp, onDismiss }) {
  return (
    <div onClick={e => { if (Date.now() - lastTouchAt < 700) return; if (e.target === e.currentTarget) onDismiss(); }} onTouchEnd={e => { lastTouchAt = Date.now(); if (e.target === e.currentTarget) onDismiss(); }}
      style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(5,7,16,0.82)", backdropFilter: "blur(18px) saturate(135%)", WebkitBackdropFilter: "blur(18px) saturate(135%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, animation: "ss-fade 0.2s" }}>
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
// ── customization sheet (long-press an app) ────────────────────────────────
function ActionSheet({ AC, app, glass, onHome, isHidden, dockSlot, onOpen, onMove, onHide, onAdd, onPinDock, onClose }) {
  const btn = { width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 };
  return (
    <div onClick={e => { if (Date.now() - lastTouchAt < 700) return; if (e.target === e.currentTarget) onClose(); }} onTouchEnd={e => { lastTouchAt = Date.now(); if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 75, background: "rgba(4,6,14,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ margin: "0 10px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderRadius: 24, overflow: "hidden", background: "var(--nv-surface-solid)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 -10px 50px rgba(0,0,0,0.5)", animation: "panel-up 0.26s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <MobileIcon app={app} size={40} glass={glass} />
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "#fff" }}>{app.label}</div>
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onOpen} style={btn}>▶&nbsp;&nbsp;Open</button>
          {onHome && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onMove(-1)} style={{ ...btn, justifyContent: "center" }}>◀ Move left</button>
              <button onClick={() => onMove(1)} style={{ ...btn, justifyContent: "center" }}>Move right ▶</button>
            </div>
          )}
          {onHome && <button onClick={onHide} style={btn}>✕&nbsp;&nbsp;Remove from Home</button>}
          {isHidden && <button onClick={onAdd} style={{ ...btn, color: AC }}>＋&nbsp;&nbsp;Add to Home</button>}
          <div style={{ padding: "6px 4px 2px" }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10.5, letterSpacing: 1, color: "var(--nv-text-dim)", marginBottom: 8 }}>PIN TO DOCK</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[0, 1, 2, 3].map(s => (
                <button key={s} onClick={() => onPinDock(s)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 14, border: "1px solid " + (dockSlot === s ? bdr(AC) : "rgba(255,255,255,0.12)"), background: dockSlot === s ? fill(AC) : "rgba(255,255,255,0.06)", color: dockSlot === s ? AC : "#fff" }}>{s + 1}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
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
          <AppErrorBoundary appKey={app.id}>{renderApp(app.id)}</AppErrorBoundary>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <div style={{ lineHeight: 0 }}><MobileIcon app={app} size={22} glass={glass} /></div>
        <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff" }}>{app.label}</span>
      </div>
    </div>
  );
}

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
import { canPromptInstall, promptInstall, onInstallChange, isStandalone, isIOS, isAndroid, isNativeApp, ANDROID_APK_URL } from "../lib/pwa.js";
import { haptic, hapticsEnabled, setHapticsEnabled } from "../lib/haptics.js";
import { isNative, toggleImmersive, isImmersive } from "../lib/native.js";

// columns + page size are now computed responsively from the viewport (see MobileShell)
const PER_PAGE = 16;   // fallback page size
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
  componentDidCatch(err) { try { console.error("[nova-app-error]", err); } catch {} }
  componentDidUpdate(prev) { if (prev.appKey !== this.props.appKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message || this.state.err);
      // A failed dynamic import means the app's code chunk couldn't be fetched
      // (offline, a stale deploy, or an auth-gated host) — not an app crash.
      const chunk = /dynamically imported module|importing a module script failed|Loading chunk|Failed to fetch|error loading dynamically/i.test(msg);
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: 24, textAlign: "center", color: "var(--nv-text)", fontFamily: FF }}>
          <div style={{ fontSize: 34 }}>{chunk ? "📡" : "😵"}</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text-strong)" }}>{chunk ? "Couldn't load this app" : "This app hit an error"}</div>
          <div style={{ fontSize: 12, color: "var(--nv-text-dim)", fontFamily: FFM, wordBreak: "break-word", maxWidth: 320 }}>{chunk ? "Its code couldn't be downloaded — check your connection, then reload." : msg}</div>
          <button onClick={() => { try { location.reload(); } catch {} }} style={{ marginTop: 6, padding: "9px 20px", borderRadius: 12, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reload</button>
        </div>
      );
    }
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

export function MobileShell({ AC, user, data, apps, wallpaperId, customWp, settings, updateSettings, renderApp, onAppOpen, widgets, notifications = [], onDismissNotification, onClearNotifications }) {
  const glass = !!settings?.glass;
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [openApps, setOpenApps] = useState([]);
  const [control, setControl] = useState(false);
  const [notif, setNotif] = useState(false);
  const [library, setLibrary] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(null);   // { id } — long-press customization sheet
  const [battery, setBattery] = useState(1);
  const [vol, setVol] = useState(() => getSoundConfig().volume);
  const [bright, setBright] = useState(getBrightness);
  const setBrightness = (v) => { const c = Math.max(0.2, Math.min(1, v)); setBright(c); saveBrightness(c); };
  const [locked, setLocked] = useState(true);   // lock screen shows on launch; swipe up to enter
  const [vp, setVp] = useState(() => ({ w: typeof window !== "undefined" ? window.innerWidth : 390, h: typeof window !== "undefined" ? window.innerHeight : 800 }));
  const [dragX, setDragX] = useState(0);
  // iOS-style jiggle/edit mode + drag-and-drop reorder
  const [editMode, setEditMode] = useState(false);
  const [editOrder, setEditOrder] = useState([]);
  const [dragId, setDragId] = useState(null);      // which app is being dragged (renders the floating clone)
  const [addPicker, setAddPicker] = useState(false);
  const [openFolder, setOpenFolder] = useState(null);   // folderId currently open
  const [mergeFolder, setMergeFolder] = useState(null); // folder highlighted as a drop target mid-drag
  const editOrderRef = useRef([]);
  const dragRef = useRef(null);       // id/token currently dragged
  const dragFrom = useRef(null);      // dock slot the drag started from (null = from Home grid)
  const dragMoved = useRef(false);    // did this drag actually move (vs a tap)?
  const mergeRef = useRef(null);      // folderId under the finger at drop time
  const dragPt = useRef({ x: 0, y: 0 });  // last finger point (drives the clone via ref, no re-render)
  const dragCloneRef = useRef(null);  // the floating clone DOM node

  const dock = (settings?.mobileDock && settings.mobileDock.length === 4) ? settings.mobileDock : DEFAULT_DOCK;
  const dockSet = new Set(dock);
  const appById = useCallback((id) => apps.find(a => a.id === id), [apps]);

  // ── customization: hidden set + custom order + folders ─────────────────────
  // Home shows non-hidden, non-dock, non-foldered apps in `mobileOrder` first,
  // then any new apps appended. Order entries may be app ids OR folder tokens
  // ("folder:<id>"). Folders live in settings.mobileFolders.
  const hidden = new Set(settings?.mobileHidden || []);
  const order = settings?.mobileOrder || [];
  const folders = settings?.mobileFolders || {};
  const folderApp = useCallback((tok) => tok && tok.indexOf("folder:") === 0 ? tok.slice(7) : null, []);
  const inFolder = new Set();
  Object.values(folders).forEach(f => (f?.apps || []).forEach(id => inFolder.add(id)));
  const validFolderTok = (tok) => { const fid = folderApp(tok); return fid && folders[fid] && (folders[fid].apps || []).some(id => appById(id)); };
  const tokenLive = (tok) => folderApp(tok) ? validFolderTok(tok) : (apps.some(a => a.id === tok) && !hidden.has(tok) && !dockSet.has(tok) && !inFolder.has(tok));
  const homeIds = [
    ...order.filter(tokenLive),
    ...Object.keys(folders).map(fid => "folder:" + fid).filter(t => validFolderTok(t) && !order.includes(t)),
    ...apps.filter(a => !hidden.has(a.id) && !dockSet.has(a.id) && !inFolder.has(a.id) && !order.includes(a.id)).map(a => a.id),
  ];
  // In edit mode the grid renders from the live working order (editOrder).
  // Empty folder tokens stay visible in edit mode so you can drag apps into them.
  const baseIds = (editMode ? editOrder : homeIds).filter(tok => folderApp(tok) ? (editMode || validFolderTok(tok)) : appById(tok));
  // ── responsive grid: columns + rows scale with the viewport / orientation ──
  const landscape = vp.w > vp.h;
  const cols = Math.max(4, Math.min(8, Math.round(vp.w / 112)));
  const rowsFull = Math.max(2, Math.min(8, Math.floor((vp.h - 250) / 92)));
  const perPage = cols * rowsFull;
  const hasWidgets = widgets && widgets.length > 0 && !editMode && vp.h >= 520;
  const cap0 = hasWidgets ? Math.max(cols, (rowsFull - 2) * cols) : perPage;
  const pages = [baseIds.slice(0, cap0), ...chunk(baseIds.slice(cap0), perPage)].filter((p, i) => i === 0 || p.length);
  if (pages.length === 0) pages.push([]);
  const curPage = Math.min(page, pages.length - 1);

  // customization actions (persist to settings)
  const hideFromHome = (id) => updateSettings?.({ mobileHidden: [...(settings?.mobileHidden || []).filter(x => x !== id), id] });
  const addToHome = (id) => updateSettings?.({ mobileHidden: (settings?.mobileHidden || []).filter(x => x !== id) });
  const moveHome = (id, dir) => { const ids = [...homeIds]; const i = ids.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; updateSettings?.({ mobileOrder: ids }); };
  const pinToDock = (id, slot) => { const next = [...dock]; const prev = next[slot], at = next.indexOf(id); next[slot] = id; if (at >= 0 && at !== slot) next[at] = prev; updateSettings?.({ mobileDock: next }); };

  // ── folder actions ─────────────────────────────────────────────────────────
  const newFolderId = () => "f" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const createFolder = () => {
    const fid = newFolderId();
    const nf = { ...folders, [fid]: { name: "Folder", apps: [] } };
    const a = ["folder:" + fid, ...editOrderRef.current];
    editOrderRef.current = a; setEditOrder(a);
    updateSettings?.({ mobileFolders: nf, mobileOrder: a });
  };
  const addToFolder = (fid, appId) => {
    if (!folders[fid] || folderApp(appId)) return;            // never nest folders
    const f = folders[fid];
    if ((f.apps || []).includes(appId)) return;
    const nf = { ...folders, [fid]: { ...f, apps: [...(f.apps || []), appId] } };
    const a = editOrderRef.current.filter(x => x !== appId);  // app leaves the home grid
    editOrderRef.current = a; setEditOrder(a);
    updateSettings?.({ mobileFolders: nf, mobileOrder: a });
  };
  const removeFromFolder = (fid, appId) => {
    const f = folders[fid]; if (!f) return;
    const remaining = (f.apps || []).filter(x => x !== appId);
    const nf = { ...folders };
    let nextOrder = (settings?.mobileOrder || []).slice();
    if (remaining.length <= 1) {
      // dissolve: surviving app + the removed one go back to the home grid
      delete nf[fid];
      const back = [...remaining, appId].filter(Boolean);
      nextOrder = nextOrder.filter(t => t !== "folder:" + fid);
      back.forEach(id => { if (!nextOrder.includes(id)) nextOrder.push(id); });
    } else {
      nf[fid] = { ...f, apps: remaining };
      if (!nextOrder.includes(appId)) nextOrder.push(appId);
    }
    updateSettings?.({ mobileFolders: nf, mobileOrder: nextOrder });
  };
  const renameFolder = (fid, name) => { if (!folders[fid]) return; updateSettings?.({ mobileFolders: { ...folders, [fid]: { ...folders[fid], name: name || "Folder" } } }); };
  // drop any empty folders (created but never filled) when leaving edit mode
  const pruneEmptyFolders = () => {
    const empties = Object.keys(folders).filter(fid => !(folders[fid].apps || []).length);
    if (!empties.length) return;
    const nf = { ...folders }; empties.forEach(fid => delete nf[fid]);
    const a = editOrderRef.current.filter(t => !empties.includes(folderApp(t)));
    editOrderRef.current = a;
    updateSettings?.({ mobileFolders: nf, mobileOrder: a });
  };

  // Wallpaper is expensive (animated canvas/SVG) — memoize so it doesn't
  // re-render on every clock tick, page-drag or reorder.
  const wallpaperEl = useMemo(
    () => <Wallpaper id={wallpaperId} customUrl={customWp} animate={!!settings?.wallpaperAnimated && !isNative()} />,
    [wallpaperId, customWp, settings?.wallpaperAnimated]
  );

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { let dead = false; if (navigator.getBattery) navigator.getBattery().then(b => { if (dead) return; const upd = () => setBattery(b.level); upd(); b.addEventListener("levelchange", upd); }).catch(() => {}); return () => { dead = true; }; }, []);

  // Android hardware back button (dispatched by lib/native.js): consume it to
  // close whatever is on top / go Home; if there's nothing to close, let it fall
  // through (native backgrounds the app instead of hard-quitting).
  useEffect(() => {
    const onBack = (e) => {
      if (addPicker) { e.preventDefault(); setAddPicker(false); return; }
      if (openFolder) { e.preventDefault(); setOpenFolder(null); return; }
      if (sheet) { e.preventDefault(); setSheet(null); return; }
      if (switcher) { e.preventDefault(); setSwitcher(false); return; }
      if (control) { e.preventDefault(); setControl(false); return; }
      if (notif) { e.preventDefault(); setNotif(false); return; }
      if (library) { e.preventDefault(); setLibrary(false); setSearch(""); return; }
      if (editMode) { e.preventDefault(); pruneEmptyFolders(); commitOrder(); setEditMode(false); return; }
      if (openId) { e.preventDefault(); setOpenId(null); return; }
      if (locked) { e.preventDefault(); return; }
    };
    window.addEventListener("nova-back", onBack);
    return () => window.removeEventListener("nova-back", onBack);
  });

  function openApp(id) {
    haptic("open");
    onAppOpen?.(id);
    setOpenApps(s => [id, ...s.filter(x => x !== id)]);
    setOpenId(id); setLibrary(false); setControl(false); setNotif(false); setSwitcher(false); setSearch("");
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
  const enterEdit = () => { haptic("pick"); editOrderRef.current = homeIds; setEditOrder(homeIds); setEditMode(true); };
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
        dragMoved.current = false;
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
      dragMoved.current = false;
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
      if (Math.abs(p.clientX - dragPt.current.x) > 3 || Math.abs(p.clientY - dragPt.current.y) > 3) dragMoved.current = true;
      dragPt.current = { x: p.clientX, y: p.clientY };
      moveClone();
      // Live reorder only while dragging a Home-grid item (dock apps swap on drop).
      if (dragFrom.current == null) {
        const t = document.elementFromPoint(p.clientX, p.clientY);
        const tEl = t && t.closest ? t.closest("[data-app]") : null;
        const tid = tEl && tEl.getAttribute("data-dock") == null ? tEl.getAttribute("data-app") : null;
        const draggingApp = !folderApp(dragRef.current);
        const tFid = folderApp(tid);
        if (tid && tid !== dragRef.current && draggingApp && tFid) {
          // hovering a folder while dragging an app → drop will go INTO it
          if (mergeRef.current !== tFid) { mergeRef.current = tFid; setMergeFolder(tFid); haptic("move"); }
        } else if (tid && tid !== dragRef.current) {
          // reorder (app over app, or folder over anything)
          if (mergeRef.current) { mergeRef.current = null; setMergeFolder(null); }
          const a = editOrderRef.current.filter(x => x !== dragRef.current);
          let i = a.indexOf(tid); if (i < 0) i = a.length;
          a.splice(i, 0, dragRef.current);
          applyOrder(a);
          haptic("move");
        } else if (!tid || tid === dragRef.current) {
          if (mergeRef.current) { mergeRef.current = null; setMergeFolder(null); }
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
    if (e.type && e.type.indexOf("touch") === 0) lastTouchAt = Date.now();   // ghost-click guard for overlays opened here (e.g. folders)
    const g = gest.current; gest.current = null; if (!g) return;
    if (g.remove) { const id = g.remove; haptic("remove"); applyOrder(editOrderRef.current.filter(x => x !== id)); hideFromHome(id); return; }
    if (g.drag) {
      const id = dragRef.current, from = dragFrom.current, merge = mergeRef.current, moved = dragMoved.current;
      const isFolderTok = !!folderApp(id);
      dragRef.current = null; dragFrom.current = null; mergeRef.current = null; setDragId(null); setMergeFolder(null);
      // tap (no real movement) on a folder → open it
      if (!moved && isFolderTok) { setOpenFolder(folderApp(id)); return; }
      // dropped onto a folder → file the app inside it
      if (merge && !isFolderTok && folders[merge]) { addToFolder(merge, id); haptic("drop"); return; }
      const p = pt(e);
      const t = document.elementFromPoint(p.clientX, p.clientY);
      const zone = t && t.closest ? t.closest("[data-dockzone]") : null;
      if (zone && id && !isFolderTok) {   // folders can't live in the dock
        // dropped on the dock → which of the 4 slots (by x position)
        const r = zone.getBoundingClientRect();
        const slot = Math.max(0, Math.min(3, Math.floor(((p.clientX - r.left) / r.width) * 4)));
        const nextDock = [...dock]; const bumped = nextDock[slot]; const at = nextDock.indexOf(id);
        nextDock[slot] = id; if (at >= 0 && at !== slot) nextDock[at] = bumped;   // swap within dock
        let a = editOrderRef.current.filter(x => x !== id);                         // dragged app leaves Home
        if (from == null && bumped && bumped !== id && !a.includes(bumped)) a.push(bumped); // bumped app returns to Home
        editOrderRef.current = a; setEditOrder(a);
        updateSettings?.({ mobileDock: nextDock, mobileOrder: a });
        haptic("drop");
        return;
      }
      // dropped on the Home grid: a Home item was reordered live → commit;
      // a dock app dropped on Home just snaps back (dock stays full at 4).
      if (from == null) commitOrder();
      haptic("drop");
      return;
    }
    if (g.exit) { pruneEmptyFolders(); commitOrder(); setEditMode(false); return; }
    if (g.hold && g.hold !== "fired") clearTimeout(g.hold);
    if (g.hold === "fired") { setDragX(0); return; }
    const p = pt(e); const dx = p.clientX - g.x0, dy = p.clientY - g.y0;
    if (g.axis === "x") {
      if (dx <= -40 && curPage < pages.length - 1) { setPage(curPage + 1); haptic("tap"); }
      else if (dx >= 40 && curPage > 0) { setPage(curPage - 1); haptic("tap"); }
      setDragX(0);
    } else if (g.axis === "y") {
      if (dy < -46) { setLibrary(true); haptic("toggle"); }
      else if (dy > 46) {
        // iOS-style: swipe down from the right edge -> Control Center,
        // from the rest of the top -> Notifications.
        const w = typeof window !== "undefined" ? window.innerWidth : 400;
        if (g.x0 > w * 0.6) setControl(true); else setNotif(true);
        haptic("toggle");
      }
      setDragX(0);
    } else if (g.app) { const fid = folderApp(g.app); if (fid) setOpenFolder(fid); else openApp(g.app); }
  }
  const padEvents = { onTouchStart: onDown, onTouchMove: onMove, onTouchEnd: onUp, onTouchCancel: () => { gest.current = null; setDragX(0); }, onMouseDown: onDown, onMouseMove: onMove, onMouseUp: onUp };

  // ── bottom bar gestures ───────────────────────────────────────────────────
  const bar = useRef(null);
  function barDown(e) { lastTouchAt = Date.now(); const y0 = pt(e).clientY; bar.current = { y0, moved: false, hold: setTimeout(() => { if (bar.current) { bar.current.hold = "fired"; haptic("pick"); setSwitcher(true); } }, 130) }; }
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
                    <div style={{ display: "flex", gap: 12, overflowX: "hidden", padding: "4px 18px 14px", maxWidth: 760, width: "100%", margin: "0 auto" }}>
                      {widgets.slice(0, landscape ? 3 : 2).map(w => (
                        <div key={w.id} style={{ flex: 1, minWidth: 0, height: 150, borderRadius: 20, overflow: "hidden", padding: 12, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 22px rgba(0,0,0,0.3)" }}>{w.content}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "4px 18px 0", maxWidth: 760, width: "100%", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gridAutoRows: "min-content", gap: (landscape ? 14 : 20) + "px 8px", alignContent: "start" }}>
                    {pg.map(tok => {
                      const fid = folderApp(tok);
                      const jig = { animation: editMode ? "icon-jiggle 0.34s ease-in-out infinite" : undefined, animationDelay: editMode ? "-" + ((tok.length % 5) * 0.05) + "s" : undefined };
                      if (fid) {
                        const f = folders[fid] || { name: "Folder", apps: [] };
                        return (
                          <div key={tok} data-app={tok} className={editMode ? undefined : "mb-ic"} style={{ position: "relative", opacity: dragId === tok ? 0 : 1, transform: mergeFolder === fid ? "scale(1.18)" : undefined, transition: "transform 0.16s var(--nv-ease)", ...jig }}>
                            <FolderTile folder={f} appById={appById} glass={glass} highlight={mergeFolder === fid} />
                          </div>
                        );
                      }
                      const a = appById(tok); if (!a) return null;
                      return (
                        <div key={tok} data-app={tok} className={editMode ? undefined : "mb-ic"} style={{ position: "relative", opacity: dragId === tok ? 0 : 1, ...jig }}>
                          <IconVisual app={a} glass={glass} />
                          {editMode && <div data-remove={tok} style={{ position: "absolute", top: -3, left: "calc(50% - 30px)", width: 22, height: 22, borderRadius: "50%", background: "#3a3a3c", border: "1.5px solid rgba(255,255,255,0.55)", color: "#fff", fontSize: 19, lineHeight: "17px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.45)" }}>−</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editMode ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "6px 12px 8px" }}>
              <button onClick={() => setAddPicker(true)} style={{ padding: "8px 14px", borderRadius: 20, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>＋ Add</button>
              <button onClick={createFolder} style={{ padding: "8px 14px", borderRadius: 20, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>📁 Folder</button>
              <button onClick={() => { pruneEmptyFolders(); commitOrder(); setEditMode(false); }} style={{ padding: "8px 20px", borderRadius: 20, background: fill(AC), border: "1px solid " + bdr(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Done</button>
            </div>
          ) : pages.length > 1 ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 7, padding: "8px 0 6px" }}>
              {pages.map((_, i) => <span key={i} style={{ width: i === curPage ? 7 : 6, height: i === curPage ? 7 : 6, borderRadius: "50%", background: i === curPage ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }} />)}
            </div>
          ) : null}

          <div data-dockzone style={{ margin: "4px auto 6px", maxWidth: 480, width: "calc(100% - 24px)", padding: "12px 14px", borderRadius: 30, background: editMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.13)", backdropFilter: "blur(20px) saturate(150%)", WebkitBackdropFilter: "blur(20px) saturate(150%)", border: "1px solid " + (editMode ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.14)"), display: "flex", justifyContent: "space-around", transition: "background 0.2s, border-color 0.2s" }}>
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

      {control && <ControlCenter AC={AC} vol={vol} setVolume={setVolume} bright={bright} setBrightness={setBrightness} battery={battery} settings={settings} updateSettings={updateSettings} onLock={() => { setControl(false); setLocked(true); }} onClose={() => setControl(false)} />}
      {notif && <NotificationCenter AC={AC} notifications={notifications} appById={appById} glass={glass} onOpenApp={openApp} onDismiss={onDismissNotification} onClear={onClearNotifications} onClose={() => setNotif(false)} />}
      {openFolder && folders[openFolder] && <FolderView folder={folders[openFolder]} appById={appById} glass={glass} onOpenApp={(id) => { setOpenFolder(null); openApp(id); }} onRemove={(id) => removeFromFolder(openFolder, id)} onRename={(name) => renameFolder(openFolder, name)} onClose={() => setOpenFolder(null)} />}

      {/* Lock screen — shows on launch / when locked; swipe up to enter */}
      {locked && <LockScreen now={now} battery={battery} onUnlock={() => { haptic("unlock"); setLocked(false); }} />}

      {/* software brightness dimmer — sits above everything, never blocks touch */}
      {bright < 0.999 && <div style={{ position: "fixed", inset: 0, background: "#000", opacity: (1 - bright) * 0.82, pointerEvents: "none", zIndex: 95, transition: "opacity 0.12s linear" }} />}
      {library && <AppLibrary AC={AC} apps={apps} glass={glass} cols={cols} search={search} setSearch={setSearch} onPick={openApp} onLong={(id) => setSheet({ id })} onClose={() => { setLibrary(false); setSearch(""); }} />}
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
      {dragId && (() => {
        const fid = folderApp(dragId);
        const inner = fid
          ? (folders[fid] ? <div style={{ width: 62 }}><FolderTile folder={folders[fid]} appById={appById} glass={glass} /></div> : null)
          : (() => { const a = appById(dragId); return a ? <MobileIcon app={a} size={62} glass={glass} /> : null; })();
        if (!inner) return null;
        return (
          <div ref={dragCloneRef} style={{ position: "fixed", left: 0, top: 0, width: 66, zIndex: 80, pointerEvents: "none", willChange: "transform", transform: "translate(" + (dragPt.current.x - 33) + "px," + (dragPt.current.y - 46) + "px)" }}>
            <div style={{ transform: "scale(1.14)", opacity: 0.95, filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.5))" }}>{inner}</div>
          </div>
        );
      })()}

      {/* Add-to-Home picker (from edit mode) — only hidden apps */}
      {addPicker && (() => {
        const hiddenApps = apps.filter(a => hidden.has(a.id));
        return (
          <div style={{ position: "absolute", inset: 0, zIndex: 78, background: "rgba(6,8,18,0.72)", backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", paddingTop: "calc(" + SAT + " + 40px)", display: "flex", flexDirection: "column", animation: "panel-up 0.34s cubic-bezier(0.22,1,0.36,1)" }}>
            <div style={{ textAlign: "center", color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 14, paddingBottom: 12 }}>Add to Home</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gap: "20px 8px", alignContent: "start", maxWidth: 760, margin: "0 auto" }}>
                {hiddenApps.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => { addToHome(a.id); applyOrder([...editOrderRef.current, a.id]); }} />)}
                {hiddenApps.length === 0 && <div style={{ gridColumn: "span " + cols, textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>Every app is already on your Home Screen</div>}
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
function ControlCenter({ AC, vol, setVolume, bright, setBrightness, battery, settings, updateSettings, onLock, onClose }) {
  const sy = useRef(null);
  const torchTrack = useRef(null);
  const [soundOn, setSoundOn] = useState(() => getSoundConfig().enabled);
  const [fs, setFs] = useState(() => isNative() ? isImmersive() : (typeof document !== "undefined" && !!document.fullscreenElement));
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [torchOn, setTorchOn] = useState(false);
  const [rotLock, setRotLock] = useState(false);
  const [hapt, setHapt] = useState(() => hapticsEnabled());
  const [installable, setInstallable] = useState(() => canPromptInstall());
  const glass = !!settings?.glass, animated = !!settings?.wallpaperAnimated;
  // Always offer install guidance on mobile web (hidden only once installed).
  // Android one-tap appears when Chrome fires beforeinstallprompt; otherwise we
  // fall back to a menu hint so the option is never invisible.
  const showInstall = !isStandalone();
  const ios = isIOS();

  useEffect(() => onInstallChange(() => setInstallable(canPromptInstall())), []);
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    const up = () => setOnline(true), dn = () => setOnline(false);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("online", up); window.addEventListener("offline", dn);
    return () => { document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, []);
  useEffect(() => () => { try { torchTrack.current?.stop(); } catch {} }, []);  // kill the camera if we unmount

  const toggleSound = () => { haptic("toggle"); const v = !soundOn; setSoundOn(v); setSoundConfig({ ...getSoundConfig(), enabled: v }); };
  const toggleGlass = () => { haptic("toggle"); updateSettings?.({ glass: !glass }); };
  const toggleAnimate = () => { haptic("toggle"); updateSettings?.({ wallpaperAnimated: !animated }); };
  const toggleFs = () => {
    haptic("toggle");
    if (isNative()) { setFs(toggleImmersive()); return; }   // hide/show the phone's system UI
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } catch {}
  };
  const toggleHaptics = () => { const v = !hapt; setHapt(v); setHapticsEnabled(v); };
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

        {/* Install Nova OS — one-tap when Chrome offers it, else a how-to hint */}
        {showInstall && (installable ? (
          <button onClick={() => promptInstall()} className="mb-cc-tile" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "14px", borderRadius: 18, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            <span style={{ fontSize: 18 }}>⬇️</span> Install Nova OS
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.92)", fontFamily: FFB, fontWeight: 600, fontSize: 12, lineHeight: 1.45 }}>
            <span style={{ fontSize: 18 }}>📲</span>
            {ios
              ? <span>To install: tap <b>Share</b> → <b>Add to Home Screen</b></span>
              : <span>To install: open the browser menu <b>(⋮)</b> → <b>Install app</b> / <b>Add to Home screen</b></span>}
          </div>
        ))}

        {/* Native Android app (Capacitor APK on GitHub Releases) — shown on
            Android web only, hidden once running inside the native app. */}
        {isAndroid() && !isNativeApp() && (
          <a href={ANDROID_APK_URL} target="_blank" rel="noopener noreferrer" className="mb-cc-tile" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "13px", borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
            <span style={{ fontSize: 18 }}>🤖</span> Download Android app
          </a>
        )}

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "2px 4px", justifyContent: "center" }}>
          {roundBtn("🔦", "Flashlight", torchOn, toggleTorch)}
          {roundBtn("🔄", "Rotate Lock", rotLock, toggleRotate)}
          {roundBtn("📳", "Haptics", hapt, toggleHaptics)}
          {roundBtn("🔒", "Lock", false, () => onLock?.())}
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

// ── Lock screen ─────────────────────────────────────────────────────────────
// Shows on launch (and when re-locked from Control Center). Big clock over the
// wallpaper; swipe up to enter. No PIN — it's an emulator, this is the "wake"
// experience, not real security.
function LockScreen({ now, onUnlock }) {
  const sy = useRef(null);
  const [out, setOut] = useState(false);
  const time = ((now.getHours() % 12) || 12) + ":" + String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const unlock = () => { if (out) return; setOut(true); setTimeout(onUnlock, 340); };
  const down = (e) => { sy.current = pt(e).clientY; };
  const up = (e) => { if (sy.current != null && sy.current - pt(e).clientY > 60) unlock(); sy.current = null; };
  return (
    <div onTouchStart={down} onTouchEnd={up} onMouseDown={down} onMouseUp={up}
      style={{ position: "fixed", inset: 0, zIndex: 88, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        paddingTop: "calc(" + SAT + " + 64px)", paddingBottom: "calc(" + SAB + " + 38px)",
        background: "linear-gradient(180deg, rgba(4,6,16,0.32), rgba(4,6,16,0.72))", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
        touchAction: "none", transform: out ? "translateY(-100%)" : "none", opacity: out ? 0 : 1,
        transition: "transform 0.36s cubic-bezier(0.22,1,0.36,1), opacity 0.36s" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 15, fontFamily: FFB, fontWeight: 600, opacity: 0.85, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 12 }}>🔒</span>{date}</div>
        <div style={{ fontFamily: FFB, fontWeight: 300, fontSize: 82, lineHeight: 1.05, letterSpacing: -2 }}>{time}<span style={{ fontSize: 26, fontWeight: 600, marginLeft: 8 }}>{ampm}</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 124, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.7)", animation: "ls-hint 1.9s ease-in-out infinite" }} />
        <div style={{ fontSize: 12.5, fontFamily: FFM, color: "rgba(255,255,255,0.8)" }}>swipe up to unlock</div>
      </div>
    </div>
  );
}

// ── App folders ─────────────────────────────────────────────────────────────
// Springboard tile: rounded glass square with a 2x2 mini-grid of the first 4
// member icons, label below. (visual only — parent owns the gesture)
function FolderTile({ folder, appById, glass, highlight }) {
  const members = (folder.apps || []).map(id => appById(id)).filter(Boolean).slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.22)", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" + (highlight ? ", 0 0 0 3px rgba(255,255,255,0.7)" : ""), display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 4, padding: 7, boxSizing: "border-box" }}>
        {members.map(m => <div key={m.id} style={{ lineHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><MobileIcon app={m} size={19} glass={glass} /></div>)}
        {Array.from({ length: Math.max(0, 4 - members.length) }).map((_, i) => <div key={"e" + i} />)}
      </div>
      <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.55)", maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{folder.name || "Folder"}</span>
    </div>
  );
}
// Open-folder overlay: rename, launch an app, or remove one (folder dissolves
// back to Home when it drops to a single app).
function FolderView({ folder, appById, glass, onOpenApp, onRemove, onRename, onClose }) {
  const [name, setName] = useState(folder.name || "Folder");
  const members = (folder.apps || []).map(id => appById(id)).filter(Boolean);
  const close = () => { onRename((name || "").trim() || "Folder"); onClose(); };
  return (
    <div onClick={e => { if (Date.now() - lastTouchAt < 700) return; if (e.target === e.currentTarget) close(); }}
      onTouchEnd={e => { lastTouchAt = Date.now(); if (e.target === e.currentTarget) close(); }}
      style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(6,8,18,0.6)", backdropFilter: "blur(28px) saturate(140%)", WebkitBackdropFilter: "blur(28px) saturate(140%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "calc(" + SAT + " + 40px) 22px", animation: "pop-in 0.24s cubic-bezier(0.22,1,0.36,1)" }}>
      <input value={name} onChange={e => setName(e.target.value)} onBlur={() => onRename((name || "").trim() || "Folder")} spellCheck={false}
        style={{ background: "none", border: "none", outline: "none", textAlign: "center", color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 20, marginBottom: 20, width: "80%" }} />
      <div style={{ width: "100%", maxWidth: 360, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 28, padding: "22px 16px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "22px 6px", maxHeight: "60vh", overflowY: "auto" }}>
        {members.map(m => (
          <div key={m.id} onClick={() => onOpenApp(m.id)} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <div style={{ lineHeight: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.34))" }}><MobileIcon app={m} size={54} glass={glass} /></div>
            <span style={{ fontSize: 11, color: "#fff", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
            <button onClick={e => { e.stopPropagation(); onRemove(m.id); }} style={{ position: "absolute", top: -8, left: "calc(50% - 32px)", width: 20, height: 20, borderRadius: "50%", background: "#3a3a3c", border: "1.5px solid rgba(255,255,255,0.5)", color: "#fff", fontSize: 15, lineHeight: "15px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>−</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: FFM }}>tap outside to close · − removes an app</div>
    </div>
  );
}

// ── Notification Center (swipe down from the top-left) ──────────────────────
const NK_COLOR = { info: "#6366f1", success: "#10b981", warning: "#f59e0b", alert: "#ef4444" };
function nkTimeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}
function NotificationCenter({ AC, notifications, appById, glass, onOpenApp, onDismiss, onClear, onClose }) {
  const hdr = useRef(null);
  const lst = useRef(null);
  const listRef = useRef(null);
  const tapItem = (n) => { if (n.appId && appById(n.appId)) onOpenApp(n.appId); else onDismiss?.(n.id); };
  // swipe up on the header → close
  const hdrDown = (e) => { hdr.current = pt(e).clientY; };
  const hdrUp = (e) => { if (hdr.current != null && hdr.current - pt(e).clientY > 36) onClose(); hdr.current = null; };
  // in the list: swipe up while scrolled to the top → close; tap empty area → close
  const listDown = (e) => { lst.current = { y: pt(e).clientY, top: e.currentTarget.scrollTop, target: e.target }; };
  const listUp = (e) => {
    lastTouchAt = Date.now();
    const s = lst.current; lst.current = null; if (!s) return;
    const dy = s.y - pt(e).clientY;
    if (s.top <= 2 && dy > 50) { onClose(); return; }                       // swipe up at top
    if (Math.abs(dy) < 10 && e.target === e.currentTarget) onClose();       // tap empty area
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, paddingTop: "calc(" + SAT + " + 18px)", background: "rgba(6,8,18,0.62)", backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", animation: "panel-down 0.34s cubic-bezier(0.22,1,0.36,1)", display: "flex", flexDirection: "column" }}>
      <div onTouchStart={hdrDown} onTouchEnd={hdrUp} onMouseDown={hdrDown} onMouseUp={hdrUp} style={{ padding: "0 18px 8px", maxWidth: 560, width: "100%", margin: "0 auto", touchAction: "none" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}><div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 15 }}>
          <span>Notifications</span>
          {notifications.length > 0 && <button onClick={onClear} style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 12, padding: "6px 12px", borderRadius: 14, cursor: "pointer" }}>Clear</button>}
        </div>
      </div>
      <div ref={listRef} onTouchStart={listDown} onTouchEnd={listUp} style={{ flex: 1, overflowY: "auto", padding: "6px 14px 16px", display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 560, margin: "0 auto" }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontFamily: FFM, fontSize: 13, padding: "60px 0" }}>No notifications</div>
        ) : notifications.map(n => {
          const a = n.appId ? appById(n.appId) : null;
          return (
            <div key={n.id} className="mb-cc-tile" onClick={() => tapItem(n)}
              style={{ position: "relative", display: "flex", gap: 11, padding: "13px 14px", borderRadius: 18, cursor: "pointer", background: n.read ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                {a ? <MobileIcon app={a} size={34} glass={glass} />
                   : <div style={{ width: 34, height: 34, borderRadius: 9, background: NK_COLOR[n.kind] || NK_COLOR.info, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔔</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: FFB, fontWeight: 700, fontSize: 13.5, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: FFM, flexShrink: 0 }}>{nkTimeAgo(n.ts)}</span>
                </div>
                {n.body && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)", marginTop: 3, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.body}</div>}
              </div>
              <button onClick={e => { e.stopPropagation(); onDismiss?.(n.id); }} style={{ flexShrink: 0, alignSelf: "flex-start", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 16, lineHeight: 1, cursor: "pointer", padding: 2 }}>✕</button>
            </div>
          );
        })}
      </div>
      {/* always-present close bar — tap or swipe up; guarantees an exit */}
      <div onClick={onClose} onTouchStart={hdrDown} onTouchEnd={(e) => { lastTouchAt = Date.now(); hdrUp(e); }}
        style={{ flexShrink: 0, paddingBottom: "calc(" + SAB + " + 8px)", paddingTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", touchAction: "none" }}>
        <div style={{ width: 124, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.6)" }} />
        <span style={{ fontSize: 11.5, fontFamily: FFM, color: "rgba(255,255,255,0.6)" }}>tap or swipe up to close</span>
      </div>
    </div>
  );
}

// ── App Library ───────────────────────────────────────────────────────────
function AppLibrary({ AC, apps, glass, cols = 4, search, setSearch, onPick, onLong, onClose }) {
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gap: "20px 8px", alignContent: "start", maxWidth: 760, margin: "0 auto" }}>
          {list.map(a => <IconTile key={a.id} app={a} glass={glass} onOpen={() => onPick(a.id)} onLong={() => onLong(a.id)} />)}
          {list.length === 0 && <div style={{ gridColumn: "span " + cols, textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px 0", fontStyle: "italic" }}>No apps found</div>}
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

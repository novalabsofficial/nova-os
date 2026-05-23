
// NOVA OS v6.3 — Nova Systems
// Drop this into src/NovaOS.jsx
 
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "./firebase.js";
// Lib (pure helpers, testable)
import {
  TASKBAR_H, MIN_W, MIN_H,
  ICON_W, ICON_H, ICON_GAP, ICON_PAD_X, ICON_PAD_Y,
  WIDGET_SNAP,
} from "./lib/constants.js";
import { hexRgb, fill, bdr, isUrl } from "./lib/format.js";
import { defaultIconPos, snapToFreeGrid, snapW } from "./lib/geometry.js";
import { autoModerate, isAdmin, isPubliclyVisible } from "./lib/moderation.js";
import { rewriteForIframe, isLikelyUnframable } from "./lib/browser.js";
import { detectDevice, effectiveDeviceMode, isTouchMode } from "./lib/device.js";
import { applyOp, formatDisplay, toggleSign, appendKey } from "./lib/calc.js";
import { createBoard as mineCreateBoard, floodReveal, isWin as mineIsWin, mineTotal, MINE_DIFFICULTIES } from "./lib/minesweeper.js";
import { dailyWord, scoreGuess, normalizeGuess } from "./lib/wordle.js";
import { emptyGrid as tetrisEmpty, randomPiece as tetrisRandom, shapeOf, fits as tetrisFits, lockPiece as tetrisLock, clearLines as tetrisClearLines, scoreForLines, tickInterval, PIECE_COLORS, BOARD_W as TETRIS_W, BOARD_H as TETRIS_H } from "./lib/tetris.js";
import { wmoIcon, wmoLabel, geocodeUrl, parseGeocode, forecastUrl, parseForecast, alertsUrl, parseAlerts, isLikelyUS } from "./lib/weather.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream, deriveTitle as aiDeriveTitle } from "./lib/ai.js";
import { playTone, speak, cancelSpeech, playSound, getSoundConfig, setSoundConfig, setSoundWallpaper } from "./lib/audio.js";
import { db, setDbUid } from "./lib/db.js";
import { login as authLogin, register as authRegister, logoutUser as authLogout, normalizeUsername } from "./lib/auth.js";
import { aiLoad, aiSave, AI_LS_KEYS, AI_LS_CONFIG, AI_LS_CHATS } from "./lib/ai-storage.js";
// UI (shared components + visual constants)
import { DEFAULT_AC, FF, FFB, FFM, INP, SEC, CSS } from "./ui/styles.js";
import {
  COLL, WIDGET_CONFIGS, DEFAULT_WIDGET_STATE, DEFAULT_SIZES, APPS,
  STORE_CATALOG, STORE_CATS, BOOT_MSGS, ACCENT_PRESETS, BOOKMARKS, PAINT_COLORS,
  WALLPAPERS, WMO, HAS_SVG_ICON,
} from "./ui/constants.js";
import { Wallpaper, NovaBg, BlissBg, AuroraBg, MeshBg } from "./ui/wallpapers.jsx";
import { NovaSvgIcon, StoreIcon, AppIconDisplay } from "./ui/icons.jsx";
import { Toggle } from "./ui/Toggle.jsx";
import { BrowserNav } from "./ui/BrowserNav.jsx";
import { ResizeHandles } from "./ui/ResizeHandles.jsx";
import { ContextMenu } from "./ui/ContextMenu.jsx";
import { AiAssist } from "./ui/AiAssist.jsx";
// Widgets
import {
  WidgetShell,
  ClockWidgetContent, WeatherWidgetContent, NotesWidgetContent,
  TasksWidgetContent, CalendarWidgetContent, SysInfoWidgetContent,
} from "./widgets/widgets.jsx";
// Apps — lazy-loaded via React.lazy so each app ships in its own chunk.
// Vite splits these into separate JS files; the first time you open Notes,
// notes-<hash>.js downloads; opening Tetris later pulls tetris-<hash>.js.
// Suspense (wired around the window content below) shows the fallback while
// each chunk is in flight.
const NotesApp       = lazy(() => import("./apps/NotesApp.jsx").then(m       => ({default: m.NotesApp})));
const TasksApp       = lazy(() => import("./apps/TasksApp.jsx").then(m       => ({default: m.TasksApp})));
const FilesApp       = lazy(() => import("./apps/FilesApp.jsx").then(m       => ({default: m.FilesApp})));
const PaintApp       = lazy(() => import("./apps/PaintApp.jsx").then(m       => ({default: m.PaintApp})));
const BrowserApp     = lazy(() => import("./apps/BrowserApp.jsx").then(m     => ({default: m.BrowserApp})));
const SnakeApp       = lazy(() => import("./apps/SnakeApp.jsx").then(m       => ({default: m.SnakeApp})));
const Game2048App    = lazy(() => import("./apps/Game2048App.jsx").then(m    => ({default: m.Game2048App})));
const StoreApp       = lazy(() => import("./apps/StoreApp.jsx").then(m       => ({default: m.StoreApp})));
const TerminalApp    = lazy(() => import("./apps/TerminalApp.jsx").then(m    => ({default: m.TerminalApp})));
const SettingsApp    = lazy(() => import("./apps/SettingsApp.jsx").then(m    => ({default: m.SettingsApp})));
const ProfileApp     = lazy(() => import("./apps/ProfileApp.jsx").then(m     => ({default: m.ProfileApp})));
const ChatApp        = lazy(() => import("./apps/ChatApp.jsx").then(m        => ({default: m.ChatApp})));
const CalculatorApp  = lazy(() => import("./apps/CalculatorApp.jsx").then(m  => ({default: m.CalculatorApp})));
const ClockApp       = lazy(() => import("./apps/ClockApp.jsx").then(m       => ({default: m.ClockApp})));
const CalendarApp    = lazy(() => import("./apps/CalendarApp.jsx").then(m    => ({default: m.CalendarApp})));
const MusicApp       = lazy(() => import("./apps/MusicApp.jsx").then(m       => ({default: m.MusicApp})));
const PdfApp         = lazy(() => import("./apps/PdfApp.jsx").then(m         => ({default: m.PdfApp})));
const AtmosApp       = lazy(() => import("./apps/AtmosApp.jsx").then(m       => ({default: m.AtmosApp})));
const MinesweeperApp = lazy(() => import("./apps/MinesweeperApp.jsx").then(m => ({default: m.MinesweeperApp})));
const WordleApp      = lazy(() => import("./apps/WordleApp.jsx").then(m      => ({default: m.WordleApp})));
const TetrisApp      = lazy(() => import("./apps/TetrisApp.jsx").then(m      => ({default: m.TetrisApp})));
const NovaAiApp      = lazy(() => import("./apps/NovaAiApp.jsx").then(m      => ({default: m.NovaAiApp})));

 
// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function NovaOS(){
  const [screen,     setScreen]     = useState("boot");
  const [bootLines,  setBootLines]  = useState([]);
  const [mode,       setMode]       = useState("login");
  const [uname,      setUname]      = useState("");
  const [pass,       setPass]       = useState("");
  const [authErr,    setAuthErr]    = useState("");
  const [busy,       setBusy]       = useState(false);
  const [user,       setUser]       = useState(null);
  // v6.3: track the Firebase Auth uid alongside the display username. The
  // username drives all UI ("@username", mod check, doc-key building); the
  // uid drives Firestore security rule checks.
  const [uid,        setUid]        = useState(null);
  const [data,       setData]       = useState(null);
  const [customWp,   setCustomWp]   = useState(null);
  const [wins,       setWins]       = useState([]);
  const [maxZ,       setMaxZ]       = useState(100);
  const [tick,       setTick]       = useState(new Date());
  const [toast,      setToast]      = useState(null);
  const [drag,       setDrag]       = useState(null);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [menuSrch,   setMenuSrch]   = useState("");
  const [iconPos,    setIconPos]    = useState({});
  const [iconDrag,   setIconDrag]   = useState(null);
  const [widgetState,setWidgetState]= useState(DEFAULT_WIDGET_STATE);
  const [widgetDrag, setWidgetDrag] = useState(null);
  const [widgetResize,setWidgetResize]=useState(null);
  // Detected device mode — re-detect on window resize so rotating a tablet
  // or resizing the browser shifts the layout. The user's saved preference
  // (data.settings.displayMode) is layered on top via effectiveDeviceMode.
  const [detectedMode, setDetectedMode] = useState(()=>detectDevice());
  // localStorage flag so the mobile-notice splash only shows once per device.
  const [mobileNoticeAck, setMobileNoticeAck] = useState(
    ()=>typeof localStorage!=="undefined" && localStorage.getItem("nova-mobile-ack")==="1"
  );

  const iconPosRef    = useRef({});
  const widgetRef     = useRef(DEFAULT_WIDGET_STATE);
  const menuRef       = useRef(null);
  const winsRef       = useRef(wins);
  useEffect(()=>{iconPosRef.current=iconPos;},[iconPos]);
  useEffect(()=>{widgetRef.current=widgetState;},[widgetState]);
  useEffect(()=>{winsRef.current=wins;},[wins]);
 
  const settings=data?.settings||{};
  const AC      =settings.accent    ||DEFAULT_AC;
  const use24h  =settings.clock24h  ||false;
  const winBlur =settings.winBlur   ??18;
  const largeFnt=settings.largeFont ||false;
  const wpId    =settings.wallpaper ||data?.wallpaper||"mesh";
  const widgets =settings.widgets   ||{};
  // Resolved device mode: user's saved preference overrides detection. "auto"
  // (or any unset/invalid value) defers to the viewport+touch heuristic.
  const deviceMode = effectiveDeviceMode(settings.displayMode, detectedMode);
  const touchy = isTouchMode(deviceMode);
 
  // Boot sequence — when the last "System ready" message lands, queue the
  // startup sound + transition to login. Most browsers block audio before a
  // user gesture, so the startup chime may silently fail on first cold load
  // — that's OK, the login sound after the user clicks Sign In will play.
  useEffect(()=>{let i=0,dead=false;function nxt(){if(dead)return;if(i>=BOOT_MSGS.length){playSound("startup");setTimeout(()=>{if(!dead)setScreen("login");},700);return;}setBootLines(p=>[...p,BOOT_MSGS[i++]]);setTimeout(nxt,i<2?90:230);}setTimeout(nxt,380);return()=>{dead=true;};},[]);
  useEffect(()=>{const t=setInterval(()=>setTick(new Date()),1000);return()=>clearInterval(t);},[]);
  // Watch viewport size so the detected device mode stays current (e.g. on
  // rotation or window resize). Throttled-by-debounce isn't needed — resize
  // fires sparingly and detectDevice is cheap.
  useEffect(()=>{
    function onResize(){setDetectedMode(detectDevice());}
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);
  // When the effective mode flips to mobile mid-session, snap any "normal"
  // (windowed) apps to maximized so they don't keep spilling off-screen.
  // prevBounds preserves the windowed position so toggling out of maximize
  // later still works.
  useEffect(()=>{
    if(deviceMode!=="mobile")return;
    setWins(ws=>ws.map(w=>{
      if(w.state!=="normal")return w;
      return {...w,state:"maximized",prevBounds:w.prevBounds||{x:w.x,y:w.y,width:w.width,height:w.height}};
    }));
  },[deviceMode]);
  useEffect(()=>{if(user&&wpId==="custom")db.get("user:"+user+":wpimg").then(url=>{if(url)setCustomWp(url);});},[user,wpId]);
  // v6.2: tell the sound system which wallpaper is active so system tones
  // transpose to the matching musical key. Fires both on initial data load
  // (when wpId resolves from Firestore) and on every subsequent wallpaper
  // change. Safe to call before audio actually plays — it just writes to
  // localStorage.
  useEffect(()=>{ setSoundWallpaper(wpId); },[wpId]);
  // Outside-click closes menu. pointerdown covers both mouse and touch in one go.
  useEffect(()=>{if(!menuOpen)return;function h(e){if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);}setTimeout(()=>document.addEventListener("pointerdown",h),0);return()=>document.removeEventListener("pointerdown",h);},[menuOpen]);

  // All drag/resize tracking uses Pointer Events (pointermove/pointerup/pointercancel).
  // Pointer Events fire for mouse, touch, AND pen with a unified API — this is what
  // makes drag/resize work on tablet touchscreens without a separate touch code path.
  // pointercancel fires if the OS interrupts the gesture (system gesture, call, etc.);
  // we clean up exactly like pointerup so the dragged item doesn't get stuck.

  // Window drag/resize
  useEffect(()=>{
    function onMove(e){if(!drag)return;if(drag.type==="move"){setWins(ws=>ws.map(w=>{if(w.id!==drag.winId)return w;return{...w,x:Math.max(0,e.clientX-drag.ox),y:Math.max(0,Math.min(e.clientY-drag.oy,window.innerHeight-80))};}));}else if(drag.type==="resize"){const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;setWins(ws=>ws.map(w=>{if(w.id!==drag.winId)return w;let nx=drag.wx,ny=drag.wy,nw=drag.ww,nh=drag.wh;if(drag.edge.includes("e"))nw=Math.max(MIN_W,drag.ww+dx);if(drag.edge.includes("s"))nh=Math.max(MIN_H,drag.wh+dy);if(drag.edge.includes("w")){nw=Math.max(MIN_W,drag.ww-dx);nx=drag.wx+drag.ww-nw;}if(drag.edge.includes("n")){nh=Math.max(MIN_H,drag.wh-dy);ny=drag.wy+drag.wh-nh;}return{...w,x:nx,y:ny,width:nw,height:nh};}));}}
    function onUp(){setDrag(null);}
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[drag]);

  // Icon drag — free move, snap-to-free-grid on release
  useEffect(()=>{
    if(!iconDrag)return;
    function onMove(e){const nx=Math.max(0,Math.min(e.clientX-iconDrag.ox,window.innerWidth-ICON_W));const ny=Math.max(0,Math.min(e.clientY-iconDrag.oy,window.innerHeight-TASKBAR_H-ICON_H));setIconPos(prev=>({...prev,[iconDrag.id]:{x:nx,y:ny}}));}
    function onUp(){const allPos={};(iconDrag.allIcons||[]).forEach((app,idx)=>{allPos[app.id]=iconPosRef.current[app.id]||defaultIconPos(idx);});const raw=iconPosRef.current[iconDrag.id]||allPos[iconDrag.id];const snapped=raw?snapToFreeGrid(iconDrag.id,raw.x,raw.y,allPos):null;const fp=snapped?{...iconPosRef.current,[iconDrag.id]:snapped}:iconPosRef.current;setIconPos(fp);db.set("user:"+iconDrag.user+":iconpos",fp).catch(()=>{});setIconDrag(null);}
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[iconDrag]);

  // Widget drag — free move, snap to 20px grid on release
  useEffect(()=>{
    if(!widgetDrag)return;
    function onMove(e){const nx=Math.max(0,Math.min(e.clientX-widgetDrag.ox,window.innerWidth-100));const ny=Math.max(0,Math.min(e.clientY-widgetDrag.oy,window.innerHeight-TASKBAR_H-60));setWidgetState(prev=>({...prev,[widgetDrag.id]:{...prev[widgetDrag.id],x:nx,y:ny}}));}
    function onUp(){setWidgetState(prev=>{const s=prev[widgetDrag.id];const snapped=snapW(s.x,s.y);const np={...prev,[widgetDrag.id]:{...s,...snapped}};const fin=np;updateData(d=>({...d,settings:{...(d.settings||{}),widgetState:fin}}));return fin;});setWidgetDrag(null);}
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[widgetDrag]);

  // Widget resize — 8-direction, snap position to grid on release
  useEffect(()=>{
    if(!widgetResize)return;
    function onMove(e){
      const dx=e.clientX-widgetResize.sx,dy=e.clientY-widgetResize.sy;
      const cfg=WIDGET_CONFIGS[widgetResize.id]||{minW:120,minH:80};
      setWidgetState(prev=>{
        const s={...prev[widgetResize.id]};
        let nx=widgetResize.x0,ny=widgetResize.y0,nw=widgetResize.w0,nh=widgetResize.h0;
        if(widgetResize.edge.includes("e"))nw=Math.max(cfg.minW,widgetResize.w0+dx);
        if(widgetResize.edge.includes("s"))nh=Math.max(cfg.minH,widgetResize.h0+dy);
        if(widgetResize.edge.includes("w")){nw=Math.max(cfg.minW,widgetResize.w0-dx);nx=widgetResize.x0+widgetResize.w0-nw;}
        if(widgetResize.edge.includes("n")){nh=Math.max(cfg.minH,widgetResize.h0-dy);ny=widgetResize.y0+widgetResize.h0-nh;}
        return {...prev,[widgetResize.id]:{...s,x:nx,y:ny,w:nw,h:nh}};
      });
    }
    function onUp(){
      setWidgetState(prev=>{const s=prev[widgetResize.id];const snapped=snapW(s.x,s.y);const np={...prev,[widgetResize.id]:{...s,...snapped}};updateData(d=>({...d,settings:{...(d.settings||{}),widgetState:np}}));return np;});
      setWidgetResize(null);
    }
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[widgetResize]);
 
  const showToast     =useCallback((msg)=>{setToast(msg);playSound("toast");setTimeout(()=>setToast(null),2500);},[]);
  // saveData has to live up here (instead of with updateData/updateSettings
  // below) because the Notification Center callbacks below depend on it via
  // useCallback deps — defining them before saveData hits a temporal dead
  // zone and kills the initial render with a ReferenceError.
  const saveData      =useCallback(async(d)=>{if(user)await db.set("user:"+user+":data",d);},[user]);

  // ── Context Menu ─────────────────────────────────────────────────────
  // A single global menu — only one can be open at a time. Each handler
  // builds its own item list and calls openContextMenu({x, y, items}).
  const [ctxMenu, setCtxMenu] = useState(null);
  const openContextMenu = useCallback((e, items)=>{
    if(!items || items.length===0) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({x: e.clientX, y: e.clientY, items});
  }, []);
  const closeContextMenu = useCallback(()=>setCtxMenu(null), []);

  // ── Notification Center ──────────────────────────────────────────────
  // Persistent notifications live in data.notifications (a capped array,
  // newest first). Different from toasts: toasts are ephemeral action
  // confirmations, notifications are events the user might want to revisit.
  const [notifsOpen, setNotifsOpen] = useState(false);
  const pushNotification = useCallback((n)=>{
    if(!n || !n.title) return;
    const notif = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2,7),
      ts: Date.now(),
      read: false,
      kind: n.kind || "info",  // info | success | warning | alert
      title: n.title,
      body: n.body || "",
      appId: n.appId || null,
    };
    setData(prev=>{
      if(!prev) return prev;
      // Cap at 50 to avoid unbounded growth in Firestore documents
      const next = {...prev, notifications: [notif, ...(prev.notifications||[]).slice(0,49)]};
      saveData(next);
      return next;
    });
    playSound("notification");
  },[saveData]);
  const dismissNotification = useCallback((id)=>{
    setData(prev=>{
      if(!prev) return prev;
      const next = {...prev, notifications: (prev.notifications||[]).filter(n=>n.id!==id)};
      saveData(next);
      return next;
    });
  },[saveData]);
  const clearAllNotifications = useCallback(()=>{
    setData(prev=>{
      if(!prev) return prev;
      const next = {...prev, notifications: []};
      saveData(next);
      return next;
    });
  },[saveData]);
  const markAllNotificationsRead = useCallback(()=>{
    setData(prev=>{
      if(!prev) return prev;
      const cur=prev.notifications||[];
      if(cur.every(n=>n.read)) return prev; // nothing to do
      const next={...prev, notifications: cur.map(n=>({...n, read:true}))};
      saveData(next);
      return next;
    });
  },[saveData]);
  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter(n=>!n.read).length;
  // When the panel opens, mark everything read after a tick — avoids visual flash
  useEffect(()=>{
    if(!notifsOpen) return;
    const id = setTimeout(()=>markAllNotificationsRead(), 250);
    return ()=>clearTimeout(id);
  },[notifsOpen, markAllNotificationsRead]);
  const updateData    =useCallback((patch)=>{setData(prev=>{const next=typeof patch==="function"?patch(prev):{...prev,...patch};saveData(next);return next;});},[saveData]);
  const updateSettings=useCallback((patch)=>{updateData(prev=>({...prev,settings:{...(prev.settings||{}),...patch}}));},[updateData]);
  const handleCustomWallpaper=useCallback(async(url)=>{setCustomWp(url);await db.set("user:"+user+":wpimg",url);updateSettings({wallpaper:"custom"});showToast("Custom wallpaper set ✓");},[user,updateSettings,showToast]);
  const focusWin=useCallback((id)=>{setMaxZ(z=>{const nz=z+1;setWins(ws=>ws.map(w=>w.id===id?{...w,z:nz}:w));return nz;});},[]);
  // On mobile, every new window opens MAXIMIZED. Default sizes (520x480 etc.)
  // are wider than a ~360px phone and would otherwise spill off the right edge.
  // We still stash the windowed position in prevBounds so toggling out of
  // maximize restores to a sane place if the user later switches modes.
  const openApp=useCallback((appId)=>{
    setMenuOpen(false);
    setMaxZ(z=>{
      const nz=z+1;
      setWins(ws=>{
        const ex=ws.find(w=>w.app===appId);
        if(ex) return ws.map(w=>w.id===ex.id?{...w,z:nz,state:w.state==="minimized"?(deviceMode==="mobile"?"maximized":"normal"):w.state}:w);
        // Fresh open — play the app-launch chime. (Restoring from minimized
        // doesn't play it; that's existing window, not a new app launch.)
        playSound("appLaunch");
        const n=ws.length%6;
        const sz=DEFAULT_SIZES[appId]||{w:520,h:480};
        const baseX=120+n*28, baseY=36+n*22;
        const mobileFirst = deviceMode==="mobile";
        return [...ws,{
          id:Date.now()+Math.random(), app:appId, z:nz,
          x:baseX, y:baseY, width:sz.w, height:sz.h,
          state: mobileFirst ? "maximized" : "normal",
          prevBounds: mobileFirst ? {x:baseX,y:baseY,width:sz.w,height:sz.h} : null,
        }];
      });
      return nz;
    });
  },[deviceMode]);
  function startDrag(e,winId){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"move",winId,ox:e.clientX-w.x,oy:e.clientY-w.y});focusWin(winId);}}
  function startResize(e,winId,edge){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"resize",winId,edge,sx:e.clientX,sy:e.clientY,wx:w.x,wy:w.y,ww:w.width,wh:w.height});focusWin(winId);}}
  function closeWin(id){playSound("windowClose");setWins(ws=>ws.filter(w=>w.id!==id));}
  function minimizeWin(id){setWins(ws=>ws.map(w=>w.id===id?{...w,state:w.state==="minimized"?"normal":"minimized"}:w));}
  function maximizeWin(id){setWins(ws=>ws.map(w=>{if(w.id!==id)return w;if(w.state==="maximized")return{...w,state:"normal",...(w.prevBounds||{}),prevBounds:null};return{...w,state:"maximized",prevBounds:{x:w.x,y:w.y,width:w.width,height:w.height}};}));}
  function onIconMouseDown(e,appId,allIcons){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const idx=allIcons.findIndex(a=>a.id===appId);const pos=iconPos[appId]||defaultIconPos(idx);setIconDrag({id:appId,ox:e.clientX-pos.x,oy:e.clientY-pos.y,user,allIcons:[...allIcons]});}
  function onWidgetDragStart(e,id){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const s=widgetState[id]||DEFAULT_WIDGET_STATE[id];setWidgetDrag({id,ox:e.clientX-s.x,oy:e.clientY-s.y});}
  function onWidgetResizeStart(e,id,edge){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const s=widgetState[id]||DEFAULT_WIDGET_STATE[id];setWidgetResize({id,edge,sx:e.clientX,sy:e.clientY,x0:s.x,y0:s.y,w0:s.w,h0:s.h});}
  function closeWidget(id){updateSettings({widgets:{...widgets,[id]:false}});}

  // Mobile splash visibility — only show when the effective mode actually
  // resolves to mobile (so a user who set Tablet override won't see it).
  const showMobileNotice = deviceMode === "mobile" && !mobileNoticeAck;
  function ackMobileNotice(){
    if(typeof localStorage!=="undefined") localStorage.setItem("nova-mobile-ack","1");
    setMobileNoticeAck(true);
  }
  function switchToTabletMode(){
    if(user) updateSettings({displayMode:"tablet"});
    ackMobileNotice();
  }

  // Reusable mobile-notice overlay — rendered on top of every screen state
  // when showMobileNotice is true. Phones get this on first load (or any time
  // the saved ack is cleared).
  const MobileNotice = !showMobileNotice ? null : (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(7,8,18,0.96)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:FF}}>
      <div style={{maxWidth:380,width:"100%",background:"rgba(15,18,32,0.96)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"28px 24px",textAlign:"center",boxShadow:"0 30px 90px rgba(0,0,0,0.7)"}}>
        <div style={{fontSize:48,marginBottom:12}}>📱</div>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"#fff",marginBottom:10,letterSpacing:0.3}}>Small Screen Detected</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.65,marginBottom:20}}>
          Nova OS is built around draggable windows and a desktop metaphor — it works best on a <strong style={{color:"rgba(255,255,255,0.85)"}}>tablet or computer</strong>. On a phone-sized screen, windows and controls get tight.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {user && (
            <button onClick={switchToTabletMode} style={{padding:"11px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC}}>Try Tablet Layout</button>
          )}
          <button onClick={ackMobileNotice} style={{padding:"11px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.78)"}}>Continue Anyway</button>
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:14,fontStyle:"italic"}}>Change this any time in Settings → Display Mode.</div>
      </div>
    </div>
  );

  async function handleAuth(){
    // Tiny wrapper so every "show user-facing auth error" path also plays the
    // error chime. setAuthErr("") (the success-path clear) intentionally skips
    // the sound.
    const authErr=(msg)=>{setAuthErr(msg);playSound("error");};
    const u=normalizeUsername(uname);const p=pass;  // don't trim password — leading/trailing spaces are valid characters
    if(!u||!p){authErr("All fields required.");return;}if(u.length<3){authErr("Username needs 3+ characters.");return;}
    setBusy(true);setAuthErr("");

    // v6.3: auth goes through Firebase Auth. The new auth.js handles both
    // greenfield accounts and silent migration of pre-6.3 plaintext accounts.
    const initData={notes:[],tasks:[],wallpaper:"mesh",bio:"",joined:Date.now(),settings:{},installedApps:[],folders:[],migratedTo41:true,migratedTo52:true};

    if(mode==="register"){
      try {
        const {uid:newUid} = await authRegister(u, p, initData);
        setDbUid(newUid);  // tell the db wrapper to stamp future writes
        setUser(u);setUid(newUid);setData(initData);
        setIconPos({});setWidgetState(DEFAULT_WIDGET_STATE);
        setScreen("desktop");playSound("login");
      } catch (e) {
        authErr(e?.message || "Could not create account.");
        setBusy(false); return;
      }
    } else {
      let result;
      try {
        result = await authLogin(u, p);
      } catch (e) {
        authErr(e?.message || "Sign-in failed.");
        setBusy(false); return;
      }
      const {uid:newUid, migrated} = result;
      setDbUid(newUid);
      // Now load the user's data via the regular db wrapper.
      const d=await db.get("user:"+u+":data");
      const savedIconPos=await db.get("user:"+u+":iconpos");
      // One-time migrations layered by release. Each runs at most once per user
      // (gated by its own migratedToX.Y flag) and only re-points the wallpaper
      // if the user is on the *previous* default — anyone who deliberately
      // picked sakura / forest / etc. keeps their choice.
      let migratedNow = false;
      if(d&&!d.migratedTo41){
        if(d.wallpaper==="nova")d.wallpaper="aurora";
        if(d.settings?.wallpaper==="nova")d.settings={...d.settings,wallpaper:"aurora"};
        d.migratedTo41=true; migratedNow=true;
      }
      if(d&&!d.migratedTo52){
        if(d.wallpaper==="aurora")d.wallpaper="mesh";
        if(d.settings?.wallpaper==="aurora")d.settings={...d.settings,wallpaper:"mesh"};
        d.migratedTo52=true; migratedNow=true;
      }
      if(migratedNow) await db.set("user:"+u+":data",d);
      setUser(u);setUid(newUid);setData(d||initData);
      setIconPos(savedIconPos||{});
      if(d?.settings?.widgetState)setWidgetState({...DEFAULT_WIDGET_STATE,...d.settings.widgetState});
      setScreen("desktop");playSound("login");
      // Let the user know if this was a silent 6.3 migration. Toast fires
      // after the desktop renders so it's noticeable but unobtrusive.
      if(migrated) setTimeout(()=>setToast({msg:"Account secured ✓ — upgraded to Firebase Auth", ts:Date.now()}), 600);
    }
    setBusy(false);
  }
  async function logout(){
    playSound("logout");
    await authLogout();
    setDbUid(null);
    setUser(null);setUid(null);setData(null);setCustomWp(null);setWins([]);setMaxZ(100);setMenuOpen(false);
    setIconPos({});setIconDrag(null);setWidgetState(DEFAULT_WIDGET_STATE);setWidgetDrag(null);setWidgetResize(null);
    setUname("");setPass("");setAuthErr("");setMode("login");setScreen("login");
  }
 
  const fmtTime=d=>use24h?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false}):d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const fmtDate=d=>d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
  const installedApps=data?.installedApps||[];
  const storeIcons=STORE_CATALOG.filter(a=>installedApps.includes(a.id)).map(a=>({id:"store_"+a.id,icon:a.icon,label:a.name,desc:a.desc,storeApp:a}));
  const allDesktopIcons=[...APPS,...storeIcons];
  const filteredMenu=allDesktopIcons.filter(a=>a.label.toLowerCase().includes(menuSrch.toLowerCase())||a.desc?.toLowerCase().includes(menuSrch.toLowerCase()));
  const isAnyDrag=drag||iconDrag||widgetDrag||widgetResize;
  const dragCursor=drag?(drag.type==="move"?"grabbing":drag.edge+"-resize"):widgetResize?(widgetResize.edge+"-resize"):isAnyDrag?"grabbing":"default";
 
  // ── BOOT ─────────────────────────────────────────────────────────────────
  if(screen==="boot")return(<div style={{width:"100%",height:"100vh",background:"#07080f",display:"flex",flexDirection:"column",justifyContent:"center",padding:"10vh max(24px, 12%)"}}><style>{CSS}</style><div style={{fontFamily:FFB,fontWeight:700,fontSize:"clamp(40px, 12vw, 66px)",letterSpacing:4,color:"#fff",marginBottom:4,lineHeight:1}}>NOVA</div><div style={{fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.22)",letterSpacing:5,marginBottom:46}}>OPERATING SYSTEM  ·  v6.3</div>{bootLines.map((l,i)=><div key={i} style={{fontFamily:FFM,fontSize:12,color:l.includes("ready")?"#4f9eff":"rgba(255,255,255,0.42)",marginBottom:5,animation:"boot-in 0.22s cubic-bezier(0.4,0,0.2,1)"}}>{l.includes("OK")?<>{l.replace("... OK","")}... <span style={{color:"#4cef90"}}>OK</span></>:l}</div>)}{MobileNotice}</div>);
 
  // ── LOGIN ────────────────────────────────────────────────────────────────
  if(screen==="login")return(<div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}><style>{CSS}</style><MeshBg/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"rgba(8,10,22,0.86)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:16,padding:"44px 40px",width:376,maxWidth:"calc(100vw - 24px)",boxShadow:"0 40px 100px rgba(0,0,0,0.6)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,"+DEFAULT_AC+",transparent)"}}/><div style={{fontFamily:FFB,fontWeight:700,fontSize:38,color:"#fff",textAlign:"center",letterSpacing:4,marginBottom:4}}>NOVA</div><div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.22)",textAlign:"center",letterSpacing:4,marginBottom:36}}>OPERATING SYSTEM  ·  v6.3</div><div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.09)",marginBottom:24}}>{["login","register"].map(m=><button key={m} className="lt" onClick={()=>{setMode(m);setAuthErr("");}} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:mode===m?"2px solid "+DEFAULT_AC:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,letterSpacing:1,color:mode===m?DEFAULT_AC:"rgba(255,255,255,0.28)",transition:"color 0.15s"}}>{m==="login"?"SIGN IN":"REGISTER"}</button>)}</div><input style={{...INP,marginBottom:11}} placeholder="Username" value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} autoFocus/><input style={INP} type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/><button className="ls" disabled={busy} onClick={handleAuth} style={{width:"100%",padding:"12px",background:fill(DEFAULT_AC),border:"1px solid "+bdr(DEFAULT_AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:14,letterSpacing:1,color:"#fff",marginTop:14,transition:"opacity 0.15s"}}>{busy?"AUTHENTICATING…":mode==="login"?"SIGN IN →":"CREATE ACCOUNT →"}</button>{authErr&&<div style={{color:"#ff7878",fontFamily:FF,fontSize:13,textAlign:"center",marginTop:12}}>⚠ {authErr}</div>}<div style={{marginTop:20,fontFamily:FF,fontStyle:"italic",fontSize:11,color:"rgba(255,255,255,0.14)",textAlign:"center"}}>Don't reuse real passwords — demo auth only.</div></div></div>{MobileNotice}</div>);
 
  // ── DESKTOP ──────────────────────────────────────────────────────────────
  return(
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",cursor:dragCursor,fontSize:largeFnt?15:13}}
      onContextMenu={e=>{
        // Only fire if the click is on the desktop itself, not on a child
        // (icons + windows have their own onContextMenu that stopPropagation).
        if(e.target !== e.currentTarget && !e.target.classList?.contains("di-empty-space")) return;
        openContextMenu(e, [
          {icon:"⚙", label:"Open Settings", onClick:()=>openApp("settings")},
          {icon:"🎨", label:"Change wallpaper", onClick:()=>{openApp("settings");}},
          {type:"divider"},
          {icon:"🔔", label:"Notifications"+(unreadCount>0?" ("+unreadCount+" unread)":""), onClick:()=>setNotifsOpen(true)},
          {icon:"➕", label:"Open app menu", onClick:()=>{setMenuOpen(true);setMenuSrch("");}},
        ]);
      }}>
      <style>{CSS}</style>
      <Wallpaper id={wpId} customUrl={customWp}/>
      {toast&&<div style={{position:"fixed",top:14,right:14,zIndex:99999,padding:"10px 18px",background:"rgba(8,10,22,0.97)",border:"1px solid "+AC,borderRadius:9,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",animation:"toast-in 0.24s cubic-bezier(0.16,1,0.3,1)",boxShadow:"0 8px 36px rgba(0,0,0,0.6)"}}>{toast}</div>}
 
      {/* Desktop widgets */}
      {Object.keys(WIDGET_CONFIGS).map(id=>{
        if(!widgets[id])return null;
        const s=widgetState[id]||DEFAULT_WIDGET_STATE[id]||{x:200,y:200,w:240,h:140};
        return(
          <WidgetShell key={id} id={id} state={s} onDragStart={onWidgetDragStart} onResizeStart={onWidgetResizeStart} onClose={()=>closeWidget(id)} touchy={touchy}>
            {id==="clock"   &&<ClockWidgetContent   state={s} tick={tick} use24h={use24h} AC={AC}/>}
            {id==="weather" &&<WeatherWidgetContent  state={s}/>}
            {id==="notesw"  &&<NotesWidgetContent    state={s} data={data}/>}
            {id==="tasksw"  &&<TasksWidgetContent    state={s} data={data} updateData={updateData}/>}
            {id==="calendar"&&<CalendarWidgetContent state={s} tick={tick} AC={AC}/>}
            {id==="sysinfo" &&<SysInfoWidgetContent  state={s}/>}
          </WidgetShell>
        );
      })}
 
      {/* Desktop icons */}
      {allDesktopIcons.map((app,idx)=>{
        const pos=iconPos[app.id]||defaultIconPos(idx);
        const isDrg=iconDrag?.id===app.id;
        function launch(){if(app.storeApp){if(app.storeApp.newTab)window.open(app.storeApp.url,"_blank");else openApp("browser");}else openApp(app.id);}
        return(
          <div key={app.id} style={{position:"absolute",left:pos.x,top:pos.y,width:ICON_W,zIndex:isDrg?500:2,cursor:isDrg?"grabbing":"grab",userSelect:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:9,background:"rgba(0,0,0,0.1)",border:"1px solid transparent",transition:isDrg?"none":"background 0.18s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1), top 0.25s cubic-bezier(0.4,0,0.2,1)",boxShadow:isDrg?"0 8px 32px rgba(0,0,0,0.6)":"none"}}
            className={isDrg?"":"di"} title={app.desc}
            onPointerDown={e=>onIconMouseDown(e,app.id,allDesktopIcons)}
            onDoubleClick={launch}
            onContextMenu={e=>openContextMenu(e, [
              {icon:"▶", label:"Open", onClick:launch},
              ...(app.storeApp ? [{
                icon:"–", label:"Remove from desktop", danger:true,
                onClick:()=>{
                  const cur=data?.installedApps||[];
                  updateData(p=>({...p,installedApps:cur.filter(id=>id!==app.id)}));
                  showToast("Removed from desktop");
                },
              }] : []),
              {type:"divider"},
              {icon:"📋", label:"Copy app name", onClick:()=>{try{navigator.clipboard?.writeText(app.label);showToast("Copied");}catch{}}},
            ])}>
            <div style={{pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.7))"}}>
              <AppIconDisplay app={app} size={28}/>
            </div>
            <span style={{fontFamily:FF,fontWeight:600,fontSize:10,color:"#fff",textAlign:"center",lineHeight:1.2,textShadow:"0 1px 4px #000",pointerEvents:"none"}}>{app.label}</span>
          </div>
        );
      })}
 
      {/* Start menu */}
      {menuOpen&&(<div ref={menuRef} style={{position:"fixed",bottom:TASKBAR_H,left:0,width:360,background:"rgba(9,11,24,0.97)",backdropFilter:"blur(30px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"0 14px 0 0",boxShadow:"6px -6px 48px rgba(0,0,0,0.65)",zIndex:9998,display:"flex",flexDirection:"column",animation:"menu-up 0.22s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden"}}>
        <div style={{padding:"16px 16px 10px"}}><div style={{display:"flex",alignItems:"center",gap:9,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"9px 14px"}}><span style={{fontSize:13,opacity:0.5}}>🔍</span><input value={menuSrch} onChange={e=>setMenuSrch(e.target.value)} placeholder="Search apps…" autoFocus style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,0.92)",fontFamily:FF,fontSize:14}}/>{menuSrch&&<button onClick={()=>setMenuSrch("")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>✕</button>}</div></div>
        <div style={{padding:"0 14px 14px",flex:1,overflowY:"auto"}}>
          <div style={SEC}>{menuSrch?`Results for "${menuSrch}"`:"All Apps"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
            {filteredMenu.map(app=>(
              <div key={app.id} className="ma" onClick={()=>{if(app.storeApp){if(app.storeApp.newTab)window.open(app.storeApp.url,"_blank");else openApp("browser");}else openApp(app.id);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 4px",borderRadius:9,cursor:"pointer",transition:"background 0.12s",position:"relative"}}>
                {wins.some(w=>w.app===app.id)&&<div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:AC}}/>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><AppIconDisplay app={app} size={24}/></div>
                <span style={{fontFamily:FF,fontWeight:600,fontSize:10,color:"rgba(255,255,255,0.8)",textAlign:"center",lineHeight:1.25}}>{app.label}</span>
              </div>
            ))}
            {filteredMenu.length===0&&<div style={{gridColumn:"span 4",color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:12,textAlign:"center",padding:"18px 0"}}>No apps found</div>}
          </div>
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:fill(AC),border:"1.5px solid "+AC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>👤</div>
          <div style={{flex:1}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff"}}>@{user}</div><div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.3)"}}>Nova OS v6.3</div></div>
          <button onClick={logout} style={{padding:"6px 12px",background:"rgba(200,40,40,0.12)",border:"1px solid rgba(200,40,40,0.3)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,140,140,0.9)"}}>Logout</button>
        </div>
      </div>)}
 
      {/* Windows */}
      {wins.map(win=>{
        const app=APPS.find(a=>a.id===win.app);
        const isMax=win.state==="maximized",isMin=win.state==="minimized",isDrg=drag&&drag.winId===win.id;
        if(isMin)return null;
        const winStyle=isMax?{position:"fixed",top:0,left:0,right:0,bottom:TASKBAR_H+"px",zIndex:win.z,borderRadius:0}:{position:"absolute",left:win.x,top:win.y,width:win.width,height:win.height,zIndex:win.z,borderRadius:12};
        return(
          <div key={win.id} onClick={()=>focusWin(win.id)} style={{...winStyle,background:"rgba(10,12,26,0.93)",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 "+(isDrg?30:15)+"px "+(isDrg?90:50)+"px rgba(0,0,0,"+(isDrg?0.8:0.6)+")",display:"flex",flexDirection:"column",animation:"win-in 0.24s cubic-bezier(0.16,1,0.3,1)",backdropFilter:"blur("+winBlur+"px)",transition:isDrg?"box-shadow 0.18s cubic-bezier(0.4,0,0.2,1)":"box-shadow 0.18s cubic-bezier(0.4,0,0.2,1), left 0.28s cubic-bezier(0.4,0,0.2,1), top 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1), height 0.28s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden"}}>
            {!isMax&&<ResizeHandles winId={win.id} onStartResize={startResize} touchy={touchy}/>}
            <div onPointerDown={e=>!isMax&&startDrag(e,win.id)} style={{height:38,display:"flex",alignItems:"center",padding:"0 8px 0 12px",gap:9,background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.07)",borderRadius:isMax?"0":"12px 12px 0 0",cursor:isMax?"default":isDrg?"grabbing":"grab",userSelect:"none",flexShrink:0,touchAction:"none"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={16}/></div>
              <span style={{flex:1,fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.88)"}}>{app?.label}</span>
              <button className="wn" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimizeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(255,255,255,0.5)",transition:"background 0.12s",flexShrink:0}}>–</button>
              <button className="wm" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();maximizeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"rgba(255,255,255,0.5)",transition:"background 0.12s",flexShrink:0}}>{isMax?"❐":"⬜"}</button>
              <button className="wx" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();closeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"rgba(255,255,255,0.5)",transition:"background 0.12s, color 0.12s",flexShrink:0}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:18,minWidth:0}}>
              {/* Each app is lazy-loaded — Suspense shows the spinner while the
                  chunk is downloading. Once cached, reopens are instant.
                  Per-window Suspense means opening Tetris doesn't blank out
                  an already-loaded Notes window in another tab. */}
              <Suspense fallback={
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",gap:10,color:"rgba(255,255,255,0.4)",padding:24}}>
                  <div style={{width:18,height:18,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                  <span style={{fontFamily:FF,fontSize:12}}>Loading {app?.label||"app"}…</span>
                </div>
              }>
                {win.app==="notes"    &&<NotesApp    data={data} updateData={updateData} showToast={showToast} AC={AC} openNovaAi={()=>openApp("novaai")}/>}
                {win.app==="tasks"    &&<TasksApp    data={data} updateData={updateData} showToast={showToast} AC={AC} openNovaAi={()=>openApp("novaai")}/>}
                {win.app==="files"    &&<FilesApp    data={data} updateData={updateData} showToast={showToast}/>}
                {win.app==="paint"    &&<PaintApp    showToast={showToast} AC={AC}/>}
                {win.app==="browser"  &&<BrowserApp  AC={AC}/>}
                {win.app==="snake"    &&<SnakeApp    AC={AC}/>}
                {win.app==="2048"     &&<Game2048App AC={AC}/>}
                {win.app==="store"    &&<StoreApp    user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
                {win.app==="terminal" &&<TerminalApp user={user} AC={AC}/>}
                {win.app==="chat"     &&<ChatApp     user={user} AC={AC}/>}
                {win.app==="settings" &&<SettingsApp user={user} data={data} updateSettings={updateSettings} showToast={showToast} AC={AC} onCustomWallpaper={handleCustomWallpaper} onLogout={logout}/>}
                {win.app==="profile"  &&<ProfileApp  user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
                {win.app==="calculator" &&<CalculatorApp AC={AC}/>}
                {win.app==="clock"      &&<ClockApp AC={AC}/>}
                {win.app==="calendar"   &&<CalendarApp data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
                {win.app==="music"      &&<MusicApp AC={AC} showToast={showToast}/>}
                {win.app==="pdf"        &&<PdfApp AC={AC} showToast={showToast}/>}
                {win.app==="atmos"      &&<AtmosApp AC={AC} showToast={showToast} pushNotification={pushNotification} openNovaAi={()=>openApp("novaai")}/>}
                {win.app==="minesweeper"&&<MinesweeperApp AC={AC}/>}
                {win.app==="wordle"     &&<WordleApp AC={AC} showToast={showToast}/>}
                {win.app==="tetris"     &&<TetrisApp AC={AC}/>}
                {win.app==="novaai"     &&<NovaAiApp AC={AC} showToast={showToast}/>}
              </Suspense>
            </div>
          </div>
        );
      })}
 
      {/* Taskbar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:TASKBAR_H,background:"rgba(9,11,24,0.92)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",padding:"0 10px",gap:5,zIndex:9999}}>
        <button className="sb" onClick={()=>{setMenuOpen(o=>!o);setMenuSrch("");}} style={{width:38,height:38,borderRadius:10,background:menuOpen?fill(AC):"rgba(255,255,255,0.07)",border:menuOpen?"1px solid "+bdr(AC):"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",fontSize:17,color:menuOpen?AC:"rgba(255,255,255,0.7)"}}>◈</button>
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.09)",margin:"0 3px"}}/>
        {wins.map(win=>{const app=APPS.find(a=>a.id===win.app);const isMin=win.state==="minimized";const isTop=wins.length>0&&win.z===Math.max(...wins.map(w=>w.z));return(<button key={win.id} className="tb" onClick={()=>{if(isMin){setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"normal"}:w));focusWin(win.id);}else if(isTop){setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"minimized"}:w));}else focusWin(win.id);}} onContextMenu={e=>openContextMenu(e,[{icon:"▶",label:isMin?"Restore":"Focus",onClick:()=>{setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"normal"}:w));focusWin(win.id);}},{icon:"—",label:"Minimize",onClick:()=>setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"minimized"}:w)),disabled:isMin},{icon:"⬜",label:win.state==="maximized"?"Restore size":"Maximize",onClick:()=>maximizeWin(win.id)},{type:"divider"},{icon:"✕",label:"Close",danger:true,onClick:()=>closeWin(win.id)}])} style={{height:36,padding:"0 10px",background:isTop&&!isMin?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,cursor:"pointer",fontFamily:FF,fontSize:12,fontWeight:600,color:isMin?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.82)",whiteSpace:"nowrap",transition:"all 0.12s",display:"flex",alignItems:"center",gap:6,position:"relative"}}><div style={{pointerEvents:"none",display:"flex",alignItems:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={14}/></div>{deviceMode!=="mobile"&&<span>{app?.label}</span>}{!isMin&&<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:isTop?18:6,height:2,borderRadius:2,background:AC,transition:"width 0.2s"}}/>}</button>);})}
        <div style={{flex:1}}/>
        {/* Username chip + divider hidden on mobile to save horizontal space — */}
        {/* profile is still reachable via the menu, so this only loses a shortcut. */}
        {deviceMode!=="mobile"&&<div style={{fontFamily:FFB,fontWeight:600,fontSize:12,color:AC,cursor:"pointer"}} onClick={()=>openApp("profile")}>@{user}</div>}
        {deviceMode!=="mobile"&&<div style={{width:1,height:20,background:"rgba(255,255,255,0.09)"}}/>}
        {/* Notification bell — badge shows unread count, click toggles the panel */}
        <button className="sb" onClick={()=>setNotifsOpen(o=>!o)} title={unreadCount>0?unreadCount+" unread":"Notifications"} style={{position:"relative",width:30,height:30,borderRadius:7,background:notifsOpen?fill(AC):"none",border:notifsOpen?"1px solid "+bdr(AC):"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:notifsOpen?AC:"rgba(255,255,255,0.5)"}}>
          🔔
          {unreadCount>0 && <span style={{position:"absolute",top:1,right:1,minWidth:14,height:14,padding:"0 3px",borderRadius:7,background:"#ff5555",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{unreadCount>9?"9+":unreadCount}</span>}
        </button>
        <button className="sb" onClick={()=>openApp("settings")} style={{width:30,height:30,borderRadius:7,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"rgba(255,255,255,0.45)",transition:"background 0.12s"}}>⚙️</button>
        <div style={{textAlign:"right",cursor:"default"}}>
          <div style={{fontFamily:FFM,fontWeight:500,fontSize:12,color:"rgba(255,255,255,0.78)"}}>{fmtTime(tick)}</div>
          {deviceMode!=="mobile"&&<div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.35)"}}>{fmtDate(tick)}</div>}
        </div>
      </div>
      {/* Notification Center side panel */}
      {notifsOpen && (
        <>
          {/* Click-outside scrim */}
          <div onClick={()=>setNotifsOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:9997}}/>
          <div style={{position:"fixed",top:0,right:0,bottom:TASKBAR_H,width:"min(340px, 92vw)",background:"rgba(9,11,24,0.97)",backdropFilter:"blur(28px)",borderLeft:"1px solid rgba(255,255,255,0.08)",boxShadow:"-12px 0 40px rgba(0,0,0,0.45)",zIndex:9998,display:"flex",flexDirection:"column",animation:"menu-up 0.22s cubic-bezier(0.4,0,0.2,1)"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <div style={{flex:1,fontFamily:FFB,fontWeight:700,fontSize:14,color:"#fff"}}>🔔 Notifications</div>
              {notifications.length>0 && <button onClick={clearAllNotifications} style={{padding:"4px 10px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,130,130,0.85)"}}>Clear all</button>}
              <button onClick={()=>setNotifsOpen(false)} style={{width:24,height:24,borderRadius:6,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:14}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"8px"}}>
              {notifications.length===0 ? (
                <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.3)",fontStyle:"italic",fontSize:12,fontFamily:FF}}>
                  No notifications yet.<br/><span style={{fontSize:10,opacity:0.65}}>NWS alerts and other important events will appear here.</span>
                </div>
              ) : notifications.map(n=>{
                const kindColor = n.kind==="alert"?"#ff8b8b":n.kind==="warning"?"#ffcc66":n.kind==="success"?"#4cef90":AC;
                const kindIcon  = n.kind==="alert"?"⚠":n.kind==="warning"?"⚠":n.kind==="success"?"✓":"●";
                const age = Date.now()-n.ts;
                const ageStr = age<60000?"just now":age<3600000?Math.floor(age/60000)+"m ago":age<86400000?Math.floor(age/3600000)+"h ago":new Date(n.ts).toLocaleDateString();
                return(
                  <div key={n.id} style={{padding:"11px 13px",marginBottom:5,background:n.read?"rgba(255,255,255,0.025)":"rgba(255,255,255,0.06)",border:"1px solid "+(n.read?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.1)"),borderRadius:8,position:"relative"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                      <span style={{color:kindColor,fontSize:13,lineHeight:1.4,flexShrink:0}}>{kindIcon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:FFB,fontWeight:600,fontSize:12,color:n.read?"rgba(255,255,255,0.78)":"#fff",lineHeight:1.4}}>{n.title}</div>
                        {n.body && <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:3,lineHeight:1.5,wordBreak:"break-word"}}>{n.body}</div>}
                        <div style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.3)",marginTop:5}}>{ageStr}</div>
                      </div>
                      <button onClick={()=>dismissNotification(n.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:11,padding:"2px 5px",lineHeight:1,flexShrink:0}}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeContextMenu} AC={AC}/>}
      {MobileNotice}
    </div>
  );
}
 

// NOVA OS v8.0 — Nova Systems (UI refresh branch)
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
import { toggleFullscreen, isFullscreen, onFullscreenChange, exitFullscreen } from "./lib/fullscreen.js";
import { defaultIconPos, snapToFreeGrid, snapW, snapWSize } from "./lib/geometry.js";
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
import { db, setDbUid, getDbUid } from "./lib/db.js";
import { watchMyThreads } from "./lib/dms.js";
import { openExternalUrl } from "./lib/openUrl.js";
import { login as authLogin, register as authRegister, logoutUser as authLogout, normalizeUsername } from "./lib/auth.js";
import { aiLoad, aiSave, AI_LS_KEYS, AI_LS_CONFIG, AI_LS_CHATS } from "./lib/ai-storage.js";
// UI (shared components + visual constants)
import { DEFAULT_AC, FF, FFB, FFM, INP, SEC, CSS } from "./ui/styles.js";
import {
  COLL, WIDGET_CONFIGS, DEFAULT_WIDGET_STATE, DEFAULT_SIZES, APPS,
  STORE_CATALOG, STORE_CATS, BOOT_MSGS, ACCENT_PRESETS, BOOKMARKS, PAINT_COLORS,
  WALLPAPERS, WMO, HAS_SVG_ICON, NOVA_VERSION,
} from "./ui/constants.js";
import { Wallpaper, NovaBg, BlissBg, AuroraBg, MeshBg } from "./ui/wallpapers.jsx";
import { NovaSvgIcon, StoreIcon, AppIconDisplay, NovaLogo, WindowControlIcon } from "./ui/icons.jsx";
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
  BatteryWidgetContent,
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
// v7.4 game additions
const TicTacToeApp    = lazy(() => import("./apps/TicTacToeApp.jsx").then(m    => ({default: m.TicTacToeApp})));
const PongApp         = lazy(() => import("./apps/PongApp.jsx").then(m         => ({default: m.PongApp})));
const FlappyBirdApp   = lazy(() => import("./apps/FlappyBirdApp.jsx").then(m   => ({default: m.FlappyBirdApp})));
const SpaceInvadersApp= lazy(() => import("./apps/SpaceInvadersApp.jsx").then(m=> ({default: m.SpaceInvadersApp})));
const PacManApp       = lazy(() => import("./apps/PacManApp.jsx").then(m       => ({default: m.PacManApp})));
const ChessApp        = lazy(() => import("./apps/ChessApp.jsx").then(m        => ({default: m.ChessApp})));
// v8.0 round-3
const PhotosApp       = lazy(() => import("./apps/PhotosApp.jsx").then(m       => ({default: m.PhotosApp})));

 
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
  // v8.0 — Taskbar drag-to-reorder. tbDrag holds the in-flight drag's
  // {appId, dx} for visual feedback (the dragged chip translates with the
  // pointer). The actual array reorder only happens on pointerUp so we
  // don't write to Firestore on every mousemove. justDragged guards against
  // the click event that browsers fire after pointerup — if a drag
  // happened, the chip's onClick should bail rather than launch the app.
  const [tbDrag, setTbDrag] = useState(null);
  const tbDragRef = useRef(null);
  const justDraggedRef = useRef(false);
  const pinChipRefs = useRef({});
  // v8.3 F2: fullscreen state + taskbar auto-hide. In OS fullscreen the
  // taskbar slides off-screen for an immersive view; moving the pointer to
  // the bottom edge of the screen reveals it (standard OS auto-hide). The
  // start menu also gains an explicit "Exit Fullscreen" button.
  const [isFs, setIsFs] = useState(()=>isFullscreen());
  const [tbPeek, setTbPeek] = useState(false);
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
  // Boot sequence — when the last "System ready" message lands, queue the
  // startup sound + transition to login. The cursor `i` is incremented
  // OUTSIDE the setState updater because React 18's StrictMode invokes
  // state updaters twice in dev to catch impure code; an `i++` inside the
  // updater would compound, eventually pushing an out-of-bounds undefined.
  // (Latent in browser dev; surfaced as a crash in Tauri's webview.)
  useEffect(()=>{
    let i = 0, dead = false;
    function nxt() {
      if (dead) return;
      if (i >= BOOT_MSGS.length) {
        playSound("startup");
        setTimeout(()=>{ if (!dead) setScreen("login"); }, 700);
        return;
      }
      const msg = BOOT_MSGS[i];        // capture BEFORE updater; safe in StrictMode
      i++;
      setBootLines(p => [...p, msg]);
      setTimeout(nxt, i < 2 ? 90 : 230);
    }
    setTimeout(nxt, 380);
    return ()=>{ dead = true; };
  },[]);
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
  // v6.4: when "Restore open apps on sign-in" is enabled, save the current
  // window list (debounced ~1.2s) to a separate Firestore doc so we don't
  // round-trip the whole user-data doc on every drag/resize. Saved under
  // user:<uname>:savedWindows. Restored at login (see handleAuth below).
  useEffect(()=>{
    if(!user) return;
    if(!data?.settings?.restoreOnSignin) return;
    const t = setTimeout(()=>{
      // Strip nothing — windows are already plain JSON-friendly objects.
      const toSave = (winsRef.current || []).map(w => ({...w}));
      db.set("user:"+user+":savedWindows", toSave);
    }, 1200);
    return ()=>clearTimeout(t);
  },[wins, user, data?.settings?.restoreOnSignin]);
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

  // v8.0 — Taskbar drag-to-reorder. Lives at the document level so the
  // drag continues even if the pointer leaves the taskbar (e.g., briefly
  // wanders up over a window). We only commit the new pinned order to
  // Firestore on pointerUp — during the drag the chip just visually
  // translates with the pointer via the `tbDrag` state. Reorder math uses
  // each pinned chip's actual bounding rect (captured via pinChipRefs)
  // so the drop slot is pixel-accurate regardless of chip widths
  // (compact icon-only chips vs full chips with labels).
  useEffect(()=>{
    function onMove(e){
      const d=tbDragRef.current;
      if(!d)return;
      const dx=e.clientX-d.startX;
      if(!d.moved&&Math.abs(dx)>8){d.moved=true;}
      if(d.moved){setTbDrag({appId:d.appId,dx});}
    }
    function onUp(e){
      const d=tbDragRef.current;
      if(!d){return;}
      if(d.moved){
        // Compute insertion index relative to the pinned list excluding self.
        const cur=data?.pinnedToTaskbar||[];
        const filtered=cur.filter(id=>id!==d.appId);
        let dropIdx=0;
        filtered.forEach((appId,i)=>{
          const el=pinChipRefs.current[appId];
          if(!el)return;
          const rect=el.getBoundingClientRect();
          const midX=rect.left+rect.width/2;
          if(e.clientX>midX)dropIdx=i+1;
        });
        const next=[...filtered];
        next.splice(dropIdx,0,d.appId);
        if(JSON.stringify(next)!==JSON.stringify(cur)){
          updateData(p=>({...p,pinnedToTaskbar:next}));
        }
        // Suppress the click that browsers fire right after a drag's pointerup
        justDraggedRef.current=true;
        setTimeout(()=>{justDraggedRef.current=false;},60);
      }
      tbDragRef.current=null;
      setTbDrag(null);
    }
    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
    window.addEventListener("pointercancel",onUp);
    return()=>{
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",onUp);
      window.removeEventListener("pointercancel",onUp);
    };
    // Note: updateData is referenced in the body but intentionally omitted
    // from deps — it's declared later in this component via useCallback, so
    // putting it in deps trips a temporal-dead-zone ReferenceError at first
    // render. Closures inside the effect resolve updateData fine when they
    // actually fire (after mount), and updateData's identity is stable
    // anyway. Same pattern as the widget drag useEffect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data?.pinnedToTaskbar]);

  // v8.3 F2: track OS fullscreen state. Subscribe to the unified
  // fullscreen change stream (covers F11, Settings toggle, and Esc/exit).
  useEffect(()=>{
    setIsFs(isFullscreen());
    return onFullscreenChange(setIsFs);
  },[]);

  // v8.3 F2: taskbar auto-hide reveal. Only active while in fullscreen.
  // When the pointer drops within 6px of the bottom edge, peek the
  // taskbar back up; hide it again once the pointer moves away (with a
  // little hysteresis so it doesn't flicker right at the boundary).
  useEffect(()=>{
    if(!isFs){ setTbPeek(false); return; }
    function onMove(e){
      const fromBottom = window.innerHeight - e.clientY;
      if(fromBottom <= 6) setTbPeek(true);
      else if(fromBottom > TASKBAR_H + 20) setTbPeek(false);
    }
    window.addEventListener("pointermove", onMove);
    return ()=>window.removeEventListener("pointermove", onMove);
  },[isFs]);

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
      // v8.0: also snap w/h on resize end so both edges of every widget land
      // on the WIDGET_SNAP grid. Combined with position snapping, this means
      // two widgets dragged near each other line up perfectly regardless of
      // exactly how the user finished the resize.
      setWidgetState(prev=>{
        const s=prev[widgetResize.id];
        const cfg=WIDGET_CONFIGS[widgetResize.id]||{minW:120,minH:80};
        const snapXY=snapW(s.x,s.y);
        const snapSize=snapWSize(s.w,s.h,cfg.minW,cfg.minH);
        const np={...prev,[widgetResize.id]:{...s,...snapXY,...snapSize}};
        updateData(d=>({...d,settings:{...(d.settings||{}),widgetState:np}}));
        return np;
      });
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
      // v8.1: also bump lastChatOpenTs so the chat-DM badge clears at
      // the same time. User expectation for "Clear all" is "no badges
      // anywhere", not just "wipe the notification panel".
      const next = {
        ...prev,
        notifications: [],
        settings: {...(prev.settings||{}), lastChatOpenTs: Date.now()},
      };
      saveData(next);
      return next;
    });
  },[saveData]);
  // v8.1 — mark all notifications for a specific app as read. Called
  // from openApp() when the user launches an app, so the app's badge
  // clears the moment they engage with it.
  const markAppNotificationsRead = useCallback((appId)=>{
    if(!appId) return;
    setData(prev=>{
      if(!prev) return prev;
      const cur = prev.notifications || [];
      // Bail if nothing for this app is unread — avoid pointless writes
      const hasUnread = cur.some(n => n.appId === appId && !n.read);
      const chatNeedsBump = appId === "chat" && (prev.settings?.lastChatOpenTs || 0) < Date.now() - 1000;
      if (!hasUnread && !chatNeedsBump) return prev;
      const nextNotifs = hasUnread
        ? cur.map(n => n.appId === appId ? {...n, read: true} : n)
        : cur;
      const nextSettings = appId === "chat"
        ? {...(prev.settings||{}), lastChatOpenTs: Date.now()}
        : (prev.settings || {});
      const next = {...prev, notifications: nextNotifs, settings: nextSettings};
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

  // v8.1 — Per-app notification badges.
  //
  // Two sources of "this app needs your attention":
  //   1. Notifications array, filtered by appId + !read. Atmos's NWS-alert
  //      pushes set appId:"atmos" so those naturally flow into the badge.
  //   2. Chat: unread DM count, computed by comparing each thread's
  //      lastTs against data.settings.lastChatOpenTs (set when the user
  //      opens the Chat app). Skips threads where lastSenderUid is the
  //      user themselves — no badge for messages I sent.
  //
  // Badges clear when:
  //   • The user opens the app (markAppNotificationsRead in openApp +
  //     openApp("chat") also bumps lastChatOpenTs)
  //   • The user hits "Clear all" in the notification center (empties
  //     notifications AND bumps lastChatOpenTs so chat unread clears too)
  const [dmThreads, setDmThreads] = useState([]);
  useEffect(() => {
    const uid = getDbUid();
    if (!uid) { setDmThreads([]); return; }
    return watchMyThreads(uid, setDmThreads);
  }, [user]); // re-subscribe when the username changes (login → logout → login as someone else)

  // Compute badge counts. The map is { appId: count } so the renderer
  // can look up by app id with O(1).
  const lastChatOpenTs = data?.settings?.lastChatOpenTs || 0;
  const myUid = getDbUid();
  const chatUnread = dmThreads.filter(t =>
    t.lastSenderUid && t.lastSenderUid !== myUid && (t.lastTs || 0) > lastChatOpenTs
  ).length;
  const appBadgeCounts = {};
  notifications.forEach(n => {
    if (n.read || !n.appId) return;
    appBadgeCounts[n.appId] = (appBadgeCounts[n.appId] || 0) + 1;
  });
  if (chatUnread > 0) appBadgeCounts.chat = (appBadgeCounts.chat || 0) + chatUnread;
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
    // v8.1: opening an app clears its notification badge. Special-cased
    // for "chat" inside markAppNotificationsRead (bumps lastChatOpenTs
    // so the DM unread badge clears as well).
    markAppNotificationsRead(appId);
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
  },[deviceMode,markAppNotificationsRead]);
  function startDrag(e,winId){
    if(e.button!==0)return;
    e.preventDefault();
    const w=winsRef.current.find(w=>w.id===winId);
    if(!w)return;
    // v8.3 F1: "tear off from maximized" — dragging a maximized window's
    // title bar restores it to normal size and starts moving it (Windows
    // behavior). The restored window is repositioned so the grab point
    // stays at the same horizontal fraction across the (now narrower)
    // title bar, which feels natural.
    if(w.state==="maximized"){
      const restoreW=(w.prevBounds&&w.prevBounds.width)||(DEFAULT_SIZES[w.app]&&DEFAULT_SIZES[w.app].w)||520;
      const restoreH=(w.prevBounds&&w.prevBounds.height)||(DEFAULT_SIZES[w.app]&&DEFAULT_SIZES[w.app].h)||480;
      const frac=window.innerWidth>0?e.clientX/window.innerWidth:0.5;
      const newX=Math.max(0,Math.min(e.clientX-frac*restoreW,window.innerWidth-restoreW));
      const newY=0; // grab lands on the title bar at the top of the screen
      setWins(ws=>ws.map(x=>x.id===winId?{...x,state:"normal",x:newX,y:newY,width:restoreW,height:restoreH,prevBounds:null}:x));
      setDrag({type:"move",winId,ox:e.clientX-newX,oy:e.clientY-newY});
      focusWin(winId);
      return;
    }
    setDrag({type:"move",winId,ox:e.clientX-w.x,oy:e.clientY-w.y});
    focusWin(winId);
  }
  function startResize(e,winId,edge){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"resize",winId,edge,sx:e.clientX,sy:e.clientY,wx:w.x,wy:w.y,ww:w.width,wh:w.height});focusWin(winId);}}
  function closeWin(id){playSound("windowClose");setWins(ws=>ws.filter(w=>w.id!==id));}
  function minimizeWin(id){setWins(ws=>ws.map(w=>w.id===id?{...w,state:w.state==="minimized"?"normal":"minimized"}:w));}
  function maximizeWin(id){setWins(ws=>ws.map(w=>{if(w.id!==id)return w;if(w.state==="maximized")return{...w,state:"normal",...(w.prevBounds||{}),prevBounds:null};return{...w,state:"maximized",prevBounds:{x:w.x,y:w.y,width:w.width,height:w.height}};}));}

  // v6.4: Global keyboard shortcuts.
  //   Cmd/Ctrl + K    → toggle start menu (search auto-focused)
  //   Cmd/Ctrl + ,    → open Settings
  //   Esc             → close start menu (apps handle Esc themselves)
  //   Alt + W         → close the active window
  //   Alt + M         → minimize the active window
  //
  // Why Alt instead of Cmd for window controls: browsers reserve Cmd+W
  // (close tab) and Cmd+M (minimize browser) at the OS level — web pages
  // can't preventDefault them. Alt-based combos are the cleanest dodge.
  //
  // We avoid firing shortcuts while typing into <input>/<textarea> so
  // Cmd+K inside a search box doesn't surprise-open the start menu.
  // (Esc is allowed everywhere — it's expected to "cancel" universally.)
  //
  // Handler ref pattern: keeps the listener stable across renders while
  // still reading the latest handler functions. Re-binding the listener
  // on every render would work too, just slightly noisier.
  const kbHandlersRef = useRef(null);
  kbHandlersRef.current = { openApp, closeWin, minimizeWin, setMenuOpen, screen };
  useEffect(()=>{
    function onKey(e){
      const h = kbHandlersRef.current;
      if(!h || h.screen !== "desktop") return;  // shortcuts only matter once signed in
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Esc — close menus. Apps handle their own modal closes.
      if(e.key === "Escape"){
        h.setMenuOpen(false);
        return;
      }
      // Cmd/Ctrl + K — start menu
      if(mod && (e.key === "k" || e.key === "K") && !isTyping){
        e.preventDefault();
        h.setMenuOpen(o => !o);
        return;
      }
      // Cmd/Ctrl + , — Settings
      if(mod && e.key === "," && !isTyping){
        e.preventDefault();
        h.openApp("settings");
        return;
      }
      // Alt + W — close active window. Excludes minimized so Alt+W when
      // everything is hidden in the taskbar doesn't surprise-close the wrong thing.
      if(e.altKey && (e.key === "w" || e.key === "W") && !isTyping){
        e.preventDefault();
        const top = [...(winsRef.current || [])].filter(w => w.state !== "minimized").sort((a,b) => (b.z||0) - (a.z||0))[0];
        if(top) h.closeWin(top.id);
        return;
      }
      // Alt + M — minimize active window
      if(e.altKey && (e.key === "m" || e.key === "M") && !isTyping){
        e.preventDefault();
        const top = [...(winsRef.current || [])].filter(w => w.state !== "minimized").sort((a,b) => (b.z||0) - (a.z||0))[0];
        if(top) h.minimizeWin(top.id);
        return;
      }
      // v7.8: F11 — toggle fullscreen (universal "fullscreen" key across OSes
      // and browsers). preventDefault keeps the browser from doing its own
      // F11 behavior on web — we want the Fullscreen API path instead so
      // PWA installs get consistent behavior with browser tabs.
      if(e.key === "F11" && !isTyping){
        e.preventDefault();
        toggleFullscreen();
        return;
      }
    }
    document.addEventListener("keydown", onKey);
    return ()=>document.removeEventListener("keydown", onKey);
  },[]);
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
    const initData={notes:[],tasks:[],wallpaper:"mesh",bio:"",joined:Date.now(),settings:{},installedApps:[],folders:[],hiddenFromDesktop:[],pinnedToTaskbar:[],migratedTo41:true,migratedTo52:true};

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
      // v6.4: restore previously-open windows if the user opted in. We filter
      // out windows whose app no longer exists (e.g. removed in an OS update)
      // so we don't render empty/broken windows. maxZ is bumped above the
      // highest restored z so newly-opened apps stack on top.
      if(d?.settings?.restoreOnSignin){
        const savedWindows = await db.get("user:"+u+":savedWindows");
        if(Array.isArray(savedWindows) && savedWindows.length > 0){
          const validIds = new Set(APPS.map(a => a.id));
          const valid = savedWindows.filter(w => validIds.has(w.app));
          setWins(valid);
          const topZ = valid.reduce((max,w) => Math.max(max, w.z||100), 100);
          setMaxZ(topZ + 1);
        }
      }
      setScreen("desktop");playSound("login");
      // Let the user know if this was a silent 6.3 migration. Toast fires
      // after the desktop renders so it's noticeable but unobtrusive.
      // showToast (not raw setToast) → uses the standard string format the
      // toast renderer expects AND auto-clears after 2.5s.
      if(migrated) setTimeout(()=>showToast("Account secured ✓ — upgraded to Firebase Auth"), 600);
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
  // allApps = every app launcher entry that should appear in the start menu —
  // always the full list, regardless of what's pinned to the desktop.
  const allApps=[...APPS,...storeIcons];
  // v7.7 — Desktop pinning (blacklist model). Users can hide apps from the
  // desktop via right-click; they're still launchable from the start menu and
  // taskbar. Default is empty array → every app shows on the desktop, so
  // existing users see no change to their workspace.
  const hiddenFromDesktop=data?.hiddenFromDesktop||[];
  const hiddenSet=new Set(hiddenFromDesktop);
  const allDesktopIcons=allApps.filter(a=>!hiddenSet.has(a.id));
  function hideAppFromDesktop(appId){
    if(hiddenSet.has(appId))return;
    const next=[...hiddenFromDesktop,appId];
    updateData(p=>({...p,hiddenFromDesktop:next}));
    showToast("Removed from desktop");
  }
  function addAppToDesktop(appId){
    if(!hiddenSet.has(appId))return;
    const next=hiddenFromDesktop.filter(id=>id!==appId);
    updateData(p=>({...p,hiddenFromDesktop:next}));
    showToast("Added to desktop");
  }
  // v8.0 — Taskbar pinning. Users can pin apps to the taskbar so they
  // appear as compact icon-only chips even when no window is open. When
  // a pinned app IS running, its chip expands to show icon + label +
  // accent indicator like a normal running-window chip. Storage shape
  // mirrors hiddenFromDesktop: `data.pinnedToTaskbar` is an ordered array
  // of app ids, default empty. Storage lives on the user data doc, so
  // pins sync across devices.
  const pinnedToTaskbar=data?.pinnedToTaskbar||[];
  const pinnedSet=new Set(pinnedToTaskbar);
  function pinAppToTaskbar(appId){
    if(pinnedSet.has(appId))return;
    const next=[...pinnedToTaskbar,appId];
    updateData(p=>({...p,pinnedToTaskbar:next}));
    showToast("Pinned to taskbar");
  }
  function unpinAppFromTaskbar(appId){
    if(!pinnedSet.has(appId))return;
    const next=pinnedToTaskbar.filter(id=>id!==appId);
    updateData(p=>({...p,pinnedToTaskbar:next}));
    showToast("Unpinned from taskbar");
  }
  const filteredMenu=allApps.filter(a=>a.label.toLowerCase().includes(menuSrch.toLowerCase())||a.desc?.toLowerCase().includes(menuSrch.toLowerCase()));
  const isAnyDrag=drag||iconDrag||widgetDrag||widgetResize;
  const dragCursor=drag?(drag.type==="move"?"grabbing":drag.edge+"-resize"):widgetResize?(widgetResize.edge+"-resize"):isAnyDrag?"grabbing":"default";
 
  // ── BOOT ─────────────────────────────────────────────────────────────────
  // v7.0: refreshed with ambient backdrop glow, breathing-logo animation,
  // and a subtle accent rule under the version line. Same boot sequence,
  // more cinematic feel.
  if(screen==="boot")return(
    <div style={{width:"100%",height:"100vh",background:"#07080f",display:"flex",flexDirection:"column",justifyContent:"center",padding:"10vh max(24px, 12%)",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      {/* Ambient backdrop — soft purple/blue glow behind everything */}
      <div style={{position:"absolute",top:"30%",left:"50%",transform:"translateX(-50%)",width:680,height:680,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.18) 0%,rgba(99,102,241,0.08) 30%,transparent 65%)",filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:"60%",left:"35%",width:520,height:520,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.10) 0%,transparent 60%)",filter:"blur(50px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:"clamp(40px, 12vw, 72px)",letterSpacing:6,color:"#fff",marginBottom:6,lineHeight:1,animation:"nova-breathe 3.6s ease-in-out infinite"}}>NOVA</div>
        <div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.32)",letterSpacing:6,marginBottom:8,fontWeight:500}}>OPERATING SYSTEM  ·  v{NOVA_VERSION}</div>
        {/* Hairline accent — fades in from the version line */}
        <div style={{height:1,width:160,background:"linear-gradient(90deg,rgba(99,102,241,0.6),transparent)",marginBottom:46}}/>
        {bootLines.map((l,i) => (
          <div key={i} style={{fontFamily:FFM,fontSize:12,color:l.includes("ready")?"#a8c5ff":"rgba(255,255,255,0.5)",marginBottom:5,animation:"boot-in 0.28s cubic-bezier(0.16,1,0.3,1)",letterSpacing:0.3}}>
            {l.includes("OK") ? <>{l.replace("... OK","")}... <span style={{color:"#4cef90"}}>OK</span></> : l}
          </div>
        ))}
      </div>
      {MobileNotice}
    </div>
  );
 
  // ── LOGIN ────────────────────────────────────────────────────────────────
  // v7.0: refreshed card with multi-layer shadow, shimmering accent rule,
  // floating ambient orbs behind the mesh backdrop. More confident typography
  // and inner highlight border to lift the card off the background.
  if(screen==="login")return(
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <MeshBg/>
      {/* Floating ambient orbs behind the card — subtle motion that catches the eye */}
      <div style={{position:"absolute",top:"15%",left:"12%",width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle,rgba(167,139,250,0.32) 0%,transparent 70%)",filter:"blur(40px)",animation:"float 8s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"18%",right:"14%",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.28) 0%,transparent 70%)",filter:"blur(50px)",animation:"float 10s ease-in-out infinite reverse",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{
          background:"linear-gradient(180deg, rgba(12,14,28,0.92), rgba(8,10,22,0.92))",
          backdropFilter:"blur(28px)",
          border:"1px solid rgba(255,255,255,0.12)",
          borderRadius:20,
          padding:"48px 42px",
          width:400,
          maxWidth:"calc(100vw - 24px)",
          // Layered shadow: deep ambient + close-in directional + inner highlight
          boxShadow:"0 50px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.08) inset",
          position:"relative",
          overflow:"hidden",
          animation:"win-in 0.5s cubic-bezier(0.16,1,0.3,1)",
        }}>
          {/* Shimmering accent rule at the top of the card */}
          <div style={{
            position:"absolute",top:0,left:0,right:0,height:2,
            background:"linear-gradient(90deg, transparent, rgba(167,139,250,0.8), rgba(99,102,241,1), rgba(6,182,212,0.8), transparent)",
            backgroundSize:"200% 100%",
            animation:"shimmer 4s ease-in-out infinite",
          }}/>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:42,color:"#fff",textAlign:"center",letterSpacing:6,marginBottom:6,lineHeight:1}}>NOVA</div>
          <div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.28)",textAlign:"center",letterSpacing:5,marginBottom:34,fontWeight:500}}>OPERATING SYSTEM  ·  v{NOVA_VERSION}</div>
          <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.09)",marginBottom:24}}>
            {["login","register"].map(m => (
              <button key={m} className="lt" onClick={()=>{setMode(m);setAuthErr("");}} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:mode===m?"2px solid "+DEFAULT_AC:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,letterSpacing:1,color:mode===m?DEFAULT_AC:"rgba(255,255,255,0.32)",transition:"color 0.18s, border-bottom 0.18s"}}>
                {m==="login" ? "SIGN IN" : "REGISTER"}
              </button>
            ))}
          </div>
          <input style={{...INP,marginBottom:11,padding:"11px 14px",borderRadius:9}} placeholder="Username" value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} autoFocus/>
          <input style={{...INP,padding:"11px 14px",borderRadius:9}} type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
          <button className="ls" disabled={busy} onClick={handleAuth} style={{
            width:"100%",
            padding:"13px",
            // Gradient button — feels more modern than flat fill
            background:"linear-gradient(135deg, "+DEFAULT_AC+", #6366f1)",
            border:"1px solid "+bdr(DEFAULT_AC),
            borderRadius:10,
            cursor:"pointer",
            fontFamily:FFB,
            fontWeight:600,
            fontSize:14,
            letterSpacing:1.2,
            color:"#fff",
            marginTop:18,
            transition:"opacity 0.18s, transform 0.18s",
            boxShadow:"0 8px 24px rgba(99,102,241,0.28)",
          }}>{busy?"AUTHENTICATING…":mode==="login"?"SIGN IN →":"CREATE ACCOUNT →"}</button>
          {authErr && <div style={{color:"#ff8b8b",fontFamily:FF,fontSize:13,textAlign:"center",marginTop:14,padding:"8px 12px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.2)",borderRadius:8}}>⚠ {authErr}</div>}
          <div style={{marginTop:22,fontFamily:FF,fontStyle:"italic",fontSize:11,color:"rgba(255,255,255,0.2)",textAlign:"center"}}>Demo auth — your account syncs across devices.</div>
        </div>
      </div>
      {MobileNotice}
    </div>
  );
 
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
      {/* v7.0 toast refresh: glass surface, leading accent bar, status icon
          inferred from message text. Floats top-center (more visible than
          the old top-right corner). Animates in from above with a soft scale. */}
      {toast && (()=>{
        // Infer a kind from message keywords — keeps the showToast API a plain
        // string so existing 100+ call sites don't need to change.
        const tStr = String(toast);
        const kind =
          tStr.includes("✓") || tStr.includes("saved") || tStr.includes("secured") ? "success" :
          tStr.includes("⚠") || tStr.includes("⚠️") || tStr.includes("failed") || tStr.includes("Couldn't") ? "warn" :
          "info";
        const accent = kind==="success" ? "#4cef90" : kind==="warn" ? "#ffaa44" : AC;
        const icon = kind==="success" ? "✓" : kind==="warn" ? "⚠" : "•";
        // Strip the leading ✓/⚠ from the text if present, since we have an icon now
        const cleanText = tStr.replace(/^[✓⚠]\s*/, "").replace(/\s*[✓⚠]$/, "");
        return (
          <div style={{
            position:"fixed",
            top:18,
            left:"50%",
            transform:"translateX(-50%)",
            zIndex:99999,
            display:"flex",
            alignItems:"center",
            gap:11,
            padding:"11px 18px 11px 14px",
            background:"linear-gradient(180deg, rgba(14,16,30,0.96), rgba(10,12,24,0.96))",
            backdropFilter:"blur(20px)",
            border:"1px solid rgba(255,255,255,0.1)",
            borderLeft:"3px solid "+accent,
            borderRadius:11,
            fontFamily:FF,
            fontWeight:500,
            fontSize:13,
            color:"rgba(255,255,255,0.94)",
            animation:"toast-in 0.32s cubic-bezier(0.16,1,0.3,1)",
            boxShadow:"0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
            maxWidth:"calc(100vw - 36px)",
          }}>
            <span style={{
              display:"flex",alignItems:"center",justifyContent:"center",
              width:20,height:20,borderRadius:"50%",
              background:"rgba("+hexRgb(accent)+",0.18)",
              color:accent,
              fontFamily:FFB,fontWeight:700,fontSize:12,
              flexShrink:0,
            }}>{icon}</span>
            <span>{cleanText}</span>
          </div>
        );
      })()}
 
      {/* Desktop widgets */}
      {Object.keys(WIDGET_CONFIGS).map(id=>{
        if(!widgets[id])return null;
        const s=widgetState[id]||DEFAULT_WIDGET_STATE[id]||{x:200,y:200,w:240,h:140};
        return(
          <WidgetShell key={id} id={id} state={s} onDragStart={onWidgetDragStart} onResizeStart={onWidgetResizeStart} onClose={()=>closeWidget(id)} touchy={touchy}>
            {id==="clock"   &&<ClockWidgetContent   state={s} tick={tick} use24h={use24h} AC={AC}/>}
            {id==="weather" &&<WeatherWidgetContent  state={s} data={data} updateSettings={updateSettings}/>}
            {id==="notesw"  &&<NotesWidgetContent    state={s} data={data}/>}
            {id==="tasksw"  &&<TasksWidgetContent    state={s} data={data} updateData={updateData}/>}
            {id==="calendar"&&<CalendarWidgetContent state={s} tick={tick} AC={AC}/>}
            {id==="sysinfo" &&<SysInfoWidgetContent  state={s}/>}
            {id==="battery" &&<BatteryWidgetContent  state={s} AC={AC}/>}
          </WidgetShell>
        );
      })}
 
      {/* Desktop icons */}
      {allDesktopIcons.map((app,idx)=>{
        const pos=iconPos[app.id]||defaultIconPos(idx);
        const isDrg=iconDrag?.id===app.id;
        function launch(){if(app.storeApp){if(app.storeApp.newTab)openExternalUrl(app.storeApp.url);else openApp("browser");}else openApp(app.id);}
        return(
          <div key={app.id} style={{
            position:"absolute",left:pos.x,top:pos.y,width:ICON_W,
            zIndex:isDrg?500:2,
            cursor:isDrg?"grabbing":"grab",userSelect:"none",
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,
            padding:"10px 4px 8px",
            borderRadius:11,
            // v8.0: lighter resting background, accent-tinged shadow during
            // drag for a more lifted feel. The .di hover class adds a brighter
            // background + soft outline ring (see styles.js).
            background:isDrg?"rgba(20,22,40,0.5)":"rgba(0,0,0,0.08)",
            border:"1px solid "+(isDrg?"rgba(255,255,255,0.16)":"transparent"),
            backdropFilter:isDrg?"blur(8px)":"none",
            transition:isDrg?"none":"background 0.22s cubic-bezier(0.4,0,0.2,1), border-color 0.22s cubic-bezier(0.4,0,0.2,1), left 0.28s cubic-bezier(0.4,0,0.2,1), top 0.28s cubic-bezier(0.4,0,0.2,1)",
            boxShadow:isDrg?"0 10px 30px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset":"none",
          }}
            className={isDrg?"":"di"} title={app.desc}
            onPointerDown={e=>onIconMouseDown(e,app.id,allDesktopIcons)}
            onDoubleClick={launch}
            onContextMenu={e=>openContextMenu(e, [
              {icon:"▶", label:"Open", onClick:launch},
              // v8.0: pin/unpin to taskbar. Pinned apps appear as compact
              // icon-only chips on the taskbar even when not running.
              ...(app.storeApp ? [] : [pinnedSet.has(app.id)
                ? {icon:"📌", label:"Unpin from taskbar", onClick:()=>unpinAppFromTaskbar(app.id)}
                : {icon:"📌", label:"Pin to taskbar", onClick:()=>pinAppToTaskbar(app.id)}
              ]),
              // v7.7: "Remove from desktop" hides the app from the desktop
              // without uninstalling it. It still shows in the start menu /
              // taskbar; users can add it back via right-click there.
              {icon:"–", label:"Remove from desktop", danger:true, onClick:()=>hideAppFromDesktop(app.id)},
              // For store-installed apps, also offer full uninstall as a
              // separate action — this removes them from `installedApps`
              // entirely (so they vanish from the start menu too).
              ...(app.storeApp ? [{
                icon:"🗑", label:"Uninstall app", danger:true,
                onClick:()=>{
                  const cur=data?.installedApps||[];
                  updateData(p=>({...p,installedApps:cur.filter(id=>id!==app.storeApp.id)}));
                  showToast("Uninstalled");
                },
              }] : []),
              {type:"divider"},
              {icon:"📋", label:"Copy app name", onClick:()=>{try{navigator.clipboard?.writeText(app.label);showToast("Copied");}catch{}}},
            ])}>
            <div style={{position:"relative",pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",filter:"drop-shadow(0 3px 8px rgba(0,0,0,0.55))"}}>
              <AppIconDisplay app={app} size={32}/>
              {/* v8.1: notification badge — small numeric circle in the
                  upper-right of the icon when the app has unread items. */}
              {appBadgeCounts[app.id]>0 && (
                <div style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,padding:"0 4px",borderRadius:8,background:"#ff4d4f",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 8px rgba(255,77,79,0.55), 0 1px 2px rgba(0,0,0,0.6)",border:"1.5px solid rgba(10,12,24,0.85)"}}>
                  {appBadgeCounts[app.id]>9?"9+":appBadgeCounts[app.id]}
                </div>
              )}
            </div>
            <span style={{fontFamily:FFB,fontWeight:600,fontSize:10.5,color:"#fff",textAlign:"center",lineHeight:1.25,textShadow:"0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)",pointerEvents:"none",letterSpacing:0.15}}>{app.label}</span>
          </div>
        );
      })}
 
      {/* Start menu — v8.0 refresh.
          Wider (420 vs 360), more breathing room around the search bar, app
          grid spaced more generously, footer user-card gains a subtle accent
          highlight. Backdrop now blurs heavier with a slight saturation boost,
          and corners are uniformly rounded on the top instead of squared at
          the left edge — the menu looks like a floating panel, not glued to
          the screen edge. */}
      {menuOpen&&(<div ref={menuRef} style={{
        position:"fixed",bottom:TASKBAR_H+8,left:8,width:420,maxHeight:"70vh",
        background:"linear-gradient(180deg, rgba(15,17,32,0.94) 0%, rgba(10,12,24,0.96) 100%)",
        backdropFilter:"blur(40px) saturate(180%)",
        WebkitBackdropFilter:"blur(40px) saturate(180%)",
        border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:16,
        boxShadow:"0 8px 16px rgba(0,0,0,0.35), 0 30px 80px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.08) inset",
        zIndex:9998,display:"flex",flexDirection:"column",
        animation:"menu-up 0.26s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        {/* Search bar — gains an accent-tinged border on focus via CSS focus-visible */}
        <div style={{padding:"18px 18px 12px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:11,padding:"11px 16px",transition:"border-color 0.2s, background 0.2s"}}>
            <span style={{fontSize:14,opacity:0.55}}>🔍</span>
            <input value={menuSrch} onChange={e=>setMenuSrch(e.target.value)} placeholder="Search apps…" autoFocus style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,0.95)",fontFamily:FF,fontSize:14}}/>
            {menuSrch&&<button onClick={()=>setMenuSrch("")} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:11,width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
          </div>
        </div>
        <div style={{padding:"0 16px 18px",flex:1,overflowY:"auto",minHeight:0}}>
          <div style={SEC}>{menuSrch?`Results for "${menuSrch}"`:"All Apps"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {filteredMenu.map(app=>{
              const isHidden=hiddenSet.has(app.id);
              const isRunning=wins.some(w=>w.app===app.id);
              return(
              <div key={app.id} className="ma"
                onClick={()=>{setMenuOpen(false);if(app.storeApp){if(app.storeApp.newTab)openExternalUrl(app.storeApp.url);else openApp("browser");}else openApp(app.id);}}
                onContextMenu={e=>{setMenuOpen(false);openContextMenu(e,[
                  {icon:"▶",label:"Open",onClick:()=>{if(app.storeApp){if(app.storeApp.newTab)openExternalUrl(app.storeApp.url);else openApp("browser");}else openApp(app.id);}},
                  // v8.0: pin/unpin to taskbar (storeApps can't be pinned —
                  // they don't have a stable launch target on the taskbar).
                  ...(app.storeApp ? [] : [pinnedSet.has(app.id)
                    ? {icon:"📌", label:"Unpin from taskbar", onClick:()=>unpinAppFromTaskbar(app.id)}
                    : {icon:"📌", label:"Pin to taskbar", onClick:()=>pinAppToTaskbar(app.id)}
                  ]),
                  isHidden
                    ? {icon:"+",label:"Add to desktop",onClick:()=>addAppToDesktop(app.id)}
                    : {icon:"–",label:"Remove from desktop",danger:true,onClick:()=>hideAppFromDesktop(app.id)},
                ]);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,padding:"14px 6px 12px",borderRadius:11,cursor:"pointer",position:"relative"}}>
                {isRunning&&<div style={{position:"absolute",bottom:5,left:"50%",transform:"translateX(-50%)",width:5,height:5,borderRadius:"50%",background:AC,boxShadow:"0 0 6px "+AC}}/>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",opacity:isHidden?0.5:1}}><AppIconDisplay app={app} size={28}/></div>
                <span style={{fontFamily:FF,fontWeight:600,fontSize:10.5,color:isHidden?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.85)",textAlign:"center",lineHeight:1.3,letterSpacing:0.1}}>{app.label}</span>
              </div>
              );
            })}
            {filteredMenu.length===0&&<div style={{gridColumn:"span 4",color:"rgba(255,255,255,0.25)",fontFamily:FF,fontStyle:"italic",fontSize:12,textAlign:"center",padding:"24px 0"}}>No apps found</div>}
          </div>
        </div>
        {/* User card — accent-tinged background for a subtle highlight,
            larger avatar pulled to match the rest of the cluster. */}
        <div style={{padding:"14px 18px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:12,background:"linear-gradient(180deg, transparent, rgba(255,255,255,0.02))",flexShrink:0}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,"+fill(AC)+","+fill(AC)+")",border:"1.5px solid "+AC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,fontFamily:FFB,fontWeight:700,color:AC,boxShadow:"0 0 12px "+fill(AC)}}>{user.charAt(0).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:FFB,fontWeight:600,fontSize:13.5,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{user}</div>
            <div style={{fontFamily:FFM,fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1,letterSpacing:0.3}}>Nova OS v{NOVA_VERSION}</div>
          </div>
          {/* v8.3 F2: explicit fullscreen toggle in the start menu so users
              who don't know F11 can always get in/out of fullscreen. Since
              the taskbar auto-hides in fullscreen, the start menu (reachable
              via Cmd/Ctrl+K or the bottom-edge peek) is the discoverable
              exit point. */}
          <button onClick={()=>{setMenuOpen(false);toggleFullscreen();}} title={isFs?"Exit fullscreen (F11)":"Enter fullscreen (F11)"} style={{width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",fontSize:13,color:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>{isFs?"🗗":"⛶"}</button>
          <button onClick={logout} title="Sign out" style={{padding:"7px 13px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.28)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,140,140,0.95)",transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)"}}>Logout</button>
        </div>
      </div>)}
 
      {/* Windows */}
      {wins.map(win=>{
        const app=APPS.find(a=>a.id===win.app);
        const isMax=win.state==="maximized",isMin=win.state==="minimized",isDrg=drag&&drag.winId===win.id;
        // v7.5: keep minimized windows mounted (display:none) so background
        // playback / long-lived state survives. Previously we returned null,
        // which unmounted the entire app subtree — Music in particular would
        // stop playback the instant you minimized it.
        //
        // v8.0 chrome refresh:
        //   • Border radius 12 → 14 (softer, more modern feel)
        //   • Multi-layer shadow: ambient + key + inner highlight (was single
        //     box-shadow). Picks up properly during drag (deeper key shadow
        //     while moving) for a more physical sense of lift.
        //   • Title bar gains a soft gradient so it visually separates from
        //     the app surface without needing a hard border line.
        //   • Window controls grouped into a subtle pill at the right end of
        //     the title bar — same hit targets, more cohesive look.
        const winRadius = 14;
        const winShadow = isDrg
          ? "0 14px 28px rgba(0,0,0,0.45), 0 40px 100px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.1) inset"
          : "0 4px 8px rgba(0,0,0,0.25), 0 18px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset";
        const winStyle=isMax?{position:"fixed",top:0,left:0,right:0,bottom:TASKBAR_H+"px",zIndex:win.z,borderRadius:0}:{position:"absolute",left:win.x,top:win.y,width:win.width,height:win.height,zIndex:win.z,borderRadius:winRadius};
        const minimizedStyle=isMin?{display:"none"}:{};
        return(
          <div key={win.id} onClick={()=>focusWin(win.id)} style={{...winStyle,...minimizedStyle,background:"rgba(10,12,24,0.92)",border:"1px solid rgba(255,255,255,0.09)",boxShadow:winShadow,display:isMin?"none":"flex",flexDirection:"column",animation:"win-in 0.28s cubic-bezier(0.16,1,0.3,1)",backdropFilter:"blur("+winBlur+"px) saturate(160%)",WebkitBackdropFilter:"blur("+winBlur+"px) saturate(160%)",transition:isDrg?"box-shadow 0.18s cubic-bezier(0.4,0,0.2,1)":"box-shadow 0.22s cubic-bezier(0.4,0,0.2,1), left 0.28s cubic-bezier(0.4,0,0.2,1), top 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1), height 0.28s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden"}}>
            {!isMax&&<ResizeHandles winId={win.id} onStartResize={startResize} touchy={touchy}/>}
            {/* v8.3 F1: title bar is now draggable even when maximized —
                dragging restores the window and tears it off (Windows-style),
                so the cursor is always grab/grabbing rather than default. */}
            <div onPointerDown={e=>startDrag(e,win.id)} style={{height:40,display:"flex",alignItems:"center",padding:"0 6px 0 14px",gap:10,background:"linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",borderBottom:"1px solid rgba(255,255,255,0.06)",borderRadius:isMax?"0":winRadius+"px "+winRadius+"px 0 0",cursor:isDrg?"grabbing":"grab",userSelect:"none",flexShrink:0,touchAction:"none"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={18}/></div>
              <span style={{flex:1,fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",letterSpacing:0.2}}>{app?.label}</span>
              {/* v8.0 round 3 — proper SVG window controls. Unicode glyphs
                  rendered inconsistently across platforms and weren't pixel-
                  aligned within their hit boxes. Now stroke-based icons that
                  inherit the button color via currentColor. */}
              <div style={{display:"flex",alignItems:"center",gap:2,padding:2,borderRadius:9}}>
                <button className="wn" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimizeWin(win.id);}} title="Minimize" style={{width:28,height:28,borderRadius:7,background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.62)",flexShrink:0,padding:0}}>
                  <WindowControlIcon type="minimize" size={11}/>
                </button>
                <button className="wm" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();maximizeWin(win.id);}} title={isMax?"Restore":"Maximize"} style={{width:28,height:28,borderRadius:7,background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.62)",flexShrink:0,padding:0}}>
                  <WindowControlIcon type={isMax?"restore":"maximize"} size={11}/>
                </button>
                <button className="wx" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();closeWin(win.id);}} title="Close" style={{width:28,height:28,borderRadius:7,background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.62)",flexShrink:0,padding:0}}>
                  <WindowControlIcon type="close" size={11}/>
                </button>
              </div>
            </div>
            {/* v8.3 B3: "Large Text" applies a CSS zoom to the app content
                area. The setting previously only bumped the root container's
                fontSize, which did nothing because every app sets explicit px
                sizes that don't inherit. `zoom` scales the rendered content
                (text + layout) and reflows correctly — unlike transform:scale
                which would overflow. Applied to the content area (not the
                window frame) so the title bar / controls stay a fixed size. */}
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:20,minWidth:0,zoom:largeFnt?1.18:1}}>
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
                {win.app==="clock"      &&<ClockApp AC={AC} data={data} updateSettings={updateSettings}/>}
                {win.app==="calendar"   &&<CalendarApp data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
                {win.app==="music"      &&<MusicApp AC={AC} showToast={showToast}/>}
                {win.app==="pdf"        &&<PdfApp AC={AC} showToast={showToast}/>}
                {win.app==="atmos"      &&<AtmosApp AC={AC} showToast={showToast} pushNotification={pushNotification} openNovaAi={()=>openApp("novaai")} data={data} updateSettings={updateSettings}/>}
                {win.app==="minesweeper"&&<MinesweeperApp AC={AC}/>}
                {win.app==="wordle"     &&<WordleApp AC={AC} showToast={showToast}/>}
                {win.app==="tetris"     &&<TetrisApp AC={AC}/>}
                {win.app==="novaai"     &&<NovaAiApp AC={AC} showToast={showToast}/>}
                {/* v7.4 games */}
                {win.app==="tictactoe"  &&<TicTacToeApp AC={AC}/>}
                {win.app==="pong"       &&<PongApp AC={AC}/>}
                {win.app==="flappy"     &&<FlappyBirdApp AC={AC} data={data} updateSettings={updateSettings}/>}
                {win.app==="invaders"   &&<SpaceInvadersApp AC={AC} data={data} updateSettings={updateSettings}/>}
                {win.app==="pacman"     &&<PacManApp AC={AC} data={data} updateSettings={updateSettings}/>}
                {win.app==="chess"      &&<ChessApp user={user} AC={AC}/>}
                {/* v8.0 round-3 */}
                {win.app==="photos"     &&<PhotosApp AC={AC} showToast={showToast} onSetWallpaper={handleCustomWallpaper}/>}
              </Suspense>
            </div>
          </div>
        );
      })}
 
      {/* Taskbar — v7.7 visual overhaul.
          Frosted-glass background with a subtle top-edge highlight, slightly
          taller for breathing room, and an inset shadow that gives the bar a
          floating feel without actually detaching it from the screen edge.
          Saturate(160%) makes the wallpaper's colors bleed through the glass
          a little, like macOS Big Sur's dock.
          v8.0: background tint is now user-controllable via
          settings.taskbarColor. Falls back to the v8.0 default gradient. */}
      {(()=>{
        const tbColor=settings.taskbarColor;
        const tbBg=tbColor
          ?"linear-gradient(180deg, rgba("+hexRgb(tbColor)+",0.78) 0%, rgba("+hexRgb(tbColor)+",0.86) 100%)"
          :"linear-gradient(180deg, rgba(14,16,30,0.78) 0%, rgba(10,12,24,0.86) 100%)";
        // v8.3 F2: in fullscreen, the taskbar auto-hides (slides off the
        // bottom edge) for an immersive view. Moving the pointer to the
        // bottom edge sets tbPeek=true and slides it back up. When not in
        // fullscreen it's always visible.
        const tbHidden = isFs && !tbPeek;
        return(
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,height:TASKBAR_H,
        background:tbBg,
        backdropFilter:"blur(28px) saturate(160%)",
        WebkitBackdropFilter:"blur(28px) saturate(160%)",
        borderTop:"1px solid rgba(255,255,255,0.09)",
        boxShadow:"0 -1px 0 rgba(255,255,255,0.04) inset, 0 -20px 50px -20px rgba(0,0,0,0.5)",
        display:"flex",alignItems:"center",padding:"0 14px",gap:6,zIndex:9999,
        transform: tbHidden ? "translateY(110%)" : "translateY(0)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* v7.7: Start menu button — now shows the Nova OS brand mark (gradient
            N) instead of the generic "◈" glyph. The button background lights
            up with the accent color when the menu is open so the affordance
            is still obvious despite the busier icon. */}
        <button className="sb" onClick={()=>{setMenuOpen(o=>!o);setMenuSrch("");}} title="Nova OS" style={{
          width:42,height:42,borderRadius:12,
          background:menuOpen?fill(AC):"rgba(255,255,255,0.06)",
          border:"1px solid "+(menuOpen?bdr(AC):"rgba(255,255,255,0.09)"),
          boxShadow:menuOpen?"0 0 16px "+fill(AC)+", 0 2px 8px rgba(0,0,0,0.3) inset":"none",
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
          transition:"all 0.2s cubic-bezier(0.4,0,0.2,1)",
          padding:0,
        }}>
          <NovaLogo size={26}/>
        </button>
        <div style={{width:1,height:26,background:"linear-gradient(180deg, transparent, rgba(255,255,255,0.12) 50%, transparent)",margin:"0 5px"}}/>
        {/* v8.0 — Taskbar: pinned apps + running windows.
            Pinned apps with NO running windows render as compact icon-only
            "launcher" chips (40x40, no label). Pinned apps WITH running
            windows expand to full chips (icon + label + glowing accent
            underline). Running apps that aren't pinned render as before
            (one full chip per window). */}
        {(()=>{
          const slots=[];
          const seenApp=new Set();
          // Pinned slots first, in pin order. Each pinned slot represents
          // ALL running windows of that app aggregated into one chip.
          pinnedToTaskbar.forEach(appId=>{
            if(seenApp.has(appId))return;
            seenApp.add(appId);
            const running=wins.filter(w=>w.app===appId);
            slots.push({key:"pin-"+appId,appId,running,pinned:true});
          });
          // Then any running windows that aren't in the pinned list, one
          // chip per window so multiple windows of an app show separately.
          wins.forEach(win=>{
            if(pinnedSet.has(win.app))return;
            slots.push({key:"win-"+win.id,appId:win.app,running:[win],pinned:false});
          });
          // Determine global top-z so we can highlight the focused chip.
          const topZ=wins.length>0?Math.max(...wins.map(w=>w.z)):-Infinity;
          return slots.map(slot=>{
            const app=APPS.find(a=>a.id===slot.appId);
            if(!app)return null;
            const hasRunning=slot.running.length>0;
            const topWin=hasRunning?[...slot.running].sort((a,b)=>(b.z||0)-(a.z||0))[0]:null;
            const allMin=hasRunning&&slot.running.every(w=>w.state==="minimized");
            const isTop=hasRunning&&topWin.z===topZ&&!allMin;
            const isHidden=hiddenSet.has(slot.appId);

            // Click: launch if not running, focus/minimize topmost if running.
            const handleClick=()=>{
              if(!hasRunning){openApp(slot.appId);return;}
              if(allMin){
                setWins(ws=>ws.map(w=>w.id===topWin.id?{...w,state:"normal"}:w));
                focusWin(topWin.id);
              }else if(isTop){
                setWins(ws=>ws.map(w=>w.id===topWin.id?{...w,state:"minimized"}:w));
              }else{
                focusWin(topWin.id);
              }
            };

            const buildMenu=()=>{
              const items=[];
              if(hasRunning){
                items.push({icon:"▶",label:allMin?"Restore":"Focus",onClick:()=>{setWins(ws=>ws.map(w=>w.id===topWin.id?{...w,state:"normal"}:w));focusWin(topWin.id);}});
                items.push({icon:"—",label:"Minimize",onClick:()=>setWins(ws=>ws.map(w=>w.id===topWin.id?{...w,state:"minimized"}:w)),disabled:allMin});
                items.push({icon:"⬜",label:topWin.state==="maximized"?"Restore size":"Maximize",onClick:()=>maximizeWin(topWin.id)});
              }else{
                items.push({icon:"▶",label:"Open",onClick:()=>openApp(slot.appId)});
              }
              items.push(slot.pinned
                ?{icon:"📌",label:"Unpin from taskbar",onClick:()=>unpinAppFromTaskbar(slot.appId)}
                :{icon:"📌",label:"Pin to taskbar",onClick:()=>pinAppToTaskbar(slot.appId)});
              if(isHidden)items.push({icon:"+",label:"Add to desktop",onClick:()=>addAppToDesktop(slot.appId)});
              if(hasRunning){
                items.push({type:"divider"});
                items.push({icon:"✕",label:"Close",danger:true,onClick:()=>closeWin(topWin.id)});
              }
              return items;
            };

            // v8.0 — Drag-to-reorder. Only pinned chips are draggable (the
            // non-pinned running chips don't have a stable position to
            // reorder into). When mid-drag, this chip translates with the
            // pointer and goes semi-transparent.
            const isDragging=tbDrag?.appId===slot.appId;
            const dragStyle=isDragging
              ?{transform:`translateX(${tbDrag.dx}px)`,opacity:0.78,zIndex:50,transition:"none"}
              :{};
            const wrappedClick=()=>{
              // Suppress click that fires immediately after a drag's pointerup
              if(justDraggedRef.current)return;
              handleClick();
            };
            const dragProps=slot.pinned?{
              ref:el=>{if(el)pinChipRefs.current[slot.appId]=el;else delete pinChipRefs.current[slot.appId];},
              onPointerDown:e=>{
                if(e.button!==0)return;
                tbDragRef.current={appId:slot.appId,startX:e.clientX,moved:false};
              },
            }:{};

            // Compact pinned-only chip — icon only, fixed 40x40 square.
            if(slot.pinned&&!hasRunning){
              const badgeCount = appBadgeCounts[slot.appId] || 0;
              return(
                <button {...dragProps} key={slot.key} className="tb"
                  onClick={wrappedClick}
                  onContextMenu={e=>openContextMenu(e,buildMenu())}
                  title={app.label + (badgeCount > 0 ? " — " + badgeCount + " unread" : "")}
                  style={{
                    width:40,height:40,padding:0,
                    background:"rgba(255,255,255,0.05)",
                    border:"1px solid rgba(255,255,255,0.07)",
                    borderRadius:10,cursor:isDragging?"grabbing":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
                    flexShrink:0,position:"relative",
                    ...dragStyle,
                  }}>
                  <AppIconDisplay app={{id:app.id,icon:app.icon}} size={20}/>
                  {badgeCount > 0 && (
                    <div style={{position:"absolute",top:-2,right:-2,minWidth:14,height:14,padding:"0 3px",borderRadius:7,background:"#ff4d4f",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 6px rgba(255,77,79,0.6)"}}>
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </div>
                  )}
                </button>
              );
            }

            // Full chip — running (whether pinned or not). Icon + label
            // (on non-mobile) + glowing accent underline when focused.
            return(
              <button {...dragProps} key={slot.key} className="tb"
                onClick={wrappedClick}
                onContextMenu={e=>openContextMenu(e,buildMenu())}
                style={{
                  height:40,padding:"0 12px",
                  background:isTop?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.05)",
                  border:"1px solid "+(isTop?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.07)"),
                  borderRadius:10,cursor:isDragging?"grabbing":"pointer",
                  fontFamily:FF,fontSize:12,fontWeight:600,
                  color:allMin?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.88)",
                  whiteSpace:"nowrap",
                  transition:"all 0.22s cubic-bezier(0.4,0,0.2,1)",
                  display:"flex",alignItems:"center",gap:7,position:"relative",
                  flexShrink:0,
                  ...dragStyle,
                }}>
                <div style={{position:"relative",pointerEvents:"none",display:"flex",alignItems:"center"}}>
                  <AppIconDisplay app={{id:app.id,icon:app.icon}} size={16}/>
                  {appBadgeCounts[slot.appId]>0 && (
                    <div style={{position:"absolute",top:-5,right:-7,minWidth:13,height:13,padding:"0 3px",borderRadius:6.5,background:"#ff4d4f",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:8.5,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 5px rgba(255,77,79,0.6)"}}>
                      {appBadgeCounts[slot.appId]>9?"9+":appBadgeCounts[slot.appId]}
                    </div>
                  )}
                </div>
                {deviceMode!=="mobile"&&<span>{app.label}</span>}
                {hasRunning&&!allMin&&<div style={{position:"absolute",bottom:-1,left:"50%",transform:"translateX(-50%)",width:isTop?22:8,height:3,borderRadius:3,background:AC,boxShadow:isTop?"0 0 10px "+AC+", 0 0 4px "+AC:"none",transition:"width 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1)"}}/>}
              </button>
            );
          });
        })()}
        <div style={{flex:1}}/>
        {/* v7.7: right-side cluster — every pill is locked to height:40 so
            they sit on the same baseline. Internal layout uses flex centering
            so multi-line content (the clock's time+date stack) stays vertically
            balanced without resizing the chip. */}
        {deviceMode!=="mobile"&&
          <button className="sb" onClick={()=>openApp("profile")} title="Profile" style={{
            height:40,display:"flex",alignItems:"center",gap:8,
            padding:"0 14px 0 8px",borderRadius:10,
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",
            cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC,
            transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
          }}>
            <span style={{width:22,height:22,borderRadius:"50%",background:fill(AC),border:"1px solid "+bdr(AC),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:AC,fontWeight:700}}>{user.charAt(0).toUpperCase()}</span>
            @{user}
          </button>
        }
        <div style={{
          height:40,display:"flex",alignItems:"center",gap:2,padding:"0 3px",
          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,
        }}>
          {/* Notification bell — badge shows unread count, click toggles the panel */}
          <button className="sb" onClick={()=>setNotifsOpen(o=>!o)} title={unreadCount>0?unreadCount+" unread":"Notifications"} style={{
            position:"relative",width:32,height:32,borderRadius:8,
            background:notifsOpen?fill(AC):"transparent",
            border:notifsOpen?"1px solid "+bdr(AC):"1px solid transparent",
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,color:notifsOpen?AC:"rgba(255,255,255,0.6)",
            transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
          }}>
            🔔
            {unreadCount>0 && <span style={{position:"absolute",top:2,right:2,minWidth:14,height:14,padding:"0 3px",borderRadius:7,background:"#ff5555",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 8px rgba(255,85,85,0.5)"}}>{unreadCount>9?"9+":unreadCount}</span>}
          </button>
          <button className="sb" onClick={()=>openApp("settings")} title="Settings" style={{
            width:32,height:32,borderRadius:8,
            background:"transparent",border:"1px solid transparent",
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,color:"rgba(255,255,255,0.55)",
            transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
          }}>⚙️</button>
        </div>
        <div style={{
          height:40,display:"flex",flexDirection:"column",justifyContent:"center",
          textAlign:"right",cursor:"default",
          padding:"0 14px",borderRadius:10,
          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
          minWidth:64,
        }}>
          <div style={{fontFamily:FFM,fontWeight:500,fontSize:13,color:"rgba(255,255,255,0.88)",letterSpacing:0.3,lineHeight:1.1}}>{fmtTime(tick)}</div>
          {deviceMode!=="mobile"&&<div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:1,lineHeight:1.1}}>{fmtDate(tick)}</div>}
        </div>
      </div>
        );
      })()}
      {/* Notification Center side panel — v8.0 refresh.
          Floating panel (slight margin from screen edges, full rounded
          corners) rather than glued to the right edge. Header gains an
          accent-colored bell glyph. Items get a per-kind left accent stripe
          and an unread indicator dot. */}
      {notifsOpen && (
        <>
          <div onClick={()=>setNotifsOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:9997}}/>
          <div style={{
            position:"fixed",top:10,right:10,bottom:TASKBAR_H+10,width:"min(360px, calc(100vw - 20px))",
            background:"linear-gradient(180deg, rgba(15,17,32,0.94) 0%, rgba(10,12,24,0.96) 100%)",
            backdropFilter:"blur(40px) saturate(180%)",
            WebkitBackdropFilter:"blur(40px) saturate(180%)",
            border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:16,
            boxShadow:"0 8px 16px rgba(0,0,0,0.35), 0 30px 80px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.08) inset",
            zIndex:9998,display:"flex",flexDirection:"column",
            animation:"menu-up 0.26s cubic-bezier(0.16,1,0.3,1)",
            overflow:"hidden",
          }}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10,flexShrink:0,background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)"}}>
              <span style={{fontSize:16,filter:"drop-shadow(0 0 8px "+AC+"55)"}}>🔔</span>
              <div style={{flex:1,fontFamily:FFB,fontWeight:700,fontSize:14,color:"#fff",letterSpacing:0.2}}>Notifications</div>
              {notifications.length>0 && <button onClick={clearAllNotifications} style={{padding:"5px 11px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,130,130,0.9)",letterSpacing:0.3,transition:"all 0.15s"}}>Clear all</button>}
              <button onClick={()=>setNotifsOpen(false)} title="Close" style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",cursor:"pointer",color:"rgba(255,255,255,0.5)",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all 0.15s"}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"10px"}}>
              {notifications.length===0 ? (
                <div style={{textAlign:"center",padding:"60px 24px",color:"rgba(255,255,255,0.35)",fontFamily:FF}}>
                  <div style={{fontSize:40,opacity:0.5,marginBottom:14,filter:"drop-shadow(0 0 16px "+AC+"33)"}}>🔕</div>
                  <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.55)",marginBottom:5}}>All caught up</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",lineHeight:1.55,maxWidth:240,margin:"0 auto"}}>NWS alerts and other important events will appear here when they happen.</div>
                </div>
              ) : notifications.map(n=>{
                const kindColor = n.kind==="alert"?"#ff8b8b":n.kind==="warning"?"#ffcc66":n.kind==="success"?"#4cef90":AC;
                const kindIcon  = n.kind==="alert"?"⚠":n.kind==="warning"?"⚠":n.kind==="success"?"✓":"●";
                const age = Date.now()-n.ts;
                const ageStr = age<60000?"just now":age<3600000?Math.floor(age/60000)+"m ago":age<86400000?Math.floor(age/3600000)+"h ago":new Date(n.ts).toLocaleDateString();
                return(
                  <div key={n.id} style={{
                    padding:"12px 14px 12px 14px",
                    marginBottom:6,
                    background:n.read?"rgba(255,255,255,0.025)":"linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
                    border:"1px solid "+(n.read?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.11)"),
                    borderLeft:"3px solid "+(n.read?"rgba(255,255,255,0.1)":kindColor),
                    borderRadius:10,
                    position:"relative",
                    transition:"background 0.18s",
                  }}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <span style={{color:kindColor,fontSize:14,lineHeight:1.4,flexShrink:0,filter:n.read?"none":"drop-shadow(0 0 6px "+kindColor+"55)"}}>{kindIcon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:FFB,fontWeight:600,fontSize:12.5,color:n.read?"rgba(255,255,255,0.78)":"#fff",lineHeight:1.4,letterSpacing:0.1}}>{n.title}</div>
                        {n.body && <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:4,lineHeight:1.55,wordBreak:"break-word"}}>{n.body}</div>}
                        <div style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.32)",marginTop:6,letterSpacing:0.2}}>{ageStr}</div>
                      </div>
                      <button onClick={()=>dismissNotification(n.id)} title="Dismiss" style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.32)",fontSize:11,padding:"3px 6px",lineHeight:1,flexShrink:0,borderRadius:5,transition:"background 0.15s, color 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,80,80,0.12)";e.currentTarget.style.color="rgba(255,130,130,0.9)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.32)";}}>✕</button>
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
 
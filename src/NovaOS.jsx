
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
import { defaultIconPos, snapToFreeGrid, snapW, snapWSize, layoutIcons } from "./lib/geometry.js";
import { autoModerate, isAdmin, isPubliclyVisible } from "./lib/moderation.js";
import { rewriteForIframe, isLikelyUnframable } from "./lib/browser.js";
import { detectDevice, effectiveDeviceMode, isTouchMode } from "./lib/device.js";
import { applyOp, formatDisplay, toggleSign, appendKey } from "./lib/calc.js";
import { createBoard as mineCreateBoard, floodReveal, isWin as mineIsWin, mineTotal, MINE_DIFFICULTIES } from "./lib/minesweeper.js";
import { dailyWord, scoreGuess, normalizeGuess } from "./lib/wordle.js";
import { emptyGrid as tetrisEmpty, randomPiece as tetrisRandom, shapeOf, fits as tetrisFits, lockPiece as tetrisLock, clearLines as tetrisClearLines, scoreForLines, tickInterval, PIECE_COLORS, BOARD_W as TETRIS_W, BOARD_H as TETRIS_H } from "./lib/tetris.js";
import { wmoIcon, wmoLabel, geocodeUrl, parseGeocode, forecastUrl, parseForecast, alertsUrl, parseAlerts, isLikelyUS } from "./lib/weather.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream, deriveTitle as aiDeriveTitle } from "./lib/ai.js";
import { playTone, speak, cancelSpeech, playSound, getSoundConfig, setSoundConfig, setSoundWallpaper, subscribeSoundConfig } from "./lib/audio.js";
import { db, setDbUid, getDbUid } from "./lib/db.js";
import { setCustomLogo } from "./lib/logo.js";
import { fetchAccessList as fetchPosAccess } from "./lib/pos.js";
import { ACH_MAP, setGameWinHandler } from "./lib/achievements.js";
import { watchMyThreads, otherParticipantName } from "./lib/dms.js";
import { watchMyServers } from "./lib/servers.js";
import { openExternalUrl } from "./lib/openUrl.js";
import { isNative as nativeIsNative, notify as nativeNotify } from "./lib/native.js";
import { login as authLogin, register as authRegister, logoutUser as authLogout, normalizeUsername } from "./lib/auth.js";
import { aiLoad, aiSave, AI_LS_KEYS, AI_LS_CONFIG, AI_LS_CHATS } from "./lib/ai-storage.js";
// UI (shared components + visual constants)
import { DEFAULT_AC, FF, FFB, FFM, INP, SEC, CSS } from "./ui/styles.js";
import {
  COLL, WIDGET_CONFIGS, DEFAULT_WIDGET_STATE, DEFAULT_SIZES, APPS,
  STORE_CATALOG, STORE_CATS, BOOT_MSGS, ACCENT_PRESETS, BOOKMARKS, PAINT_COLORS,
  WALLPAPERS, WMO, HAS_SVG_ICON, NOVA_VERSION, DEFAULT_DESKTOP_APPS,
} from "./ui/constants.js";
import { Wallpaper, NovaBg, BlissBg, AuroraBg, MeshBg, SupernovaBg } from "./ui/wallpapers.jsx";
import { isDesktop, powerOff, quitApp } from "./lib/system.js";
import { isLiteMode } from "./lib/lite.js";
import { watchMyGames } from "./lib/chess-game.js";
import { CommandBar } from "./ui/CommandBar.jsx";
import { TaskView } from "./ui/TaskView.jsx";
import { MobileShell } from "./ui/MobileShell.jsx";
import { SetupWizard } from "./ui/SetupWizard.jsx";
import { WeatherGlyph } from "./ui/WeatherGlyph.jsx";
import { NovaSvgIcon, AppIconDisplay, NovaLogo, WindowControlIcon, UserAvatar } from "./ui/icons.jsx";
import { subscribeDrag, moveDrag, endDrag, getDrag } from "./lib/dragStore.js";
import { Toggle } from "./ui/Toggle.jsx";
import { BrowserNav } from "./ui/BrowserNav.jsx";
import { ResizeHandles } from "./ui/ResizeHandles.jsx";
import { ContextMenu } from "./ui/ContextMenu.jsx";
import { AiAssist } from "./ui/AiAssist.jsx";
import { StickyNotes } from "./ui/StickyNotes.jsx";
import { WorkspacesPanel } from "./ui/Workspaces.jsx";
// Widgets
import {
  WidgetShell,
  ClockWidgetContent, WeatherWidgetContent, NotesWidgetContent,
  TasksWidgetContent, CalendarWidgetContent, SysInfoWidgetContent,
  BatteryWidgetContent,
  PomodoroWidgetContent,
} from "./widgets/widgets.jsx";
// Apps — lazy-loaded via React.lazy so each app ships in its own chunk.
// Vite splits these into separate JS files; the first time you open Notes,
// notes-<hash>.js downloads; opening Tetris later pulls tetris-<hash>.js.
// Suspense (wired around the window content below) shows the fallback while
// each chunk is in flight.
//
// lazyApp wraps the import so a failed chunk fetch recovers gracefully: it
// retries once (transient network blips), and if it still fails — typically a
// stale page after a new deploy whose old chunk filenames are gone — it reloads
// the page ONCE (guarded against loops) to pull the fresh asset map. On a
// genuinely unreachable origin (e.g. an auth-gated Vercel preview) it reloads
// once, then surfaces the error instead of looping.
const CHUNK_RELOAD_KEY = "nova:chunk-reloaded";
// Web/PWA only: a failed chunk is usually a stale page after a new deploy whose
// old chunk filenames are gone — reload ONCE (guarded) to pull the fresh asset
// map. NEVER reload on the Tauri build: assets are bundled (a reload can't fix a
// load failure), and reloading the `tauri://` page DROPS the IPC bridge + wipes
// the boot log — so on desktop we just surface the error instead.
const IN_TAURI = typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
function lazyApp(loader) {
  return lazy(() =>
    loader().catch(() => loader()).then(
      (m) => { try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch {} return m; },
      (err) => {
        try {
          if (!IN_TAURI && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
            location.reload();
          }
        } catch {}
        throw err;
      }
    )
  );
}
const NotesApp       = lazyApp(() => import("./apps/NotesApp.jsx").then(m       => ({default: m.NotesApp})));
const TasksApp       = lazyApp(() => import("./apps/TasksApp.jsx").then(m       => ({default: m.TasksApp})));
const FilesApp       = lazyApp(() => import("./apps/FilesApp.jsx").then(m       => ({default: m.FilesApp})));
const PaintApp       = lazyApp(() => import("./apps/PaintApp.jsx").then(m       => ({default: m.PaintApp})));
const BrowserApp     = lazyApp(() => import("./apps/BrowserApp.jsx").then(m     => ({default: m.BrowserApp})));
const SnakeApp       = lazyApp(() => import("./apps/SnakeApp.jsx").then(m       => ({default: m.SnakeApp})));
const Game2048App    = lazyApp(() => import("./apps/Game2048App.jsx").then(m    => ({default: m.Game2048App})));
const StoreApp       = lazyApp(() => import("./apps/StoreApp.jsx").then(m       => ({default: m.StoreApp})));
const TerminalApp    = lazyApp(() => import("./apps/TerminalApp.jsx").then(m    => ({default: m.TerminalApp})));
const SettingsApp    = lazyApp(() => import("./apps/SettingsApp.jsx").then(m    => ({default: m.SettingsApp})));
const ProfileApp     = lazyApp(() => import("./apps/ProfileApp.jsx").then(m     => ({default: m.ProfileApp})));
const ChatApp        = lazyApp(() => import("./apps/ChatApp.jsx").then(m        => ({default: m.ChatApp})));
const CalculatorApp  = lazyApp(() => import("./apps/CalculatorApp.jsx").then(m  => ({default: m.CalculatorApp})));
const ClockApp       = lazyApp(() => import("./apps/ClockApp.jsx").then(m       => ({default: m.ClockApp})));
const CalendarApp    = lazyApp(() => import("./apps/CalendarApp.jsx").then(m    => ({default: m.CalendarApp})));
const MusicApp       = lazyApp(() => import("./apps/MusicApp.jsx").then(m       => ({default: m.MusicApp})));
const PdfApp         = lazyApp(() => import("./apps/PdfApp.jsx").then(m         => ({default: m.PdfApp})));
const AtmosApp       = lazyApp(() => import("./apps/AtmosApp.jsx").then(m       => ({default: m.AtmosApp})));
const MinesweeperApp = lazyApp(() => import("./apps/MinesweeperApp.jsx").then(m => ({default: m.MinesweeperApp})));
const WordleApp      = lazyApp(() => import("./apps/WordleApp.jsx").then(m      => ({default: m.WordleApp})));
const TetrisApp      = lazyApp(() => import("./apps/TetrisApp.jsx").then(m      => ({default: m.TetrisApp})));
const NovaAiApp      = lazyApp(() => import("./apps/NovaAiApp.jsx").then(m      => ({default: m.NovaAiApp})));
// v7.4 game additions
const TicTacToeApp    = lazyApp(() => import("./apps/TicTacToeApp.jsx").then(m    => ({default: m.TicTacToeApp})));
const PongApp         = lazyApp(() => import("./apps/PongApp.jsx").then(m         => ({default: m.PongApp})));
const FlappyBirdApp   = lazyApp(() => import("./apps/FlappyBirdApp.jsx").then(m   => ({default: m.FlappyBirdApp})));
const SpaceInvadersApp= lazyApp(() => import("./apps/SpaceInvadersApp.jsx").then(m=> ({default: m.SpaceInvadersApp})));
const PacManApp       = lazyApp(() => import("./apps/PacManApp.jsx").then(m       => ({default: m.PacManApp})));
const ChessApp        = lazyApp(() => import("./apps/ChessApp.jsx").then(m        => ({default: m.ChessApp})));
// v8.0 round-3
const PhotosApp       = lazyApp(() => import("./apps/PhotosApp.jsx").then(m       => ({default: m.PhotosApp})));
const ScreenshotApp   = lazyApp(() => import("./apps/ScreenshotApp.jsx").then(m   => ({default: m.ScreenshotApp})));
const SlidesApp       = lazyApp(() => import("./apps/SlidesApp.jsx").then(m       => ({default: m.SlidesApp})));
const AssetStudioApp  = lazyApp(() => import("./apps/AssetStudioApp.jsx").then(m  => ({default: m.AssetStudioApp})));
const VideoEditorApp  = lazyApp(() => import("./apps/VideoEditorApp.jsx").then(m  => ({default: m.VideoEditorApp})));
const WhiteboardApp   = lazyApp(() => import("./apps/WhiteboardApp.jsx").then(m   => ({default: m.WhiteboardApp})));
const CodeApp         = lazyApp(() => import("./apps/CodeApp.jsx").then(m         => ({default: m.CodeApp})));
const ForumApp        = lazyApp(() => import("./apps/ForumApp.jsx").then(m        => ({default: m.ForumApp})));
const PosApp          = lazyApp(() => import("./apps/PosApp.jsx").then(m          => ({default: m.PosApp})));
const SheetsApp       = lazyApp(() => import("./apps/SheetsApp.jsx").then(m       => ({default: m.SheetsApp})));
const AchievementsApp = lazyApp(() => import("./apps/AchievementsApp.jsx").then(m => ({default: m.AchievementsApp})));
const AtlasApp        = lazyApp(() => import("./apps/AtlasApp.jsx").then(m        => ({default: m.AtlasApp})));
// v10.9 — utilities pack
const CurrencyApp     = lazyApp(() => import("./apps/CurrencyApp.jsx").then(m     => ({default: m.CurrencyApp})));
const DictionaryApp   = lazyApp(() => import("./apps/DictionaryApp.jsx").then(m   => ({default: m.DictionaryApp})));
const TranslatorApp   = lazyApp(() => import("./apps/TranslatorApp.jsx").then(m   => ({default: m.TranslatorApp})));
const CryptoApp       = lazyApp(() => import("./apps/CryptoApp.jsx").then(m       => ({default: m.CryptoApp})));
const QrApp           = lazyApp(() => import("./apps/QrApp.jsx").then(m           => ({default: m.QrApp})));
// v10.10 — games
const SudokuApp       = lazyApp(() => import("./apps/SudokuApp.jsx").then(m       => ({default: m.SudokuApp})));
const TypingApp       = lazyApp(() => import("./apps/TypingApp.jsx").then(m       => ({default: m.TypingApp})));
// v10.10 — media
const CameraApp       = lazyApp(() => import("./apps/CameraApp.jsx").then(m       => ({default: m.CameraApp})));
const VoiceRecorderApp= lazyApp(() => import("./apps/VoiceRecorderApp.jsx").then(m=> ({default: m.VoiceRecorderApp})));
const SolitaireApp    = lazyApp(() => import("./apps/SolitaireApp.jsx").then(m    => ({default: m.SolitaireApp})));

// ─── v9.0 taskbar glyphs ────────────────────────────────────────────────
// Monochrome line-glyphs for the system tray, replacing the old emoji
// 🔔 / ⚙️. Stroke uses currentColor so they inherit the button's color
// (which lights up to the accent when the panel is open), matching the
// clear-glass icon language introduced in v9.0.
function BellGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
// v11.0 — SVG glyphs replacing hardcoded 🔍/✨ emojis (emojis render per-platform
// and read as "web", not OS). Both inherit `currentColor`.
function SearchGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <circle cx="10.5" cy="10.5" r="6.5"/>
      <path d="M21 21l-5.1-5.1"/>
    </svg>
  );
}
function SparkGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{display:"block"}}>
      <path d="M12 2.5c.45 4.2 2.3 6.05 6.5 6.5-4.2.45-6.05 2.3-6.5 6.5-.45-4.2-2.3-6.05-6.5-6.5 4.2-.45 6.05-2.3 6.5-6.5z"/>
      <path d="M18.5 14c.22 1.9 1.1 2.78 3 3-1.9.22-2.78 1.1-3 3-.22-1.9-1.1-2.78-3-3 1.9-.22 2.78-1.1 3-3z"/>
    </svg>
  );
}
function GearGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

// ─── v9.0 taskbar weather pill ──────────────────────────────────────────
// Windows 11-style weather chip for the dock's bottom-left corner. Reuses
// the same data the Weather widget / Atmos use: the pinned location
// (data.settings.weatherLocation) and unit preference (weatherUnits).
//
// To avoid a surprise geolocation prompt on every boot (the dock is always
// visible), it only falls back to browser geolocation when that permission
// has ALREADY been granted; otherwise it shows a gentle "Weather" prompt
// that opens Atmos so the user can pin a location.
function TaskbarWeather({ data, onClick }) {
  const [wx, setWx] = useState(null);                  // { temp, code }
  const [status, setStatus] = useState("loading");     // loading | ok | noloc | error
  const savedLoc = data?.settings?.weatherLocation || null;
  const units = data?.settings?.weatherUnits || "imperial";
  const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
  const tempSymbol = units === "imperial" ? "°F" : "°C";

  useEffect(() => {
    let dead = false;
    const fetchAt = (lat, lon) =>
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&temperature_unit=${tempUnit}&timezone=auto`)
        .then(r => r.json())
        .then(j => {
          if (dead) return;
          if (j?.current) { setWx({ temp: Math.round(j.current.temperature_2m), code: j.current.weathercode }); setStatus("ok"); }
          else setStatus("error");
        })
        .catch(() => { if (!dead) setStatus("error"); });

    setStatus("loading");
    if (savedLoc) { fetchAt(savedLoc.lat, savedLoc.lon); return () => { dead = true; }; }

    // No pinned location — only geolocate if permission is already granted.
    (async () => {
      try {
        if (!navigator.geolocation) { if (!dead) setStatus("noloc"); return; }
        let granted = false;
        if (navigator.permissions?.query) {
          try { const p = await navigator.permissions.query({ name: "geolocation" }); granted = p.state === "granted"; } catch {}
        }
        if (!granted) { if (!dead) setStatus("noloc"); return; }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => { if (!dead) fetchAt(coords.latitude, coords.longitude); },
          () => { if (!dead) setStatus("noloc"); },
          { timeout: 8000 }
        );
      } catch { if (!dead) setStatus("noloc"); }
    })();
    return () => { dead = true; };
  }, [savedLoc?.lat, savedLoc?.lon, tempUnit]);

  const pill = {
    height: 42, display: "flex", alignItems: "center", gap: 7, padding: "0 13px",
    borderRadius: 12, background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
    fontFamily: FF, flexShrink: 0, transition: "all 0.18s var(--nv-ease)",
  };

  if (status === "ok" && wx) {
    const city = savedLoc?.label ? savedLoc.label.split(",")[0].trim() : "";
    return (
      <button className="sb" onClick={onClick} title={(city ? city + " · " : "") + wx.temp + tempSymbol + " — open Atmos"} style={pill}>
        <span style={{ display: "flex", lineHeight: 1 }}><WeatherGlyph code={wx.code} size={20} /></span>
        <span style={{ fontFamily: FFM, fontWeight: 500, fontSize: 14, color: "var(--nv-text-strong)", lineHeight: 1 }}>{wx.temp}°</span>
      </button>
    );
  }
  return (
    <button className="sb" onClick={onClick} title="Set your location in Atmos" style={{ ...pill, opacity: status === "loading" ? 0.55 : 0.8 }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>⛅</span>
      <span style={{ fontFamily: FF, fontSize: 12, color: "var(--nv-text-dim)", lineHeight: 1 }}>{status === "loading" ? "…" : "Weather"}</span>
    </button>
  );
}

// ─── v9.4 — Spotlight (global search palette) ───────────────────────────
// Floating Ctrl+K palette that searches across apps, notes, tasks,
// folders, store apps, and Settings panes. Module-level so it isn't
// re-instantiated on every NovaOS render. All state is local — opening
// always starts at an empty query, which is the right default.

// Settings panes to surface in the palette. id matches SettingsApp's
// internal section ids (see SettingsApp.jsx). Subtitle is the short
// description shown under each result.
const SPOTLIGHT_SETTINGS = [
  { id: "appearance", label: "Appearance",           subtitle: "Liquid Glass, accent, wallpaper" },
  { id: "display",    label: "Display",              subtitle: "Fullscreen, clock, large text, screensaver" },
  { id: "sound",      label: "Sound",                subtitle: "System sound volume, preview" },
  { id: "network",    label: "Network",              subtitle: "Connection status" },
  { id: "widgets",    label: "Widgets",              subtitle: "Desktop widgets" },
  { id: "keyboard",   label: "Keyboard shortcuts",   subtitle: "Global hotkeys reference" },
  { id: "account",    label: "Account",              subtitle: "Sign out" },
  { id: "about",      label: "About Nova OS",        subtitle: "Version, edition" },
];

function scoreMatch(label, sub, q) {
  if (!q) return 0;
  const L = (label || "").toLowerCase();
  const S = (sub || "").toLowerCase();
  const Q = q.toLowerCase();
  if (L === Q) return 1000;
  if (L.startsWith(Q)) return 500;
  if (L.includes(Q)) return 200;
  if (S.includes(Q)) return 50;
  return 0;
}

function Spotlight({ AC, data, apps, storeCatalog, commApps, isPubliclyVisible, openApp, openExternalUrl, openSettingsSection, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Build the full searchable item list. Each item:
  //   { key, label, subtitle, icon, type, action }
  const items = (() => {
    const out = [];
    // Built-in apps.
    for (const a of (apps || [])) {
      out.push({
        key: "app-" + a.id, label: a.label, subtitle: a.desc || "", icon: a.icon || "▣",
        type: "App", action: () => openApp(a.id),
      });
    }
    // Catalog apps (whether installed or not — open ones launch, others can still navigate to Store).
    for (const a of (storeCatalog || [])) {
      out.push({
        key: "cat-" + a.id, label: a.name, subtitle: "Store · " + (a.cat || "Apps") + (a.desc ? " · " + a.desc : ""),
        icon: a.icon || "🚀", type: "Store",
        action: () => {
          if (a.newTab) openExternalUrl(a.url);
          else openApp("browser");
        },
      });
    }
    // Community apps (publicly visible).
    for (const a of (commApps || [])) {
      if (!isPubliclyVisible || !isPubliclyVisible(a)) continue;
      out.push({
        key: "comm-" + a.id, label: a.name, subtitle: "Community · " + (a.cat || "Apps") + (a.desc ? " · " + a.desc : ""),
        icon: a.icon || "🚀", type: "Store",
        action: () => {
          if (a.newTab) openExternalUrl(a.url);
          else openApp("browser");
        },
      });
    }
    // Notes.
    for (const n of (data?.notes || [])) {
      out.push({
        key: "note-" + n.id, label: n.title || "Untitled note",
        subtitle: (n.body || "").replace(/\s+/g, " ").trim().slice(0, 80),
        icon: "📝", type: "Note", action: () => openApp("notes"),
      });
    }
    // Tasks.
    for (const t of (data?.tasks || [])) {
      out.push({
        key: "task-" + t.id, label: t.text || "Task",
        subtitle: t.done ? "Done" : "Open",
        icon: "✅", type: "Task", action: () => openApp("tasks"),
      });
    }
    // Folders.
    for (const f of (data?.folders || [])) {
      out.push({
        key: "folder-" + f.id, label: f.name || "Folder",
        subtitle: "Folder",
        icon: "📁", type: "Folder", action: () => openApp("files"),
      });
    }
    // Settings panes.
    for (const s of SPOTLIGHT_SETTINGS) {
      out.push({
        key: "settings-" + s.id, label: s.label + " — Settings", subtitle: s.subtitle,
        icon: "⚙", type: "Setting",
        action: () => openSettingsSection(s.id),
      });
    }
    return out;
  })();

  // Filter + score + sort. Empty query → show a small set of recent items.
  const trimmed = q.trim();
  let results;
  if (!trimmed) {
    // Empty state: a handful of built-in apps + recent notes as suggestions.
    const recent = [];
    const appSlice = (apps || []).slice(0, 6).map(a => ({
      key: "app-" + a.id, label: a.label, subtitle: a.desc || "", icon: a.icon || "▣",
      type: "App", action: () => openApp(a.id),
    }));
    const noteSlice = [...(data?.notes || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 3).map(n => ({
      key: "note-" + n.id, label: n.title || "Untitled note",
      subtitle: new Date(n.ts || 0).toLocaleDateString(),
      icon: "📝", type: "Note", action: () => openApp("notes"),
    }));
    results = [...appSlice, ...noteSlice];
  } else {
    results = items
      .map(it => ({ it, score: scoreMatch(it.label, it.subtitle, trimmed) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.label.localeCompare(b.it.label))
      .slice(0, 12)
      .map(x => x.it);
  }
  // Clamp idx whenever results change — useEffect avoids the
  // "setState during render" warning that an inline `if` would cause.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (idx >= results.length) setIdx(0); }, [q]);

  function exec(item) { item.action(); onClose(); }
  function onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[idx]) exec(results[idx]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100050, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
      <div style={{
        position: "fixed", left: "50%", top: "13%", transform: "translateX(-50%)",
        width: "min(560px, calc(100vw - 28px))", zIndex: 100051,
        background: "var(--nv-surface-solid)",
        backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "1px solid var(--nv-border)", borderRadius: 16,
        boxShadow: "var(--nv-popover-shadow)",
        overflow: "hidden", fontFamily: FF,
        animation: "menu-up 0.22s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderBottom: "1px solid var(--nv-border)" }}>
          <span style={{ color: "var(--nv-text-dim)", display: "flex" }}><SearchGlyph size={17}/></span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search Nova OS — apps, notes, tasks, folders, settings…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 15, letterSpacing: 0.2 }}
          />
          <button onClick={onClose} style={{ background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 6, cursor: "pointer", color: "var(--nv-text-dim)", fontFamily: FFM, fontSize: 10.5, padding: "2px 7px" }}>Esc</button>
        </div>
        <div style={{ maxHeight: "min(420px, 60vh)", overflowY: "auto", padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--nv-text-dim)", fontSize: 12.5 }}>
              No matches{trimmed ? ' for "' + trimmed + '"' : ""}.
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={r.key}
              onClick={() => exec(r)}
              onMouseEnter={() => setIdx(i)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                background: i === idx ? fill(AC) : "transparent",
                border: "1px solid " + (i === idx ? bdr(AC) : "transparent"),
                marginBottom: 2, transition: "background 0.1s, border-color 0.1s",
              }}
            >
              <div style={{ width: 30, height: 30, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: i === idx ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                {r.subtitle && (
                  <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle}</div>
                )}
              </div>
              <div style={{ fontFamily: FFM, fontSize: 9.5, color: "var(--nv-text-dim)", letterSpacing: 0.6, textTransform: "uppercase", flexShrink: 0, padding: "2px 7px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 4 }}>{r.type}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 14px", borderTop: "1px solid var(--nv-border)", fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)" }}>
          <span><strong style={{ color: "var(--nv-text)" }}>↑↓</strong> Navigate</span>
          <span><strong style={{ color: "var(--nv-text)" }}>↵</strong> Open</span>
          <span><strong style={{ color: "var(--nv-text)" }}>Esc</strong> Close</span>
          <div style={{ flex: 1 }} />
          <span>{results.length} {results.length === 1 ? "result" : "results"}</span>
        </div>
      </div>
    </>
  );
}

// ─── v9.0 quick-settings glyphs ─────────────────────────────────────────
function WifiGlyph({ size = 16, on = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{display:"block",opacity:on?1:0.5}}>
      <path d="M5 12.55a11 11 0 0 1 14 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <path d="M12 20h.01"/>
    </svg>
  );
}
function VolumeGlyph({ size = 16, muted = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <path d="M11 5 6 9H2v6h4l5 4z"/>
      {muted
        ? <path d="M22 9l-6 6M16 9l6 6"/>
        : <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>}
    </svg>
  );
}

// ─── v9.0 taskbar quick-settings flyout ─────────────────────────────────
// Windows 11-style quick-settings panel that opens from the system tray.
// Holds a network status tile (informational — a browser can't switch Wi-Fi),
// a Nova system-sound volume slider + mute, and a Liquid Glass quick toggle.
// "Network/Sound settings" links deep-link into the Settings app.
function QuickSettingsPanel({ AC, glass, onToggleGlass, onClose, openSettingsSection }) {
  const readNet = () => {
    if (typeof navigator === "undefined") return { online: true, label: "Connected" };
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const online = navigator.onLine !== false;
    const label = !online ? "Offline"
      : c && c.type === "wifi" ? "Wi-Fi"
      : c && c.type === "ethernet" ? "Ethernet"
      : c && c.type === "cellular" ? "Cellular"
      : "Connected";
    const sub = !online ? "No connection" : (c && c.downlink ? "~" + c.downlink + " Mbps" : "Online");
    return { online, label, sub };
  };
  const [net, setNet] = useState(readNet);
  const [snd, setSnd] = useState(() => getSoundConfig());
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
  function applySnd(patch) { const next = { ...snd, ...patch }; setSnd(next); setSoundConfig(next); }
  // v9.4 — same volume-preview chime as the Settings slider. Throttled
  // so a smooth drag triggers a steady series of pings, not overlap.
  const lastVolPreviewRef = useRef(0);
  function previewVolume(newVolume) {
    const now = Date.now();
    if (now - lastVolPreviewRef.current < 150) return;
    if (!(newVolume > 0)) return;
    lastVolPreviewRef.current = now;
    playSound("volumeSample");
  }
  const muted = !snd.enabled || snd.volume <= 0;

  const tile = (active) => ({
    flex: 1, display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderRadius: 12,
    background: active ? fill(AC) : "var(--nv-elevated)",
    border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"),
    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
  });

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9997 }} />
      <div style={{
        position: "fixed", bottom: TASKBAR_H + 10, right: 10, width: "min(312px, calc(100vw - 20px))",
        background: "var(--nv-surface-solid)",
        backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "1px solid var(--nv-border)", borderRadius: 16,
        boxShadow: "0 8px 16px rgba(0,0,0,0.35), 0 30px 80px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.08) inset",
        zIndex: 9998, padding: 14, animation: "menu-up 0.24s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Top tiles: Network + Liquid Glass */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={() => { openSettingsSection("network"); onClose(); }} style={tile(net.online)} title="Network settings">
            <span style={{ color: net.online ? AC : "var(--nv-text)", display: "flex" }}><WifiGlyph size={20} on={net.online} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: net.online ? AC : "var(--nv-text-strong)", lineHeight: 1.2 }}>{net.label}</div>
              <div style={{ fontFamily: FF, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 1 }}>{net.sub}</div>
            </div>
          </button>
          <button onClick={onToggleGlass} style={{ ...tile(glass), flex: "0 0 auto", width: 58, justifyContent: "center" }} title="Liquid Glass">
            <span style={{ color: glass ? AC : "var(--nv-text)", display: "flex" }}><SparkGlyph size={17}/></span>
          </button>
        </div>

        {/* Volume */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12, marginBottom: 10 }}>
          <button onClick={() => applySnd(muted ? { enabled: true, volume: snd.volume > 0 ? snd.volume : 0.6 } : { enabled: false })} title={muted ? "Unmute" : "Mute"} style={{ background: "none", border: "none", cursor: "pointer", color: muted ? "var(--nv-text-dim)" : AC, display: "flex", padding: 0, flexShrink: 0 }}>
            <VolumeGlyph size={20} muted={muted} />
          </button>
          <input type="range" min={0} max={1} step={0.05} value={snd.enabled ? snd.volume : 0}
            onChange={e => { const v = +e.target.value; applySnd({ volume: v, enabled: v > 0 }); previewVolume(v); }}
            style={{ flex: 1, accentColor: AC }} />
          <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)", width: 30, textAlign: "right" }}>{Math.round((snd.enabled ? snd.volume : 0) * 100)}%</span>
        </div>

        {/* Footer */}
        <button onClick={() => { openSettingsSection("sound"); onClose(); }} style={{ width: "100%", padding: "9px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 10, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, color: "var(--nv-text)" }}>All settings</button>
      </div>
    </>
  );
}

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
  // v11.0 Phase C — POS is a restricted app. NovaMod always has access; everyone
  // else only if NovaMod added their username to the `nova_pos/access` allowlist.
  // We fetch the allowlist on sign-in so the launcher can hide the app entirely.
  const [posGrants,  setPosGrants]  = useState([]);
  const posAccessRef = useRef(false);   // kept in sync below; lets openApp gate the restricted POS
  // v11.0 POS remaster — the POS runs as a full-screen kiosk overlay (hides the
  // taskbar/desktop) rather than a normal window. posMode drives that overlay.
  const [posMode,    setPosMode]    = useState(false);
  const posModeRef = useRef(false); posModeRef.current = posMode;
  const [data,       setData]       = useState(null);
  const [customWp,   setCustomWp]   = useState(null);
  const [wins,       setWins]       = useState([]);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);   // v11.0 Phase B — snap-workspaces panel
  // v10.0 — transient per-window animation flags: id → "entering" | "closing"
  // | "minimizing" | "restoring". Drives the open/close/minimize/restore
  // motion; cleared once the animation finishes (see markFx).
  const [winFx,      setWinFx]      = useState({});
  const fxTimers = useRef({});
  // v10.0 — last pointer-down position + per-window launch origin, so a fresh
  // window can zoom out of the exact spot (icon, taskbar chip, menu item) the
  // user clicked to open it.
  const ptrRef = useRef(null);
  const launchPt = useRef({});
  const [maxZ,       setMaxZ]       = useState(100);
  const [tick,       setTick]       = useState(new Date());
  const [toast,      setToast]      = useState(null);
  const [drag,       setDrag]       = useState(null);
  // v8.5 window snap layouts — `snap` is the live snap zone during a move drag
  // (drives the ghost preview); snapRef mirrors it so the pointerup handler can
  // read the final zone without being re-bound on every zone change.
  const [snap,       setSnap]       = useState(null);
  const dragGeomRef                 = useRef(null);   // live window geometry during a drag/resize (avoids per-frame re-renders)
  const snapRef = useRef(null);
  // v8.6 AFK screensaver — `screensaver` shows the blurred-clock overlay after
  // an idle period. ssActiveRef mirrors it so the high-frequency activity
  // listeners can check "are we showing it?" without reading stale state.
  const [screensaver, setScreensaver] = useState(false);
  // v9.4 — Atmos severe-weather lock-screen alert. Stores the active
  // Severe/Extreme NWS alert object (with `locationLabel` added by Atmos).
  // null = no alert overlay. Atmos sets it via the onSevereAlert prop.
  const [severeAlert, setSevereAlert] = useState(null);
  // v9.4 — Spotlight (global search palette). Toggled by the taskbar
  // Search button or by Ctrl/Cmd+K. Searches across apps, notes, tasks,
  // folders, store apps, and Settings panes.
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  // v10.0 Supernova — AI command bar (Ctrl/Cmd+J). Natural-language → actions.
  const [commandOpen, setCommandOpen] = useState(false);
  // v10.0 Supernova — virtual desktops. Each window carries a `desk` index
  // (default 0); only windows on `curDesk` render. Task View (Ctrl+Alt+↑) is
  // the overview for switching/adding/removing desktops + moving windows.
  const MAX_DESKTOPS = 6;
  const [deskCount, setDeskCount] = useState(1);
  const [curDesk, setCurDesk] = useState(0);
  const [taskViewOpen, setTaskViewOpen] = useState(false);
  // v10.0 — one-shot staggered reveal of desktop icons when the desktop first
  // appears (login). Flips true once the reveal finishes so icons stop
  // carrying the entrance animation on later re-renders (drag/select).
  const [iconsRevealed, setIconsRevealed] = useState(false);
  const curDeskRef = useRef(0); curDeskRef.current = curDesk;
  const ssActiveRef = useRef(false);
  const idleTimerRef = useRef(null);
  // v8.6 cross-app drag-and-drop — mirrors the shared dragStore so we can
  // render a floating ghost following the pointer.
  const [dnd, setDnd] = useState(null);
  // v9.0 — community store apps, so the ones a user installs to their desktop
  // actually render there (previously only catalog apps did).
  const [commApps, setCommApps] = useState([]);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [menuSrch,   setMenuSrch]   = useState("");
  const [iconPos,    setIconPos]    = useState({});
  // v9.3 — viewport size, bumped on window resize so layoutIcons re-runs
  // and the desktop icon grid recomputes (fixes #21).
  const [viewport,   setViewport]   = useState(() => ({ w: typeof window !== "undefined" ? window.innerWidth : 1280, h: typeof window !== "undefined" ? window.innerHeight : 800 }));
  const [iconDrag,   setIconDrag]   = useState(null);
  const [openDesktopFolder, setOpenDesktopFolder] = useState(null);   // v11.0 — fid of the open desktop folder popover (or null)
  const [mergeTarget, setMergeTarget] = useState(null);   // v11.0 — entry id highlighted as a folder-merge drop target mid-drag
  // v9.7 B1 — Windows-style drag-select. `marquee` is the live selection
  // rectangle (desktop-local px) while dragging on empty desktop;
  // `selectedIcons` is the set of icon ids currently highlighted.
  const [marquee, setMarquee] = useState(null);
  const [selectedIcons, setSelectedIcons] = useState(() => new Set());
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
  // Fullscreen state — drives the start menu's "Exit Fullscreen" button label.
  // (v8.5: the Nova taskbar now stays visible in fullscreen at all times — the
  // earlier auto-hide was removed at the user's request.)
  const [isFs, setIsFs] = useState(()=>isFullscreen());
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
  // v10.0 — remember where the pointer last went down so a launched window can
  // grow out of that point. Capture phase so it lands before click handlers.
  useEffect(()=>{
    function onPD(e){ ptrRef.current={x:e.clientX,y:e.clientY}; }
    window.addEventListener("pointerdown",onPD,true);
    return ()=>window.removeEventListener("pointerdown",onPD,true);
  },[]);
  // v10.0 — kick off the one-shot desktop-icon reveal whenever we (re)enter the
  // desktop. Settle after the longest stagger so icons drop the animation.
  useEffect(()=>{
    if(screen!=="desktop"){ setIconsRevealed(false); return; }
    setIconsRevealed(false);
    const t=setTimeout(()=>setIconsRevealed(true), 1050);
    return ()=>clearTimeout(t);
  },[screen]);

  const settings=data?.settings||{};
  const AC      =settings.accent    ||DEFAULT_AC;
  const use24h  =settings.clock24h  ||false;
  const winBlur =settings.winBlur   ??18;
  const largeFnt=settings.largeFont ||false;
  const glass    =!!settings.glass;            // v9.0 Liquid Glass surfaces
  // v11.0 — wallpaper is remembered per-theme: Light uses its own slot (default
  // Bloom), Dark uses its own (default Bloom Dark); either is fully changeable and
  // theme-switching never overwrites a pick. Guard: the paired signature ids are
  // theme-specific, so a light "bloom" that ended up in the dark slot (or a
  // "bloomdark" in the light slot) falls back to that theme's default rather than
  // showing the wrong-theme wallpaper.
  const wpId = (() => {
    if (settings.theme === "light") {
      const w = settings.wallpaperLight;
      return (w && w !== "bloomdark") ? w : "bloom";
    }
    const w = settings.wallpaper || data?.wallpaper;
    return (w && w !== "bloom") ? w : "bloomdark";
  })();
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
  //
  // v9.3 (issue #21): also bump a viewport state so the desktop icon layout
  // recomputes on resize. Without this, only detectDevice changes triggered
  // a re-render — resizing within the same mode left icons stuck at their
  // pre-resize positions, with un-saved icons "dancing" because their
  // fallback layout (defaultIconPos) silently re-derived from window size
  // every render but only had a chance to be observed when something else
  // re-rendered the tree.
  useEffect(()=>{
    function onResize(){
      setDetectedMode(detectDevice());
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
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
  // v11.0 — load the user's custom brand logo on sign-in (broadcasts to <NovaLogo>
  // + the favicon via lib/logo.js); clear it when signed out.
  useEffect(()=>{if(user){db.get("user:"+user+":logoimg").then(obj=>{setCustomLogo(obj||null);});}else{setCustomLogo(null);}},[user]);
  // v11.0 Phase C — pull the POS access allowlist on sign-in so the restricted
  // POS app appears in the launcher for granted users (NovaMod is always allowed,
  // checked separately). Re-fetches when the POS admin grants/revokes (posGrantsBump).
  const [posGrantsBump,setPosGrantsBump]=useState(0);
  useEffect(()=>{ let live=true; if(!user){setPosGrants([]);return;} fetchPosAccess().then(list=>{ if(live) setPosGrants(Array.isArray(list)?list:[]); }); return ()=>{live=false;}; },[user,posGrantsBump]);
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
  useEffect(()=>{if(!menuOpen)return;function h(e){if(e.target&&e.target.closest&&e.target.closest("[data-start-btn]"))return;/* let the Start button's own onClick toggle it closed */if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);}setTimeout(()=>document.addEventListener("pointerdown",h),0);return()=>document.removeEventListener("pointerdown",h);},[menuOpen]);

  // All drag/resize tracking uses Pointer Events (pointermove/pointerup/pointercancel).
  // Pointer Events fire for mouse, touch, AND pen with a unified API — this is what
  // makes drag/resize work on tablet touchscreens without a separate touch code path.
  // pointercancel fires if the OS interrupts the gesture (system gesture, call, etc.);
  // we clean up exactly like pointerup so the dragged item doesn't get stuck.

  // Window drag/resize — imperative during the gesture: move the DOM node
  // directly + stash live geometry in dragGeomRef, so we DON'T setState (and
  // re-render the whole desktop) on every pointermove. The render reads
  // dragGeomRef for the dragged window so any incidental re-render (snap-zone
  // change, clock tick) keeps it in place. State is committed once on release.
  useEffect(()=>{
    if(!drag) return;
    const node = (typeof document !== "undefined") ? document.querySelector('[data-win-id="'+drag.winId+'"]') : null;
    function onMove(e){
      if(drag.type==="move"){
        const x=Math.max(0,e.clientX-drag.ox), y=Math.max(0,Math.min(e.clientY-drag.oy,window.innerHeight-80));
        dragGeomRef.current={x,y};
        if(node){ node.style.left=x+"px"; node.style.top=y+"px"; }
        if(deviceMode==="desktop"){const z=computeSnapZone(e.clientX,e.clientY);if(snapRef.current!==z){snapRef.current=z;setSnap(z);}}
      }else if(drag.type==="resize"){
        const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy; let nx=drag.wx,ny=drag.wy,nw=drag.ww,nh=drag.wh;
        if(drag.edge.includes("e"))nw=Math.max(MIN_W,drag.ww+dx);
        if(drag.edge.includes("s"))nh=Math.max(MIN_H,drag.wh+dy);
        if(drag.edge.includes("w")){nw=Math.max(MIN_W,drag.ww-dx);nx=drag.wx+drag.ww-nw;}
        if(drag.edge.includes("n")){nh=Math.max(MIN_H,drag.wh-dy);ny=drag.wy+drag.wh-nh;}
        dragGeomRef.current={x:nx,y:ny,width:nw,height:nh};
        if(node){ node.style.left=nx+"px"; node.style.top=ny+"px"; node.style.width=nw+"px"; node.style.height=nh+"px"; }
      }
    }
    function onUp(){
      const g=dragGeomRef.current;
      if(drag.type==="move"&&snapRef.current){ applySnap(drag.winId,snapRef.current); }
      else if(g){ setWins(ws=>ws.map(w=> w.id===drag.winId ? {...w,...g} : w)); }
      dragGeomRef.current=null; snapRef.current=null; setSnap(null); setDrag(null);
    }
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);
    return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[drag,deviceMode]);

  // Icon drag — free move, snap-to-free-grid on release
  useEffect(()=>{
    if(!iconDrag)return;
    // v11.0 — hit-test the dragged icon's center against the OTHER entries'
    // (drag-start) layout to find a folder-merge target. Only apps merge; folders
    // just reposition (no nesting).
    const draggingApp = !String(iconDrag.id).startsWith("folder:");
    function findTarget(x,y){
      if(!draggingApp) return null;
      const cx=x+ICON_W/2, cy=y+ICON_H/2;
      for(const en of (iconDrag.allIcons||[])){
        if(en.id===iconDrag.id) continue;
        const p=iconDrag.layout?.[en.id]; if(!p) continue;
        if(cx>=p.x&&cx<=p.x+ICON_W&&cy>=p.y&&cy<=p.y+ICON_H) return en;
      }
      return null;
    }
    function onMove(e){
      const nx=Math.max(0,Math.min(e.clientX-iconDrag.ox,window.innerWidth-ICON_W));
      const ny=Math.max(0,Math.min(e.clientY-iconDrag.oy,window.innerHeight-TASKBAR_H-ICON_H));
      const group=iconDrag.group||[iconDrag.id];
      if(group.length>1){   // move the whole selection rigidly; no folder-merge
        const start=iconDrag.groupStart||{};const base=start[iconDrag.id]||{x:nx,y:ny};
        const dx=nx-base.x,dy=ny-base.y;
        setIconPos(prev=>{const n={...prev};group.forEach(gid=>{const s=start[gid];if(!s)return;n[gid]={x:Math.max(0,Math.min(s.x+dx,window.innerWidth-ICON_W)),y:Math.max(0,Math.min(s.y+dy,window.innerHeight-TASKBAR_H-ICON_H))};});return n;});
        setMergeTarget(null);
      }else{
        setIconPos(prev=>({...prev,[iconDrag.id]:{x:nx,y:ny}}));
        const t=findTarget(nx,ny);setMergeTarget(t?t.id:null);
      }
    }
    function onUp(){
      const group=iconDrag.group||[iconDrag.id];
      if(group.length>1){   // group move — snap each selected icon to a free grid cell
        setMergeTarget(null);
        let fp={...iconPosRef.current};
        for(const gid of group){
          const raw=fp[gid];if(!raw)continue;
          const allPos=layoutIcons(iconDrag.allIcons||[],fp);
          const snapped=snapToFreeGrid(gid,raw.x,raw.y,allPos);
          if(snapped)fp={...fp,[gid]:snapped};
        }
        setIconPos(fp);db.set("user:"+iconDrag.user+":iconpos",fp).catch(()=>{});
        justDraggedRef.current=true;setTimeout(()=>{justDraggedRef.current=false;},60);
        setIconDrag(null);return;
      }
      const drop=iconPosRef.current[iconDrag.id];
      const target=drop?findTarget(drop.x,drop.y):null;
      setMergeTarget(null);
      if(target){
        // app → existing folder = add; app → app = new folder with both
        if(target.folder) addToDesktopFolder(target.fid,iconDrag.id);
        else if(target.app) createDesktopFolder([target.app.id,iconDrag.id]);
        setIconPos(prev=>{const n={...prev};delete n[iconDrag.id];db.set("user:"+iconDrag.user+":iconpos",n).catch(()=>{});return n;});
        justDraggedRef.current=true;setTimeout(()=>{justDraggedRef.current=false;},60);
        setIconDrag(null);return;
      }
      const allPos=layoutIcons(iconDrag.allIcons||[],iconPosRef.current);const raw=iconPosRef.current[iconDrag.id]||allPos[iconDrag.id];const snapped=raw?snapToFreeGrid(iconDrag.id,raw.x,raw.y,allPos):null;const fp=snapped?{...iconPosRef.current,[iconDrag.id]:snapped}:iconPosRef.current;setIconPos(fp);db.set("user:"+iconDrag.user+":iconpos",fp).catch(()=>{});setIconDrag(null);
    }
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

  // v11.0 — light mode (rebuilt). Applies the saved theme (default dark) by
  // flipping the --nv-* tokens via html[data-theme]; set in Settings → Display.
  const theme = (data?.settings?.theme === "light") ? "light" : "dark";
  useEffect(()=>{ document.documentElement.setAttribute("data-theme", theme); },[theme]);

  // v9.0 — Liquid Glass on/off. Sets html[data-glass] so the sheerer surface
  // tokens (styles.js) kick in for windows, taskbar, menus and widgets.
  useEffect(()=>{ document.documentElement.setAttribute("data-glass", glass?"on":"off"); },[glass]);

  // v11.0 — expose the live accent as CSS vars so global CSS (focus rings, the
  // button focus glow) can tint with the user's accent instead of a hardcoded
  // indigo. --nv-accent = solid hex, --nv-accent-fill = faint accent wash.
  useEffect(()=>{ const r=document.documentElement.style; r.setProperty("--nv-accent",AC); r.setProperty("--nv-accent-fill",fill(AC)); },[AC]);

  // v9.0/v9.1 — watch community store apps so installed ones render on the
  // desktop. v9.1: hardened against the "newly installed apps don't appear"
  // bug from v9.0. Two changes:
  //   1. Spread is `{...d.data(), id: d.id}` so the Firestore doc id ALWAYS
  //      wins. Before this, if a doc's data carried its own `id` field, the
  //      spread overrode `d.id` — leaving callers comparing the wrong value
  //      against `installedApps`.
  //   2. We separately keep `legacyId` = whatever the data's `id` field was
  //      (if any), so any pre-v9.1 entries in `data.installedApps` that
  //      reference the *data* id (e.g. McDonald's, which predates this fix)
  //      still match via the legacy fallback in the filter below. New
  //      installs always use the canonical doc id.
  // v9.3 — replaced the silent `() => {}` error handler with a console.warn.
  // The v9.2 DM bug spent an unknowable amount of time invisibly broken
  // because watchMyThreads's onSnapshot swallowed its error. Same shape
  // here: if this query ever errors, no community store apps render and
  // the user has no way to know why. A console line is a cheap insurance.
  useEffect(()=>{
    // v9.7 B1: dropped `orderBy("ts","desc")` from this query. Firestore's
    // orderBy SILENTLY EXCLUDES any doc missing the ordered field — so a
    // community app submitted without a `ts` (older docs, or any future
    // submission path that forgets it) would never load, and thus never
    // appear on the desktop even after install. We sort client-side now
    // (the set is capped at 60, so it's free), guaranteeing every doc
    // loads regardless of its fields. Same class of fix as the v9.2 DM
    // and v8.3 chess composite-index bugs.
    const q=query(collection(firestoreDb,"nova_user_apps"),limit(60));
    const unsub=onSnapshot(q,snap=>{
      const list=snap.docs.map(d=>{ const x=d.data(); return {...x, legacyId: x.id, id: d.id}; });
      list.sort((a,b)=>(b.ts||0)-(a.ts||0));
      setCommApps(list);
    },err=>{ console.warn("[nova_user_apps] snapshot error:", err?.message || err); });
    return ()=>unsub();
  },[]);

  // v9.3 (community-app desktop install bug, batch 2) — runtime diagnostic.
  // Logs to console whenever commApps or installedApps changes so we can
  // see at runtime why an installed app isn't appearing on the desktop.
  // Reads from `data` directly so we don't depend on the later-declared
  // `installedApps` memo (would hit TDZ — see the v9.0 mishap). Safe to
  // leave in until we confirm the install path is reliable for all users.
  useEffect(()=>{
    if(typeof console==="undefined")return;
    const inst = data?.installedApps || [];
    const visible = commApps.filter(a => isPubliclyVisible(a));
    const matched = commApps.filter(a => isPubliclyVisible(a) && (inst.includes(a.id) || (a.legacyId && inst.includes(a.legacyId))));
    console.group("[nova-install-debug]");
    console.log("commApps total:", commApps.length, "  publicly-visible:", visible.length);
    console.log("data.installedApps:", inst);
    console.log("matching desktop icons:", matched.map(a => ({docId:a.id, legacyId:a.legacyId, name:a.name, status:a.status})));
    // Surface installedApps entries that DO NOT correspond to any current
    // community app — strong hint of a stale id from a deleted/rejected app.
    const allKnownIds = new Set();
    commApps.forEach(a => { allKnownIds.add(a.id); if (a.legacyId) allKnownIds.add(a.legacyId); });
    const orphans = inst.filter(id => !allKnownIds.has(id));
    if (orphans.length) console.warn("[nova-install-debug] orphan installedApps ids (no matching community-app doc):", orphans);
    console.groupEnd();
  }, [commApps, data?.installedApps]);


  // v9.4 — Alarm scheduler. Alarms live under data.settings.alarms as
  // { id, time:"HH:MM", days:[bool x7], label, sound, enabled }. We check
  // every 15s whether any enabled alarm matches the current minute bucket
  // for today's weekday, and fire (sound + notification) at most once per
  // alarm per minute. The dedup uses a ref keyed by alarmId -> last-fired
  // minute index (epoch / 60000), so a 4× firing rate inside the same
  // minute can't ring repeatedly. The scheduler lives at the NovaOS level
  // so alarms ring even when the Clock app isn't open.
  const alarmFiredRef = useRef({});
  useEffect(() => {
    if (screen !== "desktop") return;
    function tick() {
      const list = data?.settings?.alarms || [];
      if (list.length === 0) return;
      const now = new Date();
      const minuteBucket = Math.floor(now.getTime() / 60000);
      const dow = now.getDay();                 // 0 = Sun
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const nowHHMM = hh + ":" + mm;
      for (const a of list) {
        if (!a || !a.enabled) continue;
        if (!Array.isArray(a.days) || !a.days[dow]) continue;
        if (a.time !== nowHHMM) continue;
        // Dedup — only fire once per alarm per minute, even if tick races.
        if (alarmFiredRef.current[a.id] === minuteBucket) continue;
        alarmFiredRef.current[a.id] = minuteBucket;
        // Sound + notification. Fall back to alarmSunrise if the chosen
        // sound id was renamed/removed in a future update.
        const soundId = ["alarmSunrise","alarmPulse","alarmClassic"].includes(a.sound) ? a.sound : "alarmSunrise";
        playSound(soundId);
        pushNotification({
          title: "⏰ " + (a.label?.trim() || "Alarm"),
          body: nowHHMM + " · " + (a.label?.trim() || "Alarm is ringing"),
          kind: "alert",
        });
      }
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.settings?.alarms, screen]);

  // v8.6 AFK screensaver. settings.screensaverMins: 0 = off, else minutes of
  // idle before it fades in (default 1). Any input dismisses it and re-arms
  // the timer. We use a ref + a single set of passive listeners so the common
  // case (mouse moving) only resets a timeout — never triggers a re-render.
  useEffect(()=>{
    if(screen!=="desktop"){ if(idleTimerRef.current)clearTimeout(idleTimerRef.current); return; }
    const mins = settings.screensaverMins===undefined ? 1 : settings.screensaverMins;
    if(!mins){ if(idleTimerRef.current)clearTimeout(idleTimerRef.current); ssActiveRef.current=false; setScreensaver(false); return; }
    const arm=()=>{ if(idleTimerRef.current)clearTimeout(idleTimerRef.current); idleTimerRef.current=setTimeout(()=>{ ssActiveRef.current=true; setScreensaver(true); }, mins*60*1000); };
    function onActivity(){ if(ssActiveRef.current){ ssActiveRef.current=false; setScreensaver(false); } arm(); }
    const evs=["pointermove","pointerdown","keydown","wheel","touchstart"];
    evs.forEach(ev=>window.addEventListener(ev,onActivity,{passive:true}));
    arm();
    return ()=>{ evs.forEach(ev=>window.removeEventListener(ev,onActivity)); if(idleTimerRef.current)clearTimeout(idleTimerRef.current); };
  },[settings.screensaverMins, screen]);

  // v8.6 cross-app drag-and-drop. Mirror the shared store for the ghost, and
  // while a drag is active track the pointer + resolve the drop on release via
  // the element under the cursor (data-drop="…").
  useEffect(()=>subscribeDrag(setDnd),[]);
  useEffect(()=>{
    if(!dnd) return;
    function mv(e){ moveDrag(e.clientX,e.clientY); }
    function up(e){
      const item=getDrag();
      if(item){ const el=document.elementFromPoint(e.clientX,e.clientY); const z=el&&el.closest?el.closest("[data-drop]"):null; handleDrop(item, z?z.getAttribute("data-drop"):null); }
      endDrag();
    }
    window.addEventListener("pointermove",mv,{passive:true});
    window.addEventListener("pointerup",up);
    return ()=>{ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[!!dnd]);

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
  // v9.0 — taskbar quick-settings flyout (network + volume + glass) and the
  // section the Settings app should open to when deep-linked from it.
  const [qsOpen, setQsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState(null);
  // v9.3 (#22) — mirror sound config so the taskbar volume icon's mute
  // indicator stays in sync no matter which app changed it (Settings,
  // QuickSettingsPanel, etc.). audio.js fires `subscribeSoundConfig`
  // synchronously inside setSoundConfig.
  const [soundCfg, setSoundCfgState] = useState(() => getSoundConfig());
  useEffect(() => subscribeSoundConfig(setSoundCfgState), []);
  // v10.8 — transient Windows-style toasts in the corner (separate from the
  // Notification Center log; these auto-dismiss).
  const [notifToasts, setNotifToasts] = useState([]);
  const dismissNotifToast = useCallback((id)=>setNotifToasts(t=>t.filter(x=>x.id!==id)),[]);
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
    // v10.8 — pop a transient corner toast (auto-dismiss after ~6s).
    setNotifToasts(t => [...t.slice(-3), { id: notif.id, kind: notif.kind, title: notif.title, body: notif.body, appId: notif.appId }]);
    setTimeout(() => setNotifToasts(t => t.filter(x => x.id !== notif.id)), 6000);
    // In the native Android app, also raise a real system notification.
    if(nativeIsNative()) nativeNotify({ title: notif.title, body: notif.body });
  },[saveData]);
  // Stable ref so background subscriptions (mentions, chess challenges) can call
  // the latest pushNotification without listing it as an effect dep (which would
  // tear down + re-subscribe the listeners).
  const pushNotifRef = useRef(pushNotification);
  pushNotifRef.current = pushNotification;
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

  // v9.6 — watch joined servers for the unread badge. Server-level unread
  // uses each server's lastActivityTs (bumped on every message) vs. the
  // per-server `data.lastRead["server:<id>"]` stamp ChatApp writes when
  // you view the server. Sender-is-me activity never counts.
  const [chatServers, setChatServers] = useState([]);
  useEffect(() => {
    const uid = getDbUid();
    if (!uid) { setChatServers([]); return; }
    return watchMyServers(uid, setChatServers);
  }, [user]);

  // v9.6 — @mention notifications. A lightweight OS-level subscription to
  // recent global chat: when a NEW message (after this listener mounts)
  // mentions @<myusername> and isn't from me, push a Notification Center
  // entry — so you get pinged even with the Chat app closed. We skip the
  // first snapshot (historical backlog) so old @mentions don't re-fire on
  // every login, and dedupe by message id.
  useEffect(() => {
    const uid = getDbUid();
    if (!uid || !user) return;
    const mentionRe = new RegExp("@" + user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    const key = "nova-mention-ts-" + user;
    // Watermark = ts of the newest message already accounted for. Seeded to
    // "now" the first time (don't notify history); persisted so a ping received
    // while you were signed OUT still notifies on your next login — previously
    // the whole backlog was ignored on connect, so offline pings were silent.
    let lastTs = Number(localStorage.getItem(key)) || Date.now();
    const notified = new Set();
    // orderBy DESC: watch the NEWEST 40 messages. (The old "asc" window watched
    // the 40 oldest, which never change once the chat grows past 40 — so new
    // pings were never seen and mention notifications never fired.)
    const q = query(collection(firestoreDb, "nova_chat"), orderBy("ts", "desc"), limit(40));
    const unsub = onSnapshot(q, snap => {
      snap.docs.forEach(d => {
        const m = d.data();
        if (!m || m.uid === uid) return;
        const ts = m.ts || 0;
        if (ts <= lastTs || notified.has(d.id)) return;
        if (!mentionRe.test(m.text || "")) return;
        notified.add(d.id);
        pushNotifRef.current({ appId: "chat", kind: "info", title: "@" + (m.user || "someone") + " mentioned you", body: (m.text || "").slice(0, 140) });
      });
      const newest = snap.docs.reduce((mx, d) => Math.max(mx, d.data()?.ts || 0), lastTs);
      if (newest > lastTs) { lastTs = newest; try { localStorage.setItem(key, String(lastTs)); } catch {} }
    }, () => {});
    return () => unsub();
  }, [user]);

  // v10.8 — notify the challenged player when someone starts a chess game with
  // them. Same watermark approach (so a challenge received while away notifies
  // on next login). I'm the challenged player when I'm participantUids[1].
  useEffect(() => {
    const uid = getDbUid();
    if (!uid || !user) return;
    const key = "nova-chess-ts-" + user;
    let lastTs = Number(localStorage.getItem(key)) || Date.now();
    const notified = new Set();
    const unsub = watchMyGames(uid, games => {
      games.forEach(g => {
        if (!g || !Array.isArray(g.participantUids) || g.participantUids[1] !== uid) return;
        const ts = g.createdAt || 0;
        if (ts <= lastTs || notified.has(g.id)) return;
        notified.add(g.id);
        pushNotifRef.current({ appId: "chess", kind: "info", title: "♟ Chess challenge", body: "@" + (g.participantUsernames?.[0] || "Someone") + " challenged you to a game of chess." });
      });
      const newest = games.reduce((mx, g) => Math.max(mx, g.createdAt || 0), lastTs);
      if (newest > lastTs) { lastTs = newest; try { localStorage.setItem(key, String(lastTs)); } catch {} }
    });
    return () => unsub && unsub();
  }, [user]);

  // v10.8 — notify on incoming DMs. Watch my threads; a thread whose last
  // message is newer than the watermark and was sent by the OTHER person is a
  // new DM. Same offline-safe watermark as mentions/chess.
  useEffect(() => {
    const uid = getDbUid();
    if (!uid || !user) return;
    const key = "nova-dm-ts-" + user;
    let lastTs = Number(localStorage.getItem(key)) || Date.now();
    const notified = new Set();
    const unsub = watchMyThreads(uid, threads => {
      threads.forEach(th => {
        const ts = th.lastTs || 0;
        if (!th.lastMessage || th.lastSenderUid === uid) return;   // no msg, or my own
        const k = th.id + ":" + ts;
        if (ts <= lastTs || notified.has(k)) return;
        notified.add(k);
        pushNotifRef.current({ appId: "chat", kind: "info", title: "@" + (otherParticipantName(th, uid) || "Someone") + " messaged you", body: (th.lastMessage || "").slice(0, 140) });
      });
      const newest = threads.reduce((mx, th) => Math.max(mx, th.lastTs || 0), lastTs);
      if (newest > lastTs) { lastTs = newest; try { localStorage.setItem(key, String(lastTs)); } catch {} }
    });
    return () => unsub && unsub();
  }, [user]);

  // Compute badge counts. The map is { appId: count } so the renderer
  // can look up by app id with O(1).
  const lastChatOpenTs = data?.settings?.lastChatOpenTs || 0;
  const myUid = getDbUid();
  const chatLastRead = data?.lastRead || {};
  const chatUnread = dmThreads.filter(t =>
    t.lastSenderUid && t.lastSenderUid !== myUid && (t.lastTs || 0) > lastChatOpenTs
  ).length;
  const serverUnread = chatServers.filter(s =>
    s.lastActivityTs && s.lastSenderUid && s.lastSenderUid !== myUid &&
    (chatLastRead["server:" + s.id] || 0) < s.lastActivityTs
  ).length;
  const appBadgeCounts = {};
  notifications.forEach(n => {
    if (n.read || !n.appId) return;
    appBadgeCounts[n.appId] = (appBadgeCounts[n.appId] || 0) + 1;
  });
  if (chatUnread > 0) appBadgeCounts.chat = (appBadgeCounts.chat || 0) + chatUnread;
  if (serverUnread > 0) appBadgeCounts.chat = (appBadgeCounts.chat || 0) + serverUnread;
  // When the panel opens, mark everything read after a tick — avoids visual flash
  useEffect(()=>{
    if(!notifsOpen) return;
    const id = setTimeout(()=>markAllNotificationsRead(), 250);
    return ()=>clearTimeout(id);
  },[notifsOpen, markAllNotificationsRead]);
  const updateData    =useCallback((patch)=>{setData(prev=>{const next=typeof patch==="function"?patch(prev):{...prev,...patch};saveData(next);return next;});},[saveData]);

  // ── Achievements (v11.0 Phase D) — GAMES ONLY ───────────────────────────
  // Unlock state lives in data.achievements ({id:unlockedAt}); the set of games
  // a personal best has been set in lives in data.gamePBs. Refs hold the latest
  // values so unlocks never re-fire and never spam Firestore.
  const achRef = useRef({}); achRef.current = data?.achievements || {};
  const gamePBRef = useRef([]); gamePBRef.current = data?.gamePBs || [];
  const unlock = useCallback((id) => {
    const a = ACH_MAP[id]; if (!a) return;
    if (achRef.current[id]) return;                       // already earned
    achRef.current = { ...achRef.current, [id]: Date.now() };   // guard rapid double-calls
    updateData(p => p ? ({ ...p, achievements: { ...(p.achievements || {}), [id]: Date.now() } }) : p);
    playSound("notification");
    showToast("🏆 Achievement unlocked — " + a.title);
  }, [updateData, showToast]);
  // A leaderboard game reports a fresh personal best; track distinct games and
  // unlock the milestone badges.
  const recordGameWin = useCallback((gameId) => {
    unlock("first_score");
    const cur = gamePBRef.current;
    if (cur.includes(gameId)) return;
    const next = [...cur, gameId]; gamePBRef.current = next;
    updateData(p => p ? ({ ...p, gamePBs: Array.from(new Set([...(p.gamePBs || []), gameId])) }) : p);
    if (next.length >= 3) unlock("hat_trick");
    if (next.length >= 6) unlock("arcade_master");
    if (next.length >= 10) unlock("all_star");
  }, [updateData, unlock]);
  useEffect(() => { setGameWinHandler(recordGameWin); return () => setGameWinHandler(null); }, [recordGameWin]);

  const updateSettings=useCallback((patch)=>{updateData(prev=>({...prev,settings:{...(prev.settings||{}),...patch}}));},[updateData]);
  const handleCustomWallpaper=useCallback(async(url)=>{setCustomWp(url);await db.set("user:"+user+":wpimg",url);updateSettings({[theme==="light"?"wallpaperLight":"wallpaper"]:"custom"});showToast("Custom wallpaper set ✓");},[user,updateSettings,showToast,theme]);
  // v11.0 — custom brand logo: persist the { url, fit, shape } object per-user
  // (or null to reset) and broadcast it to <NovaLogo> + the favicon immediately.
  const handleCustomLogo=useCallback(async(logo)=>{setCustomLogo(logo);await db.set("user:"+user+":logoimg",logo||null);showToast(logo?"Logo updated ✓":"Logo reset to default ✓");},[user,showToast]);
  // v11.0 Phase B — desktop sticky notes (stored in data.stickyNotes, so they
  // ride along in profile backups). Text persists on blur; position/color/delete persist on the action.
  const addStickyNote=useCallback((x,y)=>{const id="note-"+Date.now()+"-"+Math.floor(Math.random()*1000);const W=212;const nx=Math.max(8,Math.min((x||140)-30,window.innerWidth-W-8));const ny=Math.max(8,Math.min((y||140)-12,window.innerHeight-200));updateData(d=>({...d,stickyNotes:[...(d.stickyNotes||[]),{id,text:"",color:"yellow",x:nx,y:ny}]}));showToast("Sticky note added");},[updateData,showToast]);
  const updateStickyNote=useCallback((id,patch)=>{updateData(d=>({...d,stickyNotes:(d.stickyNotes||[]).map(n=>n.id===id?{...n,...patch}:n)}));},[updateData]);
  const removeStickyNote=useCallback((id)=>{updateData(d=>({...d,stickyNotes:(d.stickyNotes||[]).filter(n=>n.id!==id)}));},[updateData]);
  // v11.0 Phase B — Snap Workspaces. Save the current window arrangement as a
  // named layout (settings.workspaces, so it backs up too) and snap back later.
  const saveWorkspace=useCallback((name)=>{
    const snap=(winsRef.current||[]).map(w=>({...w}));
    if(!snap.length){showToast("No open windows to save");return;}
    updateData(d=>{const list=d?.settings?.workspaces||[];const ws={id:"ws-"+Date.now()+"-"+Math.floor(Math.random()*1000),name:(name&&name.trim())||("Layout "+(list.length+1)),wins:snap,savedAt:Date.now()};return {...d,settings:{...(d.settings||{}),workspaces:[...list,ws].slice(-12)}};});
    showToast("Layout saved ✓");
  },[updateData,showToast]);
  const restoreWorkspace=useCallback((id)=>{
    const ws=(data?.settings?.workspaces||[]).find(w=>w.id===id);
    if(!ws||!Array.isArray(ws.wins))return;
    const validIds=new Set(APPS.map(a=>a.id));
    const valid=ws.wins.filter(w=>validIds.has(w.app)).map(w=>({...w}));
    setWins(valid);
    setMaxZ(valid.reduce((m,w)=>Math.max(m,w.z||100),100)+1);
    setDeskCount(Math.max(1,Math.min(MAX_DESKTOPS,valid.reduce((m,w)=>Math.max(m,w.desk||0),0)+1)));
    setCurDesk(0);
    setTimeout(()=>setWins(ws2=>ws2.map(w=>({...w}))),160);   // settle restored window subtrees (mirrors login restore)
    setWorkspacesOpen(false);
    showToast("Restored “"+ws.name+"”");
  },[data,showToast]);
  const deleteWorkspace=useCallback((id)=>{updateData(d=>({...d,settings:{...(d.settings||{}),workspaces:(d.settings?.workspaces||[]).filter(w=>w.id!==id)}}));},[updateData]);

  // v10.0 Supernova — AI command-bar executor. Maps a planned {tool, args}
  // step to a real OS action and returns a short result string (or null for
  // no-op steps like "answer"). Throws on bad input so the command bar can
  // show a per-step ⚠. Every action here is safe + reversible.
  const runCommand = useCallback(async (tool, args = {}) => {
    switch (tool) {
      case "openApp": {
        const id = String(args.appId || "").toLowerCase().trim();
        const app = APPS.find(a => a.id === id);
        if (!app) throw new Error("No app called \"" + (args.appId || "?") + "\"");
        kbHandlersRef.current?.openApp(id);
        return "Opened " + app.label;
      }
      case "createNote": {
        const title = (args.title || "Untitled").toString().slice(0, 120);
        const body = (args.body || "").toString();
        const id = Date.now();
        updateData(p => ({ ...p, notes: [{ id, title, body, ts: id, folderId: null }, ...(p.notes || [])] }));
        return "Created note “" + title + "”";
      }
      case "createTask": {
        const text = (args.text || "").toString().trim();
        if (!text) throw new Error("No task text given");
        updateData(p => ({ ...p, tasks: [{ id: Date.now(), text, done: false, ts: Date.now() }, ...(p.tasks || [])] }));
        return "Added task “" + text + "”";
      }
      case "setWallpaper": {
        const id = String(args.id || "").toLowerCase().trim();
        if (!WALLPAPERS[id]) throw new Error("No wallpaper called \"" + (args.id || "?") + "\"");
        updateSettings({ wallpaper: id });
        return "Wallpaper changed to " + id;
      }
      case "setAccent": {
        let hex = String(args.hex || "").trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) throw new Error("Not a valid color");
        if (hex[0] !== "#") hex = "#" + hex;
        updateSettings({ accent: hex });
        return "Accent color updated";
      }
      case "setVolume": {
        let lvl = Number(args.level);
        if (!Number.isFinite(lvl)) throw new Error("Invalid volume");
        lvl = Math.max(0, Math.min(100, lvl));
        setSoundConfig({ ...getSoundConfig(), volume: lvl / 100 });
        return "Volume set to " + Math.round(lvl) + "%";
      }
      case "answer":
        return null; // pure reply — nothing to do
      default:
        throw new Error("I can't do \"" + tool + "\" yet");
    }
  }, [updateData, updateSettings]);
  // v8.6 — downsample a (blob/data) image URL then hand the JPEG data URL to cb.
  function downsamplePhoto(url, max, quality, cb){
    const img=new Image();
    img.onload=()=>{ try{ const r=Math.min(max/img.width,max/img.height,1); const c=document.createElement("canvas"); c.width=Math.round(img.width*r); c.height=Math.round(img.height*r); c.getContext("2d").drawImage(img,0,0,c.width,c.height); cb(c.toDataURL("image/jpeg",quality)); }catch{ showToast("Couldn't process image"); } };
    img.onerror=()=>showToast("Couldn't load photo");
    img.src=url;
  }
  // v8.6 — resolve a cross-app photo drop. target comes from the dropped
  // element's data-drop attribute: "wallpaper" (desktop), "avatar" (profile
  // window). "none"/null = a non-target surface, so do nothing.
  function handleDrop(item, target){
    if(!item || item.type!=="photo") return;
    if(target==="wallpaper") downsamplePhoto(item.url, 900, 0.72, (u)=>handleCustomWallpaper(u));
    else if(target==="avatar") downsamplePhoto(item.url, 256, 0.85, (u)=>{ updateData({avatar:u}); showToast("Profile picture set ✓"); });
  }
  const focusWin=useCallback((id)=>{setMaxZ(z=>{const nz=z+1;setWins(ws=>ws.map(w=>w.id===id?{...w,z:nz}:w));return nz;});},[]);
  // v10.0 — tag a window with a transient animation flag, auto-clearing it
  // after `ms` so the window settles back to its resting (no-animation) style.
  const markFx=useCallback((id,kind,ms)=>{
    setWinFx(f=>({...f,[id]:kind}));
    if(fxTimers.current[id]) clearTimeout(fxTimers.current[id]);
    fxTimers.current[id]=setTimeout(()=>{
      setWinFx(f=>{ const n={...f}; delete n[id]; return n; });
      delete fxTimers.current[id];
      delete launchPt.current[id];
    },ms);
  },[]);
  // Restore a minimized window with a pop-up animation, then raise it.
  const restoreWin=useCallback((id)=>{
    setWins(ws=>ws.map(x=>x.id===id?{...x,state:"normal"}:x));
    markFx(id,"restoring",300);
    focusWin(id);
  },[markFx,focusWin]);
  // On mobile, every new window opens MAXIMIZED. Default sizes (520x480 etc.)
  // are wider than a ~360px phone and would otherwise spill off the right edge.
  // We still stash the windowed position in prevBounds so toggling out of
  // maximize restores to a sane place if the user later switches modes.
  const openApp=useCallback((appId)=>{
    // v11.0 — never launch a restricted app (POS) for a user without access,
    // even via a stale restored window or desktop pin. posAccessRef already
    // folds in the NovaMod (isAdmin) check, so this also lets NovaMod through.
    // POS opens as a full-screen kiosk overlay (no window), not a desktop window.
    if(appId==="pos"){ if(!posAccessRef.current) return; setMenuOpen(false); setPosMode(true); return; }
    setMenuOpen(false);
    // v8.1: opening an app clears its notification badge. Special-cased
    // for "chat" inside markAppNotificationsRead (bumps lastChatOpenTs
    // so the DM unread badge clears as well).
    markAppNotificationsRead(appId);
    // v10.0: if a window for this app already exists on another virtual
    // desktop, jump to that desktop so focusing it actually shows it.
    const cur=curDeskRef.current;
    const existing=(winsRef.current||[]).find(w=>w.app===appId);
    if(existing && (existing.desk||0)!==cur) setCurDesk(existing.desk||0);
    const wasMin = existing && existing.state==="minimized";
    const newId = Date.now()+Math.random();
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
          id:newId, app:appId, z:nz, desk:cur,
          x:baseX, y:baseY, width:sz.w, height:sz.h,
          state: mobileFirst ? "maximized" : "normal",
          prevBounds: mobileFirst ? {x:baseX,y:baseY,width:sz.w,height:sz.h} : null,
        }];
      });
      return nz;
    });
    // v10.0 — animate: a brand-new window zooms out of the click point; an
    // existing window that was minimized pops back from the taskbar.
    if(existing){ if(wasMin) markFx(existing.id,"restoring",300); }
    else {
      if(ptrRef.current) launchPt.current[newId]={x:ptrRef.current.x,y:ptrRef.current.y};
      markFx(newId,"entering",340);
    }
  },[deviceMode,markAppNotificationsRead,markFx]);
  // v10.0 — virtual-desktop operations.
  const addDesktop=useCallback(()=>{
    setDeskCount(c=>{ if(c>=MAX_DESKTOPS) return c; setCurDesk(c); return c+1; });
  },[]);
  const removeDesktop=useCallback((idx)=>{
    setDeskCount(c=>{
      if(c<=1) return c;
      // Windows on the removed desktop fall back to the one before it;
      // anything on a higher desktop shifts down to keep indices contiguous.
      setWins(ws=>ws.map(w=>{
        const d=w.desk||0;
        if(d===idx) return {...w,desk:Math.max(0,idx-1)};
        if(d>idx)   return {...w,desk:d-1};
        return w;
      }));
      const nc=c-1;
      setCurDesk(cd=>{
        let n=cd;
        if(cd===idx) n=Math.max(0,idx-1);
        else if(cd>idx) n=cd-1;
        return Math.min(n,nc-1);
      });
      return nc;
    });
  },[]);
  const moveWinToDesk=useCallback((winId,idx)=>{
    setWins(ws=>ws.map(w=>w.id===winId?{...w,desk:idx}:w));
  },[]);
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
  // v10.x — the app-content switch, extracted so BOTH desktop windows and the
  // mobile shell render apps the same way. `browserActive` controls the native
  // browser webview's visibility (always true on mobile = one fullscreen app).
  function renderAppContent(appId, browserActive=true){
    const app=APPS.find(a=>a.id===appId);
    return (
      <Suspense fallback={
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",gap:10,color:"rgba(255,255,255,0.4)",padding:24}}>
          <div style={{width:18,height:18,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <span style={{fontFamily:FF,fontSize:12}}>Loading {app?.label||"app"}…</span>
        </div>
      }>
        {appId==="notes"    &&<NotesApp    data={data} updateData={updateData} showToast={showToast} AC={AC} openNovaAi={()=>openApp("novaai")}/>}
        {appId==="tasks"    &&<TasksApp    data={data} updateData={updateData} showToast={showToast} AC={AC} openNovaAi={()=>openApp("novaai")}/>}
        {appId==="files"    &&<FilesApp    data={data} updateData={updateData} showToast={showToast} AC={AC} commApps={commApps} openApp={openApp}/>}
        {appId==="paint"    &&<PaintApp    showToast={showToast} AC={AC} onSetWallpaper={handleCustomWallpaper}/>}
        {appId==="browser"  &&<BrowserApp  AC={AC} active={browserActive}/>}
        {appId==="snake"    &&<SnakeApp    AC={AC}/>}
        {appId==="2048"     &&<Game2048App AC={AC} user={user}/>}
        {appId==="store"    &&<StoreApp    user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
        {appId==="terminal" &&<TerminalApp user={user} AC={AC} openApp={openApp} showToast={showToast}/>}
        {appId==="chat"     &&<ChatApp     user={user} AC={AC} data={data} updateData={updateData}/>}
        {appId==="settings" &&<SettingsApp user={user} data={data} updateSettings={updateSettings} showToast={showToast} AC={AC} onCustomWallpaper={handleCustomWallpaper} onCustomLogo={handleCustomLogo} onLogout={logout} initialSection={settingsSection}/>}
        {appId==="profile"  &&<ProfileApp  user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
        {appId==="calculator" &&<CalculatorApp AC={AC}/>}
        {appId==="clock"      &&<ClockApp AC={AC} data={data} updateSettings={updateSettings}/>}
        {appId==="calendar"   &&<CalendarApp data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
        {appId==="music"      &&<MusicApp AC={AC} showToast={showToast}/>}
        {appId==="pdf"        &&<PdfApp AC={AC} showToast={showToast}/>}
        {appId==="atmos"      &&<AtmosApp AC={AC} showToast={showToast} pushNotification={pushNotification} openNovaAi={()=>openApp("novaai")} data={data} updateSettings={updateSettings} onSevereAlert={alert=>setSevereAlert(alert)}/>}
        {appId==="minesweeper"&&<MinesweeperApp AC={AC} user={user}/>}
        {appId==="wordle"     &&<WordleApp AC={AC} showToast={showToast} user={user}/>}
        {appId==="tetris"     &&<TetrisApp AC={AC} user={user}/>}
        {appId==="novaai"     &&<NovaAiApp AC={AC} showToast={showToast}/>}
        {appId==="tictactoe"  &&<TicTacToeApp AC={AC}/>}
        {appId==="pong"       &&<PongApp AC={AC} user={user}/>}
        {appId==="flappy"     &&<FlappyBirdApp AC={AC} data={data} updateSettings={updateSettings} user={user}/>}
        {appId==="invaders"   &&<SpaceInvadersApp AC={AC} data={data} updateSettings={updateSettings} user={user}/>}
        {appId==="pacman"     &&<PacManApp AC={AC} data={data} updateSettings={updateSettings} user={user}/>}
        {appId==="chess"      &&<ChessApp user={user} AC={AC}/>}
        {appId==="photos"     &&<PhotosApp AC={AC} showToast={showToast} onSetWallpaper={handleCustomWallpaper}/>}
        {appId==="screenshot" &&<ScreenshotApp AC={AC} showToast={showToast} onSetWallpaper={handleCustomWallpaper}/>}
        {appId==="slides"     &&<SlidesApp AC={AC} data={data} updateData={updateData} showToast={showToast}/>}
        {appId==="assetstudio"&&<AssetStudioApp AC={AC} showToast={showToast}/>}
        {appId==="videoeditor"&&<VideoEditorApp AC={AC} showToast={showToast}/>}
        {appId==="whiteboard" &&<WhiteboardApp AC={AC} showToast={showToast}/>}
        {appId==="code"       &&<CodeApp AC={AC} showToast={showToast}/>}
        {appId==="forum"      &&<ForumApp AC={AC} user={user} showToast={showToast}/>}
        {appId==="sheets"     &&<SheetsApp AC={AC} showToast={showToast}/>}
        {appId==="achievements"&&<AchievementsApp AC={AC} data={data}/>}
        {/* POS renders as a full-screen kiosk overlay (see posMode), not a window. */}
        {appId==="atlas"      &&<AtlasApp AC={AC} showToast={showToast}/>}
        {appId==="currency"   &&<CurrencyApp AC={AC}/>}
        {appId==="dictionary" &&<DictionaryApp AC={AC}/>}
        {appId==="translate"  &&<TranslatorApp AC={AC} showToast={showToast}/>}
        {appId==="crypto"     &&<CryptoApp AC={AC}/>}
        {appId==="qr"         &&<QrApp AC={AC} showToast={showToast}/>}
        {appId==="sudoku"     &&<SudokuApp AC={AC} user={user}/>}
        {appId==="typing"     &&<TypingApp AC={AC} user={user}/>}
        {appId==="camera"     &&<CameraApp AC={AC} showToast={showToast}/>}
        {appId==="recorder"   &&<VoiceRecorderApp AC={AC} showToast={showToast}/>}
        {appId==="solitaire"  &&<SolitaireApp AC={AC} user={user}/>}
      </Suspense>
    );
  }
  // v10.x — enabled widgets rendered for the mobile home screen (a horizontal
  // card row). Reuses the same *WidgetContent components as the desktop.
  function renderMobileWidgets(){
    const s={x:0,y:0,w:168,h:150};
    return Object.keys(WIDGET_CONFIGS).filter(id=>widgets[id]).map(id=>{
      let content=null;
      if(id==="clock")        content=<ClockWidgetContent   state={s} tick={tick} use24h={use24h} AC={AC}/>;
      else if(id==="weather") content=<WeatherWidgetContent  state={s} data={data} updateSettings={updateSettings}/>;
      else if(id==="notesw")  content=<NotesWidgetContent    state={s} data={data}/>;
      else if(id==="tasksw")  content=<TasksWidgetContent    state={s} data={data} updateData={updateData}/>;
      else if(id==="calendar")content=<CalendarWidgetContent state={s} tick={tick} AC={AC}/>;
      else if(id==="sysinfo") content=<SysInfoWidgetContent  state={s}/>;
      else if(id==="battery") content=<BatteryWidgetContent  state={s} AC={AC}/>;
      else if(id==="pomodoro")content=<PomodoroWidgetContent state={s} AC={AC}/>;
      return {id, content};
    });
  }
  // v10.0 — close plays a shrink-fade, THEN removes the window from state.
  function closeWin(id){
    playSound("windowClose");
    if(fxTimers.current[id]) clearTimeout(fxTimers.current[id]);
    setWinFx(f=>({...f,[id]:"closing"}));
    fxTimers.current[id]=setTimeout(()=>{
      setWins(ws=>ws.filter(w=>w.id!==id));
      setWinFx(f=>{ const n={...f}; delete n[id]; return n; });
      delete fxTimers.current[id];
      delete launchPt.current[id];
    },190);
  }
  // v10.0 — minimize animates down toward the taskbar, then hides; toggling a
  // minimized window restores it with the matching pop-up (via restoreWin).
  function minimizeWin(id){
    const w=winsRef.current.find(x=>x.id===id);
    if(!w) return;
    if(w.state==="minimized"){ restoreWin(id); return; }
    if(fxTimers.current[id]) clearTimeout(fxTimers.current[id]);
    setWinFx(f=>({...f,[id]:"minimizing"}));
    fxTimers.current[id]=setTimeout(()=>{
      setWins(ws=>ws.map(x=>x.id===id?{...x,state:"minimized"}:x));
      setWinFx(f=>{ const n={...f}; delete n[id]; return n; });
      delete fxTimers.current[id];
    },190);
  }
  function maximizeWin(id){setWins(ws=>ws.map(w=>{if(w.id!==id)return w;if(w.state==="maximized")return{...w,state:"normal",...(w.prevBounds||{}),prevBounds:null};return{...w,state:"maximized",prevBounds:{x:w.x,y:w.y,width:w.width,height:w.height}};}));}

  // ── v8.5 window snap layouts ───────────────────────────────────────────
  // The desktop area is the full viewport minus the taskbar. Each snap zone
  // maps to a rectangle in that area; dragging a window to an edge/corner
  // previews the zone (ghost overlay) and commits it on release. Keyboard
  // Alt+Arrow snaps the active window the same way.
  function snapZoneRect(zone){
    const W=window.innerWidth, AH=window.innerHeight-TASKBAR_H;
    const hw=Math.round(W/2), hh=Math.round(AH/2);
    switch(zone){
      case "max":   return {x:0,y:0,width:W,height:AH};
      case "left":  return {x:0,y:0,width:hw,height:AH};
      case "right": return {x:W-hw,y:0,width:hw,height:AH};
      case "tl":    return {x:0,y:0,width:hw,height:hh};
      case "tr":    return {x:W-hw,y:0,width:hw,height:hh};
      case "bl":    return {x:0,y:AH-hh,width:hw,height:hh};
      case "br":    return {x:W-hw,y:AH-hh,width:hw,height:hh};
      default:      return null;
    }
  }
  function computeSnapZone(cx,cy){
    const W=window.innerWidth, AH=window.innerHeight-TASKBAR_H;
    const E=24;                       // edge sensitivity (px)
    const cornerX=W*0.16, cornerY=AH*0.22;
    const nearL=cx<=E, nearR=cx>=W-E, nearT=cy<=E, nearB=cy>=AH-E;
    if(nearT && cx<cornerX)   return "tl";
    if(nearT && cx>W-cornerX) return "tr";
    if(nearT)                 return "max";
    if(nearB && cx<cornerX)   return "bl";
    if(nearB && cx>W-cornerX) return "br";
    if(nearL && cy<cornerY)   return "tl";
    if(nearL && cy>AH-cornerY)return "bl";
    if(nearL)                 return "left";
    if(nearR && cy<cornerY)   return "tr";
    if(nearR && cy>AH-cornerY)return "br";
    if(nearR)                 return "right";
    return null;
  }
  function applySnap(winId,zone){
    if(zone==="max"){
      setWins(ws=>ws.map(w=>w.id===winId?(w.state==="maximized"?w:{...w,state:"maximized",prevBounds:w.prevBounds||{x:w.x,y:w.y,width:w.width,height:w.height}}):w));
      focusWin(winId);
      return;
    }
    const r=snapZoneRect(zone); if(!r)return;
    setWins(ws=>ws.map(w=>w.id===winId?{...w,state:"normal",x:r.x,y:r.y,width:r.width,height:r.height,prevBounds:w.prevBounds||{x:w.x,y:w.y,width:w.width,height:w.height}}:w));
    focusWin(winId);
  }
  // Alt+Down: un-maximize if maximized, otherwise minimize.
  function snapDown(winId){
    const w=winsRef.current.find(x=>x.id===winId); if(!w)return;
    if(w.state==="maximized") setWins(ws=>ws.map(x=>x.id===winId?{...x,state:"normal",...(x.prevBounds||{}),prevBounds:null}:x));
    else minimizeWin(winId);
  }

  // v6.4: Global keyboard shortcuts.
  //   Cmd/Ctrl + K    → Spotlight global search (v9.4 — was start menu)
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
  // Cmd+K inside a search box doesn't surprise-open Spotlight.
  // (Esc is allowed everywhere — it's expected to "cancel" universally.)
  //
  // Handler ref pattern: keeps the listener stable across renders while
  // still reading the latest handler functions. Re-binding the listener
  // on every render would work too, just slightly noisier.
  const kbHandlersRef = useRef(null);
  kbHandlersRef.current = { openApp, closeWin, minimizeWin, setMenuOpen, setSpotlightOpen, setCommandOpen, setTaskViewOpen, screen, applySnap, snapDown,
    switchDeskBy:(d)=>setCurDesk(c=>Math.max(0,Math.min(deskCount-1,c+d))),
    goToDesk:(n)=>setCurDesk(()=>Math.max(0,Math.min(deskCount-1,n))) };
  useEffect(()=>{
    function onKey(e){
      const h = kbHandlersRef.current;
      if(!h || h.screen !== "desktop") return;  // shortcuts only matter once signed in
      if(posModeRef.current) return;            // POS kiosk takes over — no OS shortcuts
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Esc — close menus. Apps handle their own modal closes.
      if(e.key === "Escape"){
        h.setMenuOpen(false);
        return;
      }
      // Cmd/Ctrl + K — Spotlight (v9.4). Reassigned from the start menu;
      // Spotlight is the better search target and the Start button is
      // still one click away in the taskbar.
      if(mod && (e.key === "k" || e.key === "K") && !isTyping){
        e.preventDefault();
        h.setSpotlightOpen(o => !o);
        return;
      }
      // Cmd/Ctrl + J — AI command bar (v10.0 Supernova). Works even while
      // typing in an app, since it's an explicit modifier combo.
      if(mod && (e.key === "j" || e.key === "J")){
        e.preventDefault();
        h.setCommandOpen(o => !o);
        return;
      }
      // Cmd/Ctrl + , — Settings
      if(mod && e.key === "," && !isTyping){
        e.preventDefault();
        h.openApp("settings");
        return;
      }
      // v10.0: "active window" helpers operate on the CURRENT virtual desktop
      // only — the global top-z window may live on a hidden desktop.
      const topOnDesk = () => [...(winsRef.current || [])].filter(w => w.state !== "minimized" && (w.desk||0) === curDeskRef.current).sort((a,b) => (b.z||0) - (a.z||0))[0];
      // Alt + W — close active window. Excludes minimized so Alt+W when
      // everything is hidden in the taskbar doesn't surprise-close the wrong thing.
      if(e.altKey && (e.key === "w" || e.key === "W") && !isTyping){
        e.preventDefault();
        const top = topOnDesk();
        if(top) h.closeWin(top.id);
        return;
      }
      // Alt + M — minimize active window
      if(e.altKey && (e.key === "m" || e.key === "M") && !isTyping){
        e.preventDefault();
        const top = topOnDesk();
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
      // v10.7 — Ctrl/Cmd+Alt+1–9 jumps straight to that virtual desktop.
      if(mod && e.altKey && /^[1-9]$/.test(e.key)){
        e.preventDefault();
        h.goToDesk(parseInt(e.key,10)-1);
        return;
      }
      // v10.0 — Ctrl/Cmd+Alt+Arrow drives virtual desktops (checked BEFORE the
      // plain Alt+Arrow snap below so the two combos don't collide).
      // Left/Right switch desktops; Up toggles Task View.
      if(mod && e.altKey && (e.key==="ArrowLeft"||e.key==="ArrowRight")){
        e.preventDefault();
        h.switchDeskBy(e.key==="ArrowRight"?1:-1);
        return;
      }
      if(mod && e.altKey && e.key==="ArrowUp"){
        e.preventDefault();
        h.setTaskViewOpen(o=>!o);
        return;
      }
      // v8.5 — Alt + Arrow snaps the active window (the web-safe stand-in for
      // Win+Arrow, which the OS itself intercepts). Left/Right → halves,
      // Up → maximize, Down → un-maximize or minimize. preventDefault stops
      // Alt+Left/Right from triggering browser back/forward navigation.
      if(e.altKey && !mod && !isTyping && (e.key==="ArrowLeft"||e.key==="ArrowRight"||e.key==="ArrowUp"||e.key==="ArrowDown")){
        e.preventDefault();
        const top=topOnDesk();
        if(!top)return;
        if(e.key==="ArrowLeft")      h.applySnap(top.id,"left");
        else if(e.key==="ArrowRight")h.applySnap(top.id,"right");
        else if(e.key==="ArrowUp")   h.applySnap(top.id,"max");
        else                         h.snapDown(top.id);
        return;
      }
    }
    document.addEventListener("keydown", onKey);
    return ()=>document.removeEventListener("keydown", onKey);
  },[]);
  function onIconMouseDown(e,appId,allIcons){
    if(e.button!==0)return;e.stopPropagation();e.preventDefault();
    // Ctrl/Cmd-click toggles this icon's membership in the multi-selection (no drag).
    if(e.metaKey||e.ctrlKey){setSelectedIcons(prev=>{const n=new Set(prev);n.has(appId)?n.delete(appId):n.add(appId);return n;});return;}
    const positions=layoutIcons(allIcons,iconPos);const pos=positions[appId]||{x:0,y:0};
    // v11.0 Phase B — grabbing one of several selected icons drags the whole group;
    // otherwise it's a single-icon drag (and we clear any stale marquee highlight).
    const groupSel=selectedIcons.has(appId)&&selectedIcons.size>1;
    const group=groupSel?allIcons.filter(en=>selectedIcons.has(en.id)).map(en=>en.id):[appId];
    if(!groupSel&&selectedIcons.size)setSelectedIcons(new Set());
    const groupStart={};group.forEach(gid=>{groupStart[gid]=positions[gid]||{x:0,y:0};});
    setIconDrag({id:appId,ox:e.clientX-pos.x,oy:e.clientY-pos.y,user,allIcons:[...allIcons],layout:positions,group,groupStart});
  }
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
    const initData={notes:[],tasks:[],wallpaper:"bloomdark",bio:"",joined:Date.now(),settings:{},installedApps:[],folders:[],hiddenFromDesktop:[],pinnedToTaskbar:[],migratedTo41:true,migratedTo52:true,
      // v11.0 Phase B — new accounts start with the curated desktop set and an
      // un-finished setup so the first-run wizard appears once. (Existing accounts
      // have neither field, so they migrate to the whitelist lazily + skip the wizard.)
      desktopApps:[...DEFAULT_DESKTOP_APPS], setupComplete:false};

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
          // v10.0: rebuild the virtual-desktop count from restored windows so
          // any windows saved on desktop 2+ have a desktop to live on.
          const maxDesk = valid.reduce((m,w) => Math.max(m, w.desk||0), 0);
          setDeskCount(Math.max(1, Math.min(MAX_DESKTOPS, maxDesk + 1)));
          setCurDesk(0);
          // v10.7: restored windows/desktops could paint stale (black background,
          // unaligned) until each was clicked — clicking calls focusWin, which
          // forces a re-render. Re-create the window object refs once the desktop
          // has mounted so every window subtree re-renders and settles on its
          // own, instead of the user having to click each one.
          setTimeout(() => setWins(ws => ws.map(w => ({ ...w }))), 160);
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
    setUser(null);setUid(null);setData(null);setCustomWp(null);setCustomLogo(null);setWins([]);setMaxZ(100);setMenuOpen(false);
    setDeskCount(1);setCurDesk(0);setTaskViewOpen(false);
    Object.values(fxTimers.current).forEach(t=>clearTimeout(t)); fxTimers.current={}; setWinFx({}); launchPt.current={};
    setIconPos({});setIconDrag(null);setWidgetState(DEFAULT_WIDGET_STATE);setWidgetDrag(null);setWidgetResize(null);
    setUname("");setPass("");setAuthErr("");setMode("login");setScreen("login");
  }
 
  const fmtTime=d=>use24h?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false}):d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const fmtDate=d=>d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
  const installedApps=data?.installedApps||[];
  const catalogIcons=STORE_CATALOG.filter(a=>installedApps.includes(a.id)).map(a=>({id:"store_"+a.id,icon:a.icon,label:a.name,desc:a.desc,storeApp:a}));
  // v9.0: installed community apps render on the desktop too (only show ones
  // still publicly visible — a later-rejected/removed app drops off).
  // v9.1: also match against `legacyId` so pre-v9.1 `installedApps` entries
  // that referenced the doc's *data* id (rather than the Firestore doc id)
  // still resolve. New installs use the canonical doc id; this is the
  // backward-compat path so e.g. McDonald's keeps showing up.
  const matchesInstalled=a=>installedApps.includes(a.id)||(a.legacyId&&installedApps.includes(a.legacyId));
  const commIcons=commApps.filter(a=>isPubliclyVisible(a)&&matchesInstalled(a)).map(a=>({id:"store_"+a.id,icon:a.icon,label:a.name,desc:a.desc,storeApp:a}));
  const storeIcons=[...catalogIcons,...commIcons];
  // v11.0 Phase C — restricted-app gating. `restricted:true` apps (currently the
  // POS) are invisible in every discovery surface unless the signed-in user is a
  // moderator (NovaMod) OR their username is on the POS allowlist NovaMod manages
  // from inside the app. visibleApps drives the launcher/Spotlight/command bar;
  // metadata lookups elsewhere still use the full APPS so an already-open
  // restricted window keeps its icon/label.
  const posAccess = isAdmin(user) || posGrants.includes((user||"").toLowerCase());
  posAccessRef.current = posAccess;
  const appAllowed = (a)=> !a.restricted || (a.id==="pos" ? posAccess : false);
  const visibleApps = APPS.filter(appAllowed);
  // allApps = every app launcher entry that should appear in the start menu —
  // always the full list (minus restricted apps the user can't see).
  const allApps=[...visibleApps,...storeIcons];
  // v7.7 — Desktop pinning (blacklist model). Users can hide apps from the
  // desktop via right-click; they're still launchable from the start menu and
  // taskbar. Default is empty array → every app shows on the desktop, so
  // existing users see no change to their workspace.
  const hiddenFromDesktop=data?.hiddenFromDesktop||[];
  const hiddenSet=new Set(hiddenFromDesktop);
  // v11.0 Phase B — whitelist desktop model. `desktopApps` is the ordered set of
  // apps shown on the desktop (Windows-style: nothing unless added). Pre-11.0
  // accounts have no `desktopApps` yet, so we derive the SAME set the old
  // blacklist produced (all apps minus hidden) until they're migrated on first
  // add/remove or via the setup wizard — so existing desktops are unchanged.
  const desktopApps = Array.isArray(data?.desktopApps)
    ? data.desktopApps
    : allApps.filter(a=>!hiddenSet.has(a.id)).map(a=>a.id);
  const desktopSet = new Set(desktopApps);
  // v11.0 Phase B — desktop app folders. `settings.desktopFolders` maps a folder
  // id -> { name, apps:[appId,...] }. The desktop grid renders un-foldered
  // whitelisted apps PLUS one tile per folder. Each grid item is an "entry" with
  // a stable `.id` for the positioning grid: an app id, or "folder:"+fid.
  const desktopFolders = data?.settings?.desktopFolders || {};
  const inFolder = new Set();
  Object.values(desktopFolders).forEach(f => (f?.apps||[]).forEach(id => inFolder.add(id)));
  const appById = (id) => allApps.find(a => a.id === id);
  const folderEntries = Object.keys(desktopFolders)
    .filter(fid => (desktopFolders[fid]?.apps||[]).some(id => appById(id)))
    .map(fid => ({ id:"folder:"+fid, fid, folder:desktopFolders[fid] }));
  const appEntries = allApps.filter(a => desktopSet.has(a.id) && !inFolder.has(a.id)).map(a => ({ id:a.id, app:a }));
  const desktopEntries = [...appEntries, ...folderEntries];
  // Folder ops — persist to settings.desktopFolders. createDesktopFolder returns
  // the new id; removeFromDesktopFolder auto-dissolves a folder when it empties.
  const newFolderId = () => "df"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
  function createDesktopFolder(appIds){ const fid=newFolderId(); updateData(p=>({...p,settings:{...(p.settings||{}),desktopFolders:{...(p.settings?.desktopFolders||{}),[fid]:{name:"Folder",apps:appIds}}}})); return fid; }
  function addToDesktopFolder(fid,appId){ updateData(p=>{const fs=p.settings?.desktopFolders||{};const f=fs[fid];if(!f||(f.apps||[]).includes(appId))return p;return {...p,settings:{...(p.settings||{}),desktopFolders:{...fs,[fid]:{...f,apps:[...(f.apps||[]),appId]}}}};}); }
  function removeFromDesktopFolder(fid,appId){ updateData(p=>{const fs={...(p.settings?.desktopFolders||{})};const f=fs[fid];if(!f)return p;const apps=(f.apps||[]).filter(id=>id!==appId);if(apps.length===0)delete fs[fid];else fs[fid]={...f,apps};return {...p,settings:{...(p.settings||{}),desktopFolders:fs}};}); }
  function renameDesktopFolder(fid,name){ updateData(p=>{const fs=p.settings?.desktopFolders||{};const f=fs[fid];if(!f)return p;return {...p,settings:{...(p.settings||{}),desktopFolders:{...fs,[fid]:{...f,name:(name||"Folder").slice(0,40)}}}};}); }
  // v10.0 — for the native-webview browser: it's "active" (so its webview may
  // show) only when it's the focused top window on the current desktop and no
  // OS overlay is covering it. Any overlay forces the webview to hide so it
  // can't paint over menus/Spotlight/Task View.
  const overlayCoveringWin = menuOpen || spotlightOpen || commandOpen || taskViewOpen || notifsOpen || screensaver || !!severeAlert;
  const focusedWinId = (()=>{ let id=null,z=-Infinity; for(const w of wins){ if((w.desk||0)!==curDesk||w.state==="minimized") continue; if((w.z||0)>=z){ z=w.z||0; id=w.id; } } return id; })();

  // v9.7 B1 — Windows-style drag-select marquee. Starts on a left-drag over
  // the empty-desktop surface; while dragging we intersect the box with each
  // icon's hit-rect and highlight the ones inside. A plain click (no drag)
  // clears the selection. Coordinates are desktop-local (the desktop root
  // sits at the viewport origin, but we measure against the surface rect to
  // be safe).
  function startMarquee(e){
    if(e.button!==0)return;
    const surface=e.currentTarget;
    const rect=surface.getBoundingClientRect();
    const positions=layoutIcons(desktopEntries,iconPosRef.current);
    const x0=e.clientX-rect.left, y0=e.clientY-rect.top;
    let moved=false;
    setSelectedIcons(new Set());      // clear on press; re-fill as we drag
    function mv(ev){
      const x1=ev.clientX-rect.left, y1=ev.clientY-rect.top;
      if(!moved && (Math.abs(x1-x0)>4||Math.abs(y1-y0)>4)) moved=true;
      if(!moved) return;
      const box={x:Math.min(x0,x1),y:Math.min(y0,y1),w:Math.abs(x1-x0),h:Math.abs(y1-y0)};
      setMarquee(box);
      const hit=new Set();
      desktopEntries.forEach(it=>{
        const p=positions[it.id]; if(!p)return;
        // icon hit-rect ≈ ICON_W × ICON_H at its grid position
        const ix=p.x, iy=p.y, iw=ICON_W, ih=ICON_H;
        if(box.x<ix+iw && box.x+box.w>ix && box.y<iy+ih && box.y+box.h>iy) hit.add(it.id);
      });
      setSelectedIcons(hit);
    }
    function up(){
      window.removeEventListener("pointermove",mv);
      window.removeEventListener("pointerup",up);
      setMarquee(null);   // box disappears; selection highlight persists
    }
    window.addEventListener("pointermove",mv);
    window.addEventListener("pointerup",up);
  }

  // v11.0 Phase B — add/remove operate on the `desktopApps` whitelist. The first
  // call on a pre-11.0 account persists the current visible set, migrating it off
  // the old blacklist without changing what's shown.
  const effectiveDesktopApps=(p)=>Array.isArray(p.desktopApps)
    ? p.desktopApps
    : allApps.filter(a=>!new Set(p.hiddenFromDesktop||[]).has(a.id)).map(a=>a.id);
  function hideAppFromDesktop(appId){
    if(!desktopSet.has(appId))return;
    updateData(p=>({...p,desktopApps:effectiveDesktopApps(p).filter(id=>id!==appId)}));
    showToast("Removed from desktop");
  }
  function addAppToDesktop(appId){
    if(desktopSet.has(appId))return;
    updateData(p=>{const cur=effectiveDesktopApps(p);return cur.includes(appId)?p:{...p,desktopApps:[...cur,appId]};});
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
    // v9.0: Windows-style boot — centered Nova logo + brand + spinner. The boot
    // sequence still runs underneath (drives the timed transition to login);
    // we just no longer render the terminal log lines.
    <div style={{width:"100%",height:"100vh",background:"#07080f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      {/* Ambient backdrop glow */}
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:620,height:620,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.16) 0%,rgba(99,102,241,0.06) 35%,transparent 65%)",filter:"blur(50px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{animation:"nova-breathe 3.6s ease-in-out infinite",filter:"drop-shadow(0 8px 32px rgba(99,102,241,0.45))"}}><NovaLogo size={96}/></div>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:22,letterSpacing:3,color:"#fff",marginTop:22}}>NOVA OS</div>
        <div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:4,marginTop:4,fontWeight:500}}>v{NOVA_VERSION}</div>
        {/* Windows-style loading spinner */}
        <div style={{width:30,height:30,marginTop:46,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.12)",borderTopColor:"#a8c5ff",animation:"spin 0.8s linear infinite"}}/>
      </div>
      {MobileNotice}
    </div>
  );
 
  // ── LOGIN ────────────────────────────────────────────────────────────────
  // v7.0: refreshed card with multi-layer shadow, shimmering accent rule,
  // floating ambient orbs behind the mesh backdrop. More confident typography
  // and inner highlight border to lift the card off the background.
  if(screen==="login")return(
    // v10.0: macOS-lock-screen style — blurred Supernova wallpaper (the
    // edition signature), a large clock up top, and a minimal frosted sign-in
    // column with subtle input bars.
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <SupernovaBg/>
      {/* Frosted blur over the wallpaper */}
      <div style={{position:"absolute",inset:0,backdropFilter:"blur(30px) saturate(1.1)",WebkitBackdropFilter:"blur(30px) saturate(1.1)",background:"rgba(8,10,22,0.34)"}}/>
      {/* Clock — top center, like the macOS lock screen */}
      <div style={{position:"absolute",top:"8%",left:0,right:0,textAlign:"center",zIndex:1,pointerEvents:"none"}}>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:"clamp(54px,11vw,104px)",color:"rgba(255,255,255,0.97)",letterSpacing:1,lineHeight:1,textShadow:"0 4px 44px rgba(0,0,0,0.45)"}}>{fmtTime(tick)}</div>
        <div style={{fontFamily:FF,fontSize:"clamp(13px,2.4vw,19px)",color:"rgba(255,255,255,0.68)",marginTop:12,letterSpacing:0.5}}>{fmtDate(tick)}</div>
      </div>
      {/* Sign-in column */}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>
        <div style={{width:320,maxWidth:"calc(100vw - 32px)",marginTop:"13vh",display:"flex",flexDirection:"column",alignItems:"center",animation:"win-in 0.5s cubic-bezier(0.16,1,0.3,1)"}}>
          <div style={{filter:"drop-shadow(0 6px 22px rgba(99,102,241,0.4))"}}><NovaLogo size={54}/></div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:19,color:"#fff",letterSpacing:1.5,marginTop:12}}>Nova OS</div>
          <div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.42)",letterSpacing:1,marginTop:2,marginBottom:22}}>v{NOVA_VERSION}</div>
          <div style={{display:"flex",gap:20,marginBottom:18}}>
            {["login","register"].map(m => (
              <button key={m} className="lt" onClick={()=>{setMode(m);setAuthErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,letterSpacing:0.8,padding:"2px 2px 5px",color:mode===m?"#fff":"rgba(255,255,255,0.42)",borderBottom:mode===m?"2px solid #fff":"2px solid transparent",transition:"color 0.18s"}}>
                {m==="login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>
          <input value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} autoFocus placeholder="Username"
            style={{width:"100%",padding:"12px 16px",marginBottom:10,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:12,color:"#fff",fontFamily:FF,fontSize:14,outline:"none",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}/>
          <input value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} type="password" placeholder="Password"
            style={{width:"100%",padding:"12px 16px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:12,color:"#fff",fontFamily:FF,fontSize:14,outline:"none",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}/>
          <button className="ls" disabled={busy} onClick={handleAuth} style={{width:"100%",padding:"12px",marginTop:16,background:"rgba(255,255,255,0.92)",border:"none",borderRadius:12,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13.5,letterSpacing:0.5,color:"#111",boxShadow:"0 8px 24px rgba(0,0,0,0.3)",transition:"opacity 0.18s"}}>{busy?"Signing in…":mode==="login"?"Sign in":"Create account"}</button>
          {authErr && <div style={{color:"#ffb4b4",fontFamily:FF,fontSize:12.5,textAlign:"center",marginTop:14,padding:"8px 12px",background:"rgba(255,80,80,0.14)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:10,backdropFilter:"blur(8px)"}}>⚠ {authErr}</div>}
          <div style={{marginTop:20,fontFamily:FF,fontSize:10.5,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>Your account syncs across devices.</div>
        </div>
      </div>
      {MobileNotice}
    </div>
  );
 
  // ── DESKTOP ──────────────────────────────────────────────────────────────
  // Mobile edition — phones get a wholly separate iOS-style shell instead of
  // the desktop windowing UI (springboard, dock, Control Center, App Library).
  if(deviceMode==="mobile"){
    return (
      <>
        <style>{CSS}</style>
        <MobileShell
          AC={AC} user={user} data={data} apps={allApps}
          wallpaperId={wpId} customWp={customWp}
          settings={settings} updateSettings={updateSettings}
          renderApp={(id)=>renderAppContent(id, true)}
          widgets={renderMobileWidgets()}
          notifications={notifications}
          onDismissNotification={dismissNotification}
          onClearNotifications={clearAllNotifications}
          onAppOpen={markAppNotificationsRead}
          onLogout={logout}
        />
      </>
    );
  }

  return(
    <div data-drop="wallpaper" style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",cursor:dragCursor,fontSize:largeFnt?15:13}}
      onContextMenu={e=>{
        // Only fire if the click is on the desktop itself, not on a child
        // (icons + windows have their own onContextMenu that stopPropagation).
        if(e.target !== e.currentTarget && !e.target.classList?.contains("di-empty-space")) return;
        const mx=e.clientX, my=e.clientY;
        openContextMenu(e, [
          {icon:"📝", label:"New sticky note", onClick:()=>addStickyNote(mx,my)},
          {icon:"🗔", label:"Window layouts…", onClick:()=>setWorkspacesOpen(true)},
          {icon:"⚙", label:"Open Settings", onClick:()=>openApp("settings")},
          {icon:"🎨", label:"Change wallpaper", onClick:()=>{openApp("settings");}},
          {type:"divider"},
          {icon:"🔔", label:"Notifications"+(unreadCount>0?" ("+unreadCount+" unread)":""), onClick:()=>setNotifsOpen(true)},
          {icon:"➕", label:"Open app menu", onClick:()=>{setMenuOpen(true);setMenuSrch("");}},
        ]);
      }}>
      <style>{CSS}</style>
      <Wallpaper id={wpId} customUrl={customWp} animate={!!settings.wallpaperAnimated}/>
      {/* v9.7 B2 — empty-desktop surface. Sits above the wallpaper (which
          covers the root and would otherwise swallow clicks) but below the
          icons (zIndex 2), so it reliably catches empty-space pointerdowns
          for the drag-select marquee. The `di-empty-space` class lets the
          root's onContextMenu allow right-click here (wallpaper menu). */}
      <div className="di-empty-space"
        style={{position:"absolute",inset:0,zIndex:1}}
        onPointerDown={e=>{ if(e.button!==0)return; if(selectedIcons.size) setSelectedIcons(new Set()); startMarquee(e); }}
      />
      {/* v9.7 B1 — drag-select marquee box */}
      {marquee && (
        <div style={{position:"absolute",left:marquee.x,top:marquee.y,width:marquee.w,height:marquee.h,zIndex:3,pointerEvents:"none",background:"rgba("+hexRgb(AC)+",0.14)",border:"1px solid rgba("+hexRgb(AC)+",0.7)",borderRadius:2}}/>
      )}
      {/* v8.5 snap-layout preview ghost — shows where a dragged window will land */}
      {snap && drag && drag.type==="move" && (()=>{ const r=snapZoneRect(snap); if(!r) return null; return (
        <div style={{position:"fixed",left:r.x,top:r.y,width:r.width,height:r.height,borderRadius:12,background:fill(AC),border:"2px solid "+AC,boxShadow:"0 10px 40px rgba(0,0,0,0.35)",pointerEvents:"none",zIndex:9990,transition:"left 0.12s ease,top 0.12s ease,width 0.12s ease,height 0.12s ease"}}/>
      ); })()}
      {/* v8.6 AFK screensaver — blurred desktop + large clock. Any input wakes
          it (handled by the global activity listeners); the onPointerDown here
          is just an immediate belt-and-suspenders dismiss. */}
      {screensaver && (
        <div onPointerDown={()=>{ssActiveRef.current=false;setScreensaver(false);}} style={{
          position:"fixed",inset:0,zIndex:100000,
          background:"rgba(6,7,16,0.88)",
          backdropFilter:"blur(34px) saturate(115%)",WebkitBackdropFilter:"blur(34px) saturate(115%)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          cursor:"none",userSelect:"none",animation:"ss-fade 0.7s ease both",
        }}>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:"min(19vw,148px)",color:"rgba(255,255,255,0.96)",letterSpacing:1,lineHeight:1,textShadow:"0 6px 50px rgba(0,0,0,0.55)"}}>{fmtTime(tick)}</div>
          <div style={{fontFamily:FF,fontSize:"min(4.2vw,24px)",color:"rgba(255,255,255,0.62)",marginTop:18,letterSpacing:1}}>{fmtDate(tick)}</div>
          <div style={{fontFamily:FFM,fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:44,letterSpacing:1}}>move the mouse or press any key to wake</div>
        </div>
      )}
      {/* v9.4 — Spotlight (Ctrl/Cmd+K). Floats above everything except
          the severe-weather alert. Closes on backdrop click, Esc, or
          after picking a result. */}
      {spotlightOpen && (
        <Spotlight
          AC={AC}
          data={data}
          apps={visibleApps}
          storeCatalog={STORE_CATALOG}
          commApps={commApps}
          isPubliclyVisible={isPubliclyVisible}
          openApp={openApp}
          openExternalUrl={openExternalUrl}
          openSettingsSection={(id) => { setSettingsSection(id); openApp("settings"); }}
          onClose={() => setSpotlightOpen(false)}
        />
      )}
      {/* v10.0 Supernova — AI command bar (Cmd/Ctrl+J). Natural language
          → OS actions, powered by the same BYOK Nova AI key. */}
      {commandOpen && (
        <CommandBar
          AC={AC}
          context={{
            appIds: visibleApps.map(a => a.id),
            appLabels: Object.fromEntries(visibleApps.map(a => [a.id, a.label])),
            wallpaperIds: Object.keys(WALLPAPERS),
            accents: ACCENT_PRESETS,
          }}
          onExecute={runCommand}
          onOpenNovaAi={() => openApp("novaai")}
          onClose={() => setCommandOpen(false)}
        />
      )}
      {/* v10.0 Supernova — Task View overlay (virtual desktops). */}
      {taskViewOpen && (
        <TaskView
          AC={AC}
          deskCount={deskCount}
          curDesk={curDesk}
          wins={wins}
          apps={APPS}
          onSwitch={(idx)=>setCurDesk(idx)}
          onAdd={addDesktop}
          onRemove={removeDesktop}
          onMoveWin={moveWinToDesk}
          onFocusWin={(id)=>{ const w=(winsRef.current||[]).find(x=>x.id===id); if(w&&w.state==="minimized") restoreWin(id); else focusWin(id); }}
          onClose={()=>setTaskViewOpen(false)}
        />
      )}
      {/* v9.4 — Atmos severe-weather lock-screen alert. Fires above
          everything when a Severe/Extreme NWS alert reaches the pinned
          location. The new three-pulse 607 Hz sawtooth tone has already
          played from Atmos itself; this is the visual half. Dismissable
          via the Dismiss button (also click-anywhere on the backdrop). */}
      {severeAlert && (
        <div onClick={(e)=>{ if(e.target===e.currentTarget) setSevereAlert(null); }} style={{
          position:"fixed",inset:0,zIndex:100002,
          background:"rgba(80,18,18,0.55)",
          backdropFilter:"blur(28px) saturate(140%)",WebkitBackdropFilter:"blur(28px) saturate(140%)",
          display:"flex",alignItems:"center",justifyContent:"center",
          padding:24,userSelect:"none",animation:"ss-fade 0.4s ease both",
        }}>
          <div style={{
            width:"min(620px, 100%)",maxHeight:"90vh",overflow:"auto",
            background:"linear-gradient(180deg, rgba(40,8,12,0.96), rgba(28,5,10,0.96))",
            border:"2px solid rgba(255,90,90,0.55)",
            borderRadius:18,
            padding:"28px 30px 24px",
            boxShadow:"0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(255,90,90,0.18)",
            fontFamily:FF,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
              <div style={{
                width:60,height:60,borderRadius:14,flexShrink:0,
                background:"rgba(255,90,90,0.18)",
                border:"2px solid rgba(255,90,90,0.55)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:30,
              }}>⚠</div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontFamily:FFB,fontWeight:800,fontSize:10.5,letterSpacing:2,color:"#ff8b8b",textTransform:"uppercase",marginBottom:4}}>
                  {severeAlert.severity === "Extreme" ? "Extreme weather alert" : "Severe weather alert"}
                </div>
                <div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:"#fff",lineHeight:1.15}}>
                  {severeAlert.event || "Weather alert"}
                </div>
                {severeAlert.locationLabel && (
                  <div style={{fontSize:12.5,color:"rgba(255,255,255,0.6)",marginTop:4}}>{severeAlert.locationLabel}</div>
                )}
              </div>
            </div>
            {severeAlert.headline && (
              <div style={{fontFamily:FFB,fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.95)",marginBottom:10,lineHeight:1.5}}>
                {severeAlert.headline}
              </div>
            )}
            {severeAlert.description && (
              <div style={{fontSize:12.5,color:"rgba(255,255,255,0.72)",lineHeight:1.65,marginBottom:18,maxHeight:200,overflow:"auto",whiteSpace:"pre-wrap"}}>
                {severeAlert.description.slice(0, 800)}{severeAlert.description.length > 800 ? "…" : ""}
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,fontSize:10.5,color:"rgba(255,255,255,0.4)",fontFamily:FFM,letterSpacing:0.5}}>
                Source · NWS · National Weather Service
              </div>
              <button onClick={()=>setSevereAlert(null)} style={{padding:"10px 22px",borderRadius:10,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,background:"rgba(255,255,255,0.92)",border:"none",color:"#3a0a0a"}}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
      {/* v8.6 drag-and-drop ghost — floats under the pointer while dragging a
          photo. Drop on the desktop = wallpaper, on a Profile window = avatar. */}
      {dnd && dnd.type==="photo" && (
        <img src={dnd.url} alt="" style={{position:"fixed",left:(dnd.x||0)+14,top:(dnd.y||0)+14,width:84,height:84,objectFit:"cover",borderRadius:10,border:"2px solid "+AC,boxShadow:"0 12px 40px rgba(0,0,0,0.55)",pointerEvents:"none",zIndex:100001,opacity:0.92,transform:"rotate(3deg)"}}/>
      )}
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
            {id==="pomodoro" &&<PomodoroWidgetContent state={s} AC={AC}/>}
          </WidgetShell>
        );
      })}

      {/* v11.0 Phase B — desktop sticky notes */}
      <StickyNotes notes={data?.stickyNotes||[]} onUpdate={updateStickyNote} onRemove={removeStickyNote}/>

      {/* Desktop icons */}
      {/* v9.3 (#21): compute one coherent layout for the whole desktop per
          render. Saved positions are honored when in-bounds; the rest pack
          into the next free grid slot — no more "icons dance + leave gaps"
          when the window resizes. `viewport.w/h` are referenced inside the
          IIFE so the React renderer treats this expression as depending on
          the viewport state and recomputes on resize. */}
      {(() => { const positions = layoutIcons(desktopEntries, iconPos);
                void viewport.w; void viewport.h;
                const lightT=theme==="light";
                return desktopEntries.map((entry, idx) => {
        const pos = positions[entry.id] || { x: 0, y: 0 };
        const isDrg=iconDrag?.id===entry.id;
        const inGroupDrag=!!(iconDrag&&iconDrag.group&&iconDrag.group.length>1&&iconDrag.group.includes(entry.id));
        const isSel=selectedIcons.has(entry.id);
        const isMergeTarget=mergeTarget===entry.id&&iconDrag&&iconDrag.id!==entry.id;   // v11.0 drag-to-merge drop target
        // Shared container (both app icons and folders): icons FLOAT on the
        // wallpaper (no resting box — that read like an app-drawer grid) with a
        // subtle highlight only on hover (.di) / selection / drag.
        const wrap={
          position:"absolute",left:pos.x,top:pos.y,width:ICON_W,height:ICON_H,
          zIndex:(isDrg||inGroupDrag)?500:2,cursor:(isDrg||inGroupDrag)?"grabbing":"grab",userSelect:"none",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,
          padding:"6px 4px",borderRadius:13,
          background:isDrg?"rgba(20,22,40,0.5)":isSel?"rgba("+hexRgb(AC)+",0.22)":"transparent",
          border:"1px solid "+(isDrg?"rgba(255,255,255,0.16)":isSel?"rgba("+hexRgb(AC)+",0.6)":"transparent"),
          backdropFilter:(isDrg||isSel)?"blur(8px)":"none",
          WebkitBackdropFilter:(isDrg||isSel)?"blur(8px)":"none",
          transition:(isDrg||inGroupDrag)?"none":"background 0.22s var(--nv-ease), border-color 0.22s var(--nv-ease), left 0.28s var(--nv-ease), top 0.28s var(--nv-ease), transform 0.2s cubic-bezier(0.22,1,0.36,1)",
          boxShadow:isDrg?"0 10px 30px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset":"none",
          ...(iconsRevealed?{}:{animation:"icon-pop 0.44s cubic-bezier(0.16,1,0.3,1) both",animationDelay:(Math.min(idx,16)*0.03)+"s"}),
          // v11.0 drag-to-merge — highlight + pop the tile being hovered as a folder target
          ...(isMergeTarget?{background:"rgba("+hexRgb(AC)+",0.32)",border:"2px solid "+AC,transform:"scale(1.12)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}:{}),
        };
        const labelStyle={fontFamily:FFB,fontWeight:600,fontSize:10.5,color:lightT?"var(--nv-text-strong)":"#fff",textAlign:"center",lineHeight:1.25,textShadow:lightT?"0 1px 3px rgba(255,255,255,0.95), 0 0 10px rgba(255,255,255,0.7)":"0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)",pointerEvents:"none",letterSpacing:0.15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"};

        // ── FOLDER ENTRY ──
        if(entry.folder){
          const fapps=(entry.folder.apps||[]).map(appById).filter(Boolean);
          return(
            <div key={entry.id} style={wrap} className={isDrg?"":"di"} title={entry.folder.name||"Folder"}
              onPointerDown={e=>onIconMouseDown(e,entry.id,desktopEntries)}
              onDoubleClick={()=>setOpenDesktopFolder(entry.fid)}
              onContextMenu={e=>openContextMenu(e,[
                {icon:"▶",label:"Open folder",onClick:()=>setOpenDesktopFolder(entry.fid)},
                {type:"divider"},
                {icon:"✕",label:"Unfold (delete folder)",danger:true,onClick:()=>updateData(p=>{const fs={...(p.settings?.desktopFolders||{})};delete fs[entry.fid];return {...p,settings:{...(p.settings||{}),desktopFolders:fs}};})},
              ])}>
              <div style={{position:"relative",pointerEvents:"none",width:40,height:40,borderRadius:11,background:"var(--nv-surface)",border:"1px solid var(--nv-border)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:2,padding:4,boxSizing:"border-box",boxShadow:"0 3px 8px rgba(0,0,0,0.4)"}}>
                {fapps.slice(0,4).map(a=>(<div key={a.id} style={{display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}><AppIconDisplay app={{id:a.id,icon:a.icon}} size={14} glass={glass}/></div>))}
              </div>
              <span style={labelStyle}>{entry.folder.name||"Folder"}</span>
            </div>
          );
        }

        // ── APP ENTRY ──
        const app=entry.app;
        function launch(){if(app.storeApp){if(app.storeApp.newTab)openExternalUrl(app.storeApp.url);else openApp("browser");}else openApp(app.id);}
        return(
          <div key={app.id} style={wrap}
            className={isDrg?"":"di"} title={app.desc}
            onPointerDown={e=>onIconMouseDown(e,app.id,desktopEntries)}
            onDoubleClick={launch}
            onContextMenu={e=>openContextMenu(e, [
              {icon:"▶", label:"Open", onClick:launch},
              ...(app.storeApp ? [] : [pinnedSet.has(app.id)
                ? {icon:"📌", label:"Unpin from taskbar", onClick:()=>unpinAppFromTaskbar(app.id)}
                : {icon:"📌", label:"Pin to taskbar", onClick:()=>pinAppToTaskbar(app.id)}
              ]),
              // v11.0 Phase B — folders: move into an existing folder, or start a new one
              ...folderEntries.map(fe=>({icon:"📁", label:"Move to: "+(fe.folder.name||"Folder"), onClick:()=>addToDesktopFolder(fe.fid,app.id)})),
              {icon:"📁", label:"New folder", onClick:()=>{const fid=createDesktopFolder([app.id]);setOpenDesktopFolder(fid);}},
              {icon:"–", label:"Remove from desktop", danger:true, onClick:()=>hideAppFromDesktop(app.id)},
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
              <AppIconDisplay app={app} size={40} glass={glass}/>
              {appBadgeCounts[app.id]>0 && (
                <div style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,padding:"0 4px",borderRadius:8,background:"#ff4d4f",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 8px rgba(255,77,79,0.55), 0 1px 2px rgba(0,0,0,0.6)",border:"1.5px solid rgba(10,12,24,0.85)"}}>
                  {appBadgeCounts[app.id]>9?"9+":appBadgeCounts[app.id]}
                </div>
              )}
            </div>
            <span style={labelStyle}>{app.label}</span>
          </div>
        );
      }); })()}

      {/* Start menu — v8.0 refresh.
          Wider (420 vs 360), more breathing room around the search bar, app
          grid spaced more generously, footer user-card gains a subtle accent
          highlight. Backdrop now blurs heavier with a slight saturation boost,
          and corners are uniformly rounded on the top instead of squared at
          the left edge — the menu looks like a floating panel, not glued to
          the screen edge. */}
      {menuOpen&&(<div ref={menuRef} style={{
        position:"fixed",bottom:TASKBAR_H+8,left:8,width:420,maxHeight:"70vh",
        background:"var(--nv-surface-solid)",
        backdropFilter:"blur(40px) saturate(180%)",
        WebkitBackdropFilter:"blur(40px) saturate(180%)",
        border:"1px solid var(--nv-border)",
        borderRadius:16,
        boxShadow:"var(--nv-popover-shadow)",
        zIndex:9998,display:"flex",flexDirection:"column",
        animation:"menu-up 0.26s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        {/* Search bar — gains an accent-tinged border on focus via CSS focus-visible */}
        <div style={{padding:"18px 18px 12px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",borderRadius:11,padding:"11px 16px",transition:"border-color 0.2s, background 0.2s"}}>
            <span style={{color:"var(--nv-text-dim)",display:"flex",opacity:0.9}}><SearchGlyph size={14}/></span>
            <input value={menuSrch} onChange={e=>setMenuSrch(e.target.value)} placeholder="Search apps…" autoFocus style={{flex:1,background:"none",border:"none",outline:"none",color:"var(--nv-text-strong)",fontFamily:FF,fontSize:14}}/>
            {menuSrch&&<button onClick={()=>setMenuSrch("")} style={{background:"var(--nv-hover)",border:"none",color:"var(--nv-text-dim)",cursor:"pointer",fontSize:11,width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
          </div>
        </div>
        <div style={{padding:"0 16px 18px",flex:1,overflowY:"auto",minHeight:0}}>
          <div style={SEC}>{menuSrch?`Results for "${menuSrch}"`:"All Apps"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {filteredMenu.map(app=>{
              const isHidden=!desktopSet.has(app.id);
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
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",opacity:isHidden?0.5:1}}><AppIconDisplay app={app} size={28} glass={glass}/></div>
                <span style={{fontFamily:FF,fontWeight:600,fontSize:10.5,color:isHidden?"var(--nv-text-dim)":"var(--nv-text-strong)",textAlign:"center",lineHeight:1.3,letterSpacing:0.1}}>{app.label}</span>
              </div>
              );
            })}
            {filteredMenu.length===0&&<div style={{gridColumn:"span 4",color:"var(--nv-text-dim)",fontFamily:FF,fontStyle:"italic",fontSize:12,textAlign:"center",padding:"24px 0"}}>No apps found</div>}
          </div>
        </div>
        {/* User card — accent-tinged background for a subtle highlight,
            larger avatar pulled to match the rest of the cluster. */}
        <div style={{padding:"14px 18px",borderTop:"1px solid var(--nv-border)",display:"flex",alignItems:"center",gap:12,background:"linear-gradient(180deg, transparent, rgba(255,255,255,0.02))",flexShrink:0}}>
          <UserAvatar name={user} img={data?.avatar} ac={AC} size={38}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:FFB,fontWeight:600,fontSize:13.5,color:"var(--nv-text-strong)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{user}</div>
            <div style={{fontFamily:FFM,fontSize:10,color:"var(--nv-text-dim)",marginTop:1,letterSpacing:0.3}}>Nova OS v{NOVA_VERSION}</div>
          </div>
          {/* v8.3 F2: explicit fullscreen toggle in the start menu so users
              who don't know F11 can always get in/out of fullscreen. Since
              the taskbar auto-hides in fullscreen, the start menu (reachable
              via Cmd/Ctrl+K or the bottom-edge peek) is the discoverable
              exit point. */}
          <button onClick={()=>{setMenuOpen(false);toggleFullscreen();}} title={isFs?"Exit fullscreen (F11)":"Enter fullscreen (F11)"} style={{width:34,height:34,borderRadius:8,background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",cursor:"pointer",fontSize:13,color:"var(--nv-text)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>{isFs?"🗗":"⛶"}</button>
          <button onClick={logout} title="Sign out" style={{padding:"7px 13px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.28)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,140,140,0.95)",transition:"all 0.18s var(--nv-ease)"}}>Logout</button>
          {/* v10.7 — Quit the desktop (Tauri) app, for users who don't know about Settings → Close. */}
          {isDesktop()&&(
            <button onClick={()=>{setMenuOpen(false);playSound("logout");quitApp();}} title="Quit Nova OS" style={{padding:"7px 11px",background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"var(--nv-text-strong)",transition:"all 0.18s var(--nv-ease)",display:"flex",alignItems:"center",gap:5}}>⏻ Quit</button>
          )}
          {/* v10.5 — Shut Down (powers off the host). Only the Nova Linux Tauri
              kiosk can actually do this, so it's shown only there
              (Tauri + lite/kiosk mode); hidden on web, PWA, Android, and the
              normal windowed desktop build. */}
          {isDesktop()&&isLiteMode()&&(
            <button onClick={()=>{playSound("logout");powerOff();}} title="Shut down this machine" style={{padding:"7px 11px",background:"rgba(255,170,60,0.1)",border:"1px solid rgba(255,170,60,0.3)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,196,120,0.96)",transition:"all 0.18s var(--nv-ease)",display:"flex",alignItems:"center",gap:5}}>⏻ Shut Down</button>
          )}
        </div>
      </div>)}
 
      {/* Windows — wrapped in a sliding "desktop track" (v10.0). Each virtual
          desktop is a full-viewport-wide panel laid out left-to-right; the
          track translates horizontally to switch desktops with a smooth
          animation. pointerEvents:none on the track + panels lets empty space
          fall through to the icons / marquee surface behind; each window
          re-enables pointer events for itself. Windows stay mounted across
          desktops so app state (music, typing, games) survives a switch. */}
      <div className="nv-desk-track" style={{position:"absolute",top:0,left:0,bottom:0,width:(deskCount*100)+"vw",zIndex:5,pointerEvents:"none",transform:"translateX(-"+(curDesk*100)+"vw)",transition:"transform 0.46s cubic-bezier(0.22,1,0.36,1)"}}>
      {Array.from({length:deskCount},(_,di)=>(
      <div key={"deskpanel-"+di} className="nv-desk-panel" style={{position:"absolute",top:0,left:(di*100)+"vw",width:"100vw",bottom:0,pointerEvents:"none"}}>
      {wins.filter(w=>(w.desk||0)===di).map(win=>{
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
        // v11.0 unified chrome — the focused window sits crisp + lifted; the
        // rest recede with a softer shadow, dimmer border + muted title bar so
        // it's always obvious which window is active (real-OS depth).
        const isFocused = win.id===focusedWinId;
        const lightT = theme === "light";   // softer, blue-grey shadows in light mode
        // v11.0 — windows are ALWAYS a solid opaque body so app content stays
        // readable. (Frosted-glass windows aren't viable: windows live inside the
        // virtual-desktop track, whose CSS transform defeats backdrop-filter, so a
        // translucent window can't actually frost the wallpaper — it just bleeds
        // through. Liquid Glass instead frosts the dock/widgets, which sit at the
        // root where backdrop-filter works.)
        const winBg = lightT ? "#f6f8fc" : "#141620";
        const winBackdrop = "none";
        const winShadow = isDrg
          ? (lightT
            ? "0 12px 24px rgba(30,41,59,0.16), 0 36px 80px rgba(30,41,59,0.2), 0 1px 0 rgba(255,255,255,0.6) inset"
            : "0 14px 28px rgba(0,0,0,0.45), 0 40px 100px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.1) inset")
          : isFocused
          ? (lightT
            ? "0 3px 8px rgba(30,41,59,0.1), 0 16px 44px rgba(30,41,59,0.15), 0 1px 0 rgba(255,255,255,0.6) inset"
            : "0 4px 8px rgba(0,0,0,0.25), 0 18px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset")
          : (lightT
            ? "0 2px 6px rgba(30,41,59,0.07), 0 10px 28px rgba(30,41,59,0.1), 0 1px 0 rgba(255,255,255,0.5) inset"
            : "0 2px 6px rgba(0,0,0,0.16), 0 10px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05) inset");
        // v10.0: maximized windows are position:absolute (not fixed) so they
        // stay confined to their virtual-desktop panel — a fixed element would
        // anchor to the transformed track and span every desktop at once.
        // While this window is being dragged/resized, take its geometry from the
        // live ref (set imperatively each pointermove) so an incidental re-render
        // doesn't snap it back to the stale state position.
        const dg = isDrg && dragGeomRef.current ? dragGeomRef.current : null;
        const gx = dg ? dg.x : win.x, gy = dg ? dg.y : win.y;
        const gw = (dg && dg.width != null) ? dg.width : win.width, gh = (dg && dg.height != null) ? dg.height : win.height;
        const winStyle=isMax?{position:"absolute",top:0,left:0,width:"100vw",bottom:TASKBAR_H+"px",zIndex:win.z,borderRadius:0}:{position:"absolute",left:gx,top:gy,width:gw,height:gh,zIndex:win.z,borderRadius:winRadius};
        const minimizedStyle=isMin?{display:"none"}:{};
        // v10.0 — fx-driven open/close/minimize/restore animation. A settled
        // window has no animation (so it never re-plays on re-render); the
        // transient flag picks the keyframe. min/restore collapse toward the
        // taskbar (transform-origin bottom).
        const fx=winFx[win.id];
        // Launch-from-click: if we recorded where this window was opened, zoom
        // it out of that point (transform-origin = click position relative to
        // the window box, clamped inside it).
        const lp = fx==="entering" ? launchPt.current[win.id] : null;
        let fxOrigin = (fx==="minimizing"||fx==="restoring") ? "50% 100%" : "50% 50%";
        let enterAnim = "win-in 0.28s cubic-bezier(0.16,1,0.3,1)";
        if(lp){
          const wL=isMax?0:win.x, wT=isMax?0:win.y;
          const wW=isMax?window.innerWidth:win.width, wH=isMax?(window.innerHeight-TASKBAR_H):win.height;
          const ox=Math.max(0,Math.min(wW, lp.x-wL)), oy=Math.max(0,Math.min(wH, lp.y-wT));
          fxOrigin = ox+"px "+oy+"px";
          enterAnim = "win-launch 0.3s cubic-bezier(0.16,1,0.3,1)";
        }
        const winAnim = fx==="closing"    ? "win-out 0.19s cubic-bezier(0.4,0,1,1) forwards"
                      : fx==="minimizing" ? "win-min 0.19s cubic-bezier(0.4,0,1,1) forwards"
                      : fx==="restoring"  ? "win-restore 0.3s cubic-bezier(0.22,1,0.36,1)"
                      : fx==="entering"   ? enterAnim
                      : "none";
        const fxBusy = fx==="closing"||fx==="minimizing";
        return(
          <div key={win.id} data-win="1" data-win-id={win.id} data-drop={win.app==="profile"?"avatar":"none"} onClick={()=>focusWin(win.id)} style={{...winStyle,...minimizedStyle,pointerEvents:fxBusy?"none":"auto",transformOrigin:fxOrigin,background:winBg,border:"1px solid "+(isFocused?"var(--nv-border-strong)":"var(--nv-border)"),boxShadow:winShadow,display:isMin?"none":"flex",flexDirection:"column",animation:winAnim,backdropFilter:winBackdrop,WebkitBackdropFilter:winBackdrop,transition:isDrg?"box-shadow 0.18s var(--nv-ease)":"box-shadow 0.22s var(--nv-ease), left 0.28s var(--nv-ease), top 0.28s var(--nv-ease), width 0.28s var(--nv-ease), height 0.28s var(--nv-ease)",overflow:"hidden"}}>
            {!isMax&&<ResizeHandles winId={win.id} onStartResize={startResize} touchy={touchy}/>}
            {/* v8.3 F1: title bar is now draggable even when maximized —
                dragging restores the window and tears it off (Windows-style),
                so the cursor is always grab/grabbing rather than default. */}
            <div onPointerDown={e=>startDrag(e,win.id)} style={{height:40,display:"flex",alignItems:"center",padding:"0 6px 0 14px",gap:10,background:isFocused?"linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)":"linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)",borderBottom:"1px solid var(--nv-border)",borderRadius:isMax?"0":winRadius+"px "+winRadius+"px 0 0",cursor:isDrg?"grabbing":"grab",userSelect:"none",flexShrink:0,touchAction:"none",transition:"background 0.18s"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",opacity:isFocused?1:0.55,transition:"opacity 0.18s"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={18} glass={glass}/></div>
              <span style={{flex:1,fontFamily:FFB,fontWeight:600,fontSize:13,color:isFocused?"var(--nv-text-strong)":"var(--nv-text-dim)",letterSpacing:0.2,transition:"color 0.18s"}}>{app?.label}</span>
              {/* v8.0 round 3 — proper SVG window controls. Unicode glyphs
                  rendered inconsistently across platforms and weren't pixel-
                  aligned within their hit boxes. Now stroke-based icons that
                  inherit the button color via currentColor. */}
              <div style={{display:"flex",alignItems:"center",gap:2,padding:2,borderRadius:9}}>
                <button className="wn" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimizeWin(win.id);}} title="Minimize" style={{width:28,height:28,borderRadius:7,background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:isFocused?"var(--nv-text)":"var(--nv-text-dim)",flexShrink:0,padding:0}}>
                  <WindowControlIcon type="minimize" size={11}/>
                </button>
                <button className="wm" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();maximizeWin(win.id);}} title={isMax?"Restore":"Maximize"} style={{width:28,height:28,borderRadius:7,background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:isFocused?"var(--nv-text)":"var(--nv-text-dim)",flexShrink:0,padding:0}}>
                  <WindowControlIcon type={isMax?"restore":"maximize"} size={11}/>
                </button>
                <button className="wx" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();closeWin(win.id);}} title="Close" style={{width:28,height:28,borderRadius:7,background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:isFocused?"var(--nv-text)":"var(--nv-text-dim)",flexShrink:0,padding:0}}>
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
              {/* App content — see renderAppContent (shared with the mobile
                  shell). Per-window Suspense means opening one app doesn't
                  blank out an already-loaded window. */}
              {renderAppContent(win.app, !overlayCoveringWin && win.id===focusedWinId && win.state!=="minimized" && (win.desk||0)===curDesk)}
            </div>
          </div>
        );
      })}
      </div>
      ))}
      </div>

      {/* v10.0 — desktop pager dots, bottom-center above the taskbar. The
          "slider" stays on the base desktop; the prev/next arrow bars live in
          Task View (the overview), not on the live desktop. */}
      {deskCount>1 && (
        <div style={{position:"fixed",left:"50%",bottom:TASKBAR_H+14,transform:"translateX(-50%)",zIndex:9996,display:"flex",gap:8,padding:"7px 12px",borderRadius:20,background:"rgba(16,18,28,0.42)",border:"1px solid rgba(255,255,255,0.12)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",boxShadow:"0 8px 26px rgba(0,0,0,0.4)"}}>
          {Array.from({length:deskCount},(_,di)=>(
            <button key={"dot-"+di} onClick={()=>setCurDesk(di)} title={"Desktop "+(di+1)} style={{width:di===curDesk?22:9,height:9,borderRadius:5,border:"none",cursor:"pointer",padding:0,background:di===curDesk?AC:"rgba(255,255,255,0.32)",transition:"width 0.25s cubic-bezier(0.22,1,0.36,1), background 0.2s"}}/>
          ))}
        </div>
      )}

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
        // v9.0: with no custom color, the taskbar uses the theme glass surface
        // token so it flips light/dark. A user-picked color still wins.
        const tbBg=tbColor
          ?"linear-gradient(180deg, rgba("+hexRgb(tbColor)+",0.78) 0%, rgba("+hexRgb(tbColor)+",0.86) 100%)"
          :"var(--nv-surface)";   // v11.0 light mode: theme glass surface so the dock flips light/dark with the OS theme
        // The Nova taskbar is always visible — including in fullscreen.
        //
        // v9.0 — floating glass dock. Detached from the screen edge (8px inset
        // on the sides + bottom), fully rounded, with a soft drop shadow so it
        // reads as a Liquid-Glass island. The background uses the theme glass
        // surface token (var(--nv-surface)), so it stays a solid-ish dark bar
        // in dark mode when Liquid Glass is OFF and goes translucent when it's
        // ON — a user-picked taskbarColor still wins. Three zones: a left
        // cluster (Start + weather), the apps absolutely centered (Windows 11
        // style), and a right system-tray cluster.
        return(
      <div data-drop="none" style={{
        position:"fixed",bottom:8,left:8,right:8,height:TASKBAR_H-12,
        background:tbBg,
        backdropFilter:"blur(var(--nv-glass-blur)) saturate(160%)",
        WebkitBackdropFilter:"blur(var(--nv-glass-blur)) saturate(160%)",
        border:"1px solid var(--nv-border)",
        borderRadius:18,
        boxShadow:"0 1px 0 rgba(255,255,255,0.07) inset, 0 14px 44px -10px rgba(0,0,0,0.6)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 10px",gap:8,zIndex:9999,
      }}>
        {/* LEFT cluster — Start button, divider, weather pill */}
        <div style={{display:"flex",alignItems:"center",gap:8,zIndex:2,flexShrink:0}}>
        {/* v7.7: Start menu button — shows the Nova OS brand mark. The button
            lights up with the accent color when the menu is open. */}
        <button className="sb" data-start-btn onClick={()=>{setMenuOpen(o=>!o);setMenuSrch("");}} title="Nova OS" style={{
          width:46,height:46,borderRadius:12,
          background:menuOpen?fill(AC):"var(--nv-hover)",
          border:"1px solid "+(menuOpen?bdr(AC):"var(--nv-border)"),
          boxShadow:menuOpen?"0 0 16px "+fill(AC)+", 0 2px 8px rgba(0,0,0,0.3) inset":"none",
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
          transition:"all 0.2s var(--nv-ease)",
          padding:0,
        }}>
          <NovaLogo size={30}/>
        </button>
        <div style={{width:1,height:26,background:"linear-gradient(180deg, transparent, var(--nv-border-strong) 50%, transparent)",margin:"0 3px"}}/>
        {/* v9.4 — Spotlight launcher. Opens the global-search palette. */}
        {deviceMode!=="mobile" && (
          <button className="sb" onClick={()=>setSpotlightOpen(true)} title="Search (Ctrl+K)" style={{
            height:42,display:"flex",alignItems:"center",gap:8,padding:"0 14px",borderRadius:12,
            background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",
            cursor:"pointer",fontFamily:FF,fontSize:12.5,color:"var(--nv-text-dim)",
            transition:"all 0.18s var(--nv-ease)",flexShrink:0,
          }}>
            <span style={{display:"flex"}}><SearchGlyph size={15}/></span>
            <span>Search</span>
          </button>
        )}
        {/* v10.0 Supernova — Nova AI command bar launcher. Accent-tinted so it
            stands out; opens the natural-language command palette (Ctrl/Cmd+J). */}
        <button className="sb" onClick={()=>setCommandOpen(o=>!o)} title="Nova AI command bar (Ctrl+J)" style={{
          height:42,display:"flex",alignItems:"center",gap:7,padding:deviceMode==="mobile"?"0 11px":"0 13px",borderRadius:12,
          background:commandOpen?fill(AC):"var(--nv-elevated)",
          border:"1px solid "+(commandOpen?bdr(AC):"var(--nv-border)"),
          cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12.5,color:commandOpen?AC:"var(--nv-text-dim)",
          transition:"all 0.18s var(--nv-ease)",flexShrink:0,
        }}>
          <span style={{display:"flex",filter:commandOpen?"drop-shadow(0 0 8px rgba("+hexRgb(AC)+",0.5))":"none"}}><SparkGlyph size={15}/></span>
          {deviceMode!=="mobile" && <span>Ask Nova</span>}
        </button>
        {/* v10.0 Supernova — Task View launcher (virtual desktops). Shows the
            current/total desktop count; opens the Task View overview. */}
        <button className="sb" onClick={()=>setTaskViewOpen(o=>!o)} title="Task View — virtual desktops (Ctrl+Alt+↑)" style={{
          height:42,display:"flex",alignItems:"center",gap:8,padding:deviceMode==="mobile"?"0 11px":"0 13px",borderRadius:12,
          background:taskViewOpen?fill(AC):"var(--nv-elevated)",
          border:"1px solid "+(taskViewOpen?bdr(AC):"var(--nv-border)"),
          cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12.5,color:taskViewOpen?AC:"var(--nv-text-dim)",
          transition:"all 0.18s var(--nv-ease)",flexShrink:0,
        }}>
          {/* stacked-windows glyph */}
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
            <rect x="3.5" y="3.5" width="9" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5.5 13.2h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {deviceMode!=="mobile" && <span style={{fontFamily:FFM,fontSize:11.5,letterSpacing:0.3}}>{curDesk+1}/{deskCount}</span>}
        </button>
        {/* v9.0 — Windows 11-style weather pill in the bottom-left corner. */}
        {deviceMode!=="mobile" && <TaskbarWeather data={data} onClick={()=>openApp("atmos")} />}
        </div>
        {/* CENTER cluster — pinned + running apps. In-flow flex:1 between the
            left/right clusters with `safe center` + horizontal scroll, so a long
            row of apps can never overlap the other taskbar items on small
            screens — it scrolls within the available space instead. (Was
            position:absolute with a fixed width cap, which spilled over the
            clusters once they were wider than that budget.) */}
        <div className="no-sb" style={{flex:1,minWidth:0,display:"flex",alignItems:"center",justifyContent:"safe center",gap:7,overflowX:"auto",overflowY:"hidden",padding:"5px 0",zIndex:1}}>
        {/* v8.0 — Taskbar: pinned apps + running windows.
            Pinned apps with NO running windows render as compact icon-only
            "launcher" chips (40x40, no label). Pinned apps WITH running
            windows expand to full chips (icon + label + glowing accent
            underline). Running apps that aren't pinned render as before
            (one full chip per window). */}
        {(()=>{
          const slots=[];
          const seenApp=new Set();
          // v10.0: the taskbar shows only the CURRENT virtual desktop's
          // windows (Windows 11 default). Pinned launchers still show always.
          const dwins=wins.filter(w=>(w.desk||0)===curDesk);
          // Pinned slots first, in pin order. Each pinned slot represents
          // ALL running windows of that app aggregated into one chip.
          pinnedToTaskbar.forEach(appId=>{
            if(seenApp.has(appId))return;
            seenApp.add(appId);
            const running=dwins.filter(w=>w.app===appId);
            slots.push({key:"pin-"+appId,appId,running,pinned:true});
          });
          // Then any running windows that aren't in the pinned list, one
          // chip per window so multiple windows of an app show separately.
          dwins.forEach(win=>{
            if(pinnedSet.has(win.app))return;
            slots.push({key:"win-"+win.id,appId:win.app,running:[win],pinned:false});
          });
          // Determine global top-z so we can highlight the focused chip.
          const topZ=dwins.length>0?Math.max(...dwins.map(w=>w.z)):-Infinity;
          return slots.map(slot=>{
            const app=APPS.find(a=>a.id===slot.appId);
            if(!app)return null;
            const hasRunning=slot.running.length>0;
            const topWin=hasRunning?[...slot.running].sort((a,b)=>(b.z||0)-(a.z||0))[0]:null;
            const allMin=hasRunning&&slot.running.every(w=>w.state==="minimized");
            const isTop=hasRunning&&topWin.z===topZ&&!allMin;
            const isHidden=!desktopSet.has(slot.appId);

            // Click: launch if not running, focus/minimize topmost if running.
            const handleClick=()=>{
              if(!hasRunning){openApp(slot.appId);return;}
              if(allMin){
                restoreWin(topWin.id);
              }else if(isTop){
                minimizeWin(topWin.id);
              }else{
                focusWin(topWin.id);
              }
            };

            const buildMenu=()=>{
              const items=[];
              if(hasRunning){
                items.push({icon:"▶",label:allMin?"Restore":"Focus",onClick:()=>{ allMin?restoreWin(topWin.id):focusWin(topWin.id); }});
                items.push({icon:"—",label:"Minimize",onClick:()=>minimizeWin(topWin.id),disabled:allMin});
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

            // Compact pinned-only chip — icon only, fixed 46x46 square.
            if(slot.pinned&&!hasRunning){
              const badgeCount = appBadgeCounts[slot.appId] || 0;
              return(
                <button {...dragProps} key={slot.key} className="tb"
                  onClick={wrappedClick}
                  onContextMenu={e=>openContextMenu(e,buildMenu())}
                  title={app.label + (badgeCount > 0 ? " — " + badgeCount + " unread" : "")}
                  style={{
                    width:46,height:46,padding:0,
                    background:"var(--nv-elevated)",
                    border:"1px solid var(--nv-border)",
                    borderRadius:12,cursor:isDragging?"grabbing":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    transition:"all 0.18s var(--nv-ease)",
                    flexShrink:0,position:"relative",
                    ...dragStyle,
                  }}>
                  <AppIconDisplay app={{id:app.id,icon:app.icon}} size={26} glass={glass}/>
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
                  height:46,padding:"0 14px",
                  background:isTop?"var(--nv-border-strong)":"var(--nv-elevated)",
                  border:"1px solid "+(isTop?"var(--nv-border-strong)":"var(--nv-border)"),
                  borderRadius:12,cursor:isDragging?"grabbing":"pointer",
                  fontFamily:FF,fontSize:13,fontWeight:600,
                  color:allMin?"var(--nv-text-dim)":"var(--nv-text-strong)",
                  whiteSpace:"nowrap",
                  transition:"all 0.22s var(--nv-ease)",
                  display:"flex",alignItems:"center",gap:7,position:"relative",
                  flexShrink:0,
                  ...dragStyle,
                }}>
                <div style={{position:"relative",pointerEvents:"none",display:"flex",alignItems:"center"}}>
                  <AppIconDisplay app={{id:app.id,icon:app.icon}} size={22} glass={glass}/>
                  {appBadgeCounts[slot.appId]>0 && (
                    <div style={{position:"absolute",top:-5,right:-7,minWidth:13,height:13,padding:"0 3px",borderRadius:6.5,background:"#ff4d4f",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:8.5,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 5px rgba(255,77,79,0.6)"}}>
                      {appBadgeCounts[slot.appId]>9?"9+":appBadgeCounts[slot.appId]}
                    </div>
                  )}
                </div>
                {deviceMode!=="mobile"&&<span>{app.label}</span>}
                {hasRunning&&!allMin&&<div style={{position:"absolute",bottom:-1,left:"50%",transform:"translateX(-50%)",width:isTop?28:10,height:3,borderRadius:3,background:AC,boxShadow:isTop?"0 0 10px "+AC+", 0 0 4px "+AC:"none",transition:"width 0.25s var(--nv-ease), box-shadow 0.25s var(--nv-ease)"}}/>}
              </button>
            );
          });
        })()}
        </div>
        {/* RIGHT cluster — profile, system tray (notifications + settings),
            clock. Pills share a height so they sit on the same baseline. */}
        <div style={{display:"flex",alignItems:"center",gap:8,zIndex:2,flexShrink:0}}>
        {deviceMode!=="mobile"&&
          <button className="sb" onClick={()=>openApp("profile")} title="Profile" style={{
            height:44,display:"flex",alignItems:"center",gap:8,
            padding:"0 14px 0 8px",borderRadius:12,
            background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",
            cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12.5,color:AC,
            transition:"all 0.18s var(--nv-ease)",
          }}>
            <UserAvatar name={user} img={data?.avatar} ac={AC} size={24} ring={false}/>
            @{user}
          </button>
        }
        <div style={{
          height:44,display:"flex",alignItems:"center",gap:3,padding:"0 4px",
          background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",borderRadius:12,
        }}>
          {/* v9.3 (#22) — Dedicated volume button so the slider is one click
              away without opening Settings. Same flyout as the network
              button; both are at-a-glance indicators that share quick
              settings. The icon reflects the current mute state. */}
          {/* v9.3 (#22) — Dedicated volume button so the slider is one click
              away without opening Settings. Same flyout as the network
              button; both are at-a-glance indicators that share quick
              settings. The icon reflects the current mute state. */}
          {(() => {
            const muted = !soundCfg.enabled || soundCfg.volume <= 0;
            return (
              <button className="sb" onClick={()=>setQsOpen(o=>!o)} title={muted ? "Muted — click to adjust" : "Volume " + Math.round(soundCfg.volume*100) + "%"} style={{
                width:36,height:36,borderRadius:9,
                background:qsOpen?fill(AC):"transparent",
                border:qsOpen?"1px solid "+bdr(AC):"1px solid transparent",
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                color:qsOpen?AC:(muted?"var(--nv-text-dim)":"var(--nv-text)"),
                transition:"all 0.18s var(--nv-ease)",
              }}><VolumeGlyph size={17} muted={muted}/></button>
            );
          })()}
          {/* v9.0 — Network/quick-settings button. Opens the same flyout. */}
          <button className="sb" onClick={()=>setQsOpen(o=>!o)} title="Quick settings" style={{
            width:36,height:36,borderRadius:9,
            background:qsOpen?fill(AC):"transparent",
            border:qsOpen?"1px solid "+bdr(AC):"1px solid transparent",
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            color:qsOpen?AC:"var(--nv-text)",
            transition:"all 0.18s var(--nv-ease)",
          }}><WifiGlyph size={17}/></button>
          {/* Notification bell — badge shows unread count, click toggles the panel.
              v9.0: monochrome glass glyph (inherits color via currentColor). */}
          <button className="sb" onClick={()=>setNotifsOpen(o=>!o)} title={unreadCount>0?unreadCount+" unread":"Notifications"} style={{
            position:"relative",width:36,height:36,borderRadius:9,
            background:notifsOpen?fill(AC):"transparent",
            border:notifsOpen?"1px solid "+bdr(AC):"1px solid transparent",
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            color:notifsOpen?AC:"var(--nv-text)",
            transition:"all 0.18s var(--nv-ease)",
          }}>
            <BellGlyph size={17}/>
            {unreadCount>0 && <span style={{position:"absolute",top:3,right:3,minWidth:14,height:14,padding:"0 3px",borderRadius:7,background:"#ff5555",color:"#fff",fontFamily:FFB,fontWeight:700,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 0 8px rgba(255,85,85,0.5)"}}>{unreadCount>9?"9+":unreadCount}</span>}
          </button>
          <button className="sb" onClick={()=>openApp("settings")} title="Settings" style={{
            width:36,height:36,borderRadius:9,
            background:"transparent",border:"1px solid transparent",
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            color:"var(--nv-text)",
            transition:"all 0.18s var(--nv-ease)",
          }}><GearGlyph size={17}/></button>
        </div>
        <div style={{
          height:44,display:"flex",flexDirection:"column",justifyContent:"center",
          textAlign:"right",cursor:"default",
          padding:"0 14px",borderRadius:12,
          background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",
          minWidth:64,
        }}>
          <div style={{fontFamily:FFM,fontWeight:500,fontSize:13,color:"var(--nv-text-strong)",letterSpacing:0.3,lineHeight:1.1}}>{fmtTime(tick)}</div>
          {deviceMode!=="mobile"&&<div style={{fontFamily:FF,fontSize:9,color:"var(--nv-text-dim)",marginTop:1,lineHeight:1.1}}>{fmtDate(tick)}</div>}
        </div>
        </div>
      </div>
        );
      })()}
      {/* v9.0 — Quick-settings flyout (network status, Nova volume, glass). */}
      {qsOpen && (
        <QuickSettingsPanel
          AC={AC}
          glass={glass}
          onToggleGlass={()=>{const v=!glass;updateSettings({glass:v});showToast(v?"Liquid Glass on":"Liquid Glass off");}}
          onClose={()=>setQsOpen(false)}
          openSettingsSection={(id)=>{setSettingsSection(id);openApp("settings");}}
        />
      )}
      {/* Notification Center side panel — v8.0 refresh.
          Floating panel (slight margin from screen edges, full rounded
          corners) rather than glued to the right edge. Header gains an
          accent-colored bell glyph. Items get a per-kind left accent stripe
          and an unread indicator dot. */}
      {/* v10.8 — transient notification toasts (bottom-right, above the taskbar).
          Click opens the related app; ✕ or ~6s dismisses. */}
      {notifToasts.length>0 && deviceMode!=="mobile" && (
        <div style={{position:"fixed",right:14,bottom:TASKBAR_H+16,zIndex:9990,display:"flex",flexDirection:"column",gap:10,alignItems:"flex-end",pointerEvents:"none"}}>
          {notifToasts.map(t=>{
            const kc = t.kind==="alert"?"#ff8b8b":t.kind==="warning"?"#ffcc66":t.kind==="success"?"#4cef90":AC;
            const appObj = t.appId ? APPS.find(a=>a.id===t.appId) : null;
            return(
              <div key={t.id} onClick={()=>{dismissNotifToast(t.id); if(t.appId) openApp(t.appId);}}
                style={{position:"relative",pointerEvents:"auto",cursor:"pointer",width:"min(360px, calc(100vw - 28px))",display:"flex",gap:12,alignItems:"flex-start",padding:"13px 30px 13px 15px",background:"var(--nv-surface-solid)",backdropFilter:"blur(44px) saturate(180%)",WebkitBackdropFilter:"blur(44px) saturate(180%)",border:"1px solid var(--nv-border)",borderRadius:16,boxShadow:"var(--nv-popover-shadow)",animation:"panel-in-right 0.34s cubic-bezier(0.22,1,0.36,1)",overflow:"hidden"}}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:kc,boxShadow:"0 0 12px "+kc+"99"}}/>
                <div style={{flexShrink:0,width:38,height:38,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",background:fill(kc),border:"1px solid "+bdr(kc)}}>
                  {appObj ? <AppIconDisplay app={{id:appObj.id,icon:appObj.icon}} size={24} glass={glass}/> : <span style={{fontSize:18}}>🔔</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                    <div style={{flex:1,minWidth:0,fontFamily:FFB,fontWeight:700,fontSize:13,color:"var(--nv-text-strong)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                    <span style={{fontFamily:FFM,fontSize:9.5,color:"var(--nv-text-dim)",flexShrink:0}}>now</span>
                  </div>
                  {t.body && <div style={{fontSize:12,color:"var(--nv-text)",opacity:0.82,marginTop:3,lineHeight:1.42,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{t.body}</div>}
                </div>
                <button onClick={e=>{e.stopPropagation();dismissNotifToast(t.id);}} title="Dismiss" style={{position:"absolute",top:8,right:8,width:19,height:19,borderRadius:6,background:"var(--nv-elevated)",border:"none",color:"var(--nv-text-dim)",cursor:"pointer",fontSize:10,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      {notifsOpen && (
        <>
          <div onClick={()=>setNotifsOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:9997}}/>
          <div style={{
            position:"fixed",top:10,right:10,bottom:TASKBAR_H+10,width:"min(360px, calc(100vw - 20px))",
            background:"var(--nv-surface-solid)",
            backdropFilter:"blur(40px) saturate(180%)",
            WebkitBackdropFilter:"blur(40px) saturate(180%)",
            border:"1px solid var(--nv-border)",
            borderRadius:16,
            boxShadow:"var(--nv-popover-shadow)",
            zIndex:9998,display:"flex",flexDirection:"column",
            animation:"panel-in-right 0.3s cubic-bezier(0.22,1,0.36,1)",
            overflow:"hidden",
          }}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid var(--nv-border)",display:"flex",alignItems:"center",gap:10,flexShrink:0,background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)"}}>
              <span style={{fontSize:16,filter:"drop-shadow(0 0 8px "+AC+"55)"}}>🔔</span>
              <div style={{flex:1,fontFamily:FFB,fontWeight:700,fontSize:14,color:"var(--nv-text-strong)",letterSpacing:0.2}}>Notifications</div>
              {notifications.length>0 && <button onClick={clearAllNotifications} style={{padding:"5px 11px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,130,130,0.9)",letterSpacing:0.3,transition:"all 0.15s"}}>Clear all</button>}
              <button onClick={()=>setNotifsOpen(false)} title="Close" style={{width:26,height:26,borderRadius:7,background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",cursor:"pointer",color:"var(--nv-text-dim)",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all 0.15s"}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"10px"}}>
              {notifications.length===0 ? (
                <div style={{textAlign:"center",padding:"60px 24px",color:"var(--nv-text-dim)",fontFamily:FF}}>
                  <div style={{fontSize:40,opacity:0.5,marginBottom:14,filter:"drop-shadow(0 0 16px "+AC+"33)"}}>🔕</div>
                  <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"var(--nv-text-dim)",marginBottom:5}}>All caught up</div>
                  <div style={{fontSize:11,color:"var(--nv-text-dim)",lineHeight:1.55,maxWidth:240,margin:"0 auto"}}>NWS alerts and other important events will appear here when they happen.</div>
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
                    background:n.read?"var(--nv-elevated)":"linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
                    border:"1px solid "+(n.read?"var(--nv-border)":"var(--nv-border)"),
                    borderLeft:"3px solid "+(n.read?"var(--nv-border)":kindColor),
                    borderRadius:10,
                    position:"relative",
                    transition:"background 0.18s",
                  }}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <span style={{color:kindColor,fontSize:14,lineHeight:1.4,flexShrink:0,filter:n.read?"none":"drop-shadow(0 0 6px "+kindColor+"55)"}}>{kindIcon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:FFB,fontWeight:600,fontSize:12.5,color:n.read?"var(--nv-text)":"var(--nv-text-strong)",lineHeight:1.4,letterSpacing:0.1}}>{n.title}</div>
                        {n.body && <div style={{fontSize:11,color:"var(--nv-text)",marginTop:4,lineHeight:1.55,wordBreak:"break-word"}}>{n.body}</div>}
                        <div style={{fontSize:10,fontFamily:FFM,color:"var(--nv-text-dim)",marginTop:6,letterSpacing:0.2}}>{ageStr}</div>
                      </div>
                      <button onClick={()=>dismissNotification(n.id)} title="Dismiss" style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--nv-text-dim)",fontSize:11,padding:"3px 6px",lineHeight:1,flexShrink:0,borderRadius:5,transition:"background 0.15s, color 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,80,80,0.12)";e.currentTarget.style.color="rgba(255,130,130,0.9)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--nv-text-dim)";}}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {/* v11.0 Phase B — open desktop folder popover: rename inline, click an app
          to launch, right-click an app to remove it from the folder. */}
      {openDesktopFolder && desktopFolders[openDesktopFolder] && (()=>{
        const f = desktopFolders[openDesktopFolder];
        const fapps = (f.apps||[]).map(appById).filter(Boolean);
        return (
          <>
            <div onClick={()=>setOpenDesktopFolder(null)} style={{position:"fixed",inset:0,zIndex:9996,background:"rgba(0,0,0,0.3)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)"}}/>
            <div style={{position:"fixed",left:"50%",top:"50%",transform:"translate(-50%,-50%)",zIndex:9997,width:"min(440px,92vw)",maxHeight:"70vh",overflowY:"auto",background:"var(--nv-surface-solid)",border:"1px solid var(--nv-border)",borderRadius:18,boxShadow:"var(--nv-popover-shadow)",padding:18,animation:"pop-in 0.24s var(--nv-ease)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <input value={f.name||"Folder"} onChange={e=>renameDesktopFolder(openDesktopFolder,e.target.value)} spellCheck={false} style={{flex:1,minWidth:0,background:"transparent",border:"none",outline:"none",fontFamily:FFB,fontWeight:700,fontSize:16,color:"var(--nv-text-strong)"}}/>
                <button onClick={()=>setOpenDesktopFolder(null)} title="Close" style={{width:28,height:28,borderRadius:8,background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",color:"var(--nv-text)",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>✕</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(82px,1fr))",gap:6}}>
                {fapps.map(a=>(
                  <div key={a.id} className="ma" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,padding:"13px 6px",borderRadius:12,cursor:"pointer"}}
                    onClick={()=>{setOpenDesktopFolder(null);openApp(a.id);}}
                    onContextMenu={e=>{e.preventDefault();openContextMenu(e,[
                      {icon:"▶",label:"Open",onClick:()=>{setOpenDesktopFolder(null);openApp(a.id);}},
                      {icon:"–",label:"Remove from folder",danger:true,onClick:()=>removeFromDesktopFolder(openDesktopFolder,a.id)},
                    ]);}}>
                    <AppIconDisplay app={{id:a.id,icon:a.icon}} size={40} glass={glass}/>
                    <span style={{fontSize:10.5,fontFamily:FFB,fontWeight:600,color:"var(--nv-text)",textAlign:"center",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{a.label}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:12,fontSize:11,color:"var(--nv-text-dim)",fontStyle:"italic"}}>Click an app to open it · right-click to remove it from the folder · empty the folder to dissolve it</div>
            </div>
          </>
        );
      })()}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeContextMenu} AC={AC}/>}
      {workspacesOpen && (
        <WorkspacesPanel
          workspaces={data?.settings?.workspaces||[]}
          winCount={wins.length}
          onSave={saveWorkspace} onRestore={restoreWorkspace} onDelete={deleteWorkspace}
          onClose={()=>setWorkspacesOpen(false)} AC={AC}/>
      )}
      {/* v11.0 Phase B — first-run setup wizard, shown once for brand-new accounts
          (setupComplete strictly false; existing accounts have it undefined). */}
      {data && data.setupComplete===false && (
        <SetupWizard
          AC={AC} user={user} apps={allApps} theme={theme} glass={glass}
          onPickTheme={(t)=>updateSettings({theme:t})}
          onComplete={(picked)=>updateData(p=>({...p,desktopApps:picked,setupComplete:true}))}
        />
      )}
      {/* v11.0 POS remaster — full-screen kiosk. Sits above the taskbar/desktop
          and everything else; "Close POS" inside the app calls onExit. */}
      {posMode && (
        <div style={{
          position:"fixed", inset:0, zIndex:2000000,
          // The kiosk sits over the wallpaper, so it must NOT use the translucent
          // Liquid-Glass surface tokens (they'd let the wallpaper bleed through and
          // make text unreadable). Override the surface/border vars with SOLID,
          // theme-aware values for this subtree — children inherit them unchanged.
          background: theme==="light" ? "#eef1f6" : "#0f1120",
          "--nv-surface":        theme==="light" ? "#eef1f6" : "#0f1120",
          "--nv-surface-solid":  theme==="light" ? "#ffffff" : "#191d2c",
          "--nv-elevated":       theme==="light" ? "#e9eef7" : "#222840",
          "--nv-border":         theme==="light" ? "#d6dded" : "#2c3346",
          "--nv-border-strong":  theme==="light" ? "#c2cbdc" : "#3a4259",
        }}>
          <Suspense fallback={<div style={{display:"grid",placeItems:"center",height:"100%",fontFamily:FF,color:"var(--nv-text)"}}>Loading POS…</div>}>
            <PosApp AC={AC} user={user} showToast={showToast} onExit={()=>setPosMode(false)}/>
          </Suspense>
        </div>
      )}
      {MobileNotice}
    </div>
  );
}
 
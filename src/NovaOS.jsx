
// NOVA OS v3.1 — Nova Systems
// Drop this file into src/NovaOS.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "./firebase.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEFAULT_AC = "#4f9eff";
const COLL = "nova_storage";

const WALLPAPERS = {
  bliss:  { name: "Bliss",   preview: "linear-gradient(180deg,#4a9fd1 44%,#6ec82e 44%)", grad: null },
  night:  { name: "Night",   preview: "radial-gradient(#1a0f40,#03020d)",                grad: "radial-gradient(ellipse at 50% 0%,#1a0f40,#03020d)" },
  sakura: { name: "Sakura",  preview: "linear-gradient(155deg,#ffd6e7,#ff8fa3)",         grad: "linear-gradient(155deg,#ffd6e7,#ffb3c6,#ff8fa3)" },
  forest: { name: "Forest",  preview: "radial-gradient(#1a5010,#051204)",                grad: "radial-gradient(ellipse at 50% 100%,#1a5010,#051204)" },
  slate:  { name: "Slate",   preview: "linear-gradient(135deg,#1e2235,#0f1219)",         grad: "linear-gradient(135deg,#1e2235,#0f1219)" },
  custom: { name: "Custom",  preview: "conic-gradient(#888 0deg,#555 360deg)",           grad: null },
};

const APPS = [
  { id: "notes",    icon: "📝", label: "Notes",    desc: "Write & save notes" },
  { id: "tasks",    icon: "✅", label: "Tasks",    desc: "Manage to-dos" },
  { id: "files",    icon: "📁", label: "Files",    desc: "Browse your files" },
  { id: "paint",    icon: "🎨", label: "Paint",    desc: "Draw & create" },
  { id: "browser",  icon: "🌐", label: "Browser",  desc: "Nova Search & Browse" },
  { id: "terminal", icon: "💻", label: "Terminal", desc: "System terminal" },
  { id: "settings", icon: "⚙️", label: "Settings", desc: "Customize Nova OS" },
  { id: "profile",  icon: "👤", label: "Profile",  desc: "Your account" },
];

const BOOT_MSGS = [
  "NOVA OS v3.1 — Nova Systems",
  "Initializing kernel... OK",
  "Loading hardware abstraction layer... OK",
  "Mounting virtual filesystems... OK",
  "Starting Nova Search engine... OK",
  "Loading user environment... OK",
  "System ready.",
];

const ACCENT_PRESETS = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa"];

const BOOKMARKS = [
  { label: "Hacker News",   url: "https://news.ycombinator.com" },
  { label: "Wikipedia",     url: "https://en.m.wikipedia.org" },
  { label: "Archive.org",   url: "https://archive.org" },
  { label: "OpenStreetMap", url: "https://www.openstreetmap.org" },
  { label: "itch.io",       url: "https://itch.io" },
];

const PAINT_PALETTE = [
  "#ffffff","#000000","#ff4444","#ff8800","#ffdd00",
  "#44dd44","#00ccff","#4466ff","#cc44ff","#ff44aa","#8b4513","#888888",
];

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const db = {
  async get(key) {
    try {
      const docId = key.replace(/[:/]/g, "_");
      const snap = await getDoc(doc(firestoreDb, COLL, docId));
      return snap.exists() ? snap.data().value : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      const docId = key.replace(/[:/]/g, "_");
      await setDoc(doc(firestoreDb, COLL, docId), { value });
    } catch { /* silent */ }
  },
};

// ─── THEME HELPERS ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ].join(",");
}

function acFill(ac)   { return "rgba(" + hexToRgb(ac) + ",0.16)"; }
function acBorder(ac) { return "rgba(" + hexToRgb(ac) + ",0.55)"; }

function isUrl(s) {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || /^[\w-]+\.[\w]{2,}(\/|$)/.test(t);
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
// Space Grotesk + DM Sans = narrower, cleaner than Syne/Figtree from v3.0
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #000; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
  input, textarea, button { font-family: inherit; }
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.22); }
  textarea { resize: vertical; }
  @keyframes boot-in  { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }
  @keyframes win-in   { from { opacity:0; transform:scale(0.95) translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes menu-up  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes toast-in { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:none; } }
  @keyframes spin     { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .dsk-icon:hover   { background: rgba(255,255,255,0.15) !important; }
  .dsk-icon:active  { transform: scale(0.9) !important; }
  .tb-app:hover     { background: rgba(255,255,255,0.14) !important; }
  .winx:hover       { background: #c42b1c !important; color: #fff !important; }
  .menu-app:hover   { background: rgba(255,255,255,0.09) !important; }
  .lsubmit:hover:not(:disabled) { opacity: 0.82 !important; }
  .ltab:hover       { color: rgba(160,210,255,0.9) !important; }
  .start-btn:hover  { background: rgba(255,255,255,0.12) !important; }
  .del-btn:hover    { color: rgba(255,80,80,0.9) !important; }
  .paint-sw:hover   { transform: scale(1.2); z-index: 2; }
  .file-row:hover   { background: rgba(255,255,255,0.07) !important; }
  .sr-card:hover    { background: rgba(255,255,255,0.06) !important; }
  .bm-pill:hover    { background: rgba(255,255,255,0.12) !important; }
  .ac-dot:hover     { transform: scale(1.15); }
  .wp-sw:hover      { border-color: rgba(255,255,255,0.5) !important; }
`;

// ─── SHARED STYLE TOKENS ─────────────────────────────────────────────────────
const FF  = "'DM Sans', sans-serif";
const FFB = "'Space Grotesk', sans-serif";
const FFM = "'JetBrains Mono', monospace";

const INP_STYLE = {
  width: "100%",
  padding: "9px 12px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 7,
  color: "rgba(255,255,255,0.92)",
  fontFamily: FF,
  fontSize: 14,
  outline: "none",
};

const SECTION_LABEL = {
  fontFamily: FFB,
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: 1.5,
  color: "rgba(255,255,255,0.3)",
  marginBottom: 12,
  textTransform: "uppercase",
};

// ─── BACKGROUNDS ─────────────────────────────────────────────────────────────
function BlissBackground() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1b5c90" />
          <stop offset="30%"  stopColor="#3990cc" />
          <stop offset="65%"  stopColor="#6ab6e8" />
          <stop offset="100%" stopColor="#a4d4f0" />
        </linearGradient>
        <linearGradient id="ghb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#478c18" />
          <stop offset="100%" stopColor="#1e5007" />
        </linearGradient>
        <linearGradient id="ghm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#57b820" />
          <stop offset="100%" stopColor="#27680e" />
        </linearGradient>
        <linearGradient id="ghf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6cca2c" />
          <stop offset="100%" stopColor="#337a14" />
        </linearGradient>
        <linearGradient id="gfg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3d8814" />
          <stop offset="100%" stopColor="#194807" />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#gsky)" />
      {[[310,165,150,50],[278,158,100,37],[350,155,85,40],[970,128,120,40],[940,121,78,29],[1170,200,130,44],[1200,192,75,32],[95,255,85,30]].map(([cx,cy,rx,ry],i)=>(
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={"rgba(255,255,255," + (0.42 + (i % 3) * 0.09) + ")"} />
      ))}
      <path d="M0 590 Q200 450 430 530 Q630 610 860 480 Q1040 365 1210 445 Q1350 505 1440 460 L1440 900 L0 900Z" fill="url(#ghb)" />
      <path d="M0 645 Q170 515 380 585 Q570 655 775 540 Q955 425 1155 505 Q1305 565 1440 522 L1440 900 L0 900Z" fill="url(#ghm)" />
      <path d="M-10 725 Q70 640 190 658 Q310 678 440 730 Q615 796 808 682 Q955 598 1090 628 Q1230 658 1360 618 L1460 610 L1460 900 L-10 900Z" fill="url(#ghf)" />
      <path d="M0 818 Q370 778 720 795 Q1020 810 1440 778 L1440 900 L0 900Z" fill="url(#gfg)" />
    </svg>
  );
}

function Wallpaper({ id, customUrl }) {
  if (id === "custom" && customUrl) {
    return (
      <div style={{ position: "absolute", inset: 0, background: "url(\"" + customUrl + "\") center/cover no-repeat" }} />
    );
  }
  const wp = WALLPAPERS[id];
  if (!id || id === "bliss" || !wp || !wp.grad) return <BlissBackground />;
  return <div style={{ position: "absolute", inset: 0, background: wp.grad }} />;
}

// ─── TOGGLE (module-level so React never remounts it) ─────────────────────────
function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: FF, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, background: value ? "#4f9eff" : "rgba(255,255,255,0.12)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
      >
        <div style={{ position: "absolute", top: 3, left: value ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

// ─── BROWSER NAV BAR (module-level) ───────────────────────────────────────────
function BrowserNavBar({ bar, setBar, onGo, onBack, onFwd, canBack, canFwd, AC }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
      <button
        onClick={onBack} disabled={!canBack}
        style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: canBack ? "pointer" : "default", color: "rgba(255,255,255,0.5)", fontSize: 13, opacity: canBack ? 1 : 0.3 }}
      >←</button>
      <button
        onClick={onFwd} disabled={!canFwd}
        style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: canFwd ? "pointer" : "default", color: "rgba(255,255,255,0.5)", fontSize: 13, opacity: canFwd ? 1 : 0.3 }}
      >→</button>
      <input
        value={bar}
        onChange={e => setBar(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onGo()}
        placeholder="Search anything, or enter a URL…"
        style={{ ...INP_STYLE, flex: 1, fontFamily: FFM, fontSize: 12 }}
      />
      <button
        onClick={onGo}
        style={{ padding: "7px 14px", background: acFill(AC), border: "1px solid " + acBorder(AC), borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC }}
      >Go</button>
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function NovaOS() {
  const [screen,    setScreen]    = useState("boot");
  const [bootLines, setBootLines] = useState([]);
  const [mode,      setMode]      = useState("login");
  const [uname,     setUname]     = useState("");
  const [pass,      setPass]      = useState("");
  const [authErr,   setAuthErr]   = useState("");
  const [busy,      setBusy]      = useState(false);
  const [user,      setUser]      = useState(null);
  const [data,      setData]      = useState(null);
  const [customWp,  setCustomWp]  = useState(null);
  const [wins,      setWins]      = useState([]);
  const [maxZ,      setMaxZ]      = useState(100);
  const [tick,      setTick]      = useState(new Date());
  const [toast,     setToast]     = useState(null);
  const [drag,      setDrag]      = useState(null);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [menuSearch,setMenuSearch]= useState("");

  const menuRef = useRef(null);
  const winsRef = useRef(wins);
  useEffect(() => { winsRef.current = wins; }, [wins]);

  // Derive theme settings (safe defaults throughout)
  const settings  = (data && data.settings) ? data.settings : {};
  const AC        = settings.accent   || DEFAULT_AC;
  const use24h    = settings.clock24h || false;
  const winBlur   = settings.winBlur  != null ? settings.winBlur : 18;
  const largeFnt  = settings.largeFont|| false;
  const baseFSize = largeFnt ? 15 : 13;
  const wpId      = settings.wallpaper || (data && data.wallpaper) || "bliss";

  // Boot sequence
  useEffect(() => {
    let i = 0, dead = false;
    function next() {
      if (dead) return;
      if (i >= BOOT_MSGS.length) {
        setTimeout(() => { if (!dead) setScreen("login"); }, 700);
        return;
      }
      setBootLines(prev => [...prev, BOOT_MSGS[i++]]);
      setTimeout(next, i < 2 ? 90 : 240);
    }
    setTimeout(next, 380);
    return () => { dead = true; };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load custom wallpaper when needed
  useEffect(() => {
    if (user && wpId === "custom") {
      db.get("user:" + user + ":wpimg").then(url => { if (url) setCustomWp(url); });
    }
  }, [user, wpId]);

  // Close start menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Global drag
  useEffect(() => {
    function onMove(e) {
      if (!drag) return;
      setWins(ws => ws.map(w => {
        if (w.id !== drag.id) return w;
        return { ...w, x: Math.max(0, e.clientX - drag.ox), y: Math.max(0, Math.min(e.clientY - drag.oy, window.innerHeight - 80)) };
      }));
    }
    function onUp() { setDrag(null); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [drag]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const saveData = useCallback(async (d) => {
    if (user) await db.set("user:" + user + ":data", d);
  }, [user]);

  const updateData = useCallback((patch) => {
    setData(prev => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      saveData(next);
      return next;
    });
  }, [saveData]);

  const updateSettings = useCallback((patch) => {
    updateData(prev => ({ ...prev, settings: { ...(prev.settings || {}), ...patch } }));
  }, [updateData]);

  const handleCustomWallpaper = useCallback(async (dataUrl) => {
    setCustomWp(dataUrl);
    await db.set("user:" + user + ":wpimg", dataUrl);
    updateSettings({ wallpaper: "custom" });
    showToast("Custom wallpaper set ✓");
  }, [user, updateSettings, showToast]);

  const focusWin = useCallback((id) => {
    setMaxZ(z => {
      const nz = z + 1;
      setWins(ws => ws.map(w => w.id === id ? { ...w, z: nz } : w));
      return nz;
    });
  }, []);

  const openApp = useCallback((appId) => {
    setMenuOpen(false);
    setMaxZ(z => {
      const nz = z + 1;
      setWins(ws => {
        const ex = ws.find(w => w.app === appId);
        if (ex) return ws.map(w => w.id === ex.id ? { ...w, z: nz } : w);
        const n = ws.length % 6;
        return [...ws, { id: Date.now() + Math.random(), app: appId, z: nz, x: 120 + n * 28, y: 36 + n * 22 }];
      });
      return nz;
    });
  }, []);

  function startDrag(e, winId) {
    if (e.button !== 0) return;
    e.preventDefault();
    const w = winsRef.current.find(w => w.id === winId);
    if (w) {
      setDrag({ id: winId, ox: e.clientX - w.x, oy: e.clientY - w.y });
      focusWin(winId);
    }
  }

  function closeWin(id) { setWins(ws => ws.filter(w => w.id !== id)); }

  async function handleAuth() {
    const u = uname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const p = pass.trim();
    if (!u || !p) { setAuthErr("All fields required."); return; }
    if (u.length < 3) { setAuthErr("Username needs 3+ characters."); return; }
    setBusy(true); setAuthErr("");
    if (mode === "register") {
      const exists = await db.get("user:" + u + ":pw");
      if (exists !== null) { setAuthErr("Username already taken."); setBusy(false); return; }
      await db.set("user:" + u + ":pw", p);
      const init = { notes: [], tasks: [], wallpaper: "bliss", bio: "", joined: Date.now(), settings: {} };
      await db.set("user:" + u + ":data", init);
      setUser(u); setData(init); setScreen("desktop");
    } else {
      const stored = await db.get("user:" + u + ":pw");
      if (stored === null) { setAuthErr("Account not found."); setBusy(false); return; }
      if (stored !== p) { setAuthErr("Incorrect password."); setBusy(false); return; }
      const d = await db.get("user:" + u + ":data");
      setUser(u);
      setData(d || { notes: [], tasks: [], wallpaper: "bliss", bio: "", joined: Date.now(), settings: {} });
      setScreen("desktop");
    }
    setBusy(false);
  }

  function logout() {
    setUser(null); setData(null); setCustomWp(null); setWins([]); setMaxZ(100); setMenuOpen(false);
    setUname(""); setPass(""); setAuthErr(""); setMode("login"); setScreen("login");
  }

  function fmtTime(d) {
    return use24h
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDate(d) {
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  const filteredApps = APPS.filter(a =>
    a.label.toLowerCase().includes(menuSearch.toLowerCase()) ||
    a.desc.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // ─── BOOT ─────────────────────────────────────────────────────────────────
  if (screen === "boot") {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#050508", display: "flex", flexDirection: "column", justifyContent: "center", padding: "10vh 12%" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 66, letterSpacing: 4, color: "#fff", marginBottom: 4, lineHeight: 1 }}>NOVA</div>
        <div style={{ fontFamily: FF, fontWeight: 500, fontSize: 12, color: "rgba(255,255,255,0.22)", letterSpacing: 5, marginBottom: 46 }}>OPERATING SYSTEM  ·  v3.1</div>
        {bootLines.map((line, i) => (
          <div key={i} style={{ fontFamily: FFM, fontSize: 12, color: line.includes("ready") ? "#4f9eff" : "rgba(255,255,255,0.42)", marginBottom: 5, animation: "boot-in 0.13s ease-out" }}>
            {line.includes("OK")
              ? <>{line.replace("... OK", "")}... <span style={{ color: "#4cef90" }}>OK</span></>
              : line}
          </div>
        ))}
      </div>
    );
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
        <style>{GLOBAL_CSS}</style>
        <BlissBackground />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "rgba(8,10,22,0.86)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 16, padding: "44px 40px", width: 376, boxShadow: "0 40px 100px rgba(0,0,0,0.6)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent," + DEFAULT_AC + ",transparent)" }} />
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 38, color: "#fff", textAlign: "center", letterSpacing: 4, marginBottom: 4 }}>NOVA</div>
            <div style={{ fontFamily: FF, fontSize: 11, color: "rgba(255,255,255,0.22)", textAlign: "center", letterSpacing: 4, marginBottom: 36 }}>OPERATING SYSTEM  ·  v3.1</div>
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.09)", marginBottom: 24 }}>
              {["login", "register"].map(m => (
                <button key={m} className="ltab" onClick={() => { setMode(m); setAuthErr(""); }}
                  style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: mode === m ? "2px solid " + DEFAULT_AC : "2px solid transparent", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, letterSpacing: 1, color: mode === m ? DEFAULT_AC : "rgba(255,255,255,0.28)", transition: "color 0.15s" }}>
                  {m === "login" ? "SIGN IN" : "REGISTER"}
                </button>
              ))}
            </div>
            <input
              style={{ ...INP_STYLE, marginBottom: 11 }}
              placeholder="Username"
              value={uname}
              onChange={e => setUname(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAuth()}
              autoFocus
            />
            <input
              style={{ ...INP_STYLE }}
              type="password"
              placeholder="Password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAuth()}
            />
            <button className="lsubmit" disabled={busy} onClick={handleAuth}
              style={{ width: "100%", padding: "12px", background: acFill(DEFAULT_AC), border: "1px solid " + acBorder(DEFAULT_AC), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 14, letterSpacing: 1, color: "#fff", marginTop: 14, transition: "opacity 0.15s" }}>
              {busy ? "AUTHENTICATING…" : mode === "login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
            </button>
            {authErr && <div style={{ color: "#ff7878", fontFamily: FF, fontSize: 13, textAlign: "center", marginTop: 12 }}>⚠ {authErr}</div>}
            <div style={{ marginTop: 20, fontFamily: FF, fontStyle: "italic", fontSize: 11, color: "rgba(255,255,255,0.14)", textAlign: "center" }}>
              Don't reuse real passwords — demo auth only.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DESKTOP ──────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden", cursor: drag ? "grabbing" : "default", fontSize: baseFSize }}>
      <style>{GLOBAL_CSS}</style>
      <Wallpaper id={wpId} customUrl={customWp} />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 14, right: 14, zIndex: 99999, padding: "10px 18px", background: "rgba(8,10,22,0.97)", border: "1px solid " + AC, borderRadius: 9, fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff", animation: "toast-in 0.17s ease-out", boxShadow: "0 8px 36px rgba(0,0,0,0.6)" }}>
          {toast}
        </div>
      )}

      {/* Desktop icons */}
      <div style={{ position: "absolute", top: 14, left: 10, display: "flex", flexDirection: "column", gap: 3, zIndex: 1 }}>
        {APPS.map(app => (
          <div key={app.id} className="dsk-icon" onDoubleClick={() => openApp(app.id)} title={app.desc}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 70, padding: "8px 4px", borderRadius: 9, cursor: "pointer", userSelect: "none", border: "1px solid transparent", transition: "background 0.12s", background: "rgba(0,0,0,0.1)" }}>
            <span style={{ fontSize: 24, filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.8))" }}>{app.icon}</span>
            <span style={{ fontFamily: FF, fontWeight: 600, fontSize: 10, color: "#fff", textAlign: "center", lineHeight: 1.2, textShadow: "0 1px 4px #000" }}>{app.label}</span>
          </div>
        ))}
      </div>

      {/* Start menu */}
      {menuOpen && (
        <div ref={menuRef} style={{ position: "fixed", bottom: 52, left: 0, width: 340, background: "rgba(9,11,24,0.96)", backdropFilter: "blur(28px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 14px 0 0", boxShadow: "6px -6px 48px rgba(0,0,0,0.65)", zIndex: 9998, display: "flex", flexDirection: "column", animation: "menu-up 0.15s ease-out", overflow: "hidden" }}>
          <div style={{ padding: "14px 14px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 12, opacity: 0.4 }}>🔍</span>
              <input
                value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                placeholder="Search apps…" autoFocus
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(255,255,255,0.9)", fontFamily: FF, fontSize: 13 }}
              />
              {menuSearch && <button onClick={() => setMenuSearch("")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13 }}>✕</button>}
            </div>
          </div>
          <div style={{ padding: "0 14px 12px", flex: 1, overflowY: "auto" }}>
            <div style={SECTION_LABEL}>All Apps</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
              {filteredApps.map(app => (
                <div key={app.id} className="menu-app" onClick={() => openApp(app.id)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 4px", borderRadius: 9, cursor: "pointer", transition: "background 0.12s" }}>
                  <span style={{ fontSize: 22 }}>{app.icon}</span>
                  <span style={{ fontFamily: FF, fontWeight: 600, fontSize: 10, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 1.25 }}>{app.label}</span>
                </div>
              ))}
              {filteredApps.length === 0 && (
                <div style={{ gridColumn: "span 4", color: "rgba(255,255,255,0.2)", fontFamily: FF, fontStyle: "italic", fontSize: 12, textAlign: "center", padding: "18px 0" }}>No apps found</div>
              )}
            </div>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: acFill(AC), border: "1.5px solid " + AC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "#fff" }}>@{user}</div>
              <div style={{ fontFamily: FF, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Nova OS v3.1</div>
            </div>
            <button onClick={logout} style={{ padding: "5px 11px", background: "rgba(200,40,40,0.12)", border: "1px solid rgba(200,40,40,0.3)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,140,140,0.9)" }}>Logout</button>
          </div>
        </div>
      )}

      {/* Windows */}
      {wins.map(win => {
        const app = APPS.find(a => a.id === win.app);
        const isDragging = drag && drag.id === win.id;
        return (
          <div key={win.id} onClick={() => focusWin(win.id)}
            style={{ position: "absolute", left: win.x, top: win.y, zIndex: win.z, background: "rgba(10,12,26,0.93)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, boxShadow: "0 " + (isDragging ? 30 : 15) + "px " + (isDragging ? 90 : 50) + "px rgba(0,0,0," + (isDragging ? 0.8 : 0.6) + ")", display: "flex", flexDirection: "column", animation: "win-in 0.15s ease-out", minWidth: 340, backdropFilter: "blur(" + winBlur + "px)", transition: "box-shadow 0.12s" }}>
            <div onMouseDown={e => startDrag(e, win.id)}
              style={{ height: 38, display: "flex", alignItems: "center", padding: "0 12px", gap: 9, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px 12px 0 0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}>
              <span style={{ fontSize: 14 }}>{app ? app.icon : ""}</span>
              <span style={{ flex: 1, fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>{app ? app.label : ""}</span>
              <button className="winx" onClick={e => { e.stopPropagation(); closeWin(win.id); }}
                style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "rgba(255,255,255,0.5)", transition: "background 0.12s, color 0.12s", flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ padding: 18, overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>
              {win.app === "notes"    && <NotesApp    data={data} updateData={updateData} showToast={showToast} AC={AC} />}
              {win.app === "tasks"    && <TasksApp    data={data} updateData={updateData} showToast={showToast} AC={AC} />}
              {win.app === "files"    && <FilesApp    data={data} updateData={updateData} showToast={showToast} />}
              {win.app === "paint"    && <PaintApp    showToast={showToast} AC={AC} />}
              {win.app === "browser"  && <BrowserApp  AC={AC} />}
              {win.app === "terminal" && <TerminalApp user={user} AC={AC} />}
              {win.app === "settings" && <SettingsApp user={user} data={data} updateSettings={updateSettings} showToast={showToast} AC={AC} onCustomWallpaper={handleCustomWallpaper} />}
              {win.app === "profile"  && <ProfileApp  user={user} data={data} updateData={updateData} showToast={showToast} AC={AC} />}
            </div>
          </div>
        );
      })}

      {/* Taskbar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 52, background: "rgba(7,8,18,0.94)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", padding: "0 10px", gap: 6, zIndex: 9999 }}>
        <button className="start-btn" onClick={() => { setMenuOpen(o => !o); setMenuSearch(""); }}
          style={{ width: 38, height: 38, borderRadius: 9, background: menuOpen ? acFill(AC) : "rgba(255,255,255,0.07)", border: menuOpen ? "1px solid " + acBorder(AC) : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", fontSize: 17, color: menuOpen ? AC : "rgba(255,255,255,0.7)" }}>
          ◈
        </button>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.09)", margin: "0 2px" }} />
        {wins.map(win => {
          const app = APPS.find(a => a.id === win.app);
          return (
            <button key={win.id} className="tb-app" onClick={() => focusWin(win.id)}
              style={{ height: 34, padding: "0 12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, cursor: "pointer", fontFamily: FF, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.78)", whiteSpace: "nowrap", transition: "background 0.12s", display: "flex", alignItems: "center", gap: 6 }}>
              {app ? app.icon : ""} {app ? app.label : ""}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC }}>@{user}</div>
        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.09)" }} />
        <div style={{ fontFamily: FFM, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right", lineHeight: 1.55 }}>
          <div style={{ fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>{fmtTime(tick)}</div>
          <div style={{ fontSize: 9 }}>{fmtDate(tick)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── NOTES ────────────────────────────────────────────────────────────────────
function NotesApp({ data, updateData, showToast, AC }) {
  const [title, setTitle] = useState("");
  const [body,  setBody]  = useState("");

  function add() {
    if (!title.trim()) return;
    updateData(p => ({ ...p, notes: [{ id: Date.now(), title: title.trim(), body: body.trim(), ts: Date.now() }, ...(p.notes || [])] }));
    setTitle(""); setBody(""); showToast("Note saved ✓");
  }
  function del(id) { updateData(p => ({ ...p, notes: p.notes.filter(n => n.id !== id) })); }

  const notes = (data && data.notes) ? data.notes : [];

  return (
    <div style={{ width: 390, fontFamily: FF }}>
      <div style={SECTION_LABEL}>Notes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title…" style={INP_STYLE} onKeyDown={e => e.key === "Enter" && add()} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write something…" style={{ ...INP_STYLE, minHeight: 72 }} />
        <button onClick={add} style={{ padding: "9px", background: acFill(AC), border: "1px solid " + acBorder(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC }}>+ Add Note</button>
      </div>
      {notes.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, textAlign: "center", padding: "22px 0", fontStyle: "italic" }}>No notes yet</div>}
      {notes.map(n => (
        <div key={n.id} style={{ padding: "11px 13px", marginBottom: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, position: "relative" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.92)", paddingRight: 26, marginBottom: n.body ? 3 : 0 }}>{n.title}</div>
          {n.body && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</div>}
          <div style={{ fontFamily: FFM, fontSize: 9, color: "rgba(255,255,255,0.18)", marginTop: 5 }}>{new Date(n.ts).toLocaleDateString()}</div>
          <button className="del-btn" onClick={() => del(n.id)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.3)", fontSize: 13, transition: "color 0.12s" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
function TasksApp({ data, updateData, showToast, AC }) {
  const [input, setInput] = useState("");

  function add()        { if (!input.trim()) return; updateData(p => ({ ...p, tasks: [...(p.tasks || []), { id: Date.now(), text: input.trim(), done: false }] })); setInput(""); showToast("Task added ✓"); }
  function toggle(id)   { updateData(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) })); }
  function delTask(id)  { updateData(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) })); }

  const tasks   = (data && data.tasks) ? data.tasks : [];
  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);

  return (
    <div style={{ width: 360, fontFamily: FF }}>
      <div style={SECTION_LABEL}>Tasks</div>
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Add a task…" style={{ ...INP_STYLE, flex: 1 }} onKeyDown={e => e.key === "Enter" && add()} />
        <button onClick={add} style={{ width: 40, background: acFill(AC), border: "1px solid " + acBorder(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 18, color: AC }}>+</button>
      </div>
      {tasks.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, textAlign: "center", padding: "22px 0", fontStyle: "italic" }}>All clear!</div>}
      {pending.map(t => <TaskRow key={t.id} t={t} onToggle={toggle} onDel={delTask} AC={AC} />)}
      {done.length > 0 && <>
        <div style={{ ...SECTION_LABEL, marginTop: 14 }}>Done ({done.length})</div>
        {done.map(t => <TaskRow key={t.id} t={t} onToggle={toggle} onDel={delTask} AC={AC} />)}
      </>}
    </div>
  );
}

function TaskRow({ t, onToggle, onDel, AC }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", marginBottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, opacity: t.done ? 0.4 : 1, transition: "opacity 0.2s" }}>
      <div onClick={() => onToggle(t.id)}
        style={{ width: 17, height: 17, borderRadius: 5, border: "1.5px solid " + (t.done ? AC : "rgba(255,255,255,0.22)"), background: t.done ? AC : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.14s" }}>
        {t.done && <span style={{ color: "#000", fontSize: 9, fontWeight: 900 }}>✓</span>}
      </div>
      <span style={{ flex: 1, fontFamily: FF, fontSize: 13, color: "rgba(255,255,255,0.88)", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
      <button className="del-btn" onClick={() => onDel(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.28)", fontSize: 12, padding: 0, transition: "color 0.12s" }}>✕</button>
    </div>
  );
}

// ─── FILES ────────────────────────────────────────────────────────────────────
function FilesApp({ data, updateData, showToast }) {
  const [path,    setPath]    = useState("home");
  const [preview, setPreview] = useState(null);

  const notes = (data && data.notes) ? data.notes : [];
  const tasks  = (data && data.tasks) ? data.tasks  : [];

  if (path === "home") {
    return (
      <div style={{ width: 420, fontFamily: FF }}>
        <div style={SECTION_LABEL}>File Explorer</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {[
            { id: "notes", icon: "📄", label: "Notes", count: notes.length },
            { id: "tasks", icon: "📋", label: "Tasks", count: tasks.length },
          ].map(f => (
            <div key={f.id} className="file-row" onClick={() => setPath(f.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer", transition: "background 0.12s" }}>
              <span style={{ fontSize: 26 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>{f.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{f.count} file{f.count !== 1 ? "s" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (path === "notes") {
    return (
      <div style={{ width: 460, fontFamily: FF }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => { setPath("home"); setPreview(null); }}
            style={{ padding: "4px 11px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.55)" }}>← Back</button>
          <div style={SECTION_LABEL}>📄 Notes</div>
        </div>
        {notes.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontStyle: "italic", padding: "18px 0" }}>No notes saved yet.</div>}
        {notes.map(n => (
          <div key={n.id} className="file-row" onClick={() => setPreview(n)}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", marginBottom: 4, background: (preview && preview.id === n.id) ? "rgba(79,158,255,0.1)" : "rgba(255,255,255,0.03)", border: "1px solid " + ((preview && preview.id === n.id) ? "rgba(79,158,255,0.35)" : "rgba(255,255,255,0.07)"), borderRadius: 7, cursor: "pointer", transition: "background 0.12s" }}>
            <span style={{ fontSize: 14 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontFamily: FFM }}>{new Date(n.ts).toLocaleDateString()}</div>
            </div>
            <button className="del-btn" onClick={e => { e.stopPropagation(); updateData(p => ({ ...p, notes: p.notes.filter(x => x.id !== n.id) })); if (preview && preview.id === n.id) setPreview(null); showToast("Deleted"); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.28)", fontSize: 12, padding: 0, transition: "color 0.12s", flexShrink: 0 }}>✕</button>
          </div>
        ))}
        {preview && (
          <div style={{ marginTop: 12, padding: "13px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.92)", marginBottom: 7 }}>{preview.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{preview.body || "(no content)"}</div>
          </div>
        )}
      </div>
    );
  }

  // Tasks view
  return (
    <div style={{ width: 420, fontFamily: FF }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setPath("home")}
          style={{ padding: "4px 11px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.55)" }}>← Back</button>
        <div style={SECTION_LABEL}>📋 Tasks</div>
      </div>
      {tasks.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontStyle: "italic", padding: "18px 0" }}>No tasks yet.</div>}
      {tasks.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", marginBottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, opacity: t.done ? 0.42 : 1 }}>
          <span style={{ fontSize: 12 }}>{t.done ? "✅" : "⬜"}</span>
          <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.85)", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
          <span style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.22)" }}>{t.done ? "done" : "open"}</span>
        </div>
      ))}
    </div>
  );
}

// ─── PAINT ────────────────────────────────────────────────────────────────────
function PaintApp({ showToast, AC }) {
  const canvasRef = useRef(null);
  const lastPos   = useRef(null);
  const [color,   setColor]   = useState("#000000");
  const [size,    setSize]    = useState(6);
  const [tool,    setTool]    = useState("pen");
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    e.stopPropagation();
    setDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.fill();
  }
  function onMove(e) {
    if (!drawing || !lastPos.current) return;
    e.stopPropagation();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }
  function onUp(e) { e.stopPropagation(); setDrawing(false); lastPos.current = null; }

  function clear() {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  function download() {
    const a = document.createElement("a");
    a.download = "nova-paint.png";
    a.href = canvasRef.current.toDataURL();
    a.click();
    showToast("Image saved ✓");
  }

  function ToolBtn({ id, label }) {
    return (
      <button onClick={() => setTool(id)}
        style={{ padding: "6px 12px", background: tool === id ? acFill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (tool === id ? acBorder(AC) : "rgba(255,255,255,0.11)"), borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: tool === id ? AC : "rgba(255,255,255,0.6)" }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ width: 580, fontFamily: FF }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        <ToolBtn id="pen" label="✏️ Pen" />
        <ToolBtn id="eraser" label="⬜ Eraser" />
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 4 }}>
          <span style={{ fontSize: 10, fontFamily: FFB, fontWeight: 600, letterSpacing: 1, color: "rgba(255,255,255,0.3)" }}>SIZE</span>
          <input type="range" min={2} max={40} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: 76, accentColor: AC }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", width: 16 }}>{size}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={clear} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Clear</button>
        <button onClick={download} style={{ padding: "6px 12px", background: acFill(AC), border: "1px solid " + acBorder(AC), borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: AC }}>⬇ Save</button>
      </div>
      <canvas ref={canvasRef} width={560} height={340}
        style={{ borderRadius: 7, cursor: tool === "eraser" ? "cell" : "crosshair", display: "block", border: "1px solid rgba(255,255,255,0.1)" }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
        {PAINT_PALETTE.map(c => (
          <div key={c} className="paint-sw" onClick={() => { setColor(c); setTool("pen"); }}
            style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: "pointer", border: (color === c && tool === "pen") ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.14)", transition: "transform 0.1s", boxSizing: "border-box" }} />
        ))}
        <input type="color" value={color} onChange={e => { setColor(e.target.value); setTool("pen"); }}
          style={{ width: 26, height: 26, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", background: "none", marginLeft: 4 }} />
      </div>
    </div>
  );
}

// ─── BROWSER — Nova Search ────────────────────────────────────────────────────
function BrowserApp({ AC }) {
  const [bar,     setBar]     = useState("");
  const [view,    setView]    = useState("home");
  const [results, setResults] = useState(null);
  const [frameUrl,setFrameUrl]= useState("");
  const [loading, setLoading] = useState(false);
  const [hist,    setHist]    = useState([]);
  const [hIdx,    setHIdx]    = useState(-1);

  function browse(url) {
    const full = url.startsWith("http") ? url : "https://" + url;
    const nh = [...hist.slice(0, hIdx + 1), full];
    setHist(nh); setHIdx(nh.length - 1);
    setFrameUrl(full); setBar(full); setView("browse");
  }

  async function novaSearch(q) {
    setLoading(true); setView("results"); setResults(null);
    try {
      const [ddgRes, wikiRes] = await Promise.allSettled([
        fetch("https://api.duckduckgo.com/?q=" + encodeURIComponent(q) + "&format=json&no_html=1&skip_disambig=1").then(r => r.json()),
        fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(q) + "&format=json&origin=*&srlimit=7").then(r => r.json()),
      ]);
      setResults({
        q,
        ddg:  ddgRes.status  === "fulfilled" ? ddgRes.value  : null,
        wiki: wikiRes.status === "fulfilled" ? wikiRes.value : null,
      });
    } catch {
      setResults({ q, ddg: null, wiki: null });
    }
    setLoading(false);
  }

  function go(input) {
    const q = (input || bar).trim();
    if (!q) return;
    if (isUrl(q)) browse(q); else novaSearch(q);
  }

  function back() { if (hIdx > 0) { const i = hIdx - 1; setHIdx(i); setFrameUrl(hist[i]); setBar(hist[i]); setView("browse"); } }
  function fwd()  { if (hIdx < hist.length - 1) { const i = hIdx + 1; setHIdx(i); setFrameUrl(hist[i]); setBar(hist[i]); setView("browse"); } }

  const BookmarkBar = (
    <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
      {BOOKMARKS.map(b => (
        <button key={b.url} className="bm-pill" onClick={() => browse(b.url)}
          style={{ padding: "4px 11px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, cursor: "pointer", fontFamily: FF, fontWeight: 500, fontSize: 11, color: "rgba(255,255,255,0.65)", transition: "background 0.12s" }}>
          {b.label}
        </button>
      ))}
      <button className="bm-pill" onClick={() => window.open("https://www.bing.com", "_blank")}
        style={{ padding: "4px 11px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, cursor: "pointer", fontFamily: FF, fontWeight: 500, fontSize: 11, color: "rgba(255,255,255,0.65)", transition: "background 0.12s" }}>
        Bing ↗
      </button>
      <button className="bm-pill" onClick={() => window.open("https://www.google.com", "_blank")}
        style={{ padding: "4px 11px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, cursor: "pointer", fontFamily: FF, fontWeight: 500, fontSize: 11, color: "rgba(255,255,255,0.65)", transition: "background 0.12s" }}>
        Google ↗
      </button>
    </div>
  );

  const NavBar = (
    <BrowserNavBar
      bar={bar} setBar={setBar}
      onGo={() => go()}
      onBack={back} onFwd={fwd}
      canBack={hIdx > 0} canFwd={hIdx < hist.length - 1}
      AC={AC}
    />
  );

  if (view === "home") {
    return (
      <div style={{ width: 640, fontFamily: FF }}>
        {NavBar}{BookmarkBar}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 14, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 44 }}>🌐</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 18, color: "rgba(255,255,255,0.55)" }}>Nova Browser</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.7, maxWidth: 380 }}>
            Type a search query for <b style={{ color: "rgba(255,255,255,0.45)" }}>Nova Search</b> (DDG + Wikipedia), or enter a URL.<br />
            Bing & Google block iframes — use the ↗ buttons to open them in a new tab.
          </div>
        </div>
      </div>
    );
  }

  if (view === "browse") {
    return (
      <div style={{ width: 680, fontFamily: FF }}>
        {NavBar}{BookmarkBar}
        <iframe src={frameUrl} title="nova-browser" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          style={{ width: "100%", height: 400, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "#fff", display: "block" }} />
      </div>
    );
  }

  // Results view
  const ddg        = results ? results.ddg  : null;
  const wiki       = results ? results.wiki : null;
  const ddgTopics  = ddg ? (ddg.RelatedTopics || []).filter(t => t.FirstURL && t.Text).slice(0, 8) : [];
  const wikiHits   = wiki ? ((wiki.query && wiki.query.search) || []) : [];

  return (
    <div style={{ width: 640, fontFamily: FF }}>
      {NavBar}{BookmarkBar}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 12, flexDirection: "column" }}>
          <div style={{ width: 28, height: 28, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Searching…</div>
        </div>
      ) : (
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          <div style={{ ...SECTION_LABEL, marginBottom: 10 }}>Results for "{results ? results.q : ""}"</div>
          {ddg && ddg.AbstractText && (
            <div style={{ padding: "13px 14px", marginBottom: 10, background: acFill(AC), border: "1px solid " + acBorder(AC), borderRadius: 9 }}>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: AC, marginBottom: 5 }}>{ddg.Heading}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>{ddg.AbstractText}</div>
              {ddg.AbstractURL && <a href={ddg.AbstractURL} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: AC, opacity: 0.7, marginTop: 6, display: "inline-block", fontFamily: FFM }}>Source ↗</a>}
            </div>
          )}
          {wikiHits.length > 0 && <>
            <div style={SECTION_LABEL}>Wikipedia</div>
            {wikiHits.map(h => (
              <div key={h.pageid} className="sr-card" onClick={() => browse("https://en.wikipedia.org/wiki/" + encodeURIComponent(h.title))}
                style={{ padding: "10px 12px", marginBottom: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer", transition: "background 0.12s" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{h.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>{h.snippet ? h.snippet.replace(/<[^>]*>/g, "") + "…" : ""}</div>
                <div style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>en.wikipedia.org</div>
              </div>
            ))}
          </>}
          {ddgTopics.length > 0 && <>
            <div style={{ ...SECTION_LABEL, marginTop: 10 }}>Related</div>
            {ddgTopics.map((t, i) => (
              <div key={i} className="sr-card" onClick={() => browse(t.FirstURL)}
                style={{ padding: "9px 12px", marginBottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, cursor: "pointer", transition: "background 0.12s" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.55 }}>{t.Text}</div>
                <div style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.FirstURL}</div>
              </div>
            ))}
          </>}
          {!ddg && wikiHits.length === 0 && ddgTopics.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic" }}>No results found. Try a different query or enter a URL.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TERMINAL ─────────────────────────────────────────────────────────────────
function TerminalApp({ user, AC }) {
  const [lines, setLines] = useState([
    { t: "out", v: "NOVA Terminal v3.1.0" },
    { t: "out", v: "Session: " + user + " — " + new Date().toLocaleString() },
    { t: "out", v: "Type \"help\" for commands." },
    { t: "gap" },
  ]);
  const [cmd,  setCmd]  = useState("");
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef(null);

  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const CMDS = {
    help:     ()   => ["Commands: help, whoami, date, echo <text>, version, sysinfo, ls, neofetch, clear"],
    whoami:   ()   => [user],
    date:     ()   => [new Date().toLocaleString()],
    version:  ()   => ["NOVA OS v3.1.0 — Nova Systems Inc."],
    sysinfo:  ()   => ["CPU: Nova Virtual Core™", "RAM: 8.0 GB", "Storage: Firebase Firestore", "Resolution: " + window.innerWidth + "x" + window.innerHeight, "Uptime: " + Math.floor(performance.now() / 1000) + "s"],
    ls:       ()   => ["notes/    tasks/    paint/    browser/    settings/    .config"],
    neofetch: ()   => [
      " ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ",
      " ████╗  ██║██╔═══██╗██║   ██║██╔══██╗",
      " ██╔██╗ ██║██║   ██║██║   ██║███████║",
      " ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║",
      " ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║",
      "OS: Nova v3.1  User: " + user + "  Apps: " + APPS.length,
    ],
    echo:     args => [args.join(" ") || "(empty)"],
    clear:    ()   => "__clear__",
  };

  function run() {
    const raw = cmd.trim();
    if (!raw) return;
    const parts = raw.split(" ");
    const c = parts[0].toLowerCase();
    const args = parts.slice(1);
    setHist(h => [raw, ...h]);
    setHIdx(-1);
    setCmd("");
    const nl = [...lines, { t: "in", v: raw }];
    const handler = CMDS[c];
    if (!handler) {
      nl.push({ t: "err", v: c + ": not found. Try \"help\"." });
    } else {
      const result = handler(args);
      if (result === "__clear__") { setLines([]); return; }
      result.forEach(v => nl.push({ t: "out", v }));
    }
    nl.push({ t: "gap" });
    setLines(nl);
  }

  function onKey(e) {
    if (e.key === "Enter") { run(); return; }
    if (e.key === "ArrowUp")   { const i = Math.min(hIdx + 1, hist.length - 1); setHIdx(i); if (hist[i]) setCmd(hist[i]); }
    if (e.key === "ArrowDown") { const i = Math.max(hIdx - 1, -1); setHIdx(i); setCmd(i === -1 ? "" : (hist[i] || "")); }
  }

  return (
    <div style={{ width: 510, fontFamily: FFM }}>
      <div style={{ background: "#030407", borderRadius: 8, padding: "13px 15px", maxHeight: 340, overflowY: "auto", border: "1px solid rgba(255,255,255,0.07)" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.t === "in" ? AC : l.t === "err" ? "#ff7878" : "rgba(180,210,255,0.58)", fontSize: 12, marginBottom: l.t === "gap" ? 5 : 2, minHeight: l.t === "gap" ? 4 : undefined, whiteSpace: "pre" }}>
            {l.t === "in" ? "$ " + l.v : l.t === "gap" ? null : l.v}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: "#4cef90", marginRight: 7, fontSize: 12 }}>$</span>
          <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={onKey} autoFocus
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: AC, fontFamily: FFM, fontSize: 12, caretColor: AC }} />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsApp({ user, data, updateSettings, showToast, AC, onCustomWallpaper }) {
  const settings = (data && data.settings) ? data.settings : {};
  const fileRef  = useRef(null);

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast("File too large (max 8 MB)"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 900;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        onCustomWallpaper(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const wpId = settings.wallpaper || (data && data.wallpaper) || "bliss";

  return (
    <div style={{ width: 400, fontFamily: FF }}>

      {/* Accent color */}
      <div style={SECTION_LABEL}>Accent Color</div>
      <div style={{ display: "flex", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>
        {ACCENT_PRESETS.map(c => (
          <div key={c} className="ac-dot" onClick={() => { updateSettings({ accent: c }); showToast("Accent updated ✓"); }}
            style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: "pointer", border: AC === c ? "2.5px solid #fff" : "2.5px solid transparent", transition: "transform 0.12s, border 0.12s", boxSizing: "border-box" }} />
        ))}
        <input type="color" value={AC} onChange={e => updateSettings({ accent: e.target.value })}
          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", background: "none" }} title="Custom color" />
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginBottom: 20, fontFamily: FFM }}>Current: {AC}</div>

      {/* Wallpaper */}
      <div style={SECTION_LABEL}>Wallpaper</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
        {Object.entries(WALLPAPERS).filter(([k]) => k !== "custom").map(([k, w]) => (
          <div key={k} className="wp-sw" onClick={() => { updateSettings({ wallpaper: k }); showToast("Wallpaper: " + w.name + " ✓"); }}
            style={{ height: 52, borderRadius: 8, background: w.preview, cursor: "pointer", border: wpId === k ? "2.5px solid #fff" : "2px solid transparent", transition: "border 0.14s", boxSizing: "border-box", display: "flex", alignItems: "flex-end", padding: "5px 7px" }}>
            <span style={{ fontSize: 9, fontFamily: FFB, fontWeight: 600, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{w.name}</span>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
      <button onClick={() => fileRef.current.click()}
        style={{ width: "100%", padding: "10px", background: wpId === "custom" ? acFill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (wpId === "custom" ? acBorder(AC) : "rgba(255,255,255,0.12)"), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: wpId === "custom" ? AC : "rgba(255,255,255,0.6)", marginBottom: 22 }}>
        {wpId === "custom" ? "✓ Custom Wallpaper Active — Click to Change" : "📁 Upload Custom Wallpaper (PNG / JPG)"}
      </button>

      {/* Window blur */}
      <div style={SECTION_LABEL}>Window Blur</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <input type="range" min={0} max={30} value={settings.winBlur != null ? settings.winBlur : 18} onChange={e => updateSettings({ winBlur: Number(e.target.value) })} style={{ flex: 1, accentColor: AC }} />
        <span style={{ fontSize: 11, fontFamily: FFM, color: "rgba(255,255,255,0.4)", width: 32 }}>{settings.winBlur != null ? settings.winBlur : 18}px</span>
      </div>

      {/* Toggles */}
      <div style={SECTION_LABEL}>Display</div>
      <Toggle label="24-Hour Clock" value={!!settings.clock24h}  onChange={v => updateSettings({ clock24h:  v })} />
      <Toggle label="Large Text"    value={!!settings.largeFont} onChange={v => updateSettings({ largeFont: v })} />

      {/* Account */}
      <div style={{ ...SECTION_LABEL, marginTop: 22 }}>Account</div>
      <div style={{ padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Signed in as</div>
        <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 16, color: "#fff" }}>@{user}</div>
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileApp({ user, data, updateData, showToast, AC }) {
  const [bio, setBio] = useState((data && data.bio) ? data.bio : "");
  const joined     = (data && data.joined) ? new Date(data.joined).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) : "Unknown";
  const notesCount = (data && data.notes) ? data.notes.length : 0;
  const doneTasks  = (data && data.tasks) ? data.tasks.filter(t => t.done).length : 0;
  const totalTasks = (data && data.tasks) ? data.tasks.length : 0;

  return (
    <div style={{ width: 340, fontFamily: FF }}>
      <div style={SECTION_LABEL}>Profile</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ width: 62, height: 62, borderRadius: "50%", background: acFill(AC), border: "2px solid " + AC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 11 }}>👤</div>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 2 }}>@{user}</div>
        <div style={{ fontFamily: FFM, fontSize: 10, color: "rgba(255,255,255,0.28)" }}>Member since {joined}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        {[["📝", notesCount, "Notes"], ["✅", doneTasks + "/" + totalTasks, "Tasks"]].map(([ic, v, k]) => (
          <div key={k} style={{ padding: "11px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 10, marginBottom: 3 }}>{ic}</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 22, color: AC }}>{v}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>{k}</div>
          </div>
        ))}
      </div>
      <div style={SECTION_LABEL}>Bio</div>
      <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Write something about yourself…" style={{ ...INP_STYLE, minHeight: 64, marginBottom: 8 }} />
      <button onClick={() => { updateData({ bio }); showToast("Bio saved ✓"); }}
        style={{ width: "100%", padding: "9px", background: acFill(AC), border: "1px solid " + acBorder(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC }}>
        Save Bio
      </button>
    </div>
  );
}

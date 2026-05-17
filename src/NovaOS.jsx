// ─── NOVA OS v2.0 — Web Edition ───────────────────────────────────────────────
// Storage backend: Firebase Firestore (replaces Claude artifact window.storage)
// To add new apps: see the APPS array and the switch block in the Desktop section.
// To add new wallpapers: see the WALLPAPERS object.

import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "./firebase.js";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const WALLPAPERS = {
  bliss:  { name: "Bliss",        preview: "linear-gradient(180deg,#4a9fd1 45%,#6ec82e 45%)" },
  teal:   { name: "Classic Teal", preview: "#008080",                                           solid: "#008080" },
  night:  { name: "Night Sky",    preview: "radial-gradient(#1a1040,#03020d)",                  grad: "radial-gradient(ellipse at 50% 0%,#1a1040,#03020d)" },
  sakura: { name: "Sakura",       preview: "linear-gradient(160deg,#ffd6e7,#ff8fa3)",           grad: "linear-gradient(160deg,#ffd6e7 0%,#ffb3c6 50%,#ff8fa3 100%)" },
  forest: { name: "Forest",       preview: "radial-gradient(#1a5010,#061805)",                  grad: "radial-gradient(ellipse at 50% 100%,#1a5010,#061805)" },
};

// ── Add new apps here ─────────────────────────────────────────────────────────
const APPS = [
  { id: "notes",    icon: "📝", label: "Notes"    },
  { id: "tasks",    icon: "✅", label: "Tasks"    },
  { id: "profile",  icon: "👤", label: "Profile"  },
  { id: "terminal", icon: "💻", label: "Terminal" },
];

const BOOT_MSGS = [
  "NOVA OS v2.0 — Nova Systems",
  "Initializing kernel... OK",
  "Loading hardware drivers... OK",
  "Mounting filesystems... OK",
  "Starting network daemon... OK",
  "Loading session manager... OK",
  "System ready.",
];

// ─── STORAGE — Firestore backend ──────────────────────────────────────────────
// Keys like "user:alice:pw" are stored as Firestore doc IDs "user_alice_pw".
// All data lives in the "nova_storage" collection in your Firestore database.
// To change the collection name, edit the COLLECTION constant below.

const COLLECTION = "nova_storage";

const db = {
  async get(key) {
    try {
      const docId = key.replace(/[:/]/g, "_");
      const snap  = await getDoc(doc(firestoreDb, COLLECTION, docId));
      return snap.exists() ? snap.data().value : null;
    } catch (e) {
      console.error("db.get error:", e);
      return null;
    }
  },
  async set(key, val) {
    try {
      const docId = key.replace(/[:/]/g, "_");
      await setDoc(doc(firestoreDb, COLLECTION, docId), { value: val });
    } catch (e) {
      console.error("db.set error:", e);
    }
  },
};

// ─── BLISS SVG BACKGROUND ─────────────────────────────────────────────────────
function BlissBackground() {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1b5c90" />
          <stop offset="30%"  stopColor="#3990cc" />
          <stop offset="65%"  stopColor="#6ab6e8" />
          <stop offset="100%" stopColor="#a4d4f0" />
        </linearGradient>
        <linearGradient id="g-hb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#478c18" /><stop offset="100%" stopColor="#1e5007" />
        </linearGradient>
        <linearGradient id="g-hm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#57b820" /><stop offset="100%" stopColor="#27680e" />
        </linearGradient>
        <linearGradient id="g-hf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6cca2c" /><stop offset="100%" stopColor="#337a14" />
        </linearGradient>
        <linearGradient id="g-fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d8814" /><stop offset="100%" stopColor="#194807" />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#g-sky)" />
      {[[310,165,150,50],[278,158,100,37],[350,155,85,40],[970,128,120,40],[940,121,78,29],[1170,200,130,44],[1200,192,75,32],[95,255,85,30],[72,248,58,22]].map(([cx,cy,rx,ry],i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={`rgba(255,255,255,${0.42 + ((i % 3) * 0.09)})`} />
      ))}
      <path d="M0 590 Q200 450 430 530 Q630 610 860 480 Q1040 365 1210 445 Q1350 505 1440 460 L1440 900 L0 900Z" fill="url(#g-hb)" />
      <path d="M0 645 Q170 515 380 585 Q570 655 775 540 Q955 425 1155 505 Q1305 565 1440 522 L1440 900 L0 900Z" fill="url(#g-hm)" />
      <path d="M-10 725 Q70 640 190 658 Q310 678 440 730 Q615 796 808 682 Q955 598 1090 628 Q1230 658 1360 618 Q1415 605 1460 610 L1460 900 L-10 900Z" fill="url(#g-hf)" />
      <path d="M0 818 Q370 778 720 795 Q1020 810 1440 778 L1440 900 L0 900Z" fill="url(#g-fg)" />
    </svg>
  );
}

function Wallpaper({ id }) {
  const wp = WALLPAPERS[id];
  if (!id || id === "bliss" || !wp) return <BlissBackground />;
  if (wp.solid) return <div style={{ position: "absolute", inset: 0, background: wp.solid }} />;
  if (wp.grad)  return <div style={{ position: "absolute", inset: 0, background: wp.grad }} />;
  return <BlissBackground />;
}

// ─── SHARED MICRO-STYLES ─────────────────────────────────────────────────────
const inp = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, color: "rgba(255,255,255,0.92)", fontFamily: "'Nunito',sans-serif", fontSize: 14, outline: "none" };
const sHd = (a = "#60b8ff") => ({ fontFamily: "'VT323',monospace", fontSize: 20, letterSpacing: 2, color: a, marginBottom: 18 });
const sBt = (a = "#60b8ff") => ({ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.05)", border: `1px solid ${a}`, borderRadius: 4, cursor: "pointer", fontFamily: "'VT323',monospace", fontSize: 19, letterSpacing: 1, color: a });

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=VT323&family=Nunito:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.22); font-family: 'Nunito',sans-serif; font-size: 13px; }
  textarea { resize: vertical; }
  @keyframes boot-in  { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }
  @keyframes win-pop  { from { opacity:0; transform:scale(0.95) translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes notif-in { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:none; } }
  .dsk-icon:hover  { background: rgba(255,255,255,0.18) !important; border-color: rgba(255,255,255,0.32) !important; }
  .dsk-icon:active { transform: scale(0.93) !important; }
  .tb-btn:hover    { background: rgba(255,255,255,0.18) !important; }
  .win-x:hover     { background: #c42b1c !important; }
  .app-abtn:hover  { background: rgba(255,255,255,0.12) !important; }
  .logout-btn:hover  { background: rgba(200,40,40,0.2) !important; }
  .ltab:hover        { color: rgba(140,200,255,0.82) !important; }
  .lsubmit:hover:not(:disabled) { background: rgba(0,90,160,0.28) !important; }
`;

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function NovaOS() {
  const [screen,    setScreen]    = useState("boot");
  const [bootLines, setBootLines] = useState([]);
  const [mode,      setMode]      = useState("login");
  const [uname,     setUname]     = useState("");
  const [pass,      setPass]      = useState("");
  const [err,       setErr]       = useState("");
  const [busy,      setBusy]      = useState(false);
  const [user,      setUser]      = useState(null);
  const [data,      setData]      = useState(null);
  const [wins,      setWins]      = useState([]);
  const [maxZ,      setMaxZ]      = useState(100);
  const [tick,      setTick]      = useState(new Date());
  const [notif,     setNotif]     = useState(null);
  const [drag,      setDrag]      = useState(null);
  const winsRef = useRef(wins);
  useEffect(() => { winsRef.current = wins; }, [wins]);

  // Boot sequence
  useEffect(() => {
    let i = 0, dead = false;
    const next = () => {
      if (dead) return;
      if (i >= BOOT_MSGS.length) { setTimeout(() => { if (!dead) setScreen("login"); }, 700); return; }
      setBootLines(p => [...p, BOOT_MSGS[i++]]);
      setTimeout(next, i < 2 ? 90 : 265);
    };
    setTimeout(next, 380);
    return () => { dead = true; };
  }, []);

  // Clock
  useEffect(() => { const t = setInterval(() => setTick(new Date()), 1000); return () => clearInterval(t); }, []);

  // Global drag handlers
  useEffect(() => {
    const move = (e) => {
      if (!drag) return;
      setWins(ws => ws.map(w => w.id === drag.id
        ? { ...w, x: Math.max(0, e.clientX - drag.ox), y: Math.max(0, Math.min(e.clientY - drag.oy, window.innerHeight - 80)) }
        : w));
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [drag]);

  const showNotif  = useCallback((msg) => { setNotif(msg); setTimeout(() => setNotif(null), 2500); }, []);
  const saveData   = useCallback(async (d) => { if (user) await db.set(`user:${user}:data`, d); }, [user]);
  const updateData = useCallback((patch) => {
    setData(prev => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      saveData(next);
      return next;
    });
  }, [saveData]);

  const focusWin = useCallback((id) => {
    setMaxZ(z => { const nz = z + 1; setWins(ws => ws.map(w => w.id === id ? { ...w, z: nz } : w)); return nz; });
  }, []);

  const openApp = useCallback((appId) => {
    setMaxZ(z => {
      const nz = z + 1;
      setWins(ws => {
        const ex = ws.find(w => w.app === appId);
        if (ex) return ws.map(w => w.id === ex.id ? { ...w, z: nz } : w);
        const n = ws.length % 6;
        return [...ws, { id: Date.now() + Math.random(), app: appId, z: nz, x: 110 + n * 28, y: 42 + n * 22 }];
      });
      return nz;
    });
  }, []);

  const startDrag = (e, winId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const w = winsRef.current.find(w => w.id === winId);
    if (w) { setDrag({ id: winId, ox: e.clientX - w.x, oy: e.clientY - w.y }); focusWin(winId); }
  };

  const closeWin = (id) => setWins(ws => ws.filter(w => w.id !== id));

  const handleAuth = async () => {
    const u = uname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const p = pass.trim();
    if (!u || !p) { setErr("All fields required."); return; }
    if (u.length < 3) { setErr("Username needs 3+ characters."); return; }
    setBusy(true); setErr("");
    if (mode === "register") {
      const exists = await db.get(`user:${u}:pw`);
      if (exists !== null) { setErr("Username already taken."); setBusy(false); return; }
      await db.set(`user:${u}:pw`, p);
      const init = { notes: [], tasks: [], wallpaper: "bliss", bio: "", joined: Date.now() };
      await db.set(`user:${u}:data`, init);
      setUser(u); setData(init); setScreen("desktop");
    } else {
      const stored = await db.get(`user:${u}:pw`);
      if (stored === null) { setErr("Account not found."); setBusy(false); return; }
      if (stored !== p)    { setErr("Incorrect password."); setBusy(false); return; }
      const d = await db.get(`user:${u}:data`);
      setUser(u); setData(d || { notes: [], tasks: [], wallpaper: "bliss", bio: "", joined: Date.now() }); setScreen("desktop");
    }
    setBusy(false);
  };

  const logout = () => {
    setUser(null); setData(null); setWins([]); setMaxZ(100);
    setUname(""); setPass(""); setErr(""); setMode("login"); setScreen("login");
  };

  const fmtTime = d => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = d => d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  // ── BOOT ─────────────────────────────────────────────────────────────────
  if (screen === "boot") return (
    <div style={{ width: "100%", height: "100vh", background: "#000", display: "flex", flexDirection: "column", justifyContent: "center", padding: "10vh 12%" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ fontFamily: "'VT323',monospace", fontSize: 78, letterSpacing: 14, color: "#00aaee", marginBottom: 2 }}>NOVA</div>
      <div style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: "rgba(0,170,238,0.38)", letterSpacing: 5, marginBottom: 46 }}>OPERATING SYSTEM  v2.0</div>
      {bootLines.map((l, i) => (
        <div key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: l.includes("ready") ? "#00ee80" : "rgba(0,210,230,0.72)", marginBottom: 5, animation: "boot-in 0.14s ease-out" }}>
          {l.includes("OK") ? <>{`> ${l.replace("... OK", "")}`}... <span style={{ color: "#00ee80" }}>OK</span></> : `> ${l}`}
        </div>
      ))}
    </div>
  );

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (screen === "login") return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <BlissBackground />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "rgba(8,14,32,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "44px 40px", width: 372, boxShadow: "0 32px 80px rgba(0,0,0,0.55)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#0050a0,#00aaee,#0050a0)" }} />
          <div style={{ fontFamily: "'VT323',monospace", fontSize: 52, letterSpacing: 12, color: "#d8eeff", textAlign: "center", marginBottom: 2 }}>NOVA</div>
          <div style={{ fontFamily: "'VT323',monospace", fontSize: 14, color: "rgba(150,205,255,0.42)", textAlign: "center", letterSpacing: 4, marginBottom: 34 }}>OS  v2.0</div>

          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 22 }}>
            {["login", "register"].map(m => (
              <button key={m} className="ltab" onClick={() => { setMode(m); setErr(""); }}
                style={{ flex: 1, padding: "9px 0", background: "none", border: "none", borderBottom: mode === m ? "2px solid #00aaee" : "2px solid transparent", cursor: "pointer", fontFamily: "'VT323',monospace", fontSize: 20, letterSpacing: 2, color: mode === m ? "#00aaee" : "rgba(140,200,255,0.36)", transition: "color 0.14s" }}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <input style={{ ...inp, marginBottom: 12 }} placeholder="USERNAME" value={uname} onChange={e => setUname(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} autoFocus />
          <input style={{ ...inp, marginBottom: 4  }} type="password" placeholder="PASSWORD" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />

          <button className="lsubmit" disabled={busy} onClick={handleAuth}
            style={{ width: "100%", padding: 12, background: "rgba(0,80,150,0.18)", border: "1px solid rgba(0,160,230,0.5)", borderRadius: 4, cursor: "pointer", fontFamily: "'VT323',monospace", fontSize: 22, letterSpacing: 2, color: "#80d4ff", marginTop: 14, transition: "background 0.14s" }}>
            {busy ? "AUTHENTICATING..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
          {err && <div style={{ color: "#ff7878", fontFamily: "'Nunito',sans-serif", fontSize: 13, textAlign: "center", marginTop: 12 }}>⚠ {err}</div>}

          <div style={{ marginTop: 18, fontFamily: "'Nunito',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.16)", textAlign: "center", lineHeight: 1.6 }}>
            ⚠ Do not reuse real passwords — stored in plain text for demo purposes.
          </div>
        </div>
      </div>
    </div>
  );

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden", cursor: drag ? "grabbing" : "default" }}>
      <style>{GLOBAL_CSS}</style>
      <Wallpaper id={data?.wallpaper} />

      {notif && (
        <div style={{ position: "fixed", top: 14, right: 14, zIndex: 99999, padding: "10px 18px", background: "rgba(8,14,32,0.97)", border: "1px solid rgba(0,160,230,0.7)", borderRadius: 6, fontFamily: "'VT323',monospace", fontSize: 19, letterSpacing: 1, color: "#80d4ff", animation: "notif-in 0.18s ease-out", boxShadow: "0 8px 32px rgba(0,0,0,0.55)" }}>
          {notif}
        </div>
      )}

      {/* Desktop icons — add new app icons here */}
      <div style={{ position: "absolute", top: 16, left: 14, display: "grid", gridTemplateColumns: "repeat(2,84px)", gap: 10, zIndex: 1 }}>
        {APPS.map(app => (
          <div key={app.id} className="dsk-icon" onDoubleClick={() => openApp(app.id)} title={`Double-click: ${app.label}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 6px", borderRadius: 6, cursor: "pointer", userSelect: "none", border: "1px solid transparent", transition: "background 0.12s,border 0.12s" }}>
            <span style={{ fontSize: 30, filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.65))" }}>{app.icon}</span>
            <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11, color: "#fff", textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,1),0 0 10px rgba(0,0,0,0.9)" }}>{app.label}</span>
          </div>
        ))}
        <div style={{ gridColumn: "span 2", fontFamily: "'VT323',monospace", fontSize: 11, color: "rgba(255,255,255,0.28)", textAlign: "center", letterSpacing: 1, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>DBL-CLICK TO OPEN</div>
      </div>

      {/* Open windows */}
      {wins.map(win => {
        const app = APPS.find(a => a.id === win.app);
        const isDragging = drag?.id === win.id;
        return (
          <div key={win.id} onClick={() => focusWin(win.id)}
            style={{ position: "absolute", left: win.x, top: win.y, zIndex: win.z, background: "rgba(8,14,30,0.95)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 8, boxShadow: `0 ${isDragging ? 30 : 20}px ${isDragging ? 100 : 70}px rgba(0,0,0,${isDragging ? 0.8 : 0.65}),0 0 0 1px rgba(255,255,255,0.05)`, display: "flex", flexDirection: "column", animation: "win-pop 0.15s ease-out", minWidth: 320, backdropFilter: "blur(8px)", transition: "box-shadow 0.1s" }}>
            {/* Titlebar / drag handle */}
            <div onMouseDown={e => startDrag(e, win.id)}
              style={{ height: 36, display: "flex", alignItems: "center", padding: "0 10px", gap: 8, background: "linear-gradient(90deg,rgba(0,50,110,0.88),rgba(0,35,80,0.88))", borderBottom: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px 8px 0 0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}>
              <div className="win-x" onClick={e => { e.stopPropagation(); closeWin(win.id); }}
                style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(200,200,200,0.18)", border: "1px solid rgba(255,255,255,0.22)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "rgba(255,255,255,0.7)", lineHeight: 1, transition: "background 0.12s", flexShrink: 0 }}>✕</div>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(200,200,200,0.1)", border: "1px solid rgba(255,255,255,0.16)", flexShrink: 0 }} />
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(200,200,200,0.1)", border: "1px solid rgba(255,255,255,0.16)", flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: "center", fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.9)", marginRight: 42, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                {app?.icon} {app?.label}
              </div>
            </div>
            <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>
              {/* ── Add new app content renderers here ── */}
              {win.app === "notes"    && <NotesApp    data={data} updateData={updateData} showNotif={showNotif} />}
              {win.app === "tasks"    && <TasksApp    data={data} updateData={updateData} showNotif={showNotif} />}
              {win.app === "profile"  && <ProfileApp  user={user} data={data} updateData={updateData} />}
              {win.app === "terminal" && <TerminalApp user={user} />}
            </div>
          </div>
        );
      })}

      {/* Taskbar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 44, background: "linear-gradient(180deg,rgba(8,24,54,0.97) 0%,rgba(4,12,28,0.99) 100%)", backdropFilter: "blur(10px)", borderTop: "1px solid rgba(0,110,200,0.28)", display: "flex", alignItems: "center", padding: "0 12px", gap: 8, zIndex: 9999 }}>
        <div style={{ fontFamily: "'VT323',monospace", fontSize: 22, letterSpacing: 2, color: "#60b8ff", marginRight: 6, cursor: "default" }}>◈ NOVA v2.0</div>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
        {wins.map(win => {
          const app = APPS.find(a => a.id === win.app);
          return (
            <button key={win.id} className="tb-btn" onClick={() => focusWin(win.id)}
              style={{ height: 30, padding: "0 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 4, cursor: "pointer", fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap", transition: "background 0.12s" }}>
              {app?.icon} {app?.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: "'VT323',monospace", fontSize: 17, color: "#60b8ff", letterSpacing: 1 }}>@{user}</div>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "right", lineHeight: 1.5 }}>
          <div>{fmtTime(tick)}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{fmtDate(tick)}</div>
        </div>
        <button className="logout-btn" onClick={logout}
          style={{ height: 28, padding: "0 10px", background: "rgba(200,40,40,0.1)", border: "1px solid rgba(200,40,40,0.28)", borderRadius: 4, cursor: "pointer", fontFamily: "'VT323',monospace", fontSize: 17, color: "rgba(255,130,130,0.8)", transition: "background 0.12s" }}>
          LOGOUT
        </button>
      </div>
    </div>
  );
}

// ─── NOTES APP ────────────────────────────────────────────────────────────────
function NotesApp({ data, updateData, showNotif }) {
  const [title, setTitle] = useState("");
  const [body,  setBody]  = useState("");

  const add = () => {
    if (!title.trim()) return;
    updateData(p => ({ ...p, notes: [{ id: Date.now(), title: title.trim(), body: body.trim(), ts: Date.now() }, ...(p.notes || [])] }));
    setTitle(""); setBody(""); showNotif("Note saved ✓");
  };
  const del = id => updateData(p => ({ ...p, notes: p.notes.filter(n => n.id !== id) }));
  const notes = data?.notes || [];

  return (
    <div style={{ width: 390, fontFamily: "'Nunito',sans-serif" }}>
      <div style={sHd()}>// NOTES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title..." style={inp} onKeyDown={e => e.key === "Enter" && add()} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Content..." style={{ ...inp, minHeight: 72 }} />
        <button className="app-abtn" onClick={add} style={sBt()}>+ ADD NOTE</button>
      </div>
      {notes.length === 0 && <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 13, textAlign: "center", padding: "22px 0", fontStyle: "italic" }}>No notes yet — create one above!</div>}
      {notes.map(n => (
        <div key={n.id} style={{ padding: "12px 14px", marginBottom: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, position: "relative" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: n.body ? 4 : 0, color: "rgba(255,255,255,0.92)", paddingRight: 24 }}>{n.title}</div>
          {n.body && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</div>}
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>{new Date(n.ts).toLocaleDateString()}</div>
          <button onClick={() => del(n.id)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.5)", fontSize: 14 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── TASKS APP ────────────────────────────────────────────────────────────────
function TasksApp({ data, updateData, showNotif }) {
  const [input, setInput] = useState("");
  const add    = () => { if (!input.trim()) return; updateData(p => ({ ...p, tasks: [...(p.tasks || []), { id: Date.now(), text: input.trim(), done: false }] })); setInput(""); showNotif("Task added ✓"); };
  const toggle = id => updateData(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  const del    = id => updateData(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) }));
  const tasks = data?.tasks || []; const pending = tasks.filter(t => !t.done); const done = tasks.filter(t => t.done);

  return (
    <div style={{ width: 370, fontFamily: "'Nunito',sans-serif" }}>
      <div style={sHd()}>// TASKS</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="New task..." style={{ ...inp, flex: 1 }} onKeyDown={e => e.key === "Enter" && add()} />
        <button onClick={add} style={{ ...sBt(), width: 42, padding: 0, fontSize: 24 }}>+</button>
      </div>
      {tasks.length === 0 && <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 13, textAlign: "center", padding: "22px 0", fontStyle: "italic" }}>No tasks — you're all clear!</div>}
      {pending.map(t => <TRow key={t.id} t={t} toggle={toggle} del={del} />)}
      {done.length > 0 && <>
        <div style={{ fontFamily: "'VT323',monospace", fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.24)", margin: "16px 0 8px" }}>COMPLETED</div>
        {done.map(t => <TRow key={t.id} t={t} toggle={toggle} del={del} />)}
      </>}
    </div>
  );
}

function TRow({ t, toggle, del }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", marginBottom: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, opacity: t.done ? 0.42 : 1, transition: "opacity 0.2s" }}>
      <div onClick={() => toggle(t.id)} style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${t.done ? "#60b8ff" : "rgba(255,255,255,0.22)"}`, background: t.done ? "#60b8ff" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.14s" }}>
        {t.done && <span style={{ color: "#000", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ flex: 1, fontSize: 14, fontFamily: "'Nunito',sans-serif", color: "rgba(255,255,255,0.88)", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
      <button onClick={() => del(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.45)", fontSize: 14, padding: 0 }}>✕</button>
    </div>
  );
}

// ─── PROFILE APP ─────────────────────────────────────────────────────────────
function ProfileApp({ user, data, updateData }) {
  const [bio, setBio] = useState(data?.bio || "");
  const joined     = data?.joined ? new Date(data.joined).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) : "Unknown";
  const notesCount = data?.notes?.length || 0;
  const tasksDone  = data?.tasks?.filter(t => t.done).length || 0;
  const tasksTotal = data?.tasks?.length || 0;

  return (
    <div style={{ width: 350, fontFamily: "'Nunito',sans-serif" }}>
      <div style={sHd()}>// PROFILE</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(96,184,255,0.14)", border: "2px solid #60b8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 12 }}>👤</div>
        <div style={{ fontFamily: "'VT323',monospace", fontSize: 26, color: "#80d4ff", marginBottom: 3 }}>@{user}</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: 1 }}>Member since {joined}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[["📝", notesCount, "Notes"], ["✅", `${tasksDone}/${tasksTotal}`, "Tasks done"]].map(([ic, v, k]) => (
          <div key={k} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{ic}</div>
            <div style={{ fontFamily: "'VT323',monospace", fontSize: 28, color: "#60b8ff" }}>{v}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{k}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "'VT323',monospace", fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>BIO</div>
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Write something about yourself..." style={{ ...inp, minHeight: 60 }} />
        <button className="app-abtn" onClick={() => updateData({ bio })} style={{ ...sBt(), marginTop: 8 }}>SAVE BIO</button>
      </div>
      <div>
        <div style={{ fontFamily: "'VT323',monospace", fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>WALLPAPER</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {Object.entries(WALLPAPERS).map(([k, w]) => (
            <div key={k} onClick={() => updateData({ wallpaper: k })} title={w.name}
              style={{ height: 38, borderRadius: 5, background: w.preview, cursor: "pointer", border: data?.wallpaper === k ? "2.5px solid #fff" : "2.5px solid transparent", transition: "border 0.14s", opacity: 0.9 }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginTop: 4 }}>
          {Object.entries(WALLPAPERS).map(([k, w]) => (
            <div key={k} style={{ fontFamily: "'VT323',monospace", fontSize: 11, color: "rgba(255,255,255,0.28)", textAlign: "center" }}>{w.name.split(" ")[0]}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TERMINAL APP ─────────────────────────────────────────────────────────────
function TerminalApp({ user }) {
  const [lines,   setLines]   = useState([
    { t: "out", v: "NOVA Terminal v2.0.0" },
    { t: "out", v: `Session: ${user} — ${new Date().toLocaleString()}` },
    { t: "out", v: 'Type "help" for commands.' },
    { t: "gap" },
  ]);
  const [cmd,     setCmd]     = useState("");
  const [history, setHistory] = useState([]);
  const [hIdx,    setHIdx]    = useState(-1);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const CMDS = {
    help:    ()   => ["Commands: help, whoami, date, echo <text>, version, sysinfo, ls, clear"],
    whoami:  ()   => [user],
    date:    ()   => [new Date().toLocaleString()],
    version: ()   => ["NOVA OS v2.0.0 — Nova Systems Inc."],
    sysinfo: ()   => [`CPU: Nova Virtual Core™`, `RAM: 8.0 GB (simulated)`, `Storage: Firebase Firestore`, `Uptime: ${Math.floor(performance.now() / 1000)}s`],
    ls:      ()   => ["notes/    tasks/    profile/    .config    .session"],
    echo:    args => [args.join(" ") || "(empty)"],
    clear:   ()   => "__clear__",
  };

  const run = () => {
    const raw = cmd.trim(); if (!raw) return;
    const parts = raw.split(" "); const c = parts[0].toLowerCase(); const args = parts.slice(1);
    setHistory(h => [raw, ...h]); setHIdx(-1); setCmd("");
    const nl = [...lines, { t: "in", v: raw }];
    const handler = CMDS[c];
    if (!handler) { nl.push({ t: "err", v: `${c}: not found. Try "help".` }); }
    else { const r = handler(args); if (r === "__clear__") { setLines([]); return; } r.forEach(v => nl.push({ t: "out", v })); }
    nl.push({ t: "gap" });
    setLines(nl);
  };

  const onKey = e => {
    if (e.key === "Enter") { run(); return; }
    if (e.key === "ArrowUp")   { const i = Math.min(hIdx + 1, history.length - 1); setHIdx(i); if (history[i]) setCmd(history[i]); }
    if (e.key === "ArrowDown") { const i = Math.max(hIdx - 1, -1); setHIdx(i); setCmd(i === -1 ? "" : (history[i] || "")); }
  };

  return (
    <div style={{ width: 470, fontFamily: "'JetBrains Mono',monospace" }}>
      <div style={{ background: "#020406", borderRadius: 5, padding: "14px 16px", maxHeight: 300, overflowY: "auto", border: "1px solid rgba(255,255,255,0.06)" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.t === "in" ? "#60b8ff" : l.t === "err" ? "#ff7878" : "rgba(0,210,220,0.65)", fontSize: 13, marginBottom: l.t === "gap" ? 6 : 2, minHeight: l.t === "gap" ? 4 : undefined }}>
            {l.t === "in" ? `$ ${l.v}` : l.t === "gap" ? undefined : l.v}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: "#00ee80", marginRight: 8, fontSize: 13 }}>$</span>
          <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={onKey} autoFocus
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#60b8ff", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, caretColor: "#60b8ff" }} />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

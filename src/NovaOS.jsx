// ╔══════════════════════════════════════════════════════╗
// ║           NOVA OS v3.0  —  Nova Systems              ║
// ║  Drop this file into src/NovaOS.jsx in your project  ║
// ╚══════════════════════════════════════════════════════╝
 
import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "./firebase.js";
 
// ─── PALETTE & CONFIG ────────────────────────────────────────────────────────
const AC   = "#4f9eff";              // primary accent
const AC2  = "rgba(79,158,255,0.18)"; // accent fill
 
const WALLPAPERS = {
  bliss:  { name:"Bliss",   preview:"linear-gradient(180deg,#4a9fd1 44%,#6ec82e 44%)" },
  night:  { name:"Night",   preview:"radial-gradient(#1a0f40,#03020d)", grad:"radial-gradient(ellipse at 50% 0%,#1a0f40,#03020d)" },
  sakura: { name:"Sakura",  preview:"linear-gradient(155deg,#ffd6e7,#ff8fa3)", grad:"linear-gradient(155deg,#ffd6e7,#ffb3c6,#ff8fa3)" },
  forest: { name:"Forest",  preview:"radial-gradient(#1a5010,#051204)", grad:"radial-gradient(ellipse at 50% 100%,#1a5010,#051204)" },
  slate:  { name:"Slate",   preview:"linear-gradient(135deg,#1e2235,#0f1219)", grad:"linear-gradient(135deg,#1e2235,#0f1219)" },
};
 
const APPS = [
  { id:"notes",    icon:"📝", label:"Notes",    desc:"Write & save notes" },
  { id:"tasks",    icon:"✅", label:"Tasks",    desc:"Manage to-dos" },
  { id:"files",    icon:"📁", label:"Files",    desc:"Browse your files" },
  { id:"paint",    icon:"🎨", label:"Paint",    desc:"Draw & create" },
  { id:"browser",  icon:"🌐", label:"Browser",  desc:"Browse the web" },
  { id:"terminal", icon:"💻", label:"Terminal", desc:"System terminal" },
  { id:"profile",  icon:"👤", label:"Profile",  desc:"Your account" },
];
 
const BOOT = [
  "NOVA OS v3.0 — Nova Systems",
  "Initializing kernel... OK",
  "Loading hardware abstraction layer... OK",
  "Mounting virtual filesystems... OK",
  "Starting window compositor... OK",
  "Loading user environment... OK",
  "System ready.",
];
 
// ─── STORAGE ─────────────────────────────────────────────────────────────────
const COLL = "nova_storage";
const db = {
  async get(k) {
    try {
      const s = await getDoc(doc(firestoreDb, COLL, k.replace(/[:/]/g,"_")));
      return s.exists() ? s.data().value : null;
    } catch { return null; }
  },
  async set(k,v) {
    try { await setDoc(doc(firestoreDb, COLL, k.replace(/[:/]/g,"_")), { value:v }); } catch {}
  },
};
 
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function rgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}
 
// ─── BLISS BACKGROUND ────────────────────────────────────────────────────────
function BlissBackground() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b5c90"/><stop offset="30%" stopColor="#3990cc"/>
          <stop offset="65%" stopColor="#6ab6e8"/><stop offset="100%" stopColor="#a4d4f0"/>
        </linearGradient>
        <linearGradient id="ghb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#478c18"/><stop offset="100%" stopColor="#1e5007"/></linearGradient>
        <linearGradient id="ghm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#57b820"/><stop offset="100%" stopColor="#27680e"/></linearGradient>
        <linearGradient id="ghf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cca2c"/><stop offset="100%" stopColor="#337a14"/></linearGradient>
        <linearGradient id="gfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d8814"/><stop offset="100%" stopColor="#194807"/></linearGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#gsky)"/>
      {[[310,165,150,50],[278,158,100,37],[350,155,85,40],[970,128,120,40],[940,121,78,29],[1170,200,130,44],[1200,192,75,32],[95,255,85,30]].map(([cx,cy,rx,ry],i)=>(
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={`rgba(255,255,255,${0.42+(i%3)*0.09})`}/>
      ))}
      <path d="M0 590 Q200 450 430 530 Q630 610 860 480 Q1040 365 1210 445 Q1350 505 1440 460 L1440 900 L0 900Z" fill="url(#ghb)"/>
      <path d="M0 645 Q170 515 380 585 Q570 655 775 540 Q955 425 1155 505 Q1305 565 1440 522 L1440 900 L0 900Z" fill="url(#ghm)"/>
      <path d="M-10 725 Q70 640 190 658 Q310 678 440 730 Q615 796 808 682 Q955 598 1090 628 Q1230 658 1360 618 L1460 610 L1460 900 L-10 900Z" fill="url(#ghf)"/>
      <path d="M0 818 Q370 778 720 795 Q1020 810 1440 778 L1440 900 L0 900Z" fill="url(#gfg)"/>
    </svg>
  );
}
 
function Wallpaper({ id }) {
  const w = WALLPAPERS[id];
  if (!id || id==="bliss" || !w) return <BlissBackground/>;
  if (w.solid) return <div style={{position:"absolute",inset:0,background:w.solid}}/>;
  return <div style={{position:"absolute",inset:0,background:w.grad}}/>;
}
 
// ─── SHARED MICRO-STYLES ─────────────────────────────────────────────────────
const inp  = { width:"100%", padding:"9px 13px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.13)", borderRadius:7, color:"rgba(255,255,255,0.92)", fontFamily:"'Figtree',sans-serif", fontSize:14, outline:"none" };
const sHd  = { fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, letterSpacing:2, color:"rgba(255,255,255,0.35)", marginBottom:14, textTransform:"uppercase" };
const crd  = { padding:"12px 14px", marginBottom:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, position:"relative" };
 
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Figtree:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px;}
  input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2);font-family:'Figtree',sans-serif;}
  textarea{resize:vertical;}
  @keyframes boot-in {from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
  @keyframes win-in  {from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:none}}
  @keyframes menu-up {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes toast   {from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
  .dsk-icon:hover  {background:rgba(255,255,255,0.15)!important;}
  .dsk-icon:active {transform:scale(0.9)!important;}
  .tb-app:hover    {background:rgba(255,255,255,0.14)!important;}
  .winx:hover      {background:#c42b1c!important;color:#fff!important;}
  .abtn:hover      {opacity:0.8!important;}
  .del-btn:hover   {color:rgba(255,80,80,0.9)!important;}
  .menu-app:hover  {background:rgba(255,255,255,0.09)!important;}
  .lsubmit:hover:not(:disabled){opacity:0.85!important;}
  .ltab:hover      {color:rgba(160,210,255,0.9)!important;}
  .start-btn:hover {background:rgba(255,255,255,0.12)!important;}
  .paint-swatch:hover{transform:scale(1.2);outline:2px solid #fff;}
  .file-row:hover  {background:rgba(255,255,255,0.07)!important;}
  .bm-btn:hover    {background:rgba(255,255,255,0.12)!important;}
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
  const [toast,     setToast]     = useState(null);
  const [drag,      setDrag]      = useState(null);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [search,    setSearch]    = useState("");
  const menuRef  = useRef(null);
  const winsRef  = useRef(wins);
  useEffect(() => { winsRef.current = wins; }, [wins]);
 
  // Boot sequence
  useEffect(() => {
    let i=0, dead=false;
    const next = () => {
      if (dead) return;
      if (i >= BOOT.length) { setTimeout(()=>{ if(!dead) setScreen("login"); }, 700); return; }
      setBootLines(p => [...p, BOOT[i++]]);
      setTimeout(next, i<2 ? 80 : 240);
    };
    setTimeout(next, 350);
    return () => { dead=true; };
  }, []);
 
  // Clock
  useEffect(() => { const t=setInterval(()=>setTick(new Date()),1000); return()=>clearInterval(t); }, []);
 
  // Close start menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);
 
  // Global drag handlers
  useEffect(() => {
    const move = (e) => {
      if (!drag) return;
      setWins(ws => ws.map(w => w.id===drag.id
        ? {...w, x:Math.max(0,e.clientX-drag.ox), y:Math.max(0,Math.min(e.clientY-drag.oy,window.innerHeight-80))}
        : w));
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove",move);
    window.addEventListener("mouseup",up);
    return () => { window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",up); };
  }, [drag]);
 
  const showToast  = useCallback((msg) => { setToast(msg); setTimeout(()=>setToast(null),2400); }, []);
  const saveData   = useCallback(async (d) => { if(user) await db.set(`user:${user}:data`,d); }, [user]);
  const updateData = useCallback((patch) => {
    setData(prev => { const next=typeof patch==="function"?patch(prev):{...prev,...patch}; saveData(next); return next; });
  }, [saveData]);
 
  const focusWin = useCallback((id) => {
    setMaxZ(z => { const nz=z+1; setWins(ws=>ws.map(w=>w.id===id?{...w,z:nz}:w)); return nz; });
  }, []);
 
  const openApp = useCallback((appId) => {
    setMenuOpen(false);
    setMaxZ(z => {
      const nz=z+1;
      setWins(ws => {
        const ex=ws.find(w=>w.app===appId);
        if (ex) return ws.map(w=>w.id===ex.id?{...w,z:nz}:w);
        const n=ws.length%6;
        return [...ws, {id:Date.now()+Math.random(), app:appId, z:nz, x:120+n*28, y:36+n*22}];
      });
      return nz;
    });
  }, []);
 
  const startDrag = (e, winId) => {
    if (e.button!==0) return;
    e.preventDefault();
    const w=winsRef.current.find(w=>w.id===winId);
    if (w) { setDrag({id:winId, ox:e.clientX-w.x, oy:e.clientY-w.y}); focusWin(winId); }
  };
 
  const closeWin = (id) => setWins(ws=>ws.filter(w=>w.id!==id));
 
  const handleAuth = async () => {
    const u=uname.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    const p=pass.trim();
    if (!u||!p) { setErr("All fields required."); return; }
    if (u.length<3) { setErr("Username needs 3+ characters."); return; }
    setBusy(true); setErr("");
    if (mode==="register") {
      const exists=await db.get(`user:${u}:pw`);
      if (exists!==null) { setErr("Username already taken."); setBusy(false); return; }
      await db.set(`user:${u}:pw`,p);
      const init={notes:[],tasks:[],wallpaper:"bliss",bio:"",joined:Date.now()};
      await db.set(`user:${u}:data`,init);
      setUser(u); setData(init); setScreen("desktop");
    } else {
      const stored=await db.get(`user:${u}:pw`);
      if (stored===null) { setErr("Account not found."); setBusy(false); return; }
      if (stored!==p)    { setErr("Incorrect password."); setBusy(false); return; }
      const d=await db.get(`user:${u}:data`);
      setUser(u); setData(d||{notes:[],tasks:[],wallpaper:"bliss",bio:"",joined:Date.now()}); setScreen("desktop");
    }
    setBusy(false);
  };
 
  const logout = () => {
    setUser(null); setData(null); setWins([]); setMaxZ(100); setMenuOpen(false);
    setUname(""); setPass(""); setErr(""); setMode("login"); setScreen("login");
  };
 
  const fmtTime = d => d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const fmtDate = d => d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
  const filteredApps = APPS.filter(a => a.label.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()));
 
  // ── BOOT ───────────────────────────────────────────────────────────────────
  if (screen==="boot") return (
    <div style={{width:"100%",height:"100vh",background:"#050508",display:"flex",flexDirection:"column",justifyContent:"center",padding:"10vh 12%"}}>
      <style>{CSS}</style>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:70,letterSpacing:8,color:"#fff",marginBottom:4,lineHeight:1}}>NOVA</div>
      <div style={{fontFamily:"'Figtree',sans-serif",fontWeight:500,fontSize:13,color:"rgba(255,255,255,0.25)",letterSpacing:6,marginBottom:48}}>OPERATING SYSTEM  ·  V3.0</div>
      {bootLines.map((l,i)=>(
        <div key={i} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:l.includes("ready")?"#4f9eff":"rgba(255,255,255,0.45)",marginBottom:6,animation:"boot-in 0.14s ease-out"}}>
          {l.includes("OK")?<>{l.replace("... OK","")}... <span style={{color:"#4cef90"}}>OK</span></>:l}
        </div>
      ))}
    </div>
  );
 
  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (screen==="login") return (
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <BlissBackground/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"rgba(8,10,22,0.84)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:18,padding:"46px 42px",width:380,boxShadow:"0 40px 100px rgba(0,0,0,0.6)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${AC},transparent)`}}/>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:42,color:"#fff",textAlign:"center",letterSpacing:6,marginBottom:4}}>NOVA</div>
          <div style={{fontFamily:"'Figtree',sans-serif",fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.25)",textAlign:"center",letterSpacing:4,marginBottom:38}}>OPERATING SYSTEM  ·  V3.0</div>
 
          <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.09)",marginBottom:26}}>
            {["login","register"].map(m=>(
              <button key={m} className="ltab" onClick={()=>{setMode(m);setErr("");}}
                style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:mode===m?`2px solid ${AC}`:"2px solid transparent",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,letterSpacing:2,color:mode===m?AC:"rgba(255,255,255,0.28)",transition:"color 0.15s"}}>
                {m==="login"?"SIGN IN":"REGISTER"}
              </button>
            ))}
          </div>
 
          <input style={{...inp,marginBottom:12}} placeholder="Username" value={uname}
            onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} autoFocus/>
          <input style={{...inp}} type="password" placeholder="Password" value={pass}
            onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
 
          <button className="lsubmit" disabled={busy} onClick={handleAuth}
            style={{width:"100%",padding:"13px",background:`rgba(${rgb(AC)},0.2)`,border:`1px solid rgba(${rgb(AC)},0.55)`,borderRadius:8,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,letterSpacing:2,color:"#fff",marginTop:16,transition:"opacity 0.15s"}}>
            {busy ? "AUTHENTICATING…" : mode==="login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
          </button>
          {err && <div style={{color:"#ff7878",fontFamily:"'Figtree',sans-serif",fontSize:13,textAlign:"center",marginTop:14}}>⚠ {err}</div>}
          <div style={{marginTop:22,fontFamily:"'Figtree',sans-serif",fontStyle:"italic",fontSize:11,color:"rgba(255,255,255,0.14)",textAlign:"center"}}>
            Don't reuse real passwords — demo auth only.
          </div>
        </div>
      </div>
    </div>
  );
 
  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",cursor:drag?"grabbing":"default"}}>
      <style>{CSS}</style>
      <Wallpaper id={data?.wallpaper}/>
 
      {/* Toast notification */}
      {toast && (
        <div style={{position:"fixed",top:14,right:14,zIndex:99999,padding:"11px 20px",background:"rgba(8,10,22,0.97)",border:`1px solid rgba(${rgb(AC)},0.6)`,borderRadius:10,fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:14,letterSpacing:0.5,color:"#fff",animation:"toast 0.18s ease-out",boxShadow:"0 8px 36px rgba(0,0,0,0.6)"}}>
          {toast}
        </div>
      )}
 
      {/* Desktop icons — left column */}
      <div style={{position:"absolute",top:14,left:12,display:"flex",flexDirection:"column",gap:4,zIndex:1}}>
        {APPS.map(app=>(
          <div key={app.id} className="dsk-icon" onDoubleClick={()=>openApp(app.id)} title={`${app.desc} (double-click)`}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:72,padding:"10px 4px",borderRadius:10,cursor:"pointer",userSelect:"none",border:"1px solid transparent",transition:"background 0.12s",background:"rgba(0,0,0,0.1)"}}>
            <span style={{fontSize:26,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.8))"}}>{app.icon}</span>
            <span style={{fontFamily:"'Figtree',sans-serif",fontWeight:600,fontSize:10,color:"#fff",textAlign:"center",lineHeight:1.25,textShadow:"0 1px 5px rgba(0,0,0,1)"}}>{app.label}</span>
          </div>
        ))}
      </div>
 
      {/* Start Menu */}
      {menuOpen && (
        <div ref={menuRef} style={{position:"fixed",bottom:52,left:0,width:350,background:"rgba(10,12,26,0.95)",backdropFilter:"blur(28px)",border:"1px solid rgba(255,255,255,0.11)",borderTop:"1px solid rgba(255,255,255,0.11)",borderRadius:"0 14px 0 0",boxShadow:"6px -6px 48px rgba(0,0,0,0.65)",zIndex:9998,display:"flex",flexDirection:"column",animation:"menu-up 0.16s ease-out",overflow:"hidden"}}>
          {/* Search bar */}
          <div style={{padding:"16px 16px 10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"9px 14px"}}>
              <span style={{fontSize:13,opacity:0.4}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search apps…" autoFocus
                style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,0.9)",fontFamily:"'Figtree',sans-serif",fontSize:14}}/>
              {search && <button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:14}}>✕</button>}
            </div>
          </div>
 
          {/* App grid */}
          <div style={{padding:"2px 16px 14px",flex:1,overflowY:"auto"}}>
            <div style={{...sHd,marginBottom:10}}>All Apps</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:2}}>
              {filteredApps.map(app=>(
                <div key={app.id} className="menu-app" onClick={()=>openApp(app.id)}
                  style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"14px 6px",borderRadius:10,cursor:"pointer",transition:"background 0.12s"}}>
                  <span style={{fontSize:24}}>{app.icon}</span>
                  <span style={{fontFamily:"'Figtree',sans-serif",fontWeight:600,fontSize:10.5,color:"rgba(255,255,255,0.82)",textAlign:"center",lineHeight:1.3}}>{app.label}</span>
                </div>
              ))}
              {filteredApps.length===0 && <div style={{gridColumn:"span 4",color:"rgba(255,255,255,0.2)",fontFamily:"'Figtree',sans-serif",fontStyle:"italic",fontSize:13,textAlign:"center",padding:"20px 0"}}>No apps found</div>}
            </div>
          </div>
 
          {/* User strip */}
          <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:AC2,border:`1.5px solid ${AC}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>👤</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:"#fff"}}>@{user}</div>
              <div style={{fontFamily:"'Figtree',sans-serif",fontSize:11,color:"rgba(255,255,255,0.3)"}}>Nova OS v3.0</div>
            </div>
            <button onClick={logout} style={{padding:"6px 13px",background:"rgba(200,40,40,0.12)",border:"1px solid rgba(200,40,40,0.3)",borderRadius:6,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:"rgba(255,140,140,0.9)"}}>LOGOUT</button>
          </div>
        </div>
      )}
 
      {/* Open Windows */}
      {wins.map(win => {
        const app=APPS.find(a=>a.id===win.app);
        const isDragging=drag?.id===win.id;
        return (
          <div key={win.id} onClick={()=>focusWin(win.id)}
            style={{position:"absolute",left:win.x,top:win.y,zIndex:win.z,background:"rgba(10,12,26,0.93)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,boxShadow:`0 ${isDragging?30:16}px ${isDragging?90:55}px rgba(0,0,0,${isDragging?0.8:0.6})`,display:"flex",flexDirection:"column",animation:"win-in 0.16s ease-out",minWidth:340,backdropFilter:"blur(20px)",transition:"box-shadow 0.12s"}}>
            {/* Titlebar / drag handle */}
            <div onMouseDown={e=>startDrag(e,win.id)}
              style={{height:40,display:"flex",alignItems:"center",padding:"0 12px",gap:10,background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.07)",borderRadius:"12px 12px 0 0",cursor:isDragging?"grabbing":"grab",userSelect:"none"}}>
              <span style={{fontSize:15}}>{app?.icon}</span>
              <span style={{flex:1,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:"rgba(255,255,255,0.88)",letterSpacing:0.3}}>{app?.label}</span>
              <button className="winx" onClick={e=>{e.stopPropagation();closeWin(win.id);}}
                style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"rgba(255,255,255,0.5)",transition:"background 0.12s,color 0.12s",flexShrink:0}}>✕</button>
            </div>
            <div style={{padding:18,overflowY:"auto",maxHeight:"calc(100vh - 120px)"}}>
              {win.app==="notes"    && <NotesApp    data={data} updateData={updateData} showToast={showToast}/>}
              {win.app==="tasks"    && <TasksApp    data={data} updateData={updateData} showToast={showToast}/>}
              {win.app==="files"    && <FilesApp    data={data} updateData={updateData} showToast={showToast}/>}
              {win.app==="paint"    && <PaintApp    showToast={showToast}/>}
              {win.app==="browser"  && <BrowserApp/>}
              {win.app==="terminal" && <TerminalApp user={user}/>}
              {win.app==="profile"  && <ProfileApp  user={user} data={data} updateData={updateData} showToast={showToast}/>}
            </div>
          </div>
        );
      })}
 
      {/* Taskbar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:52,background:"rgba(7,8,18,0.94)",backdropFilter:"blur(16px)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",padding:"0 10px",gap:6,zIndex:9999}}>
        {/* Start / Home button */}
        <button className="start-btn" title="Start menu" onClick={()=>{setMenuOpen(o=>!o);setSearch("");}}
          style={{width:40,height:40,borderRadius:9,background:menuOpen?`rgba(${rgb(AC)},0.22)`:"rgba(255,255,255,0.07)",border:menuOpen?`1px solid rgba(${rgb(AC)},0.5)`:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",fontSize:18,color:menuOpen?AC:"rgba(255,255,255,0.7)"}}>
          ◈
        </button>
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.09)",margin:"0 2px"}}/>
        {/* Open app buttons */}
        {wins.map(win => {
          const app=APPS.find(a=>a.id===win.app);
          return (
            <button key={win.id} className="tb-app" onClick={()=>focusWin(win.id)}
              style={{height:36,padding:"0 13px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,cursor:"pointer",fontFamily:"'Figtree',sans-serif",fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.8)",whiteSpace:"nowrap",transition:"background 0.12s",display:"flex",alignItems:"center",gap:7}}>
              {app?.icon} {app?.label}
            </button>
          );
        })}
        <div style={{flex:1}}/>
        {/* Right: user + clock */}
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:AC,letterSpacing:0.5}}>@{user}</div>
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.09)"}}/>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"rgba(255,255,255,0.5)",textAlign:"right",lineHeight:1.55}}>
          <div style={{fontWeight:500,color:"rgba(255,255,255,0.75)"}}>{fmtTime(tick)}</div>
          <div style={{fontSize:9}}>{fmtDate(tick)}</div>
        </div>
      </div>
    </div>
  );
}
 
// ─── NOTES ───────────────────────────────────────────────────────────────────
function NotesApp({ data, updateData, showToast }) {
  const [title,setTitle]=useState(""); const [body,setBody]=useState("");
  const add = () => {
    if (!title.trim()) return;
    updateData(p=>({...p,notes:[{id:Date.now(),title:title.trim(),body:body.trim(),ts:Date.now()},...(p.notes||[])]}));
    setTitle(""); setBody(""); showToast("Note saved ✓");
  };
  const del = id => { updateData(p=>({...p,notes:p.notes.filter(n=>n.id!==id)})); showToast("Note deleted"); };
  const notes=data?.notes||[];
 
  return (
    <div style={{width:400,fontFamily:"'Figtree',sans-serif"}}>
      <div style={sHd}>Notes</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title…" style={inp} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write something…" style={{...inp,minHeight:76}}/>
        <button className="abtn" onClick={add} style={{padding:"10px",background:`rgba(${rgb(AC)},0.18)`,border:`1px solid rgba(${rgb(AC)},0.5)`,borderRadius:7,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,color:AC,transition:"opacity 0.15s"}}>+ ADD NOTE</button>
      </div>
      {notes.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:13,textAlign:"center",padding:"24px 0",fontStyle:"italic"}}>No notes yet</div>}
      {notes.map(n=>(
        <div key={n.id} style={crd}>
          <div style={{fontWeight:600,fontSize:14,color:"rgba(255,255,255,0.92)",paddingRight:28,marginBottom:n.body?4:0}}>{n.title}</div>
          {n.body&&<div style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body}</div>}
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(255,255,255,0.18)",marginTop:6}}>{new Date(n.ts).toLocaleDateString()}</div>
          <button className="del-btn" onClick={()=>del(n.id)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.35)",fontSize:14,transition:"color 0.12s"}}>✕</button>
        </div>
      ))}
    </div>
  );
}
 
// ─── TASKS ───────────────────────────────────────────────────────────────────
function TasksApp({ data, updateData, showToast }) {
  const [input,setInput]=useState("");
  const add    = () => { if(!input.trim()) return; updateData(p=>({...p,tasks:[...(p.tasks||[]),{id:Date.now(),text:input.trim(),done:false}]})); setInput(""); showToast("Task added ✓"); };
  const toggle = id => updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));
  const del    = id => updateData(p=>({...p,tasks:p.tasks.filter(t=>t.id!==id)}));
  const tasks=data?.tasks||[]; const pending=tasks.filter(t=>!t.done); const done=tasks.filter(t=>t.done);
 
  return (
    <div style={{width:370,fontFamily:"'Figtree',sans-serif"}}>
      <div style={sHd}>Tasks</div>
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Add a task…" style={{...inp,flex:1}} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <button onClick={add} className="abtn" style={{width:42,background:`rgba(${rgb(AC)},0.18)`,border:`1px solid rgba(${rgb(AC)},0.5)`,borderRadius:7,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:AC,transition:"opacity 0.15s"}}>+</button>
      </div>
      {tasks.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:13,textAlign:"center",padding:"24px 0",fontStyle:"italic"}}>All clear!</div>}
      {pending.map(t=><TRow key={t.id} t={t} toggle={toggle} del={del}/>)}
      {done.length>0&&<>
        <div style={{...sHd,marginTop:16}}>Completed ({done.length})</div>
        {done.map(t=><TRow key={t.id} t={t} toggle={toggle} del={del}/>)}
      </>}
    </div>
  );
}
 
function TRow({t,toggle,del}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",marginBottom:5,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,opacity:t.done?0.4:1,transition:"opacity 0.2s"}}>
      <div onClick={()=>toggle(t.id)} style={{width:18,height:18,borderRadius:5,border:`1.5px solid ${t.done?AC:"rgba(255,255,255,0.22)"}`,background:t.done?AC:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.14s"}}>
        {t.done&&<span style={{color:"#000",fontSize:10,fontWeight:900}}>✓</span>}
      </div>
      <span style={{flex:1,fontFamily:"'Figtree',sans-serif",fontSize:14,color:"rgba(255,255,255,0.88)",textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
      <button className="del-btn" onClick={()=>del(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,padding:0,transition:"color 0.12s"}}>✕</button>
    </div>
  );
}
 
// ─── FILE EXPLORER ────────────────────────────────────────────────────────────
function FilesApp({ data, updateData, showToast }) {
  const [path,setPath]=useState("home"); // home | notes | tasks
  const [preview,setPreview]=useState(null);
 
  const notes=data?.notes||[];
  const tasks=data?.tasks||[];
 
  const folders=[
    {id:"notes",icon:"📄",label:"Notes",count:notes.length,color:"#4f9eff"},
    {id:"tasks",icon:"📋",label:"Tasks",count:tasks.length,color:"#4cef90"},
  ];
 
  if (path==="home") return (
    <div style={{width:440,fontFamily:"'Figtree',sans-serif"}}>
      <div style={sHd}>File Explorer — Home</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {folders.map(f=>(
          <div key={f.id} className="file-row" onClick={()=>setPath(f.id)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer",transition:"background 0.12s"}}>
            <span style={{fontSize:28}}>{f.icon}</span>
            <div>
              <div style={{fontWeight:600,fontSize:14,color:"rgba(255,255,255,0.9)"}}>{f.label}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{f.count} file{f.count!==1?"s":""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
 
  if (path==="notes") return (
    <div style={{width:480,fontFamily:"'Figtree',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button onClick={()=>{setPath("home");setPreview(null);}} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:"rgba(255,255,255,0.6)"}}>← BACK</button>
        <div style={sHd}>📄 Notes</div>
      </div>
      {notes.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic",padding:"20px 0"}}>No notes saved yet.</div>}
      <div style={{display:"flex",gap:12"}}>
        <div style={{flex:1}}>
          {notes.map(n=>(
            <div key={n.id} className="file-row" onClick={()=>setPreview(n)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:4,background:preview?.id===n.id?"rgba(79,158,255,0.12)":"rgba(255,255,255,0.03)",border:`1px solid ${preview?.id===n.id?"rgba(79,158,255,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:7,cursor:"pointer",transition:"background 0.12s"}}>
              <span style={{fontSize:16}}>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.28)"}}>{new Date(n.ts).toLocaleDateString()}</div>
              </div>
              <button className="del-btn" onClick={e=>{e.stopPropagation();updateData(p=>({...p,notes:p.notes.filter(x=>x.id!==n.id)}));if(preview?.id===n.id)setPreview(null);showToast("File deleted");}}
                style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,padding:0,transition:"color 0.12s",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </div>
      {preview&&(
        <div style={{marginTop:14,padding:"14px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9}}>
          <div style={{fontWeight:700,fontSize:15,color:"rgba(255,255,255,0.92)",marginBottom:8}}>{preview.title}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.7,whiteSpace:"pre-wrap",minHeight:40}}>{preview.body||"(no content)"}</div>
        </div>
      )}
    </div>
  );
 
  // tasks view
  return (
    <div style={{width:440,fontFamily:"'Figtree',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button onClick={()=>setPath("home")} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:"rgba(255,255,255,0.6)"}}>← BACK</button>
        <div style={sHd}>📋 Tasks</div>
      </div>
      {tasks.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic",padding:"20px 0"}}>No tasks yet.</div>}
      {tasks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,opacity:t.done?0.45:1}}>
          <span style={{fontSize:14}}>{t.done?"✅":"⬜"}</span>
          <span style={{flex:1,fontSize:13,color:"rgba(255,255,255,0.85)",textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"'JetBrains Mono',monospace"}}>{t.done?"done":"pending"}</span>
        </div>
      ))}
    </div>
  );
}
 
// ─── PAINT ───────────────────────────────────────────────────────────────────
const PALETTE=["#ffffff","#000000","#ff4444","#ff8800","#ffdd00","#44dd44","#00ccff","#4466ff","#cc44ff","#ff44aa","#8b4513","#888888"];
 
function PaintApp({ showToast }) {
  const canvasRef=useRef(null);
  const [color,setColor]=useState("#000000");
  const [size,setSize]=useState(6);
  const [tool,setTool]=useState("pen");
  const [drawing,setDrawing]=useState(false);
  const lastPos=useRef(null);
 
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return;
    const ctx=c.getContext("2d");
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height);
  },[]);
 
  const getPos=(e)=>{
    const r=canvasRef.current.getBoundingClientRect();
    return {x:e.clientX-r.left, y:e.clientY-r.top};
  };
 
  const down=(e)=>{
    e.stopPropagation();
    setDrawing(true);
    const pos=getPos(e); lastPos.current=pos;
    const ctx=canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.arc(pos.x,pos.y,size/2,0,Math.PI*2);
    ctx.fillStyle=tool==="eraser"?"#ffffff":color;
    ctx.fill();
  };
  const move=(e)=>{
    if(!drawing||!lastPos.current) return;
    e.stopPropagation();
    const pos=getPos(e);
    const ctx=canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(lastPos.current.x,lastPos.current.y);
    ctx.lineTo(pos.x,pos.y);
    ctx.strokeStyle=tool==="eraser"?"#ffffff":color;
    ctx.lineWidth=size; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.stroke(); lastPos.current=pos;
  };
  const up=(e)=>{ e.stopPropagation(); setDrawing(false); lastPos.current=null; };
 
  const clear=()=>{
    const c=canvasRef.current; const ctx=c.getContext("2d");
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height);
  };
  const download=()=>{
    const a=document.createElement("a");
    a.download="nova-paint.png"; a.href=canvasRef.current.toDataURL(); a.click();
    showToast("Image downloaded ✓");
  };
 
  const toolBtn=(id,label)=>(
    <button onClick={()=>setTool(id)} className="abtn"
      style={{padding:"7px 14px",background:tool===id?`rgba(${rgb(AC)},0.25)`:"rgba(255,255,255,0.06)",border:`1px solid ${tool===id?AC:"rgba(255,255,255,0.12)"}`,borderRadius:6,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,letterSpacing:1,color:tool===id?AC:"rgba(255,255,255,0.6)",transition:"opacity 0.15s"}}>
      {label}
    </button>
  );
 
  return (
    <div style={{width:580,fontFamily:"'Figtree',sans-serif"}}>
      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {toolBtn("pen","✏️ Pen")} {toolBtn("eraser","⬜ Eraser")}
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:4}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:1}}>SIZE</span>
          <input type="range" min={2} max={40} value={size} onChange={e=>setSize(+e.target.value)} style={{width:80,accentColor:AC}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",width:18}}>{size}</span>
        </div>
        <div style={{flex:1}}/>
        <button onClick={clear} className="abtn" style={{padding:"7px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,color:"rgba(255,255,255,0.6)",transition:"opacity 0.15s"}}>CLEAR</button>
        <button onClick={download} className="abtn" style={{padding:"7px 14px",background:`rgba(${rgb(AC)},0.18)`,border:`1px solid rgba(${rgb(AC)},0.5)`,borderRadius:6,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,color:AC,transition:"opacity 0.15s"}}>⬇ SAVE</button>
      </div>
 
      {/* Canvas */}
      <canvas ref={canvasRef} width={560} height={340}
        style={{borderRadius:8,cursor:tool==="eraser"?"cell":"crosshair",display:"block",border:"1px solid rgba(255,255,255,0.1)"}}
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}/>
 
      {/* Color palette */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:12,flexWrap:"wrap"}}>
        {PALETTE.map(c=>(
          <div key={c} className="paint-swatch" onClick={()=>{setColor(c);setTool("pen");}}
            style={{width:24,height:24,borderRadius:5,background:c,cursor:"pointer",border:color===c&&tool==="pen"?"2.5px solid #fff":"2px solid rgba(255,255,255,0.15)",transition:"transform 0.1s",boxSizing:"border-box"}}/>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:6}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:1}}>CUSTOM</span>
          <input type="color" value={color} onChange={e=>{setColor(e.target.value);setTool("pen");}}
            style={{width:28,height:28,borderRadius:5,border:"none",cursor:"pointer",background:"none"}}/>
        </div>
      </div>
    </div>
  );
}
 
// ─── BROWSER ─────────────────────────────────────────────────────────────────
const BOOKMARKS=[
  {label:"Bing",        url:"https://www.bing.com"},
  {label:"Wikipedia",   url:"https://en.m.wikipedia.org"},
  {label:"Archive.org", url:"https://archive.org"},
  {label:"OpenStreetMap",url:"https://www.openstreetmap.org"},
  {label:"Hacker News", url:"https://news.ycombinator.com"},
];
 
function BrowserApp() {
  const [input,setInput]=useState("");
  const [loaded,setLoaded]=useState("");
  const [hist,setHist]=useState([]);
  const [hIdx,setHIdx]=useState(-1);
 
  const go=(target)=>{
    let url=target.trim();
    if (!url) return;
    if (!url.startsWith("http")) url="https://"+url;
    const newHist=[...hist.slice(0,hIdx+1),url];
    setHist(newHist); setHIdx(newHist.length-1);
    setLoaded(url); setInput(url);
  };
  const back=()=>{ if(hIdx>0){ const i=hIdx-1; setHIdx(i); setLoaded(hist[i]); setInput(hist[i]); } };
  const fwd=()=>{ if(hIdx<hist.length-1){ const i=hIdx+1; setHIdx(i); setLoaded(hist[i]); setInput(hist[i]); } };
 
  return (
    <div style={{width:680,fontFamily:"'Figtree',sans-serif"}}>
      {/* Nav bar */}
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
        <button onClick={back} disabled={hIdx<=0} style={{width:30,height:30,borderRadius:6,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",cursor:hIdx>0?"pointer":"default",color:"rgba(255,255,255,0.5)",fontSize:14,opacity:hIdx>0?1:0.35}}>←</button>
        <button onClick={fwd}  disabled={hIdx>=hist.length-1} style={{width:30,height:30,borderRadius:6,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",cursor:hIdx<hist.length-1?"pointer":"default",color:"rgba(255,255,255,0.5)",fontSize:14,opacity:hIdx<hist.length-1?1:0.35}}>→</button>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter a URL or search term…"
          onKeyDown={e=>e.key==="Enter"&&go(input)}
          style={{...inp,flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}/>
        <button onClick={()=>go(input)} className="abtn"
          style={{padding:"9px 16px",background:`rgba(${rgb(AC)},0.18)`,border:`1px solid rgba(${rgb(AC)},0.5)`,borderRadius:7,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,color:AC}}>GO</button>
      </div>
 
      {/* Bookmarks */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {BOOKMARKS.map(b=>(
          <button key={b.url} className="bm-btn" onClick={()=>go(b.url)}
            style={{padding:"5px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,cursor:"pointer",fontFamily:"'Figtree',sans-serif",fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.65)",transition:"background 0.12s"}}>
            {b.label}
          </button>
        ))}
      </div>
 
      {/* Notice */}
      <div style={{padding:"8px 12px",background:"rgba(255,180,0,0.08)",border:"1px solid rgba(255,180,0,0.2)",borderRadius:7,marginBottom:10,fontFamily:"'Figtree',sans-serif",fontSize:12,color:"rgba(255,210,100,0.8)",lineHeight:1.5}}>
        ⚠ Many sites (Google, YouTube, Twitter) block iframe embedding. The bookmarks above are known to work. If a site shows an error, it has blocked embedding — try one of the bookmarks instead.
      </div>
 
      {/* iframe */}
      {loaded ? (
        <iframe src={loaded} title="browser" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          style={{width:"100%",height:400,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"#fff",display:"block"}}/>
      ) : (
        <div style={{height:400,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
          <div style={{fontSize:48}}>🌐</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:"rgba(255,255,255,0.5)"}}>Nova Browser</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.25)",fontStyle:"italic"}}>Enter a URL or click a bookmark to browse</div>
        </div>
      )}
    </div>
  );
}
 
// ─── TERMINAL ─────────────────────────────────────────────────────────────────
function TerminalApp({ user }) {
  const [lines,setLines]=useState([
    {t:"out",v:"NOVA Terminal v3.0.0"},
    {t:"out",v:`Session: ${user} — ${new Date().toLocaleString()}`},
    {t:"out",v:'Type "help" for available commands.'},
    {t:"gap"},
  ]);
  const [cmd,setCmd]=useState(""); const [hist,setHist]=useState([]); const [hIdx,setHIdx]=useState(-1);
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[lines]);
 
  const CMDS={
    help:    ()=>["Commands: help, whoami, date, echo <text>, version, sysinfo, ls, neofetch, clear"],
    whoami:  ()=>[user],
    date:    ()=>[new Date().toLocaleString()],
    version: ()=>["NOVA OS v3.0.0 — Nova Systems Inc."],
    sysinfo: ()=>[`CPU: Nova Virtual Core™`,`RAM: 8.0 GB (simulated)`,`Storage: Firebase Firestore`,`Resolution: ${window.innerWidth}x${window.innerHeight}`,`Uptime: ${Math.floor(performance.now()/1000)}s`],
    ls:      ()=>["notes/    tasks/    paint/    browser/    .config    .session"],
    neofetch: ()=>[
      "         ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ",
      "         ████╗  ██║██╔═══██╗██║   ██║██╔══██╗",
      "         ██╔██╗ ██║██║   ██║██║   ██║███████║",
      "         ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║",
      "         ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║",
      `OS: Nova OS v3.0.0   User: ${user}`,
      `Shell: novaterm 3.0   Apps: ${APPS.length} installed`,
    ],
    echo:    args=>[args.join(" ")||"(empty)"],
    clear:   ()=>"__clear__",
  };
 
  const run=()=>{
    const raw=cmd.trim(); if(!raw) return;
    const parts=raw.split(" "); const c=parts[0].toLowerCase(); const args=parts.slice(1);
    setHist(h=>[raw,...h]); setHIdx(-1); setCmd("");
    const nl=[...lines,{t:"in",v:raw}];
    const handler=CMDS[c];
    if(!handler){nl.push({t:"err",v:`${c}: command not found. Type "help".`});}
    else{const r=handler(args); if(r==="__clear__"){setLines([]);return;} r.forEach(v=>nl.push({t:"out",v}));}
    nl.push({t:"gap"});
    setLines(nl);
  };
 
  const onKey=e=>{
    if(e.key==="Enter"){run();return;}
    if(e.key==="ArrowUp"){const i=Math.min(hIdx+1,hist.length-1);setHIdx(i);if(hist[i])setCmd(hist[i]);}
    if(e.key==="ArrowDown"){const i=Math.max(hIdx-1,-1);setHIdx(i);setCmd(i===-1?"":(hist[i]||""));}
  };
 
  return (
    <div style={{width:520,fontFamily:"'JetBrains Mono',monospace"}}>
      <div style={{background:"#030407",borderRadius:8,padding:"14px 16px",maxHeight:340,overflowY:"auto",border:"1px solid rgba(255,255,255,0.07)"}}>
        {lines.map((l,i)=>(
          <div key={i} style={{color:l.t==="in"?AC:l.t==="err"?"#ff7878":"rgba(180,210,255,0.6)",fontSize:13,marginBottom:l.t==="gap"?6:2,minHeight:l.t==="gap"?4:undefined,whiteSpace:"pre"}}>
            {l.t==="in"?`$ ${l.v}`:l.t==="gap"?undefined:l.v}
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center"}}>
          <span style={{color:"#4cef90",marginRight:8,fontSize:13}}>$</span>
          <input value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={onKey} autoFocus
            style={{flex:1,background:"none",border:"none",outline:"none",color:AC,fontFamily:"'JetBrains Mono',monospace",fontSize:13,caretColor:AC}}/>
        </div>
        <div ref={endRef}/>
      </div>
    </div>
  );
}
 
// ─── PROFILE ─────────────────────────────────────────────────────────────────
function ProfileApp({ user, data, updateData, showToast }) {
  const [bio,setBio]=useState(data?.bio||"");
  const joined=data?.joined?new Date(data.joined).toLocaleDateString([],{year:"numeric",month:"long",day:"numeric"}):"Unknown";
  const nNotes=data?.notes?.length||0;
  const nDone=data?.tasks?.filter(t=>t.done).length||0;
  const nTasks=data?.tasks?.length||0;
 
  return (
    <div style={{width:360,fontFamily:"'Figtree',sans-serif"}}>
      <div style={sHd}>Profile</div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:18,marginBottom:18,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{width:66,height:66,borderRadius:"50%",background:AC2,border:`2px solid ${AC}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:12}}>👤</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#fff",marginBottom:3}}>@{user}</div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.28)"}}>Member since {joined}</div>
      </div>
 
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
        {[["📝",nNotes,"Notes"],["✅",`${nDone}/${nTasks}`,"Tasks"],["🎨","∞","Paint"]].map(([ic,v,k])=>(
          <div key={k} style={{padding:"12px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,textAlign:"center"}}>
            <div style={{fontSize:10,marginBottom:4}}>{ic}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:AC}}>{v}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>{k}</div>
          </div>
        ))}
      </div>
 
      <div style={{marginBottom:20}}>
        <div style={{...sHd,marginBottom:8}}>Bio</div>
        <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Write something about yourself…" style={{...inp,minHeight:64}}/>
        <button onClick={()=>{updateData({bio});showToast("Bio saved ✓");}} className="abtn"
          style={{width:"100%",padding:"10px",background:AC2,border:`1px solid rgba(${rgb(AC)},0.5)`,borderRadius:7,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,letterSpacing:1,color:AC,marginTop:8,transition:"opacity 0.15s"}}>
          SAVE BIO
        </button>
      </div>
 
      <div>
        <div style={{...sHd,marginBottom:10}}>Wallpaper</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {Object.entries(WALLPAPERS).map(([k,w])=>(
            <div key={k} onClick={()=>updateData({wallpaper:k})} title={w.name}
              style={{height:36,borderRadius:6,background:w.preview,cursor:"pointer",border:data?.wallpaper===k?"2.5px solid #fff":"2.5px solid transparent",transition:"border 0.14s",boxSizing:"border-box"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:5}}>
          {Object.entries(WALLPAPERS).map(([k,w])=>(
            <div key={k} style={{fontFamily:"'Figtree',sans-serif",fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>{w.name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

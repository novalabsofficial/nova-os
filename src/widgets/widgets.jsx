// Desktop widgets — the small floating boxes (clock, weather, notes, tasks,
// calendar, sysinfo) that the user can toggle on/off in Settings.
//
// Each widget content component takes the widget state (size/position) plus
// the data it needs. WidgetShell wraps content with drag/resize/close.

import { useState, useEffect } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { WIDGET_CONFIGS, WGT_HANDLES_MOUSE, WGT_HANDLES_TOUCH, WMO } from "../ui/constants.js";

export function WidgetShell({ id, state, onDragStart, onResizeStart, onClose, children, touchy }) {
  const { x, y, w, h } = state;
  const handles = touchy ? WGT_HANDLES_TOUCH : WGT_HANDLES_MOUSE;
  return (
    <div className="wgt" style={{position:"absolute",left:x,top:y,width:w,height:h,zIndex:4,background:"rgba(7,8,18,0.72)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.45)",display:"flex",flexDirection:"column"}}>
      {handles.map(hh => (
        <div key={hh.id} onPointerDown={e => { e.stopPropagation(); onResizeStart(e, id, hh.id); }} style={{position:"absolute",...hh.s,zIndex:12,touchAction:"none"}}/>
      ))}
      <div onPointerDown={e => { e.stopPropagation(); onDragStart(e, id); }}
        style={{height:26,display:"flex",alignItems:"center",padding:"0 8px 0 12px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"grab",userSelect:"none",flexShrink:0,zIndex:11,touchAction:"none"}}>
        <span style={{fontFamily:FFB,fontWeight:600,fontSize:10,letterSpacing:1,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",flex:1}}>{WIDGET_CONFIGS[id]?.label || id}</span>
        <button onClick={e => { e.stopPropagation(); onClose(); }}
          style={{width:16,height:16,borderRadius:4,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
      </div>
      <div style={{flex:1,overflow:"hidden",minHeight:0}}>{children}</div>
    </div>
  );
}

export function ClockWidgetContent({ state, tick, use24h, AC }) {
  const t = use24h
    ? tick.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false})
    : tick.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  const d = tick.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"});
  const h = state.h - 26;
  const fontSize = Math.max(20, Math.min(h * 0.38, 56));
  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 14px",gap:4}}>
      <div style={{fontFamily:FFM,fontSize,fontWeight:400,color:"#fff",lineHeight:1,letterSpacing:2,textAlign:"center"}}>{t}</div>
      <div style={{fontFamily:FF,fontWeight:500,fontSize:Math.max(10,fontSize*0.28),color:"rgba(255,255,255,0.42)",textAlign:"center"}}>{d}</div>
    </div>
  );
}

export function WeatherWidgetContent({ state, data }) {
  const [weather, setWeather] = useState(null);
  const [loc, setLoc] = useState("");
  const [status, setStatus] = useState("loading");
  // v6.4: if the user has pinned a location in Atmos, use that instead of
  // hitting the browser geolocation prompt. Falls back to geolocation when
  // no pinned location exists (preserves the v6.0–6.3 behavior).
  const savedLoc = data?.settings?.weatherLocation || null;
  useEffect(() => {
    // Branch A: pinned location — fetch directly, no permission prompt,
    // re-runs if the pin changes (e.g. user picks a new city in Atmos).
    if (savedLoc) {
      (async () => {
        try {
          const wR = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${savedLoc.lat}&longitude=${savedLoc.lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&timezone=auto`).then(r => r.json());
          if (wR?.current) setWeather(wR.current);
          // We already know the label from Atmos — no reverse-geocode needed.
          // Atmos stores e.g. "Brooklyn, New York, USA" — first segment is usually
          // the city, which is what the widget wants to show.
          setLoc((savedLoc.label || "").split(",")[0].trim());
          setStatus("ok");
        } catch { setStatus("error"); }
      })();
      return;
    }
    // Branch B: no pin — fall back to browser geolocation.
    if (!navigator.geolocation) { setStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(async ({coords:{latitude:lat, longitude:lon}}) => {
      try {
        const [wR, gR] = await Promise.allSettled([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&timezone=auto`).then(r => r.json()),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`).then(r => r.json()),
        ]);
        if (wR.status === "fulfilled" && wR.value?.current) setWeather(wR.value.current);
        if (gR.status === "fulfilled") {
          const a = gR.value?.address;
          setLoc(a?.city || a?.town || a?.village || a?.county || "");
        }
        setStatus("ok");
      } catch { setStatus("error"); }
    }, () => setStatus("error"), {timeout: 8000});
  }, [savedLoc?.lat, savedLoc?.lon]);
  const h = state.h - 26, w = state.w;
  const iconSize = Math.max(24, Math.min(h * 0.35, 52));
  const tempSize = Math.max(18, Math.min(h * 0.28, 44));
  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 14px",gap:6}}>
      {status==="loading" && <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.4)"}}>Getting weather…</span></div>}
      {status==="error" && <div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>🌡️ Unavailable<br/><span style={{fontSize:9,opacity:0.6}}>Allow location access</span></div>}
      {status==="ok" && weather && (<>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:iconSize,lineHeight:1}}>{WMO[weather.weathercode] || "🌡️"}</span>
          <div>
            <div style={{fontFamily:FFM,fontSize:tempSize,fontWeight:400,color:"#fff",lineHeight:1}}>{Math.round(weather.temperature_2m)}°C</div>
            {loc && w > 170 && <div style={{fontFamily:FF,fontSize:Math.max(9,tempSize*0.32),color:"rgba(255,255,255,0.42)",marginTop:3}}>{loc}</div>}
          </div>
        </div>
        {weather.windspeed_10m != null && h > 120 && <div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.3)"}}>💨 {weather.windspeed_10m} km/h</div>}
      </>)}
    </div>
  );
}

export function NotesWidgetContent({ data, state }) {
  const notes = (data?.notes || []).slice(0, 8);
  const h = state.h - 26;
  return (
    <div style={{width:"100%",height:"100%",overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
      {notes.length === 0 && <div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic",margin:"auto",textAlign:"center"}}>No notes yet</div>}
      {notes.map(n => (
        <div key={n.id} style={{padding:"6px 9px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,flexShrink:0}}>
          <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
          {n.body && h > 150 && <div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.42)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{n.body}</div>}
        </div>
      ))}
    </div>
  );
}

export function TasksWidgetContent({ data, updateData, state }) {
  const tasks = (data?.tasks || []).filter(t => !t.done).slice(0, 10);
  function toggle(id) { updateData(p => ({...p, tasks: p.tasks.map(t => t.id === id ? {...t, done: !t.done} : t)})); }
  return (
    <div style={{width:"100%",height:"100%",overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
      {tasks.length === 0 && <div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic",margin:"auto",textAlign:"center"}}>All tasks done! ✓</div>}
      {tasks.map(t => (
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 7px",background:"rgba(255,255,255,0.04)",borderRadius:6,flexShrink:0,cursor:"pointer"}} onClick={() => toggle(t.id)}>
          <div style={{width:14,height:14,borderRadius:4,border:"1.5px solid rgba(255,255,255,0.25)",flexShrink:0}}/>
          <span style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
        </div>
      ))}
      {data?.tasks?.filter(t => !t.done).length > 10 && <div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.25)",textAlign:"center",paddingTop:2}}>+{data.tasks.filter(t => !t.done).length - 10} more</div>}
    </div>
  );
}

export function CalendarWidgetContent({ tick, state, AC }) {
  const year = tick.getFullYear(), month = tick.getMonth(), today = tick.getDate();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const w = state.w, h = state.h - 26;
  const cellSz = Math.max(18, Math.min((w - 24) / 7, (h - 40) / Math.ceil(cells.length / 7)));
  return (
    <div style={{width:"100%",height:"100%",padding:"6px 10px",display:"flex",flexDirection:"column",gap:4}}>
      <div style={{fontFamily:FFB,fontWeight:600,fontSize:Math.max(10,cellSz*0.55),color:"rgba(255,255,255,0.7)",textAlign:"center"}}>
        {tick.toLocaleDateString([], {month:"long", year:"numeric"})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
        {DAYS.map(d => <div key={d} style={{textAlign:"center",fontFamily:FFB,fontWeight:600,fontSize:Math.max(8,cellSz*0.42),color:"rgba(255,255,255,0.3)",padding:"2px 0"}}>{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} style={{textAlign:"center",fontFamily:FF,fontSize:Math.max(9,cellSz*0.48),color:d===today?"#fff":"rgba(255,255,255,0.6)",background:d===today?AC:"transparent",borderRadius:4,padding:"1px 0",fontWeight:d===today?700:400}}>{d || ""}</div>
        ))}
      </div>
    </div>
  );
}

export function SysInfoWidgetContent({ state }) {
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setUptime(Math.floor(performance.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const fmtUp = s => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`; };
  const cpu = 55 + Math.floor((uptime % 30) / 30 * 30);
  const ram = 62 + Math.floor((uptime % 20) / 20 * 20);
  const Bar = ({pct, col = "#4f9eff"}) => (<div style={{flex:1,height:5,background:"rgba(255,255,255,0.1)",borderRadius:3,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:col,borderRadius:3,transition:"width 1s"}}/></div>);
  const h = state.h - 26;
  const fs = Math.max(9, Math.min(h * 0.1, 12));
  return (
    <div style={{width:"100%",height:"100%",padding:"8px 13px",display:"flex",flexDirection:"column",justifyContent:"space-evenly",gap:4}}>
      {[["CPU","Virtual Core",cpu,"#4f9eff"],["RAM","8.0 GB",ram,"#4cef90"]].map(([lbl,sub,pct,col]) => (
        <div key={lbl}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontFamily:FFB,fontWeight:600,fontSize:fs,color:"rgba(255,255,255,0.7)"}}>{lbl}</span>
            <span style={{fontFamily:FFM,fontSize:fs,color:col}}>{pct}%</span>
          </div>
          <Bar pct={pct} col={col}/>
          {h > 120 && <div style={{fontFamily:FF,fontSize:fs*0.88,color:"rgba(255,255,255,0.28)",marginTop:1}}>{sub}</div>}
        </div>
      ))}
      {h > 110 && <div style={{fontFamily:FFM,fontSize:fs,color:"rgba(255,255,255,0.35)"}}>⏱ {fmtUp(uptime)}&nbsp;&nbsp;{window.innerWidth}×{window.innerHeight}</div>}
    </div>
  );
}

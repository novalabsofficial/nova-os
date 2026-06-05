// Desktop widgets — the small floating boxes (clock, weather, notes, tasks,
// calendar, sysinfo) that the user can toggle on/off in Settings.
//
// Each widget content component takes the widget state (size/position) plus
// the data it needs. WidgetShell wraps content with drag/resize/close.

import { useState, useEffect } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { WIDGET_CONFIGS, WGT_HANDLES_MOUSE, WGT_HANDLES_TOUCH, WMO } from "../ui/constants.js";
import { WeatherGlyph } from "../ui/WeatherGlyph.jsx";
// v7.1: weather widget gains NWS alerts + unit toggle, mirroring Atmos
import { alertsUrl, parseAlerts, isLikelyUS } from "../lib/weather.js";
// v8.7: real CPU/RAM metrics on the Tauri desktop build (null on web).
import { getSystemInfo, isDesktop } from "../lib/sysinfo.js";

export function WidgetShell({ id, state, onDragStart, onResizeStart, onClose, children, touchy }) {
  const { x, y, w, h } = state;
  const handles = touchy ? WGT_HANDLES_TOUCH : WGT_HANDLES_MOUSE;
  const cfg = WIDGET_CONFIGS[id];
  // v8.0 widget shell refresh:
  //   • 14 → 16 radius (matches the new window-chrome radius scale)
  //   • Multi-layer shadow + subtle inner highlight for depth
  //   • Heavier glass effect (28px blur + saturate 160%) so colors pop through
  //   • Header has an emoji icon + cleaner typography + tighter close button
  //   • Subtle gradient on the header instead of a hard border line
  return (
    <div className="wgt" style={{
      position:"absolute",left:x,top:y,width:w,height:h,zIndex:4,
      background:"var(--nv-surface)",
      backdropFilter:"blur(var(--nv-glass-blur)) saturate(160%)",
      WebkitBackdropFilter:"blur(var(--nv-glass-blur)) saturate(160%)",
      border:"1px solid var(--nv-border)",
      borderRadius:16,
      overflow:"hidden",
      boxShadow:"var(--nv-card-shadow)",
      display:"flex",flexDirection:"column",
    }}>
      {handles.map(hh => (
        <div key={hh.id} onPointerDown={e => { e.stopPropagation(); onResizeStart(e, id, hh.id); }} style={{position:"absolute",...hh.s,zIndex:12,touchAction:"none"}}/>
      ))}
      <div onPointerDown={e => { e.stopPropagation(); onDragStart(e, id); }}
        style={{
          height:28,display:"flex",alignItems:"center",padding:"0 6px 0 12px",gap:6,
          background:"linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
          borderBottom:"1px solid var(--nv-border)",
          cursor:"grab",userSelect:"none",flexShrink:0,zIndex:11,touchAction:"none",
        }}>
        <span style={{fontFamily:FFB,fontWeight:600,fontSize:9.5,letterSpacing:1.4,color:"var(--nv-text-dim)",textTransform:"uppercase",flex:1}}>{cfg?.label || id}</span>
        <button onClick={e => { e.stopPropagation(); onClose(); }}
          title="Hide widget"
          style={{width:18,height:18,borderRadius:5,background:"transparent",border:"none",cursor:"pointer",color:"var(--nv-text-dim)",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all 0.15s var(--nv-ease)"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,80,80,0.15)";e.currentTarget.style.color="rgba(255,130,130,0.9)";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.35)";}}>✕</button>
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
  const h = state.h - 28;
  // v8.0: pull the time apart so the separator can pulse subtly with seconds.
  // Mono-style display feels more polished and intentional than the v7.x
  // single-line render.
  const fontSize = Math.max(22, Math.min(h * 0.4, 60));
  // Subtle colon blink — every other second the colons fade. Reads as
  // "this clock is alive" without being distracting.
  const seconds = tick.getSeconds();
  const blink = seconds % 2 === 0;
  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 16px",gap:5}}>
      <div style={{
        fontFamily:FFM,fontSize,fontWeight:400,color:"var(--nv-text-strong)",lineHeight:1,letterSpacing:2.5,textAlign:"center",
        // Render colons separately by replacing them with a styled span via
        // a subtle CSS trick: we keep the simple text and let the user just
        // see the time. Adding split-rendering would complicate use24h logic
        // with seconds. Keep simple, just brighten the text slightly.
        textShadow:"0 0 24px "+AC+"22",
      }}>{t}</div>
      <div style={{
        fontFamily:FFB,fontWeight:600,fontSize:Math.max(10,fontSize*0.24),
        color:"var(--nv-text-dim)",textAlign:"center",letterSpacing:0.4,
        textTransform:"capitalize",
      }}>{d}</div>
      {/* v8.0: tiny accent-color dot pulses with the seconds — a subtle
          "alive" indicator. Hidden when widget is too small to fit it. */}
      {h > 80 && (
        <div style={{width:5,height:5,borderRadius:"50%",background:AC,opacity:blink?0.85:0.3,boxShadow:blink?"0 0 8px "+AC:"none",transition:"all 0.4s ease",marginTop:2}}/>
      )}
    </div>
  );
}

export function WeatherWidgetContent({ state, data, updateSettings }) {
  const [weather, setWeather] = useState(null);
  const [loc, setLoc] = useState("");
  const [status, setStatus] = useState("loading");
  // v7.1: NWS alerts shown for US locations
  const [alerts, setAlerts] = useState([]);
  // v6.4: if the user has pinned a location in Atmos, use that instead of
  // hitting the browser geolocation prompt. Falls back to geolocation when
  // no pinned location exists (preserves the v6.0–6.3 behavior).
  const savedLoc = data?.settings?.weatherLocation || null;
  // v7.1: units preference shared with Atmos. Default imperial (°F) to match
  // the Atmos default. open-meteo accepts "fahrenheit" or "celsius".
  const units = data?.settings?.weatherUnits || "imperial";
  const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
  const tempSymbol = units === "imperial" ? "°F" : "°C";
  useEffect(() => {
    setAlerts([]); // clear stale alerts when location/units change
    // Branch A: pinned location — fetch directly, no permission prompt,
    // re-runs if the pin changes (e.g. user picks a new city in Atmos).
    if (savedLoc) {
      (async () => {
        try {
          const wR = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${savedLoc.lat}&longitude=${savedLoc.lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=${tempUnit}&wind_speed_unit=${units==="imperial"?"mph":"kmh"}&timezone=auto`).then(r => r.json());
          if (wR?.current) setWeather(wR.current);
          // We already know the label from Atmos — no reverse-geocode needed.
          // Atmos stores e.g. "Brooklyn, New York, USA" — first segment is usually
          // the city, which is what the widget wants to show.
          setLoc((savedLoc.label || "").split(",")[0].trim());
          // v7.1: fetch NWS alerts for US locations. Silent on failure since
          // alerts are a bonus, not core widget functionality.
          if (isLikelyUS(savedLoc.lat, savedLoc.lon)) {
            try {
              const ares = await fetch(alertsUrl(savedLoc.lat, savedLoc.lon), {headers: {Accept: "application/geo+json"}});
              setAlerts(parseAlerts(await ares.json()));
            } catch {}
          }
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
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=${tempUnit}&wind_speed_unit=${units==="imperial"?"mph":"kmh"}&timezone=auto`).then(r => r.json()),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`).then(r => r.json()),
        ]);
        if (wR.status === "fulfilled" && wR.value?.current) setWeather(wR.value.current);
        if (gR.status === "fulfilled") {
          const a = gR.value?.address;
          setLoc(a?.city || a?.town || a?.village || a?.county || "");
        }
        // v7.1: alerts for the geolocated point too
        if (isLikelyUS(lat, lon)) {
          try {
            const ares = await fetch(alertsUrl(lat, lon), {headers: {Accept: "application/geo+json"}});
            setAlerts(parseAlerts(await ares.json()));
          } catch {}
        }
        setStatus("ok");
      } catch { setStatus("error"); }
    }, () => setStatus("error"), {timeout: 8000});
  }, [savedLoc?.lat, savedLoc?.lon, tempUnit]);
  // v7.1: toggle stays in sync with Atmos. If updateSettings isn't wired
  // (shouldn't happen post-7.1), button silently no-ops rather than crashing.
  function toggleUnits(e) {
    e.stopPropagation();
    if (updateSettings) updateSettings({ weatherUnits: units === "imperial" ? "metric" : "imperial" });
  }
  const h = state.h - 26, w = state.w;
  const iconSize = Math.max(24, Math.min(h * 0.35, 52));
  const tempSize = Math.max(18, Math.min(h * 0.28, 44));
  // v7.1: alert palette — picks the most severe category present so the
  // badge color matches the urgency. Matches Atmos's color logic.
  const mostSevere = alerts.find(a => a.severity === "Extreme")
                  || alerts.find(a => a.severity === "Severe")
                  || alerts.find(a => a.severity === "Moderate")
                  || alerts[0];
  const alertColor = !mostSevere ? null
    : mostSevere.severity === "Extreme"  ? "#ff8080"
    : mostSevere.severity === "Severe"   ? "#ffaa44"
    : mostSevere.severity === "Moderate" ? "#ffd060"
    : "#88c8ff";
  return (
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 14px",gap:6}}>
      {/* v7.1: small °F/°C toggle button — top-right corner. Stays out of
          the way but always visible. Clicking flips the preference and
          re-fetches in the new unit. */}
      {updateSettings && (
        <button onClick={toggleUnits} title={"Switch to "+(units==="imperial"?"Celsius":"Fahrenheit")}
          style={{position:"absolute",top:4,right:6,background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",borderRadius:4,cursor:"pointer",fontFamily:FFM,fontSize:9,fontWeight:600,color:"var(--nv-text)",padding:"1px 5px",lineHeight:1.2}}>
          {tempSymbol}
        </button>
      )}
      {/* v7.1: NWS alert badge — top-left corner. Hover shows the first
          alert's event name. Only renders for US locations with active alerts. */}
      {alerts.length > 0 && (
        <div title={mostSevere.event + (alerts.length > 1 ? " (+" + (alerts.length-1) + " more)" : "")}
          style={{position:"absolute",top:4,left:6,background:"rgba("+(alertColor==="#ff8080"?"255,80,80":alertColor==="#ffaa44"?"255,150,40":alertColor==="#ffd060"?"255,200,80":"100,200,255")+",0.18)",border:"1px solid "+alertColor,borderRadius:4,padding:"1px 5px",fontFamily:FFB,fontSize:9,fontWeight:700,color:alertColor,letterSpacing:0.5,display:"flex",alignItems:"center",gap:3,lineHeight:1.2}}>
          ⚠ {alerts.length}
        </div>
      )}
      {status==="loading" && <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontFamily:FF,fontSize:11,color:"var(--nv-text-dim)"}}>Getting weather…</span></div>}
      {status==="error" && <div style={{fontFamily:FF,fontSize:11,color:"var(--nv-text-dim)",textAlign:"center"}}>Unavailable<br/><span style={{fontSize:9,opacity:0.6}}>Allow location access</span></div>}
      {status==="ok" && weather && (<>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{display:"flex",lineHeight:1}}><WeatherGlyph code={weather.weathercode} size={iconSize}/></span>
          <div>
            <div style={{fontFamily:FFM,fontSize:tempSize,fontWeight:400,color:"var(--nv-text-strong)",lineHeight:1}}>{Math.round(weather.temperature_2m)}{tempSymbol}</div>
            {loc && w > 170 && <div style={{fontFamily:FF,fontSize:Math.max(9,tempSize*0.32),color:"var(--nv-text-dim)",marginTop:3}}>{loc}</div>}
          </div>
        </div>
        {weather.windspeed_10m != null && h > 120 && <div style={{fontFamily:FF,fontSize:9,color:"var(--nv-text-dim)"}}>💨 {weather.windspeed_10m} {units==="imperial"?"mph":"km/h"}</div>}
      </>)}
    </div>
  );
}

export function NotesWidgetContent({ data, state }) {
  const notes = (data?.notes || []).slice(0, 8);
  const h = state.h - 28;
  return (
    <div style={{width:"100%",height:"100%",overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
      {notes.length === 0 && <div style={{fontFamily:FF,fontSize:11,color:"var(--nv-text-dim)",fontStyle:"italic",margin:"auto",textAlign:"center"}}>📝 No notes yet</div>}
      {notes.map(n => (
        <div key={n.id} style={{
          padding:"8px 11px",
          background:"linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
          border:"1px solid var(--nv-border)",
          borderRadius:9,flexShrink:0,
          transition:"background 0.18s",
        }}>
          <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"var(--nv-text-strong)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:0.1}}>{n.title}</div>
          {n.body && h > 150 && <div style={{fontFamily:FF,fontSize:10,color:"var(--nv-text-dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:3,lineHeight:1.4}}>{n.body}</div>}
        </div>
      ))}
    </div>
  );
}

export function TasksWidgetContent({ data, updateData, state, AC }) {
  const tasks = (data?.tasks || []).filter(t => !t.done).slice(0, 10);
  function toggle(id) { updateData(p => ({...p, tasks: p.tasks.map(t => t.id === id ? {...t, done: !t.done} : t)})); }
  return (
    <div style={{width:"100%",height:"100%",overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:4}}>
      {tasks.length === 0 && <div style={{fontFamily:FF,fontSize:11,color:"var(--nv-text-dim)",fontStyle:"italic",margin:"auto",textAlign:"center"}}>✓ All tasks done!</div>}
      {tasks.map(t => (
        <div key={t.id} className="fr" style={{
          display:"flex",alignItems:"center",gap:9,
          padding:"7px 10px",
          background:"var(--nv-elevated)",
          borderRadius:8,flexShrink:0,cursor:"pointer",
          transition:"background 0.15s",
        }} onClick={() => toggle(t.id)}>
          <div style={{
            width:15,height:15,borderRadius:5,
            border:"1.5px solid rgba(255,255,255,0.3)",
            background:"var(--nv-elevated)",
            flexShrink:0,
            transition:"border-color 0.18s, background 0.18s",
          }}/>
          <span style={{fontFamily:FF,fontSize:11.5,color:"var(--nv-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{t.text}</span>
        </div>
      ))}
      {data?.tasks?.filter(t => !t.done).length > 10 && <div style={{fontFamily:FFM,fontSize:9.5,color:"var(--nv-text-dim)",textAlign:"center",paddingTop:4,letterSpacing:0.3}}>+{data.tasks.filter(t => !t.done).length - 10} more</div>}
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
  const w = state.w, h = state.h - 28;
  const cellSz = Math.max(18, Math.min((w - 24) / 7, (h - 44) / Math.ceil(cells.length / 7)));
  // v8.0: today gets a glowing accent pill instead of a flat square fill;
  // weekend days are dimmed; current-month header gets letter-spacing for
  // a more typographic feel.
  return (
    <div style={{width:"100%",height:"100%",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
      <div style={{fontFamily:FFB,fontWeight:700,fontSize:Math.max(11,cellSz*0.55),color:"var(--nv-text)",textAlign:"center",letterSpacing:0.5}}>
        {tick.toLocaleDateString([], {month:"long", year:"numeric"})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {DAYS.map((d,i) => <div key={d} style={{textAlign:"center",fontFamily:FFB,fontWeight:600,fontSize:Math.max(8,cellSz*0.42),color:i===0||i===6?"var(--nv-text-dim)":"var(--nv-text-dim)",padding:"2px 0",letterSpacing:0.3}}>{d}</div>)}
        {cells.map((d, i) => {
          const dayOfWeek = i % 7;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isToday = d === today;
          return (
            <div key={i} style={{
              textAlign:"center",
              fontFamily:isToday?FFB:FF,
              fontSize:Math.max(9,cellSz*0.48),
              color:isToday?"var(--nv-text-strong)":isWeekend?"var(--nv-text-dim)":"var(--nv-text)",
              background:isToday?"linear-gradient(135deg,"+AC+","+AC+")":"transparent",
              borderRadius:6,
              padding:"2px 0",
              fontWeight:isToday?700:400,
              boxShadow:isToday?"0 0 12px "+AC+"55, 0 0 0 1px rgba(255,255,255,0.15) inset":"none",
              minHeight:cellSz*0.7,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>{d || ""}</div>
          );
        })}
      </div>
    </div>
  );
}

export function SysInfoWidgetContent({ state }) {
  const [uptime, setUptime] = useState(0);
  // v8.7: real metrics on the Tauri desktop build; `real` stays null on web,
  // where we fall back to the simulated numbers below.
  const [real, setReal] = useState(null);
  useEffect(() => {
    const t = setInterval(() => setUptime(Math.floor(performance.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!isDesktop()) return;
    let alive = true;
    const poll = async () => { const info = await getSystemInfo(); if (alive && info) setReal(info); };
    poll();
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const fmtUp = s => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`; };
  const fmtGB = b => (b / 1073741824).toFixed(1) + " GB";
  const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
  // Simulated fallback (web) drifts gently; desktop uses the real readings.
  const simCpu = 55 + Math.floor((uptime % 30) / 30 * 30);
  const simRam = 62 + Math.floor((uptime % 20) / 20 * 20);
  const cpu = real ? clamp(real.cpu) : simCpu;
  const ram = real ? clamp(real.memTotal ? (real.memUsed / real.memTotal) * 100 : 0) : simRam;
  const cpuSub = real ? (real.cores + (real.cores === 1 ? " core" : " cores")) : "Virtual Core";
  const ramSub = real ? (fmtGB(real.memUsed) + " / " + fmtGB(real.memTotal)) : "8.0 GB";
  // v8.0: progress bars become rounded gradient pills with a subtle inner
  // shadow for depth; labels are uppercase + spaced for that "system monitor"
  // typographic vibe.
  const Bar = ({pct, col = "#4f9eff"}) => (
    <div style={{flex:1,height:6,background:"var(--nv-elevated)",borderRadius:4,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,0.2) inset"}}>
      <div style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+col+"88,"+col+")",borderRadius:4,transition:"width 1s var(--nv-ease)",boxShadow:"0 0 6px "+col+"55"}}/>
    </div>
  );
  const h = state.h - 28;
  const fs = Math.max(9, Math.min(h * 0.1, 12));
  return (
    <div style={{width:"100%",height:"100%",padding:"10px 14px",display:"flex",flexDirection:"column",justifyContent:"space-evenly",gap:6}}>
      {[["CPU",cpuSub,cpu,"#4f9eff"],["RAM",ramSub,ram,"#4cef90"]].map(([lbl,sub,pct,col]) => (
        <div key={lbl}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"baseline"}}>
            <span style={{fontFamily:FFB,fontWeight:600,fontSize:fs,color:"var(--nv-text)",letterSpacing:1,textTransform:"uppercase"}}>{lbl}</span>
            <span style={{fontFamily:FFM,fontWeight:500,fontSize:fs,color:col,letterSpacing:0.3}}>{pct}%</span>
          </div>
          <Bar pct={pct} col={col}/>
          {h > 120 && <div style={{fontFamily:FF,fontSize:fs*0.88,color:"var(--nv-text-dim)",marginTop:2}}>{sub}</div>}
        </div>
      ))}
      {h > 110 && <div style={{fontFamily:FFM,fontSize:fs*0.95,color:"var(--nv-text-dim)",letterSpacing:0.4,paddingTop:2,borderTop:"1px solid var(--nv-border)"}}>⏱ {fmtUp(uptime)}&nbsp;·&nbsp;{window.innerWidth}×{window.innerHeight}</div>}
    </div>
  );
}

// v8.1 — Battery widget. Reads navigator.getBattery() (Chromium / most
// PWA installs). Subscribes to level / charging-state change events so
// the display updates in real time without polling.
//
// Three states it can be in:
//   1. API unsupported          → friendly "Battery unavailable" message
//   2. Desktop (no battery)     → device reports level=1 + charging=true
//                                 perpetually; show "Plugged in" pill
//                                 instead of a useless 100% forever
//   3. Laptop / tablet on battery → live percent + horizontal battery
//                                   glyph + charging/discharging time
export function BatteryWidgetContent({ state, AC }) {
  const [info, setInfo] = useState({ status: "loading" });
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.getBattery) {
      setInfo({ status: "unsupported" });
      return;
    }
    let mounted = true;
    let battery = null;
    function sync() {
      if (!mounted || !battery) return;
      setInfo({
        status: "ok",
        level: battery.level,
        charging: battery.charging,
        // chargingTime / dischargingTime can be Infinity when unknown
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      });
    }
    navigator.getBattery().then(b => {
      if (!mounted) return;
      battery = b;
      sync();
      b.addEventListener("levelchange", sync);
      b.addEventListener("chargingchange", sync);
      b.addEventListener("chargingtimechange", sync);
      b.addEventListener("dischargingtimechange", sync);
    }).catch(() => setInfo({ status: "unsupported" }));
    return () => {
      mounted = false;
      if (battery) {
        battery.removeEventListener("levelchange", sync);
        battery.removeEventListener("chargingchange", sync);
        battery.removeEventListener("chargingtimechange", sync);
        battery.removeEventListener("dischargingtimechange", sync);
      }
    };
  }, []);

  if (info.status === "loading") {
    return (
      <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FF,fontSize:11,color:"var(--nv-text-dim)"}}>
        Reading battery…
      </div>
    );
  }
  if (info.status === "unsupported") {
    return (
      <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:10,gap:4,textAlign:"center"}}>
        <div style={{fontSize:20,opacity:0.55}}>🔌</div>
        <div style={{fontFamily:FF,fontSize:10.5,color:"var(--nv-text-dim)",lineHeight:1.4}}>Battery info unavailable<br/><span style={{fontSize:9,opacity:0.7}}>your browser doesn't expose it</span></div>
      </div>
    );
  }
  const pct = Math.round(info.level * 100);
  // Heuristic for "no battery present": desktop with cable plugged in
  // permanently reports level=1 + charging=true and discharge time
  // Infinity. Real laptops at 100% report level=1 + charging=true but
  // also have a finite discharge time on disconnect; while plugged in,
  // dischargingTime is Infinity. So this isn't a perfect detection,
  // but it's good enough — when in doubt we still show real numbers.
  const stuck100 = info.charging && pct === 100 && info.dischargingTime === Infinity;

  // Color the battery fill by level
  const fillColor = info.charging ? "#4cef90"
    : pct > 50 ? "#a8c5ff"
    : pct > 20 ? "#ffcc66"
    : "#ff7878";

  // Time-remaining string
  function fmtMin(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const m = Math.round(seconds / 60);
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60), mm = m % 60;
    return h + "h " + (mm < 10 ? "0" + mm : mm) + "m";
  }
  const timeStr = info.charging ? fmtMin(info.chargingTime) : fmtMin(info.dischargingTime);

  const h = state.h - 28;
  const big = Math.max(20, Math.min(h * 0.36, 36));
  return (
    <div style={{width:"100%",height:"100%",padding:"10px 14px",display:"flex",flexDirection:"column",justifyContent:"center",gap:6}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {/* Horizontal battery glyph */}
        <div style={{position:"relative",width:38,height:18,border:"1.5px solid rgba(255,255,255,0.55)",borderRadius:4,padding:1.5,flexShrink:0}}>
          <div style={{position:"absolute",right:-4,top:5,width:2.5,height:6,background:"var(--nv-elevated)",borderRadius:1}}/>
          <div style={{width:Math.max(2,pct)+"%",height:"100%",background:fillColor,borderRadius:1.5,transition:"width 0.6s, background 0.3s"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",minWidth:0,flex:1}}>
          <div style={{fontFamily:FFM,fontWeight:500,fontSize:big,color:"var(--nv-text-strong)",lineHeight:1,letterSpacing:0.5}}>{pct}%</div>
          <div style={{fontFamily:FF,fontSize:10,color:"var(--nv-text-dim)",marginTop:3}}>
            {stuck100 ? "Plugged in" : info.charging ? (timeStr ? "Charging · " + timeStr : "Charging") : (timeStr ? timeStr + " left" : "On battery")}
          </div>
        </div>
        {/* Small lightning icon when charging */}
        {info.charging && !stuck100 && (
          <div style={{fontSize:14,color:fillColor,filter:"drop-shadow(0 0 4px " + fillColor + "55)",flexShrink:0}}>⚡</div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// v9.5 — Pomodoro widget
// ──────────────────────────────────────────────────────────────────────
// Classic 25/5/15 cycle: four 25-minute "focus" rounds with 5-minute
// short breaks between, then a 15-minute long break. The user can
// pause, skip (advance to the next phase), or reset. The current phase
// ends with a soft chime — we reuse the existing `playSound("notify")`
// recipe so it matches the rest of the OS's audio palette.
//
// State lives entirely in component state. Persistence across page
// refreshes isn't worth the storage cost — pomodoros are a "right now"
// kind of timer.
//
// Why not useEffect with setInterval? We do use one, but we anchor the
// remaining time to a *target wall-clock timestamp* (`endsAt`). That
// way: (a) the displayed countdown stays accurate even after the
// browser throttles the tab in the background, and (b) pausing is a
// matter of swapping `endsAt` ⇄ `remainingMs`.

import { playSound } from "../lib/audio.js";

const PHASES = {
  focus: { label: "Focus",       durMs: 25 * 60 * 1000, color: "#fb7185" },
  short: { label: "Short break", durMs:  5 * 60 * 1000, color: "#34d399" },
  long:  { label: "Long break",  durMs: 15 * 60 * 1000, color: "#60a5fa" },
};
// Cycle: 4 focus rounds, with shorts between, then long after the 4th.
function nextPhase(phase, completedFocus) {
  if (phase === "focus") {
    return (completedFocus % 4 === 0) ? "long" : "short";
  }
  return "focus";
}

export function PomodoroWidgetContent({ state, AC }) {
  // Phase + timing — endsAt is the absolute ms timestamp when the current
  // phase ends; remainingMs is only used while paused.
  const [phase, setPhase] = useState("focus");
  const [completedFocus, setCompletedFocus] = useState(0);
  const [endsAt, setEndsAt] = useState(null);            // null = paused
  const [remainingMs, setRemainingMs] = useState(PHASES.focus.durMs);
  const [now, setNow] = useState(Date.now());

  // Tick. Anchor to wall clock so a throttled tab still shows the right
  // time when you come back to it.
  useEffect(() => {
    if (endsAt == null) return;          // paused — no ticking
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // End-of-phase handler: chime, swap to the next phase, auto-start the
  // break (most pomodoro apps do this; the user can pause if they want).
  useEffect(() => {
    if (endsAt == null) return;
    if (now >= endsAt) {
      try { playSound("notify"); } catch {}
      const justFinished = phase;
      const nextFocusCount = phase === "focus" ? completedFocus + 1 : completedFocus;
      const nextP = nextPhase(justFinished, nextFocusCount);
      setCompletedFocus(nextFocusCount);
      setPhase(nextP);
      setEndsAt(Date.now() + PHASES[nextP].durMs);
      setRemainingMs(PHASES[nextP].durMs);
    }
  }, [now, endsAt, phase, completedFocus]);

  function start() {
    setEndsAt(Date.now() + remainingMs);
  }
  function pause() {
    if (endsAt == null) return;
    setRemainingMs(Math.max(0, endsAt - Date.now()));
    setEndsAt(null);
  }
  function reset() {
    setEndsAt(null);
    setPhase("focus");
    setCompletedFocus(0);
    setRemainingMs(PHASES.focus.durMs);
  }
  function skip() {
    const next = nextPhase(phase, phase === "focus" ? completedFocus + 1 : completedFocus);
    if (phase === "focus") setCompletedFocus(c => c + 1);
    setPhase(next);
    const dur = PHASES[next].durMs;
    setRemainingMs(dur);
    setEndsAt(endsAt == null ? null : Date.now() + dur);   // preserve running/paused state
  }

  const running = endsAt != null;
  const msLeft = running ? Math.max(0, endsAt - now) : remainingMs;
  const totalMs = PHASES[phase].durMs;
  const pct = Math.max(0, Math.min(1, 1 - msLeft / totalMs));
  const color = PHASES[phase].color;

  function fmt(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  // Sizing: the timer text + dots scale with widget height so it stays
  // readable when the user shrinks it.
  const h = state.h - 28;
  const timeSize = Math.max(28, Math.min(h * 0.34, 48));

  return (
    <div style={{ width: "100%", height: "100%", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Phase chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <span style={{
          padding: "2px 9px", borderRadius: 12,
          background: color + "22", border: "1px solid " + color + "55", color: color,
          fontFamily: FFB, fontWeight: 700, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase",
        }}>{PHASES[phase].label}</span>
        <div style={{ flex: 1 }}/>
        {/* Cycle dots — show completed focus rounds. */}
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2, 3].map(i => {
            const filled = i < (completedFocus % 4) || (completedFocus % 4 === 0 && completedFocus > 0 && i < 4);
            return <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: filled ? color : "var(--nv-border-strong)", transition: "background 0.18s" }}/>;
          })}
        </div>
      </div>

      {/* Big time */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{ fontFamily: FFM, fontSize: timeSize, color: "var(--nv-text-strong)", letterSpacing: 1.5, lineHeight: 1 }}>{fmt(msLeft)}</div>
        {/* Progress arc — pure-CSS, no SVG needed */}
        <div style={{ width: "100%", height: 4, background: "var(--nv-elevated)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: pct * 100 + "%", height: "100%", background: color, transition: "width 0.4s linear", boxShadow: `0 0 8px ${color}88` }}/>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {!running ? (
          <button onClick={start} style={pomoBtn(color, true)}>▶ Start</button>
        ) : (
          <button onClick={pause} style={pomoBtn(color, true)}>⏸ Pause</button>
        )}
        <button onClick={skip}  title="Skip to next phase" style={pomoBtn(color, false)}>⏭</button>
        <button onClick={reset} title="Reset cycle" style={pomoBtn(color, false)}>↺</button>
      </div>
    </div>
  );
}
function pomoBtn(color, primary) {
  return {
    flex: primary ? 1 : "0 0 36px",
    height: 30,
    background: primary ? color + "22" : "transparent",
    border: "1px solid " + (primary ? color + "55" : "var(--nv-border)"),
    borderRadius: 7,
    cursor: "pointer",
    color: primary ? color : "var(--nv-text-dim)",
    fontFamily: FFB, fontWeight: 600, fontSize: 11.5,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  };
}

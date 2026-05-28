import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { WMO } from "../ui/constants.js";
import { AiAssist } from "../ui/AiAssist.jsx";
import { wmoIcon, wmoLabel, geocodeUrl, parseGeocode, forecastUrl, parseForecast, alertsUrl, parseAlerts, isLikelyUS } from "../lib/weather.js";
import { speak, cancelSpeech, playSound } from "../lib/audio.js";

const ALERT_COLOR = {
  Extreme:  {bg:"rgba(255,80,80,0.18)",  border:"rgba(255,80,80,0.55)",  fg:"#ff8080"},
  Severe:   {bg:"rgba(255,150,40,0.16)", border:"rgba(255,150,40,0.5)",  fg:"#ffaa44"},
  Moderate: {bg:"rgba(255,200,80,0.14)", border:"rgba(255,200,80,0.45)", fg:"#ffd060"},
  Minor:    {bg:"rgba(100,200,255,0.12)",border:"rgba(100,200,255,0.4)", fg:"#88c8ff"},
};

export function AtmosApp({AC,showToast,pushNotification,openNovaAi,data,updateSettings,onSevereAlert}){
  // v9.4 — track which severe-alert ids have already triggered the
  // lock-screen-style overlay so re-fetches (every poll) don't re-pop the
  // same alert over and over. Lives in a ref because we only need it for
  // dedup, not render.
  const firedSevereRef = useRef(new Set());
  const [query,setQuery]=useState("");
  const [suggestions,setSuggestions]=useState([]);    // array of suggestion objects
  const [openSuggest,setOpenSuggest]=useState(false);
  const [loadingSuggest,setLoadingSuggest]=useState(false);
  const [loc,setLoc]=useState(null);                  // selected {label,lat,lon,countryCode}
  const [forecast,setForecast]=useState(null);
  const [alerts,setAlerts]=useState([]);
  const [loadingForecast,setLoadingForecast]=useState(false);
  // v6.4: units preference persists per-account. Defaults to imperial.
  const [units,setUnits]=useState(()=>data?.settings?.weatherUnits||"imperial");
  const [expandedAlert,setExpandedAlert]=useState(null);
  const debounceRef=useRef(null);
  // v6.4: the user can pin a default location that persists across sessions
  // AND drives the Weather desktop widget. Saved at data.settings.weatherLocation.
  const savedLoc = data?.settings?.weatherLocation || null;
  // v6.4: last-5 recent searches shown as quick-tap chips below the search bar.
  // Each entry is the same shape as a pickLocation argument so the chip click
  // can call pickLocation directly. Deduped by (lat,lon) and capped at 5.
  const recentLocations = data?.settings?.recentLocations || [];

  // Debounced geocode lookup as the user types. 350ms is just slow enough to
  // not hammer Nominatim's 1-req/sec policy, and just fast enough to feel live.
  useEffect(()=>{
    if(!query.trim()){setSuggestions([]);setOpenSuggest(false);return;}
    clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(async()=>{
      setLoadingSuggest(true);
      try{
        const res=await fetch(geocodeUrl(query));
        const json=await res.json();
        setSuggestions(parseGeocode(json));
        setOpenSuggest(true);
      }catch{setSuggestions([]);}
      setLoadingSuggest(false);
    },350);
    return ()=>clearTimeout(debounceRef.current);
  },[query]);

  // v6.4: on mount, if the user has a pinned location from a previous
  // session, auto-load it so they don't have to re-search every time. Only
  // fires once (loc starts null), and skips if no saved location.
  useEffect(()=>{
    if(savedLoc && !loc){
      pickLocation(savedLoc, /*skipSave=*/true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function pickLocation(s, skipSave){
    // Whenever we switch locations we want to silence any in-progress TTS
    // read-out from the previous location's alerts. Otherwise queued
    // utterances would keep playing over the new selection.
    cancelSpeech();
    setLoc(s);
    setQuery(s.label);
    setOpenSuggest(false);
    setLoadingForecast(true);
    setForecast(null);setAlerts([]);
    // v6.4: persist the choice so it survives reloads and so the Weather
    // widget picks it up. skipSave is set when we're re-loading the already-
    // saved value on mount — no need to round-trip a write for a no-op.
    if(!skipSave && updateSettings){
      // Only save the fields we actually need — strip any extra props the
      // geocoder may have attached so the Firestore doc stays slim.
      const slim = {label:s.label, lat:s.lat, lon:s.lon, countryCode:s.countryCode || null};
      // Update the recent-locations list: move/insert this city to the front,
      // dedupe by (lat,lon), keep only the last 5.
      const filtered = (data?.settings?.recentLocations || []).filter(r => !(r.lat===s.lat && r.lon===s.lon));
      const nextRecent = [slim, ...filtered].slice(0, 5);
      updateSettings({weatherLocation: slim, recentLocations: nextRecent});
    }
    try{
      const fres=await fetch(forecastUrl(s.lat,s.lon,units));
      const fjson=await fres.json();
      setForecast(parseForecast(fjson));
    }catch{showToast?.("Couldn't load forecast");}
    // Only ping NWS for US points — it returns empty for non-US anyway, and
    // we'd rather not waste the request.
    if(isLikelyUS(s.lat,s.lon)){
      try{
        const ares=await fetch(alertsUrl(s.lat,s.lon),{headers:{Accept:"application/geo+json"}});
        const ajson=await ares.json();
        const parsed=parseAlerts(ajson);
        setAlerts(parsed);
        // Audible alert sequence when active alerts are present:
        //   1. Three-pulse 607 Hz sawtooth — the v9.4 NWS recipe, mirroring
        //      Weatherscan's classic alarm cadence (was a single sine tone
        //      pre-v9.4).
        //   2. After ~3.7 s (a beat after the dual-tone signal ends), TTS
        //      reads each alert's event + headline so the user can hear
        //      what's happening without looking at the screen.
        // The tone plays each time a location with alerts is loaded; the
        // TTS queues all alerts in order, automatically read back-to-back
        // by the browser's SpeechSynthesis queue.
        if(parsed.length>0){
          playSound("nwsAlert");
          setTimeout(()=>{
            for(const a of parsed){
              const summary = a.event + (a.headline ? ". " + a.headline : "");
              speak(summary);
            }
          }, 3700);
          // Mirror each active alert into the persistent notification center
          // so the user can revisit them later via the bell icon.
          if(pushNotification){
            for(const a of parsed){
              pushNotification({
                kind: (a.severity==="Extreme"||a.severity==="Severe")?"alert":"warning",
                title: a.event + " — " + s.label,
                body: a.headline || a.description?.slice(0,180) || "",
                appId: "atmos",
              });
            }
          }
          // v9.4 — surface a lock-screen-style severe-weather card for any
          // Severe / Extreme alert. NovaOS owns the overlay; we just hand
          // it the alert. Dedup via a ref so a re-fetch of the same alert
          // id doesn't re-pop the overlay every poll.
          if (onSevereAlert) {
            const severe = parsed.find(a => a.severity === "Extreme")
                      || parsed.find(a => a.severity === "Severe");
            if (severe) {
              const key = severe.id || (severe.event + "|" + (severe.headline || ""));
              if (!firedSevereRef.current.has(key)) {
                firedSevereRef.current.add(key);
                onSevereAlert({ ...severe, locationLabel: s.label });
              }
            }
          }
        }
      }catch{/* alerts are optional — don't surface error */}
    }
    setLoadingForecast(false);
  }

  // Re-fetch forecast when units flip (only if we already have a location)
  useEffect(()=>{
    if(!loc)return;
    setLoadingForecast(true);
    (async()=>{
      try{
        const r=await fetch(forecastUrl(loc.lat,loc.lon,units));
        setForecast(parseForecast(await r.json()));
      }catch{}
      setLoadingForecast(false);
    })();
  },[units]); // eslint-disable-line

  function fmtHour(iso){
    try{return new Date(iso).toLocaleTimeString([],{hour:"numeric",hour12:true});}
    catch{return iso;}
  }
  function fmtDay(iso){
    try{return new Date(iso+"T12:00:00").toLocaleDateString([],{weekday:"short"});}
    catch{return iso;}
  }

  // v8.2: ref for the search+recents container so the click-outside handler
  // can scope itself to "outside this region" cleanly.
  const searchRegionRef = useRef(null);

  // v8.2: click-outside + Escape to dismiss the autocomplete dropdown.
  // Previously the dropdown had no dismiss-on-outside, AND the input's
  // onFocus auto-reopened it the moment the user touched the area again
  // — which is why the user reported "I close it, click a recent chip,
  // it pops back up". Now the dropdown closes cleanly on outside-click
  // and Escape, and the auto-reopen-on-focus is removed entirely.
  useEffect(()=>{
    if(!openSuggest) return;
    function onPointerDown(e){
      if(searchRegionRef.current && !searchRegionRef.current.contains(e.target)){
        setOpenSuggest(false);
      }
    }
    function onKey(e){ if(e.key==="Escape") setOpenSuggest(false); }
    // Delay so the click that opened the dropdown doesn't immediately close it
    const t=setTimeout(()=>document.addEventListener("pointerdown",onPointerDown),0);
    document.addEventListener("keydown",onKey);
    return ()=>{
      clearTimeout(t);
      document.removeEventListener("pointerdown",onPointerDown);
      document.removeEventListener("keydown",onKey);
    };
  },[openSuggest]);

  // v8.2: pick a weather-themed accent for the current conditions card based
  // on the WMO code. Sunny → warm gold, cloudy → cool slate, rainy → blue,
  // snow → icy, storm → dark. Just a tint shift, no full theming.
  function weatherAccent(code) {
    if (code == null) return AC;
    // 0-3: clear/partly cloudy. 4x-5x: fog/drizzle. 6x: rain. 7x: snow. 80-82: showers. 95-99: storm.
    if (code === 0)                  return "#f59e0b";    // clear sky
    if (code === 1 || code === 2)    return "#fbbf24";    // mostly clear
    if (code === 3)                  return "#94a3b8";    // overcast
    if (code >= 45 && code <= 48)    return "#9ca3af";    // fog
    if (code >= 51 && code <= 67)    return "#60a5fa";    // drizzle/rain
    if (code >= 71 && code <= 77)    return "#bae6fd";    // snow
    if (code >= 80 && code <= 82)    return "#3b82f6";    // showers
    if (code >= 85 && code <= 86)    return "#c4b5fd";    // snow showers
    if (code >= 95)                  return "#a855f7";    // thunderstorm
    return AC;
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12,height:"100%",fontFamily:FF,minHeight:0}}>
      {/* v8.2: wrap search + recents + dropdown in one positioned container
          so the dropdown can `top:100%` and float below the recents row
          rather than on top of it. Click-outside listener (scoped to this
          ref) handles dismissal. */}
      <div ref={searchRegionRef} style={{flexShrink:0,position:"relative",display:"flex",flexDirection:"column",gap:8}}>
        {/* Search row */}
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}>
            <input
              value={query}
              onChange={e=>{setQuery(e.target.value); if(e.target.value.trim()) setOpenSuggest(true);}}
              placeholder="Search for a city, town, ZIP code…"
              style={{...INP,fontSize:13,fontFamily:FF,paddingLeft:34}}
            />
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:0.5,pointerEvents:"none"}}>🔍</span>
            {query && (
              <button onClick={()=>{setQuery("");setSuggestions([]);setOpenSuggest(false);}} title="Clear" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:22,height:22,borderRadius:6,background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.55)",fontSize:11,padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            )}
          </div>
          <button onClick={()=>setUnits(u=>{
            const next = u==="imperial"?"metric":"imperial";
            if(updateSettings) updateSettings({weatherUnits:next});
            return next;
          })} style={{padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.7)"}}>{units==="imperial"?"°F":"°C"}</button>
        </div>

        {/* Recents row — now inside the same container as search. Dropdown
            floats below this whole region instead of covering it. */}
        {recentLocations.length > 0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.32)",letterSpacing:1,alignSelf:"center",marginRight:2}}>RECENT</span>
            {recentLocations.map((r, i) => {
              const isActive = loc && loc.lat===r.lat && loc.lon===r.lon;
              const shortLabel = (r.label || "").split(",")[0].trim();
              return (
                <button key={r.lat+","+r.lon+","+i} onClick={()=>pickLocation(r)} title={r.label}
                  style={{padding:"4px 10px",background:isActive?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(isActive?bdr(AC):"rgba(255,255,255,0.1)"),borderRadius:14,cursor:"pointer",fontFamily:FF,fontSize:11,color:isActive?AC:"rgba(255,255,255,0.7)",whiteSpace:"nowrap",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",transition:"all 0.15s"}}>
                  📍 {shortLabel}
                </button>
              );
            })}
          </div>
        )}

        {/* v8.2: autocomplete dropdown — now positioned absolute relative to
            the WHOLE search region (input + recents), so it appears BELOW
            both rather than covering recents. */}
        {openSuggest && (loadingSuggest||suggestions.length>0) && (
          <div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,background:"rgba(15,18,32,0.97)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,boxShadow:"0 20px 60px rgba(0,0,0,0.5)",maxHeight:220,overflowY:"auto",zIndex:20}}>
            {loadingSuggest && <div style={{padding:"10px 13px",fontSize:11,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Searching…</div>}
            {!loadingSuggest && suggestions.length===0 && <div style={{padding:"10px 13px",fontSize:11,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>No matches</div>}
            {!loadingSuggest && suggestions.map((s,i)=>(
              <div key={i} className="sr" onClick={()=>pickLocation(s)} style={{padding:"9px 13px",cursor:"pointer",fontSize:13,color:"rgba(255,255,255,0.85)",borderBottom:i<suggestions.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                📍 {s.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",minHeight:0,display:"flex",flexDirection:"column",gap:12}}>
        {!loc && !loadingForecast && (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:30,textAlign:"center",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))"}}>
            <div style={{fontSize:60,filter:"drop-shadow(0 0 16px rgba(79,158,255,0.4))"}}>🌤️</div>
            <div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:"rgba(255,255,255,0.9)",letterSpacing:0.4}}>Atmos</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",maxWidth:340,lineHeight:1.7}}>Search any location to see current conditions, live radar, hourly + 7-day forecast, and active NWS alerts for US locations. US locations with active alerts also trigger an audible 607 Hz tone followed by a TTS read-out of each alert.</div>
          </div>
        )}

        {loadingForecast && (
          <div style={{padding:"30px 0",textAlign:"center"}}>
            <div style={{width:30,height:30,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:10}}>Loading forecast for {loc?.label}…</div>
          </div>
        )}

        {!loadingForecast && forecast && (() => {
          // v8.2: derive a weather-themed accent for the current-conditions
          // card. This is what makes the card feel less "monochrome utility"
          // and more "iOS Weather-ish" — sunny days warm, rainy days blue, etc.
          const wAccent = weatherAccent(forecast.current.code);
          const wRgb = hexRgb(wAccent);
          return (
          <>
            {/* Current conditions — v8.2: weather-themed gradient card */}
            <div style={{
              padding:"18px 20px",
              background:"linear-gradient(135deg, rgba("+wRgb+",0.22) 0%, rgba("+wRgb+",0.08) 50%, rgba(255,255,255,0.02) 100%)",
              border:"1px solid rgba("+wRgb+",0.4)",
              borderRadius:14,
              boxShadow:"0 0 24px rgba("+wRgb+",0.15)",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{flex:1,fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.6)",letterSpacing:1,display:"flex",alignItems:"center",gap:6}}>
                  {/* v8.2.1: single toggle button. Click 📌 to pin, click
                      again to unpin. Opacity signals state: full opacity =
                      pinned, low opacity = not pinned. Replaces the v8.2
                      pair of (decorative ✛ + tiny grey ✕ to unpin + my
                      added 📌 to pin) which was confusing — users tried
                      clicking the visible decorative pin and nothing
                      happened because it was a non-interactive span. */}
                  {loc && updateSettings && (() => {
                    const isPinned = savedLoc && savedLoc.lat===loc.lat && savedLoc.lon===loc.lon;
                    return (
                      <button
                        onClick={()=>{
                          if (isPinned) {
                            updateSettings({weatherLocation: null});
                            showToast?.("Location unpinned");
                          } else {
                            const slim = {label: loc.label, lat: loc.lat, lon: loc.lon, countryCode: loc.countryCode || null};
                            updateSettings({weatherLocation: slim});
                            showToast?.("Location pinned ✓");
                          }
                        }}
                        title={isPinned ? "Pinned — click to unpin (also drives the Weather widget)" : "Click to pin this location"}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                          padding: "0 2px",
                          opacity: isPinned ? 0.95 : 0.35,
                          filter: isPinned ? "drop-shadow(0 0 4px rgba(255,200,80,0.6))" : "none",
                          transition: "opacity 0.18s, filter 0.18s",
                          lineHeight: 1,
                        }}
                      >
                        📌
                      </button>
                    );
                  })()}
                  <span>CURRENT · {loc.label}</span>
                </div>
                <AiAssist AC={AC} openNovaAi={openNovaAi} actions={[
                  {icon:"🧠",label:"Explain this weather",prompt:"In 2-3 sentences, explain what this weather means in plain English for someone planning their day:"},
                  {icon:"👕",label:"What should I wear?",prompt:"Based on this weather, suggest practical clothing recommendations:"},
                  {icon:"⚠",label:"Any safety concerns?",prompt:"Briefly note any safety or health considerations from this weather (heat, cold, UV, air quality, etc.):"},
                ]} getContext={()=>{
                  const c=forecast.current;
                  return `Location: ${loc.label}\nCurrent: ${Math.round(c.temp)}${forecast.units.temp}, ${wmoLabel(c.code)}\nFeels like: ${Math.round(c.feelsLike)}${forecast.units.temp}\nHumidity: ${c.humidity}%\nWind: ${Math.round(c.wind)} ${forecast.units.wind}\n\n7-day forecast highs/lows: ${forecast.days.map(d=>Math.round(d.high)+"/"+Math.round(d.low)).join(", ")}`;
                }}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginTop:6}}>
                <div style={{fontSize:72,lineHeight:1,filter:"drop-shadow(0 2px 14px rgba("+wRgb+",0.45))"}}>{wmoIcon(forecast.current.code)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:FFM,fontWeight:200,fontSize:56,color:"#fff",lineHeight:1,letterSpacing:-1}}>{Math.round(forecast.current.temp)}<span style={{fontSize:28,opacity:0.7,letterSpacing:0}}>{forecast.units.temp}</span></div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,0.78)",marginTop:4,fontFamily:FFB,fontWeight:500,letterSpacing:0.3}}>{wmoLabel(forecast.current.code)}</div>
                </div>
              </div>
              {/* Metric chips with subtle backdrop for legibility on bright wallpapers */}
              <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
                {[
                  ["Feels like", Math.round(forecast.current.feelsLike) + forecast.units.temp],
                  ["Humidity",   forecast.current.humidity + "%"],
                  ["Wind",       Math.round(forecast.current.wind) + " " + forecast.units.wind],
                ].map(([label, value]) => (
                  <div key={label} style={{padding:"6px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,fontSize:11,color:"rgba(255,255,255,0.6)"}}>
                    {label} <span style={{color:"#fff",fontFamily:FFM,fontWeight:500,marginLeft:4}}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Radar — Windy's official embed. v8.2: fixed height with
                a max-height cap so a wide window doesn't make the radar
                dominate the entire viewport (the iframe captures wheel
                events; if it fills the screen the user can't scroll past
                it to see the rest of the forecast). */}
            <div>
              <div style={SEC}>Live Radar</div>
              <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",height:360,maxHeight:"45vh",background:"#000"}}>
                <iframe
                  key={loc.lat+","+loc.lon}
                  src={"https://embed.windy.com/embed2.html?lat="+loc.lat+"&lon="+loc.lon+"&detailLat="+loc.lat+"&detailLon="+loc.lon+"&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1"}
                  title="Live radar"
                  loading="lazy"
                  style={{position:"absolute",inset:0,width:"100%",height:"100%",border:0}}
                />
              </div>
              {/* Hint that the radar captures wheel events — encourages users
                  to scroll past it via the side margin or use the page scroll
                  bar rather than getting "stuck" zooming the map. */}
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:4,fontStyle:"italic",textAlign:"center"}}>Scroll alongside the radar to continue past it</div>
            </div>

            {/* NWS alerts */}
            {alerts.length>0 && (
              <div>
                <div style={SEC}>⚠ NWS Alerts ({alerts.length})</div>
                {alerts.map(a=>{
                  const col=ALERT_COLOR[a.severity]||ALERT_COLOR.Minor;
                  const expanded=expandedAlert===a.id;
                  return(
                    <div key={a.id} onClick={()=>setExpandedAlert(expanded?null:a.id)} style={{padding:"10px 13px",marginBottom:6,background:col.bg,border:"1px solid "+col.border,borderRadius:8,cursor:"pointer"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:FFB,fontWeight:700,fontSize:12,color:col.fg,padding:"2px 7px",border:"1px solid "+col.border,borderRadius:4,whiteSpace:"nowrap"}}>{a.severity}</span>
                        <span style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.event}</span>
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{expanded?"▲":"▼"}</span>
                      </div>
                      {expanded && (
                        <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,0.78)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                          {a.headline && <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",marginBottom:6}}>{a.headline}</div>}
                          {a.description}
                          {a.sender && <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:8,fontStyle:"italic"}}>— {a.sender}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hourly */}
            {forecast.hourly.length>0 && (
              <div>
                <div style={SEC}>Next 24 Hours</div>
                <div style={{display:"flex",overflowX:"auto",gap:5,paddingBottom:6}}>
                  {forecast.hourly.map((h,i)=>(
                    <div key={i} style={{flex:"0 0 auto",minWidth:62,padding:"8px 6px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,textAlign:"center"}}>
                      <div style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.45)"}}>{i===0?"Now":fmtHour(h.time)}</div>
                      <div style={{fontSize:20,marginTop:2}}>{wmoIcon(h.code)}</div>
                      <div style={{fontFamily:FFM,fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{Math.round(h.temp)}°</div>
                      {h.pop>0&&<div style={{fontSize:9,color:"#88c8ff",fontFamily:FFM}}>{h.pop}%</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7-day — v8.2: temp-range bars give a visual sense of the
                week at a glance. The bar spans from the week's overall
                low to its overall high, and each day's bar segment
                represents that day's individual high→low range. */}
            <div>
              <div style={SEC}>7-Day Forecast</div>
              {(() => {
                // Compute the global high/low across the week so each day's
                // bar can be positioned proportionally inside the range.
                const allHighs = forecast.days.map(d => d.high);
                const allLows  = forecast.days.map(d => d.low);
                const weekHi   = Math.max(...allHighs);
                const weekLo   = Math.min(...allLows);
                const span     = Math.max(1, weekHi - weekLo);
                return forecast.days.map((d,i)=>{
                  const dayLoPct = ((d.low - weekLo) / span) * 100;
                  const dayHiPct = ((d.high - weekLo) / span) * 100;
                  // Color gradient from cool (low) to warm (high)
                  return (
                    <div key={d.date} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8}}>
                      <div style={{width:54,fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.88)"}}>{i===0?"Today":fmtDay(d.date)}</div>
                      <div style={{fontSize:22,width:34,textAlign:"center",filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.4))"}}>{wmoIcon(d.code)}</div>
                      <div style={{fontFamily:FFM,fontSize:12,color:"rgba(255,255,255,0.45)",minWidth:32,textAlign:"right"}}>{Math.round(d.low)}°</div>
                      <div style={{flex:1,position:"relative",height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{position:"absolute",left:dayLoPct+"%",width:Math.max(8,dayHiPct-dayLoPct)+"%",top:0,bottom:0,background:"linear-gradient(90deg, #60a5fa, #fbbf24, #f87171)",borderRadius:3}}/>
                      </div>
                      <div style={{fontFamily:FFM,fontSize:13,color:"#fff",minWidth:32,fontWeight:500}}>{Math.round(d.high)}°</div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
          );
        })()}

        {/* Attribution — required by Nominatim's usage policy */}
        <div style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.25)",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:"auto"}}>
          Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>OpenStreetMap</a> contributors · Forecast by <a href="https://open-meteo.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>Open-Meteo</a> · Radar by <a href="https://www.windy.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>Windy</a> · Alerts by <a href="https://www.weather.gov" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>NWS</a>
        </div>
      </div>
    </div>
  );
}

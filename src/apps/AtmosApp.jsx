import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { WMO } from "../ui/constants.js";
import { AiAssist } from "../ui/AiAssist.jsx";
import { wmoIcon, wmoLabel, geocodeUrl, parseGeocode, forecastUrl, parseForecast, alertsUrl, parseAlerts, isLikelyUS } from "../lib/weather.js";
import { speak, cancelSpeech, playTone } from "../lib/audio.js";

const ALERT_COLOR = {
  Extreme:  {bg:"rgba(255,80,80,0.18)",  border:"rgba(255,80,80,0.55)",  fg:"#ff8080"},
  Severe:   {bg:"rgba(255,150,40,0.16)", border:"rgba(255,150,40,0.5)",  fg:"#ffaa44"},
  Moderate: {bg:"rgba(255,200,80,0.14)", border:"rgba(255,200,80,0.45)", fg:"#ffd060"},
  Minor:    {bg:"rgba(100,200,255,0.12)",border:"rgba(100,200,255,0.4)", fg:"#88c8ff"},
};

export function AtmosApp({AC,showToast,pushNotification,openNovaAi}){
  const [query,setQuery]=useState("");
  const [suggestions,setSuggestions]=useState([]);    // array of suggestion objects
  const [openSuggest,setOpenSuggest]=useState(false);
  const [loadingSuggest,setLoadingSuggest]=useState(false);
  const [loc,setLoc]=useState(null);                  // selected {label,lat,lon,countryCode}
  const [forecast,setForecast]=useState(null);
  const [alerts,setAlerts]=useState([]);
  const [loadingForecast,setLoadingForecast]=useState(false);
  const [units,setUnits]=useState("imperial");        // imperial | metric
  const [expandedAlert,setExpandedAlert]=useState(null);
  const debounceRef=useRef(null);

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

  async function pickLocation(s){
    // Whenever we switch locations we want to silence any in-progress TTS
    // read-out from the previous location's alerts. Otherwise queued
    // utterances would keep playing over the new selection.
    cancelSpeech();
    setLoc(s);
    setQuery(s.label);
    setOpenSuggest(false);
    setLoadingForecast(true);
    setForecast(null);setAlerts([]);
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
        //   1. 607 Hz tone for 3 seconds (jolts the user to look)
        //   2. After ~3.1 s, TTS reads each alert's event + headline so the
        //      user can hear what's happening without looking at the screen.
        // The tone plays each time a location with alerts is loaded; the
        // TTS queues all alerts in order, automatically read back-to-back
        // by the browser's SpeechSynthesis queue.
        if(parsed.length>0){
          playTone(607, 3000);
          setTimeout(()=>{
            for(const a of parsed){
              const summary = a.event + (a.headline ? ". " + a.headline : "");
              speak(summary);
            }
          }, 3100);
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

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,height:"100%",fontFamily:FF,minHeight:0}}>
      {/* Header / search */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,position:"relative"}}>
        <div style={{flex:1,position:"relative"}}>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            onFocus={()=>suggestions.length>0&&setOpenSuggest(true)}
            placeholder="Search for a city, town, ZIP code…"
            style={{...INP,fontSize:13,fontFamily:FF,paddingLeft:34}}
          />
          <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:0.5,pointerEvents:"none"}}>🔍</span>
          {/* Autocomplete dropdown */}
          {openSuggest && (loadingSuggest||suggestions.length>0) && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:5,background:"rgba(15,18,32,0.97)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,boxShadow:"0 20px 60px rgba(0,0,0,0.5)",maxHeight:220,overflowY:"auto",zIndex:10}}>
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
        <button onClick={()=>setUnits(u=>u==="imperial"?"metric":"imperial")} style={{padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.7)"}}>{units==="imperial"?"°F":"°C"}</button>
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

        {!loadingForecast && forecast && (
          <>
            {/* Current conditions */}
            <div style={{padding:"16px 18px",background:"linear-gradient(135deg,"+fill(AC)+",rgba(255,255,255,0.03))",border:"1px solid "+bdr(AC),borderRadius:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{flex:1,fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.55)",letterSpacing:1}}>CURRENT · {loc.label}</div>
                <AiAssist AC={AC} openNovaAi={openNovaAi} actions={[
                  {icon:"🧠",label:"Explain this weather",prompt:"In 2-3 sentences, explain what this weather means in plain English for someone planning their day:"},
                  {icon:"👕",label:"What should I wear?",prompt:"Based on this weather, suggest practical clothing recommendations:"},
                  {icon:"⚠",label:"Any safety concerns?",prompt:"Briefly note any safety or health considerations from this weather (heat, cold, UV, air quality, etc.):"},
                ]} getContext={()=>{
                  const c=forecast.current;
                  return `Location: ${loc.label}\nCurrent: ${Math.round(c.temp)}${forecast.units.temp}, ${wmoLabel(c.code)}\nFeels like: ${Math.round(c.feelsLike)}${forecast.units.temp}\nHumidity: ${c.humidity}%\nWind: ${Math.round(c.wind)} ${forecast.units.wind}\n\n7-day forecast highs/lows: ${forecast.days.map(d=>Math.round(d.high)+"/"+Math.round(d.low)).join(", ")}`;
                }}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14,marginTop:4}}>
                <div style={{fontSize:62,lineHeight:1}}>{wmoIcon(forecast.current.code)}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:FFM,fontWeight:300,fontSize:48,color:"#fff",lineHeight:1}}>{Math.round(forecast.current.temp)}<span style={{fontSize:24,opacity:0.7}}>{forecast.units.temp}</span></div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:2}}>{wmoLabel(forecast.current.code)}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:14,marginTop:14,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Feels like <span style={{color:"#fff",fontFamily:FFM}}>{Math.round(forecast.current.feelsLike)}{forecast.units.temp}</span></div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Humidity <span style={{color:"#fff",fontFamily:FFM}}>{forecast.current.humidity}%</span></div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Wind <span style={{color:"#fff",fontFamily:FFM}}>{Math.round(forecast.current.wind)} {forecast.units.wind}</span></div>
              </div>
            </div>

            {/* Live Radar — Windy's official embed. Free, no API key, and Windy */}
            {/* explicitly supports embedding (their site has an "Embed widget" wizard). */}
            {/* We center the map on the location's lat/lon with radar overlay enabled. */}
            <div>
              <div style={SEC}>Live Radar</div>
              <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",aspectRatio:"16 / 10",background:"#000"}}>
                <iframe
                  key={loc.lat+","+loc.lon}
                  src={"https://embed.windy.com/embed2.html?lat="+loc.lat+"&lon="+loc.lon+"&detailLat="+loc.lat+"&detailLon="+loc.lon+"&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1"}
                  title="Live radar"
                  loading="lazy"
                  style={{position:"absolute",inset:0,width:"100%",height:"100%",border:0}}
                />
              </div>
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

            {/* 7-day */}
            <div>
              <div style={SEC}>7-Day Forecast</div>
              {forecast.days.map((d,i)=>(
                <div key={d.date} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7}}>
                  <div style={{width:60,fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.85)"}}>{i===0?"Today":fmtDay(d.date)}</div>
                  <div style={{fontSize:22,width:34,textAlign:"center"}}>{wmoIcon(d.code)}</div>
                  <div style={{flex:1,fontSize:11,color:"rgba(255,255,255,0.55)"}}>{wmoLabel(d.code)}</div>
                  <div style={{fontFamily:FFM,fontSize:13,color:"#fff",minWidth:62,textAlign:"right"}}>
                    {Math.round(d.high)}° <span style={{color:"rgba(255,255,255,0.4)"}}>/ {Math.round(d.low)}°</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Attribution — required by Nominatim's usage policy */}
        <div style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.25)",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:"auto"}}>
          Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>OpenStreetMap</a> contributors · Forecast by <a href="https://open-meteo.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>Open-Meteo</a> · Radar by <a href="https://www.windy.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>Windy</a> · Alerts by <a href="https://www.weather.gov" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>NWS</a>
        </div>
      </div>
    </div>
  );
}

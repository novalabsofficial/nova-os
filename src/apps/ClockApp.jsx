import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";

// v9.4 — Alarms. Day labels used by the Alarms tab's day picker.
// Index matches Date.getDay(): 0=Sun .. 6=Sat.
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// v9.4 — three built-in alarm sounds, surfaced as a small dropdown when
// creating/editing an alarm. The ids match recipe names in lib/audio.js.
const ALARM_SOUNDS = [
  { id: "alarmSunrise", label: "Sunrise — gentle ascending bells" },
  { id: "alarmPulse",   label: "Pulse — warm two-tone" },
  { id: "alarmClassic", label: "Classic — fast beeps" },
];

const CLOCK_ZONES = [
  {label:"New York",   tz:"America/New_York"},
  {label:"Los Angeles",tz:"America/Los_Angeles"},
  {label:"London",     tz:"Europe/London"},
  {label:"Paris",      tz:"Europe/Paris"},
  {label:"Tokyo",      tz:"Asia/Tokyo"},
  {label:"Sydney",     tz:"Australia/Sydney"},
  {label:"Dubai",      tz:"Asia/Dubai"},
  {label:"São Paulo",  tz:"America/Sao_Paulo"},
];

import { novaConfirm } from "../ui/dialogs.jsx";

export function ClockApp({AC, data, updateSettings}){
  // v6.4: last-used tab persists per-account so Clock opens to whichever pane
  // (World / Stopwatch / Timer) you were last using. selectTab() is the
  // setTab call site for the tab buttons — wraps setTab + the persist write.
  const [tab,setTab]=useState(()=>data?.settings?.clockTab||"world");
  function selectTab(t){ setTab(t); if(updateSettings) updateSettings({clockTab:t}); }
  const [tick,setTick]=useState(()=>new Date());
  // Stopwatch state
  const [swRunning,setSwRunning]=useState(false);
  const [swElapsed,setSwElapsed]=useState(0);      // total elapsed ms
  const [swStart,setSwStart]=useState(0);          // perf timestamp when last started
  const [swLaps,setSwLaps]=useState([]);
  // Timer state
  const [tMin,setTMin]=useState(5);
  const [tSec,setTSec]=useState(0);
  const [tRemaining,setTRemaining]=useState(0);    // ms until done
  const [tRunning,setTRunning]=useState(false);
  const tEndRef=useRef(0);

  // v9.4 — Alarms. Persisted under data.settings.alarms (via updateSettings,
  // already in scope). Shape: { id, time:"HH:MM", days:[bool x7],
  //                              label, sound, enabled }
  // The scheduler that actually FIRES alarms lives at the NovaOS level so
  // they ring even when the Clock app isn't open — see NovaOS.jsx.
  const alarms = data?.settings?.alarms || [];
  const [editAlarm, setEditAlarm] = useState(null);   // null | draft object
  function saveAlarmsList(next) { if (updateSettings) updateSettings({ alarms: next }); }
  function toggleAlarm(id) {
    saveAlarmsList(alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }
  async function deleteAlarm(id) {
    if (!(await novaConfirm({ title: "Delete alarm", message: "Delete this alarm?", danger: true, confirmText: "Delete", accent: AC }))) return;
    saveAlarmsList(alarms.filter(a => a.id !== id));
  }
  function newAlarmDraft() {
    const now = new Date();
    return {
      id: null,
      time: String(now.getHours()).padStart(2,"0") + ":00",
      days: [true,true,true,true,true,true,true],
      label: "Alarm",
      sound: "alarmSunrise",
      enabled: true,
    };
  }
  function commitAlarm(draft) {
    if (!draft.time || !/^\d{2}:\d{2}$/.test(draft.time)) return;
    if (draft.id) {
      saveAlarmsList(alarms.map(a => a.id === draft.id ? draft : a));
    } else {
      const id = "alarm-" + Date.now();
      saveAlarmsList([...alarms, { ...draft, id }]);
    }
    setEditAlarm(null);
  }
  // Friendly day-summary for the alarm list. Returns "Every day", "Weekdays",
  // "Weekends", or e.g. "Mon Wed Fri".
  function daysSummary(days) {
    if (!days || days.length !== 7) return "";
    const set = days.map((b, i) => b ? i : null).filter(x => x !== null);
    if (set.length === 7) return "Every day";
    if (set.length === 5 && set.every(i => i >= 1 && i <= 5)) return "Weekdays";
    if (set.length === 2 && set.includes(0) && set.includes(6)) return "Weekends";
    if (set.length === 0) return "Never";
    return set.map(i => DAY_NAMES[i].slice(0,3)).join(" ");
  }

  // Drives world clock + stopwatch display + timer countdown. 100ms is plenty
  // smooth and avoids draining the battery on phones.
  useEffect(()=>{
    const id=setInterval(()=>{
      setTick(new Date());
      if(swRunning) setSwElapsed(prev=>prev + (performance.now()-swStart));
      // ^ that update pattern would over-count if swStart isn't reset every tick.
      // We actually compute elapsed live from swStart in the render — keep that simple.
    },1000);
    return ()=>clearInterval(id);
  },[swRunning,swStart]);

  // Smoother stopwatch tick: 50ms refresh for hundredths
  useEffect(()=>{
    if(!swRunning)return;
    const id=setInterval(()=>setTick(new Date()),50);
    return ()=>clearInterval(id);
  },[swRunning]);

  // Timer countdown
  useEffect(()=>{
    if(!tRunning)return;
    const id=setInterval(()=>{
      const left=Math.max(0,tEndRef.current-performance.now());
      setTRemaining(left);
      if(left<=0){setTRunning(false);}
    },100);
    return ()=>clearInterval(id);
  },[tRunning]);

  function fmtTimeTZ(date,tz){
    try{return date.toLocaleTimeString([],{timeZone:tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});}
    catch{return "—";}
  }
  function fmtDateTZ(date,tz){
    try{return date.toLocaleDateString([],{timeZone:tz,weekday:"short",month:"short",day:"numeric"});}
    catch{return "";}
  }
  // Stopwatch: render the live elapsed, not the (lagging) stored swElapsed
  const liveElapsed = swRunning ? swElapsed + (performance.now() - swStart) : swElapsed;
  function fmtStopwatch(ms){
    const total=Math.floor(ms);
    const cs=Math.floor((total%1000)/10);
    const s=Math.floor(total/1000)%60;
    const m=Math.floor(total/60000)%60;
    const h=Math.floor(total/3600000);
    const pad=n=>String(n).padStart(2,"0");
    return (h>0?pad(h)+":":"")+pad(m)+":"+pad(s)+"."+pad(cs);
  }
  function startStopwatch(){
    if(swRunning){
      setSwElapsed(prev=>prev + (performance.now()-swStart));
      setSwRunning(false);
    } else {
      setSwStart(performance.now());
      setSwRunning(true);
    }
  }
  function lapStopwatch(){
    if(!swRunning)return;
    setSwLaps(l=>[liveElapsed,...l]);
  }
  function resetStopwatch(){
    setSwRunning(false);setSwElapsed(0);setSwLaps([]);
  }

  function startTimer(){
    const ms=Math.max(0,(tMin*60+tSec)*1000);
    if(ms<=0)return;
    tEndRef.current=performance.now()+ms;
    setTRemaining(ms);
    setTRunning(true);
  }
  function stopTimer(){setTRunning(false);}
  function resetTimer(){setTRunning(false);setTRemaining(0);}
  function fmtTimer(ms){
    const total=Math.max(0,Math.ceil(ms/1000));
    const s=total%60;const m=Math.floor(total/60)%60;const h=Math.floor(total/3600);
    const pad=n=>String(n).padStart(2,"0");
    return (h>0?pad(h)+":":"")+pad(m)+":"+pad(s);
  }

  const tabBtn=(id,label)=>(
    <button onClick={()=>selectTab(id)} style={{flex:1,padding:"10px 8px",background:"none",border:"none",borderBottom:tab===id?"2px solid "+AC:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:tab===id?AC:"rgba(255,255,255,0.4)"}}>{label}</button>
  );
  const ctrlBtn=(label,onClick,active=false,danger=false)=>(
    <button onClick={onClick} style={{
      flex:1,padding:"12px 0",borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,touchAction:"manipulation",
      background:danger?"rgba(255,80,80,0.1)":active?fill(AC):"rgba(255,255,255,0.07)",
      border:"1px solid "+(danger?"rgba(255,80,80,0.4)":active?bdr(AC):"rgba(255,255,255,0.12)"),
      color:danger?"#ff8b8b":active?AC:"rgba(255,255,255,0.8)",
    }}>{label}</button>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:FF,minHeight:0}}>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:14,flexShrink:0}}>
        {tabBtn("world","🌍 World")}{tabBtn("stop","⏱ Stopwatch")}{tabBtn("timer","⏲ Timer")}{tabBtn("alarms","🔔 Alarms")}
      </div>
      {tab==="world"&&(
        <div style={{flex:1,overflowY:"auto",minHeight:0,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{padding:"14px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:10,marginBottom:6}}>
            <div style={{fontSize:11,fontFamily:FFB,fontWeight:600,color:AC,letterSpacing:1,marginBottom:5}}>LOCAL TIME</div>
            <div style={{fontFamily:FFM,fontWeight:500,fontSize:30,color:"#fff",letterSpacing:1.5}}>{tick.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}</div>
            <div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:2}}>{tick.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
          </div>
          {CLOCK_ZONES.map(z=>(
            <div key={z.tz} style={{padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.85)"}}>{z.label}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:FFM}}>{fmtDateTZ(tick,z.tz)}</div>
              </div>
              <div style={{fontFamily:FFM,fontWeight:500,fontSize:18,color:"#fff",letterSpacing:1}}>{fmtTimeTZ(tick,z.tz)}</div>
            </div>
          ))}
        </div>
      )}
      {tab==="stop"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          <div style={{textAlign:"center",padding:"30px 0 24px"}}>
            <div style={{fontFamily:FFM,fontWeight:400,fontSize:46,color:"#fff",letterSpacing:1.5}}>{fmtStopwatch(liveElapsed)}</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexShrink:0}}>
            {ctrlBtn(swRunning?"Pause":liveElapsed>0?"Resume":"Start",startStopwatch,true)}
            {ctrlBtn("Lap",lapStopwatch)}
            {ctrlBtn("Reset",resetStopwatch,false,true)}
          </div>
          <div style={{flex:1,overflowY:"auto",minHeight:0}}>
            {swLaps.length===0?<div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontStyle:"italic",fontSize:12,padding:"24px 0"}}>No laps yet</div>:swLaps.map((ms,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)",fontFamily:FFM,fontSize:13,color:"rgba(255,255,255,0.75)"}}>
                <span style={{color:"rgba(255,255,255,0.45)"}}>Lap {swLaps.length-i}</span><span>{fmtStopwatch(ms)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab==="timer"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,alignItems:"center",justifyContent:"flex-start",paddingTop:18}}>
          {!tRunning && tRemaining===0 ? (
            <>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
                <input type="number" min={0} max={99} value={tMin} onChange={e=>setTMin(Math.max(0,Math.min(99,+e.target.value||0)))} style={{...INP,width:80,textAlign:"center",fontFamily:FFM,fontSize:24}}/>
                <span style={{fontFamily:FFM,fontWeight:600,fontSize:22,color:"rgba(255,255,255,0.5)"}}>:</span>
                <input type="number" min={0} max={59} value={tSec} onChange={e=>setTSec(Math.max(0,Math.min(59,+e.target.value||0)))} style={{...INP,width:80,textAlign:"center",fontFamily:FFM,fontSize:24}}/>
              </div>
              <div style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:18}}>MIN  :  SEC</div>
            </>
          ):(
            <div style={{textAlign:"center",marginBottom:22}}>
              <div style={{fontFamily:FFM,fontWeight:400,fontSize:56,color:tRunning?"#fff":AC,letterSpacing:2}}>{fmtTimer(tRemaining)}</div>
              {!tRunning&&tRemaining===0&&<div style={{fontSize:14,fontFamily:FFB,fontWeight:700,color:AC,marginTop:8}}>Done ✓</div>}
            </div>
          )}
          <div style={{display:"flex",gap:8,width:"100%",maxWidth:300}}>
            {!tRunning ? ctrlBtn(tRemaining>0?"Resume":"Start",startTimer,true) : ctrlBtn("Stop",stopTimer,true,true)}
            {(tRemaining>0||tRunning)&&ctrlBtn("Reset",resetTimer)}
          </div>
        </div>
      )}
      {tab==="alarms" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          {editAlarm ? (
            <AlarmEditor
              ac={AC}
              draft={editAlarm}
              onChange={setEditAlarm}
              onSave={() => commitAlarm(editAlarm)}
              onCancel={() => setEditAlarm(null)}
            />
          ) : (
            <>
              <div style={{display:"flex",alignItems:"center",marginBottom:10,flexShrink:0}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:FFB,fontWeight:700,fontSize:14,color:"#fff"}}>Alarms</div>
                  <div style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",marginTop:2}}>
                    {alarms.length === 0 ? "No alarms yet" : alarms.length + " alarm" + (alarms.length === 1 ? "" : "s") + " · ring even when Clock isn't open"}
                  </div>
                </div>
                <button onClick={() => setEditAlarm(newAlarmDraft())} style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,background:fill(AC),border:"1px solid "+bdr(AC),color:AC}}>+ New alarm</button>
              </div>
              <div style={{flex:1,overflowY:"auto",minHeight:0}}>
                {alarms.length === 0 ? (
                  <div style={{textAlign:"center",color:"rgba(255,255,255,0.22)",fontSize:13,fontStyle:"italic",padding:"40px 0"}}>
                    No alarms<br />
                    <span style={{fontSize:11}}>Tap + to add one</span>
                  </div>
                ) : alarms.map(a => (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 12px",marginBottom:7,background:a.enabled?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",border:"1px solid "+(a.enabled?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)"),borderRadius:9,opacity:a.enabled?1:0.55}}>
                    <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={() => setEditAlarm({ ...a })}>
                      <div style={{fontFamily:FFM,fontWeight:500,fontSize:24,color:a.enabled?"#fff":"rgba(255,255,255,0.55)",letterSpacing:1,lineHeight:1.1}}>{a.time}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:3}}>
                        {a.label || "Alarm"} · {daysSummary(a.days)}
                      </div>
                    </div>
                    {/* Toggle */}
                    <button onClick={() => toggleAlarm(a.id)} title={a.enabled?"Turn off":"Turn on"} style={{width:42,height:24,borderRadius:14,background:a.enabled?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(a.enabled?bdr(AC):"rgba(255,255,255,0.12)"),cursor:"pointer",position:"relative",padding:0}}>
                      <div style={{position:"absolute",top:1,left:a.enabled?20:1,width:20,height:20,borderRadius:"50%",background:a.enabled?AC:"rgba(255,255,255,0.4)",transition:"left 0.18s"}}/>
                    </button>
                    <button className="dl" onClick={() => deleteAlarm(a.id)} title="Delete alarm" style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.4)",fontSize:14,padding:"4px 6px"}}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// v9.4 — Alarm editor (used for both create + edit). All fields are
// controlled by the parent's `draft` state through `onChange(nextDraft)`.
// Saves via `onSave()`; the parent decides what to persist.
function AlarmEditor({ ac, draft, onChange, onSave, onCancel }) {
  function set(patch) { onChange({ ...draft, ...patch }); }
  function toggleDay(i) {
    const days = [...draft.days];
    days[i] = !days[i];
    set({ days });
  }
  // Quick day-set presets so the user can pick "weekdays" / "weekends" in
  // one tap instead of toggling 5 chips.
  function setDays(arr) { set({ days: arr.slice() }); }
  const canSave = /^\d{2}:\d{2}$/.test(draft.time) && draft.days.some(Boolean);
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top bar — back + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onCancel} className="lt" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontFamily: FFB, fontWeight: 600, fontSize: 13, padding: "2px 6px" }}>← Back</button>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff" }}>{draft.id ? "Edit alarm" : "New alarm"}</div>
      </div>

      {/* Time */}
      <div>
        <div style={{ fontSize: 11, fontFamily: FFB, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Time</div>
        <input
          type="time"
          value={draft.time}
          onChange={e => set({ time: e.target.value })}
          style={{ ...INP, fontFamily: FFM, fontSize: 26, padding: "10px 14px", width: 200, letterSpacing: 1 }}
        />
      </div>

      {/* Days */}
      <div>
        <div style={{ fontSize: 11, fontFamily: FFB, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Repeat</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {DAY_LABELS.map((d, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              title={DAY_NAMES[i]}
              style={{
                width: 36, height: 36, borderRadius: "50%", cursor: "pointer",
                background: draft.days[i] ? fill(ac) : "rgba(255,255,255,0.06)",
                border: "1px solid " + (draft.days[i] ? bdr(ac) : "rgba(255,255,255,0.12)"),
                color: draft.days[i] ? ac : "rgba(255,255,255,0.5)",
                fontFamily: FFB, fontWeight: 700, fontSize: 12,
              }}
            >{d}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { label: "Every day", val: [true,true,true,true,true,true,true] },
            { label: "Weekdays", val: [false,true,true,true,true,true,false] },
            { label: "Weekends", val: [true,false,false,false,false,false,true] },
          ].map(p => (
            <button key={p.label} onClick={() => setDays(p.val)} style={{ padding: "4px 10px", borderRadius: 14, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 10.5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Label */}
      <div>
        <div style={{ fontSize: 11, fontFamily: FFB, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Label</div>
        <input value={draft.label} onChange={e => set({ label: e.target.value })} placeholder="Alarm" style={{ ...INP, width: "100%", maxWidth: 320 }} />
      </div>

      {/* Sound */}
      <div>
        <div style={{ fontSize: 11, fontFamily: FFB, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Sound</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ALARM_SOUNDS.map(s => {
            const active = draft.sound === s.id;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: active ? fill(ac) : "rgba(255,255,255,0.04)", border: "1px solid " + (active ? bdr(ac) : "rgba(255,255,255,0.08)"), borderRadius: 8, cursor: "pointer" }} onClick={() => set({ sound: s.id })}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid " + (active ? ac : "rgba(255,255,255,0.25)"), background: active ? ac : "transparent", flexShrink: 0 }} />
                <div style={{ flex: 1, fontFamily: FF, fontSize: 12, color: active ? ac : "rgba(255,255,255,0.8)" }}>{s.label}</div>
                <button onClick={e => { e.stopPropagation(); playSound(s.id); }} title="Preview" style={{ padding: "3px 9px", borderRadius: 14, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 10.5, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)" }}>▶ Preview</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onSave} disabled={!canSave} style={{ flex: 1, padding: "11px", borderRadius: 9, cursor: canSave ? "pointer" : "default", fontFamily: FFB, fontWeight: 700, fontSize: 13, background: fill(ac), border: "1px solid " + bdr(ac), color: ac, opacity: canSave ? 1 : 0.5 }}>{draft.id ? "Save changes" : "Create alarm"}</button>
        <button onClick={onCancel} style={{ padding: "11px 18px", borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>Cancel</button>
      </div>
    </div>
  );
}

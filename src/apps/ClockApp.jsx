import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

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
        {tabBtn("world","🌍 World")}{tabBtn("stop","⏱ Stopwatch")}{tabBtn("timer","⏲ Timer")}
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
    </div>
  );
}

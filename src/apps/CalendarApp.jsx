import { useState } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

export function CalendarApp({data,updateData,showToast,AC}){
  const events = data?.calendarEvents || {};   // { "YYYY-MM-DD": [{id,title,time?}, ...] }
  const today=new Date(); today.setHours(0,0,0,0);
  const [viewYear,setViewYear]=useState(today.getFullYear());
  const [viewMonth,setViewMonth]=useState(today.getMonth());  // 0-indexed
  const [selectedKey,setSelectedKey]=useState(()=>dateKey(today));
  const [newTitle,setNewTitle]=useState("");
  const [newTime,setNewTime]=useState("");

  function dateKey(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+dd;
  }
  function keyToParts(k){const [y,m,d]=k.split("-").map(Number);return {y,m:m-1,d};}

  // Grid: render 42 cells (6 weeks). Start from the Sunday on or before the 1st of the month.
  const first=new Date(viewYear,viewMonth,1);
  const startOffset=first.getDay();
  const gridStart=new Date(viewYear,viewMonth,1-startOffset);
  const cells=Array.from({length:42}).map((_,i)=>{
    const d=new Date(gridStart); d.setDate(gridStart.getDate()+i);
    return d;
  });

  function nav(delta){
    let m=viewMonth+delta, y=viewYear;
    if(m<0){m=11;y--;} else if(m>11){m=0;y++;}
    setViewMonth(m);setViewYear(y);
  }
  function goToday(){setViewMonth(today.getMonth());setViewYear(today.getFullYear());setSelectedKey(dateKey(today));}

  function addEvent(){
    const t=newTitle.trim();
    if(!t){showToast?.("Add a title first");return;}
    const ev={id:Date.now()+Math.random(),title:t,time:newTime||null};
    const next={...events, [selectedKey]:[...(events[selectedKey]||[]), ev]};
    updateData({calendarEvents:next});
    setNewTitle("");setNewTime("");
  }
  function deleteEvent(key,id){
    const list=(events[key]||[]).filter(e=>e.id!==id);
    const next={...events};
    if(list.length===0) delete next[key]; else next[key]=list;
    updateData({calendarEvents:next});
  }

  const monthName=new Date(viewYear,viewMonth,1).toLocaleDateString([],{month:"long",year:"numeric"});
  const todayKey=dateKey(today);
  const selectedEvents=events[selectedKey]||[];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",fontFamily:FF,minHeight:0}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <button onClick={()=>nav(-1)} style={{width:30,height:30,borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"rgba(255,255,255,0.75)",fontSize:14}}>←</button>
        <div style={{flex:1,textAlign:"center",fontFamily:FFB,fontWeight:700,fontSize:15,color:"#fff"}}>{monthName}</div>
        <button onClick={goToday} style={{padding:"5px 11px",borderRadius:7,background:fill(AC),border:"1px solid "+bdr(AC),cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:AC}}>Today</button>
        <button onClick={()=>nav(1)}  style={{width:30,height:30,borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"rgba(255,255,255,0.75)",fontSize:14}}>→</button>
      </div>

      {/* Weekday header */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,flexShrink:0}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gridAutoRows:"minmax(36px, 1fr)",gap:3,flexShrink:0}}>
        {cells.map((d,i)=>{
          const k=dateKey(d);
          const inMonth=d.getMonth()===viewMonth;
          const isToday=k===todayKey;
          const isSel=k===selectedKey;
          const has=events[k]&&events[k].length>0;
          return(
            <button key={i} onClick={()=>setSelectedKey(k)} style={{
              padding:6,borderRadius:7,cursor:"pointer",fontFamily:FF,fontSize:12,
              background:isSel?fill(AC):isToday?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",
              border:"1px solid "+(isSel?bdr(AC):isToday?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.05)"),
              color:isSel?AC:inMonth?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.25)",
              fontWeight:isToday||isSel?700:400,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",
            }}>
              <span>{d.getDate()}</span>
              {has && <div style={{position:"absolute",bottom:3,width:4,height:4,borderRadius:"50%",background:isSel?AC:"#4cef90"}}/>}
            </button>
          );
        })}
      </div>

      {/* Events for the selected date */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0,marginTop:4}}>
        <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.45)",letterSpacing:1,marginBottom:8,textTransform:"uppercase",flexShrink:0}}>
          {(() => { const p=keyToParts(selectedKey); return new Date(p.y,p.m,p.d).toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"}); })()}
        </div>
        <div style={{flex:1,overflowY:"auto",minHeight:0,marginBottom:8}}>
          {selectedEvents.length===0 ? (
            <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontStyle:"italic",padding:"6px 0"}}>No events. Add one below.</div>
          ) : selectedEvents.map(ev=>(
            <div key={ev.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",marginBottom:4,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7}}>
              {ev.time && <span style={{fontFamily:FFM,fontSize:10,color:AC,minWidth:42}}>{ev.time}</span>}
              <span style={{flex:1,fontSize:13,color:"rgba(255,255,255,0.88)"}}>{ev.title}</span>
              <button className="dl" onClick={()=>deleteEvent(selectedKey,ev.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:12}}>✕</button>
            </div>
          ))}
        </div>
        {/* New event form */}
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <input value={newTime} onChange={e=>setNewTime(e.target.value)} placeholder="HH:MM" style={{...INP,width:74,fontSize:12,fontFamily:FFM,textAlign:"center"}}/>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEvent()} placeholder="New event…" style={{...INP,flex:1,fontSize:12}}/>
          <button onClick={addEvent} style={{padding:"7px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>Add</button>
        </div>
      </div>
    </div>
  );
}

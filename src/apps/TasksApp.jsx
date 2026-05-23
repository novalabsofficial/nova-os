import { useState } from "react";
import { FF, FFB, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { AiAssist } from "../ui/AiAssist.jsx";

export function TasksApp({data,updateData,showToast,AC,openNovaAi}){
  const [input,setInput]=useState("");
  function add(){if(!input.trim())return;updateData(p=>({...p,tasks:[...(p.tasks||[]),{id:Date.now(),text:input.trim(),done:false}]}));setInput("");showToast("Task added ✓");}
  function toggle(id){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));}
  function del(id){updateData(p=>({...p,tasks:p.tasks.filter(t=>t.id!==id)}));}
  const tasks=data?.tasks||[];const pending=tasks.filter(t=>!t.done);const done=tasks.filter(t=>t.done);
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
        <div style={{...SEC,marginBottom:0,flex:1}}>Tasks</div>
        <AiAssist AC={AC} openNovaAi={openNovaAi} actions={[
          {icon:"🎯",label:"Prioritize my tasks",prompt:"Rank these tasks from most to least important for someone trying to make progress. For each, give a one-line reason. Output as a numbered list:"},
          {icon:"🧩",label:"Break down a complex task",prompt:"Look at this task list and find the one that's vaguest or biggest. Break it into 3-5 concrete sub-tasks I could add. Format as a bulleted list:"},
          {icon:"📅",label:"Suggest a day plan",prompt:"Based on these tasks, propose a realistic day plan (morning / afternoon / evening blocks) for working through them. Keep it brief:"},
        ]} getContext={()=>{
          if(tasks.length===0) return "(No tasks yet — say so and ask the user what they're working on.)";
          return "Pending:\n" + (pending.map((t,i)=>(i+1)+". "+t.text).join("\n") || "(none)")
               + (done.length ? "\n\nAlready done:\n" + done.map((t,i)=>"- "+t.text).join("\n") : "");
        }}/>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:16}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Add a task…" style={{...INP,flex:1}} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <button onClick={add} style={{width:40,background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:18,color:AC}}>+</button>
      </div>
      {tasks.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:12,textAlign:"center",padding:"22px 0",fontStyle:"italic"}}>All clear!</div>}
      {pending.map(t=><TRow key={t.id} t={t} onToggle={toggle} onDel={del} AC={AC}/>)}
      {done.length>0&&<><div style={{...SEC,marginTop:14}}>Done ({done.length})</div>{done.map(t=><TRow key={t.id} t={t} onToggle={toggle} onDel={del} AC={AC}/>)}</>}
    </div>
  );
}
function TRow({t,onToggle,onDel,AC}){return(<div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,opacity:t.done?0.4:1,transition:"opacity 0.2s"}}><div onClick={()=>onToggle(t.id)} style={{width:17,height:17,borderRadius:5,border:"1.5px solid "+(t.done?AC:"rgba(255,255,255,0.22)"),background:t.done?AC:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.14s"}}>{t.done&&<span style={{color:"#000",fontSize:9,fontWeight:900}}>✓</span>}</div><span style={{flex:1,fontFamily:FF,fontSize:13,color:"rgba(255,255,255,0.88)",textDecoration:t.done?"line-through":"none"}}>{t.text}</span><button className="dl" onClick={()=>onDel(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:0,transition:"color 0.12s"}}>✕</button></div>);}

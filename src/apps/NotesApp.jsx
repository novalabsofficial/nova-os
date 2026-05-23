import { useState } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { AiAssist } from "../ui/AiAssist.jsx";

export function NotesApp({data,updateData,showToast,AC,openNovaAi}){
  const [title,setTitle]=useState("");const [body,setBody]=useState("");
  function add(){if(!title.trim())return;updateData(p=>({...p,notes:[{id:Date.now(),title:title.trim(),body:body.trim(),ts:Date.now()},...(p.notes||[])]}));setTitle("");setBody("");showToast("Note saved ✓");}
  function del(id){updateData(p=>({...p,notes:p.notes.filter(n=>n.id!==id)}));}
  const notes=data?.notes||[];
  // AI actions operate on the current draft (title + body). Insert the AI
  // button row above the form so it's discoverable but doesn't crowd the input.
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
        <div style={{...SEC,marginBottom:0,flex:1}}>Notes</div>
        <AiAssist AC={AC} openNovaAi={openNovaAi} actions={[
          {icon:"✍",label:"Improve writing",prompt:"Improve the writing of the following text without changing its meaning. Output ONLY the rewritten text, no commentary:"},
          {icon:"📝",label:"Summarize in 2–3 sentences",prompt:"Summarize the following text in 2–3 concise sentences:"},
          {icon:"➕",label:"Continue writing",prompt:"Continue this text seamlessly from where it leaves off, matching the tone and style. Output only the continuation:"},
          {icon:"💡",label:"Suggest ideas",prompt:"Read the following text and suggest 3–5 specific ideas or directions the author could expand on:"},
        ]} getContext={()=>{
          const t=title.trim(); const b=body.trim();
          if(!t && !b) return "(The user has not written anything yet — say so and ask what they want to write about.)";
          return (t?"Title: "+t+"\n\n":"")+(b||"(empty body)");
        }}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title…" style={INP} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write something…" style={{...INP,minHeight:80}}/>
        <button onClick={add} style={{padding:"9px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>+ Add Note</button>
      </div>
      {notes.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:12,textAlign:"center",padding:"22px 0",fontStyle:"italic"}}>No notes yet</div>}
      {notes.map(n=>(
        <div key={n.id} style={{padding:"11px 13px",marginBottom:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,position:"relative"}}>
          <div style={{fontWeight:600,fontSize:14,color:"rgba(255,255,255,0.92)",paddingRight:26,marginBottom:n.body?3:0}}>{n.title}</div>
          {n.body&&<div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body}</div>}
          <div style={{fontFamily:FFM,fontSize:9,color:"rgba(255,255,255,0.18)",marginTop:5}}>{new Date(n.ts).toLocaleDateString()}</div>
          <button className="dl" onClick={()=>del(n.id)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,transition:"color 0.12s"}}>✕</button>
        </div>
      ))}
    </div>
  );
}

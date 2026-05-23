import { useState } from "react";
import { FF, FFB, FFM, INP, SEC, DEFAULT_AC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

export function FilesApp({data,updateData,showToast,AC}){
  const [curId,setCurId]=useState(null); // null = root
  const [preview,setPreview]=useState(null);
  const [newFolderName,setNewFolderName]=useState("");
  const [showNewFolder,setShowNewFolder]=useState(false);
  const [showNewNote,setShowNewNote]=useState(false);
  const [newNoteTitle,setNewNoteTitle]=useState("");
  const [newNoteBody,setNewNoteBody]=useState("");
  const [movingItem,setMovingItem]=useState(null); // {type,id,name}
  const [editingFolder,setEditingFolder]=useState(null); // {id,name}
 
  const ac=AC||DEFAULT_AC;
  const folders=data?.folders||[];
  const notes=data?.notes||[];
  const tasks=data?.tasks||[];
 
  // Build breadcrumb path
  function buildPath(id){
    if(!id)return [];
    const path=[];let cur=id;
    while(cur){const f=folders.find(x=>x.id===cur);if(!f)break;path.unshift(f);cur=f.parentId;}
    return path;
  }
  const breadcrumb=buildPath(curId);
  const subFolders=folders.filter(f=>f.parentId===curId);
  const curNotes=notes.filter(n=>(n.folderId||null)===curId);
  const curTasks=tasks.filter(t=>(t.folderId||null)===curId);
 
  function createFolder(){
    if(!newFolderName.trim())return;
    const f={id:"f"+Date.now(),name:newFolderName.trim(),parentId:curId,created:Date.now()};
    updateData(p=>({...p,folders:[...(p.folders||[]),f]}));
    setNewFolderName("");setShowNewFolder(false);showToast("Folder created ✓");
  }
  function deleteFolder(fid){
    function desc(id){const ch=folders.filter(f=>f.parentId===id);return[id,...ch.flatMap(c=>desc(c.id))];}
    const dead=new Set(desc(fid));
    if(!window.confirm("Delete this folder and move its contents to root?"))return;
    updateData(p=>({...p,
      folders:p.folders.filter(f=>!dead.has(f.id)),
      notes:p.notes.map(n=>dead.has(n.folderId)?{...n,folderId:null}:n),
      tasks:p.tasks.map(t=>dead.has(t.folderId)?{...t,folderId:null}:t),
    }));
    showToast("Folder deleted");
  }
  function renameFolder(id,name){
    if(!name.trim())return;
    updateData(p=>({...p,folders:p.folders.map(f=>f.id===id?{...f,name:name.trim()}:f)}));
    setEditingFolder(null);showToast("Renamed ✓");
  }
  function createNote(){
    if(!newNoteTitle.trim())return;
    updateData(p=>({...p,notes:[{id:Date.now(),title:newNoteTitle.trim(),body:newNoteBody.trim(),ts:Date.now(),folderId:curId},...(p.notes||[])]}));
    setNewNoteTitle("");setNewNoteBody("");setShowNewNote(false);showToast("Note created ✓");
  }
  function deleteNote(id){updateData(p=>({...p,notes:p.notes.filter(n=>n.id!==id)}));if(preview?.id===id)setPreview(null);showToast("Deleted");}
  function deleteTask(id){updateData(p=>({...p,tasks:p.tasks.filter(t=>t.id!==id)}));showToast("Deleted");}
  function toggleTask(id){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));}
  function moveNote(noteId,fid){updateData(p=>({...p,notes:p.notes.map(n=>n.id===noteId?{...n,folderId:fid}:n)}));setMovingItem(null);showToast("Moved ✓");}
  function moveTask(taskId,fid){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===taskId?{...t,folderId:fid}:t)}));setMovingItem(null);showToast("Moved ✓");}
 
  // All folder options for move dropdown
  const folderOpts=[{id:null,label:"🏠 Home (root)"}];
  function addOpt(fid,depth){
    const f=folders.find(x=>x.id===fid);if(!f)return;
    folderOpts.push({id:fid,label:"\u00a0".repeat(depth*3)+"📁 "+f.name});
    folders.filter(x=>x.parentId===fid).forEach(c=>addOpt(c.id,depth+1));
  }
  folders.filter(f=>!f.parentId).forEach(f=>addOpt(f.id,1));
 
  const itemCount=(fid)=>folders.filter(x=>x.parentId===fid).length+notes.filter(n=>n.folderId===fid).length+tasks.filter(t=>t.folderId===fid).length;
  const btStyle=(active)=>({padding:"5px 11px",background:active?fill(ac):"rgba(255,255,255,0.06)",border:"1px solid "+(active?bdr(ac):"rgba(255,255,255,0.11)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:active?ac:"rgba(255,255,255,0.6)"});
 
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      {/* Breadcrumb + action buttons */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:4,flex:1,flexWrap:"wrap",fontFamily:FFB,fontWeight:600,fontSize:12}}>
          <span style={{cursor:"pointer",color:curId?ac:"rgba(255,255,255,0.6)"}} onClick={()=>setCurId(null)}>🏠 Home</span>
          {breadcrumb.map((f,i)=>(
            <span key={f.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{color:"rgba(255,255,255,0.2)"}}>{">"}</span>
              <span style={{cursor:"pointer",color:i===breadcrumb.length-1?"rgba(255,255,255,0.7)":ac}} onClick={()=>setCurId(f.id)}>{f.name}</span>
            </span>
          ))}
        </div>
        <button onClick={()=>{setShowNewFolder(v=>!v);setShowNewNote(false);}} style={btStyle(showNewFolder)}>📁 New Folder</button>
        <button onClick={()=>{setShowNewNote(v=>!v);setShowNewFolder(false);}} style={btStyle(showNewNote)}>📄 New Note</button>
      </div>
 
      {/* New folder input */}
      {showNewFolder&&(
        <div style={{display:"flex",gap:7,marginBottom:10}}>
          <input autoFocus value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createFolder()} placeholder="Folder name…" style={{...INP,flex:1}}/>
          <button onClick={createFolder} style={{padding:"7px 14px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:ac}}>Create</button>
          <button onClick={()=>setShowNewFolder(false)} style={{padding:"7px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:7,cursor:"pointer",color:"rgba(255,255,255,0.5)",fontFamily:FFB,fontSize:12}}>✕</button>
        </div>
      )}
 
      {/* New note input */}
      {showNewNote&&(
        <div style={{padding:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,marginBottom:10,display:"flex",flexDirection:"column",gap:7}}>
          <input autoFocus value={newNoteTitle} onChange={e=>setNewNoteTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createNote()} placeholder="Note title…" style={INP}/>
          <textarea value={newNoteBody} onChange={e=>setNewNoteBody(e.target.value)} placeholder="Content… (optional)" style={{...INP,minHeight:55}}/>
          <div style={{display:"flex",gap:7}}>
            <button onClick={createNote} style={{flex:1,padding:"7px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:ac}}>Create Note</button>
            <button onClick={()=>setShowNewNote(false)} style={{padding:"7px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:7,cursor:"pointer",color:"rgba(255,255,255,0.5)",fontFamily:FFB,fontSize:12}}>Cancel</button>
          </div>
        </div>
      )}
 
      {/* Move dialog */}
      {movingItem&&(
        <div style={{padding:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,marginBottom:10}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:7}}>Move "<b>{movingItem.name}</b>" to:</div>
          <select onChange={e=>{const tid=e.target.value==="null"?null:e.target.value;movingItem.type==="note"?moveNote(movingItem.id,tid):moveTask(movingItem.id,tid);}} style={{...INP,cursor:"pointer",marginBottom:8}} defaultValue={movingItem.folderId||"null"}>
            {folderOpts.map(o=><option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
          </select>
          <button onClick={()=>setMovingItem(null)} style={{padding:"5px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontSize:11,color:"rgba(255,255,255,0.5)"}}>Cancel</button>
        </div>
      )}
 
      {/* Empty state */}
      {subFolders.length===0&&curNotes.length===0&&curTasks.length===0&&!showNewFolder&&!showNewNote&&(
        <div style={{textAlign:"center",color:"rgba(255,255,255,0.18)",fontSize:13,fontStyle:"italic",padding:"32px 0"}}>
          {curId?"This folder is empty":"No files yet"}<br/>
          <span style={{fontSize:11}}>Use the buttons above to create folders or notes</span>
        </div>
      )}
 
      {/* Subfolders */}
      {subFolders.length>0&&<div style={SEC}>Folders ({subFolders.length})</div>}
      {subFolders.map(f=>(
        <div key={f.id} className="fr" style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:4,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer",transition:"background 0.12s"}}>
          <span style={{fontSize:20,pointerEvents:"none"}}>📁</span>
          {editingFolder?.id===f.id?(
            <input autoFocus value={editingFolder.name} onChange={e=>setEditingFolder(x=>({...x,name:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")renameFolder(f.id,editingFolder.name);if(e.key==="Escape")setEditingFolder(null);}} onBlur={()=>renameFolder(f.id,editingFolder.name)} style={{...INP,flex:1,padding:"3px 8px",fontSize:13}}/>
          ):(
            <div style={{flex:1}} onClick={()=>setCurId(f.id)} onDoubleClick={()=>setCurId(f.id)}>
              <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)"}}>{f.name}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginTop:1}}>{itemCount(f.id)} items</div>
            </div>
          )}
          <button onClick={e=>{e.stopPropagation();setEditingFolder({id:f.id,name:f.name});}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.28)",fontSize:12,padding:"3px 6px"}} title="Rename">✏️</button>
          <button className="dl" onClick={e=>{e.stopPropagation();deleteFolder(f.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,padding:"3px 6px",transition:"color 0.12s"}} title="Delete">✕</button>
        </div>
      ))}
 
      {/* Notes */}
      {curNotes.length>0&&<div style={{...SEC,marginTop:subFolders.length>0?12:0}}>Notes ({curNotes.length})</div>}
      {curNotes.map(n=>(
        <div key={n.id}>
          <div className="fr" onClick={()=>setPreview(preview?.id===n.id?null:n)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:3,background:preview?.id===n.id?"rgba(79,158,255,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(preview?.id===n.id?"rgba(79,158,255,0.35)":"rgba(255,255,255,0.07)"),borderRadius:7,cursor:"pointer",transition:"background 0.12s"}}>
            <span style={{fontSize:14}}>📄</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.28)",fontFamily:FFM}}>{new Date(n.ts).toLocaleDateString()}{n.body?" · "+n.body.slice(0,28)+"…":""}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();setMovingItem({type:"note",id:n.id,name:n.title,folderId:n.folderId||null});}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,padding:"3px 5px"}} title="Move to folder">↪</button>
            <button className="dl" onClick={e=>{e.stopPropagation();deleteNote(n.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:"3px 5px",transition:"color 0.12s"}}>✕</button>
          </div>
          {preview?.id===n.id&&(
            <div style={{marginBottom:6,padding:"11px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7}}>
              <div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:5}}>{n.title}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.65,whiteSpace:"pre-wrap"}}>{n.body||"(no content)"}</div>
            </div>
          )}
        </div>
      ))}
 
      {/* Tasks */}
      {curTasks.length>0&&<div style={{...SEC,marginTop:curNotes.length>0||subFolders.length>0?12:0}}>Tasks ({curTasks.length})</div>}
      {curTasks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,opacity:t.done?0.45:1}}>
          <div onClick={()=>toggleTask(t.id)} style={{width:17,height:17,borderRadius:5,border:"1.5px solid "+(t.done?ac:"rgba(255,255,255,0.22)"),background:t.done?ac:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {t.done&&<span style={{color:"#000",fontSize:9,fontWeight:900}}>✓</span>}
          </div>
          <span style={{flex:1,fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.88)",textDecoration:t.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
          <button onClick={()=>setMovingItem({type:"task",id:t.id,name:t.text,folderId:t.folderId||null})} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,padding:"3px 5px"}} title="Move">↪</button>
          <button className="dl" onClick={()=>deleteTask(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:"3px 5px",transition:"color 0.12s"}}>✕</button>
        </div>
      ))}
    </div>
  );
}

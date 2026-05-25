import { useState, useEffect, useRef } from "react";
import { FF, FFB } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { PAINT_COLORS } from "../ui/constants.js";

export function PaintApp({showToast,AC}){
  const CW=1000,CH=600;const canvasRef=useRef(null);const lastPos=useRef(null);
  const [color,setColor]=useState("#000000");const [size,setSize]=useState(6);const [tool,setTool]=useState("pen");const [drawing,setDrawing]=useState(false);
  // v7.5: undo stack. Each entry is an ImageData snapshot captured just BEFORE
  // a stroke (so popping the top entry restores the canvas to its pre-stroke
  // state). Capped to UNDO_LIMIT so a long session doesn't eat memory — each
  // snapshot is CW*CH*4 bytes (~2.4 MB at 1000x600), so 30 = ~72 MB worst case.
  const UNDO_LIMIT=30;
  const undoStack=useRef([]);
  const [undoCount,setUndoCount]=useState(0); // mirror length into state so the button can disable
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,CW,CH);},[]);
  function pushSnapshot(){
    const ctx=canvasRef.current.getContext("2d");
    const snap=ctx.getImageData(0,0,CW,CH);
    undoStack.current.push(snap);
    if(undoStack.current.length>UNDO_LIMIT)undoStack.current.shift();
    setUndoCount(undoStack.current.length);
  }
  function doUndo(){
    if(undoStack.current.length===0)return;
    const snap=undoStack.current.pop();
    const ctx=canvasRef.current.getContext("2d");
    ctx.putImageData(snap,0,0);
    setUndoCount(undoStack.current.length);
  }
  function gp(e){const c=canvasRef.current;const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*(CW/r.width),y:(e.clientY-r.top)*(CH/r.height)};}
  function down(e){e.stopPropagation();pushSnapshot();setDrawing(true);const pos=gp(e);lastPos.current=pos;const ctx=canvasRef.current.getContext("2d");ctx.beginPath();ctx.arc(pos.x,pos.y,size/2,0,Math.PI*2);ctx.fillStyle=tool==="eraser"?"#fff":color;ctx.fill();}
  function move(e){if(!drawing||!lastPos.current)return;e.stopPropagation();const pos=gp(e);const ctx=canvasRef.current.getContext("2d");ctx.beginPath();ctx.moveTo(lastPos.current.x,lastPos.current.y);ctx.lineTo(pos.x,pos.y);ctx.strokeStyle=tool==="eraser"?"#fff":color;ctx.lineWidth=size;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();lastPos.current=pos;}
  function up(e){e.stopPropagation();setDrawing(false);lastPos.current=null;}
  // Ctrl/Cmd+Z while the Paint window is active also undoes.
  useEffect(()=>{
    function onKey(e){
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&(e.key==="z"||e.key==="Z")){
        e.preventDefault();doUndo();
      }
    }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]);
  function clearCanvas(){pushSnapshot();const ctx=canvasRef.current.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,CW,CH);}
  function TBtn({id,lbl}){return<button onClick={()=>setTool(id)} style={{padding:"6px 11px",background:tool===id?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(tool===id?bdr(AC):"rgba(255,255,255,0.11)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:tool===id?AC:"rgba(255,255,255,0.6)"}}>{lbl}</button>;}
  const canUndo=undoCount>0;
  return(<div style={{width:"100%",display:"flex",flexDirection:"column",gap:10,fontFamily:FF}}><div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}><TBtn id="pen" lbl="✏️ Pen"/><TBtn id="eraser" lbl="⬜ Eraser"/><button onClick={doUndo} disabled={!canUndo} title="Undo last stroke (Ctrl+Z)" style={{padding:"6px 11px",background:canUndo?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.03)",border:"1px solid "+(canUndo?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.06)"),borderRadius:6,cursor:canUndo?"pointer":"default",fontFamily:FFB,fontWeight:600,fontSize:11,color:canUndo?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.25)"}}>↶ Undo</button><div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}><span style={{fontSize:10,fontFamily:FFB,fontWeight:600,letterSpacing:1,color:"rgba(255,255,255,0.3)"}}>SIZE</span><input type="range" min={2} max={60} value={size} onChange={e=>setSize(+e.target.value)} style={{width:80,accentColor:AC}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.5)",width:20}}>{size}</span></div><div style={{flex:1}}/><button onClick={clearCanvas} style={{padding:"6px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.55)"}}>Clear</button><button onClick={()=>{const a=document.createElement("a");a.download="nova-paint.png";a.href=canvasRef.current.toDataURL();a.click();showToast("Saved ✓");}} style={{padding:"6px 11px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:AC}}>⬇ Save</button></div><canvas ref={canvasRef} width={CW} height={CH} style={{width:"100%",height:"auto",borderRadius:7,cursor:tool==="eraser"?"cell":"crosshair",display:"block",border:"1px solid rgba(255,255,255,0.1)",touchAction:"none"}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}/><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>{PAINT_COLORS.map(c=><div key={c} className="ps" onClick={()=>{setColor(c);setTool("pen");}} style={{width:22,height:22,borderRadius:5,background:c,cursor:"pointer",border:(color===c&&tool==="pen")?"2.5px solid #fff":"2px solid rgba(255,255,255,0.14)",transition:"transform 0.1s",boxSizing:"border-box"}}/>)}<input type="color" value={color} onChange={e=>{setColor(e.target.value);setTool("pen");}} style={{width:26,height:26,borderRadius:5,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",background:"none",marginLeft:4}}/></div></div>);
}

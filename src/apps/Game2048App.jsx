import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";

export function Game2048App({AC}){
  const TC={0:"rgba(255,255,255,0.05)",2:"#eee4da",4:"#ede0c8",8:"#f2b179",16:"#f59563",32:"#f67c5f",64:"#f65e3b",128:"#edcf72",256:"#edcc61",512:"#edc850",1024:"#edc53f",2048:"#edc22e"};
  const TT={0:"rgba(255,255,255,0.1)",2:"#776e65",4:"#776e65",8:"#f9f6f2",16:"#f9f6f2",32:"#f9f6f2",64:"#f9f6f2",128:"#f9f6f2",256:"#f9f6f2",512:"#f9f6f2",1024:"#f9f6f2",2048:"#f9f6f2"};
  function newGrid(){const g=Array.from({length:4},()=>Array(4).fill(0));addTile(g);addTile(g);return g;}
  function addTile(g){const e=[];g.forEach((r,ri)=>r.forEach((v,ci)=>{if(!v)e.push([ri,ci]);}));if(!e.length)return;const[r,c]=e[Math.floor(Math.random()*e.length)];g[r][c]=Math.random()<0.9?2:4;}
  function slide(row){const nz=row.filter(x=>x);const out=[];let gained=0,i=0;while(i<nz.length){if(i+1<nz.length&&nz[i]===nz[i+1]){out.push(nz[i]*2);gained+=nz[i]*2;i+=2;}else{out.push(nz[i]);i++;}}while(out.length<4)out.push(0);return{row:out,gained};}
  function tr(g){return g[0].map((_,c)=>g.map(r=>r[c]));}
  function moveGrid(g,dir){let ng=g.map(r=>[...r]),gained=0;const rv=r=>[...r].reverse();if(dir==="left")ng=ng.map(r=>{const{row,gained:g2}=slide(r);gained+=g2;return row;});if(dir==="right")ng=ng.map(r=>{const{row,gained:g2}=slide(rv(r));gained+=g2;return rv(row);});if(dir==="up"){ng=tr(ng);ng=ng.map(r=>{const{row,gained:g2}=slide(r);gained+=g2;return row;});ng=tr(ng);}if(dir==="down"){ng=tr(ng);ng=ng.map(r=>{const{row,gained:g2}=slide(rv(r));gained+=g2;return rv(row);});ng=tr(ng);}return{grid:ng,gained};}
  function changed(a,b){return a.some((r,ri)=>r.some((v,ci)=>v!==b[ri][ci]));}
  function hasMove(g){if(g.some(r=>r.some(v=>!v)))return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){if(c<3&&g[r][c]===g[r][c+1])return true;if(r<3&&g[r][c]===g[r+1][c])return true;}return false;}
  const [grid,setGrid]=useState(()=>newGrid());const [score,setScore]=useState(0);const [best,setBest]=useState(0);const [over,setOver]=useState(false);const [won,setWon]=useState(false);
  function move(dir){setGrid(g=>{const{grid:ng,gained}=moveGrid(g,dir);if(!changed(g,ng))return g;const ng2=ng.map(r=>[...r]);addTile(ng2);setScore(s=>{const ns=s+gained;setBest(b=>Math.max(b,ns));return ns;});if(ng2.some(r=>r.some(v=>v===2048)))setWon(true);if(!hasMove(ng2))setOver(true);return ng2;});}
  useEffect(()=>{const MAP={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down",A:"left",D:"right",W:"up",S:"down"};function onKey(e){if(MAP[e.key]){e.preventDefault();if(!over)move(MAP[e.key]);}}window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[over]);
  function restart(){setGrid(newGrid());setScore(0);setOver(false);setWon(false);}
  // Mobile: swipe the board to move (the game was keyboard-only before).
  function onSwipeDown(e){const sx=e.clientX,sy=e.clientY;const up=(ev)=>{window.removeEventListener("pointerup",up);if(over)return;const dx=ev.clientX-sx,dy=ev.clientY-sy,ax=Math.abs(dx),ay=Math.abs(dy);if(Math.max(ax,ay)<24)return;move(ax>ay?(dx>0?"right":"left"):(dy>0?"down":"up"));};window.addEventListener("pointerup",up);}
  return(<div style={{width:"100%",fontFamily:FF,display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:AC}}>2048</div><div style={{flex:1}}/>{[["SCORE",score],["BEST",best]].map(([l,v])=>(<div key={l} style={{padding:"5px 12px",background:"rgba(255,255,255,0.08)",borderRadius:6,textAlign:"center"}}><div style={{fontFamily:FFM,fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>{l}</div><div style={{fontFamily:FFB,fontWeight:700,fontSize:15,color:"#fff"}}>{v}</div></div>))}<button onClick={restart} style={{padding:"6px 13px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>New</button></div><div onPointerDown={onSwipeDown} style={{position:"relative",touchAction:"none"}}><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1.5%",background:"rgba(255,255,255,0.08)",padding:"1.5%",borderRadius:10}}>{grid.flat().map((v,i)=>(<div key={i} style={{aspectRatio:"1",borderRadius:"8%",background:TC[v]||"#3c3a32",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FFB,fontWeight:700,fontSize:"clamp(14px,4vw,28px)",color:TT[v]||"#f9f6f2",transition:"background 0.1s"}}>{v>0?v:""}</div>))}</div>{(over||won)&&(<div style={{position:"absolute",inset:0,background:"rgba(7,8,15,0.78)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}><div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:won?"#edcf72":"#ff7878"}}>{won?"You Win! 🎉":"Game Over"}</div><button onClick={restart} style={{padding:"10px 28px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:14,color:AC}}>Try Again</button></div>)}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.28)",fontFamily:FF,textAlign:"center"}}>Swipe or arrow keys / WASD · Combine to reach 2048</div></div>);
}
 
// Stars and AppCard are at module scope (not nested inside StoreApp) so React
// keeps the same component identity across renders. When they were nested, the
// parent's clock-tick re-render every second created fresh function refs, which
// React treated as different component types and remounted the whole card —
// remounting the <img> inside StoreIcon, which flickered.

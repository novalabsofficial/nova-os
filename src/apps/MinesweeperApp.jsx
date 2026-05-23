import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { createBoard as mineCreateBoard, floodReveal, isWin as mineIsWin, mineTotal, MINE_DIFFICULTIES } from "../lib/minesweeper.js";

const MINE_NUM_COLOR = ["", "#4f9eff", "#4cef90", "#ff6b6b", "#cc44ff", "#ff8c44", "#44ddcc", "#fff", "#888"];

export function MinesweeperApp({AC}){
  const [diff,setDiff]=useState("easy");
  const cfg=MINE_DIFFICULTIES[diff];
  const [board,setBoard]=useState(null);             // null until first click
  const [revealed,setRevealed]=useState(()=>new Set());
  const [flagged,setFlagged]=useState(()=>new Set());
  const [status,setStatus]=useState("idle");          // idle | playing | won | lost
  const [startedAt,setStartedAt]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const pressTimer=useRef(null);
  const pressIsLong=useRef(false);

  // Timer tick during play
  useEffect(()=>{
    if(status!=="playing")return;
    const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startedAt)/1000)),250);
    return ()=>clearInterval(id);
  },[status,startedAt]);

  function newGame(d=diff){
    setDiff(d);
    setBoard(null);
    setRevealed(new Set());
    setFlagged(new Set());
    setStatus("idle");
    setElapsed(0);
  }

  function reveal(r,c){
    if(status==="won"||status==="lost")return;
    const key=r+","+c;
    if(flagged.has(key))return;
    let b=board;
    if(!b){
      // First click — generate the board, guaranteed safe at (r,c)
      b=mineCreateBoard(cfg.rows,cfg.cols,cfg.mines,r,c);
      setBoard(b);
      setStartedAt(Date.now());
      setStatus("playing");
    }
    if(revealed.has(key))return;
    if(b[r][c].isMine){
      setRevealed(new Set([...revealed,key]));
      setStatus("lost");
      return;
    }
    const flood=floodReveal(b,r,c);
    const next=new Set(revealed);
    flood.forEach(k=>next.add(k));
    setRevealed(next);
    if(mineIsWin(b,next))setStatus("won");
  }

  function toggleFlag(r,c){
    if(status==="won"||status==="lost")return;
    const key=r+","+c;
    if(revealed.has(key))return;
    const next=new Set(flagged);
    if(next.has(key))next.delete(key); else next.add(key);
    setFlagged(next);
  }

  // Long-press detection for touch users — short press reveals, long press flags.
  function onCellPointerDown(r,c){
    pressIsLong.current=false;
    pressTimer.current=setTimeout(()=>{
      pressIsLong.current=true;
      toggleFlag(r,c);
    },350);
  }
  function onCellPointerUp(r,c){
    clearTimeout(pressTimer.current);
    if(!pressIsLong.current) reveal(r,c);
  }
  function onCellPointerCancel(){
    clearTimeout(pressTimer.current);
    pressIsLong.current=false;
  }
  function onCellContextMenu(e,r,c){
    e.preventDefault();
    toggleFlag(r,c);
  }

  const minesLeft=cfg.mines-flagged.size;
  const cellSize=Math.max(22,Math.min(34,Math.floor(280/cfg.cols)));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,fontFamily:FF,height:"100%",minHeight:0}}>
      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
        {Object.keys(MINE_DIFFICULTIES).map(d=>(
          <button key={d} onClick={()=>newGame(d)} style={{padding:"5px 11px",borderRadius:18,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,background:diff===d?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(diff===d?bdr(AC):"rgba(255,255,255,0.1)"),color:diff===d?AC:"rgba(255,255,255,0.55)",textTransform:"capitalize"}}>{d}</button>
        ))}
        <div style={{flex:1}}/>
        <div style={{fontFamily:FFM,fontSize:13,color:"rgba(255,255,255,0.7)"}}>💣 {minesLeft}</div>
        <div style={{fontFamily:FFM,fontSize:13,color:"rgba(255,255,255,0.5)"}}>⏱ {elapsed}s</div>
        <button onClick={()=>newGame(diff)} style={{padding:"5px 11px",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.75)"}}>↻ New</button>
      </div>

      {status==="won" && <div style={{padding:"8px 12px",background:"rgba(76,239,144,0.1)",border:"1px solid rgba(76,239,144,0.35)",borderRadius:7,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#4cef90",textAlign:"center"}}>🎉 You won in {elapsed}s!</div>}
      {status==="lost" && <div style={{padding:"8px 12px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:7,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#ff7878",textAlign:"center"}}>💥 You hit a mine — try again</div>}

      <div style={{flex:1,overflow:"auto",minHeight:0,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:4}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat("+cfg.cols+",1fr)",gap:2,touchAction:"none"}}>
          {Array.from({length:cfg.rows}).map((_,r)=>Array.from({length:cfg.cols}).map((__,c)=>{
            const key=r+","+c;
            const isRev=revealed.has(key);
            const isFlag=flagged.has(key);
            const cell=board?board[r][c]:null;
            const showMine=isRev&&cell&&cell.isMine;
            const num=isRev&&cell&&!cell.isMine?cell.neighbors:0;
            return(
              <div key={key}
                onPointerDown={()=>onCellPointerDown(r,c)}
                onPointerUp={()=>onCellPointerUp(r,c)}
                onPointerCancel={onCellPointerCancel}
                onPointerLeave={onCellPointerCancel}
                onContextMenu={e=>onCellContextMenu(e,r,c)}
                style={{
                  width:cellSize,height:cellSize,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:FFB,fontWeight:700,fontSize:Math.floor(cellSize*0.55),
                  borderRadius:3,cursor:"pointer",userSelect:"none",
                  touchAction:"none",
                  background: isRev ? (showMine ? "rgba(255,80,80,0.25)" : "rgba(255,255,255,0.04)") : "rgba(255,255,255,0.1)",
                  border:"1px solid "+(isRev ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)"),
                  color: showMine ? "#ff7878" : num>0 ? MINE_NUM_COLOR[num] : "transparent",
                }}>
                {showMine ? "💣" : isFlag ? "🚩" : num>0 ? num : ""}
              </div>
            );
          }))}
        </div>
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center",fontStyle:"italic"}}>Tap to reveal · Long-press (or right-click) to flag</div>
    </div>
  );
}

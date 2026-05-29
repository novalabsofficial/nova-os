import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { createBoard as mineCreateBoard, floodReveal, isWin as mineIsWin, mineTotal, MINE_DIFFICULTIES } from "../lib/minesweeper.js";
import { submitScore, fetchLeaderboard } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";

const MINE_NUM_COLOR = ["", "#4f9eff", "#4cef90", "#ff6b6b", "#cc44ff", "#ff8c44", "#44ddcc", "#fff", "#888"];

export function MinesweeperApp({AC, user}){
  const myUid = getDbUid();
  const [diff,setDiff]=useState("easy");
  // v9.8 — global best-time leaderboard (lower = better) per difficulty.
  const [showLeaderboard,setShowLeaderboard]=useState(false);
  const [leaders,setLeaders]=useState([]);
  const [loadingLb,setLoadingLb]=useState(false);
  const [newBest,setNewBest]=useState(false);
  function loadLeaders(d=diff){
    setLoadingLb(true);
    fetchLeaderboard("minesweeper_"+d,"low",10).then(rows=>{ setLeaders(rows); setLoadingLb(false); });
  }
  // refresh whenever the difficulty changes while the panel is open
  useEffect(()=>{ if(showLeaderboard) loadLeaders(diff); /* eslint-disable-next-line */ },[diff,showLeaderboard]);
  const cfg=MINE_DIFFICULTIES[diff];
  const [board,setBoard]=useState(null);             // null until first click
  const [revealed,setRevealed]=useState(()=>new Set());
  const [flagged,setFlagged]=useState(()=>new Set());
  const [status,setStatus]=useState("idle");          // idle | playing | won | lost
  const [startedAt,setStartedAt]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const pressTimer=useRef(null);
  const pressIsLong=useRef(false);
  // v9.3 — track which mouse button started the press. Right-clicking a cell
  // used to fire BOTH onContextMenu (flag) AND onPointerUp (reveal); the
  // reveal's `flagged.has(key)` check ran against stale closure state since
  // React hadn't re-rendered yet, so the cell would get revealed anyway —
  // and if it was a mine, the user instantly lost a game they were trying
  // to flag. Now: capture the button on pointerdown; if it's not the left
  // button, pointerup skips reveal entirely.
  const pressButton=useRef(0);

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
    setNewBest(false);
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
    if(mineIsWin(b,next)){
      setStatus("won");
      // v9.8 — submit completion time to the global board (lower = better).
      const finalTime=Math.max(1,Math.floor((Date.now()-startedAt)/1000));
      if(myUid){
        submitScore("minesweeper_"+diff, finalTime, "low", myUid, user).then(improved=>{
          if(improved) setNewBest(true);
          if(showLeaderboard) loadLeaders(diff);
        });
      }
    }
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
  // v9.3: also gates reveal-on-pointerup behind a left-button check so
  // right-click only fires the contextmenu flag path.
  function onCellPointerDown(e,r,c){
    pressButton.current=e.button;
    pressIsLong.current=false;
    if(e.button!==0)return;          // right-click is handled by onContextMenu — no timer, no reveal
    pressTimer.current=setTimeout(()=>{
      pressIsLong.current=true;
      toggleFlag(r,c);
    },350);
  }
  function onCellPointerUp(e,r,c){
    clearTimeout(pressTimer.current);
    if(pressButton.current!==0)return;  // right-click pointerup must not reveal
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
        {/* Counter pills — classic minesweeper readout styling */}
        <div style={{fontFamily:FFM,fontSize:13,color:"#ff8b8b",background:"rgba(0,0,0,0.3)",border:"1px solid var(--nv-border)",borderRadius:6,padding:"3px 9px",minWidth:54,textAlign:"center"}}>💣 {minesLeft}</div>
        <div style={{fontFamily:FFM,fontSize:13,color:"var(--nv-text)",background:"rgba(0,0,0,0.3)",border:"1px solid var(--nv-border)",borderRadius:6,padding:"3px 9px",minWidth:54,textAlign:"center"}}>⏱ {elapsed}s</div>
        <button onClick={()=>setShowLeaderboard(v=>!v)} title="Global leaderboard" style={{padding:"5px 11px",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,background:showLeaderboard?fill(AC):"rgba(255,255,255,0.07)",border:"1px solid "+(showLeaderboard?bdr(AC):"rgba(255,255,255,0.12)"),color:showLeaderboard?AC:"var(--nv-text)"}}>🏆</button>
        <button onClick={()=>newGame(diff)} style={{padding:"5px 11px",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"var(--nv-text)"}}>↻ New</button>
      </div>

      {status==="won" && <div style={{padding:"8px 12px",background:"rgba(76,239,144,0.1)",border:"1px solid rgba(76,239,144,0.35)",borderRadius:7,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#4cef90",textAlign:"center"}}>🎉 You won in {elapsed}s!{newBest && <span style={{marginLeft:8,color:"#ffd060"}}>🏆 New personal best!</span>}</div>}
      {status==="lost" && <div style={{padding:"8px 12px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:7,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#ff7878",textAlign:"center"}}>💥 You hit a mine — try again</div>}

      {/* Global leaderboard panel */}
      {showLeaderboard && (
        <div style={{flexShrink:0,background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",borderRadius:9,padding:"10px 12px"}}>
          <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:FFB,fontWeight:700,fontSize:12,color:"var(--nv-text-strong)"}}>🏆 Fastest times · <span style={{textTransform:"capitalize",color:AC}}>{diff}</span></div>
            <div style={{flex:1}}/>
            <button onClick={()=>loadLeaders(diff)} title="Refresh" style={{background:"none",border:"none",cursor:"pointer",color:"var(--nv-text-dim)",fontSize:12}}>↻</button>
          </div>
          {loadingLb ? (
            <div style={{fontSize:11,color:"var(--nv-text-dim)",fontStyle:"italic",padding:"8px 2px"}}>Loading…</div>
          ) : leaders.length===0 ? (
            <div style={{fontSize:11,color:"var(--nv-text-dim)",fontStyle:"italic",padding:"8px 2px"}}>No times yet — win a game to claim the top spot!</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              {leaders.map((row,i)=>(
                <div key={row.id} style={{display:"grid",gridTemplateColumns:"24px 1fr auto",gap:8,alignItems:"center",padding:"4px 8px",borderRadius:6,background:row.uid===myUid?fill(AC):"transparent",fontFamily:FF}}>
                  <span style={{fontFamily:FFB,fontWeight:700,fontSize:12,color:i===0?"#ffd060":i===1?"#cfd3da":i===2?"#d8954e":"var(--nv-text-dim)"}}>{i+1}</span>
                  <span style={{fontSize:12,color:row.uid===myUid?AC:"var(--nv-text-strong)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{row.user||"anon"}{row.uid===myUid&&<span style={{fontSize:9,color:"var(--nv-text-dim)",marginLeft:5,fontFamily:FFM}}>you</span>}</span>
                  <span style={{fontFamily:FFM,fontSize:12,color:"var(--nv-text)"}}>{row.score}s</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                onPointerDown={e=>onCellPointerDown(e,r,c)}
                onPointerUp={e=>onCellPointerUp(e,r,c)}
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

import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { emptyGrid as tetrisEmpty, randomPiece as tetrisRandom, shapeOf, fits as tetrisFits, lockPiece as tetrisLock, clearLines as tetrisClearLines, scoreForLines, tickInterval, PIECE_COLORS, BOARD_W as TETRIS_W, BOARD_H as TETRIS_H } from "../lib/tetris.js";

export function TetrisApp({AC}){
  const [grid,setGrid]=useState(()=>tetrisEmpty());
  const [piece,setPiece]=useState(()=>tetrisRandom());
  const [next,setNext]=useState(()=>tetrisRandom());
  const [score,setScore]=useState(0);
  const [lines,setLines]=useState(0);
  const [level,setLevel]=useState(1);
  const [over,setOver]=useState(false);
  const [paused,setPaused]=useState(false);
  // Refs let the keyboard handler and the gravity tick read the latest values
  // without becoming dependencies that re-create handlers every render.
  const gridRef=useRef(grid);   useEffect(()=>{gridRef.current=grid;},[grid]);
  const pieceRef=useRef(piece); useEffect(()=>{pieceRef.current=piece;},[piece]);

  function newGame(){
    setGrid(tetrisEmpty());setPiece(tetrisRandom());setNext(tetrisRandom());
    setScore(0);setLines(0);setLevel(1);setOver(false);setPaused(false);
  }

  // Try to move/rotate; commit if the move fits. Locks the piece when downward
  // movement is blocked, then spawns the next piece (game over if it can't fit).
  function tryMove(dr,dc){
    const p=pieceRef.current;
    if(!p)return false;
    const moved={...p,row:p.row+dr,col:p.col+dc};
    if(tetrisFits(gridRef.current,moved)){setPiece(moved);return true;}
    if(dr>0){lockAndSpawn();}
    return false;
  }
  function rotate(){
    const p=pieceRef.current;
    if(!p)return;
    const r=(p.rotation+1)%4;
    if(tetrisFits(gridRef.current,p,p.row,p.col,r)){setPiece({...p,rotation:r});}
    // Simple "wall kick": try shifting +/-1 column if the basic rotation didn't fit
    else if(tetrisFits(gridRef.current,p,p.row,p.col-1,r)){setPiece({...p,rotation:r,col:p.col-1});}
    else if(tetrisFits(gridRef.current,p,p.row,p.col+1,r)){setPiece({...p,rotation:r,col:p.col+1});}
  }
  function hardDrop(){
    let p=pieceRef.current;
    if(!p)return;
    let dropped=0;
    while(tetrisFits(gridRef.current,p,p.row+1,p.col)){p={...p,row:p.row+1};dropped++;}
    setPiece(p);
    setScore(s=>s+dropped*2);  // bonus points for hard drops
    setTimeout(lockAndSpawn,0);
  }
  function lockAndSpawn(){
    const locked=tetrisLock(gridRef.current,pieceRef.current);
    const {grid:cleared,linesCleared}=tetrisClearLines(locked);
    setGrid(cleared);
    if(linesCleared>0){
      setScore(s=>s+scoreForLines(linesCleared,level));
      setLines(l=>{
        const n=l+linesCleared;
        setLevel(Math.floor(n/10)+1);
        return n;
      });
    }
    const spawned=next;
    const newNext=tetrisRandom();
    setNext(newNext);
    if(!tetrisFits(cleared,spawned)){setOver(true);return;}
    setPiece(spawned);
  }

  // Gravity tick — falls one row every interval(level). Paused/over freezes it.
  useEffect(()=>{
    if(over||paused)return;
    const id=setInterval(()=>tryMove(1,0),tickInterval(level));
    return ()=>clearInterval(id);
  },[level,over,paused]); // eslint-disable-line

  // Keyboard controls
  useEffect(()=>{
    function onKey(e){
      if(over)return;
      if(e.key==="ArrowLeft"){e.preventDefault();tryMove(0,-1);}
      else if(e.key==="ArrowRight"){e.preventDefault();tryMove(0,1);}
      else if(e.key==="ArrowDown"){e.preventDefault();tryMove(1,0);setScore(s=>s+1);}
      else if(e.key==="ArrowUp"){e.preventDefault();rotate();}
      else if(e.key===" "){e.preventDefault();hardDrop();}
      else if(e.key==="p"||e.key==="P"){setPaused(p=>!p);}
    }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[over]); // eslint-disable-line

  // Build a display grid that includes the active piece overlaid on the locked grid.
  const display=grid.map(r=>r.slice());
  if(!over){
    const s=shapeOf(piece);
    for(let r=0;r<s.length;r++)for(let c=0;c<s[r].length;c++){
      if(s[r][c]){
        const gr=piece.row+r, gc=piece.col+c;
        if(gr>=0&&gr<TETRIS_H&&gc>=0&&gc<TETRIS_W) display[gr][gc]=piece.color;
      }
    }
  }
  // Render the "next" preview piece too
  const nextShape=shapeOf(next);

  const ctrlBtn=(label,onClick,opts={})=>(
    <button onClick={onClick} style={{
      width:opts.w||44,height:44,borderRadius:8,
      background:opts.danger?"rgba(255,80,80,0.1)":"rgba(255,255,255,0.07)",
      border:"1px solid "+(opts.danger?"rgba(255,80,80,0.3)":"rgba(255,255,255,0.12)"),
      cursor:"pointer",color:opts.danger?"#ff8b8b":"rgba(255,255,255,0.85)",
      fontFamily:FFB,fontWeight:700,fontSize:16,touchAction:"manipulation",
    }}>{label}</button>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",fontFamily:FF,minHeight:0,alignItems:"center"}}>
      {/* Top info */}
      <div style={{display:"flex",gap:10,width:"100%",flexShrink:0}}>
        <div style={{flex:1,padding:"7px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7}}>
          <div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>SCORE</div>
          <div style={{fontFamily:FFM,fontWeight:600,fontSize:16,color:"#fff"}}>{score}</div>
        </div>
        <div style={{flex:1,padding:"7px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7}}>
          <div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>LINES · LVL</div>
          <div style={{fontFamily:FFM,fontWeight:600,fontSize:16,color:"#fff"}}>{lines} · {level}</div>
        </div>
        <div style={{padding:"5px 7px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,minWidth:48}}>
          <div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.4)",letterSpacing:1,textAlign:"center"}}>NEXT</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat("+nextShape[0].length+",1fr)",gap:1,marginTop:2}}>
            {nextShape.flat().map((c,i)=><div key={i} style={{width:8,height:8,background:c?PIECE_COLORS[next.color]:"transparent",borderRadius:1}}/>)}
          </div>
        </div>
      </div>

      {over && <div style={{padding:"6px 12px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.4)",borderRadius:7,fontFamily:FFB,fontWeight:700,fontSize:12,color:"#ff8b8b",flexShrink:0}}>Game Over · Score: {score}</div>}

      {/* Playfield */}
      <div style={{display:"grid",gridTemplateColumns:"repeat("+TETRIS_W+",1fr)",gridAutoRows:"1fr",gap:1,background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:3,aspectRatio:TETRIS_W/TETRIS_H,maxHeight:"100%",width:"min(100%, 240px)",touchAction:"none"}}>
        {display.flat().map((c,i)=><div key={i} style={{background:c?PIECE_COLORS[c]:"rgba(255,255,255,0.03)",borderRadius:1}}/>)}
      </div>

      {/* Touch controls (also nice on desktop) */}
      <div style={{display:"flex",gap:6,flexShrink:0,marginTop:2}}>
        {ctrlBtn("←",()=>tryMove(0,-1))}
        {ctrlBtn("↻",rotate)}
        {ctrlBtn("→",()=>tryMove(0,1))}
        {ctrlBtn("↓",()=>{tryMove(1,0);setScore(s=>s+1);})}
        {ctrlBtn("⤓",hardDrop,{w:60})}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        {ctrlBtn(paused?"▶":"⏸",()=>setPaused(p=>!p),{w:60})}
        {ctrlBtn("↻ New",newGame,{w:80,danger:over})}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textAlign:"center",fontStyle:"italic",flexShrink:0}}>← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause</div>
    </div>
  );
}

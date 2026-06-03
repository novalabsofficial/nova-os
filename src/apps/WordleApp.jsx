import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { dailyWord, scoreGuess, normalizeGuess, randomWord } from "../lib/wordle.js";

import { submitScore } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";
import { Leaderboard } from "../ui/Leaderboard.jsx";

export function WordleApp({AC,showToast,user}){
  const myUid=getDbUid();
  const streakRef=useRef(parseInt(localStorage.getItem("nova-wordle-streak"),10)||0);
  const [mode,setMode]=useState("daily");             // daily | infinite
  const [answer,setAnswer]=useState(()=>dailyWord());
  const [guesses,setGuesses]=useState([]);            // array of {word, score}
  const [current,setCurrent]=useState("");
  const [status,setStatus]=useState("playing");       // playing | won | lost
  const MAX=6;
  // Win-streak leaderboard: each solve bumps the streak (best is kept by
  // submitScore); a loss resets it. Persisted per device.
  useEffect(()=>{
    if(status==="won"){
      streakRef.current+=1;
      localStorage.setItem("nova-wordle-streak",String(streakRef.current));
      if(myUid) submitScore("wordle",streakRef.current,"high",myUid,user);
    } else if(status==="lost"){
      streakRef.current=0;
      localStorage.setItem("nova-wordle-streak","0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[status]);

  function reset(newAnswer){ setAnswer(newAnswer); setGuesses([]); setCurrent(""); setStatus("playing"); }
  function pickMode(m){ if(m===mode)return; setMode(m); reset(m==="daily"?dailyWord():randomWord()); }
  function newWord(){ reset(randomWord()); }

  function submitGuess(){
    if(status!=="playing")return;
    const g=normalizeGuess(current);
    if(!g){showToast?.("Need 5 letters");return;}
    const sc=scoreGuess(g,answer);
    const next=[...guesses,{word:g,score:sc}];
    setGuesses(next);
    setCurrent("");
    if(g===answer){setStatus("won");return;}
    if(next.length>=MAX){setStatus("lost");}
  }
  function onKey(e){
    if(e.key==="Enter"){submitGuess();return;}
    if(e.key==="Backspace"){setCurrent(s=>s.slice(0,-1));return;}
    if(/^[a-zA-Z]$/.test(e.key)&&current.length<5){
      setCurrent(s=>(s+e.key).toUpperCase());
    }
  }
  // Per-letter color used for both completed guesses AND the keyboard hint.
  function colorFor(state){
    if(state==="correct")return {bg:"rgba(76,239,144,0.25)",border:"rgba(76,239,144,0.6)",fg:"#4cef90"};
    if(state==="present")return {bg:"rgba(255,200,80,0.22)",border:"rgba(255,200,80,0.55)",fg:"#ffcc44"};
    if(state==="absent") return {bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.08)",fg:"rgba(255,255,255,0.35)"};
    return {bg:"rgba(255,255,255,0.05)",border:"rgba(255,255,255,0.12)",fg:"rgba(255,255,255,0.85)"};
  }
  // Build a key-state map from previous guesses so the on-screen keyboard
  // reflects what's known about each letter (priority: correct > present > absent).
  const keyStates={};
  for(const g of guesses){
    for(let i=0;i<g.word.length;i++){
      const L=g.word[i], s=g.score[i];
      const prev=keyStates[L];
      const rank={correct:3,present:2,absent:1};
      if(!prev || (rank[s]||0)>(rank[prev]||0)) keyStates[L]=s;
    }
  }
  // 6 rows of 5 cells; fill in completed guesses, then current entry, then empties.
  const rows=[];
  for(let r=0;r<MAX;r++){
    const guess=guesses[r];
    const isCur=!guess && r===guesses.length && status==="playing";
    rows.push({guess, isCur});
  }

  const KB_ROWS=["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];
  function pressKey(k){
    if(status!=="playing")return;
    if(k==="ENTER"){submitGuess();return;}
    if(k==="BACK"){setCurrent(s=>s.slice(0,-1));return;}
    if(current.length<5)setCurrent(s=>s+k);
  }

  return(
    <div tabIndex={0} onKeyDown={onKey} style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:FF,outline:"none",alignItems:"center",gap:14,minHeight:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        {[["daily","Daily"],["infinite","Infinite"]].map(([m,label])=>(
          <button key={m} onClick={()=>pickMode(m)} style={{
            padding:"5px 14px",borderRadius:18,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,letterSpacing:0.5,
            background:mode===m?fill(AC):"rgba(255,255,255,0.05)",
            border:"1px solid "+(mode===m?bdr(AC):"rgba(255,255,255,0.1)"),
            color:mode===m?AC:"rgba(255,255,255,0.55)",
          }}>{label}</button>
        ))}
        {mode==="infinite" && <button onClick={newWord} title="New random word" style={{
          padding:"5px 12px",borderRadius:18,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,
          background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"var(--nv-text)",
        }}>↻ New word</button>}
        <Leaderboard gameId="wordle" dir="high" AC={AC} title="Longest Wordle streak" unit="streak" compact buttonStyle={{padding:"5px 14px",borderRadius:18,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"var(--nv-text)"}} />
      </div>

      {status==="won" && <div style={{padding:"7px 14px",background:"rgba(76,239,144,0.12)",border:"1px solid rgba(76,239,144,0.4)",borderRadius:7,fontFamily:FFB,fontWeight:700,fontSize:13,color:"#4cef90"}}>🎉 Got it in {guesses.length}!</div>}
      {status==="lost" && <div style={{padding:"7px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.4)",borderRadius:7,fontFamily:FFB,fontWeight:700,fontSize:13,color:"#ff8b8b"}}>Answer: {answer}</div>}

      {/* Guess grid */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {rows.map((row,ri)=>(
          <div key={ri} style={{display:"flex",gap:6}}>
            {[0,1,2,3,4].map(i=>{
              const letter = row.guess ? row.guess.word[i] : (row.isCur ? current[i] : "");
              const state = row.guess ? row.guess.score[i] : null;
              const col=colorFor(state);
              return(
                <div key={i} style={{
                  width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:FFB,fontWeight:700,fontSize:22,letterSpacing:1,
                  borderRadius:6,
                  background:col.bg,border:"1px solid "+col.border,color:col.fg,
                  transition:"background 0.18s, border-color 0.18s",
                }}>{letter||""}</div>
              );
            })}
          </div>
        ))}
      </div>

      {/* On-screen keyboard */}
      <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4,maxWidth:360,width:"100%"}}>
        {KB_ROWS.map((row,ri)=>(
          <div key={ri} style={{display:"flex",gap:3,justifyContent:"center"}}>
            {ri===2 && <button onClick={()=>pressKey("ENTER")} style={{flex:"1.4 1 0",height:38,borderRadius:5,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",fontFamily:FFB,fontWeight:700,fontSize:11,cursor:"pointer",touchAction:"manipulation"}}>ENTER</button>}
            {row.split("").map(k=>{
              const st=keyStates[k];
              const col=colorFor(st);
              return(
                <button key={k} onClick={()=>pressKey(k)} style={{
                  flex:"1 1 0",height:38,borderRadius:5,
                  background:col.bg,border:"1px solid "+col.border,color:col.fg,
                  fontFamily:FFB,fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",
                  transition:"background 0.18s, border-color 0.18s",
                }}>{k}</button>
              );
            })}
            {ri===2 && <button onClick={()=>pressKey("BACK")} style={{flex:"1.4 1 0",height:38,borderRadius:5,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",fontFamily:FFB,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>⌫</button>}
          </div>
        ))}
      </div>

      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center",fontStyle:"italic"}}>Type letters or tap keys · Enter to submit · {mode==="daily"?"New word every UTC day":"Infinite practice — endless random words"}</div>
    </div>
  );
}

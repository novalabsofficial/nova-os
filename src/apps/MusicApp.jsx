import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

export function MusicApp({AC,showToast}){
  const [tracks,setTracks]=useState([]);     // [{name, url, size}]
  const [idx,setIdx]=useState(-1);
  const [playing,setPlaying]=useState(false);
  const [progress,setProgress]=useState(0);  // current time in seconds
  const [duration,setDuration]=useState(0);
  const [volume,setVolume]=useState(0.8);
  const audioRef=useRef(null);
  const inputRef=useRef(null);

  // Apply volume to the audio element whenever it changes.
  useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;},[volume]);
  // Cleanup blob URLs when the component unmounts (or tracks change).
  useEffect(()=>()=>{tracks.forEach(t=>URL.revokeObjectURL(t.url));},[]); // eslint-disable-line

  function handleFiles(e){
    const files=Array.from(e.target.files||[]);
    const audioFiles=files.filter(f=>f.type.startsWith("audio/")||/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name));
    if(audioFiles.length===0){showToast?.("No audio files selected");return;}
    const next=audioFiles.map(f=>({name:f.name,url:URL.createObjectURL(f),size:f.size}));
    setTracks(prev=>{
      const combined=[...prev,...next];
      // If nothing was playing, queue up the first new track
      if(idx<0)setIdx(prev.length);
      return combined;
    });
    e.target.value="";
  }

  function play(i){
    if(i<0||i>=tracks.length)return;
    setIdx(i);
    // Browsers require play() after a user gesture; this handler IS one.
    setTimeout(()=>{audioRef.current?.play().catch(()=>{});},0);
  }
  function togglePlay(){
    if(idx<0)return;
    if(playing) audioRef.current?.pause();
    else audioRef.current?.play().catch(()=>{});
  }
  function prev(){if(idx>0)play(idx-1);}
  function next(){if(idx<tracks.length-1)play(idx+1);}
  function seek(e){
    const el=audioRef.current;
    if(!el||!duration)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
    el.currentTime=ratio*duration;
  }
  function removeTrack(i){
    setTracks(prev=>{
      const copy=[...prev];
      const removed=copy.splice(i,1)[0];
      if(removed)URL.revokeObjectURL(removed.url);
      return copy;
    });
    if(i===idx){setIdx(-1);setPlaying(false);}
    else if(i<idx)setIdx(idx-1);
  }
  function fmt(s){
    if(!Number.isFinite(s))return "0:00";
    const m=Math.floor(s/60),sec=Math.floor(s%60);
    return m+":"+String(sec).padStart(2,"0");
  }

  const cur=idx>=0?tracks[idx]:null;
  const progPct=duration>0?(progress/duration)*100:0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12,height:"100%",fontFamily:FF,minHeight:0}}>
      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={handleFiles} style={{display:"none"}}/>

      {/* Now-playing card */}
      <div style={{padding:"16px 16px",background:"linear-gradient(135deg,"+fill(AC)+", rgba(255,255,255,0.03))",border:"1px solid "+bdr(AC),borderRadius:12,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:54,height:54,borderRadius:9,background:fill(AC),border:"1px solid "+bdr(AC),display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🎵</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:FFB,fontWeight:600,fontSize:14,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur?cur.name:"No track loaded"}</div>
            <div style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.5)",marginTop:2}}>{cur?fmt(progress)+" / "+fmt(duration):"—:—"}</div>
          </div>
        </div>
        {/* Progress bar */}
        <div onClick={seek} style={{marginTop:12,height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,cursor:cur?"pointer":"default",overflow:"hidden"}}>
          <div style={{height:"100%",width:progPct+"%",background:AC,transition:"width 0.1s linear"}}/>
        </div>
        {/* Controls */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12}}>
          <button onClick={prev} disabled={idx<=0} style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:idx>0?"pointer":"default",color:"rgba(255,255,255,0.8)",fontSize:14,opacity:idx>0?1:0.4}}>⏮</button>
          <button onClick={togglePlay} disabled={!cur} style={{width:44,height:44,borderRadius:10,background:fill(AC),border:"1px solid "+bdr(AC),cursor:cur?"pointer":"default",color:AC,fontSize:16,opacity:cur?1:0.4}}>{playing?"⏸":"▶"}</button>
          <button onClick={next} disabled={idx>=tracks.length-1} style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:idx<tracks.length-1?"pointer":"default",color:"rgba(255,255,255,0.8)",fontSize:14,opacity:idx<tracks.length-1?1:0.4}}>⏭</button>
          <div style={{flex:1}}/>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>🔊</span>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(+e.target.value)} style={{width:80,accentColor:AC}}/>
        </div>
      </div>

      {/* Playlist */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={SEC}>Playlist ({tracks.length})</div>
        <button onClick={()=>inputRef.current?.click()} style={{padding:"5px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.75)"}}>+ Add files</button>
      </div>
      <div style={{flex:1,overflowY:"auto",minHeight:0}}>
        {tracks.length===0 ? (
          <div style={{textAlign:"center",padding:"30px 16px",color:"rgba(255,255,255,0.25)",fontStyle:"italic",fontSize:12}}>No tracks. Add audio files from your device — MP3, WAV, OGG, M4A all work.</div>
        ) : tracks.map((t,i)=>(
          <div key={i} className="sr" onClick={()=>play(i)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:4,background:i===idx?fill(AC):"rgba(255,255,255,0.03)",border:"1px solid "+(i===idx?bdr(AC):"rgba(255,255,255,0.06)"),borderRadius:7,cursor:"pointer"}}>
            <div style={{width:24,textAlign:"center",fontFamily:FFM,fontSize:11,color:i===idx?AC:"rgba(255,255,255,0.35)"}}>{i===idx&&playing?"▶":i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:i===idx?"#fff":"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
            </div>
            <button className="dl" onClick={e=>{e.stopPropagation();removeTrack(i);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,padding:"3px 6px"}}>✕</button>
          </div>
        ))}
      </div>

      {/* The actual <audio> element. Hidden — we drive it via refs. */}
      {cur && <audio
        ref={audioRef}
        src={cur.url}
        onPlay={()=>setPlaying(true)}
        onPause={()=>setPlaying(false)}
        onTimeUpdate={e=>setProgress(e.currentTarget.currentTime)}
        onDurationChange={e=>setDuration(e.currentTarget.duration)}
        onEnded={()=>{if(idx<tracks.length-1)play(idx+1);else setPlaying(false);}}
      />}
    </div>
  );
}

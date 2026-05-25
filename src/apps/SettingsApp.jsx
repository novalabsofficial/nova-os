import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { WALLPAPERS, ACCENT_PRESETS, WIDGET_CONFIGS } from "../ui/constants.js";
import { Toggle } from "../ui/Toggle.jsx";
import { getSoundConfig, setSoundConfig, playSound, setSoundWallpaper } from "../lib/audio.js";
import { db } from "../lib/db.js";
import { isFullscreen, toggleFullscreen, onFullscreenChange } from "../lib/fullscreen.js";

export function SettingsApp({user,data,updateSettings,showToast,AC,onCustomWallpaper,onLogout}){
  // v7.8: live fullscreen state. Subscribes to fullscreenchange events so
  // the toggle stays in sync even when the user exits via Esc or F11
  // outside of this Settings UI.
  const [fs, setFs] = useState(()=>isFullscreen());
  useEffect(()=>{
    setFs(isFullscreen());
    return onFullscreenChange(setFs);
  },[]);
  // Sound preferences live in localStorage (read inside playSound on each call)
  // so they take effect instantly without a Firestore round-trip. We mirror
  // them into local state here purely so the slider/toggle re-render.
  const [soundCfg, setSoundCfgState] = useState(()=>getSoundConfig());
  function updateSoundCfg(patch){
    const next = {...soundCfg, ...patch};
    setSoundCfgState(next);
    setSoundConfig(next);
  }
  const settings=data?.settings||{};const fileRef=useRef(null);
  function handleUpload(e){const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){showToast("File too large (max 8MB)");return;}const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const canvas=document.createElement("canvas");const MAX=900;const ratio=Math.min(MAX/img.width,MAX/img.height,1);canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);onCustomWallpaper(canvas.toDataURL("image/jpeg",0.72));};img.src=ev.target.result;};reader.readAsDataURL(file);e.target.value="";}
  const wpId=settings.wallpaper||data?.wallpaper||"mesh";
  const widgets=settings.widgets||{};
  function setWidget(id,val){updateSettings({widgets:{...widgets,[id]:val}});}
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      <div style={SEC}>Accent Color</div>
      <div style={{display:"flex",gap:7,marginBottom:6,flexWrap:"wrap"}}>{ACCENT_PRESETS.map(c=><div key={c} className="ad" onClick={()=>{updateSettings({accent:c});showToast("Accent updated ✓");}} style={{width:28,height:28,borderRadius:7,background:c,cursor:"pointer",border:AC===c?"2.5px solid #fff":"2.5px solid transparent",transition:"transform 0.12s,border 0.12s",boxSizing:"border-box"}}/>)}<input type="color" value={AC} onChange={e=>updateSettings({accent:e.target.value})} style={{width:28,height:28,borderRadius:7,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",background:"none"}} title="Custom color"/></div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",marginBottom:20,fontFamily:FFM}}>Current: {AC}</div>
      <div style={SEC}>Wallpaper</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{Object.entries(WALLPAPERS).filter(([k])=>k!=="custom").map(([k,w])=>(<div key={k} className="ws" onClick={()=>{updateSettings({wallpaper:k});setSoundWallpaper(k);playSound("notification");showToast("Wallpaper: "+w.name+" ✓");}} style={{height:52,borderRadius:8,background:w.preview,cursor:"pointer",border:wpId===k?"2.5px solid #fff":"2px solid transparent",transition:"border 0.14s",boxSizing:"border-box",display:"flex",alignItems:"flex-end",padding:"5px 7px"}}><span style={{fontSize:9,fontFamily:FFB,fontWeight:600,color:"rgba(255,255,255,0.85)",textShadow:"0 1px 4px rgba(0,0,0,0.9)"}}>{w.name}</span></div>))}</div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.32)",fontStyle:"italic",marginBottom:10,fontFamily:FF}}>✨ v6.2: each wallpaper tunes the system sounds to a matching musical key. Pick one and listen to the chime.</div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{display:"none"}}/>
      <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:"10px",background:wpId==="custom"?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(wpId==="custom"?bdr(AC):"rgba(255,255,255,0.12)"),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:wpId==="custom"?AC:"rgba(255,255,255,0.6)",marginBottom:22}}>{wpId==="custom"?"✓ Custom Wallpaper Active — Click to Change":"📁 Upload Custom Wallpaper"}</button>
      <div style={SEC}>Desktop Widgets</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:10}}>Drag header to move · Drag edges/corners to resize · Snaps to 20px grid on release.</div>
      {Object.entries(WIDGET_CONFIGS).map(([id,cfg])=>(
        <Toggle key={id} label={cfg.emoji+"  "+cfg.label} value={!!widgets[id]} onChange={v=>setWidget(id,v)} ac={AC}/>
      ))}
      {widgets.weather&&<div style={{fontSize:11,color:"rgba(255,200,80,0.7)",fontFamily:FF,padding:"7px 10px",background:"rgba(255,200,0,0.06)",border:"1px solid rgba(255,200,0,0.15)",borderRadius:6,marginBottom:6,marginTop:2}}>⚠ Weather needs location access — allow it in your browser when prompted.</div>}
      <div style={{...SEC,marginTop:20}}>Window Blur</div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><input type="range" min={0} max={30} value={settings.winBlur??18} onChange={e=>updateSettings({winBlur:+e.target.value})} style={{flex:1,accentColor:AC}}/><span style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.4)",width:32}}>{settings.winBlur??18}px</span></div>
      <div style={SEC}>Display</div>
      {/* v7.8: Fullscreen toggle. Tauri desktop calls native window setFullscreen
          (hides title bar + OS chrome). Web/PWA uses the HTML Fullscreen API.
          Either way the underlying state is live-mirrored back into `fs` so
          the toggle position stays correct if the user exits via Esc/F11. */}
      <Toggle label="Fullscreen Mode" value={fs} onChange={()=>{toggleFullscreen();}} ac={AC}/>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.32)",marginBottom:10,fontStyle:"italic",marginTop:-4}}>Tip: press <strong style={{color:"rgba(255,255,255,0.55)"}}>F11</strong> any time to toggle.</div>
      <Toggle label="24-Hour Clock" value={!!settings.clock24h}  onChange={v=>updateSettings({clock24h:v})}  ac={AC}/>
      <Toggle label="Large Text"    value={!!settings.largeFont} onChange={v=>updateSettings({largeFont:v})} ac={AC}/>
      {/* v6.4: when on, the OS saves which apps are open + their positions
          on every change (debounced) and restores them next sign-in. Useful
          if you typically work with the same set of windows; turn off if
          you'd rather start clean each session. */}
      <Toggle label="Restore open apps on sign-in" value={!!settings.restoreOnSignin} onChange={v=>updateSettings({restoreOnSignin:v})} ac={AC}/>
      <div style={{...SEC,marginTop:22}}>Display Mode</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:9,lineHeight:1.55}}>How Nova OS sizes for your device. "Auto" picks based on screen size + touch capability — override here if you want a specific look.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:7,marginBottom:6}}>
        {[
          {id:"auto",   label:"⚙ Auto",     desc:"Detect from device"},
          {id:"desktop",label:"🖥 Desktop",  desc:"Mouse-precision UI"},
          {id:"tablet", label:"📱 Tablet",  desc:"Larger touch targets"},
          {id:"mobile", label:"📲 Mobile",  desc:"Phone-size notice"},
        ].map(m=>{
          const active=(settings.displayMode||"auto")===m.id;
          return(
            <button key={m.id} onClick={()=>{updateSettings({displayMode:m.id});showToast("Display: "+m.label+" ✓");}}
              style={{textAlign:"left",padding:"10px 12px",background:active?fill(AC):"rgba(255,255,255,0.04)",border:"1px solid "+(active?bdr(AC):"rgba(255,255,255,0.08)"),borderRadius:8,cursor:"pointer",fontFamily:FF,color:active?AC:"rgba(255,255,255,0.7)"}}>
              <div style={{fontFamily:FFB,fontWeight:600,fontSize:12}}>{m.label}</div>
              <div style={{fontSize:10,color:active?AC:"rgba(255,255,255,0.4)",marginTop:1,opacity:active?0.85:1}}>{m.desc}</div>
            </button>
          );
        })}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",marginBottom:22,fontStyle:"italic"}}>Resize the browser window to test — Nova will re-detect on the fly.</div>

      <div style={SEC}>Sounds</div>
      <Toggle label="System sounds" value={soundCfg.enabled} onChange={v=>updateSoundCfg({enabled:v})} ac={AC}/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,marginBottom:8,opacity:soundCfg.enabled?1:0.4,pointerEvents:soundCfg.enabled?"auto":"none"}}>
        <span style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.4)",width:54}}>Volume</span>
        <input type="range" min={0} max={1} step={0.05} value={soundCfg.volume} onChange={e=>updateSoundCfg({volume:+e.target.value})} style={{flex:1,accentColor:AC}}/>
        <span style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.4)",width:32}}>{Math.round(soundCfg.volume*100)}%</span>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:22,opacity:soundCfg.enabled?1:0.4}}>
        {["startup","login","logout","notification","appLaunch","windowOpen","windowClose","toast","error"].map(s=>(
          <button key={s} onClick={()=>playSound(s)} style={{padding:"4px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,cursor:"pointer",fontFamily:FFM,fontWeight:500,fontSize:10,color:"rgba(255,255,255,0.55)"}}>▶ {s}</button>
        ))}
      </div>

      {/* v6.4: Discoverable shortcut list. Browsers won't let us intercept
          Cmd+W / Cmd+M, hence the Alt-based bindings. */}
      <div style={SEC}>Keyboard Shortcuts</div>
      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:22,padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8}}>
        {[
          ["⌘/Ctrl + K",       "Open start menu"],
          ["⌘/Ctrl + ,",       "Open Settings"],
          ["Esc",              "Close start menu / dialogs"],
          ["Alt + W",          "Close active window"],
          ["Alt + M",          "Minimize active window"],
          ["F11",              "Toggle fullscreen"],
        ].map(([combo, action])=>(
          <div key={combo} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,color:"rgba(255,255,255,0.78)"}}>
            <span style={{fontFamily:FFM,fontSize:11,padding:"2px 7px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,color:"rgba(255,255,255,0.88)",minWidth:120,textAlign:"center"}}>{combo}</span>
            <span style={{fontFamily:FF,opacity:0.85}}>{action}</span>
          </div>
        ))}
      </div>

      <div style={SEC}>Account</div>
      <div style={{padding:"11px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,marginBottom:8}}><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:2}}>Signed in as</div><div style={{fontFamily:FFB,fontWeight:600,fontSize:16,color:"#fff"}}>@{user}</div></div>
      {onLogout && (
        <button onClick={onLogout} style={{width:"100%",padding:"10px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:"#ff8b8b"}}>Sign Out</button>
      )}
    </div>
  );
}

// Standard on/off toggle. Used in Settings for clock 24h, large font,
// sounds enabled, widget toggles, etc.

import { FF, DEFAULT_AC } from "./styles.js";

export function Toggle({ label, value, onChange, ac }) {
  const c = ac || DEFAULT_AC;
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--nv-elevated)",border:"1px solid var(--nv-border)",borderRadius:8,marginBottom:6}}>
      <span style={{fontFamily:FF,fontSize:13,color:"var(--nv-text)"}}>{label}</span>
      <div onClick={()=>onChange(!value)} style={{width:40,height:22,borderRadius:11,background:value?c:"var(--nv-border-strong)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
        <div style={{position:"absolute",top:3,left:value?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 2px rgba(0,0,0,0.25)",transition:"left 0.2s"}}/>
      </div>
    </div>
  );
}

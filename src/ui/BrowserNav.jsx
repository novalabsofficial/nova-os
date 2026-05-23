// Browser app's address bar — used only by BrowserApp. Lives in ui/ because
// it shares the navBtn pattern with other top-level nav controls.

import { FFB, FFM } from "./styles.js";
import { fill, bdr } from "../lib/format.js";

export function BrowserNav({ bar, setBar, onGo, onBack, onFwd, onRefresh, canBack, canFwd, canRefresh, AC }) {
  const navBtn = (enabled) => ({
    width: 30, height: 30, borderRadius: 8,
    background: enabled ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
    border: "1px solid " + (enabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"),
    cursor: enabled ? "pointer" : "default",
    color:  enabled ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
    fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  });
  return (
    <div style={{display:"flex",gap:6,marginBottom:9,alignItems:"center"}}>
      <button onClick={onBack}    disabled={!canBack}    title="Back"    style={navBtn(canBack)}>←</button>
      <button onClick={onFwd}     disabled={!canFwd}     title="Forward" style={navBtn(canFwd)}>→</button>
      <button onClick={onRefresh} disabled={!canRefresh} title="Refresh" style={navBtn(canRefresh)}>↻</button>
      <input
        value={bar}
        onChange={e => setBar(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onGo()}
        placeholder="Search or enter URL…"
        style={{
          flex: 1, minWidth: 0,
          padding: "8px 14px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          color: "rgba(255,255,255,0.92)",
          fontFamily: FFM, fontSize: 12,
          outline: "none",
        }}/>
      <button onClick={onGo} style={{padding:"7px 16px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:16,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC,flexShrink:0}}>Go</button>
    </div>
  );
}

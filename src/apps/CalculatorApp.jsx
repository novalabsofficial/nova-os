import { useState, useRef, useEffect } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { applyOp, formatDisplay, toggleSign, appendKey } from "../lib/calc.js";

export function CalculatorApp({AC}){
  // Display string holds the in-progress entry (or last result after =).
  // pending holds {prev, op} when we're waiting for the second operand.
  const [display,setDisplay]=useState("0");
  const [pending,setPending]=useState(null);
  const [justEvaluated,setJustEvaluated]=useState(false);

  // v8.3 F4: keyboard support. The calculator was button-only, so there was
  // no way to "hold backspace to keep deleting" — clicking the ⌫ button
  // deletes one digit per click. With a focusable wrapper + onKeyDown,
  // holding Backspace fires keydown repeatedly (browser key-repeat) and
  // each repeat calls pressBackspace, giving continuous deletion. Also
  // wires up digits, operators, Enter/=, Escape/clear, and %.
  const wrapRef = useRef(null);
  useEffect(()=>{ wrapRef.current?.focus(); }, []);

  function pressDigit(d){
    if(justEvaluated){setDisplay(d==="."?"0.":d);setJustEvaluated(false);return;}
    setDisplay(prev=>appendKey(prev,d));
  }
  function pressOp(op){
    const cur=parseFloat(display);
    if(pending&&!justEvaluated){
      const r=applyOp(pending.prev,pending.op,cur);
      setDisplay(formatDisplay(r));
      setPending({prev:r,op});
    } else {
      setPending({prev:cur,op});
    }
    setJustEvaluated(true); // next digit starts fresh entry
  }
  function pressEquals(){
    if(!pending)return;
    const cur=parseFloat(display);
    const r=applyOp(pending.prev,pending.op,cur);
    setDisplay(formatDisplay(r));
    setPending(null);
    setJustEvaluated(true);
  }
  function pressClear(){setDisplay("0");setPending(null);setJustEvaluated(false);}
  function pressSign(){setDisplay(s=>toggleSign(s));}
  function pressPercent(){const n=parseFloat(display);setDisplay(formatDisplay(n/100));setJustEvaluated(true);}
  function pressBackspace(){
    if(justEvaluated){pressClear();return;}
    setDisplay(s=>{
      if(s.length<=1||(s.length===2&&s.startsWith("-")))return "0";
      return s.slice(0,-1);
    });
  }

  // Keyboard handler. preventDefault on handled keys so (a) Backspace
  // doesn't trigger browser back-nav, and (b) Enter/Space don't re-activate
  // a focused button (avoids double-firing).
  function onKeyDown(e){
    const k = e.key;
    if(/^[0-9]$/.test(k)){ e.preventDefault(); pressDigit(k); return; }
    if(k==="."){ e.preventDefault(); pressDigit("."); return; }
    if(k==="+"){ e.preventDefault(); pressOp("+"); return; }
    if(k==="-"){ e.preventDefault(); pressOp("-"); return; }
    if(k==="*"){ e.preventDefault(); pressOp("×"); return; }
    if(k==="/"){ e.preventDefault(); pressOp("÷"); return; }
    if(k==="Enter" || k==="="){ e.preventDefault(); pressEquals(); return; }
    if(k==="Backspace"){ e.preventDefault(); pressBackspace(); return; }   // repeats on hold
    if(k==="Escape"){ e.preventDefault(); pressClear(); return; }
    if(k==="%"){ e.preventDefault(); pressPercent(); return; }
  }

  // Layout: 5 rows × 4 cols. The "0" key spans two cols on the bottom row.
  const btn=(label,onClick,style={})=>(
    <button onClick={onClick} style={{
      height:54,borderRadius:14,
      background:"rgba(255,255,255,0.06)",
      border:"1px solid rgba(255,255,255,0.08)",
      cursor:"pointer",
      fontFamily:FFB,fontWeight:600,fontSize:18,
      color:"rgba(255,255,255,0.92)",
      transition:"background 0.15s",
      touchAction:"manipulation",
      ...style,
    }} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.11)"}
       onMouseOut={e=>e.currentTarget.style.background=style.background||"rgba(255,255,255,0.06)"}>{label}</button>
  );
  const acStyle={background:fill(AC),border:"1px solid "+bdr(AC),color:AC};
  const opStyle={background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.13)",color:"#fff"};

  return(
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown} style={{display:"flex",flexDirection:"column",gap:10,fontFamily:FF,height:"100%",minHeight:0,outline:"none"}}>
      {/* Display */}
      <div style={{flexShrink:0,padding:"22px 14px 18px",background:"rgba(0,0,0,0.25)",borderRadius:14,border:"1px solid rgba(255,255,255,0.05)",textAlign:"right",minHeight:80,display:"flex",flexDirection:"column",justifyContent:"flex-end",overflow:"hidden"}}>
        {pending && <div style={{fontFamily:FFM,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>{formatDisplay(pending.prev)} {pending.op}</div>}
        <div style={{fontFamily:FFM,fontWeight:500,fontSize:display.length>10?28:36,color:"#fff",letterSpacing:1,lineHeight:1,wordBreak:"break-all"}}>{display}</div>
      </div>
      {/* Keypad */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,flex:1,minHeight:0}}>
        {btn("AC",pressClear,acStyle)}
        {btn("±",pressSign)}
        {btn("%",pressPercent)}
        {btn("÷",()=>pressOp("÷"),opStyle)}
        {btn("7",()=>pressDigit("7"))}
        {btn("8",()=>pressDigit("8"))}
        {btn("9",()=>pressDigit("9"))}
        {btn("×",()=>pressOp("×"),opStyle)}
        {btn("4",()=>pressDigit("4"))}
        {btn("5",()=>pressDigit("5"))}
        {btn("6",()=>pressDigit("6"))}
        {btn("−",()=>pressOp("-"),opStyle)}
        {btn("1",()=>pressDigit("1"))}
        {btn("2",()=>pressDigit("2"))}
        {btn("3",()=>pressDigit("3"))}
        {btn("+",()=>pressOp("+"),opStyle)}
        {btn("0",()=>pressDigit("0"),{gridColumn:"span 2"})}
        {btn(".",()=>pressDigit("."))}
        {btn("=",pressEquals,{background:AC,border:"1px solid "+AC,color:"#fff"})}
        {btn("⌫",pressBackspace,{gridColumn:"span 4",height:42,fontSize:14,background:"rgba(255,255,255,0.03)"})}
      </div>
    </div>
  );
}

// Placeholders — each gets a real implementation below as we work through the list.

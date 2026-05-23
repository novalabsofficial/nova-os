import { useState, useRef } from "react";
import { FF, FFB } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

export function PdfApp({AC,showToast}){
  // We render PDFs via an <iframe> pointed at a blob: URL. The browser's
  // built-in PDF viewer handles paging, zoom, search, and print — no
  // external dependency needed. Trade-off: we can't customize the toolbar.
  const [url,setUrl]=useState(null);
  const [name,setName]=useState("");
  const inputRef=useRef(null);

  // Clean up the blob URL when a new file is loaded or the app closes,
  // otherwise the browser holds onto the file's memory indefinitely.
  useEffect(()=>()=>{ if(url) URL.revokeObjectURL(url); },[url]);

  function handleFile(e){
    const file=e.target.files?.[0];
    if(!file)return;
    if(file.type && file.type!=="application/pdf" && !file.name.toLowerCase().endsWith(".pdf")){
      showToast?.("Not a PDF file");
      e.target.value="";
      return;
    }
    if(url) URL.revokeObjectURL(url);
    const next=URL.createObjectURL(file);
    setUrl(next);
    setName(file.name);
    e.target.value="";
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",fontFamily:FF,minHeight:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={()=>inputRef.current?.click()} style={{padding:"8px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>📄 {url?"Open another":"Open PDF"}</button>
        {name && <span style={{fontFamily:FFM,fontSize:11,color:"rgba(255,255,255,0.55)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{name}</span>}
      </div>
      {url ? (
        <iframe
          src={url}
          title="pdf"
          style={{flex:1,width:"100%",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"#fff",minHeight:0}}/>
      ) : (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))",minHeight:0,padding:30,textAlign:"center"}}>
          <div style={{fontSize:48,opacity:0.55}}>📄</div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:18,color:"rgba(255,255,255,0.75)"}}>No PDF loaded</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",maxWidth:320,lineHeight:1.6}}>Open a PDF from your device. It opens in your browser's built-in viewer with paging, zoom, search, and print.</div>
          <button onClick={()=>inputRef.current?.click()} style={{marginTop:8,padding:"10px 18px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC}}>Browse files…</button>
        </div>
      )}
    </div>
  );
}
// Severity → swatch color for NWS alerts.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr, isUrl } from "../lib/format.js";
import { BOOKMARKS } from "../ui/constants.js";
import { BrowserNav } from "../ui/BrowserNav.jsx";
import { rewriteForIframe, isLikelyUnframable } from "../lib/browser.js";

export function BrowserApp({AC}){
  const [bar,setBar]=useState("");
  const [view,setView]=useState("home");
  const [results,setResults]=useState(null);
  const [frameUrl,setFrameUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [hist,setHist]=useState([]);
  const [hIdx,setHIdx]=useState(-1);
  // Bumped to force a fresh iframe mount on manual refresh. We can't call
  // iframe.contentWindow.location.reload() on cross-origin frames, so the
  // remount-via-key trick is the cleanest reload mechanism.
  const [reloadKey,setReloadKey]=useState(0);
  // Tracks whether the current iframe page has fired onLoad yet, so we can
  // show a thin progress bar at the top of the iframe while it's loading.
  const [framing,setFraming]=useState(false);

  // Whenever the URL or refresh key changes, the iframe will remount. Mark
  // it as loading until onLoad fires.
  useEffect(()=>{
    if(view==="browse"&&frameUrl&&!isLikelyUnframable(frameUrl))setFraming(true);
  },[frameUrl,reloadKey,view]);

  // Wrapper around rewriteForIframe + history bookkeeping. Centralized so
  // back/forward and bookmarks all flow through the same URL normalization.
  function browse(url){
    const full=rewriteForIframe(url);
    if(!full)return;
    const nh=[...hist.slice(0,hIdx+1),full];
    setHist(nh);setHIdx(nh.length-1);
    setFrameUrl(full);setBar(full);setView("browse");
  }
  async function novaSearch(q){setLoading(true);setView("results");setResults(null);try{const[d,w]=await Promise.allSettled([fetch("https://api.duckduckgo.com/?q="+encodeURIComponent(q)+"&format=json&no_html=1&skip_disambig=1").then(r=>r.json()),fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(q)+"&format=json&origin=*&srlimit=7").then(r=>r.json())]);setResults({q,ddg:d.status==="fulfilled"?d.value:null,wiki:w.status==="fulfilled"?w.value:null});}catch{setResults({q,ddg:null,wiki:null});}setLoading(false);}
  function go(i){const q=(i||bar).trim();if(!q)return;if(isUrl(q))browse(q);else novaSearch(q);}
  function back(){if(hIdx>0){const i=hIdx-1;setHIdx(i);setFrameUrl(hist[i]);setBar(hist[i]);setView("browse");}}
  function fwd(){if(hIdx<hist.length-1){const i=hIdx+1;setHIdx(i);setFrameUrl(hist[i]);setBar(hist[i]);setView("browse");}}
  function refresh(){
    if(view==="browse"&&frameUrl) setReloadKey(k=>k+1);
    else if(view==="results"&&results?.q) novaSearch(results.q);
  }

  // CRITICAL: do NOT extract this into a Shell sub-component defined inside
  // BrowserApp. Doing so creates a new component identity on every render,
  // which makes React unmount/remount the iframe — and re-fetch the page —
  // on every parent tick (the clock fires setTick every second, cascading
  // a re-render to here). That bug shipped in 4.3 originally; the fix is
  // to inline the layout in each branch below.

  const canRefresh = (view==="browse" && !!frameUrl) || (view==="results" && !!results?.q);
  const navProps={bar,setBar,onGo:()=>go(),onBack:back,onFwd:fwd,onRefresh:refresh,canBack:hIdx>0,canFwd:hIdx<hist.length-1,canRefresh,AC};

  const bookmarks=(
    <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap",flexShrink:0}}>
      {BOOKMARKS.map(b=>
        <button key={b.url} className="bp" onClick={()=>browse(b.url)} style={{padding:"4px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.6)"}}>{b.label}</button>
      )}
      <button className="bp" onClick={()=>window.open("https://www.bing.com","_blank","noopener,noreferrer")} style={{padding:"4px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.6)"}}>Bing ↗</button>
      <button className="bp" onClick={()=>window.open("https://www.google.com","_blank","noopener,noreferrer")} style={{padding:"4px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.6)"}}>Google ↗</button>
    </div>
  );

  if(view==="home"){
    return(
      <div style={{width:"100%",height:"100%",fontFamily:FF,display:"flex",flexDirection:"column",minHeight:0}}>
        <BrowserNav {...navProps}/>
        {bookmarks}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))",minHeight:0,padding:"30px 20px"}}>
          <div style={{fontSize:48,filter:"drop-shadow(0 0 18px rgba(79,158,255,0.35))"}}>🌐</div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"rgba(255,255,255,0.85)",letterSpacing:0.3}}>Nova Browser</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",lineHeight:1.75,maxWidth:420}}>
            Search with Nova Search (DDG + Wikipedia) or paste any URL.<br/>
            <span style={{color:"rgba(255,255,255,0.3)"}}>YouTube watch links auto-convert to embed mode so videos play in-app.</span>
          </div>
        </div>
      </div>
    );
  }

  if(view==="browse"){
    // X-Frame-Options / CSP can't be detected from JS for cross-origin iframes,
    // so we use a curated host list to predict failures and short-circuit to a
    // friendly card with an Open-in-new-tab button.
    const blocked=isLikelyUnframable(frameUrl);
    return(
      <div style={{width:"100%",height:"100%",fontFamily:FF,display:"flex",flexDirection:"column",minHeight:0}}>
        <BrowserNav {...navProps}/>
        {bookmarks}
        {blocked ? (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"30px 20px",textAlign:"center",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))",minHeight:0}}>
            <div style={{fontSize:48,opacity:0.55}}>🚫</div>
            <div style={{fontFamily:FFB,fontWeight:700,fontSize:18,color:"rgba(255,255,255,0.8)"}}>This site can't be embedded</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",maxWidth:440,lineHeight:1.7}}>
              <span style={{color:"rgba(255,255,255,0.75)",fontFamily:FFM,fontSize:11,wordBreak:"break-all"}}>{frameUrl}</span><br/>
              blocks framing via X-Frame-Options or CSP — a security feature enforced by your browser, not a Nova OS limitation.
            </div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setView("home")} style={{padding:"8px 16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.7)"}}>← Back</button>
              <button onClick={()=>window.open(frameUrl,"_blank","noopener,noreferrer")} style={{padding:"8px 16px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>Open in new tab ↗</button>
            </div>
          </div>
        ) : (
          <div style={{flex:1,minHeight:0,position:"relative",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,overflow:"hidden",background:"#fff"}}>
            {/* Thin progress bar at top of iframe while loading */}
            {framing && (
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"rgba(255,255,255,0.1)",zIndex:2}}>
                <div style={{height:"100%",width:"40%",background:AC,animation:"pulse 1.2s ease-in-out infinite"}}/>
              </div>
            )}
            <iframe
              key={frameUrl+":"+reloadKey}
              src={frameUrl}
              title="browser"
              onLoad={()=>setFraming(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              style={{width:"100%",height:"100%",border:"none",background:"#fff",display:"block"}}/>
          </div>
        )}
      </div>
    );
  }

  const ddg=results?.ddg;const wiki=results?.wiki;const ddgT=(ddg?.RelatedTopics||[]).filter(t=>t.FirstURL&&t.Text).slice(0,7);const wikiH=wiki?.query?.search||[];
  return(
    <div style={{width:"100%",height:"100%",fontFamily:FF,display:"flex",flexDirection:"column",minHeight:0}}>
      <BrowserNav {...navProps}/>
      {bookmarks}
      {loading?(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:12,flexDirection:"column",minHeight:0}}>
          <div style={{width:28,height:28,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Searching…</div>
        </div>
      ):(
        <div style={{flex:1,overflowY:"auto",minHeight:0}}>
          <div style={{...SEC,marginBottom:10}}>Results for "{results?.q}"</div>
          {ddg?.AbstractText&&<div style={{padding:"13px 14px",marginBottom:10,background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:AC,marginBottom:5}}>{ddg.Heading}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.65}}>{ddg.AbstractText}</div>{ddg.AbstractURL&&<a href={ddg.AbstractURL} target="_blank" rel="noreferrer" style={{fontSize:10,color:AC,opacity:0.7,marginTop:6,display:"inline-block",fontFamily:FFM}}>Source ↗</a>}</div>}
          {wikiH.length>0&&<><div style={SEC}>Wikipedia</div>{wikiH.map(h=><div key={h.pageid} className="sr" onClick={()=>browse("https://en.wikipedia.org/wiki/"+encodeURIComponent(h.title))} style={{padding:"10px 12px",marginBottom:5,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer"}}><div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:3}}>{h.title}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.55}}>{h.snippet?h.snippet.replace(/<[^>]*>/g,"")+"…":""}</div></div>)}</>}
          {ddgT.length>0&&<><div style={{...SEC,marginTop:10}}>Related</div>{ddgT.map((t,i)=><div key={i} className="sr" onClick={()=>browse(t.FirstURL)} style={{padding:"9px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,cursor:"pointer"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.55}}>{t.Text}</div><div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.2)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.FirstURL}</div></div>)}</>}
          {!ddg?.AbstractText&&wikiH.length===0&&ddgT.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic"}}>No results found.</div>}
        </div>
      )}
    </div>
  );
}

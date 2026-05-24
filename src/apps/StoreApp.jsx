import { useState, useEffect } from "react";
import { FF, FFB, FFM, INP, SEC, DEFAULT_AC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { APPS, STORE_CATALOG, STORE_CATS } from "../ui/constants.js";
import { AppIconDisplay } from "../ui/icons.jsx";
import { autoModerate, isAdmin, isPubliclyVisible } from "../lib/moderation.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { getDbUid } from "../lib/db.js";
import { openExternalUrl } from "../lib/openUrl.js";

export function Stars({appId, ratings, rateApp, ac}){
  const r=ratings[appId]||{avg:0,count:0,mine:0};
  const display=r.mine>0?r.mine:r.avg;
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
      {[1,2,3,4,5].map(s=>(
        <span key={s} onClick={e=>{e.stopPropagation();rateApp(appId,s);}}
          style={{cursor:"pointer",fontSize:15,color:s<=Math.round(display)?"#ffcc44":"rgba(255,255,255,0.18)",transition:"color 0.1s,transform 0.1s",lineHeight:1}}
          onMouseEnter={e=>e.target.style.transform="scale(1.25)"}
          onMouseLeave={e=>e.target.style.transform="scale(1)"}>
          ★
        </span>
      ))}
      {r.count>0&&<span style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.35)"}}>{r.avg.toFixed(1)} ({r.count})</span>}
      {r.count===0&&<span style={{fontSize:10,fontFamily:FF,color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>Rate this</span>}
      {r.mine>0&&<span style={{fontSize:9,fontFamily:FF,color:ac,opacity:0.8}}>your: {r.mine}★</span>}
    </div>
  );
}

export function AppCard({app, isIn, ac, ratings, rateApp, toggleInstall, currentUser, onDeleteApp}){
  // Only the user who submitted a community app can remove it from the store.
  // Official (catalog) apps have no `submitter`, so this is always false for them.
  // Defensive checks: submitter must be a non-empty string that matches the
  // current logged-in user exactly. The final authority is the re-fetch in
  // deleteApp — this just hides the button when it shouldn't be clickable.
  const canDeleteFromStore =
    typeof app.submitter === "string" && app.submitter.length > 0 &&
    typeof currentUser === "string" && currentUser.length > 0 &&
    app.submitter === currentUser;
  return(
    <div className="sc" style={{padding:"14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,display:"flex",flexDirection:"column",gap:0,transition:"background 0.12s"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:8}}>
        <div style={{width:44,height:44,borderRadius:10,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",fontSize:app.domain?undefined:22}}>
          {app.domain?<StoreIcon domain={app.domain} fallback={app.icon} size={32}/>:app.icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{app.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2,flexWrap:"wrap"}}>
            <span style={{fontSize:9,fontFamily:FFM,padding:"1px 6px",background:app.newTab?"rgba(255,180,0,0.12)":"rgba(79,200,100,0.12)",border:"1px solid "+(app.newTab?"rgba(255,180,0,0.3)":"rgba(79,200,100,0.3)"),borderRadius:4,color:app.newTab?"rgba(255,200,80,0.9)":"rgba(100,220,120,0.9)"}}>{app.badge||"↗ New Tab"}</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.28)"}}>{app.cat}</span>
            {app.submitter&&<span style={{fontSize:9,color:"rgba(255,255,255,0.22)",fontFamily:FFM}}>by @{app.submitter}</span>}
          </div>
          <Stars appId={app.id} ratings={ratings} rateApp={rateApp} ac={ac}/>
        </div>
        {canDeleteFromStore && (
          <button
            className="dl"
            onClick={()=>onDeleteApp(app)}
            title="Remove your submission from the store"
            style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.35)",fontSize:13,padding:"3px 6px",transition:"color 0.12s",flexShrink:0}}>🗑</button>
        )}
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.48)",lineHeight:1.5,marginBottom:10,flex:1}}>{app.desc}</div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>toggleInstall(app.id)} style={{flex:1,padding:"6px",background:isIn?"rgba(255,80,80,0.1)":"rgba(255,255,255,0.06)",border:"1px solid "+(isIn?"rgba(255,80,80,0.3)":"rgba(255,255,255,0.12)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:isIn?"rgba(255,130,130,0.9)":"rgba(255,255,255,0.6)"}}>{isIn?"– Remove":"+ Desktop"}</button>
        <button onClick={()=>openExternalUrl(app.url)} style={{flex:1,padding:"6px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:ac}}>Launch ↗</button>
      </div>
    </div>
  );
}

export function StoreApp({user,data,updateData,showToast,AC}){
  const ac=AC||DEFAULT_AC;
  const [tab,setTab]=useState("official");
  const [cat,setCat]=useState("All");
  const [search,setSearch]=useState("");
  const [ratings,setRatings]=useState({});
  const [commApps,setCommApps]=useState([]);
  const [loadingComm,setLoadingComm]=useState(true);
  const [sName,setSName]=useState(""); const [sUrl,setSUrl]=useState("");
  const [sDesc,setSDesc]=useState(""); const [sCat,setSCat]=useState("Tools");
  const [sIcon,setSIcon]=useState("🚀"); const [submitting,setSubmitting]=useState(false);
  const installed=data?.installedApps||[];
 
  // Real-time ratings from Firestore
  useEffect(()=>{
    const unsub=onSnapshot(collection(firestoreDb,"nova_ratings"),snap=>{
      const agg={};
      snap.docs.forEach(d=>{
        const r=d.data();
        if(!agg[r.appId])agg[r.appId]={total:0,count:0,mine:0};
        agg[r.appId].total+=r.rating; agg[r.appId].count++;
        if(r.user===user)agg[r.appId].mine=r.rating;
      });
      const out={};
      Object.entries(agg).forEach(([id,v])=>{out[id]={avg:v.total/v.count,count:v.count,mine:v.mine};});
      setRatings(out);
    },()=>{});
    return()=>unsub();
  },[user]);
 
  // Real-time community apps
  useEffect(()=>{
    const q=query(collection(firestoreDb,"nova_user_apps"),orderBy("ts","desc"),limit(60));
    const unsub=onSnapshot(q,snap=>{setCommApps(snap.docs.map(d=>({id:d.id,...d.data()})));setLoadingComm(false);},()=>setLoadingComm(false));
    return()=>unsub();
  },[]);
 
  async function rateApp(appId,rating){
    // v6.3: stamp uid so rules can verify the rating actually came from the
    // signed-in user (and not someone forging a different `user` field).
    try{await setDoc(doc(firestoreDb,"nova_ratings",appId+"_"+user),{appId,user,uid:getDbUid(),rating,ts:Date.now()});showToast("Rated "+rating+"★ ✓");}
    catch{showToast("Rating failed");}
  }
  async function submitApp(){
    const name=sName.trim(), desc=sDesc.trim();
    let url=sUrl.trim();
    if(!name||!url||!desc){showToast("All fields required");return;}
    if(!url.startsWith("http"))url="https://"+url;
    setSubmitting(true);
    // Run auto-filter. Flags don't block — they just decorate the queue entry
    // so admins can prioritize what to look at first.
    const autoFlags=autoModerate({name,desc,url});
    try{
      // v6.3: store submitterUid alongside the username display field so
      // rules can verify ownership for later updates/deletes.
      await addDoc(collection(firestoreDb,"nova_user_apps"),{
        name,url,desc,cat:sCat,icon:sIcon,submitter:user,submitterUid:getDbUid(),ts:Date.now(),
        newTab:true,badge:"↗ New Tab",
        status:"pending",autoFlags,reviewedBy:null,reviewedAt:null,rejectReason:null,
      });
      showToast(autoFlags.length>0
        ? "Submitted — flagged for review ⚠"
        : "Submitted — pending admin review ✓");
      setSName("");setSUrl("");setSDesc("");setSIcon("🚀");setTab("community");
    }catch{showToast("Submission failed");}
    setSubmitting(false);
  }

  async function approveApp(app){
    if(!isAdmin(user))return;
    try{
      await updateDoc(doc(firestoreDb,"nova_user_apps",app.id),{
        status:"approved",reviewedBy:user,reviewedAt:Date.now(),
      });
      showToast("Approved \""+app.name+"\" ✓");
    }catch{showToast("Approve failed");}
  }

  async function rejectApp(app){
    if(!isAdmin(user))return;
    const reason=window.prompt("Reject \""+app.name+"\" — optional reason (visible to submitter):","");
    if(reason===null)return; // user cancelled
    try{
      await updateDoc(doc(firestoreDb,"nova_user_apps",app.id),{
        status:"rejected",rejectReason:reason||null,reviewedBy:user,reviewedAt:Date.now(),
      });
      showToast("Rejected \""+app.name+"\"");
    }catch{showToast("Reject failed");}
  }
  function toggleInstall(appId){
    const isIn=installed.includes(appId);
    updateData(p=>({...p,installedApps:isIn?p.installedApps.filter(id=>id!==appId):[...(p.installedApps||[]),appId]}));
    showToast(isIn?"App removed":"Added to desktop ✓");
  }

  async function deleteApp(app){
    // Defense in depth: re-fetch the document so we check the AUTHORITATIVE
    // submitter from Firestore, not the prop (which could be stale or wrong).
    // The prop-level guard above the UI is the first gate; this is the second.
    if(!app?.id){showToast("Missing app id");return;}
    let fresh;
    try{
      const snap=await getDoc(doc(firestoreDb,"nova_user_apps",app.id));
      if(!snap.exists()){showToast("App already removed");return;}
      fresh=snap.data();
    }catch{showToast("Couldn't verify owner — try again");return;}
    if(!fresh.submitter||fresh.submitter!==user){
      showToast("Only @"+(fresh.submitter||"the submitter")+" can delete this app");
      return;
    }
    if(!window.confirm("Remove \""+(fresh.name||app.name)+"\" from the store? This can't be undone."))return;
    try{
      await deleteDoc(doc(firestoreDb,"nova_user_apps",app.id));
      showToast("App removed from store ✓");
    }catch{showToast("Delete failed");}
  }
 
  // Stars hoisted to module scope (above StoreApp).
 
  // AppCard hoisted to module scope (above StoreApp).
 
  const filtered=STORE_CATALOG.filter(a=>{
    if(cat!=="All"&&a.cat!==cat)return false;
    if(search&&!a.name.toLowerCase().includes(search.toLowerCase())&&!a.desc.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });
  const matchesSearch=a=>!search||a.name.toLowerCase().includes(search.toLowerCase())||a.desc.toLowerCase().includes(search.toLowerCase());
  // Community feed: only show approved (or legacy unstamped) apps. Pending/rejected are hidden from non-admins.
  const filtComm=commApps.filter(a=>isPubliclyVisible(a)&&matchesSearch(a));
  // Moderation queue: every app awaiting review. Only admins see this list.
  const modQueue=commApps.filter(a=>a.status==="pending");
  // The current user's own submissions, regardless of status, so they can track what they've sent in.
  const mySubmissions=commApps.filter(a=>a.submitter===user&&a.status&&a.status!=="approved");
  const userIsAdmin=isAdmin(user);
 
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      {/* Header + search */}
      <div style={{marginBottom:12}}>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"#fff",marginBottom:8}}>🏪 Nova Store 6.1</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search all apps…" style={INP}/>
      </div>
 
      {/* Tab bar */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:14}}>
        {[
          ["official","🏆 Official"],
          ["community","🌍 Community"+(filtComm.length>0?" ("+filtComm.length+")":"")],
          ["submit","+ Submit App"],
          ...(userIsAdmin?[["moderation","🛡 Moderation"+(modQueue.length>0?" ("+modQueue.length+")":"")]]:[]),
        ].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 14px",background:"none",border:"none",borderBottom:tab===id?"2px solid "+ac:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:tab===id?ac:"rgba(255,255,255,0.38)",transition:"all 0.15s",whiteSpace:"nowrap"}}>{lbl}</button>
        ))}
      </div>
 
      {/* Official tab */}
      {tab==="official"&&(<>
        <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
          {STORE_CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"4px 11px",background:cat===c?fill(ac):"rgba(255,255,255,0.06)",border:"1px solid "+(cat===c?bdr(ac):"rgba(255,255,255,0.1)"),borderRadius:20,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:cat===c?ac:"rgba(255,255,255,0.5)",transition:"all 0.12s"}}>{c}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:9}}>
          {filtered.map(app=><AppCard key={app.id} app={app} isIn={installed.includes(app.id)} ac={ac} ratings={ratings} rateApp={rateApp} toggleInstall={toggleInstall} currentUser={user} onDeleteApp={deleteApp}/>)}
          {filtered.length===0&&<div style={{gridColumn:"span 2",color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>No apps match.</div>}
        </div>
        {installed.length>0&&<div style={{marginTop:14,padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.35)"}}>{installed.length} app{installed.length!==1?"s":""} on desktop</div>}
      </>)}
 
      {/* Community tab */}
      {tab==="community"&&(<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Apps submitted by Nova users · click ★ to rate</span>
          <button onClick={()=>setTab("submit")} style={{padding:"5px 12px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:ac}}>+ Submit</button>
        </div>
        {/* Your submissions in moderation — only renders if you have any */}
        {mySubmissions.length>0&&(
          <div style={{marginBottom:14,padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8}}>
            <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:6,letterSpacing:0.5}}>YOUR SUBMISSIONS</div>
            {mySubmissions.map(a=>{
              const isPending=a.status==="pending";
              const badgeColor=isPending?"#ffcc44":"#ff7878";
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.7)"}}>
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                  <span style={{fontFamily:FFM,fontSize:10,padding:"1px 6px",borderRadius:4,background:"rgba("+hexRgb(badgeColor)+",0.15)",border:"1px solid "+badgeColor,color:badgeColor}}>{isPending?"Pending review":"Rejected"}</span>
                  {!isPending&&a.rejectReason&&<span style={{fontSize:11,fontStyle:"italic",color:"rgba(255,255,255,0.4)",marginLeft:6}}>"{a.rejectReason}"</span>}
                </div>
              );
            })}
          </div>
        )}
        {loadingComm&&<div style={{textAlign:"center",padding:"36px 0"}}><div style={{width:24,height:24,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:ac,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/></div>}
        {!loadingComm&&filtComm.length===0&&<div style={{color:"rgba(255,255,255,0.18)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>No community apps yet — be the first! 🚀</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:9}}>
          {filtComm.map(app=><AppCard key={app.id} app={app} isIn={installed.includes(app.id)} ac={ac} ratings={ratings} rateApp={rateApp} toggleInstall={toggleInstall} currentUser={user} onDeleteApp={deleteApp}/>)}
        </div>
      </>)}

      {/* Moderation tab — admins only */}
      {tab==="moderation"&&userIsAdmin&&(<>
        <div style={{marginBottom:12}}>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:14,color:"#fff"}}>🛡 Moderation Queue</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{modQueue.length} app{modQueue.length===1?"":"s"} awaiting review · red flags from auto-filter need extra attention</div>
        </div>
        {modQueue.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>Queue is empty — nothing to review 🎉</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {modQueue.map(app=>(
            <div key={app.id} style={{padding:"12px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{fontSize:24,flexShrink:0,lineHeight:1}}>{app.icon||"📦"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff"}}>{app.name}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>by @{app.submitter||"unknown"} · {app.cat||"Uncategorized"}</div>
                  <a href={app.url} target="_blank" rel="noreferrer" style={{fontSize:11,fontFamily:FFM,color:ac,textDecoration:"none",marginTop:3,display:"inline-block",wordBreak:"break-all"}}>{app.url}</a>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,lineHeight:1.5}}>{app.desc}</div>
                  {app.autoFlags&&app.autoFlags.length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                      {app.autoFlags.map((f,i)=>(
                        <span key={i} style={{fontSize:10,fontFamily:FFM,padding:"2px 7px",borderRadius:4,background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.4)",color:"#ff9898"}}>⚠ {f}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:"flex",gap:7,marginTop:11,justifyContent:"flex-end"}}>
                <button onClick={()=>rejectApp(app)} style={{padding:"6px 14px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,130,130,0.95)"}}>✕ Reject</button>
                <button onClick={()=>approveApp(app)} style={{padding:"6px 14px",background:"rgba(76,239,144,0.1)",border:"1px solid rgba(76,239,144,0.4)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"#4cef90"}}>✓ Approve</button>
              </div>
            </div>
          ))}
        </div>
      </>)}
 
      {/* Submit tab */}
      {tab==="submit"&&(
        <div style={{maxWidth:460}}>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>Submit Your App</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:18}}>Share any web app or website with the Nova community. It appears instantly in the Community tab.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:9}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{...SEC,marginBottom:0}}>Icon</label>
                <input value={sIcon} onChange={e=>setSIcon(e.target.value)} maxLength={2} style={{...INP,width:54,textAlign:"center",fontSize:22,padding:"6px 4px"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,flex:1}}>
                <label style={{...SEC,marginBottom:0}}>App Name</label>
                <input value={sName} onChange={e=>setSName(e.target.value)} placeholder="My Cool App" style={INP} maxLength={50}/>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{...SEC,marginBottom:0}}>URL</label>
              <input value={sUrl} onChange={e=>setSUrl(e.target.value)} placeholder="https://myapp.com" style={INP}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{...SEC,marginBottom:0}}>Description</label>
              <textarea value={sDesc} onChange={e=>setSDesc(e.target.value)} placeholder="What does your app do?" style={{...INP,minHeight:66}} maxLength={200}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{...SEC,marginBottom:0}}>Category</label>
              <select value={sCat} onChange={e=>setSCat(e.target.value)} style={{...INP,cursor:"pointer"}}>
                {["Games","Media","Tools","Social","News","Other"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={submitApp} disabled={submitting||!sName.trim()||!sUrl.trim()||!sDesc.trim()}
              style={{padding:"11px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:8,cursor:submitting?"default":"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:ac,opacity:submitting||!sName.trim()||!sUrl.trim()||!sDesc.trim()?0.4:1}}>
              {submitting?"Submitting…":"Submit App →"}
            </button>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic"}}>Submissions are public and visible to all Nova OS users. Keep it appropriate.</div>
          </div>
        </div>
      )}

      {/* Clearbit attribution — required by their Logo API terms */}
      <div style={{marginTop:16,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:10,fontFamily:FF,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>
        App logos provided by <a href="https://clearbit.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>Clearbit</a>
      </div>
    </div>
  );
}

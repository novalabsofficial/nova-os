import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream, deriveTitle as aiDeriveTitle } from "../lib/ai.js";
import { aiLoad, aiSave, AI_LS_KEYS, AI_LS_CONFIG, AI_LS_CHATS } from "../lib/ai-storage.js";

export function NovaAiApp({AC, showToast}){
  // Persistent state — loaded from localStorage at first render.
  const [keys, setKeys]       = useState(()=>aiLoad(AI_LS_KEYS, {claude:"", openai:""}));
  const [config, setConfig]   = useState(()=>aiLoad(AI_LS_CONFIG, {provider:"claude", model:{claude:AI_PROVIDERS.claude.defaultModel, openai:AI_PROVIDERS.openai.defaultModel}}));
  const [chats, setChats]     = useState(()=>aiLoad(AI_LS_CHATS, []));
  const [activeId, setActiveId] = useState(()=>chats[0]?.id || null);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");      // live-updating assistant text mid-stream
  const [error, setError]     = useState(null);
  const [view, setView]       = useState("chat");      // chat | settings — controls right-side panel
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef(null);

  // Persist on every change
  useEffect(()=>aiSave(AI_LS_KEYS, keys),     [keys]);
  useEffect(()=>aiSave(AI_LS_CONFIG, config), [config]);
  useEffect(()=>aiSave(AI_LS_CHATS, chats),   [chats]);

  // Scroll the message list to the bottom whenever it grows.
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight, behavior:"smooth"});}, [activeId, streamBuf, chats]);

  const provider = config.provider;
  const model    = config.model[provider] || AI_PROVIDERS[provider].defaultModel;
  const apiKey   = keys[provider] || "";
  const hasKey   = !!apiKey.trim();
  const active   = chats.find(c=>c.id===activeId) || null;

  function newChat(){
    setActiveId(null);
    setInput("");
    setError(null);
    setStreamBuf("");
  }
  function selectChat(id){
    setActiveId(id);
    setError(null);
    setStreamBuf("");
  }
  function deleteChat(id){
    setChats(prev=>prev.filter(c=>c.id!==id));
    if(id===activeId) setActiveId(null);
  }

  async function send(){
    const text = input.trim();
    if (!text || sending) return;
    if (!hasKey) { setError("Add your API key in Settings first."); setView("settings"); return; }

    setError(null);
    setSending(true);
    setInput("");
    setStreamBuf("");

    // Build/extend the conversation. If we're not in one yet, create it.
    let chatId = activeId;
    let chatMessages;
    if (!chatId) {
      const newId = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
      const newChatObj = {
        id: newId,
        title: aiDeriveTitle(text),
        provider, model,
        messages: [{role:"user", content:text}],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      setChats(prev=>[newChatObj, ...prev]);
      setActiveId(newId);
      chatId = newId;
      chatMessages = newChatObj.messages;
    } else {
      chatMessages = [...active.messages, {role:"user", content:text}];
      setChats(prev=>prev.map(c=>c.id===chatId?{...c,messages:chatMessages,updatedAt:Date.now()}:c));
    }

    let acc = "";
    try {
      for await (const chunk of aiStream(provider, model, apiKey, chatMessages)) {
        acc += chunk;
        setStreamBuf(acc);
      }
      // Stream finished — bake the assistant response into the chat record.
      setChats(prev=>prev.map(c=>c.id===chatId?{...c, messages:[...chatMessages,{role:"assistant",content:acc}], updatedAt:Date.now()}:c));
      setStreamBuf("");
    } catch (err) {
      // Surface API error; don't drop the user message (it's already saved).
      const msg = err?.message || "Request failed";
      setError(msg);
      setStreamBuf("");
    } finally {
      setSending(false);
    }
  }
  function onKey(e){
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Renders the message list area (right side of layout).
  function renderMessages(){
    if (view === "settings") return renderSettings();
    if (!active && streamBuf === "" && !sending) {
      return (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:30,textAlign:"center",minHeight:0}}>
          <div style={{fontSize:46,filter:"drop-shadow(0 0 18px rgba(168,85,247,0.4))"}}>✨</div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"rgba(255,255,255,0.85)"}}>Nova AI</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",maxWidth:380,lineHeight:1.7}}>
            Chat with <strong>{AI_PROVIDERS.claude.label}</strong> or <strong>{AI_PROVIDERS.openai.label}</strong> using your own API key.<br/>
            <span style={{color:"rgba(255,255,255,0.3)"}}>All requests go from your browser straight to the provider — Nova OS never sees your key or your messages.</span>
          </div>
          {!hasKey && (
            <button onClick={()=>setView("settings")} style={{padding:"10px 18px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC,marginTop:6}}>Add your API key</button>
          )}
        </div>
      );
    }
    const msgs = active?.messages || [];
    return (
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"14px 14px 18px",display:"flex",flexDirection:"column",gap:10,minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{
              maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",
              background:m.role==="user"?fill(AC):"rgba(255,255,255,0.05)",
              border:"1px solid "+(m.role==="user"?bdr(AC):"rgba(255,255,255,0.08)"),
              fontSize:13,color:"rgba(255,255,255,0.92)",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:FF,
            }}>{m.content}</div>
          </div>
        ))}
        {(streamBuf || sending) && (
          <div style={{display:"flex",justifyContent:"flex-start"}}>
            <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:"14px 14px 14px 4px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",fontSize:13,color:"rgba(255,255,255,0.92)",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:FF}}>
              {streamBuf || <span style={{opacity:0.5,fontStyle:"italic"}}>Thinking…</span>}
              {streamBuf && sending && <span style={{opacity:0.5,animation:"pulse 1s ease-in-out infinite"}}>▍</span>}
            </div>
          </div>
        )}
        {error && (
          <div style={{padding:"8px 12px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:7,fontSize:12,color:"#ff8b8b",fontFamily:FFM}}>⚠ {error}</div>
        )}
      </div>
    );
  }

  function renderSettings(){
    const p = AI_PROVIDERS[provider];
    return (
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",minHeight:0}}>
        <div style={SEC}>Provider</div>
        <div style={{display:"flex",gap:6,marginBottom:18}}>
          {Object.keys(AI_PROVIDERS).map(k=>(
            <button key={k} onClick={()=>setConfig(c=>({...c,provider:k}))} style={{flex:1,padding:"8px 12px",background:provider===k?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(provider===k?bdr(AC):"rgba(255,255,255,0.1)"),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,color:provider===k?AC:"rgba(255,255,255,0.7)"}}>{AI_PROVIDERS[k].label}</button>
          ))}
        </div>

        <div style={SEC}>API Key</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,lineHeight:1.55}}>
          Get a key from <a href={p.keyDocsUrl} target="_blank" rel="noreferrer" style={{color:AC}}>{p.keyDocsUrl.replace(/^https?:\/\//,"")}</a> — {p.keyHint}. Stored only in this browser's localStorage; never sent to Nova OS servers.
        </div>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <input
            type="password"
            value={apiKey}
            onChange={e=>setKeys(k=>({...k,[provider]:e.target.value}))}
            placeholder={"Paste your "+p.label+" API key"}
            style={{...INP,flex:1,fontFamily:FFM,fontSize:12}}
          />
          {apiKey && <button onClick={()=>setKeys(k=>({...k,[provider]:""}))} style={{padding:"7px 12px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"#ff8b8b"}}>Clear</button>}
        </div>
        <div style={{fontSize:10,color:hasKey?"#4cef90":"rgba(255,255,255,0.3)",marginBottom:20,fontFamily:FFM}}>{hasKey?"✓ Key saved locally":"No key yet"}</div>

        <div style={SEC}>Model</div>
        <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>
          {p.presetModels.map(m=>(
            <button key={m} onClick={()=>setConfig(c=>({...c,model:{...c.model,[provider]:m}}))} style={{padding:"5px 10px",background:model===m?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(model===m?bdr(AC):"rgba(255,255,255,0.08)"),borderRadius:6,cursor:"pointer",fontFamily:FFM,fontWeight:500,fontSize:10,color:model===m?AC:"rgba(255,255,255,0.6)"}}>{m}</button>
          ))}
        </div>
        <input
          value={model}
          onChange={e=>setConfig(c=>({...c,model:{...c.model,[provider]:e.target.value}}))}
          placeholder="Or type any model id…"
          style={{...INP,fontFamily:FFM,fontSize:11,marginBottom:22}}
        />

        <div style={SEC}>About</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.65,padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7}}>
          Nova AI runs entirely in your browser — your API key, model choice, and chat history live in <code style={{fontFamily:FFM,color:"#fff"}}>localStorage</code> on this device only.<br/><br/>
          Every API call goes directly from your browser to {AI_PROVIDERS.claude.label} or {AI_PROVIDERS.openai.label}. Nova OS and its operator pay nothing for your usage; you pay your provider's normal per-token rates.
        </div>

        <button onClick={()=>setView("chat")} style={{marginTop:18,width:"100%",padding:"10px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC}}>← Back to chat</button>
      </div>
    );
  }

  // Sidebar — chat list, hidden on mobile-narrow widths
  const sidebar = (
    <div style={{width:200,flexShrink:0,borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",minHeight:0,background:"rgba(0,0,0,0.15)"}}>
      <div style={{padding:"10px 10px 8px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        <button onClick={newChat} style={{width:"100%",padding:"8px 10px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,color:AC}}>＋ New chat</button>
      </div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"6px 6px"}}>
        {chats.length===0 ? (
          <div style={{padding:"14px 8px",fontSize:11,color:"rgba(255,255,255,0.3)",fontStyle:"italic",textAlign:"center"}}>No chats yet</div>
        ) : chats.map(c=>(
          <div key={c.id} onClick={()=>{selectChat(c.id);setView("chat");}} style={{padding:"7px 9px",marginBottom:3,borderRadius:6,cursor:"pointer",background:c.id===activeId?fill(AC):"transparent",border:"1px solid "+(c.id===activeId?bdr(AC):"transparent"),display:"flex",alignItems:"center",gap:6}}>
            <span style={{flex:1,minWidth:0,fontSize:11,color:c.id===activeId?AC:"rgba(255,255,255,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
            <button className="dl" onClick={e=>{e.stopPropagation();deleteChat(c.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.4)",fontSize:11,padding:"2px 4px",lineHeight:1}}>✕</button>
          </div>
        ))}
      </div>
      <div style={{padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0,fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.32)"}}>
        <div style={{marginBottom:2}}>{AI_PROVIDERS[provider].label} · {hasKey?"key set":"no key"}</div>
        <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{model}</div>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100%",fontFamily:FF,minHeight:0}}>
      {showSidebar && sidebar}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,minWidth:0}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
          <button onClick={()=>setShowSidebar(s=>!s)} title="Toggle sidebar" style={{width:30,height:30,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:14}}>☰</button>
          <div style={{flex:1,minWidth:0,fontFamily:FFB,fontWeight:700,fontSize:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {active ? active.title : "New chat"}
          </div>
          <button onClick={()=>setView(v=>v==="chat"?"settings":"chat")} title="Settings" style={{width:30,height:30,borderRadius:6,background:view==="settings"?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(view==="settings"?bdr(AC):"rgba(255,255,255,0.1)"),cursor:"pointer",color:view==="settings"?AC:"rgba(255,255,255,0.7)",fontSize:14}}>⚙</button>
        </div>

        {renderMessages()}

        {/* Input bar — hidden in settings */}
        {view === "chat" && (
          <div style={{display:"flex",gap:7,padding:"10px 12px 12px",borderTop:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={hasKey ? "Ask Nova AI… (Enter to send, Shift+Enter for newline)" : "Add your API key in Settings to start chatting"}
              rows={1}
              disabled={sending}
              style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.92)",fontFamily:FF,fontSize:13,outline:"none",resize:"none",minHeight:40,maxHeight:160,lineHeight:1.5,opacity:sending?0.5:1}}
            />
            <button onClick={send} disabled={sending||!input.trim()} style={{padding:"0 18px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:10,cursor:sending||!input.trim()?"default":"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC,opacity:sending||!input.trim()?0.4:1,whiteSpace:"nowrap"}}>{sending?"…":"Send"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { autoModerate, isAdmin } from "../lib/moderation.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

export function ChatApp({ user, AC }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [lastSent,  setLastSent]  = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
 
  // Subscribe to real-time messages
  useEffect(() => {
    const q = query(
      collection(firestoreDb, "nova_chat"),
      orderBy("ts", "asc"),
      limit(120)
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);
 
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
 
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    // Simple client-side rate limit: 1 message per 1.5 seconds
    const now = Date.now();
    if (now - lastSent < 1500) return;
    if (text.length > 500) return;
    setSending(true);
    setLastSent(now);
    setInput("");
    try {
      // Reset chat when the 120-message buffer is full. Wipes all existing
      // messages (visible to every user) before adding the new one. The
      // collection is shared, so any sender hitting the cap resets globally.
      if (messages.length >= 120) {
        await Promise.all(
          messages.map(m => deleteDoc(doc(firestoreDb, "nova_chat", m.id)))
        );
      }
      await addDoc(collection(firestoreDb, "nova_chat"), {
        user,
        text,
        ts: Date.now(),
      });
    } catch { /* silent */ }
    setSending(false);
    inputRef.current?.focus();
  }

  async function deleteMessage(id) {
    try {
      await deleteDoc(doc(firestoreDb, "nova_chat", id));
    } catch { /* silent — onSnapshot will refresh either way */ }
  }
 
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(ts) {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
 
  // Group messages by day for date separators
  const grouped = [];
  let lastDay = null;
  messages.forEach(msg => {
    const day = new Date(msg.ts).toDateString();
    if (day !== lastDay) { grouped.push({ type: "day", label: fmtDay(msg.ts), key: "day-"+msg.ts }); lastDay = day; }
    grouped.push({ type: "msg", ...msg });
  });
 
  // Unique color per user (deterministic from username)
  function userColor(name) {
    const colors = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa","#f97316","#06b6d4"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  }
 
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: FF }}>
 
      {/* Header */}
      <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "#888" : "#4cef90", flexShrink: 0, boxShadow: loading ? "none" : "0 0 6px #4cef90" }} />
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "#fff" }}>Nova Global Chat</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
            {loading ? "Connecting…" : messages.length + " messages"}
          </span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>
          All Nova OS users see this chat in real time · be respectful
        </div>
      </div>
 
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, flexDirection: "column" }}>
            <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading chat…</span>
          </div>
        )}
 
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic", margin: "auto" }}>
            No messages yet — say hello! 👋
          </div>
        )}
 
        {grouped.map(item => {
          if (item.type === "day") {
            return (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 6px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                <span style={{ fontFamily: FFB, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 0.8 }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              </div>
            );
          }
 
          const isMe = item.user === user;
          const uc = userColor(item.user);
 
          return (
            <div key={item.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 6 }}>
              {/* Username label (not for own messages) */}
              {!isMe && (
                <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 10, color: uc, marginBottom: 3, marginLeft: 2 }}>
                  @{item.user}
                </span>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMe ? "row-reverse" : "row" }}>
                {/* Avatar dot */}
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba("+hexRgb(uc)+",0.2)", border: "1.5px solid "+uc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginBottom: 2 }}>
                  {(item.user||"?")[0].toUpperCase()}
                </div>
                {/* Bubble */}
                <div style={{
                  maxWidth: "70%",
                  padding: "8px 12px",
                  borderRadius: isMe ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                  background: isMe ? "rgba("+hexRgb(AC)+",0.18)" : "rgba(255,255,255,0.06)",
                  border: "1px solid " + (isMe ? "rgba("+hexRgb(AC)+",0.45)" : "rgba(255,255,255,0.1)"),
                  fontSize: 13,
                  color: "rgba(255,255,255,0.92)",
                  lineHeight: 1.55,
                  wordBreak: "break-word",
                  fontFamily: FF,
                }}>
                  {item.text}
                </div>
                {/* Delete button — only on your own messages */}
                {isMe && (
                  <button
                    className="dl"
                    onClick={() => deleteMessage(item.id)}
                    title="Delete message"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(255,80,80,0.35)", fontSize: 12, padding: "2px 5px",
                      transition: "color 0.12s", flexShrink: 0, marginBottom: 2,
                    }}>✕</button>
                )}
              </div>
              {/* Timestamp */}
              <span style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.2)", marginTop: 2, marginLeft: isMe ? 0 : 28, marginRight: isMe ? 28 : 0 }}>
                {fmtTime(item.ts)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
 
      {/* Input bar */}
      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={"Message as @" + user + "  (Enter to send, Shift+Enter for newline)"}
          rows={1}
          maxLength={500}
          style={{ ...INP, flex: 1, resize: "none", minHeight: 38, maxHeight: 100, lineHeight: 1.5, overflow: "auto", fontSize: 13 }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{ padding: "9px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: sending || !input.trim() ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC, opacity: sending || !input.trim() ? 0.4 : 1, flexShrink: 0, height: 38 }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

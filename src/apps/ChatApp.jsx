// v7.3: Chat app now hosts both the global feed AND 1-on-1 DMs.
//
// Layout:
//   ┌──────────┬──────────────────────────┐
//   │ sidebar  │  active conversation     │
//   │  Global  │  ──────────────────────  │
//   │  DMs     │  messages                │
//   │   +new   │                          │
//   │   @bob   │  ──────────────────────  │
//   │   @cara  │  [ type a message... ]   │
//   └──────────┴──────────────────────────┘
//
// The "global" branch is the v6.x chat verbatim. The "dm" branch reuses the
// same message-bubble rendering on a per-thread message stream from
// nova_dm_threads/<id>/messages. A separate "new" view holds the
// "type a username" form.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { isAdmin } from "../lib/moderation.js";
import { doc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { getDbUid } from "../lib/db.js";
import { watchMyThreads, watchThreadMessages, openDmByUsername, sendDm, otherParticipantName } from "../lib/dms.js";

export function ChatApp({ user, AC }) {
  const myUid = getDbUid();
  const isMod = isAdmin(user);

  // ── View routing ─────────────────────────────────────────────────────
  // view: "global" | "dm" | "new"
  // active: { threadId, otherUsername } when view==="dm"
  const [view, setView]     = useState("global");
  const [active, setActive] = useState(null);

  // ── Global chat state (v6.x behavior, untouched semantically) ────────
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [lastSent,  setLastSent]  = useState(0);

  // ── DM state ─────────────────────────────────────────────────────────
  const [threads, setThreads]       = useState([]);   // sidebar list
  const [dmMessages, setDmMessages] = useState([]);   // active thread's messages
  const [newDmInput, setNewDmInput] = useState("");
  const [newDmError, setNewDmError] = useState("");
  const [opening, setOpening]       = useState(false); // resolving a new DM target

  // ── Shared composer state ────────────────────────────────────────────
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // ── Subscriptions ────────────────────────────────────────────────────
  // Global chat — single subscription, lives for the component's lifetime.
  useEffect(() => {
    const q = query(
      collection(firestoreDb, "nova_chat"),
      orderBy("ts", "asc"),
      limit(120)
    );
    const unsub = onSnapshot(q,
      snap => { setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // DM thread list — refreshes whenever someone (us or anyone else) sends a
  // new message into a thread we're a participant in. Re-subscribes if uid
  // changes (logout → login as someone else mid-session).
  useEffect(() => {
    if (!myUid) return;
    return watchMyThreads(myUid, setThreads);
  }, [myUid]);

  // Active DM thread's messages — subscribes only while we're viewing the
  // thread, drops the subscription when switching away.
  useEffect(() => {
    if (view !== "dm" || !active?.threadId) { setDmMessages([]); return; }
    return watchThreadMessages(active.threadId, setDmMessages);
  }, [view, active?.threadId]);

  // Autoscroll on new messages in whichever view is active.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, dmMessages, view]);

  // ── Sending ──────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const now = Date.now();
    if (now - lastSent < 1500) return;       // soft client-side rate limit
    if (text.length > 500) return;
    setSending(true);
    setLastSent(now);
    setInput("");
    try {
      if (view === "global") {
        // Global chat: same rolling 120-cap behavior as v6.x.
        if (messages.length >= 120) {
          await Promise.all(messages.map(m => deleteDoc(doc(firestoreDb, "nova_chat", m.id))));
        }
        await addDoc(collection(firestoreDb, "nova_chat"), {
          user, uid: myUid, text, ts: Date.now(),
        });
      } else if (view === "dm" && active?.threadId) {
        await sendDm(active.threadId, text, myUid, user);
      }
    } catch { /* silent — onSnapshot will refresh either way */ }
    setSending(false);
    inputRef.current?.focus();
  }

  // ── Deleting (own messages always; mods can delete anyone's) ─────────
  async function deleteGlobalMessage(id, authorName) {
    if (authorName && authorName !== user) {
      const ok = window.confirm(
        `Delete this message from @${authorName}?\n\nUse this only for content that breaks the TOS. The deletion is irreversible.`
      );
      if (!ok) return;
    }
    try { await deleteDoc(doc(firestoreDb, "nova_chat", id)); } catch {}
  }
  async function deleteDmMessage(msgId, authorName) {
    if (!active?.threadId) return;
    if (authorName && authorName !== user) {
      const ok = window.confirm(
        `Delete this message from @${authorName}?\n\nThe other user will see it disappear in real time. Irreversible.`
      );
      if (!ok) return;
    }
    try {
      await deleteDoc(doc(firestoreDb, "nova_dm_threads", active.threadId, "messages", msgId));
    } catch {}
  }

  // ── "Start a new DM" form action ─────────────────────────────────────
  async function startNewDm() {
    const name = newDmInput.trim();
    if (!name || opening) return;
    setOpening(true);
    setNewDmError("");
    try {
      const result = await openDmByUsername(name, myUid, user);
      setActive({ threadId: result.threadId, otherUsername: result.otherUsername });
      setView("dm");
      setNewDmInput("");
    } catch (e) {
      setNewDmError(e?.message || "Couldn't open DM.");
    }
    setOpening(false);
  }

  // ── Formatting helpers ───────────────────────────────────────────────
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(ts) {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function userColor(name) {
    const colors = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa","#f97316","#06b6d4"];
    let hash = 0;
    for (let i = 0; i < (name||"").length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  }

  // ── Build the grouped list for whichever view is showing ─────────────
  const activeMessages = view === "dm" ? dmMessages : messages;
  const grouped = [];
  let lastDay = null;
  activeMessages.forEach(msg => {
    const day = new Date(msg.ts).toDateString();
    if (day !== lastDay) { grouped.push({ type: "day", label: fmtDay(msg.ts), key: "day-"+msg.ts }); lastDay = day; }
    grouped.push({ type: "msg", ...msg });
  });

  // ── Header content varies by view ────────────────────────────────────
  const headerTitle  = view === "global" ? "Nova Global Chat"
                     : view === "dm"     ? "@" + (active?.otherUsername || "?")
                     : "New direct message";
  const headerSub    = view === "global" ? "All Nova OS users see this chat in real time · be respectful"
                     : view === "dm"     ? "Direct message · only you two can see this thread"
                     : "Type a username to start a 1-on-1 conversation";

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: FF, minHeight: 0 }}>

      {/* ───────── Sidebar ───────── */}
      <div style={{ width: 168, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.015)", minHeight: 0 }}>
        {/* Global entry */}
        <SidebarRow
          label="# Global"
          active={view === "global"}
          onClick={() => { setView("global"); setActive(null); }}
          AC={AC}
        />

        {/* DMs section header */}
        <div style={{ padding: "12px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...SEC, marginBottom: 0, fontSize: 9 }}>Direct Messages</span>
          <button
            onClick={() => { setView("new"); setActive(null); setNewDmError(""); }}
            title="Start a new DM"
            style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 4, background: view === "new" ? fill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (view === "new" ? bdr(AC) : "rgba(255,255,255,0.1)"), cursor: "pointer", color: view === "new" ? AC : "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, lineHeight: 1, padding: 0 }}
          >+</button>
        </div>

        {/* DM thread list — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
          {threads.length === 0 && (
            <div style={{ padding: "8px 8px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic", lineHeight: 1.5 }}>
              No DMs yet. Tap <strong style={{color:"rgba(255,255,255,0.5)"}}>+</strong> to start one.
            </div>
          )}
          {threads.map(t => {
            const other = otherParticipantName(t, myUid);
            const isActive = view === "dm" && active?.threadId === t.id;
            return (
              <DmRow
                key={t.id}
                username={other}
                preview={t.lastMessage}
                lastTs={t.lastTs}
                active={isActive}
                onClick={() => { setView("dm"); setActive({ threadId: t.id, otherUsername: other }); }}
                AC={AC}
              />
            );
          })}
        </div>
      </div>

      {/* ───────── Main pane ───────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: view === "global" ? (loading ? "#888" : "#4cef90") : "#4f9eff", flexShrink: 0, boxShadow: view === "global" && !loading ? "0 0 6px #4cef90" : "none" }} />
            <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headerTitle}</span>
            {isMod && (
              <span title="You're a moderator — you can delete any message" style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9, letterSpacing: 1, padding: "2px 7px", borderRadius: 4, background: "rgba(255,200,80,0.16)", border: "1px solid rgba(255,200,80,0.5)", color: "#ffd060" }}>MOD</span>
            )}
            {view === "global" && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                {loading ? "Connecting…" : messages.length + " messages"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{headerSub}</div>
        </div>

        {/* Body — either messages or the new-DM form */}
        {view === "new" ? (
          // ───── New DM form ─────
          <div style={{ flex: 1, padding: "30px 22px", overflow: "auto", minHeight: 0 }}>
            <div style={{ maxWidth: 360, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 48, textAlign: "center", lineHeight: 1, marginBottom: 4 }}>💬</div>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 18, color: "#fff", textAlign: "center" }}>Start a new DM</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.6 }}>
                Type any Nova OS user's name to begin a direct message. Only the two of you (and moderators) can see what you send.
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                <span style={{ display: "flex", alignItems: "center", padding: "0 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: FFM, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>@</span>
                <input
                  autoFocus
                  value={newDmInput}
                  onChange={e => setNewDmInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); startNewDm(); } }}
                  placeholder="username"
                  style={{ ...INP, flex: 1 }}
                />
                <button
                  onClick={startNewDm}
                  disabled={opening || !newDmInput.trim()}
                  style={{ padding: "9px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: opening || !newDmInput.trim() ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC, opacity: opening || !newDmInput.trim() ? 0.4 : 1, whiteSpace: "nowrap" }}
                >
                  {opening ? "Opening…" : "Start →"}
                </button>
              </div>
              {newDmError && (
                <div style={{ color: "#ff8b8b", fontSize: 12, textAlign: "center", padding: "8px 12px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 8 }}>⚠ {newDmError}</div>
              )}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center", fontStyle: "italic", marginTop: 6 }}>
                You can DM anyone with a Nova account. No friend request needed.
              </div>
            </div>
          </div>
        ) : (
          // ───── Messages list (global or DM) ─────
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
            {view === "global" && loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, flexDirection: "column" }}>
                <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading chat…</span>
              </div>
            )}

            {!loading && activeMessages.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic", margin: "auto" }}>
                {view === "dm" ? "No messages yet — say hi 👋" : "No messages yet — say hello! 👋"}
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
              const uc = userColor(item.user || "");
              const onDelete = view === "global"
                ? () => deleteGlobalMessage(item.id, item.user)
                : () => deleteDmMessage(item.id, item.user);

              return (
                <div key={item.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 6 }}>
                  {!isMe && view === "global" && (
                    <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 10, color: uc, marginBottom: 3, marginLeft: 2 }}>@{item.user}</span>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMe ? "row-reverse" : "row" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba("+hexRgb(uc)+",0.2)", border: "1.5px solid "+uc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginBottom: 2 }}>
                      {(item.user||"?")[0].toUpperCase()}
                    </div>
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
                    {(isMe || isMod) && (
                      <button
                        className="dl"
                        onClick={onDelete}
                        title={isMe ? "Delete message" : "Mod delete — TOS violation"}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: isMe ? "rgba(255,80,80,0.35)" : "rgba(255,200,80,0.6)",
                          fontSize: 12, padding: "2px 5px",
                          transition: "color 0.12s", flexShrink: 0, marginBottom: 2,
                        }}>{isMe ? "✕" : "🛡"}</button>
                    )}
                  </div>
                  <span style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.2)", marginTop: 2, marginLeft: isMe ? 0 : 28, marginRight: isMe ? 28 : 0 }}>
                    {fmtTime(item.ts)}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input bar — hidden when viewing the "new DM" form (no thread to send to yet) */}
        {view !== "new" && (
          <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={
                view === "global"
                  ? "Message as @" + user + "  (Enter to send, Shift+Enter for newline)"
                  : "Message @" + (active?.otherUsername || "...") + "  (Enter to send)"
              }
              rows={1}
              maxLength={500}
              style={{ ...INP, flex: 1, resize: "none", minHeight: 38, maxHeight: 100, lineHeight: 1.5, overflow: "auto", fontSize: 13 }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim() || (view === "dm" && !active)}
              style={{ padding: "9px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: sending || !input.trim() ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC, opacity: sending || !input.trim() ? 0.4 : 1, flexShrink: 0, height: 38 }}
            >↑</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar row components ───────────────────────────────────────────────
function SidebarRow({ label, active, onClick, AC }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "11px 14px",
        background: active ? fill(AC) : "transparent",
        border: "none",
        borderLeft: active ? "3px solid " + AC : "3px solid transparent",
        cursor: "pointer",
        fontFamily: FFB,
        fontWeight: 600,
        fontSize: 13,
        color: active ? AC : "rgba(255,255,255,0.85)",
        transition: "background 0.12s, color 0.12s",
        width: "100%",
      }}
    >{label}</button>
  );
}

function DmRow({ username, preview, lastTs, active, onClick, AC }) {
  return (
    <button
      onClick={onClick}
      title={username}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 1,
        textAlign: "left",
        padding: "8px 10px",
        margin: "2px 0",
        background: active ? "rgba("+hexRgb(AC)+",0.15)" : "transparent",
        border: "1px solid " + (active ? "rgba("+hexRgb(AC)+",0.35)" : "transparent"),
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: FF,
        width: "100%",
        transition: "background 0.12s",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", overflow: "hidden" }}>
        <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: active ? AC : "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          @{username}
        </span>
      </div>
      {preview && (
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", lineHeight: 1.3 }}>
          {preview}
        </span>
      )}
    </button>
  );
}

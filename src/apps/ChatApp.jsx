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
import { watchMyThreads, watchThreadMessages, openDmByUsername, sendDm, otherParticipantName, setTyping } from "../lib/dms.js";
import { subscribeAllReactions, aggregateReactions, toggleReaction, REACTION_PRESETS } from "../lib/chat-reactions.js";

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

  // v9.4 — Reactions on global chat. Flat list from the
  // `nova_chat_reactions` subscription, aggregated per-message at render
  // time. `pickerOpenFor` = msgId for the message whose "+ react" picker
  // is currently expanded (only one at a time).
  const [reactions, setReactions] = useState([]);
  const [pickerOpenFor, setPickerOpenFor] = useState(null);
  useEffect(() => subscribeAllReactions(setReactions), []);
  const reactionMap = aggregateReactions(reactions);

  // v9.4 — DM typing indicator. Each keystroke in the input bumps the
  // current user's typing field on the active thread doc. Debounced so
  // we write at most once per 2 s. The other participant's watchMyThreads
  // subscription sees the update in real time and renders
  // "@you is typing…" in the header.
  const lastTypingWriteRef = useRef(0);
  function bumpTyping() {
    if (view !== "dm" || !active?.threadId || !myUid) return;
    const now = Date.now();
    if (now - lastTypingWriteRef.current < 2000) return;
    lastTypingWriteRef.current = now;
    setTyping(active.threadId, myUid, user);
  }

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
  // v9.2: Discord-style consecutive-message grouping. If the next message is
  // from the same user within 7 minutes, mark it `grouped: true` so the
  // renderer skips the avatar/name/timestamp header and just renders the
  // text — matches the Discord "messages from the same person stack" feel.
  const activeMessages = view === "dm" ? dmMessages : messages;
  const grouped = [];
  let lastDay = null;
  let lastUser = null;
  let lastTs = 0;
  activeMessages.forEach(msg => {
    const day = new Date(msg.ts).toDateString();
    if (day !== lastDay) { grouped.push({ type: "day", label: fmtDay(msg.ts), key: "day-"+msg.ts }); lastDay = day; lastUser = null; }
    const isGrouped = msg.user === lastUser && (msg.ts - lastTs) < 7 * 60 * 1000;
    grouped.push({ type: "msg", ...msg, grouped: isGrouped });
    lastUser = msg.user;
    lastTs = msg.ts;
  });

  // ── Header content varies by view ────────────────────────────────────
  const headerTitle  = view === "global" ? "Nova Global Chat"
                     : view === "dm"     ? "@" + (active?.otherUsername || "?")
                     : "New direct message";
  // v9.4 — if the other DM participant has bumped `typing` in the last
  // 5 seconds, show that in place of the static DM subtitle.
  const activeThread = view === "dm" && active?.threadId ? threads.find(t => t.id === active.threadId) : null;
  const typingNow = activeThread && activeThread.typing
                    && activeThread.typing.uid !== myUid
                    && (Date.now() - (activeThread.typing.ts || 0) < 5000);
  const headerSub    = view === "global" ? "All Nova OS users see this chat in real time · be respectful"
                     : view === "dm"     ? (typingNow ? "@" + (activeThread.typing.user || active.otherUsername) + " is typing…" : "Direct message · only you two can see this thread")
                     : "Type a username to start a 1-on-1 conversation";

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: FF, minHeight: 0 }}>

      {/* ───────── Sidebar (v9.2 — wider, Discord-style) ───────── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--nv-border)", display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", minHeight: 0 }}>
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
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 8px" }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    <span style={{ fontFamily: FFB, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 1, padding: "2px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>{item.label}</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  </div>
                );
              }

              const isMe = item.user === user;
              const uc = userColor(item.user || "");
              const onDelete = view === "global"
                ? () => deleteGlobalMessage(item.id, item.user)
                : () => deleteDmMessage(item.id, item.user);

              // v9.2 — Discord-style flat, left-aligned messages. Grouped
              // consecutive messages from the same sender skip the
              // avatar/name header and just render the text body (with a
              // hover timestamp on the left margin).
              // v9.4 — reactions are global-chat only for now; DM reactions
              // will follow once the DM thread subcollection rule is in.
              const showReactions = view === "global";
              const reactBtn = showReactions ? (
                <button
                  className="rowact"
                  onClick={() => setPickerOpenFor(prev => prev === item.id ? null : item.id)}
                  title="Add reaction"
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "2px 6px", flexShrink: 0, opacity: pickerOpenFor === item.id ? 1 : 0, transition: "opacity 0.12s" }}
                >🙂</button>
              ) : null;

              if (item.grouped) {
                return (
                  <div key={item.id} className="msgrow" style={{ display: "flex", padding: "1px 8px", borderRadius: 4, flexDirection: "column" }}>
                    <div style={{ display: "flex" }}>
                      {/* avatar gutter — empty for grouped messages; the timestamp appears here on hover */}
                      <div className="ts-hover" style={{ width: 40, flexShrink: 0, fontFamily: FFM, fontSize: 9.5, color: "transparent", paddingTop: 4, textAlign: "center", transition: "color 0.12s" }}>
                        {fmtTime(item.ts)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <div style={{ flex: 1, fontSize: 14, color: "var(--nv-text)", lineHeight: 1.55, wordBreak: "break-word", fontFamily: FF }}>{item.text}</div>
                        {reactBtn}
                        {(isMe || isMod) && (
                          <button
                            className="dl rowact"
                            onClick={onDelete}
                            title={isMe ? "Delete message" : "Mod delete — TOS violation"}
                            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", color: isMe ? "rgba(255,80,80,0.6)" : "rgba(255,200,80,0.7)", fontSize: 11, padding: "2px 6px", flexShrink: 0, opacity: 0, transition: "opacity 0.12s" }}
                          >{isMe ? "✕" : "🛡"}</button>
                        )}
                      </div>
                    </div>
                    {showReactions && (
                      <ReactionsRow
                        msgId={item.id}
                        bag={reactionMap[item.id]}
                        myUid={myUid}
                        user={user}
                        pickerOpen={pickerOpenFor === item.id}
                        onClosePicker={() => setPickerOpenFor(null)}
                        ac={AC}
                        gutter={40}
                      />
                    )}
                  </div>
                );
              }

              // Fresh message (first of a group) — full avatar + name + timestamp header.
              return (
                <div key={item.id} className="msgrow" style={{ display: "flex", padding: "5px 8px", borderRadius: 4, marginTop: 8, flexDirection: "column" }}>
                  <div style={{ display: "flex" }}>
                    <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 1 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `rgba(${hexRgb(uc)},0.22)`, border: `1.5px solid ${uc}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "#fff" }}>
                        {(item.user || "?")[0].toUpperCase()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13.5, color: uc }}>@{item.user || "unknown"}</span>
                        <span style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)" }}>{fmtTime(item.ts)}</span>
                        {isMe && <span style={{ fontFamily: FFB, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `rgba(${hexRgb(AC)},0.16)`, border: `1px solid rgba(${hexRgb(AC)},0.32)`, color: AC, letterSpacing: 0.5 }}>YOU</span>}
                        <div style={{ flex: 1 }} />
                        {reactBtn}
                        {(isMe || isMod) && (
                          <button
                            className="dl rowact"
                            onClick={onDelete}
                            title={isMe ? "Delete message" : "Mod delete — TOS violation"}
                            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", color: isMe ? "rgba(255,80,80,0.6)" : "rgba(255,200,80,0.7)", fontSize: 11, padding: "2px 6px", opacity: 0, transition: "opacity 0.12s" }}
                          >{isMe ? "✕" : "🛡"}</button>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: "var(--nv-text)", lineHeight: 1.55, wordBreak: "break-word", fontFamily: FF, marginTop: 2 }}>{item.text}</div>
                    </div>
                  </div>
                  {showReactions && (
                    <ReactionsRow
                      msgId={item.id}
                      bag={reactionMap[item.id]}
                      myUid={myUid}
                      user={user}
                      pickerOpen={pickerOpenFor === item.id}
                      onClosePicker={() => setPickerOpenFor(null)}
                      ac={AC}
                      gutter={40}
                    />
                  )}
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
              onChange={e => { setInput(e.target.value); bumpTyping(); }}
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

// ── Sidebar row components (v9.2 — Discord-style) ─────────────────────────
function SidebarRow({ label, active, onClick, AC }) {
  return (
    <button
      onClick={onClick}
      className="fr"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
        margin: "0 8px",
        padding: "9px 11px",
        background: active ? fill(AC) : "transparent",
        border: "1px solid " + (active ? bdr(AC) : "transparent"),
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: FFB,
        fontWeight: 600,
        fontSize: 13,
        color: active ? AC : "var(--nv-text)",
        transition: "background 0.12s, color 0.12s",
        width: "calc(100% - 16px)",
      }}
    >
      <span style={{ fontFamily: FFM, fontSize: 16, opacity: active ? 1 : 0.6, lineHeight: 1, flexShrink: 0 }}>#</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label.replace(/^#\s*/, "")}</span>
    </button>
  );
}

function DmRow({ username, preview, lastTs, active, onClick, AC }) {
  const uc = (() => {
    // Same colorer used in the message list; pair the avatar to the user.
    const palette = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa","#f97316","#06b6d4"];
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffffff;
    return palette[Math.abs(h) % palette.length];
  })();
  return (
    <button
      onClick={onClick}
      title={username}
      className="fr"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
        padding: "8px 10px",
        margin: "1px 0",
        background: active ? "rgba("+hexRgb(AC)+",0.16)" : "transparent",
        border: "1px solid " + (active ? "rgba("+hexRgb(AC)+",0.35)" : "transparent"),
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: FF,
        width: "100%",
        transition: "background 0.12s",
        overflow: "hidden",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: `rgba(${hexRgb(uc)},0.22)`, border: `1.5px solid ${uc}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "#fff",
      }}>{(username || "?")[0].toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: active ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @{username}
        </div>
        {preview && (
          <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35, marginTop: 1 }}>
            {preview}
          </div>
        )}
      </div>
    </button>
  );
}

// v9.4 — Reactions row for a single message. Renders existing reaction
// counts (one chip per emoji) and, when the inline picker is open for
// this message, a row of preset emoji choices. Both clicking an existing
// chip and clicking a preset call `toggleReaction` — same path, either
// adds or removes your reaction.
function ReactionsRow({ msgId, bag, myUid, user, pickerOpen, onClosePicker, ac, gutter = 40 }) {
  const emojis = bag ? Object.keys(bag) : [];
  if (emojis.length === 0 && !pickerOpen) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5, marginLeft: gutter + 8, marginRight: 8 }}>
      {emojis.map(emoji => {
        const list = bag[emoji] || [];
        const mine = list.some(u => u.uid === myUid);
        const names = list.map(u => "@" + (u.user || "?")).join(", ");
        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(msgId, emoji, myUid, user)}
            title={names}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 12, cursor: "pointer",
              background: mine ? "rgba(" + hexRgb(ac) + ",0.18)" : "rgba(255,255,255,0.05)",
              border: "1px solid " + (mine ? "rgba(" + hexRgb(ac) + ",0.42)" : "rgba(255,255,255,0.1)"),
              color: mine ? ac : "var(--nv-text)",
              fontFamily: FFM, fontSize: 11.5, lineHeight: 1.2,
              transition: "background 0.12s, border-color 0.12s",
            }}
          >
            <span style={{ fontSize: 13 }}>{emoji}</span>
            <span style={{ fontWeight: 600 }}>{list.length}</span>
          </button>
        );
      })}
      {pickerOpen && (
        <div style={{ display: "inline-flex", gap: 3, padding: "2px 6px", borderRadius: 14, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {REACTION_PRESETS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { toggleReaction(msgId, emoji, myUid, user); onClosePicker(); }}
              title={"React with " + emoji}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px", lineHeight: 1 }}
            >{emoji}</button>
          ))}
          <button onClick={onClosePicker} title="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 12, padding: "2px 4px" }}>✕</button>
        </div>
      )}
    </div>
  );
}

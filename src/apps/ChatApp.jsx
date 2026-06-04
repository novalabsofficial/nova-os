// v7.3: Chat app hosts global feed + DMs.
// v9.4: Reactions on global chat + DM typing indicator.
// v9.5: User-created servers (Discord-style). The sidebar now has three
//       sections — Global, Servers (with channel sublists), and DMs.
//       Plus DM reactions, mirroring the global-chat ones.
//
// Layout:
//   ┌──────────┬──────────────────────────┐
//   │ sidebar  │  active conversation     │
//   │  Global  │  ──────────────────────  │
//   │  Servers │  messages                │
//   │   #ch1   │                          │
//   │   #ch2   │  ──────────────────────  │
//   │  DMs     │  [ type a message... ]   │
//   └──────────┴──────────────────────────┘

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { isAdmin } from "../lib/moderation.js";
import { doc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { getDbUid } from "../lib/db.js";
import { watchMyThreads, watchThreadMessages, openDmByUsername, sendDm, otherParticipantName, setTyping } from "../lib/dms.js";
import {
  subscribeAllReactions, aggregateReactions, toggleReaction,
  toggleDmReaction, subscribeDmReactions,
  toggleServerReaction, subscribeServerReactions,
  REACTION_PRESETS,
} from "../lib/chat-reactions.js";
import {
  watchMyServers, watchServerMessages,
  createServer, joinServer, leaveServer, deleteServer,
  renameServer, addChannel, removeChannel, regenerateInvite,
  sendServerMessage, deleteServerMessage, resolveInvite,
  setNickname, setMemberRole, kickMember, ensureMembersMap,
  memberDisplayName, memberRole,
  ROLE_OWNER, ROLE_ADMIN, ROLE_MEMBER,
} from "../lib/servers.js";

import { novaConfirm } from "../ui/dialogs.jsx";

export function ChatApp({ user, AC, data, updateData }) {
  const myUid = getDbUid();
  const isMod = isAdmin(user);

  // ── View routing ─────────────────────────────────────────────────────
  // view: "global" | "dm" | "new" | "server" | "newserver" | "joinserver"
  // active varies by view:
  //   dm:     { threadId, otherUsername }
  //   server: { serverId, channelId }
  const [view, setView]     = useState("global");
  const [active, setActive] = useState(null);

  // Sidebar disclosure state — which joined servers are showing channels.
  const [serverOpen, setServerOpen] = useState({}); // { [serverId]: true }

  // ── Global chat state ────────────────────────────────────────────────
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [lastSent,  setLastSent]  = useState(0);

  // ── DM state ─────────────────────────────────────────────────────────
  const [threads, setThreads]       = useState([]);
  const [dmMessages, setDmMessages] = useState([]);
  const [newDmInput, setNewDmInput] = useState("");
  const [newDmError, setNewDmError] = useState("");
  const [opening, setOpening]       = useState(false);

  // ── Server state ─────────────────────────────────────────────────────
  const [servers, setServers]     = useState([]);
  const [serverMsgs, setServerMsgs] = useState([]);
  // Inline modal payload for the "create/join server" flows. {} means closed.
  const [serverModal, setServerModal] = useState({ kind: null });
  // Owner UI: managing the active server (rename, channels, invite, delete).
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  // ── Shared composer state ────────────────────────────────────────────
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState(null);   // v10.8 @-mention autocomplete
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // v10.8 — @mention autocomplete. Candidates = people in the current
  // conversation (message authors + server roster + the DM partner).
  function mentionCandidates() {
    const set = new Set();
    messages.forEach(m => { if (m.user) set.add(m.user); });
    if (view === "server" && activeServer) {
      (activeServer.memberUids || []).forEach((uid, i) => {
        const u = (activeServer.members && activeServer.members[uid] && activeServer.members[uid].user) || (activeServer.memberUsernames && activeServer.memberUsernames[i]);
        if (u) set.add(u);
      });
    }
    if (view === "dm" && active && active.otherUsername) set.add(active.otherUsername);
    set.delete(user);
    return [...set];
  }
  function computeMention(value, caret) {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@(\w{0,20})$/);
    if (!m) { setMention(null); return; }
    const token = m[2].toLowerCase();
    const items = mentionCandidates().filter(u => u.toLowerCase().startsWith(token)).slice(0, 6);
    if (!items.length) { setMention(null); return; }
    setMention({ items, active: 0, start: caret - m[2].length - 1, end: caret });
  }
  function pickMention(username) {
    if (!mention) return;
    const at = mention.start, end = mention.end;
    setInput(input.slice(0, at) + "@" + username + " " + input.slice(end));
    setMention(null);
    requestAnimationFrame(() => { const el = inputRef.current; if (el) { const pos = at + username.length + 2; el.focus(); el.setSelectionRange(pos, pos); } });
  }

  // ── Reactions ────────────────────────────────────────────────────────
  // Global chat reactions — flat list, aggregated per-message at render.
  const [reactions, setReactions] = useState([]);
  const [pickerOpenFor, setPickerOpenFor] = useState(null);
  useEffect(() => subscribeAllReactions(setReactions), []);
  const reactionMap = aggregateReactions(reactions);

  // DM reactions — separate subscription per active thread (cheap; one
  // thread at a time). v9.5.
  const [dmReactions, setDmReactions] = useState([]);
  useEffect(() => {
    if (view !== "dm" || !active?.threadId) { setDmReactions([]); return; }
    return subscribeDmReactions(active.threadId, setDmReactions);
  }, [view, active?.threadId]);
  const dmReactionMap = aggregateReactions(dmReactions);

  // Server reactions — subscription per active server. v9.6.
  const [serverReactions, setServerReactions] = useState([]);
  useEffect(() => {
    if (view !== "server" || !active?.serverId) { setServerReactions([]); return; }
    return subscribeServerReactions(active.serverId, setServerReactions);
  }, [view, active?.serverId]);
  const serverReactionMap = aggregateReactions(serverReactions);

  // ── DM typing indicator ──────────────────────────────────────────────
  const lastTypingWriteRef = useRef(0);
  function bumpTyping() {
    if (view !== "dm" || !active?.threadId || !myUid) return;
    const now = Date.now();
    if (now - lastTypingWriteRef.current < 2000) return;
    lastTypingWriteRef.current = now;
    setTyping(active.threadId, myUid, user);
  }

  // ── Subscriptions ────────────────────────────────────────────────────
  // Global chat
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

  // DM threads
  useEffect(() => {
    if (!myUid) return;
    return watchMyThreads(myUid, setThreads);
  }, [myUid]);

  // Active DM thread messages
  useEffect(() => {
    if (view !== "dm" || !active?.threadId) { setDmMessages([]); return; }
    return watchThreadMessages(active.threadId, setDmMessages);
  }, [view, active?.threadId]);

  // Joined servers
  useEffect(() => {
    if (!myUid) return;
    return watchMyServers(myUid, setServers);
  }, [myUid]);

  // Active server channel messages
  useEffect(() => {
    if (view !== "server" || !active?.serverId) { setServerMsgs([]); return; }
    return watchServerMessages(active.serverId, active.channelId, setServerMsgs);
  }, [view, active?.serverId, active?.channelId]);

  // Autoscroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, dmMessages, serverMsgs, view]);

  // If the user gets kicked / leaves the active server in another tab,
  // bail out of that view so we don't show stale messages from a server
  // they no longer belong to.
  useEffect(() => {
    if (view !== "server" || !active?.serverId) return;
    if (!servers.find(s => s.id === active.serverId)) {
      setView("global"); setActive(null);
    }
  }, [servers, view, active?.serverId]);

  // v9.6 — when the OWNER opens a legacy (v9.5) server with no members
  // map, backfill it so roles + nicknames work. No-op otherwise.
  useEffect(() => {
    if (view !== "server" || !active?.serverId) return;
    const s = servers.find(x => x.id === active.serverId);
    if (s) ensureMembersMap(s, myUid);
  }, [view, active?.serverId, servers, myUid]);

  // ── v9.6 — unread tracking for DMs ───────────────────────────────────
  // `data.lastRead` maps a conversation key → last-read timestamp. We mark
  // the active DM thread read whenever its messages change while it's open.
  const lastRead = data?.lastRead || {};
  useEffect(() => {
    if (view !== "dm" || !active?.threadId) return;
    const t = threads.find(x => x.id === active.threadId);
    const newest = t?.lastTs || 0;
    if (newest && (lastRead["dm:" + active.threadId] || 0) < newest) {
      updateData?.(p => ({ ...p, lastRead: { ...(p.lastRead || {}), ["dm:" + active.threadId]: Date.now() } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, active?.threadId, dmMessages, threads]);

  // Is a DM thread unread? Unread = it has a newer message than we've read
  // AND the last message wasn't sent by us.
  function isThreadUnread(t) {
    if (!t || !t.lastTs) return false;
    if (t.lastSenderUid === myUid) return false;
    return (lastRead["dm:" + t.id] || 0) < t.lastTs;
  }
  const unreadDmCount = threads.filter(isThreadUnread).length;

  // v9.6 — server unread: a server has unread activity if its
  // lastActivityTs is newer than we've read AND the last message wasn't
  // ours. (Channel-level granularity is deferred — server-level is the
  // useful signal.)
  function isServerUnread(s) {
    if (!s || !s.lastActivityTs) return false;
    if (s.lastSenderUid === myUid) return false;
    return (lastRead["server:" + s.id] || 0) < s.lastActivityTs;
  }
  // Mark the active server read while we're viewing any of its channels.
  useEffect(() => {
    if (view !== "server" || !active?.serverId) return;
    const s = servers.find(x => x.id === active.serverId);
    const newest = s?.lastActivityTs || 0;
    if (newest && (lastRead["server:" + active.serverId] || 0) < newest) {
      updateData?.(p => ({ ...p, lastRead: { ...(p.lastRead || {}), ["server:" + active.serverId]: Date.now() } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, active?.serverId, serverMsgs, servers]);

  // ── Active context shortcuts ─────────────────────────────────────────
  const activeServer = view === "server" && active?.serverId
    ? servers.find(s => s.id === active.serverId) || null
    : null;
  const isServerOwner = !!(activeServer && activeServer.ownerUid === myUid);
  const activeChannel = activeServer
    ? (activeServer.channels || []).find(c => c.id === active.channelId) || activeServer.channels?.[0]
    : null;

  // ── Sending ──────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const now = Date.now();
    if (now - lastSent < 1500) return;
    if (text.length > 500) return;
    setSending(true);
    setLastSent(now);
    setInput("");
    try {
      if (view === "global") {
        if (messages.length >= 120) {
          await Promise.all(messages.map(m => deleteDoc(doc(firestoreDb, "nova_chat", m.id))));
        }
        await addDoc(collection(firestoreDb, "nova_chat"), {
          user, uid: myUid, text, ts: Date.now(),
        });
      } else if (view === "dm" && active?.threadId) {
        await sendDm(active.threadId, text, myUid, user);
      } else if (view === "server" && active?.serverId) {
        await sendServerMessage(active.serverId, active.channelId || "general", text, myUid, user);
      }
    } catch { /* silent — onSnapshot will refresh either way */ }
    setSending(false);
    inputRef.current?.focus();
  }

  // ── Deleting ─────────────────────────────────────────────────────────
  async function deleteGlobalMessage(id, authorName) {
    if (authorName && authorName !== user) {
      if (!(await novaConfirm({ title: "Delete message", message: `Delete this message from @${authorName}?\n\nUse this only for content that breaks the TOS.`, danger: true, confirmText: "Delete", accent: AC }))) return;
    }
    try { await deleteDoc(doc(firestoreDb, "nova_chat", id)); } catch {}
  }
  async function deleteDmMessage(msgId, authorName) {
    if (!active?.threadId) return;
    if (authorName && authorName !== user) {
      if (!(await novaConfirm({ title: "Delete message", message: `Delete this message from @${authorName}?\n\nThe other user will see it disappear in real time.`, danger: true, confirmText: "Delete", accent: AC }))) return;
    }
    try { await deleteDoc(doc(firestoreDb, "nova_dm_threads", active.threadId, "messages", msgId)); } catch {}
  }
  async function deleteServerMsg(msgId, authorName) {
    if (!active?.serverId) return;
    if (authorName && authorName !== user) {
      if (!(await novaConfirm({ title: "Delete message", message: `Delete this message from @${authorName}?`, danger: true, confirmText: "Delete", accent: AC }))) return;
    }
    try { await deleteServerMessage(active.serverId, msgId); } catch {}
  }

  // ── New DM ───────────────────────────────────────────────────────────
  async function startNewDm() {
    const name = newDmInput.trim();
    if (!name || opening) return;
    setOpening(true); setNewDmError("");
    try {
      const result = await openDmByUsername(name, myUid, user);
      setActive({ threadId: result.threadId, otherUsername: result.otherUsername });
      setView("dm");
      setNewDmInput("");
    } catch (e) { setNewDmError(e?.message || "Couldn't open DM."); }
    setOpening(false);
  }

  // ── Server channel selection ─────────────────────────────────────────
  function openChannel(serverId, channelId) {
    setView("server");
    setActive({ serverId, channelId });
    setShowOwnerPanel(false);
    setPickerOpenFor(null);
  }

  // ── Formatting helpers ───────────────────────────────────────────────
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(ts) {
    const d = new Date(ts);
    return d.toDateString() === new Date().toDateString()
      ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function userColor(name) {
    const colors = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa","#f97316","#06b6d4"];
    let h = 0; for (let i = 0; i < (name||"").length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return colors[Math.abs(h) % colors.length];
  }

  // ── Active message stream + grouping (Discord-style) ─────────────────
  const activeMessages = view === "dm" ? dmMessages
                       : view === "server" ? serverMsgs
                       : messages;
  const grouped = [];
  {
    let lastDay = null, lastUser = null, lastTs = 0;
    activeMessages.forEach(msg => {
      const day = new Date(msg.ts).toDateString();
      if (day !== lastDay) { grouped.push({ type: "day", label: fmtDay(msg.ts), key: "day-"+msg.ts }); lastDay = day; lastUser = null; }
      const isGrouped = msg.user === lastUser && (msg.ts - lastTs) < 7 * 60 * 1000;
      grouped.push({ type: "msg", ...msg, grouped: isGrouped });
      lastUser = msg.user; lastTs = msg.ts;
    });
  }

  // ── Header content varies by view ────────────────────────────────────
  const activeThread = view === "dm" && active?.threadId ? threads.find(t => t.id === active.threadId) : null;
  const typingNow = activeThread && activeThread.typing
                    && activeThread.typing.uid !== myUid
                    && (Date.now() - (activeThread.typing.ts || 0) < 5000);

  let headerTitle = "Nova Global Chat";
  let headerSub   = "All Nova OS users see this chat in real time · be respectful";
  let headerIcon  = "#";
  if (view === "dm")        { headerTitle = "@" + (active?.otherUsername || "?"); headerSub = typingNow ? "@" + (activeThread.typing.user || active.otherUsername) + " is typing…" : "Direct message · only you two can see this thread"; headerIcon = "@"; }
  else if (view === "new")  { headerTitle = "New direct message"; headerSub = "Type a username to start a 1-on-1 conversation"; headerIcon = "+"; }
  else if (view === "server" && activeServer) {
    headerTitle = "#" + (activeChannel?.name || "general");
    headerSub = activeServer.name + " · " + (activeServer.memberUids?.length || 1) + " member" + ((activeServer.memberUids?.length||1)===1?"":"s");
    headerIcon = activeServer.icon || "💬";
  }
  else if (view === "newserver")  { headerTitle = "Create a server"; headerSub = "Make a new community space. You'll be the owner."; headerIcon = "✨"; }
  else if (view === "joinserver") { headerTitle = "Join a server";   headerSub = "Enter an invite code to join an existing server."; headerIcon = "→"; }

  // Which delete handler applies?
  const deleteForRow = (item) =>
    view === "global" ? () => deleteGlobalMessage(item.id, item.user)
    : view === "dm"   ? () => deleteDmMessage(item.id, item.user)
    : view === "server" ? () => deleteServerMsg(item.id, item.user)
    : () => {};

  // Show reactions everywhere except the "new"/setup forms.
  // v9.6: server messages now react too (nova_server_reactions).
  const reactionsEnabled = view === "global" || view === "dm" || view === "server";
  function toggleReact(msgId, emoji) {
    if (view === "global") return toggleReaction(msgId, emoji, myUid, user);
    if (view === "dm")     return toggleDmReaction(active.threadId, msgId, emoji, myUid, user);
    if (view === "server") return toggleServerReaction(active.serverId, msgId, emoji, myUid, user);
    return null;
  }
  const reactionsAvailable = view === "global" || view === "dm" || view === "server";
  const reactionsBagFor = (msgId) =>
    view === "global" ? reactionMap[msgId]
    : view === "dm"   ? dmReactionMap[msgId]
    : view === "server" ? serverReactionMap[msgId]
    : null;

  // v9.6 — @mention awareness. A message "mentions me" if it contains
  // @myusername (case-insensitive, allowing a trailing word boundary).
  function textMentionsMe(text) {
    if (!text || !user) return false;
    const re = new RegExp("@" + user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    return re.test(text);
  }

  // My role in the active server (for delete powers + member-panel UI).
  const myServerRole = activeServer ? memberRole(activeServer, myUid) : null;
  const canModerateServer = view === "server" && (isServerOwner || myServerRole === ROLE_ADMIN);

  // Display name within the active server: nickname if set, else username.
  function serverNameFor(uid, fallbackUser) {
    return activeServer ? memberDisplayName(activeServer, uid, fallbackUser) : fallbackUser;
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: FF, minHeight: 0 }}>

      {/* ───────── Sidebar ───────── */}
      <div style={{ width: 232, flexShrink: 0, borderRight: "1px solid var(--nv-border)", display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", minHeight: 0 }}>

        {/* Global */}
        <div style={{ padding: "8px 8px 0" }}>
          <SidebarRow
            icon="#"
            label="Global"
            active={view === "global"}
            onClick={() => { setView("global"); setActive(null); setPickerOpenFor(null); }}
            AC={AC}
          />
        </div>

        {/* Servers section */}
        <div style={{ padding: "12px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...SEC, marginBottom: 0, fontSize: 9 }}>Servers</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button
              onClick={() => setServerModal({ kind: "join" })}
              title="Join server"
              style={pillIconBtn(view === "joinserver", AC)}
            >↘</button>
            <button
              onClick={() => setServerModal({ kind: "new" })}
              title="Create server"
              style={pillIconBtn(view === "newserver", AC)}
            >+</button>
          </div>
        </div>
        <div style={{ padding: "0 6px 4px", maxHeight: "30%", overflowY: "auto" }}>
          {servers.length === 0 && (
            <div style={{ padding: "6px 8px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic", lineHeight: 1.5 }}>
              No servers yet. Tap <strong style={{color:"rgba(255,255,255,0.5)"}}>+</strong> to create one or <strong style={{color:"rgba(255,255,255,0.5)"}}>↘</strong> to join.
            </div>
          )}
          {servers.map(s => {
            const open = !!serverOpen[s.id] || (view === "server" && active?.serverId === s.id);
            const channels = s.channels || [];
            const unread = isServerUnread(s) && !(view === "server" && active?.serverId === s.id);
            return (
              <div key={s.id} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => {
                    setServerOpen(prev => ({ ...prev, [s.id]: !open }));
                    // First open of a server: jump into its first channel.
                    if (!open && channels.length > 0) openChannel(s.id, channels[0].id);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "6px 9px", borderRadius: 7, cursor: "pointer",
                    background: (view === "server" && active?.serverId === s.id) ? "rgba(255,255,255,0.05)" : "transparent",
                    border: "1px solid transparent", textAlign: "left",
                    fontFamily: FFB, fontWeight: unread ? 700 : 600, fontSize: 12, color: unread ? "var(--nv-text-strong)" : "var(--nv-text)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                  onMouseLeave={e => { if (!(view === "server" && active?.serverId === s.id)) e.currentTarget.style.background = "transparent"; }}
                  title={s.name}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, position: "relative" }}>
                    {s.icon || "💬"}
                    {unread && <span style={{ position: "absolute", top: -3, right: -4, width: 9, height: 9, borderRadius: "50%", background: "#ff5a5a", border: "2px solid var(--nv-surface-solid)" }}/>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <span style={{ fontSize: 8, opacity: 0.5, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>▶</span>
                </button>
                {open && (
                  <div style={{ paddingLeft: 22, marginTop: 2 }}>
                    {channels.map(ch => {
                      const isActive = view === "server" && active?.serverId === s.id && active?.channelId === ch.id;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => openChannel(s.id, ch.id)}
                          className="fr"
                          style={{
                            display: "flex", alignItems: "center", gap: 6, width: "100%",
                            padding: "4px 8px", borderRadius: 5, cursor: "pointer",
                            background: isActive ? fill(AC) : "transparent",
                            border: "1px solid " + (isActive ? bdr(AC) : "transparent"),
                            fontFamily: FF, fontSize: 11.5,
                            color: isActive ? AC : "var(--nv-text)",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ opacity: 0.55, fontFamily: FFM }}>#</span>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* DMs section */}
        <div style={{ padding: "12px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...SEC, marginBottom: 0, fontSize: 9 }}>Direct Messages</span>
          {unreadDmCount > 0 && (
            <span style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "#ff5a5a", color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 9.5, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{unreadDmCount}</span>
          )}
          <button
            onClick={() => { setView("new"); setActive(null); setNewDmError(""); }}
            title="Start a new DM"
            style={{ ...pillIconBtn(view === "new", AC), marginLeft: "auto" }}
          >+</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
          {threads.length === 0 && (
            <div style={{ padding: "6px 8px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic", lineHeight: 1.5 }}>
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
                unread={isThreadUnread(t)}
                onClick={() => { setView("dm"); setActive({ threadId: t.id, otherUsername: other }); setPickerOpenFor(null); }}
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
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: view === "global" ? (loading ? "#888" : "#4cef90") : view === "dm" ? "#4f9eff" : "#a78bfa", flexShrink: 0, boxShadow: view === "global" && !loading ? "0 0 6px #4cef90" : "none" }} />
            <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headerTitle}</span>
            {isMod && (
              <span title="You're a moderator" style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9, letterSpacing: 1, padding: "2px 7px", borderRadius: 4, background: "rgba(255,200,80,0.16)", border: "1px solid rgba(255,200,80,0.5)", color: "#ffd060" }}>MOD</span>
            )}
            {view === "server" && isServerOwner && (
              <span title="You own this server" style={{ fontFamily: FFB, fontWeight: 700, fontSize: 9, letterSpacing: 1, padding: "2px 7px", borderRadius: 4, background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.5)", color: "#c4a8ff" }}>OWNER</span>
            )}
            <div style={{ flex: 1 }} />
            {view === "server" && activeServer && (
              <button
                onClick={() => setShowOwnerPanel(p => !p)}
                title="Members & server info"
                style={{ background: showOwnerPanel ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (showOwnerPanel ? bdr(AC) : "var(--nv-border)"), borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: showOwnerPanel ? AC : "var(--nv-text)", display: "inline-flex", alignItems: "center", gap: 5 }}
              >👥 {activeServer.memberUids?.length || 1}</button>
            )}
            {view === "global" && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                {loading ? "Connecting…" : messages.length + " messages"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.32)", marginTop: 3 }}>{headerSub}</div>
        </div>

        {/* Members + server info panel slides down inside the main pane */}
        {view === "server" && showOwnerPanel && activeServer && (
          <ServerOwnerPanel
            server={activeServer}
            isOwner={isServerOwner}
            myRole={myServerRole}
            myUid={myUid}
            myUsername={user}
            AC={AC}
            onClose={() => setShowOwnerPanel(false)}
            onSwitchView={() => { setView("global"); setActive(null); setShowOwnerPanel(false); }}
          />
        )}

        {/* Body */}
        {view === "new" ? (
          <NewDmForm
            newDmInput={newDmInput} setNewDmInput={setNewDmInput}
            startNewDm={startNewDm} opening={opening}
            newDmError={newDmError}
            AC={AC}
          />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
            {view === "global" && loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, flexDirection: "column" }}>
                <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading chat…</span>
              </div>
            )}

            {!loading && activeMessages.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic", margin: "auto" }}>
                {view === "dm" ? "No messages yet — say hi 👋"
                  : view === "server" ? "Nothing in #" + (activeChannel?.name || "general") + " yet. Be the first!"
                  : "No messages yet — say hello! 👋"}
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
              const onDelete = deleteForRow(item);
              // Owner + admins of a server get the mod-like delete-anyone power.
              const canDelete = isMe || isMod || canModerateServer;
              // v9.6: does this message ping me? (for the highlight band)
              const pingsMe = !isMe && textMentionsMe(item.text);

              const showReact = reactionsAvailable;
              const reactBtn = showReact ? (
                <button
                  className="rowact"
                  onClick={() => setPickerOpenFor(prev => prev === item.id ? null : item.id)}
                  title="Add reaction"
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "2px 6px", flexShrink: 0, opacity: pickerOpenFor === item.id ? 1 : 0, transition: "opacity 0.12s" }}
                >🙂</button>
              ) : null;

              if (item.grouped) {
                return (
                  <div key={item.id} className="msgrow" style={{ display: "flex", padding: "1px 8px", borderRadius: 4, flexDirection: "column", background: pingsMe ? "rgba(255,200,80,0.07)" : "transparent", borderLeft: pingsMe ? "2px solid rgba(255,200,80,0.6)" : "2px solid transparent" }}>
                    <div style={{ display: "flex" }}>
                      <div className="ts-hover" style={{ width: 40, flexShrink: 0, fontFamily: FFM, fontSize: 9.5, color: "transparent", paddingTop: 4, textAlign: "center", transition: "color 0.12s" }}>{fmtTime(item.ts)}</div>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <div style={{ flex: 1, fontSize: 14, color: "var(--nv-text)", lineHeight: 1.55, wordBreak: "break-word", fontFamily: FF }}><MessageText text={item.text} myName={user} ac={AC}/></div>
                        {reactBtn}
                        {canDelete && (
                          <button
                            className="dl rowact"
                            onClick={onDelete}
                            title={isMe ? "Delete message" : "Delete — mod/owner"}
                            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", color: isMe ? "rgba(255,80,80,0.6)" : "rgba(255,200,80,0.7)", fontSize: 11, padding: "2px 6px", flexShrink: 0, opacity: 0, transition: "opacity 0.12s" }}
                          >{isMe ? "✕" : "🛡"}</button>
                        )}
                      </div>
                    </div>
                    {showReact && reactionsEnabled && (
                      <ReactionsRow
                        msgId={item.id}
                        bag={reactionsBagFor(item.id)}
                        myUid={myUid} user={user}
                        pickerOpen={pickerOpenFor === item.id}
                        onClosePicker={() => setPickerOpenFor(null)}
                        onToggle={(emoji) => toggleReact(item.id, emoji)}
                        ac={AC} gutter={40}
                      />
                    )}
                  </div>
                );
              }

              // v9.6: in servers, show the member's nickname (falls back to
              // username); the avatar letter follows the displayed name.
              const displayName = view === "server" ? serverNameFor(item.uid, item.user) : (item.user || "unknown");
              const itemRole = view === "server" && activeServer ? memberRole(activeServer, item.uid) : null;
              return (
                <div key={item.id} className="msgrow" style={{ display: "flex", padding: "5px 8px", borderRadius: 4, marginTop: 8, flexDirection: "column", background: pingsMe ? "rgba(255,200,80,0.07)" : "transparent", borderLeft: pingsMe ? "2px solid rgba(255,200,80,0.6)" : "2px solid transparent" }}>
                  <div style={{ display: "flex" }}>
                    <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 1 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `rgba(${hexRgb(uc)},0.22)`, border: `1.5px solid ${uc}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "#fff" }}>
                        {(displayName || "?")[0].toUpperCase()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13.5, color: uc }}>{view === "server" ? displayName : "@" + displayName}</span>
                        <span style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)" }}>{fmtTime(item.ts)}</span>
                        {isMe && <span style={{ fontFamily: FFB, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `rgba(${hexRgb(AC)},0.16)`, border: `1px solid rgba(${hexRgb(AC)},0.32)`, color: AC, letterSpacing: 0.5 }}>YOU</span>}
                        {itemRole === ROLE_OWNER && !isMe && (
                          <span style={{ fontFamily: FFB, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.5)", color: "#c4a8ff", letterSpacing: 0.5 }}>OWNER</span>
                        )}
                        {itemRole === ROLE_ADMIN && (
                          <span style={{ fontFamily: FFB, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(80,200,255,0.16)", border: "1px solid rgba(80,200,255,0.45)", color: "#8fd3ff", letterSpacing: 0.5 }}>ADMIN</span>
                        )}
                        <div style={{ flex: 1 }} />
                        {reactBtn}
                        {canDelete && (
                          <button
                            className="dl rowact"
                            onClick={onDelete}
                            title={isMe ? "Delete message" : "Delete — mod/owner"}
                            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", color: isMe ? "rgba(255,80,80,0.6)" : "rgba(255,200,80,0.7)", fontSize: 11, padding: "2px 6px", opacity: 0, transition: "opacity 0.12s" }}
                          >{isMe ? "✕" : "🛡"}</button>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: "var(--nv-text)", lineHeight: 1.55, wordBreak: "break-word", fontFamily: FF, marginTop: 2 }}><MessageText text={item.text} myName={user} ac={AC}/></div>
                    </div>
                  </div>
                  {showReact && reactionsEnabled && (
                    <ReactionsRow
                      msgId={item.id}
                      bag={reactionsBagFor(item.id)}
                      myUid={myUid} user={user}
                      pickerOpen={pickerOpenFor === item.id}
                      onClosePicker={() => setPickerOpenFor(null)}
                      onToggle={(emoji) => toggleReact(item.id, emoji)}
                      ac={AC} gutter={40}
                    />
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input bar — hidden when on the new-DM form */}
        {view !== "new" && (
          <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ position: "relative", flex: 1, display: "flex" }}>
              {mention && mention.items.length > 0 && (
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, minWidth: 180, maxWidth: 280, maxHeight: 200, overflowY: "auto", background: "var(--nv-surface-solid)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", zIndex: 60, padding: 4 }}>
                  {mention.items.map((u, i) => (
                    <button key={u} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickMention(u)}
                      style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 7, border: "none", cursor: "pointer", background: i === mention.active ? fill(AC) : "transparent", color: i === mention.active ? AC : "var(--nv-text)", fontFamily: FF, fontSize: 12.5 }}>
                      <span style={{ fontFamily: FFM, color: "var(--nv-text-dim)" }}>@</span>{u}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); bumpTyping(); computeMention(e.target.value, e.target.selectionStart); }}
                onKeyDown={e => {
                  if (mention && mention.items.length) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setMention(m => ({ ...m, active: (m.active + 1) % m.items.length })); return; }
                    if (e.key === "ArrowUp") { e.preventDefault(); setMention(m => ({ ...m, active: (m.active - 1 + m.items.length) % m.items.length })); return; }
                    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mention.items[mention.active]); return; }
                    if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
                  }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder={
                  view === "global" ? "Message as @" + user + "  (Enter to send, Shift+Enter for newline)"
                  : view === "dm" ? "Message @" + (active?.otherUsername || "...") + "  (Enter to send)"
                  : view === "server" ? "Message #" + (activeChannel?.name || "channel") + " as @" + user
                  : ""
                }
                rows={1}
                maxLength={500}
                disabled={view === "server" && !activeChannel}
                style={{ ...INP, width: "100%", resize: "none", minHeight: 38, maxHeight: 100, lineHeight: 1.5, overflow: "auto", fontSize: 13 }}
              />
            </div>
            <button
              onClick={send}
              disabled={sending || !input.trim() || (view === "dm" && !active) || (view === "server" && !activeChannel)}
              style={{ padding: "9px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: sending || !input.trim() ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC, opacity: sending || !input.trim() ? 0.4 : 1, flexShrink: 0, height: 38 }}
            >↑</button>
          </div>
        )}
      </div>

      {/* ───────── Server create/join modal ───────── */}
      {serverModal.kind && (
        <ServerModal
          kind={serverModal.kind}
          onClose={() => setServerModal({ kind: null })}
          myUid={myUid}
          myUsername={user}
          onCreated={({ serverId }) => { setView("server"); setActive({ serverId, channelId: "general" }); setServerOpen(p => ({ ...p, [serverId]: true })); setServerModal({ kind: null }); }}
          onJoined={({ serverId, firstChannelId }) => { setView("server"); setActive({ serverId, channelId: firstChannelId || "general" }); setServerOpen(p => ({ ...p, [serverId]: true })); setServerModal({ kind: null }); }}
          AC={AC}
        />
      )}
    </div>
  );
}

// ───────────────────────── Sidebar components ───────────────────────────

function pillIconBtn(active, AC) {
  return {
    width: 22, height: 22, borderRadius: 5,
    background: active ? fill(AC) : "rgba(255,255,255,0.06)",
    border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.1)"),
    cursor: "pointer", color: active ? AC : "rgba(255,255,255,0.65)",
    fontSize: 12, fontWeight: 700, lineHeight: 1, padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
}

function SidebarRow({ icon, label, active, onClick, AC }) {
  return (
    <button
      onClick={onClick}
      className="fr"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        textAlign: "left", padding: "9px 11px", borderRadius: 8,
        background: active ? fill(AC) : "transparent",
        border: "1px solid " + (active ? bdr(AC) : "transparent"),
        cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13,
        color: active ? AC : "var(--nv-text)",
        transition: "background 0.12s, color 0.12s",
        width: "100%",
      }}
    >
      <span style={{ fontFamily: FFM, fontSize: 16, opacity: active ? 1 : 0.6, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

function DmRow({ username, preview, active, unread, onClick, AC }) {
  const palette = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa","#f97316","#06b6d4"];
  let h = 0; for (let i = 0; i < (username || "").length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffffff;
  const uc = palette[Math.abs(h) % palette.length];
  return (
    <button
      onClick={onClick}
      title={username}
      className="fr"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        textAlign: "left", padding: "8px 10px", margin: "1px 0",
        background: active ? "rgba("+hexRgb(AC)+",0.16)" : "transparent",
        border: "1px solid " + (active ? "rgba("+hexRgb(AC)+",0.35)" : "transparent"),
        borderRadius: 8, cursor: "pointer", fontFamily: FF, width: "100%",
        transition: "background 0.12s", overflow: "hidden",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0, position: "relative",
        background: `rgba(${hexRgb(uc)},0.22)`, border: `1.5px solid ${uc}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "#fff",
      }}>
        {(username || "?")[0].toUpperCase()}
        {unread && <span style={{ position: "absolute", top: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: "#ff5a5a", border: "2px solid var(--nv-surface-solid)" }}/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FFB, fontWeight: unread ? 700 : 600, fontSize: 12.5, color: unread ? "var(--nv-text-strong)" : (active ? AC : "var(--nv-text-strong)"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{username}</div>
        {preview && (
          <div style={{ fontSize: 10.5, color: unread ? "var(--nv-text)" : "var(--nv-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35, marginTop: 1 }}>{preview}</div>
        )}
      </div>
    </button>
  );
}

// ───────────────────────── New DM form ──────────────────────────────────

function NewDmForm({ newDmInput, setNewDmInput, startNewDm, opening, newDmError, AC }) {
  return (
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
          >{opening ? "Opening…" : "Start →"}</button>
        </div>
        {newDmError && (
          <div style={{ color: "#ff8b8b", fontSize: 12, textAlign: "center", padding: "8px 12px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 8 }}>⚠ {newDmError}</div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Server owner / info panel ────────────────────

function ServerOwnerPanel({ server, isOwner, myRole, myUid, myUsername, AC, onClose, onSwitchView }) {
  const [newChan, setNewChan] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(server.name);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  // v9.6 — inline nickname editing { uid, draft }
  const [editingNick, setEditingNick] = useState(null);

  // Build the member roster from the members map, falling back to the
  // legacy memberUids/memberUsernames arrays for v9.5 servers.
  const roster = (server.memberUids || []).map((uid, i) => {
    const meta = (server.members || {})[uid] || {};
    const username = meta.user || (server.memberUsernames || [])[i] || "?";
    const role = uid === server.ownerUid ? ROLE_OWNER : (meta.role || ROLE_MEMBER);
    return { uid, username, role, nick: meta.nick || "" };
  });
  // Sort: owner, then admins, then members; alphabetical within a tier.
  const roleRank = { [ROLE_OWNER]: 0, [ROLE_ADMIN]: 1, [ROLE_MEMBER]: 2 };
  roster.sort((a, b) => (roleRank[a.role] - roleRank[b.role]) || a.username.localeCompare(b.username));

  async function doNick(uid) {
    setErr("");
    try { await setNickname(server.id, uid, editingNick?.draft || ""); setEditingNick(null); }
    catch (e) { setErr(e?.message || "Couldn't set nickname"); }
  }
  async function doSetRole(uid, role) {
    setErr("");
    try { await setMemberRole(server.id, uid, role); }
    catch (e) { setErr(e?.message || "Couldn't change role"); }
  }
  async function doKick(uid, username) {
    if (!(await novaConfirm({ title: "Remove member", message: "Remove @" + username + " from the server? They'll need a new invite to rejoin.", danger: true, confirmText: "Remove" }))) return;
    setErr("");
    try { await kickMember(server.id, uid, username); }
    catch (e) { setErr(e?.message || "Couldn't remove member"); }
  }

  async function doRename() {
    setErr("");
    try { await renameServer(server.id, renameDraft); setRenaming(false); }
    catch (e) { setErr(e?.message || "Rename failed"); }
  }
  async function doAddChannel() {
    setErr("");
    try { await addChannel(server.id, newChan, server.channels); setNewChan(""); }
    catch (e) { setErr(e?.message || "Couldn't add channel"); }
  }
  async function doRemoveChannel(channelId) {
    if (!(await novaConfirm({ title: "Remove channel", message: "Remove this channel? Messages stay in the database but become invisible.", danger: true, confirmText: "Remove" }))) return;
    setErr("");
    try { await removeChannel(server.id, channelId, server.channels); }
    catch (e) { setErr(e?.message || "Couldn't remove channel"); }
  }
  async function doRegenerate() {
    if (!(await novaConfirm({ title: "New invite code", message: "Generate a new invite code? The old one will stop working immediately.", confirmText: "Regenerate" }))) return;
    setErr("");
    try { await regenerateInvite(server.id); }
    catch (e) { setErr(e?.message || "Couldn't regenerate"); }
  }
  async function doDelete() {
    if (!(await novaConfirm({ title: "Delete server", message: "Delete this server forever? All channels, messages, and the invite will be removed for every member.", danger: true, confirmText: "Delete server" }))) return;
    try { await deleteServer(server.id); onSwitchView(); }
    catch (e) { setErr(e?.message || "Delete failed"); }
  }
  async function doLeave() {
    if (!(await novaConfirm({ title: "Leave server", message: "Leave this server? You'll need a new invite to come back.", confirmText: "Leave server" }))) return;
    try { await leaveServer(server.id, myUid, myUsername); onSwitchView(); }
    catch (e) { setErr(e?.message || "Couldn't leave"); }
  }
  function copyInvite() {
    try { navigator.clipboard?.writeText(server.inviteCode || ""); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  }

  return (
    <div style={{
      padding: "14px 18px", borderBottom: "1px solid var(--nv-border)",
      background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 10,
      maxHeight: "50%", overflowY: "auto", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 22 }}>{server.icon || "💬"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input autoFocus value={renameDraft} onChange={e => setRenameDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doRename(); if (e.key === "Escape") setRenaming(false); }} style={{ ...INP, padding: "4px 8px", fontSize: 13 }}/>
              <button onClick={doRename} style={miniBtn(AC)}>Save</button>
            </div>
          ) : (
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)" }}>
              {server.name}
              {isOwner && <button onClick={() => { setRenaming(true); setRenameDraft(server.name); }} title="Rename" style={{ marginLeft: 7, background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 11 }}>✏️</button>}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 2 }}>
            {server.memberUids?.length || 1} {(server.memberUids?.length || 1) === 1 ? "member" : "members"} · owner @{server.ownerUsername}
          </div>
        </div>
        <button onClick={onClose} title="Close" style={{ background: "none", border: "1px solid var(--nv-border)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", color: "var(--nv-text-dim)", fontFamily: FFB, fontSize: 11 }}>✕</button>
      </div>

      {/* Invite */}
      <div>
        <div style={{ ...SEC, marginBottom: 5 }}>Invite code</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <code style={{ flex: 1, padding: "7px 12px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)", borderRadius: 7, fontFamily: FFM, fontSize: 14, color: "var(--nv-text-strong)", letterSpacing: 2, textAlign: "center" }}>{server.inviteCode}</code>
          <button onClick={copyInvite} style={miniBtn(AC, copied)}>{copied ? "✓ Copied" : "📋 Copy"}</button>
          {isOwner && <button onClick={doRegenerate} style={miniBtn(AC)} title="Generate new code">↻</button>}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 5 }}>Share this code with anyone you want to invite — they enter it under <strong style={{ color: "var(--nv-text)" }}>Servers → ↘ Join</strong>.</div>
      </div>

      {/* Channels (owner-only edit) */}
      {isOwner && (
        <div>
          <div style={{ ...SEC, marginBottom: 5 }}>Channels</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {(server.channels || []).map(ch => (
              <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 6 }}>
                <span style={{ fontFamily: FFM, color: "var(--nv-text-dim)" }}>#</span>
                <span style={{ flex: 1, fontFamily: FF, fontSize: 12.5, color: "var(--nv-text-strong)" }}>{ch.name}</span>
                {(server.channels || []).length > 1 && (
                  <button onClick={() => doRemoveChannel(ch.id)} className="dl" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.45)", fontSize: 11, padding: "2px 4px" }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
            <input value={newChan} onChange={e => setNewChan(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doAddChannel(); }} placeholder="new-channel" style={{ ...INP, flex: 1, padding: "5px 9px", fontSize: 12, fontFamily: FFM }}/>
            <button onClick={doAddChannel} disabled={!newChan.trim()} style={miniBtn(AC)}>+ Add</button>
          </div>
        </div>
      )}

      {/* Members (v9.6) — visible to everyone; controls gated by role */}
      <div>
        <div style={{ ...SEC, marginBottom: 5 }}>Members — {roster.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {roster.map(m => {
            const isSelf = m.uid === myUid;
            const display = m.nick && m.nick.trim() ? m.nick.trim() : m.username;
            // Owner can edit anyone's nick; members can edit only their own.
            const canEditNick = isOwner || isSelf;
            // Owner can promote/demote anyone who isn't the owner.
            const canManageRole = isOwner && m.role !== ROLE_OWNER;
            // Owner can kick anyone who isn't the owner.
            const canKick = isOwner && m.role !== ROLE_OWNER;
            return (
              <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid var(--nv-border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FFB, fontWeight: 700, fontSize: 11, color: "var(--nv-text)" }}>
                  {(display || "?")[0].toUpperCase()}
                </div>
                {editingNick?.uid === m.uid ? (
                  <input
                    autoFocus
                    value={editingNick.draft}
                    onChange={e => setEditingNick({ uid: m.uid, draft: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") doNick(m.uid); if (e.key === "Escape") setEditingNick(null); }}
                    onBlur={() => doNick(m.uid)}
                    placeholder={m.username}
                    maxLength={24}
                    style={{ ...INP, flex: 1, padding: "3px 8px", fontSize: 12 }}
                  />
                ) : (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</span>
                      {m.role === ROLE_OWNER && <RoleTag color="#c4a8ff" bg="rgba(168,85,247,0.18)" bd="rgba(168,85,247,0.5)">OWNER</RoleTag>}
                      {m.role === ROLE_ADMIN && <RoleTag color="#8fd3ff" bg="rgba(80,200,255,0.16)" bd="rgba(80,200,255,0.45)">ADMIN</RoleTag>}
                      {isSelf && <span style={{ fontSize: 9.5, color: "var(--nv-text-dim)", fontFamily: FFM }}>you</span>}
                    </div>
                    {/* If they have a nick, show the real @username underneath */}
                    {m.nick && m.nick.trim() && <div style={{ fontSize: 9.5, color: "var(--nv-text-dim)", fontFamily: FFM, marginTop: 1 }}>@{m.username}</div>}
                  </div>
                )}
                {/* Controls */}
                {editingNick?.uid !== m.uid && (
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {canEditNick && (
                      <button onClick={() => setEditingNick({ uid: m.uid, draft: m.nick || "" })} title="Set nickname" style={memberCtlBtn()}>✏️</button>
                    )}
                    {canManageRole && (
                      m.role === ROLE_ADMIN
                        ? <button onClick={() => doSetRole(m.uid, ROLE_MEMBER)} title="Demote to member" style={memberCtlBtn()}>▼</button>
                        : <button onClick={() => doSetRole(m.uid, ROLE_ADMIN)} title="Promote to admin" style={memberCtlBtn()}>▲</button>
                    )}
                    {canKick && (
                      <button onClick={() => doKick(m.uid, m.username)} className="dl" title="Remove from server" style={{ ...memberCtlBtn(), color: "rgba(255,80,80,0.5)" }}>✕</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginTop: 6, lineHeight: 1.5 }}>
          {isOwner
            ? "You can rename anyone (✏️), promote/demote admins (▲▼), and remove members (✕). Admins can delete messages."
            : "Tap ✏️ on your own row to set a per-server nickname."}
        </div>
      </div>

      {err && <div style={{ color: "#ff8b8b", fontSize: 12, padding: "7px 10px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 6 }}>⚠ {err}</div>}

      {/* Danger zone */}
      <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
        {isOwner ? (
          <button onClick={doDelete} className="dl" style={{ padding: "6px 12px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 7, cursor: "pointer", color: "#ff8b8b", fontFamily: FFB, fontWeight: 600, fontSize: 11 }}>Delete server</button>
        ) : (
          <button onClick={doLeave} style={{ padding: "6px 12px", background: "rgba(255,200,80,0.08)", border: "1px solid rgba(255,200,80,0.3)", borderRadius: 7, cursor: "pointer", color: "#ffd060", fontFamily: FFB, fontWeight: 600, fontSize: 11 }}>Leave server</button>
        )}
      </div>
    </div>
  );
}

function miniBtn(AC, ok) {
  return {
    padding: "6px 12px", borderRadius: 7,
    background: ok ? "rgba(76,239,144,0.16)" : "var(--nv-elevated)",
    border: "1px solid " + (ok ? "rgba(76,239,144,0.35)" : "var(--nv-border)"),
    cursor: "pointer", color: ok ? "#4cef90" : "var(--nv-text)",
    fontFamily: FFB, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap",
  };
}
function memberCtlBtn() {
  return {
    width: 24, height: 24, borderRadius: 5,
    background: "transparent", border: "1px solid var(--nv-border)",
    cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 10,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  };
}
function RoleTag({ children, color, bg, bd }) {
  return (
    <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 8.5, padding: "1px 5px", borderRadius: 3, background: bg, border: "1px solid " + bd, color, letterSpacing: 0.5, flexShrink: 0 }}>{children}</span>
  );
}

// ───────────────────────── @mention-aware message text ──────────────────
// Splits a message body on @mentions and renders each mention as a pill.
// The pill that matches MY username gets a brighter "you" treatment.
function MessageText({ text, myName, ac }) {
  if (!text) return null;
  // Match @ followed by word chars (usernames are alphanumeric + _/-).
  const parts = String(text).split(/(@[A-Za-z0-9_-]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part[0] === "@") {
          const name = part.slice(1);
          const isMe = myName && name.toLowerCase() === myName.toLowerCase();
          return (
            <span key={i} style={{
              fontFamily: FFB, fontWeight: 600, fontSize: 13,
              padding: "0 4px", borderRadius: 4,
              background: isMe ? "rgba(255,200,80,0.22)" : "rgba(" + hexRgb(ac) + ",0.18)",
              color: isMe ? "#ffd060" : ac,
              border: "1px solid " + (isMe ? "rgba(255,200,80,0.4)" : "rgba(" + hexRgb(ac) + ",0.3)"),
            }}>@{name}</span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ───────────────────────── Create / Join modal ──────────────────────────

const ICON_PRESETS = ["💬","🎮","🎨","🎵","📚","💻","🔥","✨","🚀","🌙","☕","🌈","🎯","⚡","🍕","🌸"];

function ServerModal({ kind, onClose, myUid, myUsername, onCreated, onJoined, AC }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💬");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState(null);  // resolved invite preview
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (kind !== "join") return;
    const c = (code || "").trim().toUpperCase();
    if (c.length < 4) { setPreview(null); return; }
    let alive = true;
    setBusy(true);
    resolveInvite(c).then(p => { if (alive) { setPreview(p); setBusy(false); } });
    return () => { alive = false; };
  }, [kind, code]);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function doCreate() {
    setErr("");
    if (!name.trim()) { setErr("Name required."); return; }
    setBusy(true);
    try {
      const result = await createServer({ name, icon, myUid, myUsername });
      onCreated(result);
    } catch (e) { setErr(e?.message || "Couldn't create server"); }
    setBusy(false);
  }
  async function doJoin() {
    setErr("");
    if (!preview) { setErr("Invalid code."); return; }
    setBusy(true);
    try {
      await joinServer(preview.serverId, myUid, myUsername);
      onJoined({ serverId: preview.serverId });
    } catch (e) { setErr(e?.message || "Couldn't join"); }
    setBusy(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, backdropFilter: "blur(2px)", animation: "ss-fade 0.18s" }}/>
      <div style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        width: "min(440px, calc(100% - 32px))",
        background: "var(--nv-surface-solid)", backdropFilter: "blur(28px)",
        border: "1px solid var(--nv-border-strong)", borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        zIndex: 51, display: "flex", flexDirection: "column",
        animation: "win-in 0.22s cubic-bezier(0.16,1,0.3,1)", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px 10px", borderBottom: "1px solid var(--nv-border)" }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)" }}>
            {kind === "new" ? "Create a server" : "Join a server"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", marginTop: 3 }}>
            {kind === "new" ? "Make a new community space. You'll be the owner." : "Enter the invite code you were given."}
          </div>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {kind === "new" ? (
            <>
              <div>
                <label style={{ display: "block", fontFamily: FFB, fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 6, letterSpacing: 0.5 }}>Server name</label>
                <input
                  autoFocus value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") doCreate(); }}
                  placeholder="My awesome server"
                  maxLength={40}
                  style={{ ...INP, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: FFB, fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 6, letterSpacing: 0.5 }}>Icon</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ICON_PRESETS.map(p => (
                    <button key={p} onClick={() => setIcon(p)} title={p} style={{
                      width: 36, height: 36, borderRadius: 8, cursor: "pointer",
                      background: icon === p ? fill(AC) : "var(--nv-elevated)",
                      border: "1px solid " + (icon === p ? bdr(AC) : "var(--nv-border)"),
                      fontSize: 18, padding: 0, lineHeight: 1,
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontFamily: FFB, fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 6, letterSpacing: 0.5 }}>Invite code</label>
                <input
                  autoFocus value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter" && preview) doJoin(); }}
                  placeholder="ABC123"
                  maxLength={6}
                  style={{ ...INP, fontSize: 18, fontFamily: FFM, letterSpacing: 4, textAlign: "center" }}
                />
              </div>
              {/* Preview pane */}
              {code.length >= 4 && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", minHeight: 60, display: "flex", alignItems: "center", gap: 12 }}>
                  {busy ? (
                    <div style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>Looking up…</div>
                  ) : preview ? (
                    <>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{preview.icon || "💬"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)" }}>{preview.name}</div>
                        <div style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 2 }}>Owned by @{preview.ownerUsername}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "#ff8b8b" }}>No server matches that code.</div>
                  )}
                </div>
              )}
            </>
          )}

          {err && <div style={{ color: "#ff8b8b", fontSize: 12, padding: "7px 10px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 6 }}>⚠ {err}</div>}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--nv-border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid var(--nv-border)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 12 }}>Cancel</button>
          {kind === "new" ? (
            <button onClick={doCreate} disabled={busy || !name.trim()} style={{ padding: "8px 18px", borderRadius: 8, cursor: "pointer", background: fill(AC), border: "1px solid " + bdr(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, opacity: busy || !name.trim() ? 0.5 : 1 }}>{busy ? "Creating…" : "Create"}</button>
          ) : (
            <button onClick={doJoin} disabled={busy || !preview} style={{ padding: "8px 18px", borderRadius: 8, cursor: "pointer", background: fill(AC), border: "1px solid " + bdr(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, opacity: busy || !preview ? 0.5 : 1 }}>{busy ? "Joining…" : "Join"}</button>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Reactions row ────────────────────────────────

function ReactionsRow({ msgId, bag, myUid, user, pickerOpen, onClosePicker, onToggle, ac, gutter = 40 }) {
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
            onClick={() => onToggle(emoji)}
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
              onClick={() => { onToggle(emoji); onClosePicker(); }}
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

// Forum — v11.0 Phase C. A Reddit/Quora-style discussion board built into Nova OS.
// Cross-device via Firestore (lib/forum.js). Feed with Hot/New/Top sort + topic
// filter, threaded comments, up/down voting, and create-post composer. Posts and
// comments can be deleted by their author or by a moderator (isAdmin).

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FF, FFB } from "../ui/styles.js";
import { getDbUid } from "../lib/db.js";
import { isAdmin } from "../lib/moderation.js";
import { createPost, fetchPosts, votePost, addComment, deletePost, deleteComment } from "../lib/forum.js";

const TOPICS = [
  { id: "general",  label: "General",  color: "#6366f1" },
  { id: "tech",     label: "Tech",     color: "#0ea5e9" },
  { id: "gaming",   label: "Gaming",   color: "#22c55e" },
  { id: "help",     label: "Help",     color: "#f59e0b" },
  { id: "showcase", label: "Showcase", color: "#ec4899" },
  { id: "feedback", label: "Feedback", color: "#a855f7" },
  { id: "random",   label: "Random",   color: "#64748b" },
];
const TOPIC = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const topicOf = (id) => TOPIC[id] || TOPIC.general;

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24); if (d < 30) return d + "d ago";
  return new Date(ts).toLocaleDateString();
}
// "Hot" ranking — score decayed by age (Reddit-ish): newer + higher wins.
function hotScore(p) {
  const ageH = (Date.now() - (p.createdAt || 0)) / 3.6e6;
  return (p.score || 0) - ageH / 6 + (p.comments?.length || 0) * 0.5;
}

export function ForumApp({ AC = "#6366f1", user, showToast }) {
  const myUid = getDbUid();
  const me = (user || "guest");
  const mod = isAdmin(me);
  const canPost = !!myUid && me && me !== "guest";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("feed");      // feed | post | new
  const [activeId, setActiveId] = useState(null);
  const [sort, setSort] = useState("hot");        // hot | new | top
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchPosts(120);
    setPosts(list);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const active = useMemo(() => posts.find(p => p.id === activeId) || null, [posts, activeId]);

  const sorted = useMemo(() => {
    let list = posts.slice();
    if (filter !== "all") list = list.filter(p => p.topic === filter);
    if (sort === "new")      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (sort === "top") list.sort((a, b) => (b.score || 0) - (a.score || 0));
    else                     list.sort((a, b) => hotScore(b) - hotScore(a));
    return list;
  }, [posts, sort, filter]);

  // ---- mutations (optimistic local update + Firestore) ---------------------
  const applyVote = useCallback(async (id, dir) => {
    if (!myUid) { showToast?.("Sign in to vote"); return; }
    setPosts(ps => ps.map(p => {
      if (p.id !== id) return p;
      const voters = { ...(p.voters || {}) };
      const cur = voters[myUid] || 0;
      const next = cur === dir ? 0 : dir;
      if (next === 0) delete voters[myUid]; else voters[myUid] = next;
      const score = Object.values(voters).reduce((s, v) => s + v, 0);
      return { ...p, voters, score };
    }));
    const cur = (posts.find(p => p.id === id)?.voters || {})[myUid] || 0;
    await votePost(id, myUid, cur === dir ? 0 : dir);
  }, [myUid, posts, showToast]);

  const submitPost = useCallback(async ({ title, body, topic }) => {
    const post = await createPost({ title, body, topic, uid: myUid, user: me });
    if (post) { setPosts(ps => [post, ...ps]); setView("feed"); setFilter("all"); setSort("new"); showToast?.("Posted"); }
    else showToast?.("Could not post");
  }, [myUid, me, showToast]);

  const submitComment = useCallback(async (id, body) => {
    const c = await addComment(id, { uid: myUid, user: me, body });
    if (c) setPosts(ps => ps.map(p => p.id === id ? { ...p, comments: [...(p.comments || []), c] } : p));
    else showToast?.("Could not comment");
  }, [myUid, me, showToast]);

  const removePost = useCallback(async (id) => {
    setPosts(ps => ps.filter(p => p.id !== id));
    if (activeId === id) { setView("feed"); setActiveId(null); }
    await deletePost(id); showToast?.("Post deleted");
  }, [activeId, showToast]);

  const removeComment = useCallback(async (id, cid) => {
    setPosts(ps => ps.map(p => p.id === id ? { ...p, comments: (p.comments || []).filter(c => c.id !== cid) } : p));
    await deleteComment(id, cid);
  }, []);

  // ---- styles --------------------------------------------------------------
  const wrap = { display: "flex", flexDirection: "column", height: "100%", fontFamily: FF, color: "var(--nv-text)", background: "var(--nv-surface)" };
  const header = { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 };
  const chip = (on, color) => ({ padding: "4px 11px", borderRadius: 999, fontSize: 12.5, fontFamily: FFB, cursor: "pointer", border: "1px solid " + (on ? "transparent" : "var(--nv-border)"), background: on ? (color || AC) : "transparent", color: on ? "#fff" : "var(--nv-text-dim)", whiteSpace: "nowrap" });
  const btn = (primary) => ({ padding: "7px 13px", borderRadius: 9, fontSize: 13, fontFamily: FFB, cursor: "pointer", border: "1px solid " + (primary ? "transparent" : "var(--nv-border)"), background: primary ? AC : "var(--nv-elevated)", color: primary ? "#fff" : "var(--nv-text)" });

  return (
    <div style={wrap}>
      {/* top bar */}
      <div style={header}>
        <div onClick={() => { setView("feed"); setActiveId(null); }} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: AC, display: "grid", placeItems: "center", color: "#fff", fontFamily: FFB, fontSize: 15 }}>N</div>
          <span style={{ fontFamily: FFB, fontSize: 16 }}>Nova Forum</span>
        </div>
        <div style={{ flex: 1 }} />
        {view === "feed" && <button style={btn(true)} disabled={!canPost} onClick={() => canPost ? setView("new") : showToast?.("Sign in to post")} title={canPost ? "" : "Sign in to post"}>+ New Post</button>}
        {view !== "feed" && <button style={btn(false)} onClick={() => { setView("feed"); setActiveId(null); }}>← Back</button>}
      </div>

      {view === "feed" && (
        <FeedToolbar sort={sort} setSort={setSort} filter={filter} setFilter={setFilter} chip={chip} onRefresh={refresh} AC={AC} />
      )}

      <div style={{ flex: 1, overflow: "auto" }}>
        {view === "feed" && (
          loading ? <Empty text="Loading the forum…" />
          : sorted.length === 0 ? <Empty text={filter === "all" ? "No posts yet. Be the first to start a discussion!" : "Nothing in this topic yet."} />
          : <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 9, maxWidth: 820, margin: "0 auto" }}>
              {sorted.map(p => (
                <PostCard key={p.id} post={p} myUid={myUid} mod={mod} AC={AC}
                  onVote={applyVote} onOpen={() => { setActiveId(p.id); setView("post"); }} onDelete={removePost} />
              ))}
            </div>
        )}

        {view === "post" && active && (
          <PostDetail post={active} myUid={myUid} mod={mod} canPost={canPost} AC={AC}
            onVote={applyVote} onComment={submitComment} onDelete={removePost} onDeleteComment={removeComment} showToast={showToast} />
        )}
        {view === "post" && !active && <Empty text="This post is no longer available." />}

        {view === "new" && <Composer AC={AC} onSubmit={submitPost} onCancel={() => setView("feed")} />}
      </div>
    </div>
  );
}

function FeedToolbar({ sort, setSort, filter, setFilter, chip, onRefresh, AC }) {
  const SORTS = [{ id: "hot", label: "🔥 Hot" }, { id: "new", label: "🆕 New" }, { id: "top", label: "⭐ Top" }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {SORTS.map(s => <div key={s.id} style={chip(sort === s.id)} onClick={() => setSort(s.id)}>{s.label}</div>)}
        <div style={{ flex: 1 }} />
        <div style={{ ...chip(false), padding: "4px 9px" }} onClick={onRefresh} title="Refresh">↻</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
        <div style={chip(filter === "all", AC)} onClick={() => setFilter("all")}>All</div>
        {TOPICS.map(t => <div key={t.id} style={chip(filter === t.id, t.color)} onClick={() => setFilter(t.id)}>{t.label}</div>)}
      </div>
    </div>
  );
}

function VoteCol({ post, myUid, onVote, big }) {
  const my = (post.voters || {})[myUid] || 0;
  const sz = big ? 22 : 18;
  const arrow = (dir) => ({
    cursor: "pointer", lineHeight: 1, fontSize: sz, userSelect: "none",
    color: my === dir ? (dir > 0 ? "#f97316" : "#6366f1") : "var(--nv-text-dim)",
    fontFamily: FFB,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 30 }} onClick={e => e.stopPropagation()}>
      <span style={arrow(1)} onClick={() => onVote(post.id, 1)}>▲</span>
      <span style={{ fontFamily: FFB, fontSize: big ? 15 : 13 }}>{post.score || 0}</span>
      <span style={arrow(-1)} onClick={() => onVote(post.id, -1)}>▼</span>
    </div>
  );
}

function PostCard({ post, myUid, mod, AC, onVote, onOpen, onDelete }) {
  const t = topicOf(post.topic);
  const canDel = mod || post.uid === myUid;
  return (
    <div onClick={onOpen} style={{ display: "flex", gap: 11, padding: "11px 13px", borderRadius: 12, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)", cursor: "pointer" }}>
      <VoteCol post={post} myUid={myUid} onVote={onVote} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontFamily: FFB, color: "#fff", background: t.color, padding: "1.5px 8px", borderRadius: 999 }}>{t.label}</span>
          <span style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>by <b style={{ fontFamily: FFB }}>{post.author}</b> · {ago(post.createdAt)}</span>
        </div>
        <div style={{ fontFamily: FFB, fontSize: 15.5, lineHeight: 1.3, wordBreak: "break-word" }}>{post.title}</div>
        {post.body && <div style={{ fontSize: 13, color: "var(--nv-text-dim)", marginTop: 3, maxHeight: 40, overflow: "hidden", lineHeight: 1.4 }}>{post.body}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 7, fontSize: 12, color: "var(--nv-text-dim)" }}>
          <span>💬 {(post.comments || []).length} comments</span>
          {canDel && <span style={{ cursor: "pointer", color: "#ef4444" }} onClick={e => { e.stopPropagation(); onDelete(post.id); }}>🗑 Delete</span>}
        </div>
      </div>
    </div>
  );
}

function PostDetail({ post, myUid, mod, canPost, AC, onVote, onComment, onDelete, onDeleteComment, showToast }) {
  const t = topicOf(post.topic);
  const canDel = mod || post.uid === myUid;
  const [text, setText] = useState("");
  const comments = useMemo(() => (post.comments || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)), [post.comments]);

  const send = () => {
    if (!canPost) { showToast?.("Sign in to comment"); return; }
    if (!text.trim()) return;
    onComment(post.id, text); setText("");
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 13 }}>
        <VoteCol post={post} myUid={myUid} onVote={onVote} big />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontFamily: FFB, color: "#fff", background: t.color, padding: "2px 9px", borderRadius: 999 }}>{t.label}</span>
            <span style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>by <b style={{ fontFamily: FFB }}>{post.author}</b> · {ago(post.createdAt)}</span>
          </div>
          <div style={{ fontFamily: FFB, fontSize: 21, lineHeight: 1.25, wordBreak: "break-word" }}>{post.title}</div>
          {post.body && <div style={{ fontSize: 14.5, lineHeight: 1.55, marginTop: 9, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.body}</div>}
          {canDel && <div style={{ marginTop: 10 }}><span style={{ cursor: "pointer", color: "#ef4444", fontSize: 12.5 }} onClick={() => onDelete(post.id)}>🗑 Delete post</span></div>}
        </div>
      </div>

      {/* add comment */}
      <div style={{ marginTop: 18, borderTop: "1px solid var(--nv-border)", paddingTop: 14 }}>
        <div style={{ fontFamily: FFB, fontSize: 13.5, marginBottom: 8 }}>{comments.length} Comment{comments.length === 1 ? "" : "s"}</div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={canPost ? "Add a comment…" : "Sign in to comment"}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          disabled={!canPost}
          style={{ width: "100%", minHeight: 64, resize: "vertical", padding: "9px 11px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 13.5, boxSizing: "border-box" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 7 }}>
          <button onClick={send} disabled={!canPost || !text.trim()} style={{ padding: "7px 15px", borderRadius: 9, border: "none", background: text.trim() && canPost ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 13, cursor: text.trim() && canPost ? "pointer" : "default" }}>Comment</button>
        </div>
      </div>

      {/* comment list */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {comments.map(c => {
          const cDel = mod || c.uid === myUid;
          return (
            <div key={c.id} style={{ padding: "9px 12px", borderRadius: 10, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <b style={{ fontFamily: FFB, fontSize: 12.5 }}>{c.author}</b>
                <span style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{ago(c.at)}</span>
                <div style={{ flex: 1 }} />
                {cDel && <span style={{ cursor: "pointer", color: "#ef4444", fontSize: 11.5 }} onClick={() => onDeleteComment(post.id, c.id)}>Delete</span>}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</div>
            </div>
          );
        })}
        {comments.length === 0 && <div style={{ color: "var(--nv-text-dim)", fontSize: 13, padding: "6px 2px" }}>No comments yet — start the conversation.</div>}
      </div>
    </div>
  );
}

function Composer({ AC, onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState("general");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const go = async () => { if (!title.trim() || busy) return; setBusy(true); await onSubmit({ title, body, topic }); setBusy(false); };
  const fld = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: FFB, fontSize: 18 }}>Create a post</div>
      <div>
        <div style={{ fontSize: 12, fontFamily: FFB, color: "var(--nv-text-dim)", marginBottom: 6 }}>Topic</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TOPICS.map(t => (
            <div key={t.id} onClick={() => setTopic(t.id)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontFamily: FFB, cursor: "pointer", color: topic === t.id ? "#fff" : "var(--nv-text-dim)", background: topic === t.id ? t.color : "transparent", border: "1px solid " + (topic === t.id ? "transparent" : "var(--nv-border)") }}>{t.label}</div>
          ))}
        </div>
      </div>
      <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="An interesting title" style={{ ...fld, fontFamily: FFB, fontSize: 15.5 }} />
      <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={8000} placeholder="Text (optional) — share details, ask a question, start a discussion…" style={{ ...fld, minHeight: 160, resize: "vertical", lineHeight: 1.5 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
        <button onClick={go} disabled={!title.trim() || busy} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: title.trim() ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 13.5, cursor: title.trim() ? "pointer" : "default" }}>{busy ? "Posting…" : "Post"}</button>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--nv-text-dim)", fontFamily: FF, fontSize: 14, textAlign: "center", padding: 30 }}>{text}</div>;
}

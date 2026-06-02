// v9.5 — Tasks rebuilt as a real-OS productivity app (Todoist / Things /
// macOS Reminders as references). Two-pane layout: rail on the left with
// smart views (Today / Upcoming / etc.) and user-created Lists; main pane
// shows tasks with inline add, due-date + priority pills, and an
// expandable detail row for notes and metadata edits.
//
// Backwards-compatible data model:
//   data.tasks      = [{ id, text, done, folderId?, listId?, dueAt?, priority?, notes?, ts? }]
//   data.taskLists  = [{ id, name, color }]
// Existing tasks (just {id,text,done}) work unchanged — every new field is
// optional. The TasksWidget + Spotlight + FilesApp keep reading the same
// `text` / `done` props they always have.

import { useState, useMemo, useEffect } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { AiAssist } from "../ui/AiAssist.jsx";

// Priority lookup table — keeps the color/label per priority in one place.
// "normal" tasks render no pill so a plain checklist stays plain.
const PRIORITIES = {
  high:   { label: "High",   color: "#ff6b6b", dot: "•" },
  medium: { label: "Medium", color: "#ffa94d", dot: "•" },
  normal: { label: "Normal", color: null,      dot: null },
  low:    { label: "Low",    color: "#79c0ff", dot: "•" },
};

// Color presets the user can pick when creating a list. Kept short so the
// picker is one row and the palette feels curated, not random.
const LIST_COLORS = ["#7c9eff", "#a78bfa", "#f472b6", "#fb7185", "#fbbf24", "#34d399", "#22d3ee"];

// ── date helpers ─────────────────────────────────────────────────────────
// Tasks store dueAt as a `YYYY-MM-DD` string (no timezone math, no UTC drift
// at midnight). All comparisons happen on these strings, which sort
// lexicographically the same way they sort chronologically.
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addDaysKey(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function formatDue(key) {
  if (!key) return "";
  const today = todayKey();
  const tomorrow = addDaysKey(1);
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  if (key < today) return "Overdue";
  // Show as "Mon, May 28" — short and readable.
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function isOverdue(key) {
  return !!key && key < todayKey();
}

export function TasksApp({ data, updateData, showToast, AC, openNovaAi }) {
  const tasks = data?.tasks || [];
  const lists = data?.taskLists || [];

  // ── view state ─────────────────────────────────────────────────────────
  // A "view" describes what the main pane is showing. Smart views are
  // computed filters; list views point at a saved list id.
  const [view, setView] = useState({ kind: "today" });
  const [expandedId, setExpandedId] = useState(null);   // task whose detail row is open
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState(LIST_COLORS[0]);
  const [quickText, setQuickText] = useState("");        // inline add-task input

  // Mobile: master-detail. Show the task list ("main") by default with a ☰
  // button to open the rail ("rail") of views + lists. The desktop two-pane
  // squeezed task titles down to ~3 characters on a phone.
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;
  const [mobilePane, setMobilePane] = useState("main");
  useEffect(() => { if (isMobile) setMobilePane("main"); }, [view]); // picking a view returns to the list

  // ── filtered task list for the active view ────────────────────────────
  const filtered = useMemo(() => {
    if (view.kind === "all") return tasks;
    if (view.kind === "today") {
      const td = todayKey();
      return tasks.filter(t => !t.done && (t.dueAt === td || (t.dueAt && t.dueAt < td)));
    }
    if (view.kind === "upcoming") {
      const td = todayKey();
      return tasks.filter(t => !t.done && t.dueAt && t.dueAt > td);
    }
    if (view.kind === "nodate") return tasks.filter(t => !t.done && !t.dueAt);
    if (view.kind === "completed") return tasks.filter(t => t.done);
    if (view.kind === "list") return tasks.filter(t => (t.listId || null) === view.id);
    return tasks;
  }, [tasks, view]);

  // Pending first (ordered by overdue → today → due → no-date), then completed.
  const pending = filtered.filter(t => !t.done);
  const done    = filtered.filter(t => t.done);
  // Custom sort: overdue/today first, then earliest due date, then no date last,
  // then priority within the same bucket. Stable enough to feel natural.
  pending.sort((a, b) => {
    const aD = a.dueAt || "9999-12-31";
    const bD = b.dueAt || "9999-12-31";
    if (aD !== bD) return aD < bD ? -1 : 1;
    const pri = { high: 0, medium: 1, normal: 2, low: 3 };
    return (pri[a.priority || "normal"] ?? 2) - (pri[b.priority || "normal"] ?? 2);
  });

  // ── counts shown in the rail badges ───────────────────────────────────
  const counts = useMemo(() => ({
    today: tasks.filter(t => !t.done && (t.dueAt === todayKey() || (t.dueAt && t.dueAt < todayKey()))).length,
    upcoming: tasks.filter(t => !t.done && t.dueAt && t.dueAt > todayKey()).length,
    nodate: tasks.filter(t => !t.done && !t.dueAt).length,
    all: tasks.filter(t => !t.done).length,
    completed: tasks.filter(t => t.done).length,
    byList: lists.reduce((acc, l) => {
      acc[l.id] = tasks.filter(t => !t.done && t.listId === l.id).length;
      return acc;
    }, {}),
  }), [tasks, lists]);

  // ── actions ───────────────────────────────────────────────────────────
  function quickAdd() {
    const text = quickText.trim();
    if (!text) return;
    // Smart defaults: if the active view is a List, the new task inherits
    // it; if "Today", the new task is dated today. Otherwise no due date.
    const base = {
      id: Date.now(),
      text,
      done: false,
      ts: Date.now(),
    };
    if (view.kind === "list") base.listId = view.id;
    if (view.kind === "today") base.dueAt = todayKey();
    updateData(p => ({ ...p, tasks: [base, ...(p.tasks || [])] }));
    setQuickText("");
  }
  function patchTask(id, patch) {
    updateData(p => ({ ...p, tasks: (p.tasks || []).map(t => t.id === id ? { ...t, ...patch } : t) }));
  }
  function toggleTask(id) {
    updateData(p => ({ ...p, tasks: (p.tasks || []).map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }
  function deleteTask(id) {
    updateData(p => ({ ...p, tasks: (p.tasks || []).filter(t => t.id !== id) }));
    if (expandedId === id) setExpandedId(null);
  }
  function clearCompleted() {
    if (!window.confirm("Delete all completed tasks?")) return;
    updateData(p => ({ ...p, tasks: (p.tasks || []).filter(t => !t.done) }));
    showToast?.("Cleared completed");
  }
  function createList() {
    const name = newListName.trim();
    if (!name) return;
    const id = "l" + Date.now();
    const list = { id, name, color: newListColor };
    updateData(p => ({ ...p, taskLists: [...(p.taskLists || []), list] }));
    setShowNewList(false); setNewListName(""); setNewListColor(LIST_COLORS[0]);
    setView({ kind: "list", id });
    showToast?.("List created ✓");
  }
  function deleteList(id) {
    if (!window.confirm("Delete this list? Its tasks will stay but lose the label.")) return;
    updateData(p => ({
      ...p,
      taskLists: (p.taskLists || []).filter(l => l.id !== id),
      // Don't destroy the user's tasks; just drop the now-orphan listId.
      tasks: (p.tasks || []).map(t => t.listId === id ? { ...t, listId: undefined } : t),
    }));
    if (view.kind === "list" && view.id === id) setView({ kind: "today" });
  }

  // ── title block ───────────────────────────────────────────────────────
  // Each view has a friendly heading + subhead used in the main pane header.
  function viewTitle() {
    switch (view.kind) {
      case "today":     return { title: "Today",     sub: pending.length + " due today or overdue" };
      case "upcoming":  return { title: "Upcoming",  sub: pending.length + " upcoming" };
      case "nodate":    return { title: "No date",   sub: pending.length + " unscheduled" };
      case "all":       return { title: "All tasks", sub: pending.length + " open" };
      case "completed": return { title: "Completed", sub: done.length + " done" };
      case "list": {
        const l = lists.find(x => x.id === view.id);
        return { title: l?.name || "List", sub: pending.length + " open", listColor: l?.color };
      }
      default: return { title: "Tasks", sub: "" };
    }
  }
  const vt = viewTitle();

  // AI context block — all open tasks formatted for the assistant.
  function aiContext() {
    if (tasks.length === 0) return "(No tasks yet — say so and ask the user what they're working on.)";
    const open = tasks.filter(t => !t.done);
    const closed = tasks.filter(t => t.done);
    const fmt = t => "- " + t.text + (t.dueAt ? "  [due " + formatDue(t.dueAt) + "]" : "") + (t.priority && t.priority !== "normal" ? "  [" + t.priority + "]" : "");
    return "Open tasks:\n" + (open.map(fmt).join("\n") || "(none)") + (closed.length ? "\n\nCompleted:\n" + closed.map(fmt).join("\n") : "");
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* ───────── LEFT RAIL — smart views + lists ───────── */}
      <div style={{
        width: isMobile ? "100%" : 204, flexShrink: 0, borderRight: isMobile ? "none" : "1px solid var(--nv-border)",
        padding: "16px 10px", overflowY: "auto",
        display: (isMobile && mobilePane !== "rail") ? "none" : "flex", flexDirection: "column", gap: 2,
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ padding: "2px 6px 10px", display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Tasks</span>
          {isMobile && <button onClick={() => setMobilePane("main")} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, padding: "5px 12px", color: "var(--nv-text-strong)", cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12 }}>Done</button>}
        </div>

        <RailButton ac={AC} active={view.kind === "today"}     onClick={() => setView({ kind: "today" })}     icon={<TodayGlyph />}    label="Today"     badge={counts.today || null} />
        <RailButton ac={AC} active={view.kind === "upcoming"}  onClick={() => setView({ kind: "upcoming" })}  icon={<UpcomingGlyph />} label="Upcoming"  badge={counts.upcoming || null} />
        <RailButton ac={AC} active={view.kind === "nodate"}    onClick={() => setView({ kind: "nodate" })}    icon={<InboxGlyph />}    label="No date"   badge={counts.nodate || null} />
        <RailButton ac={AC} active={view.kind === "all"}       onClick={() => setView({ kind: "all" })}       icon={<AllGlyph />}      label="All tasks" badge={counts.all || null} />
        <RailButton ac={AC} active={view.kind === "completed"} onClick={() => setView({ kind: "completed" })} icon={<DoneGlyph />}     label="Completed" badge={counts.completed || null} />

        <div style={{ padding: "16px 10px 6px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.1, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Lists</span>
          <button onClick={() => setShowNewList(v => !v)} title="New list" style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: 6, background: showNewList ? fill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (showNewList ? bdr(AC) : "rgba(255,255,255,0.1)"), cursor: "pointer", color: showNewList ? AC : "var(--nv-text)", fontSize: 13, fontWeight: 700, lineHeight: 1, padding: 0 }}>+</button>
        </div>
        {showNewList && (
          <div style={{ padding: "0 6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              autoFocus
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createList(); if (e.key === "Escape") { setShowNewList(false); setNewListName(""); } }}
              placeholder="List name…"
              style={{ ...INP, padding: "5px 8px", fontSize: 11 }}
            />
            <div style={{ display: "flex", gap: 4, padding: "2px 2px" }}>
              {LIST_COLORS.map(c => (
                <button key={c} onClick={() => setNewListColor(c)} title={c} style={{
                  width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer",
                  border: "2px solid " + (newListColor === c ? "#fff" : "transparent"),
                  padding: 0, transition: "transform 0.12s",
                }}/>
              ))}
            </div>
          </div>
        )}
        {lists.length === 0 && !showNewList && (
          <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic" }}>No lists yet</div>
        )}
        {lists.map(l => (
          <RailButton
            key={l.id}
            ac={AC}
            active={view.kind === "list" && view.id === l.id}
            onClick={() => setView({ kind: "list", id: l.id })}
            icon={<span style={{ width: 12, height: 12, borderRadius: "50%", background: l.color, display: "inline-block", marginLeft: 3 }}/>}
            label={l.name}
            badge={counts.byList[l.id] || null}
            onDelete={() => deleteList(l.id)}
          />
        ))}
      </div>

      {/* ───────── MAIN PANE ───────── */}
      <div style={{ flex: 1, minWidth: 0, display: (isMobile && mobilePane !== "main") ? "none" : "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Header */}
        <div style={{ padding: "16px 22px 12px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          {isMobile && <button onClick={() => setMobilePane("rail")} title="Views & lists" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "6px 11px", color: "var(--nv-text-strong)", cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>☰</button>}
          {vt.listColor && <span style={{ width: 12, height: 12, borderRadius: "50%", background: vt.listColor, flexShrink: 0 }}/>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)", letterSpacing: 0.2 }}>{vt.title}</div>
            <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", marginTop: 2 }}>{vt.sub}</div>
          </div>
          <AiAssist AC={AC} openNovaAi={openNovaAi} actions={[
            { icon: "🎯", label: "Prioritize my tasks",        prompt: "Rank these tasks from most to least important for someone trying to make progress. For each, give a one-line reason. Output as a numbered list:" },
            { icon: "🧩", label: "Break down a complex task",  prompt: "Look at this task list and find the one that's vaguest or biggest. Break it into 3-5 concrete sub-tasks I could add. Format as a bulleted list:" },
            { icon: "📅", label: "Suggest a day plan",         prompt: "Based on these tasks, propose a realistic day plan (morning / afternoon / evening blocks) for working through them. Keep it brief:" },
          ]} getContext={aiContext}/>
          {view.kind === "completed" && done.length > 0 && (
            <button onClick={clearCompleted} className="dl" style={{ padding: "6px 11px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 7, cursor: "pointer", color: "#ff8b8b", fontSize: 11.5, fontFamily: FFB, fontWeight: 600 }}>Clear all</button>
          )}
        </div>

        {/* Quick-add bar (hidden in Completed view — adding a "completed" task makes no sense) */}
        {view.kind !== "completed" && (
          <div style={{ padding: "12px 22px 10px", flexShrink: 0, display: "flex", gap: 7, alignItems: "center" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px dashed var(--nv-border-strong)", flexShrink: 0 }}/>
            <input
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") quickAdd(); }}
              placeholder={view.kind === "list" ? "Add to this list…" : view.kind === "today" ? "Add a task for today…" : "Add a task…"}
              style={{ ...INP, flex: 1, padding: "8px 12px", fontSize: 13 }}
            />
            <button onClick={quickAdd} disabled={!quickText.trim()} style={{
              padding: "8px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8,
              cursor: quickText.trim() ? "pointer" : "default", opacity: quickText.trim() ? 1 : 0.4,
              fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC, flexShrink: 0,
            }}>Add</button>
          </div>
        )}

        {/* Task list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "4px 18px 18px" }}>
          {pending.length === 0 && done.length === 0 && (
            <EmptyState view={view} />
          )}

          {pending.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {pending.map(t => (
                <TaskRow
                  key={t.id}
                  t={t}
                  lists={lists}
                  AC={AC}
                  expanded={expandedId === t.id}
                  onToggle={() => toggleTask(t.id)}
                  onExpand={() => setExpandedId(id => id === t.id ? null : t.id)}
                  onPatch={p => patchTask(t.id, p)}
                  onDelete={() => deleteTask(t.id)}
                />
              ))}
            </div>
          )}

          {view.kind !== "completed" && done.length > 0 && (
            <>
              <div style={{ ...SEC, marginTop: pending.length > 0 ? 18 : 0 }}>Completed ({done.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: 0.6 }}>
                {done.map(t => (
                  <TaskRow
                    key={t.id}
                    t={t}
                    lists={lists}
                    AC={AC}
                    expanded={expandedId === t.id}
                    onToggle={() => toggleTask(t.id)}
                    onExpand={() => setExpandedId(id => id === t.id ? null : t.id)}
                    onPatch={p => patchTask(t.id, p)}
                    onDelete={() => deleteTask(t.id)}
                  />
                ))}
              </div>
            </>
          )}

          {view.kind === "completed" && done.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {done.map(t => (
                <TaskRow
                  key={t.id}
                  t={t}
                  lists={lists}
                  AC={AC}
                  expanded={expandedId === t.id}
                  onToggle={() => toggleTask(t.id)}
                  onExpand={() => setExpandedId(id => id === t.id ? null : t.id)}
                  onPatch={p => patchTask(t.id, p)}
                  onDelete={() => deleteTask(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── components ───────────────────────────────────

function RailButton({ ac, active, onClick, icon, label, badge, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative" }} onMouseEnter={e => { const x = e.currentTarget.querySelector('.list-del'); if (x) x.style.opacity = '1'; }} onMouseLeave={e => { const x = e.currentTarget.querySelector('.list-del'); if (x) x.style.opacity = '0'; }}>
      <button onClick={onClick} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 8,
        background: active ? fill(ac) : "transparent",
        border: "1px solid " + (active ? bdr(ac) : "transparent"),
        cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
        color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%",
        transition: "background 0.12s, color 0.12s",
      }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
        <span style={{ flexShrink: 0, display: "flex", color: active ? ac : "var(--nv-text-dim)" }}>{icon}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {badge != null && <span style={{ fontFamily: FFM, fontSize: 10.5, color: active ? ac : "var(--nv-text-dim)", opacity: 0.85, flexShrink: 0 }}>{badge}</span>}
      </button>
      {onDelete && (
        <button
          className="list-del dl"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "rgba(11,13,28,0.85)", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.55)", fontSize: 11, padding: "3px 6px", borderRadius: 5, opacity: 0, transition: "opacity 0.12s" }}
          title="Delete list"
        >✕</button>
      )}
    </div>
  );
}

function TaskRow({ t, lists, AC, expanded, onToggle, onExpand, onPatch, onDelete }) {
  const pri = PRIORITIES[t.priority || "normal"];
  const overdue = !t.done && isOverdue(t.dueAt);
  const list = t.listId ? lists.find(l => l.id === t.listId) : null;

  return (
    <div style={{
      background: "var(--nv-elevated)",
      border: "1px solid var(--nv-border)",
      borderRadius: 9,
      overflow: "hidden",
      transition: "border-color 0.12s",
    }}>
      {/* Header row — checkbox + text + meta pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        {/* Checkbox */}
        <div
          onClick={onToggle}
          style={{
            width: 19, height: 19, borderRadius: 6,
            border: "1.5px solid " + (t.done ? AC : "var(--nv-border-strong)"),
            background: t.done ? AC : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.14s",
          }}
          title={t.done ? "Mark not done" : "Mark done"}
        >
          {t.done && <span style={{ color: "#000", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </div>

        {/* Title (click to expand) */}
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onExpand}>
          <div style={{
            fontFamily: FF, fontSize: 13.5, color: "var(--nv-text-strong)",
            textDecoration: t.done ? "line-through" : "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{t.text || "(untitled)"}</div>
          {/* Subline meta: list chip + due pill + notes hint */}
          {(list || t.dueAt || t.notes) && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3, fontSize: 10.5, color: "var(--nv-text-dim)", fontFamily: FFM }}>
              {list && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: list.color }}/>{list.name}
                </span>
              )}
              {t.dueAt && (
                <span style={{ color: overdue ? "#ff8b8b" : "var(--nv-text-dim)", fontFamily: FFM }}>
                  ⏱ {formatDue(t.dueAt)}
                </span>
              )}
              {t.notes && t.notes.trim() && <span style={{ opacity: 0.7 }}>📝 note</span>}
            </div>
          )}
        </div>

        {/* Priority pill */}
        {pri.color && (
          <span style={{
            padding: "3px 8px", borderRadius: 12,
            background: pri.color + "22", color: pri.color,
            fontFamily: FFB, fontWeight: 600, fontSize: 10, letterSpacing: 0.4,
            border: "1px solid " + pri.color + "55", flexShrink: 0,
          }}>{pri.label}</span>
        )}

        {/* Expand/collapse + delete */}
        <button onClick={onExpand} title={expanded ? "Collapse" : "Edit"} style={{
          background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)",
          fontSize: 13, padding: "4px 6px", lineHeight: 1, flexShrink: 0,
          transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.18s",
        }}>⌄</button>
        <button className="dl" onClick={onDelete} title="Delete task" style={{
          background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.3)",
          fontSize: 12, padding: "4px 6px", flexShrink: 0,
        }}>✕</button>
      </div>

      {/* Detail editor — expands inline so the task list doesn't reflow into a third pane */}
      {expanded && (
        <div style={{
          padding: "10px 14px 12px 41px", borderTop: "1px solid var(--nv-border)",
          background: "rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 9,
        }}>
          {/* Edit title */}
          <input
            value={t.text}
            onChange={e => onPatch({ text: e.target.value })}
            placeholder="Task title…"
            style={{ ...INP, fontSize: 13, padding: "7px 10px" }}
          />

          {/* Notes */}
          <textarea
            value={t.notes || ""}
            onChange={e => onPatch({ notes: e.target.value })}
            placeholder="Notes (optional)…"
            rows={2}
            style={{ ...INP, fontSize: 12, padding: "7px 10px", minHeight: 48, resize: "vertical" }}
          />

          {/* Meta controls — due date, priority, list */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {/* Date picker */}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--nv-text-dim)" }}>
              Due
              <input
                type="date"
                value={t.dueAt || ""}
                onChange={e => onPatch({ dueAt: e.target.value || undefined })}
                style={{ ...INP, fontSize: 11, padding: "5px 8px", width: "auto", fontFamily: FFM, cursor: "pointer" }}
              />
            </label>
            {/* Quick-set buttons for common dates */}
            <button onClick={() => onPatch({ dueAt: todayKey() })}     style={chipBtn(t.dueAt === todayKey(), AC)}>Today</button>
            <button onClick={() => onPatch({ dueAt: addDaysKey(1) })}  style={chipBtn(t.dueAt === addDaysKey(1), AC)}>Tomorrow</button>
            <button onClick={() => onPatch({ dueAt: addDaysKey(7) })}  style={chipBtn(t.dueAt === addDaysKey(7), AC)}>+1 week</button>
            {t.dueAt && <button onClick={() => onPatch({ dueAt: undefined })} style={chipBtn(false, AC, true)}>Clear</button>}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--nv-text-dim)" }}>Priority</span>
            {Object.entries(PRIORITIES).map(([k, p]) => (
              <button
                key={k}
                onClick={() => onPatch({ priority: k })}
                style={{
                  padding: "4px 9px", borderRadius: 12, cursor: "pointer",
                  background: (t.priority || "normal") === k ? (p.color || "var(--nv-hover)") + "22" : "transparent",
                  border: "1px solid " + ((t.priority || "normal") === k ? (p.color || "var(--nv-border-strong)") + "88" : "var(--nv-border)"),
                  color: (t.priority || "normal") === k ? (p.color || "var(--nv-text)") : "var(--nv-text-dim)",
                  fontFamily: FFB, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.4,
                }}
              >{p.label}</button>
            ))}
          </div>

          {lists.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--nv-text-dim)" }}>List</span>
              <select
                value={t.listId || ""}
                onChange={e => onPatch({ listId: e.target.value || undefined })}
                style={{ ...INP, padding: "5px 8px", fontSize: 11, width: "auto", cursor: "pointer" }}
              >
                <option value="">— No list —</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function chipBtn(active, ac, danger) {
  return {
    padding: "5px 10px", borderRadius: 12, cursor: "pointer",
    background: active ? fill(ac) : danger ? "rgba(255,80,80,0.08)" : "var(--nv-elevated)",
    border: "1px solid " + (active ? bdr(ac) : danger ? "rgba(255,80,80,0.25)" : "var(--nv-border)"),
    color: active ? ac : danger ? "#ff8b8b" : "var(--nv-text)",
    fontFamily: FFB, fontWeight: 600, fontSize: 10.5,
  };
}

function EmptyState({ view }) {
  const msg = (() => {
    switch (view.kind) {
      case "today":     return { icon: "☀️", title: "Nothing for today", sub: "Add a task above to plan your day." };
      case "upcoming":  return { icon: "📆", title: "Nothing upcoming",   sub: "Tasks with future due dates show up here." };
      case "nodate":    return { icon: "📥", title: "Inbox is clear",     sub: "Unscheduled tasks live here." };
      case "all":       return { icon: "🎉", title: "All clear",          sub: "You're caught up. Time for a break." };
      case "completed": return { icon: "✨", title: "Nothing done yet",   sub: "Finished tasks show up here for a victory lap." };
      case "list":      return { icon: "📋", title: "List is empty",      sub: "Add a task above to start this list." };
      default:          return { icon: "✅", title: "No tasks",            sub: "" };
    }
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center", color: "var(--nv-text-dim)" }}>
      <div style={{ fontSize: 44, opacity: 0.55, marginBottom: 12 }}>{msg.icon}</div>
      <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text-strong)", marginBottom: 5 }}>{msg.title}</div>
      <div style={{ fontSize: 12, color: "var(--nv-text-dim)", maxWidth: 280, lineHeight: 1.6 }}>{msg.sub}</div>
    </div>
  );
}

// ───────────── glyphs ────────────────────────────────────────────────────
const svgProps = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };
function TodayGlyph()    { return (<svg {...svgProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>); }
function UpcomingGlyph() { return (<svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>); }
function InboxGlyph()    { return (<svg {...svgProps}><path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/><path d="M3 13l3-8h12l3 8M3 13h5l2 3h4l2-3h5"/></svg>); }
function AllGlyph()      { return (<svg {...svgProps}><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6"  r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/></svg>); }
function DoneGlyph()     { return (<svg {...svgProps}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>); }

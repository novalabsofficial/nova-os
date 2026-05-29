// v9.5 — Calendar rebuilt as a real OS calendar (Apple Calendar / Outlook /
// Google Calendar as references). Two-pane layout: sidebar with a mini
// month-picker + "Up next" agenda and the main pane that switches between
// Month, Week, and Agenda views. Events gain a color tag and free-text
// notes; everything stays in the same `data.calendarEvents` shape so the
// CalendarWidget keeps working untouched.
//
// Data model (additive — old events without these fields still render):
//   data.calendarEvents = {
//     "YYYY-MM-DD": [{ id, title, time?, color?, notes? }]
//   }

import { useMemo, useState, useEffect } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// Curated event colors. Sized small + visually distinct on dark wallpapers.
const EVENT_COLORS = [
  { id: "blue",   hex: "#5b9eff", label: "Blue"   },
  { id: "purple", hex: "#a78bfa", label: "Purple" },
  { id: "pink",   hex: "#f472b6", label: "Pink"   },
  { id: "red",    hex: "#f87171", label: "Red"    },
  { id: "amber",  hex: "#fbbf24", label: "Amber"  },
  { id: "green",  hex: "#34d399", label: "Green"  },
  { id: "teal",   hex: "#2dd4bf", label: "Teal"   },
];
const colorOf = (id) => (EVENT_COLORS.find(c => c.id === id) || EVENT_COLORS[0]).hex;

// ── date helpers ─────────────────────────────────────────────────────────
function dateKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function keyToDate(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sameYMD(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x; }

export function CalendarApp({ data, updateData, showToast, AC }) {
  const events = data?.calendarEvents || {};

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [viewMode, setViewMode] = useState("month"); // month | week | agenda
  const [cursor, setCursor]     = useState(today);   // anchor date for the active view
  const [selectedKey, setSelectedKey] = useState(dateKey(today));
  const [editingEvent, setEditingEvent] = useState(null);     // {key, id?} - id absent = new event
  // Editor draft (kept separate so canceling doesn't mutate state).
  const [draft, setDraft] = useState({ title: "", time: "", color: "blue", notes: "" });

  // ── event helpers ─────────────────────────────────────────────────────
  function openNew(key) {
    setEditingEvent({ key });
    setDraft({ title: "", time: "", color: "blue", notes: "" });
  }
  function openEdit(key, ev) {
    setEditingEvent({ key, id: ev.id });
    setDraft({ title: ev.title || "", time: ev.time || "", color: ev.color || "blue", notes: ev.notes || "" });
  }
  function saveEvent() {
    const title = draft.title.trim();
    if (!title) { showToast?.("Title required"); return; }
    const key = editingEvent.key;
    const updated = {
      id: editingEvent.id || Date.now() + Math.random(),
      title,
      time: draft.time || undefined,
      color: draft.color || "blue",
      notes: draft.notes || undefined,
    };
    const list = events[key] || [];
    const nextList = editingEvent.id
      ? list.map(e => e.id === editingEvent.id ? updated : e)
      : [...list, updated];
    const nextEvents = { ...events, [key]: nextList };
    updateData({ calendarEvents: nextEvents });
    setEditingEvent(null);
    showToast?.(editingEvent.id ? "Saved" : "Added");
  }
  function deleteEvent(key, id) {
    const list = (events[key] || []).filter(e => e.id !== id);
    const next = { ...events };
    if (list.length === 0) delete next[key]; else next[key] = list;
    updateData({ calendarEvents: next });
    setEditingEvent(null);
  }

  // ── upcoming agenda for the sidebar ──────────────────────────────────
  // Flatten the events map into a sorted list of {date,events} for the next
  // ~30 days. Stops as soon as the agenda is long enough to fill the sidebar.
  const upcoming = useMemo(() => {
    const out = [];
    for (let i = 0; i < 30 && out.length < 12; i++) {
      const d = addDays(today, i);
      const k = dateKey(d);
      const list = events[k];
      if (list && list.length) out.push({ key: k, date: d, events: list });
    }
    return out;
  }, [events, today]);

  // ── render ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* ───── SIDEBAR ───── */}
      <div style={{
        width: 232, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        padding: "14px 12px", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 12,
        background: "rgba(255,255,255,0.02)",
      }}>
        {/* New event button */}
        <button onClick={() => openNew(selectedKey)} style={{
          width: "100%", padding: "9px 12px", background: fill(AC),
          border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer",
          fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: AC,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>＋ New event</button>

        {/* Mini month picker */}
        <MiniMonth
          anchor={cursor}
          today={today}
          selectedKey={selectedKey}
          events={events}
          onPick={d => { setCursor(d); setSelectedKey(dateKey(d)); }}
          AC={AC}
        />

        {/* Up next */}
        <div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase", padding: "0 4px 8px" }}>Up next</div>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--nv-text-dim)", fontStyle: "italic", padding: "8px 6px" }}>No upcoming events</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map(group => (
                <div key={group.key}>
                  <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 0.3, padding: "0 4px 4px", textTransform: "uppercase" }}>
                    {sameYMD(group.date, today) ? "Today" :
                     sameYMD(group.date, addDays(today, 1)) ? "Tomorrow" :
                     group.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  {group.events.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => { setSelectedKey(group.key); setCursor(group.date); openEdit(group.key, ev); }}
                      className="fr"
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "6px 8px", borderRadius: 7, width: "100%",
                        background: "transparent", border: "1px solid transparent",
                        cursor: "pointer", textAlign: "left", fontFamily: FF,
                      }}
                    >
                      <span style={{ width: 3, height: 26, borderRadius: 2, background: colorOf(ev.color), flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{ev.title}</div>
                        {ev.time && <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)" }}>{ev.time}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───── MAIN PANE ───── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Header */}
        <div style={{
          padding: "12px 18px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <button onClick={() => {
            if (viewMode === "week") setCursor(c => addDays(c, -7));
            else if (viewMode === "agenda") setCursor(c => addDays(c, -14));
            else setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1));
          }} style={navBtn()}>‹</button>
          <button onClick={() => {
            if (viewMode === "week") setCursor(c => addDays(c, 7));
            else if (viewMode === "agenda") setCursor(c => addDays(c, 14));
            else setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1));
          }} style={navBtn()}>›</button>
          <button onClick={() => { setCursor(today); setSelectedKey(dateKey(today)); }} style={{ ...navBtn(), padding: "0 14px", width: "auto", fontFamily: FFB, fontWeight: 600, fontSize: 11.5 }}>Today</button>

          <div style={{ flex: 1, minWidth: 0, fontFamily: FFB, fontWeight: 700, fontSize: 17, color: "var(--nv-text-strong)", padding: "0 6px", textAlign: "center", letterSpacing: 0.2 }}>
            {viewMode === "week"
              ? rangeLabel(startOfWeek(cursor), addDays(startOfWeek(cursor), 6))
              : cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
          </div>

          {/* View switcher */}
          <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8 }}>
            {[{ id: "month", label: "Month" }, { id: "week", label: "Week" }, { id: "agenda", label: "Agenda" }].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)} style={{
                padding: "5px 11px", borderRadius: 6, cursor: "pointer",
                background: viewMode === m.id ? fill(AC) : "transparent",
                border: "1px solid " + (viewMode === m.id ? bdr(AC) : "transparent"),
                fontFamily: FFB, fontWeight: 600, fontSize: 11, color: viewMode === m.id ? AC : "var(--nv-text-dim)",
              }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {viewMode === "month" && (
            <MonthView
              cursor={cursor}
              today={today}
              events={events}
              selectedKey={selectedKey}
              onSelect={k => { setSelectedKey(k); setCursor(keyToDate(k)); }}
              onDoubleSelect={k => openNew(k)}
              onEdit={(k, ev) => openEdit(k, ev)}
              AC={AC}
            />
          )}
          {viewMode === "week" && (
            <WeekView
              cursor={cursor}
              today={today}
              events={events}
              onCellClick={k => { setSelectedKey(k); openNew(k); }}
              onEdit={(k, ev) => openEdit(k, ev)}
              AC={AC}
            />
          )}
          {viewMode === "agenda" && (
            <AgendaView
              cursor={cursor}
              today={today}
              events={events}
              onEdit={(k, ev) => openEdit(k, ev)}
              onNew={k => openNew(k)}
              AC={AC}
            />
          )}
        </div>
      </div>

      {/* ───── EVENT EDITOR (modal) ───── */}
      {editingEvent && (
        <EventEditor
          editing={editingEvent}
          draft={draft}
          setDraft={setDraft}
          onSave={saveEvent}
          onCancel={() => setEditingEvent(null)}
          onDelete={() => editingEvent.id ? deleteEvent(editingEvent.key, editingEvent.id) : setEditingEvent(null)}
          AC={AC}
        />
      )}
    </div>
  );
}

// ───────────────────────── Mini month ───────────────────────────────────

function MiniMonth({ anchor, today, selectedKey, events, onPick, AC }) {
  // Local navigation state so the mini-month picker can scroll independently
  // of the main view (browsing forward in the sidebar doesn't drag the main
  // calendar with it). Resets if `anchor` changes externally.
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });
  useEffect(() => { setView({ y: anchor.getFullYear(), m: anchor.getMonth() }); }, [anchor]);

  const first = new Date(view.y, view.m, 1);
  const startOffset = first.getDay();
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(new Date(view.y, view.m, 1 - startOffset), i));
  function nav(delta) {
    let m = view.m + delta, y = view.y;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setView({ y, m });
  }

  return (
    <div style={{ background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 10, padding: "10px 10px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <button onClick={() => nav(-1)} style={miniNavBtn()}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FFB, fontWeight: 700, fontSize: 11.5, color: "var(--nv-text-strong)" }}>
          {new Date(view.y, view.m, 1).toLocaleDateString([], { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => nav(1)} style={miniNavBtn()}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 3 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontFamily: FFB, fontWeight: 600, fontSize: 9, color: "var(--nv-text-dim)" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((d, i) => {
          const k = dateKey(d);
          const inMonth = d.getMonth() === view.m;
          const isToday = sameYMD(d, today);
          const isSel = k === selectedKey;
          const has = events[k] && events[k].length > 0;
          return (
            <button key={i} onClick={() => onPick(d)} style={{
              padding: "4px 0", borderRadius: 5, cursor: "pointer",
              background: isSel ? fill(AC) : "transparent",
              border: "1px solid " + (isSel ? bdr(AC) : isToday ? "var(--nv-border-strong)" : "transparent"),
              color: isSel ? AC : inMonth ? "var(--nv-text-strong)" : "var(--nv-text-dim)",
              fontFamily: isToday || isSel ? FFB : FF,
              fontWeight: isToday || isSel ? 700 : 400,
              fontSize: 10.5, position: "relative",
            }}>
              {d.getDate()}
              {has && <span style={{ position: "absolute", left: "50%", bottom: 1, transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: isSel ? AC : "var(--nv-text)" }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Month view ───────────────────────────────────

function MonthView({ cursor, today, events, selectedKey, onSelect, onDoubleSelect, onEdit, AC }) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(y, m, 1 - startOffset);
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
          <div key={i} style={{
            textAlign: "center", padding: "8px 0",
            fontFamily: FFB, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.8,
            color: i === 0 || i === 6 ? "var(--nv-text-dim)" : "var(--nv-text)",
            textTransform: "uppercase",
          }}>{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(6, 1fr)", minHeight: 0 }}>
        {cells.map((d, i) => {
          const k = dateKey(d);
          const inMonth = d.getMonth() === m;
          const isToday = sameYMD(d, today);
          const isSel = k === selectedKey;
          const dayEvents = events[k] || [];
          return (
            <div
              key={i}
              onClick={() => onSelect(k)}
              onDoubleClick={() => onDoubleSelect(k)}
              style={{
                borderRight: (i % 7) === 6 ? "none" : "1px solid var(--nv-border)",
                borderBottom: i >= 35 ? "none" : "1px solid var(--nv-border)",
                padding: "5px 6px",
                background: isSel ? fill(AC) : isToday ? "rgba(255,255,255,0.025)" : "transparent",
                cursor: "pointer",
                overflow: "hidden", display: "flex", flexDirection: "column",
                opacity: inMonth ? 1 : 0.42,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, flexShrink: 0 }}>
                <span style={{
                  fontFamily: isToday ? FFB : FF,
                  fontWeight: isToday ? 700 : 500,
                  fontSize: 11.5,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: isToday && !isSel ? AC : "transparent",
                  // Color hierarchy: selected day wins, then "today" pill (white on accent),
                  // then today (un-pilled, still strong), then plain.
                  color: isSel ? AC : isToday && !isSel ? "#fff" : "var(--nv-text)",
                  padding: "0 4px",
                }}>{d.getDate()}</span>
              </div>
              {/* Up to 3 event chips per day; "+N more" beyond that */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
                {dayEvents.slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEdit(k, ev); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "2px 5px", borderRadius: 4, cursor: "pointer",
                      background: colorOf(ev.color) + "33",
                      border: "1px solid " + colorOf(ev.color) + "55",
                      color: "var(--nv-text-strong)",
                      fontFamily: FF, fontSize: 10, textAlign: "left",
                      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                      flexShrink: 0,
                    }}
                  >
                    {ev.time && <span style={{ fontFamily: FFM, fontSize: 9, color: colorOf(ev.color), flexShrink: 0 }}>{ev.time}</span>}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 9.5, color: "var(--nv-text-dim)", paddingLeft: 5, fontFamily: FFM }}>+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Week view ────────────────────────────────────

function WeekView({ cursor, today, events, onCellClick, onEdit, AC }) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
        {days.map((d, i) => {
          const isToday = sameYMD(d, today);
          return (
            <div key={i} style={{
              padding: "10px 8px", textAlign: "center",
              borderRight: i === 6 ? "none" : "1px solid var(--nv-border)",
              fontFamily: FFB,
            }}>
              <div style={{ fontWeight: 600, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 0.6, textTransform: "uppercase" }}>{d.toLocaleDateString([], { weekday: "short" })}</div>
              <div style={{
                fontWeight: 700, fontSize: 19, marginTop: 2,
                color: isToday ? "#fff" : "var(--nv-text-strong)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: 15,
                background: isToday ? AC : "transparent",
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      {/* Columns */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", overflow: "auto", minHeight: 0 }}>
        {days.map((d, i) => {
          const k = dateKey(d);
          const list = events[k] || [];
          return (
            <div key={i}
              onClick={() => onCellClick(k)}
              style={{
                borderRight: i === 6 ? "none" : "1px solid var(--nv-border)",
                padding: "8px 6px", cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 4,
                background: sameYMD(d, today) ? "rgba(255,255,255,0.02)" : "transparent",
              }}>
              {list.length === 0 && (
                <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>Tap to add</div>
              )}
              {list.sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(ev => (
                <button
                  key={ev.id}
                  onClick={e => { e.stopPropagation(); onEdit(k, ev); }}
                  style={{
                    background: colorOf(ev.color) + "22",
                    border: "1px solid " + colorOf(ev.color) + "55",
                    borderLeft: "3px solid " + colorOf(ev.color),
                    padding: "5px 7px", borderRadius: 6, textAlign: "left", cursor: "pointer",
                    fontFamily: FF, color: "var(--nv-text-strong)",
                  }}
                >
                  {ev.time && <div style={{ fontFamily: FFM, fontSize: 9.5, color: colorOf(ev.color), marginBottom: 1 }}>{ev.time}</div>}
                  <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word" }}>{ev.title}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Agenda view ──────────────────────────────────

function AgendaView({ cursor, today, events, onEdit, onNew, AC }) {
  // Show ~28 days starting from cursor. Compact list of {date, events}.
  const start = new Date(cursor); start.setHours(0,0,0,0);
  const groups = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i);
    const k = dateKey(d);
    const list = events[k] || [];
    if (list.length > 0) groups.push({ key: k, date: d, events: list });
  }
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 22px 22px", minHeight: 0 }}>
      {groups.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--nv-text-dim)" }}>
          <div style={{ fontSize: 44, opacity: 0.5, marginBottom: 12 }}>📅</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text-strong)", marginBottom: 6 }}>No upcoming events</div>
          <div style={{ fontSize: 12, maxWidth: 280, margin: "0 auto", lineHeight: 1.6 }}>The next 4 weeks are clear. Add an event from the sidebar or jump back to Month view.</div>
        </div>
      )}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 18 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 9, marginBottom: 8,
            paddingBottom: 6, borderBottom: "1px solid var(--nv-border)",
          }}>
            <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 18, color: sameYMD(group.date, today) ? AC : "var(--nv-text-strong)" }}>
              {group.date.toLocaleDateString([], { day: "numeric" })}
            </span>
            <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text)" }}>
              {group.date.toLocaleDateString([], { weekday: "long" })}
            </span>
            <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)" }}>
              {group.date.toLocaleDateString([], { month: "short", year: "numeric" })}
              {sameYMD(group.date, today) && <span style={{ marginLeft: 8, color: AC, fontWeight: 600 }}>· Today</span>}
            </span>
            <div style={{ flex: 1 }}/>
            <button onClick={() => onNew(group.key)} style={{
              padding: "3px 9px", borderRadius: 6, cursor: "pointer",
              background: "transparent", border: "1px solid var(--nv-border)",
              fontFamily: FFB, fontSize: 10.5, color: "var(--nv-text-dim)",
            }}>＋ Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.events.sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(ev => (
              <button
                key={ev.id}
                onClick={() => onEdit(group.key, ev)}
                className="fr"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 8,
                  background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
                  borderLeft: "3px solid " + colorOf(ev.color),
                  cursor: "pointer", textAlign: "left", fontFamily: FF,
                }}
              >
                <div style={{ minWidth: 64, fontFamily: FFM, fontSize: 11.5, color: colorOf(ev.color), fontWeight: 600 }}>{ev.time || "All day"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--nv-text-strong)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                  {ev.notes && <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.notes}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Event editor ─────────────────────────────────

function EventEditor({ editing, draft, setDraft, onSave, onCancel, onDelete, AC }) {
  // Esc closes — small ergonomic touch that makes the modal feel real.
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && e.ctrlKey) onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onSave]);

  const dateLabel = keyToDate(editing.key).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <div onClick={onCancel} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
        zIndex: 50, backdropFilter: "blur(2px)", animation: "ss-fade 0.18s",
      }}/>
      <div style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        width: "min(440px, calc(100% - 32px))", maxHeight: "calc(100% - 32px)",
        background: "var(--nv-surface-solid)", backdropFilter: "blur(28px)",
        border: "1px solid var(--nv-border)", borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        zIndex: 51, display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "win-in 0.22s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--nv-border)" }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "var(--nv-text-strong)" }}>
            {editing.id ? "Edit event" : "New event"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", marginTop: 3 }}>{dateLabel}</div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <input
            autoFocus
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="Event title…"
            style={{ ...INP, fontSize: 14, padding: "10px 12px" }}
          />

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--nv-text-dim)", flexShrink: 0, fontFamily: FFB }}>Time</label>
            <input
              type="time"
              value={draft.time}
              onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
              style={{ ...INP, fontSize: 12, padding: "7px 10px", width: 140, fontFamily: FFM }}
            />
            {draft.time && (
              <button onClick={() => setDraft(d => ({ ...d, time: "" }))} style={{
                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid var(--nv-border)",
                fontFamily: FFB, fontSize: 10.5, color: "var(--nv-text-dim)",
              }}>Clear</button>
            )}
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 10.5, color: "var(--nv-text-dim)", fontStyle: "italic" }}>{draft.time ? "" : "All day"}</span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--nv-text-dim)", fontFamily: FFB, marginBottom: 6 }}>Color</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EVENT_COLORS.map(c => (
                <button key={c.id} onClick={() => setDraft(d => ({ ...d, color: c.id }))} title={c.label} style={{
                  width: 26, height: 26, borderRadius: "50%", background: c.hex, cursor: "pointer",
                  border: "2px solid " + (draft.color === c.id ? "#fff" : "transparent"),
                  padding: 0, transition: "transform 0.12s",
                  transform: draft.color === c.id ? "scale(1.08)" : "scale(1)",
                }}/>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--nv-text-dim)", fontFamily: FFB, marginBottom: 6 }}>Notes (optional)</label>
            <textarea
              value={draft.notes}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Anything to remember…"
              rows={3}
              style={{ ...INP, fontSize: 12, padding: "8px 11px", minHeight: 64, resize: "vertical" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--nv-border)", display: "flex", gap: 8 }}>
          {editing.id && (
            <button onClick={onDelete} className="dl" style={{
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)",
              color: "#ff8b8b", fontFamily: FFB, fontWeight: 600, fontSize: 12,
            }}>Delete</button>
          )}
          <div style={{ flex: 1 }}/>
          <button onClick={onCancel} style={{
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1px solid var(--nv-border)",
            color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 12,
          }}>Cancel</button>
          <button onClick={onSave} style={{
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
            background: fill(AC), border: "1px solid " + bdr(AC),
            color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12,
          }}>{editing.id ? "Save" : "Add event"}</button>
        </div>
      </div>
    </>
  );
}

// ── tiny utilities ───────────────────────────────────────────────────────
function navBtn() {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
    cursor: "pointer", color: "var(--nv-text)", fontSize: 17, lineHeight: 1,
    fontFamily: FFB,
  };
}
function miniNavBtn() {
  return {
    width: 20, height: 20, borderRadius: 5,
    background: "transparent", border: "none", cursor: "pointer",
    color: "var(--nv-text-dim)", fontSize: 14, lineHeight: 1, padding: 0,
  };
}
function rangeLabel(start, end) {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return start.toLocaleDateString([], { month: "long", year: "numeric" });
  }
  return start.toLocaleDateString([], { month: "short" }) + " – " + end.toLocaleDateString([], { month: "short", year: "numeric" });
}

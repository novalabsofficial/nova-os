// v11.0 Phase B — desktop sticky notes. Self-contained layer: each note handles
// its own drag (title bar), inline editing, color and delete. Notes persist in
// data.stickyNotes (so they're included in profile backups). Text is saved on
// blur to avoid a write per keystroke; position/color/delete persist on the
// action. Desktop shell only.

import { useState, useEffect } from "react";
import { FF } from "./styles.js";

const NOTE_COLORS = [
  { id: "yellow", bg: "#fff3b0", bar: "#f3df7a", text: "#3a3320" },
  { id: "pink",   bg: "#ffd1dc", bar: "#f5b9c8", text: "#3f2630" },
  { id: "blue",   bg: "#c8e3ff", bar: "#aed4fb", text: "#1f2f42" },
  { id: "green",  bg: "#c9f2d4", bar: "#aee5bd", text: "#1f3a28" },
  { id: "purple", bg: "#e3d4ff", bar: "#d0bcf5", text: "#2e2542" },
  { id: "orange", bg: "#ffe0b8", bar: "#f5cd97", text: "#43331c" },
];
const colorById = (id) => NOTE_COLORS.find(c => c.id === id) || NOTE_COLORS[0];
const NOTE_W = 212;

function StickyNote({ note, onUpdate, onRemove }) {
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [text, setText] = useState(note.text || "");
  const [dragging, setDragging] = useState(false);
  const [picking, setPicking] = useState(false);

  // Reflect external position changes (e.g. after restore); only re-seed the
  // text from props when this is a different note, so typing isn't clobbered.
  useEffect(() => { setPos({ x: note.x, y: note.y }); }, [note.x, note.y]);
  useEffect(() => { setText(note.text || ""); }, [note.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  function onBarDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const ox = e.clientX - pos.x, oy = e.clientY - pos.y;
    let last = { x: pos.x, y: pos.y };
    setDragging(true);
    const move = (ev) => {
      last = {
        x: Math.max(0, Math.min(ev.clientX - ox, window.innerWidth - 56)),
        y: Math.max(0, Math.min(ev.clientY - oy, window.innerHeight - 44)),
      };
      setPos(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setDragging(false);
      onUpdate(note.id, { x: last.x, y: last.y });   // persist after drag — never call setState inside a setState updater
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  const c = colorById(note.color);
  return (
    <div style={{
      position: "absolute", left: pos.x, top: pos.y, width: NOTE_W, minHeight: 168,
      zIndex: dragging ? 60 : 4, background: c.bg, borderRadius: 10, fontFamily: FF,
      boxShadow: dragging ? "0 18px 44px rgba(0,0,0,0.42)" : "0 10px 26px rgba(0,0,0,0.30), 0 2px 4px rgba(0,0,0,0.16)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      transform: dragging ? "none" : "rotate(-0.6deg)",
      transition: dragging ? "none" : "box-shadow 0.18s ease, transform 0.18s ease",
    }}>
      {/* Title bar = drag handle + actions */}
      <div onPointerDown={onBarDown} style={{ height: 26, background: c.bar, cursor: dragging ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, padding: "0 7px", flexShrink: 0, touchAction: "none" }}>
        <button onClick={() => setPicking(p => !p)} title="Change color" style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,0.28)", background: c.bg, cursor: "pointer", padding: 0 }} />
        <button onClick={() => onRemove(note.id)} title="Delete note" style={{ width: 18, height: 18, border: "none", background: "transparent", cursor: "pointer", color: c.text, opacity: 0.55, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      {picking && (
        <div style={{ display: "flex", gap: 6, padding: "7px 9px", background: c.bar, flexWrap: "wrap" }}>
          {NOTE_COLORS.map(opt => (
            <button key={opt.id} onClick={() => { onUpdate(note.id, { color: opt.id }); setPicking(false); }} title={opt.id}
              style={{ width: 18, height: 18, borderRadius: "50%", border: note.color === opt.id ? "2px solid " + c.text : "1px solid rgba(0,0,0,0.22)", background: opt.bg, cursor: "pointer", padding: 0 }} />
          ))}
        </div>
      )}

      <textarea value={text} onChange={e => setText(e.target.value)} onBlur={() => { if (text !== (note.text || "")) onUpdate(note.id, { text }); }}
        placeholder="Write a note…" spellCheck={false}
        style={{ flex: 1, border: "none", outline: "none", resize: "none", background: "transparent", color: c.text, fontFamily: FF, fontSize: 13, lineHeight: 1.45, padding: "9px 11px", minHeight: 118 }} />
    </div>
  );
}

export function StickyNotes({ notes, onUpdate, onRemove }) {
  if (!notes || !notes.length) return null;
  return <>{notes.map(n => <StickyNote key={n.id} note={n} onUpdate={onUpdate} onRemove={onRemove} />)}</>;
}

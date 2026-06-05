// v11.0 Phase B — Snap Workspaces. A small panel to save the current window
// arrangement as a named layout and snap back to it later. Layouts live in
// settings.workspaces (so they're part of the profile backup). Desktop only.

import { useState } from "react";
import { FF, FFB, RADIUS } from "./styles.js";
import { fill, bdr } from "../lib/format.js";

export function WorkspacesPanel({ workspaces, winCount, onSave, onRestore, onDelete, onClose, AC }) {
  const [name, setName] = useState("");
  const save = () => { if (winCount === 0) return; onSave(name); setName(""); };

  return (
    <div onPointerDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 100050, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF, padding: 20 }}>
      <div onPointerDown={e => e.stopPropagation()} style={{ width: "min(390px, 94vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: RADIUS.xxl || 16, boxShadow: "var(--nv-popover-shadow)", overflow: "hidden", animation: "pop-in 0.22s var(--nv-ease)" }}>

        <div style={{ padding: "16px 18px 10px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 16, color: "var(--nv-text-strong)" }}>Window Layouts</div>
            <button onClick={onClose} title="Close" style={{ width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: "var(--nv-text-dim)", fontSize: 17, lineHeight: 1, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3, lineHeight: 1.5 }}>Save where your windows are now, then snap back to it anytime.</div>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "0 18px 12px", flexShrink: 0 }}>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); }} placeholder="Name this layout…" spellCheck={false}
            style={{ flex: 1, minWidth: 0, padding: "9px 11px", borderRadius: 9, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 13, outline: "none" }} />
          <button onClick={save} disabled={winCount === 0} title={winCount === 0 ? "No open windows to save" : "Save the current window layout"}
            style={{ padding: "9px 15px", borderRadius: 9, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 13, cursor: winCount === 0 ? "default" : "pointer", opacity: winCount === 0 ? 0.5 : 1, whiteSpace: "nowrap" }}>Save</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 14px", minHeight: 0 }}>
          {workspaces.length === 0 ? (
            <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12.5, color: "var(--nv-text-dim)", lineHeight: 1.5 }}>No saved layouts yet.<br />Open and arrange some windows, then Save.</div>
          ) : workspaces.map(ws => (
            <div key={ws.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, marginBottom: 5, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ws.name}</div>
                <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginTop: 1 }}>{(ws.wins?.length || 0)} window{(ws.wins?.length || 0) === 1 ? "" : "s"}</div>
              </div>
              <button onClick={() => onRestore(ws.id)} style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Restore</button>
              <button onClick={() => onDelete(ws.id)} title="Delete layout" style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-danger, #e5484d)", fontSize: 15, lineHeight: 1, cursor: "pointer", flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// v10.10 — Shared game leaderboard. Drop-in 🏆 button that opens a modal,
// fetches the top scores for a gameId, and highlights the signed-in player.
// v11.0 — now built on the <Dialog> design-system primitive (first adopter).
import { useState } from "react";
import { FFB, FFM } from "./styles.js";
import { fill } from "../lib/format.js";
import { fetchLeaderboard } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";
import { Dialog } from "./primitives.jsx";

export function Leaderboard({ gameId, dir = "high", AC, title = "Leaderboard", unit = "", fmtScore, buttonStyle, compact = false }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const myUid = getDbUid();
  const fmt = fmtScore || ((s) => s + (unit ? " " + unit : ""));

  const openLb = () => { setOpen(true); setRows(null); fetchLeaderboard(gameId, dir, 10).then(setRows); };

  return (
    <>
      <button onClick={openLb} title="Leaderboard" style={buttonStyle || {
        padding: compact ? "6px 11px" : "7px 14px", borderRadius: 9, border: "1px solid var(--nv-border)",
        background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600,
        fontSize: 12.5, cursor: "pointer",
      }}>🏆{compact ? "" : " Leaderboard"}</button>

      <Dialog open={open} onClose={() => setOpen(false)} title={title} icon="🏆" accent={AC} width={360}>
        {rows === null ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>No scores yet — be the first!</div>
        ) : rows.map((row, i) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 8, alignItems: "center", padding: "7px 9px", borderRadius: 7, background: row.uid === myUid ? fill(AC) : "transparent" }}>
            <span style={{ fontFamily: FFM, fontSize: 12, color: "var(--nv-text-dim)" }}>{i + 1}</span>
            <span style={{ fontSize: 12.5, color: row.uid === myUid ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{row.user || "anon"}{row.uid === myUid && <span style={{ fontSize: 9, color: "var(--nv-text-dim)", marginLeft: 5, fontFamily: FFM }}>you</span>}</span>
            <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)" }}>{fmt(row.score)}</span>
          </div>
        ))}
      </Dialog>
    </>
  );
}

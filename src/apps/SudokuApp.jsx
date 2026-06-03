// v10.10 — Sudoku. Backtracking generator with a guaranteed-unique solution,
// pencil-mark notes, conflict highlighting, and a per-difficulty leaderboard
// (completion time, dir "low").
import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { submitScore, fetchLeaderboard } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";

const DIFFS = { easy: { label: "Easy", givens: 42 }, medium: { label: "Medium", givens: 34 }, hard: { label: "Hard", givens: 28 } };

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

function canPlace(g, idx, v) {
  const r = Math.floor(idx / 9), c = idx % 9;
  for (let i = 0; i < 9; i++) { if (g[r * 9 + i] === v) return false; if (g[i * 9 + c] === v) return false; }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) if (g[(br + dr) * 9 + (bc + dc)] === v) return false;
  return true;
}
function fillGrid(g) {
  const idx = g.indexOf(0);
  if (idx === -1) return true;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(g, idx, v)) { g[idx] = v; if (fillGrid(g)) return true; g[idx] = 0; }
  }
  return false;
}
function countSolutions(g, cap) {
  const idx = g.indexOf(0);
  if (idx === -1) return 1;
  let total = 0;
  for (let v = 1; v <= 9; v++) {
    if (canPlace(g, idx, v)) { g[idx] = v; total += countSolutions(g, cap); g[idx] = 0; if (total >= cap) break; }
  }
  return total;
}
function generate(givens) {
  const solution = new Array(81).fill(0);
  fillGrid(solution);
  const puzzle = solution.slice();
  const order = shuffle([...Array(81).keys()]);
  let removed = 0; const target = 81 - givens;
  for (const idx of order) {
    if (removed >= target) break;
    const backup = puzzle[idx];
    if (backup === 0) continue;
    puzzle[idx] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[idx] = backup; else removed++;
  }
  return { puzzle, solution };
}
function computeConflicts(cells) {
  const bad = new Set();
  const groups = [];
  for (let r = 0; r < 9; r++) { const g = []; for (let c = 0; c < 9; c++) g.push(r * 9 + c); groups.push(g); }
  for (let c = 0; c < 9; c++) { const g = []; for (let r = 0; r < 9; r++) g.push(r * 9 + c); groups.push(g); }
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) { const g = []; for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) g.push((br * 3 + dr) * 9 + (bc * 3 + dc)); groups.push(g); }
  for (const g of groups) { const seen = {}; for (const i of g) { const v = cells[i]; if (!v) continue; if (seen[v] !== undefined) { bad.add(i); bad.add(seen[v]); } else seen[v] = i; } }
  return bad;
}
const fmtTime = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

export function SudokuApp({ AC, user }) {
  const myUid = getDbUid();
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem("nova-sudoku-diff") || "easy");
  const [game, setGame] = useState(null);        // { puzzle, solution }
  const [cells, setCells] = useState([]);
  const [notes, setNotes] = useState([]);         // array<Set<number>>
  const [sel, setSel] = useState(null);
  const [notesMode, setNotesMode] = useState(false);
  const [time, setTime] = useState(0);
  const [status, setStatus] = useState("loading"); // loading | playing | won
  const [leaders, setLeaders] = useState(null);
  const [showLb, setShowLb] = useState(false);
  const tickRef = useRef(null);

  const newGame = useCallback((diff) => {
    setStatus("loading"); setSel(null); setTime(0); clearInterval(tickRef.current);
    // defer so the "Generating…" state can paint before the (sync) solver runs
    setTimeout(() => {
      const g = generate(DIFFS[diff].givens);
      setGame(g);
      setCells(g.puzzle.slice());
      setNotes(Array.from({ length: 81 }, () => new Set()));
      setStatus("playing");
    }, 20);
  }, []);

  useEffect(() => { newGame(difficulty); /* eslint-disable-next-line */ }, []);
  useEffect(() => { localStorage.setItem("nova-sudoku-diff", difficulty); }, [difficulty]);

  // timer
  useEffect(() => {
    if (status !== "playing") return;
    tickRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [status]);

  const given = game ? (i) => game.puzzle[i] !== 0 : () => false;
  const conflicts = computeConflicts(cells);

  const place = useCallback((idx, v) => {
    if (status !== "playing" || given(idx)) return;
    if (notesMode && v !== 0) {
      setNotes((ns) => { const c = ns.slice(); c[idx] = new Set(c[idx]); if (c[idx].has(v)) c[idx].delete(v); else c[idx].add(v); return c; });
      return;
    }
    setCells((cs) => {
      const c = cs.slice(); c[idx] = c[idx] === v ? 0 : v; // tap same number again = clear
      // win check
      if (c.every((x, i) => x === game.solution[i])) {
        setStatus("won");
        clearInterval(tickRef.current);
        setTime((t) => { if (myUid) submitScore("sudoku_" + difficulty, t, "low", myUid, user); return t; });
      }
      return c;
    });
    setNotes((ns) => { const c = ns.slice(); c[idx] = new Set(); return c; });
  }, [status, notesMode, game, difficulty, myUid, user]);

  const erase = useCallback((idx) => {
    if (status !== "playing" || given(idx)) return;
    setCells((cs) => { const c = cs.slice(); c[idx] = 0; return c; });
    setNotes((ns) => { const c = ns.slice(); c[idx] = new Set(); return c; });
  }, [status, game]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (sel == null) return;
      if (e.key >= "1" && e.key <= "9") { place(sel, parseInt(e.key, 10)); e.preventDefault(); }
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { erase(sel); e.preventDefault(); }
      else if (e.key === "ArrowUp") { setSel((s) => (s >= 9 ? s - 9 : s)); e.preventDefault(); }
      else if (e.key === "ArrowDown") { setSel((s) => (s < 72 ? s + 9 : s)); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { setSel((s) => (s % 9 > 0 ? s - 1 : s)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setSel((s) => (s % 9 < 8 ? s + 1 : s)); e.preventDefault(); }
      else if (e.key === "n" || e.key === "N") setNotesMode((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, place, erase]);

  const openLb = () => { setShowLb(true); setLeaders(null); fetchLeaderboard("sudoku_" + difficulty, "low", 10).then(setLeaders); };

  const selVal = sel != null ? cells[sel] : 0;
  const counts = {}; for (let v = 1; v <= 9; v++) counts[v] = cells.filter((x) => x === v).length;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)", marginRight: 2 }}>🔢 Sudoku</div>
        <div style={{ display: "flex", gap: 4, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 9, padding: 3 }}>
          {Object.keys(DIFFS).map((d) => (
            <button key={d} onClick={() => { setDifficulty(d); newGame(d); }} style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, background: difficulty === d ? AC : "transparent", color: difficulty === d ? "#fff" : "var(--nv-text-dim)" }}>{DIFFS[d].label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontFamily: FFM, fontSize: 14, color: "var(--nv-text)", minWidth: 48, textAlign: "right" }}>{fmtTime(time)}</div>
        <button onClick={openLb} title="Leaderboard" style={{ width: 34, height: 32, borderRadius: 8, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", cursor: "pointer", fontSize: 14 }}>🏆</button>
        <button onClick={() => newGame(difficulty)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>New</button>
      </div>

      {status === "loading" ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--nv-text-dim)" }}>
          <div style={{ width: 18, height: 18, border: "2px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Generating puzzle…</span>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {/* board */}
          <div style={{ width: "min(100%, 440px)", aspectRatio: "1", display: "grid", gridTemplateColumns: "repeat(9,1fr)", background: "var(--nv-border-strong)", borderRadius: 8, overflow: "hidden", border: "2px solid var(--nv-border-strong)" }}>
            {cells.map((v, i) => {
              const r = Math.floor(i / 9), c = i % 9;
              const isGiven = given(i);
              const isSel = sel === i;
              const inPeer = sel != null && (Math.floor(sel / 9) === r || sel % 9 === c || (Math.floor(Math.floor(sel / 9) / 3) === Math.floor(r / 3) && Math.floor((sel % 9) / 3) === Math.floor(c / 3)));
              const sameNum = selVal && v === selVal;
              const conflict = conflicts.has(i);
              const bg = conflict ? "rgba(255,107,107,0.28)" : isSel ? fill(AC) : sameNum ? "rgba(255,255,255,0.13)" : inPeer ? "rgba(255,255,255,0.045)" : "var(--nv-surface-solid)";
              return (
                <div key={i} onClick={() => setSel(i)} style={{
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  background: bg,
                  borderRight: "1px solid " + (c % 3 === 2 ? "var(--nv-border-strong)" : "var(--nv-border)"),
                  borderBottom: "1px solid " + (r % 3 === 2 ? "var(--nv-border-strong)" : "var(--nv-border)"),
                  color: conflict ? "#ff6b6b" : isGiven ? "var(--nv-text-strong)" : AC,
                  fontFamily: FFB, fontWeight: isGiven ? 700 : 600, fontSize: "min(5vw, 22px)",
                }}>
                  {v ? v : (notes[i] && notes[i].size > 0 ? (
                    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)", padding: 1 }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <span key={n} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "min(2.2vw, 9px)", fontFamily: FFM, color: "var(--nv-text-dim)" }}>{notes[i].has(n) ? n : ""}</span>
                      ))}
                    </div>
                  ) : null)}
                </div>
              );
            })}
          </div>

          {/* number pad */}
          <div style={{ width: "min(100%, 440px)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 5 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} onClick={() => sel != null && place(sel, n)} disabled={counts[n] >= 9} style={{
                  aspectRatio: "1", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", cursor: sel != null ? "pointer" : "default",
                  fontFamily: FFB, fontWeight: 700, fontSize: "min(4.5vw,19px)", color: counts[n] >= 9 ? "var(--nv-text-dim)" : "var(--nv-text-strong)", opacity: counts[n] >= 9 ? 0.4 : 1,
                }}>{n}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setNotesMode((m) => !m)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid " + (notesMode ? bdr(AC) : "var(--nv-border)"), background: notesMode ? fill(AC) : "var(--nv-elevated)", color: notesMode ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>✏️ Notes {notesMode ? "On" : "Off"}</button>
              <button onClick={() => sel != null && erase(sel)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>⌫ Erase</button>
            </div>
          </div>
        </div>
      )}

      {status === "won" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
          <div style={{ textAlign: "center", background: "var(--nv-surface-solid)", border: "1px solid " + bdr(AC), borderRadius: 16, padding: "28px 30px", maxWidth: 320 }}>
            <div style={{ fontSize: 46, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 22, color: "var(--nv-text-strong)" }}>Solved!</div>
            <div style={{ fontSize: 14, color: "var(--nv-text-dim)", marginTop: 6 }}>{DIFFS[difficulty].label} · {fmtTime(time)}</div>
            <button onClick={() => newGame(difficulty)} style={{ marginTop: 18, padding: "10px 22px", borderRadius: 10, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>New puzzle</button>
          </div>
        </div>
      )}

      {showLb && (
        <div onClick={() => setShowLb(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, maxHeight: "80%", overflowY: "auto", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)" }}>🏆 Fastest — {DIFFS[difficulty].label}</div>
              <button onClick={() => setShowLb(false)} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 7, border: "none", background: "var(--nv-hover)", color: "var(--nv-text)", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginBottom: 12 }}>Switch difficulty above to see each board's times.</div>
            {leaders === null ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>Loading…</div>
            ) : leaders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>No times yet — solve one!</div>
            ) : leaders.map((row, i) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 8, alignItems: "center", padding: "7px 9px", borderRadius: 7, background: row.uid === myUid ? fill(AC) : "transparent", fontFamily: FF }}>
                <span style={{ fontFamily: FFM, fontSize: 12, color: "var(--nv-text-dim)" }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: row.uid === myUid ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{row.user || "anon"}{row.uid === myUid && <span style={{ fontSize: 9, color: "var(--nv-text-dim)", marginLeft: 5, fontFamily: FFM }}>you</span>}</span>
                <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)" }}>{fmtTime(row.score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

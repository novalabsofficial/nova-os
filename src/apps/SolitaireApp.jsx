// v10.10 — Klondike Solitaire. Click-to-move interaction (tap a card / run,
// then tap a destination — works on desktop and touch), double-click to
// auto-send to a foundation, draw-1/draw-3, timer + move counter, and a
// fastest-win leaderboard (dir "low").
import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { submitScore, fetchLeaderboard } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const CARD_W = 58, CARD_H = 80, UP_OFF = 24, DOWN_OFF = 11;
const fmtTime = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

function deal() {
  let id = 0; const deck = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ id: id++, suit: s, rank: r, color: (s === "♥" || s === "♦") ? "red" : "black", up: false });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tableau = [[], [], [], [], [], [], []];
  let k = 0;
  for (let c = 0; c < 7; c++) for (let n = 0; n <= c; n++) { const card = deck[k++]; card.up = (n === c); tableau[c].push(card); }
  const stock = deck.slice(k).map((c) => ({ ...c, up: false }));
  return { stock, waste: [], foundations: [[], [], [], []], tableau };
}
const clone = (g) => ({ stock: g.stock.slice(), waste: g.waste.slice(), foundations: g.foundations.map((p) => p.slice()), tableau: g.tableau.map((c) => c.slice()) });
function canToTableau(card, col) { if (col.length === 0) return card.rank === 13; const t = col[col.length - 1]; return t.up && t.color !== card.color && t.rank === card.rank + 1; }
function canToFoundation(card, pile) { if (pile.length === 0) return card.rank === 1; const t = pile[pile.length - 1]; return t.suit === card.suit && card.rank === t.rank + 1; }

function execMove(g, sel, dest) {
  let moving;
  if (sel.type === "waste") { if (!g.waste.length) return null; moving = [g.waste[g.waste.length - 1]]; }
  else if (sel.type === "foundation") { const p = g.foundations[sel.pile]; if (!p.length) return null; moving = [p[p.length - 1]]; }
  else { moving = g.tableau[sel.pile].slice(sel.idx); }
  if (!moving.length || !moving[0].up) return null;
  if (dest.type === "tableau") { if (!canToTableau(moving[0], g.tableau[dest.pile])) return null; }
  else if (dest.type === "foundation") { if (moving.length !== 1 || !canToFoundation(moving[0], g.foundations[dest.pile])) return null; }
  else return null;

  const n = clone(g);
  if (sel.type === "waste") n.waste.pop();
  else if (sel.type === "foundation") n.foundations[sel.pile].pop();
  else {
    n.tableau[sel.pile] = n.tableau[sel.pile].slice(0, sel.idx);
    const col = n.tableau[sel.pile];
    if (col.length && !col[col.length - 1].up) col[col.length - 1] = { ...col[col.length - 1], up: true };
  }
  if (dest.type === "tableau") n.tableau[dest.pile] = [...n.tableau[dest.pile], ...moving];
  else n.foundations[dest.pile] = [...n.foundations[dest.pile], moving[0]];
  return n;
}

export function SolitaireApp({ AC, user }) {
  const myUid = getDbUid();
  const [g, setG] = useState(() => deal());
  const [sel, setSel] = useState(null);
  const [draw3, setDraw3] = useState(false);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [status, setStatus] = useState("playing");
  const [leaders, setLeaders] = useState(null);
  const [showLb, setShowLb] = useState(false);
  const timeRef = useRef(0);
  const tickRef = useRef(null);

  useEffect(() => {
    if (status !== "playing") return;
    tickRef.current = setInterval(() => { timeRef.current += 1; setTime(timeRef.current); }, 1000);
    return () => clearInterval(tickRef.current);
  }, [status]);

  const newGame = useCallback(() => {
    clearInterval(tickRef.current); timeRef.current = 0;
    setG(deal()); setSel(null); setMoves(0); setTime(0); setStatus("playing");
  }, []);

  const commit = useCallback((n) => {
    setG(n); setMoves((m) => m + 1);
    if (n.foundations.reduce((a, p) => a + p.length, 0) === 52) {
      setStatus("won"); clearInterval(tickRef.current);
      if (myUid) submitScore("solitaire", timeRef.current, "low", myUid, user);
    }
  }, [myUid, user]);

  const draw = () => {
    setSel(null);
    setG((cur) => {
      const n = clone(cur);
      if (n.stock.length === 0) { n.stock = n.waste.slice().reverse().map((c) => ({ ...c, up: false })); n.waste = []; }
      else { const cnt = draw3 ? 3 : 1; for (let i = 0; i < cnt && n.stock.length; i++) n.waste.push({ ...n.stock.pop(), up: true }); }
      return n;
    });
  };

  const clickTarget = (type, pile, idx) => {
    if (status !== "playing") return;
    // deselect if tapping the same source
    if (sel && sel.type === type && sel.pile === pile && (type !== "tableau" || sel.idx === idx)) { setSel(null); return; }
    if (sel) {
      const destType = type === "foundation" ? "foundation" : "tableau";
      const n = execMove(g, sel, { type: destType, pile });
      if (n) { commit(n); setSel(null); return; }
    }
    // (re)select a source
    if (type === "waste") { if (g.waste.length) setSel({ type: "waste", pile: 0, idx: g.waste.length - 1 }); else setSel(null); }
    else if (type === "foundation") { setSel(g.foundations[pile].length ? { type: "foundation", pile, idx: 0 } : null); }
    else { const card = g.tableau[pile][idx]; setSel(card && card.up ? { type: "tableau", pile, idx } : null); }
  };

  const autoFound = (type, pile, idx) => {
    if (status !== "playing") return;
    let card, source;
    if (type === "waste") { if (!g.waste.length) return; card = g.waste[g.waste.length - 1]; source = { type: "waste", pile: 0, idx: 0 }; }
    else if (type === "tableau") { const col = g.tableau[pile]; if (idx !== col.length - 1 || !col[idx].up) return; card = col[idx]; source = { type: "tableau", pile, idx }; }
    else return;
    let target = -1;
    for (let i = 0; i < 4; i++) { const p = g.foundations[i]; if (p.length && p[p.length - 1].suit === card.suit && card.rank === p[p.length - 1].rank + 1) { target = i; break; } }
    if (target === -1 && card.rank === 1) for (let i = 0; i < 4; i++) if (g.foundations[i].length === 0) { target = i; break; }
    if (target === -1) return;
    const n = execMove(g, source, { type: "foundation", pile: target });
    if (n) { commit(n); setSel(null); }
  };

  const openLb = () => { setShowLb(true); setLeaders(null); fetchLeaderboard("solitaire", "low", 10).then(setLeaders); };

  const isSelCard = (type, pile, idx) => {
    if (!sel || sel.type !== type || sel.pile !== pile) return false;
    if (type === "tableau") return idx >= sel.idx;
    return true;
  };

  const renderFace = (card, selected) => {
    const red = card.color === "red";
    return (
      <div style={{ width: "100%", height: "100%", borderRadius: 7, background: "#fbfbf7", border: "1px solid " + (selected ? AC : "#d8d6cf"), boxShadow: selected ? "0 0 0 2px " + AC : "0 1px 2px rgba(0,0,0,0.35)", padding: "4px 5px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <span style={{ color: red ? "#d22d2d" : "#1a1a1a", fontFamily: FFB, fontWeight: 700, fontSize: 13, lineHeight: 1 }}>{RANKS[card.rank]}</span>
        <span style={{ color: red ? "#d22d2d" : "#1a1a1a", fontSize: 17, textAlign: "right", lineHeight: 1 }}>{card.suit}</span>
      </div>
    );
  };
  const cardBack = () => (
    <div style={{ width: "100%", height: "100%", borderRadius: 7, background: `repeating-linear-gradient(45deg, ${AC}cc, ${AC}cc 4px, ${AC}88 4px, ${AC}88 8px)`, border: "1px solid " + bdr(AC) }} />
  );
  const slot = (extra) => ({ width: CARD_W, height: CARD_H, borderRadius: 8, border: "1px dashed var(--nv-border)", background: "rgba(255,255,255,0.03)", flexShrink: 0, ...extra });

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 18, color: "var(--nv-text-strong)", marginRight: 2 }}>🃏 Solitaire</div>
        <button onClick={() => { setDraw3((d) => !d); }} title="Cards drawn from stock" style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Draw {draw3 ? "3" : "1"}</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontFamily: FFM, fontSize: 12.5, color: "var(--nv-text-dim)" }}>{moves} moves</span>
          <span style={{ fontFamily: FFM, fontSize: 13, color: "var(--nv-text)" }}>{fmtTime(time)}</span>
          <button onClick={openLb} title="Leaderboard" style={{ width: 32, height: 30, borderRadius: 8, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", cursor: "pointer", fontSize: 13 }}>🏆</button>
          <button onClick={newGame} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>New</button>
        </div>
      </div>

      <div className="no-sb" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 4 }}>
        {/* top row: stock + waste ........ foundations */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div onClick={draw} style={slot({ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--nv-border)" })}>
            {g.stock.length ? cardBack() : <span style={{ fontSize: 18, color: "var(--nv-text-dim)" }}>↻</span>}
          </div>
          <div onClick={() => clickTarget("waste", 0)} style={slot({ cursor: "pointer" })}>
            {g.waste.length ? renderFace(g.waste[g.waste.length - 1], isSelCard("waste", 0)) : null}
          </div>
          <div style={{ flex: 1 }} />
          {g.foundations.map((p, i) => (
            <div key={i} onClick={() => clickTarget("foundation", i)} style={slot({ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" })}>
              {p.length ? renderFace(p[p.length - 1], isSelCard("foundation", i)) : <span style={{ fontSize: 20, color: "var(--nv-border-strong)" }}>{SUITS[i]}</span>}
            </div>
          ))}
        </div>

        {/* tableau */}
        <div style={{ display: "flex", gap: 8 }}>
          {g.tableau.map((col, ci) => {
            let top = 0; const positions = col.map((c) => { const t = top; top += c.up ? UP_OFF : DOWN_OFF; return t; });
            const colH = (col.length ? positions[col.length - 1] : 0) + CARD_H;
            return (
              <div key={ci} onClick={() => { if (col.length === 0) clickTarget("tableau", ci, 0); }} style={{ position: "relative", width: CARD_W, minHeight: CARD_H, height: colH, flexShrink: 0 }}>
                {col.length === 0 && <div style={slot({ position: "absolute", top: 0 })} />}
                {col.map((card, ri) => (
                  <div key={card.id} onClick={(e) => { e.stopPropagation(); clickTarget("tableau", ci, ri); }} onDoubleClick={(e) => { e.stopPropagation(); autoFound("tableau", ci, ri); }}
                    style={{ position: "absolute", top: positions[ri], left: 0, width: CARD_W, height: CARD_H, cursor: card.up ? "pointer" : "default" }}>
                    {card.up ? renderFace(card, isSelCard("tableau", ci, ri)) : cardBack()}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* double-click waste to auto-found (hint via dblclick on waste) */}
      {status === "won" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
          <div style={{ textAlign: "center", background: "var(--nv-surface-solid)", border: "1px solid " + bdr(AC), borderRadius: 16, padding: "28px 30px" }}>
            <div style={{ fontSize: 46, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 22, color: "var(--nv-text-strong)" }}>You won!</div>
            <div style={{ fontSize: 14, color: "var(--nv-text-dim)", marginTop: 6 }}>{fmtTime(time)} · {moves} moves</div>
            <button onClick={newGame} style={{ marginTop: 18, padding: "10px 22px", borderRadius: 10, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>New game</button>
          </div>
        </div>
      )}

      {showLb && (
        <div onClick={() => setShowLb(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, maxHeight: "80%", overflowY: "auto", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)" }}>🏆 Fastest wins</div>
              <button onClick={() => setShowLb(false)} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 7, border: "none", background: "var(--nv-hover)", color: "var(--nv-text)", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            {leaders === null ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>Loading…</div>
            ) : leaders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>No wins yet — finish a game!</div>
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

      <div style={{ flexShrink: 0, fontSize: 10.5, color: "var(--nv-text-dim)", textAlign: "center" }}>
        Tap a card then a destination to move · double-click to send to a foundation · tap the stock to deal.
      </div>
    </div>
  );
}

// v7.4 — Online multiplayer chess.
//
// Layout (split-pane like ChatApp):
//   ┌────────────┬────────────────────────┐
//   │ game list  │  board + status        │
//   │  +challenge│                        │
//   │  vs @bob   │  ♚♛♜♝♞♟                 │
//   │  vs @cara  │                        │
//   └────────────┴────────────────────────┘
//
// Click a piece -> see legal-move highlights -> click a destination square to move.
// Moves persist to Firestore via chess-game.js helpers; the opponent's move
// arrives via onSnapshot and the board updates in real time.
//
// Uses chess.js for all rule validation (castling, en-passant, promotion,
// check, checkmate, stalemate, draw detection). We never re-implement chess.

import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { getDbUid } from "../lib/db.js";
import {
  watchMyGames, watchGame, challengeUserByName, persistMove, resignGame, deleteGame,
  describeGameFromUser, describeStatus,
} from "../lib/chess-game.js";

// Unicode pieces — far simpler than image assets, and they look great.
const PIECE_GLYPH = {
  // White
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  // Black
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

// Convert a chess.js board() row/col to a square name like "e4".
function rcToSquare(r, c) {
  return "abcdefgh"[c] + (8 - r);
}

export function ChessApp({ user, AC }) {
  const myUid = getDbUid();

  // ── View routing ───────────────────────────────────────────────────────
  const [view, setView] = useState("list");   // "list" | "game" | "challenge"
  const [activeGameId, setActiveGameId] = useState(null);

  // ── Game-list state ───────────────────────────────────────────────────
  const [games, setGames] = useState([]);
  useEffect(() => {
    if (!myUid) return;
    return watchMyGames(myUid, setGames);
  }, [myUid]);

  // ── Active game state ──────────────────────────────────────────────────
  const [game, setGame] = useState(null);             // the Firestore doc
  const chessRef = useRef(new Chess());                // chess.js instance, kept in sync with the doc
  const [selected, setSelected] = useState(null);     // selected square, e.g. "e2"
  const [legalMoves, setLegalMoves] = useState([]);   // destination squares for selected piece
  const [, forceRender] = useState(0);                // bump to re-render after move

  useEffect(() => {
    if (view !== "game" || !activeGameId) { setGame(null); return; }
    return watchGame(activeGameId, doc => {
      setGame(doc);
      if (doc && doc.fen) {
        // Sync chess.js with the latest FEN. If load() fails (bad data),
        // reset to start position rather than crash.
        try { chessRef.current.load(doc.fen); }
        catch { chessRef.current.reset(); }
        setSelected(null);
        setLegalMoves([]);
        forceRender(n => n + 1);
      }
    });
  }, [view, activeGameId]);

  // ── Challenge form ─────────────────────────────────────────────────────
  const [challengeInput, setChallengeInput] = useState("");
  const [challengeErr, setChallengeErr] = useState("");
  const [challenging, setChallenging] = useState(false);
  async function startChallenge() {
    const name = challengeInput.trim();
    if (!name || challenging) return;
    setChallenging(true);
    setChallengeErr("");
    try {
      const gameId = await challengeUserByName(name, myUid, user);
      setActiveGameId(gameId);
      setView("game");
      setChallengeInput("");
    } catch (e) {
      setChallengeErr(e?.message || "Could not start game.");
    }
    setChallenging(false);
  }

  // ── Move handling ─────────────────────────────────────────────────────
  const { myColor, opponentName, isMyTurn } = describeGameFromUser(game, myUid);
  function onSquareClick(square) {
    if (!game || game.status !== "active" || !isMyTurn) return;
    const chess = chessRef.current;
    const piece = chess.get(square);
    if (selected) {
      // Try to move from selected → square
      if (legalMoves.includes(square)) {
        try {
          // Auto-promote pawn to queen for simplicity (covers 99% of cases).
          const move = chess.move({ from: selected, to: square, promotion: "q" });
          if (move) {
            const newFen = chess.fen();
            const newPgn = chess.pgn();
            // Compute next status based on chess.js
            let nextStatus = "active";
            if (chess.isCheckmate()) nextStatus = myColor === "w" ? "white_wins" : "black_wins";
            else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) nextStatus = "draw";
            persistMove(activeGameId, {
              fen: newFen, pgn: newPgn,
              nextTurn: chess.turn(),
              nextStatus,
            });
            setSelected(null);
            setLegalMoves([]);
            forceRender(n => n + 1);
            return;
          }
        } catch { /* invalid move, fall through */ }
      }
      // Clicked elsewhere — clear selection (or reselect if it's our piece)
      if (piece && piece.color === myColor) {
        setSelected(square);
        const moves = chess.moves({ square, verbose: true }).map(m => m.to);
        setLegalMoves(moves);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
      return;
    }
    // No square selected yet — only allow selecting your own pieces, only on your turn
    if (piece && piece.color === myColor) {
      setSelected(square);
      const moves = chess.moves({ square, verbose: true }).map(m => m.to);
      setLegalMoves(moves);
    }
  }

  function handleResign() {
    if (!game || game.status !== "active") return;
    if (!window.confirm("Resign this game? Your opponent wins.")) return;
    resignGame(activeGameId, myColor);
  }
  function handleDelete() {
    if (!game) return;
    if (!window.confirm("Remove this finished game from your list?")) return;
    deleteGame(activeGameId);
    setActiveGameId(null);
    setView("list");
  }

  // ── Board render ──────────────────────────────────────────────────────
  // chess.board() returns an 8x8 array, row 0 = rank 8 (top, black side).
  // If we're playing black, we visually flip the board so our pieces are at the bottom.
  function renderBoard() {
    const chess = chessRef.current;
    const board = chess.board();
    const flipped = myColor === "b";
    const rows = flipped ? [...board].reverse() : board;
    const indices = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

    return (
      <div style={{
        display: "grid",
        // v7.6: explicitly size both axes to 8 equal tracks. Without
        // gridTemplateRows, empty squares collapsed to ~0 height while
        // occupied squares stretched to fit their piece, making the board
        // look ragged. Now every cell is a true square = boardSize / 8.
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        width: "min(440px, 80vmin)",
        aspectRatio: "1/1",
        border: "2px solid #2a2a3a",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
      }}>
        {rows.map((rowArr, ri) => {
          const actualRow = indices[ri];
          const rowCols = flipped ? [...rowArr].reverse() : rowArr;
          const colIndices = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
          return rowCols.map((square, ci) => {
            const actualCol = colIndices[ci];
            const sqName = rcToSquare(actualRow, actualCol);
            const isLight = (actualRow + actualCol) % 2 === 0;
            const isSelected = selected === sqName;
            const isLegal = legalMoves.includes(sqName);
            const piece = square ? PIECE_GLYPH[square.color === "w" ? square.type.toUpperCase() : square.type] : "";
            // King in check highlight
            const isCheckedKing = chess.inCheck() && square && square.type === "k" && square.color === chess.turn();
            return (
              <div key={sqName}
                onClick={() => onSquareClick(sqName)}
                style={{
                  background: isCheckedKing
                    ? "rgba(255,80,80,0.5)"
                    : isSelected
                      ? "rgba("+hexRgb(AC)+",0.55)"
                      : isLegal
                        ? (isLight ? "rgba(120,220,140,0.4)" : "rgba(120,220,140,0.5)")
                        : isLight ? "#ebd9b4" : "#7a553a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isMyTurn ? "pointer" : "default",
                  fontSize: "clamp(20px, 5.5vmin, 38px)",
                  color: square && square.color === "w" ? "#fff" : "#1a1014",
                  textShadow: square && square.color === "w" ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
                  position: "relative",
                  userSelect: "none",
                }}
                title={sqName}
              >
                {piece}
                {isLegal && !square && (
                  <div style={{ position:"absolute", width:14, height:14, borderRadius:"50%", background:"rgba(40,160,80,0.55)", pointerEvents:"none" }} />
                )}
              </div>
            );
          });
        })}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ width:"100%", height:"100%", display:"flex", fontFamily:FF, minHeight:0 }}>
      {/* Sidebar */}
      <div style={{ width:180, flexShrink:0, borderRight:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", background:"rgba(255,255,255,0.015)" }}>
        <div style={{ padding:"12px 12px 4px", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ ...SEC, marginBottom:0, fontSize:10 }}>Games</span>
          <button onClick={() => { setView("challenge"); setChallengeErr(""); setActiveGameId(null); }}
            title="Challenge a user"
            style={{ marginLeft:"auto", width:20, height:20, borderRadius:4, background: view === "challenge" ? fill(AC) : "rgba(255,255,255,0.06)", border:"1px solid "+(view === "challenge" ? bdr(AC) : "rgba(255,255,255,0.1)"), cursor:"pointer", color: view === "challenge" ? AC : "rgba(255,255,255,0.6)", fontSize:13, fontWeight:700, lineHeight:1, padding:0 }}>+</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"4px 6px" }}>
          {games.length === 0 && (
            <div style={{ padding:"10px 8px", fontSize:10, color:"rgba(255,255,255,0.25)", fontStyle:"italic", lineHeight:1.5 }}>
              No games yet. Tap <strong style={{color:"rgba(255,255,255,0.5)"}}>+</strong> to challenge.
            </div>
          )}
          {games.map(g => {
            const { opponentName, isMyTurn, myColor: c } = describeGameFromUser(g, myUid);
            const isActive = activeGameId === g.id;
            const statusDot = g.status !== "active"
              ? "#aaa"
              : isMyTurn ? "#4cef90" : "#ffaa44";
            return (
              <button key={g.id}
                onClick={() => { setView("game"); setActiveGameId(g.id); }}
                style={{
                  display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2,
                  textAlign:"left", padding:"8px 10px", margin:"2px 0",
                  background: isActive ? "rgba("+hexRgb(AC)+",0.15)" : "transparent",
                  border:"1px solid "+(isActive ? "rgba("+hexRgb(AC)+",0.35)" : "transparent"),
                  borderRadius:6, cursor:"pointer", width:"100%", overflow:"hidden",
                  fontFamily:FF,
                }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, width:"100%" }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:statusDot, flexShrink:0 }} />
                  <span style={{ fontFamily:FFB, fontWeight:600, fontSize:12, color: isActive ? AC : "rgba(255,255,255,0.9)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                    @{opponentName}
                  </span>
                  <span style={{ fontFamily:FFM, fontSize:9, color: c === "w" ? "#fff" : "rgba(255,255,255,0.55)" }}>{c === "w" ? "♔" : "♚"}</span>
                </div>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", lineHeight:1.3 }}>
                  {describeStatus(g, c)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main pane */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"auto", padding:14, minWidth:0 }}>
        {view === "list" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:24 }}>
            <div style={{ fontSize:64, lineHeight:1, marginBottom:12 }}>♟</div>
            <div style={{ fontFamily:FFB, fontWeight:700, fontSize:20, color:"#fff", marginBottom:6 }}>Nova Chess</div>
            <div style={{ fontFamily:FF, fontSize:13, color:"rgba(255,255,255,0.55)", maxWidth:340, lineHeight:1.7, marginBottom:16 }}>
              Play online against any Nova user. Click <strong style={{color:"#fff"}}>+</strong> to challenge someone by username.
            </div>
            <button onClick={() => { setView("challenge"); setChallengeErr(""); }}
              style={{ padding:"9px 22px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:8, cursor:"pointer", fontFamily:FFB, fontWeight:700, fontSize:13, color:AC }}>
              + Challenge a player
            </button>
          </div>
        )}

        {view === "challenge" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
            <div style={{ maxWidth:380, width:"100%", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:54, textAlign:"center", lineHeight:1 }}>♛</div>
              <div style={{ fontFamily:FFB, fontWeight:700, fontSize:20, color:"#fff", textAlign:"center" }}>Challenge a player</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", textAlign:"center", lineHeight:1.6 }}>
                Type any Nova OS user's username. You'll play <strong style={{color:"#fff"}}>white</strong>; they'll get the game in their list once you challenge.
              </div>
              <div style={{ display:"flex", gap:7, marginTop:8 }}>
                <span style={{ display:"flex", alignItems:"center", padding:"0 12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontFamily:FFM, color:"rgba(255,255,255,0.5)", fontSize:14 }}>@</span>
                <input autoFocus value={challengeInput}
                  onChange={e => setChallengeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); startChallenge(); } }}
                  placeholder="username"
                  style={{ ...INP, flex:1 }}/>
                <button onClick={startChallenge}
                  disabled={challenging || !challengeInput.trim()}
                  style={{ padding:"9px 16px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:8, cursor: challenging || !challengeInput.trim() ? "default" : "pointer", fontFamily:FFB, fontWeight:700, fontSize:12, color:AC, opacity: challenging || !challengeInput.trim() ? 0.4 : 1, whiteSpace:"nowrap" }}>
                  {challenging ? "…" : "Challenge"}
                </button>
              </div>
              {challengeErr && (
                <div style={{ color:"#ff8b8b", fontSize:12, textAlign:"center", padding:"8px 12px", background:"rgba(255,80,80,0.08)", border:"1px solid rgba(255,80,80,0.2)", borderRadius:8 }}>⚠ {challengeErr}</div>
              )}
            </div>
          </div>
        )}

        {view === "game" && game && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:14, minHeight:0 }}>
            {/* Status banner */}
            <div style={{ width:"100%", maxWidth:440, padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{myColor === "w" ? "♔" : "♚"}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:FFB, fontWeight:600, fontSize:13, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  vs @{opponentName}
                </div>
                <div style={{ fontFamily:FFM, fontSize:11, color: isMyTurn && game.status === "active" ? "#4cef90" : "rgba(255,255,255,0.5)" }}>
                  {describeStatus(game, myColor)}
                  {chessRef.current.inCheck() && game.status === "active" && <span style={{ color:"#ff8b8b", marginLeft:8 }}>· Check!</span>}
                </div>
              </div>
              {game.status === "active" && (
                <button onClick={handleResign} title="Resign"
                  style={{ padding:"4px 10px", background:"rgba(255,80,80,0.1)", border:"1px solid rgba(255,80,80,0.3)", borderRadius:5, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:10, color:"#ff8b8b" }}>
                  Resign
                </button>
              )}
              {game.status !== "active" && (
                <button onClick={handleDelete} title="Remove game from list"
                  style={{ padding:"4px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:5, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:10, color:"rgba(255,255,255,0.6)" }}>
                  Clear
                </button>
              )}
            </div>

            {renderBoard()}

            {/* PGN (move list) — collapsed by default in tight spaces */}
            {game.pgn && (
              <div style={{ width:"100%", maxWidth:440, padding:"8px 12px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, fontFamily:FFM, fontSize:11, color:"rgba(255,255,255,0.5)", maxHeight:80, overflowY:"auto", lineHeight:1.6, wordBreak:"break-word" }}>
                {game.pgn}
              </div>
            )}
          </div>
        )}

        {view === "game" && !game && activeGameId && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:30, height:30, border:"3px solid rgba(255,255,255,0.1)", borderTopColor:AC, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          </div>
        )}
      </div>
    </div>
  );
}

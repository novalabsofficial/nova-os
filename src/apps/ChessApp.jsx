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

// v9.7 B2 — use the SOLID filled glyphs for BOTH colors (the old set mixed
// outline white pieces ♔ with filled black pieces ♚, which looked
// inconsistent and rendered differently across fonts). Same silhouette for
// both colors; we distinguish purely by fill + outline, the chess.com way.
// The trailing ︎ (variation selector-15) forces TEXT presentation so the
// CSS `color` fill below actually applies. Without it, Windows renders these
// glyphs as emoji (always dark), which made white's pieces look black.
const PIECE_SOLID = { k: "♚︎", q: "♛︎", r: "♜︎", b: "♝︎", n: "♞︎", p: "♟︎" };
const PIECE_VALUE = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };

// chess.com board palette.
const SQ_LIGHT = "#eeeed2";
const SQ_DARK  = "#769656";
const LASTMOVE_LIGHT = "#f6f680";   // yellow last-move tint
const LASTMOVE_DARK  = "#bbcb45";

// Convert a chess.js board() row/col to a square name like "e4".
function rcToSquare(r, c) {
  return "abcdefgh"[c] + (8 - r);
}

// A piece glyph styled like a solid chess.com piece: light fill + dark
// outline for white, dark fill + light outline for black. Rendered in a
// serif face where the chess glyphs are weightiest.
function pieceStyle(color, sizeCss) {
  const white = color === "w";
  return {
    fontFamily: "'Georgia','Times New Roman',serif",
    fontSize: sizeCss,
    lineHeight: 1,
    fontVariantEmoji: "text",   // belt-and-suspenders with the ︎ in PIECE_SOLID
    color: white ? "#f7f7f5" : "#262421",
    textShadow: white
      ? "0 0 1px #1f1f1f,1px 1px 0 #1f1f1f,-1px 1px 0 #1f1f1f,1px -1px 0 #1f1f1f,-1px -1px 0 #1f1f1f"
      : "0 0 1px rgba(255,255,255,0.55),0.5px 0.5px 0 rgba(255,255,255,0.35)",
    userSelect: "none",
    pointerEvents: "none",
  };
}

// Inline SVG chess pieces — colored by `fill`, so white is reliably light and
// black is dark on EVERY platform. (The old Unicode-glyph approach rendered as
// dark emoji on Windows regardless of CSS color, making white pieces look black.)
function ChessPiece({ type, color, size }) {
  const white = color === "w";
  const fillC = white ? "#f4f3ef" : "#3a3733";
  const lineC = white ? "#2a2824" : "#e9e7e1";
  const sz = size || "84%";
  const g = { fill: fillC, stroke: lineC, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" };
  const eye = { fill: lineC, stroke: "none" };
  return (
    <svg viewBox="0 0 45 45" width={sz} height={sz} style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.4))", pointerEvents: "none" }}>
      <g {...g}>
        {type === "p" && (<>
          <circle cx="22.5" cy="13.5" r="5" />
          <path d="M18.5 17 C15.5 20 14.5 26 14.5 32 H30.5 C30.5 26 29.5 20 26.5 17 Z" />
          <rect x="12.5" y="32" width="20" height="5" rx="2" />
        </>)}
        {type === "r" && (<>
          <path d="M13 13 H17 V15.5 H20 V13 H25 V15.5 H28 V13 H32 V20 L29.5 22 V31 L32 33 H13 L15.5 31 V22 L13 20 Z" />
          <rect x="11" y="33" width="23" height="5" rx="2" />
        </>)}
        {type === "b" && (<>
          <circle cx="22.5" cy="8.5" r="2.4" />
          <path d="M22.5 11 C29 15 28.5 26 22.5 30.5 C16.5 26 16 15 22.5 11 Z" />
          <path d="M19.5 18 H25.5 M22.5 15 V21" />
          <rect x="13" y="31" width="19" height="5" rx="2" />
        </>)}
        {type === "n" && (<>
          <path d="M15 37 V30 C15 24 17 20 22 17 C20 15 19.5 12 22 9.5 L24.5 12.5 C29 13.5 32 19 32 27 V37 Z" />
          <circle cx="26.5" cy="18.5" r="1.3" {...eye} />
          <rect x="13" y="36" width="21" height="2.5" rx="1" />
        </>)}
        {type === "q" && (<>
          <circle cx="11.5" cy="13" r="2.1" /><circle cx="18" cy="10.5" r="2.1" /><circle cx="22.5" cy="9.5" r="2.1" /><circle cx="27" cy="10.5" r="2.1" /><circle cx="33.5" cy="13" r="2.1" />
          <path d="M12 13 L15.5 30 H29.5 L33 13 L28 21 L24.5 11.5 L22.5 22 L20.5 11.5 L17 21 Z" />
          <rect x="11.5" y="34" width="22" height="3.5" rx="1.5" />
        </>)}
        {type === "k" && (<>
          <rect x="21.2" y="5" width="2.6" height="8.5" rx="1" />
          <rect x="18.6" y="7.6" width="7.8" height="2.6" rx="1" />
          <path d="M16 32 C16 23.5 22.5 21 22.5 21 C22.5 21 29 23.5 29 32 Z" />
          <rect x="13" y="32" width="19" height="5" rx="2" />
        </>)}
      </g>
    </svg>
  );
}

// Tally captured pieces + material advantage from the live board.
//   capByWhite = black pieces white has taken; capByBlack = vice-versa.
function computeCaptured(chess) {
  const remain = { w: {}, b: {} };
  chess.board().flat().forEach(sq => { if (sq) remain[sq.color][sq.type] = (remain[sq.color][sq.type] || 0) + 1; });
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const capByWhite = [], capByBlack = [];
  let adv = 0;
  for (const t of ["q", "r", "b", "n", "p"]) {
    const missB = (start[t] || 0) - (remain.b[t] || 0);
    const missW = (start[t] || 0) - (remain.w[t] || 0);
    for (let i = 0; i < missB; i++) { capByWhite.push(t); adv += PIECE_VALUE[t]; }
    for (let i = 0; i < missW; i++) { capByBlack.push(t); adv -= PIECE_VALUE[t]; }
  }
  return { capByWhite, capByBlack, adv };
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
    // last-move squares (yellow tint, chess.com style)
    const hist = (() => { try { return chess.history({ verbose: true }); } catch { return []; } })();
    const last = hist.length ? hist[hist.length - 1] : null;

    return (
      <div style={{
        display: "grid",
        // minmax(0,1fr) forces equal cells regardless of contents (see the
        // v9.3 board-sizing fix).
        gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
        gridTemplateRows: "repeat(8, minmax(0, 1fr))",
        width: isMobile ? "min(94vw, 62vh)" : "min(440px, 80vmin)",
        aspectRatio: "1/1",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 10px 36px rgba(0,0,0,0.45)",
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
            const isLast = last && (last.from === sqName || last.to === sqName);
            const piece = square ? PIECE_SOLID[square.type] : "";
            const isCheckedKing = chess.inCheck() && square && square.type === "k" && square.color === chess.turn();
            // coordinate labels: file on the bottom row, rank on the first column
            const showFile = ri === 7;
            const showRank = ci === 0;
            const labelColor = isLight ? "rgba(90,110,70,0.9)" : "rgba(235,238,210,0.85)";
            let bg = isLight ? SQ_LIGHT : SQ_DARK;
            if (isLast) bg = isLight ? LASTMOVE_LIGHT : LASTMOVE_DARK;
            if (isSelected) bg = isLight ? "#f4f67e" : "#b9cb45";
            if (isCheckedKing) bg = "radial-gradient(circle, rgba(255,70,70,0.95) 30%, rgba(220,40,40,0.55) 75%)";
            return (
              <div key={sqName}
                onClick={() => onSquareClick(sqName)}
                style={{
                  background: bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: isMyTurn ? "pointer" : "default",
                  position: "relative",
                }}
                title={sqName}
              >
                {square && <ChessPiece type={square.type} color={square.color} />}
                {/* legal-move dot (empty square) or capture ring (occupied) */}
                {isLegal && !square && (
                  <div style={{ position:"absolute", width:"30%", height:"30%", borderRadius:"50%", background:"rgba(0,0,0,0.22)", pointerEvents:"none" }} />
                )}
                {isLegal && square && (
                  <div style={{ position:"absolute", inset:"6%", borderRadius:"50%", border:"4px solid rgba(0,0,0,0.22)", pointerEvents:"none" }} />
                )}
                {showFile && <span style={{ position:"absolute", right:2, bottom:1, fontSize:"clamp(7px,1.5vmin,10px)", fontFamily:FFB, fontWeight:700, color:labelColor, pointerEvents:"none" }}>{"abcdefgh"[actualCol]}</span>}
                {showRank && <span style={{ position:"absolute", left:2, top:1, fontSize:"clamp(7px,1.5vmin,10px)", fontFamily:FFB, fontWeight:700, color:labelColor, pointerEvents:"none" }}>{8 - actualRow}</span>}
              </div>
            );
          });
        })}
      </div>
    );
  }

  // Captured-pieces tray for one player (chess.com style). `pieces` is an
  // array of piece-type chars; `adv` (when > 0) shows the material lead.
  function CapturedTray({ pieces, color, adv }) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:1, minHeight:18, flexWrap:"wrap" }}>
        {pieces.length === 0 && <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontFamily:FFM }}>—</span>}
        {pieces.map((t, i) => (
          <span key={i} style={{ marginRight:-3, display:"inline-flex" }}><ChessPiece type={t} color={color} size={16} /></span>
        ))}
        {adv > 0 && <span style={{ marginLeft:6, fontFamily:FFM, fontSize:11, color:"rgba(255,255,255,0.55)" }}>+{adv}</span>}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  // Mobile: stack the games list above the board so the board can use the full
  // width (the desktop side-by-side layout cut the board in half on a phone).
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;
  return (
    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection: isMobile ? "column" : "row", fontFamily:FF, minHeight:0 }}>
      {/* Sidebar */}
      <div style={{ width: isMobile ? "100%" : 180, flexShrink:0, maxHeight: isMobile ? 150 : "none", borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)", borderBottom: isMobile ? "1px solid rgba(255,255,255,0.07)" : "none", display:"flex", flexDirection:"column", background:"rgba(255,255,255,0.015)" }}>
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
                  <ChessPiece type="k" color={c} size={13} />
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

        {view === "game" && game && (() => {
          const cap = computeCaptured(chessRef.current);
          const oppColor = myColor === "w" ? "b" : "w";
          // Tray for a player: the glyphs they've captured (opponent's color),
          // plus their material lead if any.
          const trayFor = (playerColor) => playerColor === "w"
            ? { pieces: cap.capByWhite, glyphColor: "b", adv: cap.adv > 0 ? cap.adv : 0 }
            : { pieces: cap.capByBlack, glyphColor: "w", adv: cap.adv < 0 ? -cap.adv : 0 };
          const myTray = trayFor(myColor), oppTray = trayFor(oppColor);
          const moves = (() => { try { return chessRef.current.history(); } catch { return []; } })();
          // Pair up SAN moves into [white, black] rows for the move list.
          const pairs = [];
          for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);
          const playerRow = (name, color, tray, youTag) => (
            <div style={{ width:"100%", maxWidth:440, display:"flex", alignItems:"center", gap:10, padding:"6px 4px" }}>
              <div style={{ width:30, height:30, borderRadius:7, flexShrink:0, background: color==="w"?"#f0f0ec":"#2b2926", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <ChessPiece type="k" color={color} size={18} />
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:FFB, fontWeight:600, fontSize:12.5, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>@{name}{youTag && <span style={{ marginLeft:6, fontSize:9, color:AC, fontFamily:FFM }}>YOU</span>}</div>
                <CapturedTray pieces={tray.pieces} color={tray.glyphColor} adv={tray.adv} />
              </div>
            </div>
          );
          return (
          <div style={{ flex:1, display:"flex", gap:16, minHeight:0, flexWrap:"wrap", justifyContent:"center", alignItems:"flex-start" }}>
            {/* Board column */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              {playerRow(opponentName, oppColor, oppTray, false)}
              {renderBoard()}
              {playerRow(user, myColor, myTray, true)}
            </div>

            {/* Right panel: status + move history + actions */}
            <div style={{ width:220, maxWidth:"100%", display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ padding:"10px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9 }}>
                <div style={{ fontFamily:FFB, fontWeight:700, fontSize:13, color:"#fff" }}>{describeStatus(game, myColor)}</div>
                <div style={{ fontFamily:FFM, fontSize:11, color: isMyTurn && game.status==="active" ? "#4cef90" : "rgba(255,255,255,0.5)", marginTop:2 }}>
                  {game.status === "active" ? (isMyTurn ? "Your move" : "Waiting…") : "Game over"}
                  {chessRef.current.inCheck() && game.status === "active" && <span style={{ color:"#ff8b8b", marginLeft:6 }}>Check!</span>}
                </div>
              </div>

              {/* Move history — chess.com-style two-column list */}
              <div style={{ flex:1, minHeight:120, maxHeight:300, overflowY:"auto", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9, padding:"4px 0" }}>
                <div style={{ fontFamily:FFB, fontWeight:700, fontSize:9.5, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", padding:"6px 12px 4px" }}>Moves</div>
                {pairs.length === 0 ? (
                  <div style={{ padding:"8px 12px", fontSize:11, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>No moves yet</div>
                ) : pairs.map((pr, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"28px 1fr 1fr", gap:4, padding:"3px 12px", background: i%2 ? "transparent" : "rgba(255,255,255,0.025)", fontFamily:FFM, fontSize:12 }}>
                    <span style={{ color:"rgba(255,255,255,0.35)" }}>{i+1}.</span>
                    <span style={{ color:"rgba(255,255,255,0.88)" }}>{pr[0]}</span>
                    <span style={{ color:"rgba(255,255,255,0.88)" }}>{pr[1] || ""}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:8 }}>
                {game.status === "active" ? (
                  <button onClick={handleResign} style={{ flex:1, padding:"8px 10px", background:"rgba(255,80,80,0.1)", border:"1px solid rgba(255,80,80,0.3)", borderRadius:7, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:11.5, color:"#ff8b8b" }}>Resign</button>
                ) : (
                  <button onClick={handleDelete} style={{ flex:1, padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:7, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:11.5, color:"rgba(255,255,255,0.6)" }}>Clear game</button>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {view === "game" && !game && activeGameId && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:30, height:30, border:"3px solid rgba(255,255,255,0.1)", borderTopColor:AC, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          </div>
        )}
      </div>
    </div>
  );
}

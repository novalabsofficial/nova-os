// v7.4 — Tic-Tac-Toe with unbeatable minimax AI.
//
// The board is a flat array of 9 cells: null | "X" | "O". Index layout:
//   0 1 2
//   3 4 5
//   6 7 8
//
// Player is X (always goes first). AI is O. Minimax searches the full tree
// (max depth = 9, trivial for 3x3) so the AI never loses — best case is a
// draw, which is achievable if the player also plays optimally.

import { useState, useEffect } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const LINES = [
  [0,1,2], [3,4,5], [6,7,8],   // rows
  [0,3,6], [1,4,7], [2,5,8],   // cols
  [0,4,8], [2,4,6],            // diags
];

// Returns "X" | "O" | "draw" | null (still playing).
function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.every(cell => cell !== null) ? "draw" : null;
}

// Score the board from the AI's perspective (O). +10 = AI wins, -10 = player wins.
// Depth offset makes the AI prefer faster wins / slower losses.
function minimax(board, isAiTurn, depth) {
  const winner = checkWinner(board);
  if (winner === "O") return 10 - depth;
  if (winner === "X") return depth - 10;
  if (winner === "draw") return 0;

  if (isAiTurn) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = "O";
        best = Math.max(best, minimax(board, false, depth + 1));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = "X";
        best = Math.min(best, minimax(board, true, depth + 1));
        board[i] = null;
      }
    }
    return best;
  }
}

function bestAiMove(board) {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = "O";
      const score = minimax(board, false, 0);
      board[i] = null;
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
  }
  return bestMove;
}

export function TicTacToeApp({ AC }) {
  const [board, setBoard] = useState(() => Array(9).fill(null));
  const [turn, setTurn]   = useState("X");     // "X" (player) or "O" (AI)
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const winner = checkWinner(board);

  // AI moves automatically when it's O's turn and the game isn't over.
  // Tiny delay (~280ms) so it doesn't feel like the AI is reading the player's mind.
  useEffect(() => {
    if (winner || turn !== "O") return;
    const t = setTimeout(() => {
      const next = [...board];
      const move = bestAiMove(next);
      if (move !== -1) {
        next[move] = "O";
        setBoard(next);
        setTurn("X");
      }
    }, 280);
    return () => clearTimeout(t);
  }, [turn, board, winner]);

  // When a game ends, update the running scoreboard once.
  useEffect(() => {
    if (!winner) return;
    setStats(s => ({
      wins:   s.wins   + (winner === "X" ? 1 : 0),
      losses: s.losses + (winner === "O" ? 1 : 0),
      draws:  s.draws  + (winner === "draw" ? 1 : 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  function handleClick(i) {
    if (winner || turn !== "X" || board[i] !== null) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setTurn("O");
  }

  function resetGame() {
    setBoard(Array(9).fill(null));
    setTurn("X");
  }

  // Highlight the winning line if there is one.
  const winningLine = winner && winner !== "draw"
    ? LINES.find(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c])
    : null;

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:14, fontFamily:FF }}>
      <div style={SEC}>Tic-Tac-Toe</div>

      {/* Status line */}
      <div style={{ fontFamily:FFB, fontWeight:600, fontSize:14, color:"rgba(255,255,255,0.85)", textAlign:"center", minHeight:20 }}>
        {winner === "X"    && <span style={{ color:"#4cef90" }}>You win! 🎉</span>}
        {winner === "O"    && <span style={{ color:"#ff8b8b" }}>AI wins. 🤖</span>}
        {winner === "draw" && <span style={{ color:"#ffd060" }}>Draw — well played.</span>}
        {!winner && (turn === "X"
          ? <span>Your turn (X)</span>
          : <span style={{ opacity:0.6 }}>AI is thinking…</span>)}
      </div>

      {/* Board */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 80px)", gridTemplateRows:"repeat(3, 80px)", gap:6 }}>
        {board.map((cell, i) => {
          const isWin = winningLine && winningLine.includes(i);
          return (
            <button key={i} onClick={() => handleClick(i)}
              disabled={!!cell || !!winner || turn !== "X"}
              style={{
                width:80, height:80,
                background: isWin ? fill(AC) : "rgba(255,255,255,0.06)",
                border: "1px solid " + (isWin ? bdr(AC) : "rgba(255,255,255,0.12)"),
                borderRadius: 10,
                cursor: (cell || winner || turn !== "X") ? "default" : "pointer",
                fontFamily: FFB, fontWeight: 700, fontSize: 42,
                color: cell === "X" ? "#a8c5ff" : cell === "O" ? "#ff8b8b" : "transparent",
                transition: "background 0.12s, transform 0.12s",
              }}
              onPointerEnter={e => { if (!cell && !winner && turn === "X") e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
              onPointerLeave={e => { if (!isWin) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              {cell || ""}
            </button>
          );
        })}
      </div>

      {/* Scoreboard */}
      <div style={{ display:"flex", gap:14, marginTop:4 }}>
        {[["Wins", stats.wins, "#4cef90"], ["Losses", stats.losses, "#ff8b8b"], ["Draws", stats.draws, "#ffd060"]].map(([lbl, val, col]) => (
          <div key={lbl} style={{ textAlign:"center", minWidth:48 }}>
            <div style={{ fontFamily:FFM, fontSize:18, color: col, fontWeight:600 }}>{val}</div>
            <div style={{ fontFamily:FF, fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:1 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Reset */}
      <button onClick={resetGame}
        style={{ padding:"7px 18px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:7, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:12, color:AC, marginTop:4 }}>
        {winner ? "New Game" : "Restart"}
      </button>

      <div style={{ fontFamily:FF, fontStyle:"italic", fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", maxWidth:240, lineHeight:1.5, marginTop:8 }}>
        You're <span style={{color:"#a8c5ff"}}>X</span> — the AI plays optimal moves, so the best you can do is force a draw.
      </div>
    </div>
  );
}

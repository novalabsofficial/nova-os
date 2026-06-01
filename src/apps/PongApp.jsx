// v7.4 — Classic Pong.
// v9.7 B1 — added local 2-player (hot-seat): one player uses W/S, the other
// uses the arrow keys, both on the same device. No networking, no Firebase —
// the simplest, most reliable "multiplayer" for a shared screen.
//
// Game loop runs at ~60 FPS via requestAnimationFrame. Ball reflects off the
// top/bottom walls and either paddle. First to 7 wins.
//
// Controls:
//   1-player (vs AI): W/S or ↑/↓ move the left paddle; AI plays the right.
//   2-player (local): W/S move the LEFT paddle, ↑/↓ move the RIGHT paddle.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const CW = 640, CH = 400;
const PADDLE_H = 70, PADDLE_W = 8;
const BALL_R = 6;
const TARGET_SCORE = 7;

const AI_SPEEDS = { easy: 1.8, normal: 3.0, hard: 4.2 };
const AI_DEADZONE = 12;

export function PongApp({ AC }) {
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [winner, setWinner] = useState(null);   // "left" | "right" | null
  const [difficulty, setDifficulty] = useState("normal");
  const [mode, setMode] = useState("ai");        // "ai" | "2p"

  const stateRef = useRef(initGame());
  // Track each physical key independently so we can route them per-mode.
  const keysRef  = useRef({ w: false, s: false, up: false, down: false });
  // Mobile: drag-to-move paddle targets (internal canvas Y, or null when no touch).
  const touchRef = useRef({ L: null, R: null });
  const aiSpeedRef = useRef(AI_SPEEDS.normal);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  function initGame() {
    return {
      ball:    { x: CW/2, y: CH/2, vx: 0, vy: 0 },
      leftY:   CH/2 - PADDLE_H/2,
      rightY:  CH/2 - PADDLE_H/2,
      serveTo: 1,
    };
  }

  useEffect(() => {
    function onDown(e) {
      if (e.key === "w" || e.key === "W") keysRef.current.w = true;
      if (e.key === "s" || e.key === "S") keysRef.current.s = true;
      if (e.key === "ArrowUp")   keysRef.current.up = true;
      if (e.key === "ArrowDown") keysRef.current.down = true;
      if (["w","W","s","S","ArrowUp","ArrowDown"].includes(e.key)) e.preventDefault();
    }
    function onUp(e) {
      if (e.key === "w" || e.key === "W") keysRef.current.w = false;
      if (e.key === "s" || e.key === "S") keysRef.current.s = false;
      if (e.key === "ArrowUp")   keysRef.current.up = false;
      if (e.key === "ArrowDown") keysRef.current.down = false;
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  useEffect(() => { aiSpeedRef.current = AI_SPEEDS[difficulty]; }, [difficulty]);

  useEffect(() => {
    if (!running || winner) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    // Mobile touch controls: drag on the board to move a paddle. 1-player drags
    // the left paddle anywhere; 2-player splits left/right halves of the board.
    canvas.style.touchAction = "none";
    const ptrs = new Map();
    const setTarget = (side, clientY) => {
      const r = canvas.getBoundingClientRect();
      const y = (clientY - r.top) * (CH / r.height);
      touchRef.current[side] = Math.max(0, Math.min(CH - PADDLE_H, y - PADDLE_H / 2));
    };
    const pDown = (e) => { const r = canvas.getBoundingClientRect(); const side = (modeRef.current !== "2p" || (e.clientX - r.left) < r.width / 2) ? "L" : "R"; ptrs.set(e.pointerId, side); setTarget(side, e.clientY); e.preventDefault(); };
    const pMove = (e) => { const side = ptrs.get(e.pointerId); if (side) { setTarget(side, e.clientY); e.preventDefault(); } };
    const pUp = (e) => { const side = ptrs.get(e.pointerId); if (side) { touchRef.current[side] = null; ptrs.delete(e.pointerId); } };
    canvas.addEventListener("pointerdown", pDown);
    canvas.addEventListener("pointermove", pMove);
    canvas.addEventListener("pointerup", pUp);
    canvas.addEventListener("pointercancel", pUp);

    function serve() {
      const s = stateRef.current;
      s.ball.x = CW / 2;
      s.ball.y = CH / 2;
      s.ball.vx = 5 * s.serveTo;
      s.ball.vy = (Math.random() - 0.5) * 6;
    }
    if (stateRef.current.ball.vx === 0) serve();

    function frame() {
      const s = stateRef.current;
      const k = keysRef.current;
      const twoP = modeRef.current === "2p";

      // LEFT paddle — W/S always. In 1-player mode, arrows also drive it
      // (so a solo player can use either hand). In 2-player mode arrows are
      // reserved for the right paddle.
      const leftUp   = k.w || (!twoP && k.up);
      const leftDown = k.s || (!twoP && k.down);
      if (leftUp)   s.leftY -= 6;
      if (leftDown) s.leftY += 6;
      s.leftY = Math.max(0, Math.min(CH - PADDLE_H, s.leftY));

      // RIGHT paddle — human (arrows) in 2-player, AI otherwise.
      if (twoP) {
        if (k.up)   s.rightY -= 6;
        if (k.down) s.rightY += 6;
      } else {
        const aiCenter = s.rightY + PADDLE_H / 2;
        const dy = s.ball.y - aiCenter;
        const aiSpeed = aiSpeedRef.current;
        const chasing = s.ball.vx > 0;
        const reactSpeed = chasing ? aiSpeed : aiSpeed * 0.45;
        if (Math.abs(dy) > AI_DEADZONE) s.rightY += Math.sign(dy) * Math.min(Math.abs(dy), reactSpeed);
      }
      s.rightY = Math.max(0, Math.min(CH - PADDLE_H, s.rightY));

      // Touch drag (mobile) snaps a paddle straight to the finger.
      if (touchRef.current.L != null) s.leftY = touchRef.current.L;
      if (twoP && touchRef.current.R != null) s.rightY = touchRef.current.R;

      // Ball physics.
      s.ball.x += s.ball.vx;
      s.ball.y += s.ball.vy;
      if (s.ball.y - BALL_R < 0)  { s.ball.y = BALL_R;      s.ball.vy *= -1; }
      if (s.ball.y + BALL_R > CH) { s.ball.y = CH - BALL_R; s.ball.vy *= -1; }

      if (s.ball.x - BALL_R < PADDLE_W && s.ball.y > s.leftY && s.ball.y < s.leftY + PADDLE_H && s.ball.vx < 0) {
        s.ball.x = PADDLE_W + BALL_R;
        s.ball.vx *= -1.05;
        const hit = (s.ball.y - (s.leftY + PADDLE_H/2)) / (PADDLE_H/2);
        s.ball.vy = hit * 5;
      }
      if (s.ball.x + BALL_R > CW - PADDLE_W && s.ball.y > s.rightY && s.ball.y < s.rightY + PADDLE_H && s.ball.vx > 0) {
        s.ball.x = CW - PADDLE_W - BALL_R;
        s.ball.vx *= -1.05;
        const hit = (s.ball.y - (s.rightY + PADDLE_H/2)) / (PADDLE_H/2);
        s.ball.vy = hit * 5;
      }

      if (s.ball.x < 0)  { setScore(sc => ({ ...sc, right: sc.right + 1 })); s.serveTo = -1; serve(); }
      if (s.ball.x > CW) { setScore(sc => ({ ...sc, left:  sc.left  + 1 })); s.serveTo = 1;  serve(); }

      // Draw
      ctx.fillStyle = "#020310";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let y = 6; y < CH; y += 16) ctx.fillRect(CW/2 - 1, y, 2, 8);
      ctx.fillStyle = "#a8c5ff";
      ctx.fillRect(0, s.leftY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#ff8b8b";
      ctx.fillRect(CW - PADDLE_W, s.rightY, PADDLE_W, PADDLE_H);
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", pDown);
      canvas.removeEventListener("pointermove", pMove);
      canvas.removeEventListener("pointerup", pUp);
      canvas.removeEventListener("pointercancel", pUp);
    };
  }, [running, winner]);

  useEffect(() => {
    if (score.left  >= TARGET_SCORE) { setWinner("left");  setRunning(false); }
    if (score.right >= TARGET_SCORE) { setWinner("right"); setRunning(false); }
  }, [score]);

  function startGame() {
    stateRef.current = initGame();
    setScore({ left: 0, right: 0 });
    setWinner(null);
    setRunning(true);
  }

  // Labels depend on mode.
  const leftLabel  = mode === "2p" ? "P1" : "You";
  const rightLabel = mode === "2p" ? "P2" : "AI";
  const winnerText = winner === "left"
    ? (mode === "2p" ? "Player 1 wins! 🏓" : "You win! 🏓")
    : (mode === "2p" ? "Player 2 wins! 🏓" : "AI wins. 🤖");

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:10, fontFamily:FF }}>
      <div style={SEC}>Pong</div>

      {/* Mode toggle */}
      <div style={{ display:"flex", gap:4, padding:3, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:7 }}>
        {[{id:"ai",label:"1 Player"},{id:"2p",label:"2 Players"}].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setRunning(false); setWinner(null); setScore({left:0,right:0}); }}
            style={{ padding:"5px 14px", background: mode === m.id ? fill(AC) : "transparent", border:"none", borderRadius:5, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:11, color: mode === m.id ? AC : "rgba(255,255,255,0.55)", letterSpacing:0.5 }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Score */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:24, fontFamily:FFM }}>
        <div style={{ textAlign:"right", minWidth:54 }}>
          <div style={{ fontSize:11, color:"#a8c5ff", letterSpacing:1, fontFamily:FFB }}>{leftLabel}</div>
          <div style={{ fontSize:32, color:"#a8c5ff" }}>{score.left}</div>
        </div>
        <span style={{ color:"rgba(255,255,255,0.3)", fontSize:18 }}>:</span>
        <div style={{ textAlign:"left", minWidth:54 }}>
          <div style={{ fontSize:11, color:"#ff8b8b", letterSpacing:1, fontFamily:FFB }}>{rightLabel}</div>
          <div style={{ fontSize:32, color:"#ff8b8b" }}>{score.right}</div>
        </div>
      </div>
      {winner && (
        <div style={{ fontFamily:FFB, fontWeight:700, fontSize:16, color: winner === "left" ? "#a8c5ff" : "#ff8b8b" }}>
          {winnerText}
        </div>
      )}

      <canvas ref={canvasRef} width={CW} height={CH}
        style={{ width:"100%", maxWidth:520, aspectRatio: CW + "/" + CH, background:"#020310", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, display:"block" }}
      />

      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4, flexWrap:"wrap", justifyContent:"center" }}>
        {/* Difficulty only matters vs the AI */}
        {mode === "ai" && (
          <div style={{ display:"flex", gap:4, padding:3, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6 }}>
            {["easy","normal","hard"].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                style={{ padding:"4px 10px", background: difficulty === d ? fill(AC) : "transparent", border:"none", borderRadius:4, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:10, color: difficulty === d ? AC : "rgba(255,255,255,0.55)", textTransform:"uppercase", letterSpacing:1 }}>
                {d}
              </button>
            ))}
          </div>
        )}
        <button onClick={startGame}
          style={{ padding:"7px 18px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:7, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:12, color:AC }}>
          {winner ? "New Game" : (running ? "Restart" : "Start")}
        </button>
      </div>

      <div style={{ fontFamily:FF, fontStyle:"italic", fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", maxWidth:360, lineHeight:1.5, marginTop:6 }}>
        {mode === "2p"
          ? <>Left player: <strong style={{color:"#a8c5ff"}}>W / S</strong> · Right player: <strong style={{color:"#ff8b8b"}}>↑ / ↓</strong> · First to {TARGET_SCORE} wins.</>
          : <>Move with <strong style={{color:"rgba(255,255,255,0.55)"}}>W/S</strong> or arrow keys. First to {TARGET_SCORE} wins.</>}
      </div>
    </div>
  );
}

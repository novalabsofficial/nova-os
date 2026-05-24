// v7.4 — Classic Pong, single-player vs AI paddle.
//
// Game loop runs at ~60 FPS via requestAnimationFrame. Ball reflects off the
// top/bottom walls and either paddle. If it passes a paddle, the opposing
// side scores. First to 7 wins.
//
// Controls: W/S or ↑/↓ for the left paddle. AI controls the right paddle by
// tracking ball.y with a deadzone + speed cap (otherwise it'd be unbeatable).

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// Logical canvas size. The displayed canvas is scaled by CSS so the game
// stays crisp regardless of window size, and the physics stay deterministic.
const CW = 640, CH = 400;
const PADDLE_H = 70, PADDLE_W = 8;
const BALL_R = 6;
const TARGET_SCORE = 7;

// AI difficulty: lower = beatable. The paddle moves at most this many pixels
// per frame, so a fast ball can outrun it. Tuned down in v7.4 so that even
// "hard" doesn't perfectly track every shot — points actually happen.
const AI_SPEEDS = { easy: 1.8, normal: 3.0, hard: 4.2 };
// Deadzone (px) — AI ignores ball movement smaller than this. Wider = lazier.
const AI_DEADZONE = 12;

export function PongApp({ AC }) {
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [winner, setWinner] = useState(null);   // "player" | "ai" | null
  const [difficulty, setDifficulty] = useState("normal");

  // All mutable game state lives in refs so the render loop doesn't trigger
  // re-renders 60 times a second. React state is only used for things the
  // UI needs to display: score, winner, running flag.
  const stateRef = useRef(initGame());
  const keysRef  = useRef({ up: false, down: false });
  const aiSpeedRef = useRef(AI_SPEEDS.normal);

  function initGame() {
    return {
      ball:    { x: CW/2, y: CH/2, vx: 0, vy: 0 },
      leftY:   CH/2 - PADDLE_H/2,
      rightY:  CH/2 - PADDLE_H/2,
      serveTo: 1,   // +1 = serve right (toward AI), -1 = serve left
    };
  }

  // Keyboard input — global listener while the app is mounted. We track
  // key state in a ref so the render loop reads the latest values without
  // re-attaching the listener.
  useEffect(() => {
    function onDown(e) {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp")   keysRef.current.up = true;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.down = true;
      if (["w","W","s","S","ArrowUp","ArrowDown"].includes(e.key)) e.preventDefault();
    }
    function onUp(e) {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp")   keysRef.current.up = false;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.down = false;
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  // Update AI speed ref when difficulty changes.
  useEffect(() => { aiSpeedRef.current = AI_SPEEDS[difficulty]; }, [difficulty]);

  // Main loop — only runs while `running` is true. requestAnimationFrame
  // self-throttles to the display's refresh rate (usually 60Hz).
  useEffect(() => {
    if (!running || winner) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    // Serve the ball at the start of a point — random Y velocity, X direction
    // toward whoever conceded last (or random for the first serve).
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

      // Player paddle — discrete up/down based on keys held.
      if (k.up)   s.leftY -= 6;
      if (k.down) s.leftY += 6;
      s.leftY = Math.max(0, Math.min(CH - PADDLE_H, s.leftY));

      // AI paddle — track ball Y with a speed cap. Wider deadzone (AI_DEADZONE)
      // means it doesn't react to tiny movements, so well-angled shots beat it.
      // It also only chases while the ball is heading toward it, which means
      // it doesn't pre-position perfectly during the player's volley.
      const aiCenter = s.rightY + PADDLE_H / 2;
      const dy = s.ball.y - aiCenter;
      const aiSpeed = aiSpeedRef.current;
      const chasing = s.ball.vx > 0;            // ball moving toward AI
      const reactSpeed = chasing ? aiSpeed : aiSpeed * 0.45;
      if (Math.abs(dy) > AI_DEADZONE) s.rightY += Math.sign(dy) * Math.min(Math.abs(dy), reactSpeed);
      s.rightY = Math.max(0, Math.min(CH - PADDLE_H, s.rightY));

      // Ball physics.
      s.ball.x += s.ball.vx;
      s.ball.y += s.ball.vy;

      // Top/bottom wall reflection
      if (s.ball.y - BALL_R < 0)        { s.ball.y = BALL_R;        s.ball.vy *= -1; }
      if (s.ball.y + BALL_R > CH)       { s.ball.y = CH - BALL_R;   s.ball.vy *= -1; }

      // Left paddle reflection
      if (s.ball.x - BALL_R < PADDLE_W && s.ball.y > s.leftY && s.ball.y < s.leftY + PADDLE_H && s.ball.vx < 0) {
        s.ball.x = PADDLE_W + BALL_R;
        s.ball.vx *= -1.05;                                   // slight speed-up each volley
        const hit = (s.ball.y - (s.leftY + PADDLE_H/2)) / (PADDLE_H/2);
        s.ball.vy = hit * 5;                                   // angle based on where it hit
      }
      // Right paddle reflection
      if (s.ball.x + BALL_R > CW - PADDLE_W && s.ball.y > s.rightY && s.ball.y < s.rightY + PADDLE_H && s.ball.vx > 0) {
        s.ball.x = CW - PADDLE_W - BALL_R;
        s.ball.vx *= -1.05;
        const hit = (s.ball.y - (s.rightY + PADDLE_H/2)) / (PADDLE_H/2);
        s.ball.vy = hit * 5;
      }

      // Scoring
      if (s.ball.x < 0)  { setScore(sc => ({ ...sc, ai: sc.ai + 1 }));     s.serveTo = -1; serve(); }
      if (s.ball.x > CW) { setScore(sc => ({ ...sc, player: sc.player+1 }));s.serveTo = 1;  serve(); }

      // Draw
      ctx.fillStyle = "#020310";
      ctx.fillRect(0, 0, CW, CH);
      // Dashed center line
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let y = 6; y < CH; y += 16) ctx.fillRect(CW/2 - 1, y, 2, 8);
      // Paddles
      ctx.fillStyle = "#a8c5ff";
      ctx.fillRect(0, s.leftY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#ff8b8b";
      ctx.fillRect(CW - PADDLE_W, s.rightY, PADDLE_W, PADDLE_H);
      // Ball with subtle glow
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
    return () => cancelAnimationFrame(raf);
  }, [running, winner]);

  // Watch the score for a winner.
  useEffect(() => {
    if (score.player >= TARGET_SCORE) { setWinner("player"); setRunning(false); }
    if (score.ai     >= TARGET_SCORE) { setWinner("ai");     setRunning(false); }
  }, [score]);

  function startGame() {
    stateRef.current = initGame();
    setScore({ player: 0, ai: 0 });
    setWinner(null);
    setRunning(true);
  }

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:10, fontFamily:FF }}>
      <div style={SEC}>Pong</div>

      {/* Score + winner */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:30, fontFamily:FFM, fontSize:32, color:"#fff", letterSpacing:3 }}>
        <span style={{ color:"#a8c5ff", minWidth:30, textAlign:"right" }}>{score.player}</span>
        <span style={{ color:"rgba(255,255,255,0.3)", fontSize:18 }}>:</span>
        <span style={{ color:"#ff8b8b", minWidth:30, textAlign:"left" }}>{score.ai}</span>
      </div>
      {winner && (
        <div style={{ fontFamily:FFB, fontWeight:700, fontSize:16, color: winner === "player" ? "#4cef90" : "#ff8b8b" }}>
          {winner === "player" ? "You win! 🏓" : "AI wins. 🤖"}
        </div>
      )}

      {/* Canvas — fixed aspect via inline style, crisp via integer scaling */}
      <canvas ref={canvasRef} width={CW} height={CH}
        style={{ width:"100%", maxWidth:520, aspectRatio: CW + "/" + CH, background:"#020310", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, display:"block" }}
      />

      {/* Controls strip */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4, flexWrap:"wrap", justifyContent:"center" }}>
        {/* Difficulty toggle */}
        <div style={{ display:"flex", gap:4, padding:3, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6 }}>
          {["easy","normal","hard"].map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              style={{ padding:"4px 10px", background: difficulty === d ? fill(AC) : "transparent", border:"none", borderRadius:4, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:10, color: difficulty === d ? AC : "rgba(255,255,255,0.55)", textTransform:"uppercase", letterSpacing:1 }}>
              {d}
            </button>
          ))}
        </div>

        <button onClick={startGame}
          style={{ padding:"7px 18px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:7, cursor:"pointer", fontFamily:FFB, fontWeight:600, fontSize:12, color:AC }}>
          {winner ? "New Game" : (running ? "Restart" : "Start")}
        </button>
      </div>

      <div style={{ fontFamily:FF, fontStyle:"italic", fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", maxWidth:340, lineHeight:1.5, marginTop:6 }}>
        Move with <strong style={{color:"rgba(255,255,255,0.55)"}}>W/S</strong> or arrow keys. First to {TARGET_SCORE} wins.
      </div>
    </div>
  );
}

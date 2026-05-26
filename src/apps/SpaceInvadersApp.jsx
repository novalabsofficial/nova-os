// v7.4 — Space Invaders, light remake.
//
// 5×8 grid of aliens that march left/right and step down at the edges. Player
// at the bottom shoots upward with Space. Aliens occasionally drop bombs.
// First to clear a wave: spawns a faster wave. Get hit or aliens reach you:
// lose a life. Out of lives: game over.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const CW = 520, CH = 560;
const PLAYER_W = 36, PLAYER_H = 14;
const ALIEN_W = 28, ALIEN_H = 20;
const ALIEN_COLS = 8, ALIEN_ROWS = 5;
const ALIEN_GAP_X = 12, ALIEN_GAP_Y = 14;
const ALIEN_OFFSET_X = 40, ALIEN_OFFSET_Y = 60;

export function SpaceInvadersApp({ AC, data, updateSettings }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const keysRef   = useRef({ left: false, right: false, fire: false });
  const [phase, setPhase] = useState("title");   // "title" | "playing" | "gameover"
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave,  setWave]  = useState(1);
  const high = data?.settings?.invadersHigh || 0;

  function makeAliens(waveNum) {
    const out = [];
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        out.push({
          x: ALIEN_OFFSET_X + c * (ALIEN_W + ALIEN_GAP_X),
          y: ALIEN_OFFSET_Y + r * (ALIEN_H + ALIEN_GAP_Y),
          alive: true,
          row: r,
        });
      }
    }
    return out;
  }

  function initState(waveNum = 1) {
    return {
      playerX: CW / 2 - PLAYER_W / 2,
      bullets: [],          // [{x,y,vy}] - player bullets
      bombs:   [],          // alien bombs
      aliens: makeAliens(waveNum),
      alienDir: 1,
      alienSpeed: 0.4 + waveNum * 0.12,
      alienStepDownPending: false,
      tick: 0,
      bombTimer: 0,
      // v8.3 B1 fix: lastFire lives in the game state (not keysRef) so it
      // resets to 0 alongside `tick` on every new wave. Previously it sat
      // in the persistent keysRef — after a wave cleared, tick reset to 0
      // but lastFire stayed at its old (large) value, so the fire check
      // `tick - lastFire > 18` evaluated negative and blocked all shooting
      // until tick slowly climbed back past the stale lastFire. That's the
      // "stops shooting after stage 1" bug.
      lastFire: 0,
    };
  }

  // Keyboard input.
  useEffect(() => {
    function onDown(e) {
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") { keysRef.current.left  = true; e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { keysRef.current.right = true; e.preventDefault(); }
      if (e.code === "Space" || e.key === " ") { keysRef.current.fire = true; e.preventDefault(); }
    }
    function onUp(e) {
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") keysRef.current.left  = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = false;
      if (e.code === "Space" || e.key === " ") keysRef.current.fire = false;
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  // Main loop.
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    if (!stateRef.current) stateRef.current = initState(wave);

    function frame() {
      const s = stateRef.current;
      const k = keysRef.current;
      s.tick++;

      // Player movement
      if (k.left)  s.playerX -= 5;
      if (k.right) s.playerX += 5;
      s.playerX = Math.max(0, Math.min(CW - PLAYER_W, s.playerX));

      // Fire bullet (rate-limited so holding space doesn't spam).
      // v8.3 B1: cooldown now tracked on the game state (s.lastFire) so it
      // resets with the per-wave tick reset.
      if (k.fire && s.tick - s.lastFire > 18) {
        s.bullets.push({ x: s.playerX + PLAYER_W / 2, y: CH - 40, vy: -8 });
        s.lastFire = s.tick;
      }

      // Update bullets
      s.bullets.forEach(b => { b.y += b.vy; });
      s.bullets = s.bullets.filter(b => b.y > -10);

      // Update alien horde
      const aliveAliens = s.aliens.filter(a => a.alive);
      // Edge check — reverse direction + step down if any alien hits the edge
      const minX = Math.min(...aliveAliens.map(a => a.x));
      const maxX = Math.max(...aliveAliens.map(a => a.x + ALIEN_W));
      if ((minX <= 0 && s.alienDir < 0) || (maxX >= CW && s.alienDir > 0)) {
        s.alienDir *= -1;
        s.aliens.forEach(a => { a.y += 14; });
      }
      s.aliens.forEach(a => { if (a.alive) a.x += s.alienDir * s.alienSpeed; });

      // Aliens drop bombs occasionally (frequency scales with wave)
      s.bombTimer++;
      if (s.bombTimer > Math.max(40 - wave * 4, 14) && aliveAliens.length > 0) {
        s.bombTimer = 0;
        const dropper = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
        s.bombs.push({ x: dropper.x + ALIEN_W / 2, y: dropper.y + ALIEN_H, vy: 3 + Math.random() * 1.5 });
      }
      s.bombs.forEach(b => { b.y += b.vy; });
      s.bombs = s.bombs.filter(b => b.y < CH + 10);

      // Bullet-alien collision
      s.bullets.forEach(b => {
        s.aliens.forEach(a => {
          if (!a.alive) return;
          if (b.x > a.x && b.x < a.x + ALIEN_W && b.y > a.y && b.y < a.y + ALIEN_H) {
            a.alive = false;
            b.y = -100;                                       // mark for removal
            const points = (ALIEN_ROWS - a.row) * 10;          // top rows worth more
            setScore(prev => prev + points);
          }
        });
      });

      // Bomb-player collision
      const px = s.playerX, py = CH - 30;
      s.bombs.forEach(b => {
        if (b.x > px && b.x < px + PLAYER_W && b.y > py && b.y < py + PLAYER_H) {
          b.y = CH + 100;                                      // mark for removal
          setLives(L => L - 1);
        }
      });

      // Aliens reach the player line = instant loss
      const lowestAlien = aliveAliens.reduce((mx, a) => Math.max(mx, a.y), 0);
      if (lowestAlien > CH - 70) { setLives(0); }

      // Wave cleared
      if (aliveAliens.length === 0) {
        const newWave = wave + 1;
        setWave(newWave);
        stateRef.current = initState(newWave);
      }

      // Draw
      ctx.fillStyle = "#020310";
      ctx.fillRect(0, 0, CW, CH);
      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 173 + s.tick * 0.3) % CW;
        const sy = (i * 97) % CH;
        ctx.fillRect(sx, sy, 1, 1);
      }
      // Aliens
      s.aliens.forEach(a => {
        if (!a.alive) return;
        const colors = ["#ff6b6b", "#ffaa44", "#ffd640", "#88ff88", "#88c8ff"];
        ctx.fillStyle = colors[a.row] || "#fff";
        // Body
        ctx.fillRect(a.x + 4, a.y + 4, ALIEN_W - 8, ALIEN_H - 8);
        // Antennae
        ctx.fillRect(a.x + 6, a.y, 4, 4);
        ctx.fillRect(a.x + ALIEN_W - 10, a.y, 4, 4);
        // Eyes
        ctx.fillStyle = "#000";
        ctx.fillRect(a.x + 8, a.y + 8, 3, 3);
        ctx.fillRect(a.x + ALIEN_W - 11, a.y + 8, 3, 3);
      });
      // Player
      ctx.fillStyle = "#4cef90";
      ctx.fillRect(s.playerX, CH - 30, PLAYER_W, PLAYER_H);
      ctx.fillRect(s.playerX + PLAYER_W / 2 - 3, CH - 38, 6, 8);
      // Bullets
      ctx.fillStyle = "#fff";
      s.bullets.forEach(b => ctx.fillRect(b.x - 1, b.y, 2, 8));
      // Bombs
      ctx.fillStyle = "#ff8b8b";
      s.bombs.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 8));

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, wave]);

  // Lose check.
  useEffect(() => {
    if (phase === "playing" && lives <= 0) {
      setPhase("gameover");
      if (updateSettings && score > high) updateSettings({ invadersHigh: score });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives, phase]);

  function startGame() {
    stateRef.current = initState(1);
    setScore(0); setLives(3); setWave(1);
    setPhase("playing");
  }

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:10, fontFamily:FF }}>
      <div style={SEC}>Space Invaders</div>

      {/* Stats */}
      <div style={{ display:"flex", gap:18, fontFamily:FFM, fontSize:11, color:"rgba(255,255,255,0.55)" }}>
        <span>Score <strong style={{color:"#fff", marginLeft:4}}>{score}</strong></span>
        <span>Wave <strong style={{color:"#ffd640", marginLeft:4}}>{wave}</strong></span>
        <span>Lives <strong style={{color:"#4cef90", marginLeft:4}}>{"♥".repeat(Math.max(0, lives))}</strong></span>
        <span>Best <strong style={{color:"#88c8ff", marginLeft:4}}>{Math.max(high, score)}</strong></span>
      </div>

      <div style={{ position:"relative" }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ width:"100%", maxWidth: 460, aspectRatio: CW + "/" + CH, background:"#020310", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, display:"block" }}
        />
        {phase !== "playing" && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, background:"rgba(2,3,16,0.85)", borderRadius:8 }}>
            <div style={{ fontSize:42, lineHeight:1 }}>👾</div>
            <div style={{ fontFamily:FFB, fontWeight:700, fontSize:18, color: phase === "gameover" ? "#ff8b8b" : "#fff" }}>
              {phase === "gameover" ? "Game Over" : "Space Invaders"}
            </div>
            {phase === "gameover" && <div style={{ fontFamily:FFM, fontSize:13, color:"rgba(255,255,255,0.7)" }}>Final score: {score}</div>}
            <button onClick={startGame}
              style={{ padding:"8px 22px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:8, cursor:"pointer", fontFamily:FFB, fontWeight:700, fontSize:13, color:AC }}>
              {phase === "gameover" ? "Play Again" : "Start"}
            </button>
          </div>
        )}
      </div>

      <div style={{ fontFamily:FF, fontStyle:"italic", fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", maxWidth:340, lineHeight:1.5, marginTop:4 }}>
        <strong style={{color:"rgba(255,255,255,0.55)"}}>← →</strong> or <strong style={{color:"rgba(255,255,255,0.55)"}}>A / D</strong> to move · <strong style={{color:"rgba(255,255,255,0.55)"}}>Space</strong> to fire. Top-row aliens are worth more points.
      </div>
    </div>
  );
}

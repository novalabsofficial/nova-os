// v7.4 — Flappy Bird clone.
//
// Single-button game: tap/click/spacebar to flap, gravity pulls you down,
// avoid the pipes. Score = pipes passed. Highest score is saved in user
// data so it persists between sessions.
//
// Loop runs at 60Hz via requestAnimationFrame. Physics tuned to feel close
// to the original — slightly forgiving gravity so it doesn't feel hostile.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const CW = 360, CH = 540;
const BIRD_X = 90;
const BIRD_R = 14;
const GRAVITY = 0.42;
const FLAP_V  = -7.2;
const PIPE_W  = 56;
const PIPE_GAP = 138;
const PIPE_SPEED = 2.6;
const PIPE_SPACING = 220;   // horizontal gap between successive pipes

export function FlappyBirdApp({ AC, data, updateSettings }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);   // mutable game state; lives outside React
  const [running, setRunning] = useState(false);
  const [dead,    setDead]    = useState(false);
  const [score,   setScore]   = useState(0);
  const high = data?.settings?.flappyHigh || 0;

  function initState() {
    return {
      birdY: CH / 2,
      vy: 0,
      pipes: [{ x: CW + 100, topH: pickGapTop() }],
      passed: 0,
      tick: 0,
    };
  }
  // Random top-pipe height so the gap appears somewhere reasonable on screen.
  function pickGapTop() {
    return 60 + Math.random() * (CH - 60 - PIPE_GAP - 80);
  }

  // Flap on space/up arrow OR tap/click.
  useEffect(() => {
    function onKey(e) {
      if (e.code === "Space" || e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // flap is stable enough — it reads from refs/state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, dead]);

  function flap() {
    if (dead) { restart(); return; }
    if (!running) { setRunning(true); return; }
    if (stateRef.current) stateRef.current.vy = FLAP_V;
  }

  function restart() {
    stateRef.current = initState();
    setScore(0);
    setDead(false);
    setRunning(true);
  }

  // Render + physics loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    if (!stateRef.current) stateRef.current = initState();

    function draw() {
      const s = stateRef.current;
      // Sky gradient
      const grd = ctx.createLinearGradient(0, 0, 0, CH);
      grd.addColorStop(0,   "#6abef0");
      grd.addColorStop(0.7, "#a6dbf5");
      grd.addColorStop(1,   "#d8eef9");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, CW, CH);
      // Ground strip
      ctx.fillStyle = "#dbb56e";
      ctx.fillRect(0, CH - 30, CW, 30);
      ctx.fillStyle = "#9c8049";
      ctx.fillRect(0, CH - 30, CW, 4);

      // Pipes
      ctx.fillStyle = "#3aa14a";
      s.pipes.forEach(p => {
        // top pipe
        ctx.fillRect(p.x, 0, PIPE_W, p.topH);
        // top pipe lip
        ctx.fillRect(p.x - 3, p.topH - 16, PIPE_W + 6, 16);
        // bottom pipe
        ctx.fillRect(p.x, p.topH + PIPE_GAP, PIPE_W, CH - p.topH - PIPE_GAP - 30);
        ctx.fillRect(p.x - 3, p.topH + PIPE_GAP, PIPE_W + 6, 16);
      });
      // Pipe outline darken
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      s.pipes.forEach(p => {
        ctx.strokeRect(p.x, 0, PIPE_W, p.topH);
        ctx.strokeRect(p.x, p.topH + PIPE_GAP, PIPE_W, CH - p.topH - PIPE_GAP - 30);
      });

      // Bird
      const birdAngle = Math.max(-0.5, Math.min(1.2, s.vy * 0.08));
      ctx.save();
      ctx.translate(BIRD_X, s.birdY);
      ctx.rotate(birdAngle);
      // body
      ctx.fillStyle = "#ffd640";
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#cc9a00";
      ctx.lineWidth = 2;
      ctx.stroke();
      // beak
      ctx.fillStyle = "#ff7e2a";
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, -2);
      ctx.lineTo(BIRD_R + 8, 0);
      ctx.lineTo(BIRD_R - 2, 4);
      ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(4, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(5, -4, 2, 0, Math.PI * 2); ctx.fill();
      // wing (animated by tick)
      ctx.fillStyle = "#f7c41f";
      ctx.beginPath();
      const wf = Math.sin(s.tick * 0.4);
      ctx.ellipse(-2, 2 + wf, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Score (centered, big, top)
      ctx.font = "bold 36px " + FFB;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 4;
      ctx.strokeText(String(s.passed), CW/2, 56);
      ctx.fillText(String(s.passed), CW/2, 56);
    }

    function step() {
      const s = stateRef.current;
      if (running && !dead) {
        s.tick++;
        s.vy += GRAVITY;
        s.birdY += s.vy;

        // Move pipes
        s.pipes.forEach(p => { p.x -= PIPE_SPEED; });
        // Remove off-screen pipes; spawn new ones
        s.pipes = s.pipes.filter(p => p.x + PIPE_W > -20);
        const last = s.pipes[s.pipes.length - 1];
        if (!last || last.x < CW - PIPE_SPACING) {
          s.pipes.push({ x: CW, topH: pickGapTop() });
        }

        // Score when a pipe goes past the bird
        s.pipes.forEach(p => {
          if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
            p.scored = true;
            s.passed++;
            setScore(s.passed);
          }
        });

        // Collision: ground or sky
        if (s.birdY + BIRD_R >= CH - 30 || s.birdY - BIRD_R < 0) {
          setDead(true); setRunning(false);
        }
        // Collision: pipes (AABB-ish)
        for (const p of s.pipes) {
          if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
            if (s.birdY - BIRD_R < p.topH || s.birdY + BIRD_R > p.topH + PIPE_GAP) {
              setDead(true); setRunning(false);
            }
          }
        }
      }

      draw();
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, dead]);

  // When the player dies, update the high score in user data if we beat it.
  useEffect(() => {
    if (!dead) return;
    const s = stateRef.current;
    if (s && s.passed > high && updateSettings) {
      updateSettings({ flappyHigh: s.passed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dead]);

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:10, fontFamily:FF }}>
      <div style={SEC}>Flappy Bird</div>

      {/* Stats row */}
      <div style={{ display:"flex", gap:18, fontFamily:FFM, fontSize:11, color:"rgba(255,255,255,0.55)" }}>
        <span>Score <strong style={{color:"#fff", marginLeft:4}}>{score}</strong></span>
        <span>Best <strong style={{color:"#ffd640", marginLeft:4}}>{Math.max(high, score)}</strong></span>
      </div>

      {/* Click-to-flap canvas */}
      <canvas ref={canvasRef} width={CW} height={CH}
        onPointerDown={flap}
        style={{ width:"100%", maxWidth: 320, aspectRatio: CW + "/" + CH, border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, cursor:"pointer", display:"block", touchAction:"manipulation" }}
      />

      {/* Status / start prompt */}
      <div style={{ fontFamily:FF, fontSize:12, color:"rgba(255,255,255,0.6)", textAlign:"center", minHeight:18 }}>
        {!running && !dead && <span>Tap canvas or press Space to start</span>}
        {dead && <span style={{ color:"#ff8b8b" }}>You died. Tap to try again.</span>}
      </div>

      <div style={{ fontFamily:FF, fontStyle:"italic", fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", maxWidth:280, lineHeight:1.5, marginTop:4 }}>
        Click, tap, or press <strong style={{color:"rgba(255,255,255,0.55)"}}>Space</strong> to flap. Avoid the pipes — your best score syncs to your account.
      </div>
    </div>
  );
}

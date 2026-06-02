// v9.8 — Snake, rebuilt Google-Snake style.
//
// What changed vs the old version:
//   • Input buffering — keypresses queue (up to 2), so fast double-turns
//     register instead of being dropped. This is the big "responsiveness"
//     fix; the old build read a single nextDir and lost quick inputs.
//   • Faster, constant tempo (85ms/step) with clean grid movement and a
//     connected rounded snake body.
//   • Checkerboard grass board like Google Snake.
//   • Settings: map size (Small / Medium / Large) and apple count (1 / 3 / 5).

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { playSound } from "../lib/audio.js";

const SIZES = { Small: 13, Medium: 17, Large: 21 };
const APPLE_OPTS = [1, 3, 5];
const SPEEDS = { Slow: 130, Normal: 85, Fast: 55 };  // ms per step — lower is faster
const BOARD_PX = 400;        // target board size; cell size derives from this
const STEP_MS = 85;          // constant tempo (Google Snake doesn't speed up)

// Board greens (checkerboard), snake + apple colors.
const GRASS_A = "#a2d149";
const GRASS_B = "#aad751";
const APPLE   = "#e7471d";

export function SnakeApp({ AC }) {
  const [grid, setGrid] = useState(17);        // current map size
  const [apples, setApples] = useState(1);     // apples on the board at once
  const [speedMs, setSpeedMs] = useState(STEP_MS); // ms per step (default Normal); see SPEEDS
  const [phase, setPhase] = useState("idle");  // idle | playing | over
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const canvasRef = useRef(null);
  const st = useRef(null);                      // mutable game state
  const intv = useRef(null);
  const cfgRef = useRef({ grid, apples });
  cfgRef.current = { grid, apples };

  const CELL = Math.floor(BOARD_PX / grid);
  const PX = CELL * grid;

  function randEmpty(occupied, g) {
    let p, guard = 0;
    do {
      p = { x: Math.floor(Math.random() * g), y: Math.floor(Math.random() * g) };
      guard++;
    } while (occupied.some(o => o.x === p.x && o.y === p.y) && guard < 500);
    return p;
  }

  function freshState() {
    const g = cfgRef.current.grid;
    const mid = Math.floor(g / 2);
    const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
    const foods = [];
    for (let i = 0; i < cfgRef.current.apples; i++) foods.push(randEmpty([...snake, ...foods], g));
    return { snake, dir: { x: 1, y: 0 }, queue: [], foods, score: 0, g };
  }

  function draw() {
    const c = canvasRef.current; if (!c) return;
    const s = st.current;
    const g = s ? s.g : grid;
    const cell = Math.floor(BOARD_PX / g);
    const ctx = c.getContext("2d");
    // checkerboard grass
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? GRASS_A : GRASS_B;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    if (!s) return;
    // apples
    s.foods.forEach(f => {
      ctx.fillStyle = APPLE;
      ctx.beginPath();
      ctx.arc(f.x * cell + cell / 2, f.y * cell + cell / 2, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
      // little leaf
      ctx.fillStyle = "#4caf50";
      ctx.beginPath();
      ctx.ellipse(f.x * cell + cell * 0.62, f.y * cell + cell * 0.28, cell * 0.1, cell * 0.06, -0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    // snake — connected rounded body in the accent color
    s.snake.forEach((seg, i) => {
      const head = i === 0;
      ctx.fillStyle = head ? "#4a7cff" : `rgba(${hexRgb("#4a7cff")},${Math.max(0.55, 0.95 - i * 0.012)})`;
      const pad = head ? 0.5 : 1.5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2, head ? cell * 0.32 : cell * 0.28); ctx.fill(); }
      else ctx.fillRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
      // eyes on the head
      if (head) {
        ctx.fillStyle = "#fff";
        const d = s.dir, ex = cell * 0.28, ey = cell * 0.28;
        const cx = seg.x * cell + cell / 2, cy = seg.y * cell + cell / 2;
        const ox = d.y !== 0 ? ex : ex * 0.4 * d.x + ex * 0.0;
        // place two eyes offset perpendicular to travel
        const px = d.x !== 0 ? cell * 0.18 * d.x : 0;
        const py = d.y !== 0 ? cell * 0.18 * d.y : 0;
        const perp = d.x !== 0 ? { x: 0, y: ey } : { x: ex, y: 0 };
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.arc(cx + px + perp.x * 0.45 * side, cy + py + perp.y * 0.45 * side, cell * 0.09, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  }

  function tick() {
    const s = st.current; if (!s) return;
    // pull the next buffered direction (skip ones that reverse into us)
    while (s.queue.length) {
      const d = s.queue.shift();
      if (d.x === -s.dir.x && d.y === -s.dir.y) continue;  // can't reverse
      s.dir = d; break;
    }
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    // wall or self collision
    if (head.x < 0 || head.x >= s.g || head.y < 0 || head.y >= s.g ||
        s.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      clearInterval(intv.current);
      setBest(b => Math.max(b, s.score));
      setPhase("over");
      try { playSound("error"); } catch {}
      return;
    }
    s.snake.unshift(head);
    const fi = s.foods.findIndex(f => f.x === head.x && f.y === head.y);
    if (fi >= 0) {
      s.score++; setScore(s.score);
      s.foods.splice(fi, 1);
      s.foods.push(randEmpty([...s.snake, ...s.foods], s.g));
      try { playSound("click"); } catch {}
    } else {
      s.snake.pop();
    }
    draw();
  }

  function start() {
    st.current = freshState();
    setScore(0);
    setPhase("playing");
    clearInterval(intv.current);
    intv.current = setInterval(tick, speedMs);
    draw();
  }

  // Queue a direction (shared by keyboard + touch); de-dupes and blocks reversals.
  function queueDir(d) {
    const s = st.current; if (!s) return;
    const lastQ = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (lastQ.x === d.x && lastQ.y === d.y) return;
    if (s.queue.length < 2) s.queue.push(d);
  }
  // Mobile: swipe the board to steer.
  function onSwipeDown(e) {
    const sx = e.clientX, sy = e.clientY;
    const up = (ev) => {
      window.removeEventListener("pointerup", up);
      const dx = ev.clientX - sx, dy = ev.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 20) return;
      queueDir(ax > ay ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 });
    };
    window.addEventListener("pointerup", up);
  }

  // Input — push into the queue (max 2 buffered) for responsive turns.
  useEffect(() => {
    if (phase !== "playing") return;
    const DM = {
      ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
    };
    function onKey(e) {
      const d = DM[e.key]; if (!d) return;
      e.preventDefault();
      queueDir(d);
    }
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearInterval(intv.current); };
  }, [phase]);

  // Redraw board when settings change at idle (preview the new map size).
  useEffect(() => { if (phase !== "playing") { st.current = null; draw(); } }, [grid, apples]); // eslint-disable-line

  return (
    <div style={{ width: "100%", fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", width: "100%", maxWidth: PX }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "#5fa84a" }}>🐍 Snake</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: FFM, fontSize: 13, color: "var(--nv-text)" }}>Score <strong style={{ color: "#fff" }}>{score}</strong></div>
        <div style={{ fontFamily: FFM, fontSize: 13, color: "var(--nv-text-dim)" }}>Best <strong style={{ color: "#aad751" }}>{best}</strong></div>
      </div>

      {/* Settings (editable only at idle / game over) */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", opacity: phase === "playing" ? 0.4 : 1, pointerEvents: phase === "playing" ? "none" : "auto" }}>
        <Segment label="Board" options={Object.keys(SIZES)} value={Object.keys(SIZES).find(k => SIZES[k] === grid)} onPick={k => setGrid(SIZES[k])} AC={AC} />
        <Segment label="Apples" options={APPLE_OPTS} value={apples} onPick={n => setApples(n)} AC={AC} />
        <Segment label="Speed" options={Object.keys(SPEEDS)} value={Object.keys(SPEEDS).find(k => SPEEDS[k] === speedMs)} onPick={k => setSpeedMs(SPEEDS[k])} AC={AC} />
      </div>

      {/* Board */}
      <div style={{ position: "relative", width: "100%", maxWidth: PX }}>
        <canvas ref={canvasRef} width={PX} height={PX} onPointerDown={onSwipeDown}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.35)", touchAction: "none" }} />
        {(phase === "idle" || phase === "over") && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(7,8,15,0.66)", borderRadius: 10 }}>
            {phase === "over" && <>
              <div style={{ fontFamily: FFB, fontSize: 22, color: "#fff", fontWeight: 800 }}>Game Over</div>
              <div style={{ fontFamily: FFM, fontSize: 14, color: "var(--nv-text)" }}>Apples: {score}</div>
            </>}
            <button onClick={start} style={{ padding: "11px 32px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 15, color: AC }}>
              {phase === "over" ? "Play Again" : "Start Game"}
            </button>
            {phase === "idle" && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: FF }}>Swipe, arrow keys, or WASD to move</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function Segment({ label, options, value, onPick, AC }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 0.5 }}>{label}</span>
      <div style={{ display: "flex", gap: 3, padding: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7 }}>
        {options.map(o => (
          <button key={o} onClick={() => onPick(o)}
            style={{ padding: "4px 11px", background: value === o ? fill(AC) : "transparent", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: value === o ? AC : "var(--nv-text-dim)" }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

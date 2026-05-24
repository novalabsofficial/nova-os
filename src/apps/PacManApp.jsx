// v7.4.1 — Pac-Man, rewritten with tile-discrete movement.
//
// The previous implementation moved entities at continuous pixel speeds and
// only allowed direction changes when "near a tile center" (within 0.5 px).
// At ghost speed 1.45, ghosts never hit exact centers — so they could only
// move in their initial direction and would freeze on walls.
//
// New model: each entity has (r, c) = current tile, (toR, toC) = target
// tile, and `progress` (0 → 1) interpolating between them. Each frame,
// progress advances by speed/TILE. When progress >= 1, the entity arrives
// at its target tile; only then can it pick a new direction. This makes
// direction changes deterministic and works at any speed.
//
// Ghost AI: 4 distinct personalities (classic Pac-Man behavior — Blinky
// directly chases, Pinky targets 4 tiles ahead, Inky mirrors Blinky's
// position relative to Pac, Clyde flees to a corner when close). When
// frightened (after eating a power pellet), they pick random legal turns
// for ~6 seconds.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// Maze legend: 1=wall, 0=pellet, 2=power pellet, 3=empty, 4=ghost spawn (→3),
// 5=pac spawn (→0). 28 cols × 31 rows, classic arcade dimensions.
const MAZE = [
  "1111111111111111111111111111",
  "1000000000000110000000000001",
  "1011110111110110111110111101",
  "1211110111110110111110111121",
  "1011110111110110111110111101",
  "1000000000000000000000000001",
  "1011110110111111110110111101",
  "1011110110111111110110111101",
  "1000000110000110000110000001",
  "1111110111113113111110111111",
  "3333310111113113111110133333",
  "3333310110000000000110133333",
  "3333310110144444410110133333",
  "1111110110144444410110111111",
  "3333330000144444410000333333",
  "1111110110144444410110111111",
  "3333310110111111110110133333",
  "3333310110000550000110133333",
  "3333310110111111110110133333",
  "1111110110111111110110111111",
  "1000000000000110000000000001",
  "1011110111110110111110111101",
  "1211000000000000000000000211",
  "1110110110111111110110110111",
  "1000000110000110000110000001",
  "1011111111110110111111111101",
  "1011111111110110111111111101",
  "1000000000000000000000000001",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
  "1111111111111111111111111111",
];

const COLS = MAZE[0].length;
const ROWS = MAZE.length;
const TILE = 16;
const CW = COLS * TILE;
const CH = ROWS * TILE;

const DIRS = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1  },
  left:  { dx: -1, dy: 0  },
  right: { dx: 1,  dy: 0  },
};
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

function cellAt(grid, r, c) {
  // Out-of-bounds is treated as wall. Tunnel wrap is handled in movement code.
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return "1";
  return grid[r][c];
}
function isWall(ch)         { return ch === "1"; }
function isPellet(ch)       { return ch === "0"; }
function isPowerPellet(ch)  { return ch === "2"; }

export function PacManApp({ AC, data, updateSettings }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const queuedDirRef = useRef("right");
  const [phase, setPhase] = useState("title");   // "title" | "playing" | "won" | "lost"
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const high = data?.settings?.pacmanHigh || 0;

  // ── Init game state ─────────────────────────────────────────────────
  function initGame() {
    const grid = MAZE.map(r => r.split(""));
    let pacSpawn = { r: 23, c: 13 };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === "5") { pacSpawn = { r, c }; grid[r][c] = "0"; }
        if (grid[r][c] === "4") { grid[r][c] = "3"; }
      }
    }
    // Ghosts spawn ABOVE the ghost house in the open corridor at row 11. This
    // sidesteps the "ghost stuck inside the house" problem since they're
    // already in walkable maze territory.
    const ghostStart = (offset) => ({
      r: 11, c: 13 + offset,
      toR: 11, toC: 13 + offset,
      progress: 1, dir: "left",
    });
    return {
      grid,
      pac: { r: pacSpawn.r, c: pacSpawn.c, toR: pacSpawn.r, toC: pacSpawn.c, progress: 1, dir: "right" },
      ghosts: [
        { name: "blinky", ...ghostStart(0),  color: "#ff4444", scatter: { r: 2, c: 25 },  frightened: false, frightenedUntil: 0 },
        { name: "pinky",  ...ghostStart(1),  color: "#ffb8de", scatter: { r: 2, c: 2  },  frightened: false, frightenedUntil: 0 },
        { name: "inky",   ...ghostStart(-1), color: "#44ddff", scatter: { r: 28,c: 25 },  frightened: false, frightenedUntil: 0 },
        { name: "clyde",  ...ghostStart(2),  color: "#ffaa44", scatter: { r: 28,c: 2  },  frightened: false, frightenedUntil: 0 },
      ],
      tick: 0,
      pelletsLeft: countPellets(grid),
      lastDeathAt: 0,
    };
  }
  function countPellets(grid) {
    let n = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] === "0" || grid[r][c] === "2") n++;
    return n;
  }

  // ── Input ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowUp"    || e.key === "w" || e.key === "W") { queuedDirRef.current = "up";    e.preventDefault(); }
      if (e.key === "ArrowDown"  || e.key === "s" || e.key === "S") { queuedDirRef.current = "down";  e.preventDefault(); }
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") { queuedDirRef.current = "left";  e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { queuedDirRef.current = "right"; e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Movement primitives ────────────────────────────────────────────
  // Given a tile + direction, return the tile we'd move INTO (with tunnel wrap).
  function tileInDir(r, c, dir) {
    let nr = r + DIRS[dir].dy;
    let nc = c + DIRS[dir].dx;
    if (nc < 0)      nc = COLS - 1;
    if (nc >= COLS)  nc = 0;
    return { r: nr, c: nc };
  }
  function canEnter(grid, r, c, dir) {
    const t = tileInDir(r, c, dir);
    return !isWall(cellAt(grid, t.r, t.c));
  }

  // Advance an entity along its current arc. When progress hits 1, snap to
  // target and call `chooseNextDir` to pick what's next. Returns the entity
  // (mutated in place for speed; this is hot-loop code).
  function step(entity, speed, chooseNextDir, grid) {
    entity.progress += speed / TILE;
    if (entity.progress >= 1) {
      // Arrived at target — snap, then decide next direction.
      entity.r = entity.toR;
      entity.c = entity.toC;
      entity.progress = 0;
      const nextDir = chooseNextDir(entity);
      entity.dir = nextDir;
      if (canEnter(grid, entity.r, entity.c, entity.dir)) {
        const t = tileInDir(entity.r, entity.c, entity.dir);
        entity.toR = t.r;
        entity.toC = t.c;
      } else {
        // No legal move forward — stay parked at this tile until input changes.
        entity.toR = entity.r;
        entity.toC = entity.c;
      }
    }
    return entity;
  }

  // Interpolated pixel position from (r,c) → (toR,toC).
  function entityPos(entity) {
    const x1 = entity.c   * TILE + TILE / 2;
    const y1 = entity.r   * TILE + TILE / 2;
    const x2 = entity.toC * TILE + TILE / 2;
    const y2 = entity.toR * TILE + TILE / 2;
    // Tunnel wrap: if columns differ by more than 1, lerp the short way
    // (off-screen → on-screen). We just snap on arrival; visual artifact is
    // a half-frame teleport at the tunnel mouths.
    let x = x1 + (x2 - x1) * entity.progress;
    let y = y1 + (y2 - y1) * entity.progress;
    if (Math.abs(entity.c - entity.toC) > 1) {
      // Tunnel teleport — show entity at the destination side
      x = x2;
    }
    return { x, y };
  }

  // ── Pac direction picker ───────────────────────────────────────────
  function pickPacDir(pac, grid) {
    // Prefer queued direction if legal from this tile; else continue current.
    const queued = queuedDirRef.current;
    if (queued && canEnter(grid, pac.r, pac.c, queued)) return queued;
    if (canEnter(grid, pac.r, pac.c, pac.dir)) return pac.dir;
    return pac.dir; // stay (will result in no movement next step)
  }

  // ── Ghost AI ───────────────────────────────────────────────────────
  function ghostTargetTile(ghost, s) {
    if (ghost.frightened) {
      // Random target every frame → effectively random turns at junctions
      return { r: Math.floor(Math.random() * ROWS), c: Math.floor(Math.random() * COLS) };
    }
    const pac = s.pac;
    if (ghost.name === "blinky") return { r: pac.r, c: pac.c };
    if (ghost.name === "pinky") {
      const d = DIRS[pac.dir];
      return { r: pac.r + d.dy * 4, c: pac.c + d.dx * 4 };
    }
    if (ghost.name === "inky") {
      const blinky = s.ghosts[0];
      const d = DIRS[pac.dir];
      const ahead = { r: pac.r + d.dy * 2, c: pac.c + d.dx * 2 };
      return { r: ahead.r * 2 - blinky.r, c: ahead.c * 2 - blinky.c };
    }
    if (ghost.name === "clyde") {
      const dist = Math.hypot(pac.r - ghost.r, pac.c - ghost.c);
      return dist > 6 ? { r: pac.r, c: pac.c } : ghost.scatter;
    }
    return { r: pac.r, c: pac.c };
  }

  function pickGhostDir(ghost, s, grid) {
    // From the ghost's current tile, pick the direction (excluding 180°)
    // that gets us closest to the AI target. If only reverse is legal,
    // allow it (so ghosts unstick instead of freezing).
    const target = ghostTargetTile(ghost, s);
    const tryDirs = ["up", "left", "down", "right"]
      .filter(d => d !== OPPOSITE[ghost.dir])
      .filter(d => canEnter(grid, ghost.r, ghost.c, d));
    const candidates = tryDirs.length > 0
      ? tryDirs
      : ["up","down","left","right"].filter(d => canEnter(grid, ghost.r, ghost.c, d));
    if (candidates.length === 0) return ghost.dir;
    // Pick the candidate whose resulting tile is closest to target.
    let best = candidates[0], bestDist = Infinity;
    for (const d of candidates) {
      const t = tileInDir(ghost.r, ghost.c, d);
      const dist = Math.hypot(t.r - target.r, t.c - target.c);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  // ── Main loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    if (!stateRef.current) stateRef.current = initGame();
    queuedDirRef.current = stateRef.current.pac.dir;

    function frame() {
      const s = stateRef.current;
      s.tick++;
      const PAC_SPEED   = 1.6;
      const GHOST_SPEED = 1.4;
      const FRIGHT_SPEED = 0.95;

      // Update pac
      step(s.pac, PAC_SPEED, e => pickPacDir(e, s.grid), s.grid);
      // Eat pellet under pac (check the tile we just arrived at, but only
      // when progress is close to 0 — i.e. just snapped)
      if (s.pac.progress < 0.05) {
        const ch = cellAt(s.grid, s.pac.r, s.pac.c);
        if (isPellet(ch))      { s.grid[s.pac.r][s.pac.c] = "3"; s.pelletsLeft--; setScore(p => p + 10); }
        if (isPowerPellet(ch)) {
          s.grid[s.pac.r][s.pac.c] = "3"; s.pelletsLeft--;
          setScore(p => p + 50);
          s.ghosts.forEach(g => { g.frightened = true; g.frightenedUntil = s.tick + 60 * 6; });
        }
      }

      // Update ghosts
      s.ghosts.forEach(g => {
        if (g.frightened && s.tick > g.frightenedUntil) g.frightened = false;
        const speed = g.frightened ? FRIGHT_SPEED : GHOST_SPEED;
        step(g, speed, e => pickGhostDir(e, s, s.grid), s.grid);
      });

      // Collision detection — measure pixel distance between pac and each ghost
      const pacPx = entityPos(s.pac);
      s.ghosts.forEach(g => {
        const gPx = entityPos(g);
        const d = Math.hypot(gPx.x - pacPx.x, gPx.y - pacPx.y);
        if (d < TILE * 0.7) {
          if (g.frightened) {
            // Eat the ghost — respawn at ghost-house spawn point
            setScore(p => p + 200);
            g.frightened = false;
            g.r = 11; g.c = 13;
            g.toR = 11; g.toC = 13;
            g.progress = 1;
            g.dir = "left";
          } else if (s.tick - s.lastDeathAt > 60) {
            s.lastDeathAt = s.tick;
            setLives(L => L - 1);
            // Reset pac to spawn
            s.pac.r = 23; s.pac.c = 13;
            s.pac.toR = 23; s.pac.toC = 13;
            s.pac.progress = 1;
            s.pac.dir = "right";
            queuedDirRef.current = "right";
          }
        }
      });

      if (s.pelletsLeft === 0) setPhase("won");

      // ── Draw ───────────────────────────────────────────────────────
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CW, CH);
      // Maze
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const ch = s.grid[r][c];
          const x = c * TILE, y = r * TILE;
          if (isWall(ch)) {
            ctx.fillStyle = "#1f3df5";
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          } else if (isPellet(ch)) {
            ctx.fillStyle = "#ffd2a6";
            ctx.fillRect(x + TILE/2 - 1, y + TILE/2 - 1, 2, 2);
          } else if (isPowerPellet(ch)) {
            const pulse = 1 + Math.sin(s.tick * 0.15) * 0.4;
            ctx.fillStyle = "#ffd2a6";
            ctx.beginPath();
            ctx.arc(x + TILE/2, y + TILE/2, 4 * pulse, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // Pac
      const mouthAngle = Math.abs(Math.sin(s.tick * 0.18)) * 0.6;
      const facing = { right: 0, down: Math.PI/2, left: Math.PI, up: -Math.PI/2 }[s.pac.dir];
      ctx.fillStyle = "#ffd640";
      ctx.beginPath();
      ctx.moveTo(pacPx.x, pacPx.y);
      ctx.arc(pacPx.x, pacPx.y, TILE/2 - 1, facing + mouthAngle, facing + Math.PI * 2 - mouthAngle);
      ctx.fill();
      // Ghosts
      s.ghosts.forEach(g => {
        const gPx = entityPos(g);
        const flashing = g.frightened && (g.frightenedUntil - s.tick < 90) && Math.floor(s.tick / 8) % 2 === 0;
        ctx.fillStyle = g.frightened ? (flashing ? "#fff" : "#2222ff") : g.color;
        const gx = gPx.x, gy = gPx.y;
        // Body — semicircle top, wavy bottom
        ctx.beginPath();
        ctx.arc(gx, gy, TILE/2 - 1, Math.PI, 0);
        ctx.lineTo(gx + TILE/2 - 1, gy + TILE/2 - 1);
        for (let i = 2; i >= 0; i--) {
          const wx = gx + (i / 3 - 0.5) * (TILE - 2);
          const wy = gy + TILE/2 - 1 - (i % 2 === 0 ? 0 : 3);
          ctx.lineTo(wx, wy);
        }
        ctx.lineTo(gx - TILE/2 + 1, gy + TILE/2 - 1);
        ctx.closePath();
        ctx.fill();
        // Eyes
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(gx - 3, gy - 2, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 3, gy - 2, 2.5, 0, Math.PI*2); ctx.fill();
        if (!g.frightened) {
          ctx.fillStyle = "#000";
          const eyeDx = DIRS[g.dir].dx, eyeDy = DIRS[g.dir].dy;
          ctx.beginPath(); ctx.arc(gx - 3 + eyeDx, gy - 2 + eyeDy, 1.2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gx + 3 + eyeDx, gy - 2 + eyeDy, 1.2, 0, Math.PI*2); ctx.fill();
        }
      });

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === "playing" && lives <= 0) {
      setPhase("lost");
      if (updateSettings && score > high) updateSettings({ pacmanHigh: score });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives, phase]);
  useEffect(() => {
    if (phase === "won" && updateSettings && score > high) {
      updateSettings({ pacmanHigh: score });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function startGame() {
    stateRef.current = initGame();
    queuedDirRef.current = "right";
    setScore(0); setLives(3);
    setPhase("playing");
  }

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:10, fontFamily:FF }}>
      <div style={SEC}>Pac-Man</div>

      {/* Stats */}
      <div style={{ display:"flex", gap:18, fontFamily:FFM, fontSize:11, color:"rgba(255,255,255,0.55)" }}>
        <span>Score <strong style={{color:"#fff", marginLeft:4}}>{score}</strong></span>
        <span>Lives <strong style={{color:"#ffd640", marginLeft:4}}>{"♥".repeat(Math.max(0, lives))}</strong></span>
        <span>Best <strong style={{color:"#88c8ff", marginLeft:4}}>{Math.max(high, score)}</strong></span>
      </div>

      <div style={{ position:"relative" }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ width:"100%", maxWidth: 460, aspectRatio: CW + "/" + CH, background:"#000", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, display:"block", imageRendering:"pixelated" }}
        />
        {phase !== "playing" && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, background:"rgba(0,0,0,0.88)", borderRadius:6 }}>
            <div style={{ fontSize:42, lineHeight:1 }}>{phase === "won" ? "🏆" : phase === "lost" ? "👻" : "🟡"}</div>
            <div style={{ fontFamily:FFB, fontWeight:700, fontSize:18, color: phase === "won" ? "#4cef90" : phase === "lost" ? "#ff8b8b" : "#fff" }}>
              {phase === "won" ? "You cleared the maze!" : phase === "lost" ? "Game Over" : "Pac-Man"}
            </div>
            {phase !== "title" && <div style={{ fontFamily:FFM, fontSize:13, color:"rgba(255,255,255,0.7)" }}>Final score: {score}</div>}
            <button onClick={startGame}
              style={{ padding:"8px 22px", background:fill(AC), border:"1px solid "+bdr(AC), borderRadius:8, cursor:"pointer", fontFamily:FFB, fontWeight:700, fontSize:13, color:AC }}>
              {phase === "title" ? "Start" : "Play Again"}
            </button>
          </div>
        )}
      </div>

      <div style={{ fontFamily:FF, fontStyle:"italic", fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center", maxWidth:340, lineHeight:1.5, marginTop:4 }}>
        Arrow keys or <strong style={{color:"rgba(255,255,255,0.55)"}}>WASD</strong> to move. Eat all pellets to win. Power pellets make ghosts vulnerable for ~6 seconds.
      </div>
    </div>
  );
}

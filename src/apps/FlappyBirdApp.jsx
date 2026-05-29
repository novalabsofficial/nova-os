// v7.4 — Flappy Bird clone.
// v9.8 — graphics overhaul (parallax sky + clouds + hills, classic shaded
// pipes with caps, a rounder animated bird, scrolling ground) plus a global
// high-score leaderboard (nova_scores, written only on a personal best).
//
// Single-button: tap/click/space to flap, gravity pulls you down, avoid
// the pipes. Score = pipes passed. Loop runs at 60Hz via rAF.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { submitScore, fetchLeaderboard } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";

const CW = 360, CH = 540;
const BIRD_X = 90;
const BIRD_R = 14;
const GRAVITY = 0.42;
const FLAP_V  = -7.2;
const PIPE_W  = 60;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.6;
const PIPE_SPACING = 220;
const GROUND_H = 64;

export function FlappyBirdApp({ AC, data, updateSettings, user }) {
  const myUid = getDbUid();
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const [running, setRunning] = useState(false);
  const [dead,    setDead]    = useState(false);
  const [score,   setScore]   = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [showLb,  setShowLb]  = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const high = data?.settings?.flappyHigh || 0;

  function loadLeaders() { setLoadingLb(true); fetchLeaderboard("flappy", "high", 10).then(r => { setLeaders(r); setLoadingLb(false); }); }
  useEffect(() => { if (showLb) loadLeaders(); }, [showLb]);

  function initState() {
    return { birdY: CH / 2, vy: 0, pipes: [{ x: CW + 100, topH: pickGapTop() }], passed: 0, tick: 0, groundX: 0, cloudX: 0 };
  }
  function pickGapTop() { return 70 + Math.random() * (CH - GROUND_H - PIPE_GAP - 120); }

  useEffect(() => {
    function onKey(e) {
      if (e.code === "Space" || e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, dead]);

  function flap() {
    if (dead) { restart(); return; }
    if (!running) { setRunning(true); return; }
    if (stateRef.current) stateRef.current.vy = FLAP_V;
  }
  function restart() { stateRef.current = initState(); setScore(0); setDead(false); setNewBest(false); setRunning(true); }

  // ── drawing helpers ────────────────────────────────────────────────
  function drawPipe(ctx, x, topH) {
    const bodyGrad = (x0) => {
      const g = ctx.createLinearGradient(x0, 0, x0 + PIPE_W, 0);
      g.addColorStop(0,    "#2e7d32");
      g.addColorStop(0.18, "#5cb85c");
      g.addColorStop(0.45, "#7ed47e");
      g.addColorStop(0.7,  "#4caf50");
      g.addColorStop(1,    "#2a6b2e");
      return g;
    };
    const capH = 22, capOver = 4;
    // top pipe
    ctx.fillStyle = bodyGrad(x); ctx.fillRect(x, 0, PIPE_W, topH - capH);
    ctx.fillStyle = bodyGrad(x - capOver); ctx.fillRect(x - capOver, topH - capH, PIPE_W + capOver * 2, capH);
    // bottom pipe
    const by = topH + PIPE_GAP;
    ctx.fillStyle = bodyGrad(x); ctx.fillRect(x, by + capH, PIPE_W, CH - by - capH - GROUND_H);
    ctx.fillStyle = bodyGrad(x - capOver); ctx.fillRect(x - capOver, by, PIPE_W + capOver * 2, capH);
    // outlines + cap highlights
    ctx.strokeStyle = "#1b5e20"; ctx.lineWidth = 2;
    ctx.strokeRect(x - capOver, topH - capH, PIPE_W + capOver * 2, capH);
    ctx.strokeRect(x - capOver, by, PIPE_W + capOver * 2, capH);
    ctx.strokeRect(x, 0, PIPE_W, topH);
    ctx.strokeRect(x, by, PIPE_W, CH - by - GROUND_H);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x + 5, 0, 4, topH); ctx.fillRect(x + 5, by, 4, CH - by - GROUND_H);
  }

  function drawBird(ctx, y, vy, tick) {
    const angle = Math.max(-0.5, Math.min(1.4, vy * 0.08));
    ctx.save();
    ctx.translate(BIRD_X, y);
    ctx.rotate(angle);
    // body — radial gradient yellow→amber
    const g = ctx.createRadialGradient(-4, -4, 3, 0, 0, BIRD_R + 3);
    g.addColorStop(0, "#fff09a"); g.addColorStop(0.5, "#ffd640"); g.addColorStop(1, "#f5a623");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c8841a"; ctx.lineWidth = 2; ctx.stroke();
    // wing (flaps with tick)
    const wf = Math.sin(tick * 0.4) * 4;
    ctx.fillStyle = "#fbe08a"; ctx.strokeStyle = "#d6a82a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-3, 3 + wf * 0.4, 9, 6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // beak
    ctx.fillStyle = "#ff8c2a"; ctx.strokeStyle = "#d96a16";
    ctx.beginPath(); ctx.moveTo(BIRD_R - 3, -3); ctx.lineTo(BIRD_R + 9, 1); ctx.lineTo(BIRD_R - 3, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    // eye
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(5, -5, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(6.5, -5, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBg(ctx, s) {
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, CH);
    sky.addColorStop(0, "#4ec0e6"); sky.addColorStop(0.6, "#8fd6f0"); sky.addColorStop(1, "#cfeefb");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
    // parallax clouds
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const cx = -((s.cloudX) % (CW + 120));
    [[cx + 40, 90, 26], [cx + 200, 140, 20], [cx + 330, 70, 22], [cx + 480, 120, 24]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r, y + 4, r * 0.8, 0, Math.PI * 2); ctx.arc(x - r, y + 5, r * 0.7, 0, Math.PI * 2); ctx.fill();
    });
    // hills near the ground
    ctx.fillStyle = "#9ad36b";
    const hx = -((s.cloudX * 1.4) % (CW + 200));
    for (let i = 0; i < 4; i++) { const bx = hx + i * 160; ctx.beginPath(); ctx.arc(bx, CH - GROUND_H, 70, Math.PI, 0); ctx.fill(); }
  }

  function drawGround(ctx, s) {
    ctx.fillStyle = "#ded08a"; ctx.fillRect(0, CH - GROUND_H, CW, GROUND_H);
    ctx.fillStyle = "#caa94e"; ctx.fillRect(0, CH - GROUND_H, CW, 6);          // top edge
    ctx.fillStyle = "#73a942"; ctx.fillRect(0, CH - GROUND_H - 6, CW, 8);      // grass strip
    // scrolling diagonal texture
    ctx.strokeStyle = "rgba(170,140,70,0.5)"; ctx.lineWidth = 6;
    const off = -(s.groundX % 24);
    for (let x = off; x < CW + 24; x += 24) { ctx.beginPath(); ctx.moveTo(x, CH - GROUND_H + 12); ctx.lineTo(x + 12, CH); ctx.stroke(); }
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    if (!stateRef.current) stateRef.current = initState();

    function draw() {
      const s = stateRef.current;
      drawBg(ctx, s);
      s.pipes.forEach(p => drawPipe(ctx, p.x, p.topH));
      drawGround(ctx, s);
      drawBird(ctx, s.birdY, s.vy, s.tick);
      // score
      ctx.font = "bold 40px " + FFB;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 5;
      ctx.strokeText(String(s.passed), CW / 2, 64); ctx.fillText(String(s.passed), CW / 2, 64);
    }

    function step() {
      const s = stateRef.current;
      if (running && !dead) {
        s.tick++; s.vy += GRAVITY; s.birdY += s.vy;
        s.groundX += PIPE_SPEED; s.cloudX += PIPE_SPEED * 0.35;
        s.pipes.forEach(p => { p.x -= PIPE_SPEED; });
        s.pipes = s.pipes.filter(p => p.x + PIPE_W > -20);
        const last = s.pipes[s.pipes.length - 1];
        if (!last || last.x < CW - PIPE_SPACING) s.pipes.push({ x: CW, topH: pickGapTop() });
        s.pipes.forEach(p => { if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) { p.scored = true; s.passed++; setScore(s.passed); } });
        if (s.birdY + BIRD_R >= CH - GROUND_H || s.birdY - BIRD_R < 0) { setDead(true); setRunning(false); }
        for (const p of s.pipes) {
          if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
            if (s.birdY - BIRD_R < p.topH || s.birdY + BIRD_R > p.topH + PIPE_GAP) { setDead(true); setRunning(false); }
          }
        }
      } else if (!running && !dead) {
        // gentle idle bob on the start screen
        s.birdY = CH / 2 + Math.sin(s.tick * 0.06) * 8; s.tick++;
      }
      draw();
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, dead]);

  // On death: save local high + submit to the global board.
  useEffect(() => {
    if (!dead) return;
    const s = stateRef.current; if (!s) return;
    if (s.passed > high && updateSettings) updateSettings({ flappyHigh: s.passed });
    if (myUid && s.passed > 0) {
      submitScore("flappy", s.passed, "high", myUid, user).then(improved => {
        if (improved) setNewBest(true);
        if (showLb) loadLeaders();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dead]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, fontFamily: FF }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", maxWidth: 320 }}>
        <div style={{ ...SEC, marginBottom: 0 }}>Flappy Bird</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)" }}>Best <strong style={{ color: "#ffd640" }}>{Math.max(high, score)}</strong></span>
        <button onClick={() => setShowLb(v => !v)} title="Global leaderboard" style={{ padding: "4px 9px", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, background: showLb ? fill(AC) : "rgba(255,255,255,0.07)", border: "1px solid " + (showLb ? bdr(AC) : "rgba(255,255,255,0.12)"), color: showLb ? AC : "var(--nv-text)" }}>🏆</button>
      </div>

      <canvas ref={canvasRef} width={CW} height={CH}
        onPointerDown={flap}
        style={{ width: "100%", maxWidth: 320, aspectRatio: CW + "/" + CH, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer", display: "block", touchAction: "manipulation", boxShadow: "0 10px 36px rgba(0,0,0,0.35)" }}
      />

      <div style={{ fontFamily: FF, fontSize: 12, color: "var(--nv-text)", textAlign: "center", minHeight: 18 }}>
        {!running && !dead && <span>Tap or press Space to start</span>}
        {dead && <span style={{ color: "#ff8b8b" }}>You died — tap to try again.{newBest && <strong style={{ color: "#ffd060", marginLeft: 8 }}>🏆 New best!</strong>}</span>}
      </div>

      {showLb && (
        <div style={{ width: "100%", maxWidth: 320, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)" }}>🏆 Top scores</div>
            <div style={{ flex: 1 }} />
            <button onClick={loadLeaders} title="Refresh" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 12 }}>↻</button>
          </div>
          {loadingLb ? (
            <div style={{ fontSize: 11, color: "var(--nv-text-dim)", fontStyle: "italic", padding: "8px 2px" }}>Loading…</div>
          ) : leaders.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--nv-text-dim)", fontStyle: "italic", padding: "8px 2px" }}>No scores yet — be the first!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {leaders.map((row, i) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 8, alignItems: "center", padding: "4px 8px", borderRadius: 6, background: row.uid === myUid ? fill(AC) : "transparent", fontFamily: FF }}>
                  <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: i === 0 ? "#ffd060" : i === 1 ? "#cfd3da" : i === 2 ? "#d8954e" : "var(--nv-text-dim)" }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: row.uid === myUid ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{row.user || "anon"}{row.uid === myUid && <span style={{ fontSize: 9, color: "var(--nv-text-dim)", marginLeft: 5, fontFamily: FFM }}>you</span>}</span>
                  <span style={{ fontFamily: FFM, fontSize: 12, color: "var(--nv-text)" }}>{row.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

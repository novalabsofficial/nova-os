// v10.10 — Typing test. Timed WPM/accuracy run against a stream of common
// words; personal-best WPM goes to the global leaderboard (dir "high").
import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { submitScore, fetchLeaderboard } from "../lib/scores.js";
import { getDbUid } from "../lib/db.js";

const WORDS = ("the of to and a in is it you that he was for on are with as his they be at one have this from or had by but some what there we can out other were all your when up use word how said an each she which do their time if will way about many then them would like so these her long make thing see him two has look more day could go come did number sound no most people over know water than call first who may down side been now find any new work part take get place made live where after back little only round man year came show every good give our under name very through just form great think say help low line differ turn cause much mean before move right boy old too same tell does set three want air well play small end put home read hand large spell add even land here must big high such follow act why ask men change went light kind off need house picture try again animal point mother world near build self earth father").split(/\s+/);

function pickWords(n) { const out = []; for (let i = 0; i < n; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)]); return out; }

const GAME = "typing";
const DURATIONS = [15, 30, 60];

export function TypingApp({ AC, user }) {
  const myUid = getDbUid();
  const [duration, setDuration] = useState(() => parseInt(localStorage.getItem("nova-typing-dur"), 10) || 30);
  const [target, setTarget] = useState(() => pickWords(140).join(" "));
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("idle"); // idle | running | done
  const [timeLeft, setTimeLeft] = useState(duration);
  const [result, setResult] = useState(null);    // { wpm, acc, correct, total }
  const [leaders, setLeaders] = useState(null);
  const [showLb, setShowLb] = useState(false);

  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const typedRef = useRef("");
  const endAtRef = useRef(0);
  const [runId, setRunId] = useState(0);   // bump to remount the input on reset (clears any stale value)

  useEffect(() => { localStorage.setItem("nova-typing-dur", String(duration)); if (status === "idle") setTimeLeft(duration); /* eslint-disable-next-line */ }, [duration]);

  const reset = useCallback(() => {
    setTarget(pickWords(140).join(" "));
    setTyped(""); typedRef.current = "";
    setStatus("idle"); setTimeLeft(duration); setResult(null);
    setRunId(r => r + 1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [duration]);

  const finish = useCallback(() => {
    const t = typedRef.current;
    let correct = 0;
    for (let i = 0; i < t.length; i++) if (t[i] === target[i]) correct++;
    const minutes = duration / 60;
    const wpm = Math.max(0, Math.round((correct / 5) / minutes));
    const acc = t.length ? Math.round((correct / t.length) * 100) : 100;
    setResult({ wpm, acc, correct, total: t.length });
    setStatus("done");
    if (myUid && wpm > 0) submitScore(GAME, wpm, "high", myUid, user);
  }, [target, duration, myUid, user]);

  // The countdown lives only while running — a single interval cleaned up on
  // every phase change (no leaks / stuck timers across tests). Time is derived
  // from a fixed deadline so it can't drift or compound.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      const left = Math.ceil((endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left > 0 ? left : 0);
      if (left <= 0) finish();
    }, 200);
    return () => clearInterval(id);
  }, [status, finish]);

  // keep the caret in view as you type
  useEffect(() => { caretRef.current?.scrollIntoView({ block: "center" }); }, [typed]);

  const onType = (e) => {
    if (status === "done") return;
    let v = e.target.value;
    if (v.length > target.length) v = v.slice(0, target.length);
    if (status === "idle" && v.length > 0) {
      endAtRef.current = Date.now() + duration * 1000;
      setStatus("running");
    }
    typedRef.current = v;
    setTyped(v);
    if (v.length >= target.length) finish();   // finished the whole passage early
  };

  const openLb = () => {
    setShowLb(true); setLeaders(null);
    fetchLeaderboard(GAME, "high", 10).then(setLeaders);
  };

  // live WPM while running
  const liveCorrect = (() => { let c = 0; for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) c++; return c; })();
  const elapsed = duration - timeLeft;
  const liveWpm = status === "running" && elapsed > 0 ? Math.round((liveCorrect / 5) / (elapsed / 60)) : 0;

  const chip = (active, on, label, onClick) => (
    <button onClick={onClick} style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"), background: active ? fill(AC) : "transparent", color: active ? AC : "var(--nv-text-dim)", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
  );

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)", marginRight: 4 }}>⌨️ Typing Test</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DURATIONS.map((d) => chip(duration === d, false, d + "s", () => { if (status !== "running") { setDuration(d); } }))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={openLb} style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>🏆 Leaderboard</button>
          <button onClick={reset} style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, fontFamily: FFB, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>↻ Restart</button>
        </div>
      </div>

      {/* stat bar */}
      <div style={{ display: "flex", gap: 18, alignItems: "baseline", flexShrink: 0 }}>
        <div><span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 26, color: AC }}>{Math.max(0, timeLeft)}</span><span style={{ fontSize: 12, color: "var(--nv-text-dim)", marginLeft: 4 }}>sec</span></div>
        <div><span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 22, color: "var(--nv-text-strong)" }}>{result ? result.wpm : liveWpm}</span><span style={{ fontSize: 12, color: "var(--nv-text-dim)", marginLeft: 4 }}>wpm</span></div>
        {result && <div><span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 22, color: "var(--nv-text-strong)" }}>{result.acc}%</span><span style={{ fontSize: 12, color: "var(--nv-text-dim)", marginLeft: 4 }}>acc</span></div>}
      </div>

      {/* typing surface */}
      <div onClick={() => inputRef.current?.focus()} style={{ position: "relative", flex: 1, minHeight: 0, cursor: "text" }}>
        <div className="no-sb" style={{ height: "100%", overflowY: "auto", padding: "16px 18px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12, fontSize: 20, lineHeight: 1.9, fontFamily: FFM, letterSpacing: 0.3, opacity: status === "done" ? 0.5 : 1 }}>
          {target.split("").map((ch, i) => {
            const done = i < typed.length;
            const ok = done && typed[i] === target[i];
            const bad = done && !ok;
            const isCaret = i === typed.length;
            return (
              <span key={i} ref={isCaret ? caretRef : null} style={{
                color: ok ? "var(--nv-text-strong)" : bad ? "#ff6b6b" : "var(--nv-text-dim)",
                background: bad && ch === " " ? "rgba(255,107,107,0.25)" : "transparent",
                borderLeft: isCaret ? "2px solid " + AC : "2px solid transparent",
                marginLeft: isCaret ? -2 : 0,
              }}>{ch}</span>
            );
          })}
        </div>
        <input
          key={runId} ref={inputRef} value={typed} onChange={onType} autoFocus
          autoCorrect="off" autoCapitalize="off" spellCheck="false"
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
        />
        {status === "idle" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ padding: "8px 16px", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 20, fontSize: 12.5, color: "var(--nv-text-dim)", fontFamily: FF }}>Start typing — the timer begins on your first keystroke</div>
          </div>
        )}
      </div>

      {result && (
        <div style={{ flexShrink: 0, textAlign: "center", padding: "12px 14px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 12 }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: AC }}>{result.wpm} WPM</span>
          <span style={{ fontSize: 13, color: "var(--nv-text)", marginLeft: 10 }}>{result.acc}% accuracy · {result.correct}/{result.total} chars</span>
        </div>
      )}

      {showLb && (
        <div onClick={() => setShowLb(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, maxHeight: "80%", overflowY: "auto", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)" }}>🏆 Top Typists</div>
              <button onClick={() => setShowLb(false)} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 7, border: "none", background: "var(--nv-hover)", color: "var(--nv-text)", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            {leaders === null ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>Loading…</div>
            ) : leaders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--nv-text-dim)", fontSize: 13 }}>No scores yet — be the first!</div>
            ) : leaders.map((row, i) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 8, alignItems: "center", padding: "7px 9px", borderRadius: 7, background: row.uid === myUid ? fill(AC) : "transparent", fontFamily: FF }}>
                <span style={{ fontFamily: FFM, fontSize: 12, color: "var(--nv-text-dim)" }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: row.uid === myUid ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{row.user || "anon"}{row.uid === myUid && <span style={{ fontSize: 9, color: "var(--nv-text-dim)", marginLeft: 5, fontFamily: FFM }}>you</span>}</span>
                <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)" }}>{row.score} wpm</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

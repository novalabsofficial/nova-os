// v10.0 Supernova — AI command bar.
//
// A floating Cmd/Ctrl+J palette: type a natural-language request, Nova AI
// turns it into an action plan, and the OS executes it. Reuses the BYOK
// Nova AI setup (same keys/model as the Nova AI app + AiAssist) — requests
// go browser → provider, never through a Nova server.
//
// The component is presentation + orchestration; the actual OS actions are
// performed by the `onExecute(tool, args)` callback the host (NovaOS)
// passes in, which returns a short human-readable result string.

import { useState, useRef, useEffect } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { aiLoad, AI_LS_KEYS, AI_LS_CONFIG } from "../lib/ai-storage.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream } from "../lib/ai.js";
import { buildCommandPrompt, parseCommandPlan } from "../lib/ai-commands.js";

const SUGGESTIONS = [
  "Open Notes and write down 'buy milk'",
  "Set the wallpaper to Ember",
  "Make my accent color green",
  "Add a task to finish the essay",
  "Turn the volume down to 20%",
  "Open the weather app",
];

export function CommandBar({ AC, context, onExecute, onOpenNovaAi, onClose }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");          // AI's confirmation sentence
  const [results, setResults] = useState([]);      // [{ tool, ok, msg }]
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Read BYOK config the same way AiAssist does.
  const keys = aiLoad(AI_LS_KEYS, {});
  const config = aiLoad(AI_LS_CONFIG, { provider: "claude", model: {} });
  const provider = config.provider || "claude";
  const model = (config.model && config.model[provider]) || AI_PROVIDERS[provider]?.defaultModel;
  const apiKey = keys[provider] || "";
  const hasKey = !!apiKey.trim();

  useEffect(() => { inputRef.current?.focus(); }, []);
  // Esc closes (capture so it beats the global handler).
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function run(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    if (!hasKey) { setError("Add your API key in Nova AI first."); return; }
    setBusy(true); setError(null); setReply(""); setResults([]);
    const sys = buildCommandPrompt(context);
    const messages = [{ role: "user", content: sys + "\n\nUser request: " + q }];
    let acc = "";
    try {
      for await (const chunk of aiStream(provider, model, apiKey, messages, {})) acc += chunk;
    } catch (e) {
      setError(e?.message || "Request failed");
      setBusy(false);
      return;
    }
    const plan = parseCommandPlan(acc);
    if (plan.error) {
      setError(plan.error);
      setBusy(false);
      return;
    }
    setReply(plan.reply || "");
    // Execute steps sequentially, collecting results.
    const out = [];
    for (const step of plan.steps) {
      try {
        const msg = await onExecute(step.tool, step.args || {});
        // A null/empty result means a no-op step (e.g. "answer") — the reply
        // line already covers it, so don't render a redundant row.
        if (msg) out.push({ tool: step.tool, ok: true, msg });
      } catch (e) {
        out.push({ tool: step.tool, ok: false, msg: e?.message || "Failed" });
      }
      setResults([...out]);
    }
    setBusy(false);
  }

  const done = !busy && (reply || results.length > 0 || error);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", animation: "ss-fade 0.14s" }} />
      <div style={{
        position: "fixed", top: "16%", left: "50%", transform: "translateX(-50%)",
        width: "min(600px, calc(100vw - 32px))", zIndex: 100001,
        background: "var(--nv-surface-solid)", backdropFilter: "blur(34px) saturate(160%)",
        border: "1px solid var(--nv-border-strong)", borderRadius: 16,
        boxShadow: "0 30px 90px rgba(0,0,0,0.6)", overflow: "hidden",
        fontFamily: FF, animation: "menu-up 0.18s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Input row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: (done || busy) ? "1px solid var(--nv-border)" : "none" }}>
          <span style={{ fontSize: 20, filter: "drop-shadow(0 0 10px rgba(168,85,247,0.5))" }}>✨</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
            placeholder={hasKey ? "Tell Nova what to do…" : "Add a Nova AI key to use the command bar"}
            disabled={busy}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 16, opacity: busy ? 0.6 : 1 }}
          />
          {busy
            ? <div style={{ width: 18, height: 18, border: "2px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            : <kbd style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", border: "1px solid var(--nv-border)", borderRadius: 5, padding: "2px 6px" }}>⏎</kbd>}
        </div>

        {/* Body */}
        <div style={{ maxHeight: "min(50vh, 420px)", overflowY: "auto" }}>
          {!hasKey && (
            <div style={{ padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--nv-text)", lineHeight: 1.6, marginBottom: 12 }}>
                The command bar uses your <strong>Nova AI</strong> key (Claude, ChatGPT, or Gemini). Add one once and it works here + everywhere.
              </div>
              <button onClick={() => { onClose(); onOpenNovaAi?.(); }} style={{ padding: "9px 18px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: AC }}>Open Nova AI settings →</button>
            </div>
          )}

          {hasKey && !done && !busy && (
            <div style={{ padding: "10px 12px 14px" }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase", padding: "4px 8px 8px" }}>Try saying</div>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); run(s); }} className="fr" style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", fontFamily: FF, fontSize: 13, color: "var(--nv-text)" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {(reply || results.length > 0) && (
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {reply && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14 }}>✨</span>
                  <div style={{ fontSize: 13.5, color: "var(--nv-text-strong)", lineHeight: 1.6 }}>{reply}</div>
                </div>
              )}
              {results.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 11px", borderRadius: 8, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)" }}>
                  <span style={{ fontSize: 13, color: r.ok ? "#4cef90" : "#ff8b8b", flexShrink: 0 }}>{r.ok ? "✓" : "⚠"}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--nv-text)" }}>{r.msg}</span>
                  <span style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)" }}>{r.tool}</span>
                </div>
              ))}
              {!busy && (
                <button onClick={() => { setInput(""); setReply(""); setResults([]); setError(null); inputRef.current?.focus(); }} style={{ alignSelf: "flex-start", marginTop: 2, padding: "5px 12px", background: "transparent", border: "1px solid var(--nv-border)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "var(--nv-text-dim)" }}>↺ New command</button>
              )}
            </div>
          )}

          {error && (
            <div style={{ margin: "0 18px 16px", padding: "10px 12px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 8, fontSize: 12.5, color: "#ff8b8b" }}>⚠ {error}</div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--nv-border)", display: "flex", alignItems: "center", gap: 8, fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)" }}>
          <span>Nova AI · {AI_PROVIDERS[provider]?.label || provider}</span>
          <div style={{ flex: 1 }} />
          <span>Esc to close</span>
        </div>
      </div>
    </>
  );
}

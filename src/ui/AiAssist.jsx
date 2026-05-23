// ✨ button + popover modal that lets any app pipe context to the user's
// BYOK Nova AI provider. Reads keys + model from localStorage so every app
// shares the same setup. If the user hasn't configured Nova AI yet, the
// popover routes them to Settings.
//
// Usage from an app:
//   <AiAssist
//     AC={AC}
//     openNovaAi={() => openApp("novaai")}
//     actions={[{icon: "✍", label: "Improve writing", prompt: "Improve this:"}]}
//     getContext={() => noteBody}
//   />

import { useState } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr } from "../lib/format.js";
import { aiLoad, AI_LS_KEYS, AI_LS_CONFIG } from "../lib/ai-storage.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream } from "../lib/ai.js";

export function AiAssist({ actions, getContext, AC, openNovaAi }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [activeAction, setActiveAction] = useState(null);

  // Read BYOK config synchronously from localStorage on each render so changes
  // in Nova AI Settings show up here without remounting. Cheap operation.
  const keys = aiLoad(AI_LS_KEYS, {claude: "", openai: ""});
  const config = aiLoad(AI_LS_CONFIG, {
    provider: "claude",
    model: {claude: AI_PROVIDERS.claude.defaultModel, openai: AI_PROVIDERS.openai.defaultModel},
  });
  const provider = config.provider;
  const model = config.model[provider] || AI_PROVIDERS[provider].defaultModel;
  const apiKey = keys[provider] || "";
  const hasKey = !!apiKey.trim();

  async function runAction(action) {
    if (!hasKey) { setError("Set up Nova AI first."); return; }
    setActiveAction(action.label);
    setBusy(true); setOutput(""); setError(null);
    const context = (getContext?.() || "").toString();
    const userContent = action.prompt + (context ? "\n\n" + context : "");
    let acc = "";
    try {
      for await (const chunk of aiStream(provider, model, apiKey, [{role: "user", content: userContent}], {})) {
        acc += chunk;
        setOutput(acc);
      }
    } catch (e) { setError(e?.message || "Request failed"); }
    setBusy(false);
  }
  function closeAll() {
    setOpen(false); setBusy(false); setOutput(""); setError(null); setActiveAction(null);
  }

  return (
    <>
      <button onClick={() => setOpen(o => !o)} title="Ask Nova AI" style={{
        padding: "5px 10px", borderRadius: 7, cursor: "pointer",
        background: open ? fill(AC) : "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(6,182,212,0.18))",
        border: "1px solid " + (open ? bdr(AC) : "rgba(168,85,247,0.4)"),
        fontFamily: FFB, fontWeight: 600, fontSize: 11, color: open ? AC : "rgba(255,255,255,0.85)",
        display: "flex", alignItems: "center", gap: 5,
      }}>✨ AI</button>

      {open && (
        <>
          <div onClick={closeAll} style={{position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99998}}/>
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(540px, calc(100vw - 32px))", maxHeight: "min(80vh, 640px)",
            background: "rgba(11,13,28,0.98)", backdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            zIndex: 99999, display: "flex", flexDirection: "column", fontFamily: FF,
            animation: "win-in 0.24s cubic-bezier(0.16,1,0.3,1)",
          }}>
            {/* Header */}
            <div style={{padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 9, flexShrink: 0}}>
              <span style={{fontSize: 18}}>✨</span>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "#fff"}}>Nova AI</div>
                {hasKey ? (
                  <div style={{fontSize: 10, fontFamily: FFM, color: "rgba(255,255,255,0.4)"}}>{AI_PROVIDERS[provider].label} · {model}</div>
                ) : (
                  <div style={{fontSize: 10, fontFamily: FF, color: "#ffaa44"}}>No API key set up yet</div>
                )}
              </div>
              <button onClick={closeAll} style={{width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 14}}>✕</button>
            </div>

            {/* Body */}
            <div style={{flex: 1, overflowY: "auto", padding: "14px 16px", minHeight: 0}}>
              {!hasKey ? (
                <div style={{textAlign: "center", padding: "20px 10px"}}>
                  <div style={{fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 14}}>
                    This app uses your <strong>Nova AI</strong> setup. Add your Claude or ChatGPT API key once and it works everywhere.
                  </div>
                  <button onClick={() => { closeAll(); openNovaAi?.(); }} style={{padding: "9px 18px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC}}>Open Nova AI Settings →</button>
                </div>
              ) : (
                <>
                  {!output && !busy && !error && (
                    <div style={{display: "flex", flexDirection: "column", gap: 6}}>
                      {actions.map((a, i) => (
                        <button key={i} onClick={() => runAction(a)} style={{textAlign: "left", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer", fontFamily: FF, fontSize: 13, color: "rgba(255,255,255,0.88)", display: "flex", alignItems: "center", gap: 9}}>
                          <span style={{fontSize: 16}}>{a.icon || "✨"}</span>
                          <span style={{flex: 1}}>{a.label}</span>
                          <span style={{color: "rgba(255,255,255,0.3)", fontSize: 11}}>→</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {(busy || output) && (
                    <>
                      <div style={{fontSize: 10, fontFamily: FFM, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 8}}>{(activeAction || "").toUpperCase()}</div>
                      <div style={{fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word"}}>
                        {output || <span style={{opacity: 0.4, fontStyle: "italic"}}>Thinking…</span>}
                        {busy && output && <span style={{opacity: 0.5, animation: "pulse 1s ease-in-out infinite"}}>▍</span>}
                      </div>
                    </>
                  )}
                  {error && (
                    <div style={{padding: "10px 12px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 7, fontSize: 12, color: "#ff8b8b"}}>⚠ {error}</div>
                  )}
                </>
              )}
            </div>

            {/* Footer (only when there's output to act on) */}
            {output && !busy && (
              <div style={{padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 7, flexShrink: 0}}>
                <button onClick={() => { try { navigator.clipboard?.writeText(output); } catch {} }} style={{padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.75)"}}>📋 Copy</button>
                <button onClick={() => { setOutput(""); setError(null); setActiveAction(null); }} style={{padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.75)"}}>← New action</button>
                <div style={{flex: 1}}/>
                <button onClick={closeAll} style={{padding: "7px 14px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: AC}}>Done</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

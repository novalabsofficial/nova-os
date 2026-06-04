// v9.5 — Nova AI rebuilt to feel like a proper desktop assistant (Claude.ai
// desktop / ChatGPT desktop as references). Two-pane layout with a sidebar
// of saved conversations and a polished chat surface on the right. New for
// v9.5:
//   • Renamable conversation titles (double-click in the sidebar to edit)
//   • Provider/model switcher lives inline on the chat header so swapping
//     between Claude / GPT / Gemini is one click — no diving into Settings.
//   • Quick-prompt starter chips on the empty/new-chat state.
//   • Polished message bubbles with copy-to-clipboard, "user/assistant"
//     labels, and an avatar gutter for visual rhythm.
//   • Keeps the BYOK promise — keys + chats stay in localStorage on this
//     device only, requests go browser → provider, never via a Nova server.

import { useState, useEffect, useRef, useMemo } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream, deriveTitle as aiDeriveTitle } from "../lib/ai.js";
import { aiLoad, aiSave, AI_LS_KEYS, AI_LS_CONFIG, AI_LS_CHATS } from "../lib/ai-storage.js";

// Curated starter prompts shown on the empty-state. Each one fires
// immediately when clicked — drops you into a working chat instead of an
// intimidating blank textarea.
const STARTERS = [
  { icon: "✍",  label: "Write a polite email asking for a deadline extension." },
  { icon: "💡", label: "Brainstorm 5 names for a side project I'm starting." },
  { icon: "📚", label: "Explain a tricky concept like I'm a curious beginner." },
  { icon: "🧮", label: "Help me debug code — I'll paste it next." },
  { icon: "🎯", label: "Plan my next week given a list of priorities." },
  { icon: "✨", label: "Surprise me with something interesting to learn today." },
];

import { novaConfirm } from "../ui/dialogs.jsx";

export function NovaAiApp({ AC, showToast }) {
  // ── persistent state ─────────────────────────────────────────────────
  const [keys, setKeys] = useState(() => ({ claude: "", openai: "", gemini: "", ...aiLoad(AI_LS_KEYS, {}) }));
  const [config, setConfig] = useState(() => {
    const loaded = aiLoad(AI_LS_CONFIG, null);
    const defaults = {
      claude: AI_PROVIDERS.claude.defaultModel,
      openai: AI_PROVIDERS.openai.defaultModel,
      gemini: AI_PROVIDERS.gemini.defaultModel,
    };
    if (!loaded) return { provider: "claude", model: defaults };
    return { provider: loaded.provider || "claude", model: { ...defaults, ...(loaded.model || {}) } };
  });
  const [chats, setChats] = useState(() => aiLoad(AI_LS_CHATS, []));
  const [activeId, setActiveId] = useState(() => chats[0]?.id || null);

  // ── transient state ──────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");
  const [error, setError] = useState(null);
  const [view, setView] = useState("chat");                 // chat | settings
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const scrollRef = useRef(null);

  // Persist everything that should outlive the app.
  useEffect(() => aiSave(AI_LS_KEYS, keys), [keys]);
  useEffect(() => aiSave(AI_LS_CONFIG, config), [config]);
  useEffect(() => aiSave(AI_LS_CHATS, chats), [chats]);

  // Auto-scroll the message list when it grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, streamBuf, chats]);

  // ── derived state ────────────────────────────────────────────────────
  const provider = config.provider;
  const model    = config.model[provider] || AI_PROVIDERS[provider].defaultModel;
  const apiKey   = keys[provider] || "";
  const hasKey   = !!apiKey.trim();
  const active   = chats.find(c => c.id === activeId) || null;

  // Group chats by recency for the sidebar headers — feels more like a real
  // chat app than a flat undated list. Buckets: Today, Yesterday, This week,
  // Earlier.
  const chatGroups = useMemo(() => groupByRecency(chats), [chats]);

  // ── chat helpers ─────────────────────────────────────────────────────
  function newChat() { setActiveId(null); setInput(""); setError(null); setStreamBuf(""); setView("chat"); }
  function selectChat(id) { setActiveId(id); setError(null); setStreamBuf(""); setView("chat"); }
  async function deleteChat(id) {
    if (!(await novaConfirm({ title: "Delete conversation", message: "Delete this conversation?", danger: true, confirmText: "Delete", accent: AC }))) return;
    setChats(prev => prev.filter(c => c.id !== id));
    if (id === activeId) setActiveId(null);
  }
  function beginRename(id, currentTitle) {
    setRenamingId(id);
    setRenameDraft(currentTitle);
  }
  function commitRename() {
    if (!renamingId) return;
    const title = renameDraft.trim() || "Untitled";
    setChats(prev => prev.map(c => c.id === renamingId ? { ...c, title } : c));
    setRenamingId(null);
  }

  // ── send ─────────────────────────────────────────────────────────────
  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    if (!hasKey) { setError("Add your API key in Settings first."); setView("settings"); return; }

    setError(null); setSending(true); setInput(""); setStreamBuf("");

    let chatId = activeId;
    let chatMessages;
    if (!chatId) {
      const newId = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      const newChatObj = {
        id: newId, title: aiDeriveTitle(text),
        provider, model,
        messages: [{ role: "user", content: text }],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      setChats(prev => [newChatObj, ...prev]);
      setActiveId(newId);
      chatId = newId;
      chatMessages = newChatObj.messages;
    } else {
      chatMessages = [...active.messages, { role: "user", content: text }];
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: chatMessages, updatedAt: Date.now() } : c));
    }

    let acc = "";
    try {
      for await (const chunk of aiStream(provider, model, apiKey, chatMessages)) {
        acc += chunk;
        setStreamBuf(acc);
      }
      setChats(prev => prev.map(c => c.id === chatId
        ? { ...c, messages: [...chatMessages, { role: "assistant", content: acc }], updatedAt: Date.now() }
        : c
      ));
      setStreamBuf("");
    } catch (err) {
      setError(err?.message || "Request failed");
      setStreamBuf("");
    } finally {
      setSending(false);
    }
  }
  function onInputKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── render ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* ───── SIDEBAR — chats ───── */}
      <div style={{
        width: 232, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        display: "flex", flexDirection: "column", minHeight: 0,
        background:"var(--nv-elevated)",
      }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--nv-border)", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(6,182,212,0.35))",
              border: "1px solid rgba(168,85,247,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              flexShrink: 0,
            }}>✨</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)" }}>Nova AI</div>
              <div style={{ fontFamily: FFM, fontSize: 9.5, color: "var(--nv-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {AI_PROVIDERS[provider].label} · {hasKey ? "ready" : "no key"}
              </div>
            </div>
          </div>
          <button onClick={newChat} style={{
            padding: "8px 12px", background: fill(AC), border: "1px solid " + bdr(AC),
            borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700,
            fontSize: 12, color: AC, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>＋ New chat</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "8px 8px" }}>
          {chats.length === 0 ? (
            <div style={{ padding: "20px 10px", fontSize: 11, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center", lineHeight: 1.6 }}>
              No conversations yet.<br/>Start one to see it here.
            </div>
          ) : chatGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{ padding: "6px 9px 4px", fontFamily: FFB, fontWeight: 700, fontSize: 9.5, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase" }}>{group.label}</div>
              {group.chats.map(c => {
                const isActive = c.id === activeId;
                const isRenaming = renamingId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => !isRenaming && selectChat(c.id)}
                    onDoubleClick={() => beginRename(c.id, c.title)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 9px", marginBottom: 2, borderRadius: 7,
                      cursor: isRenaming ? "default" : "pointer",
                      background: isActive ? fill(AC) : "transparent",
                      border: "1px solid " + (isActive ? bdr(AC) : "transparent"),
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isActive && !isRenaming) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if (!isActive && !isRenaming) e.currentTarget.style.background = "transparent"; }}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={e => setRenameDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={commitRename}
                        style={{ flex: 1, minWidth: 0, padding: "2px 6px", fontSize: 11.5, background: "var(--nv-input-bg)", color: "var(--nv-text-strong)", border: "1px solid " + bdr(AC), borderRadius: 5, fontFamily: FF, outline: "none" }}
                      />
                    ) : (
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontFamily: FF, color: isActive ? AC : "var(--nv-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive ? 600 : 400 }}>{c.title}</span>
                    )}
                    {!isRenaming && (
                      <button
                        className="dl"
                        onClick={e => { e.stopPropagation(); deleteChat(c.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.35)", fontSize: 11, padding: "2px 4px", flexShrink: 0 }}
                        title="Delete"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer: settings shortcut */}
        <button onClick={() => setView(v => v === "settings" ? "chat" : "settings")} style={{
          padding: "10px 14px", borderTop: "1px solid var(--nv-border)",
          background: view === "settings" ? fill(AC) : "transparent",
          border: "none", cursor: "pointer", textAlign: "left",
          fontFamily: FFB, fontWeight: 600, fontSize: 11.5,
          color: view === "settings" ? AC : "var(--nv-text)",
          display: "flex", alignItems: "center", gap: 9,
        }}>
          <CogGlyph/> {view === "settings" ? "Back to chat" : "Settings"}
        </button>
      </div>

      {/* ───── MAIN PANE ───── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, position: "relative" }}>
        {/* Header */}
        <div style={{
          padding: "10px 16px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {view === "settings" ? "Settings" : (active ? active.title : "New chat")}
            </div>
            <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {view === "settings" ? "API keys, models, and providers" : `${AI_PROVIDERS[provider].label} · ${model}`}
            </div>
          </div>

          {/* Provider picker — only shown in chat mode */}
          {view === "chat" && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setProviderPickerOpen(o => !o)} style={{
                padding: "6px 11px", borderRadius: 8, cursor: "pointer",
                background: providerPickerOpen ? fill(AC) : "var(--nv-elevated)",
                border: "1px solid " + (providerPickerOpen ? bdr(AC) : "var(--nv-border)"),
                color: providerPickerOpen ? AC : "var(--nv-text)",
                fontFamily: FFB, fontWeight: 600, fontSize: 11,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {AI_PROVIDERS[provider].label} <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
              </button>
              {providerPickerOpen && (
                <>
                  <div onClick={() => setProviderPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
                    width: 220, padding: 6, borderRadius: 10,
                    background: "var(--nv-surface-solid)", backdropFilter: "blur(20px)",
                    border: "1px solid var(--nv-border-strong)",
                    boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
                    animation: "menu-up 0.16s ease-out",
                  }}>
                    {Object.keys(AI_PROVIDERS).map(k => {
                      const p = AI_PROVIDERS[k];
                      const hasK = !!(keys[k] || "").trim();
                      return (
                        <button
                          key={k}
                          onClick={() => { setConfig(c => ({ ...c, provider: k })); setProviderPickerOpen(false); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "8px 10px", borderRadius: 7,
                            background: provider === k ? fill(AC) : "transparent",
                            border: "none", cursor: "pointer", textAlign: "left",
                          }}
                          onMouseEnter={e => { if (provider !== k) e.currentTarget.style.background = "var(--nv-hover)"; }}
                          onMouseLeave={e => { if (provider !== k) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: provider === k ? AC : "var(--nv-text-strong)" }}>{p.label}</div>
                            <div style={{ fontFamily: FFM, fontSize: 9.5, color: "var(--nv-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{config.model[k] || p.defaultModel}</div>
                          </div>
                          <span style={{ fontSize: 9.5, color: hasK ? "#4cef90" : "var(--nv-text-dim)", fontFamily: FFM, flexShrink: 0 }}>{hasK ? "● key" : "○ no key"}</span>
                        </button>
                      );
                    })}
                    <div style={{ height: 1, background: "var(--nv-border)", margin: "5px 4px" }}/>
                    <button onClick={() => { setProviderPickerOpen(false); setView("settings"); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "var(--nv-text-dim)", textAlign: "left" }}>
                      Manage keys & models →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {view === "settings"
          ? <SettingsView
              keys={keys} setKeys={setKeys}
              config={config} setConfig={setConfig}
              onClose={() => setView("chat")}
              AC={AC}
            />
          : <ChatView
              active={active}
              streamBuf={streamBuf}
              sending={sending}
              error={error}
              scrollRef={scrollRef}
              onStarterClick={text => send(text)}
              hasKey={hasKey}
              provider={provider}
              onOpenSettings={() => setView("settings")}
              AC={AC}
            />
        }

        {/* Input bar (chat only) */}
        {view === "chat" && (
          <div style={{ padding: "10px 16px 12px", borderTop: "1px solid var(--nv-border)", flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onInputKey}
              placeholder={hasKey ? "Ask Nova AI…  ⏎ to send · Shift+⏎ for newline" : "Add your API key in Settings to start chatting"}
              rows={1}
              disabled={sending || !hasKey}
              style={{
                flex: 1, padding: "10px 14px", background: "var(--nv-input-bg)",
                border: "1px solid var(--nv-border)", borderRadius: 11,
                color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 13,
                outline: "none", resize: "none", minHeight: 42, maxHeight: 180,
                lineHeight: 1.5, opacity: sending || !hasKey ? 0.5 : 1,
              }}
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              style={{
                padding: "0 16px", height: 42,
                background: fill(AC), border: "1px solid " + bdr(AC),
                borderRadius: 11, cursor: sending || !input.trim() ? "default" : "pointer",
                fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC,
                opacity: sending || !input.trim() ? 0.4 : 1, whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {sending ? "…" : <>Send <span style={{ fontSize: 11, opacity: 0.7 }}>↵</span></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Chat view ────────────────────────────────────

function ChatView({ active, streamBuf, sending, error, scrollRef, onStarterClick, hasKey, provider, onOpenSettings, AC }) {
  if (!active && streamBuf === "" && !sending) {
    return (
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 24px", minHeight: 0 }}>
        <div style={{ width: "min(640px, 100%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, paddingTop: 30 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, rgba(168,85,247,0.4), rgba(6,182,212,0.4))",
            border: "1px solid rgba(168,85,247,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, filter: "drop-shadow(0 0 20px rgba(168,85,247,0.4))",
          }}>✨</div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 24, color: "var(--nv-text-strong)", letterSpacing: 0.2 }}>How can I help today?</div>
            <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", marginTop: 6, lineHeight: 1.6, maxWidth: 460 }}>
              Powered by <strong style={{ color: "var(--nv-text)" }}>{AI_PROVIDERS[provider].label}</strong> using your own API key. All messages go from your browser straight to the provider — Nova OS never sees them.
            </div>
          </div>

          {!hasKey ? (
            <button onClick={onOpenSettings} style={{
              marginTop: 4, padding: "10px 18px", background: fill(AC),
              border: "1px solid " + bdr(AC), borderRadius: 10, cursor: "pointer",
              fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC,
            }}>Add your API key →</button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, width: "100%", marginTop: 8 }}>
                {STARTERS.map((s, i) => (
                  <button key={i} onClick={() => onStarterClick(s.label)} className="fr" style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
                    color: "var(--nv-text)", textAlign: "left", fontFamily: FF,
                    transition: "background 0.12s, border-color 0.12s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--nv-border-strong)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--nv-border)"; }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontSize: 12, color: "var(--nv-text)", lineHeight: 1.5 }}>{s.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 4, letterSpacing: 0.3 }}>Pick a starter or type your own below.</div>
            </>
          )}
        </div>
      </div>
    );
  }

  const msgs = active?.messages || [];
  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
      {msgs.map((m, i) => <MessageBubble key={i} role={m.role} content={m.content} AC={AC}/>)}
      {(streamBuf || sending) && (
        <MessageBubble role="assistant" content={streamBuf} streaming={sending} AC={AC}/>
      )}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.35)", borderRadius: 9, fontSize: 12, color: "#ff8b8b", fontFamily: FFM }}>⚠ {error}</div>
      )}
    </div>
  );
}

function MessageBubble({ role, content, streaming, AC }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  function copy() {
    try { navigator.clipboard?.writeText(content || ""); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  }
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      flexDirection: isUser ? "row-reverse" : "row",
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13,
        background: isUser ? fill(AC) : "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(6,182,212,0.35))",
        border: "1px solid " + (isUser ? bdr(AC) : "rgba(168,85,247,0.45)"),
        color: isUser ? AC : "#fff",
      }}>{isUser ? "👤" : "✨"}</div>

      {/* Bubble + meta */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 44px)", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 10.5, color: "var(--nv-text-dim)", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" }}>
          {isUser ? "You" : "Nova AI"}
        </div>
        <div style={{
          padding: "11px 15px",
          maxWidth: "100%",
          borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
          background: isUser ? fill(AC) : "var(--nv-elevated)",
          border: "1px solid " + (isUser ? bdr(AC) : "var(--nv-border)"),
          fontSize: 13.5, color: "var(--nv-text-strong)", lineHeight: 1.65,
          whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: FF,
          position: "relative",
        }}>
          {content || (streaming && <span style={{ opacity: 0.55, fontStyle: "italic" }}>Thinking…</span>)}
          {streaming && content && <span style={{ opacity: 0.55, animation: "pulse 1s ease-in-out infinite", marginLeft: 2 }}>▍</span>}
        </div>
        {/* Per-bubble actions — only on assistant + after streaming finished */}
        {!isUser && !streaming && content && (
          <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
            <button onClick={copy} style={{
              padding: "3px 9px", borderRadius: 6, cursor: "pointer",
              background: "transparent", border: "1px solid var(--nv-border)",
              fontFamily: FFM, fontSize: 10, color: copied ? "#4cef90" : "var(--nv-text-dim)",
              transition: "color 0.18s",
            }}>{copied ? "✓ Copied" : "📋 Copy"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Settings view ────────────────────────────────

function SettingsView({ keys, setKeys, config, setConfig, onClose, AC }) {
  const provider = config.provider;
  const model = config.model[provider] || AI_PROVIDERS[provider].defaultModel;
  const apiKey = keys[provider] || "";
  const hasKey = !!apiKey.trim();
  const p = AI_PROVIDERS[provider];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 24px", minHeight: 0 }}>
      <div style={{ maxWidth: 560 }}>

        <div style={SEC}>Provider</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {Object.keys(AI_PROVIDERS).map(k => {
            const hasK = !!(keys[k] || "").trim();
            return (
              <button
                key={k}
                onClick={() => setConfig(c => ({ ...c, provider: k }))}
                style={{
                  flex: 1, padding: "11px 12px", borderRadius: 9, cursor: "pointer",
                  background: provider === k ? fill(AC) : "var(--nv-elevated)",
                  border: "1px solid " + (provider === k ? bdr(AC) : "var(--nv-border)"),
                  fontFamily: FFB, fontWeight: 700, fontSize: 12.5,
                  color: provider === k ? AC : "var(--nv-text)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}
              >
                <span>{AI_PROVIDERS[k].label}</span>
                <span style={{ fontFamily: FFM, fontSize: 9.5, color: hasK ? "#4cef90" : "var(--nv-text-dim)" }}>{hasK ? "● key set" : "○ no key"}</span>
              </button>
            );
          })}
        </div>

        <div style={SEC}>API key</div>
        <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", marginBottom: 8, lineHeight: 1.55 }}>
          Grab one from <a href={p.keyDocsUrl} target="_blank" rel="noreferrer" style={{ color: AC }}>{p.keyDocsUrl.replace(/^https?:\/\//, "")}</a> — {p.keyHint}. Stored only in this browser's localStorage; never sent to Nova OS servers.
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setKeys(k => ({ ...k, [provider]: e.target.value }))}
            placeholder={"Paste your " + p.label + " API key"}
            style={{ ...INP, flex: 1, fontFamily: FFM, fontSize: 12 }}
          />
          {apiKey && (
            <button onClick={() => setKeys(k => ({ ...k, [provider]: "" }))} className="dl" style={{
              padding: "7px 12px", background: "rgba(255,80,80,0.08)",
              border: "1px solid rgba(255,80,80,0.3)", borderRadius: 7, cursor: "pointer",
              fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "#ff8b8b",
            }}>Clear</button>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: hasKey ? "#4cef90" : "var(--nv-text-dim)", marginBottom: 20, fontFamily: FFM }}>{hasKey ? "✓ Key saved locally" : "No key yet"}</div>

        <div style={SEC}>Model</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
          {p.presetModels.map(m => (
            <button key={m} onClick={() => setConfig(c => ({ ...c, model: { ...c.model, [provider]: m } }))} style={{
              padding: "6px 11px", borderRadius: 7, cursor: "pointer",
              background: model === m ? fill(AC) : "var(--nv-elevated)",
              border: "1px solid " + (model === m ? bdr(AC) : "var(--nv-border)"),
              fontFamily: FFM, fontWeight: 500, fontSize: 11,
              color: model === m ? AC : "var(--nv-text)",
            }}>{m}</button>
          ))}
        </div>
        <input
          value={model}
          onChange={e => setConfig(c => ({ ...c, model: { ...c.model, [provider]: e.target.value } }))}
          placeholder="Or type any model id…"
          style={{ ...INP, fontFamily: FFM, fontSize: 11.5, marginBottom: 22 }}
        />

        <div style={SEC}>Privacy</div>
        <div style={{ fontSize: 11.5, color: "var(--nv-text)", lineHeight: 1.7, padding: "12px 14px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 9 }}>
          Nova AI runs entirely in your browser — your API key, model choice, and chat history live in <code style={{ fontFamily: FFM, color: "var(--nv-text-strong)" }}>localStorage</code> on this device only.<br/><br/>
          Every API call goes directly from your browser to {AI_PROVIDERS.claude.label}, {AI_PROVIDERS.openai.label}, or {AI_PROVIDERS.gemini.label}. Nova OS and its operator pay nothing for your usage; you pay your provider's normal per-token rates.
        </div>

        <button onClick={onClose} style={{
          marginTop: 20, width: "100%", padding: "11px 14px",
          background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9,
          cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC,
        }}>← Back to chat</button>
      </div>
    </div>
  );
}

// ─────────────── utility: group chats by recency for the sidebar ────────
function groupByRecency(chats) {
  const now = Date.now();
  const oneDay = 24 * 3600 * 1000;
  const buckets = { today: [], yesterday: [], thisWeek: [], earlier: [] };
  for (const c of chats) {
    const age = now - (c.updatedAt || c.createdAt || 0);
    if (age < oneDay)          buckets.today.push(c);
    else if (age < 2 * oneDay) buckets.yesterday.push(c);
    else if (age < 7 * oneDay) buckets.thisWeek.push(c);
    else                       buckets.earlier.push(c);
  }
  const out = [];
  if (buckets.today.length)     out.push({ label: "Today",     chats: buckets.today });
  if (buckets.yesterday.length) out.push({ label: "Yesterday", chats: buckets.yesterday });
  if (buckets.thisWeek.length)  out.push({ label: "This week", chats: buckets.thisWeek });
  if (buckets.earlier.length)   out.push({ label: "Earlier",   chats: buckets.earlier });
  return out;
}

// ── glyph ────────────────────────────────────────────────────────────────
function CogGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

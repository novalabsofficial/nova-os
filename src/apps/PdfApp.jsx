// v9.5 — PDF Viewer rebuilt around a real "documents app" feel (macOS
// Preview / Adobe Reader as references). Two-pane layout: a sidebar
// listing recently-opened PDFs (session-only — blob URLs don't survive a
// reload) + a drag-and-drop empty state, and a main pane that hosts the
// browser's built-in PDF viewer in an iframe.
//
// The actual PDF rendering stays the same — we still hand the file to the
// browser's built-in viewer via a blob: URL — but the chrome around it now
// matches the rest of the v9.5 OS: rail + main, theme tokens, drag-drop,
// proper recents.

import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// ── helpers ─────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

export function PdfApp({ AC, showToast }) {
  // Recently-opened list. Persists for the session only; once the window
  // closes the blob URLs are revoked anyway, so saving them to user data
  // wouldn't help. Each entry: { id, name, size, openedAt, url, file }
  const [recents, setRecents] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const active = recents.find(r => r.id === activeId) || null;

  // Revoke all blob URLs on unmount so the browser drops the file refs.
  // (Per-file revoke happens when the user clicks ✕ on a recent.)
  useEffect(() => () => {
    recents.forEach(r => { try { URL.revokeObjectURL(r.url); } catch {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open a File object: validate, generate blob URL, add to recents, activate.
  const openFile = useCallback((file) => {
    if (!file) return;
    const okType = (file.type === "application/pdf") || (file.name || "").toLowerCase().endsWith(".pdf");
    if (!okType) { showToast?.("Not a PDF file"); return; }
    const id = "pdf-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const url = URL.createObjectURL(file);
    const entry = { id, name: file.name, size: file.size, openedAt: Date.now(), url };
    setRecents(prev => [entry, ...prev.filter(r => r.name !== file.name)].slice(0, 12));
    setActiveId(id);
  }, [showToast]);

  function handleInput(e) {
    const file = e.target.files?.[0];
    openFile(file);
    e.target.value = "";
  }

  // Drag-and-drop on the empty state. Browsers default to navigating to the
  // dropped file URL, so we have to preventDefault on both dragover + drop.
  function onDragOver(e)  { e.preventDefault(); setDragOver(true); }
  function onDragLeave(e) { e.preventDefault(); setDragOver(false); }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    openFile(file);
  }

  function closeActive() {
    if (!active) return;
    try { URL.revokeObjectURL(active.url); } catch {}
    setRecents(prev => prev.filter(r => r.id !== active.id));
    setActiveId(null);
  }
  function removeRecent(id) {
    const r = recents.find(x => x.id === id);
    if (r) try { URL.revokeObjectURL(r.url); } catch {}
    setRecents(prev => prev.filter(x => x.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* ───── SIDEBAR — recents ───── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        background:"var(--nv-elevated)",
        display: "flex", flexDirection: "column", minHeight: 0,
      }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--nv-border)" }}>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={handleInput} style={{ display: "none" }}/>
          <button onClick={() => inputRef.current?.click()} style={{
            width: "100%", padding: "9px 12px", background: fill(AC),
            border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer",
            fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: AC,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <DocPlusGlyph/> Open PDF
          </button>
        </div>

        <div style={{ padding: "12px 10px 6px", fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Recent</div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 8px 12px" }}>
          {recents.length === 0 ? (
            <div style={{ padding: "20px 8px", fontSize: 11, color: "var(--nv-text-dim)", fontStyle: "italic", textAlign: "center", lineHeight: 1.6 }}>
              No documents opened yet
            </div>
          ) : recents.map(r => {
            const isActive = r.id === activeId;
            return (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className="fr"
                style={{
                  display: "flex", alignItems: "flex-start", gap: 9,
                  padding: "9px 10px", marginBottom: 3, borderRadius: 8,
                  background: isActive ? fill(AC) : "transparent",
                  border: "1px solid " + (isActive ? bdr(AC) : "transparent"),
                  cursor: "pointer", textAlign: "left", width: "100%",
                  fontFamily: FF,
                }}
              >
                <span style={{ flexShrink: 0, display: "flex", color: isActive ? AC : "var(--nv-text-dim)", marginTop: 1 }}>
                  <DocGlyph/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 11.5, color: isActive ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ fontFamily: FFM, fontSize: 9.5, color: "var(--nv-text-dim)", marginTop: 2 }}>{formatSize(r.size)} · {timeAgo(r.openedAt)}</div>
                </div>
                <button
                  className="dl"
                  onClick={e => { e.stopPropagation(); removeRecent(r.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.35)", fontSize: 11, padding: "2px 4px", flexShrink: 0 }}
                  title="Close"
                >✕</button>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--nv-border)", fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", lineHeight: 1.5 }}>
          PDFs open in your browser's built-in viewer — page, zoom, search, and print all live in its toolbar.
        </div>
      </div>

      {/* ───── MAIN PANE ───── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {active ? (
          <>
            {/* Toolbar */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active.name}</div>
                <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2 }}>{formatSize(active.size)} · opened {timeAgo(active.openedAt)}</div>
              </div>
              <a
                href={active.url}
                download={active.name}
                style={{
                  padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                  background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
                  color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 11,
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
                }}
                title="Download a copy"
              >⤓ Save</a>
              <button onClick={closeActive} style={{
                padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)",
                color: "#ff8b8b", fontFamily: FFB, fontWeight: 600, fontSize: 11,
              }}>Close</button>
            </div>
            <iframe
              src={active.url}
              title={active.name}
              style={{ flex: 1, width: "100%", border: "none", background: "#1a1d2b", minHeight: 0 }}
            />
          </>
        ) : (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: 36, textAlign: "center", minHeight: 0,
              background: dragOver ? "rgba(99,102,241,0.06)" : "transparent",
              transition: "background 0.2s",
            }}
          >
            <div style={{
              width: "min(100%, 460px)",
              padding: "44px 32px",
              border: "2px dashed " + (dragOver ? AC : "var(--nv-border-strong)"),
              borderRadius: 16,
              background: dragOver ? fill(AC) : "var(--nv-elevated)",
              transition: "all 0.18s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            }}>
              <div style={{ color: dragOver ? AC : "var(--nv-text-dim)", display: "flex" }}>
                <DocBigGlyph/>
              </div>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)" }}>
                {dragOver ? "Drop to open" : "No document open"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", maxWidth: 340, lineHeight: 1.65 }}>
                {dragOver
                  ? "Release the file to view it in the PDF reader."
                  : "Drag a PDF onto this window, or click Open PDF to browse for one. Recently-opened documents stay in the sidebar."}
              </div>
              {!dragOver && (
                <button onClick={() => inputRef.current?.click()} style={{
                  marginTop: 4, padding: "10px 22px", background: fill(AC),
                  border: "1px solid " + bdr(AC), borderRadius: 10, cursor: "pointer",
                  fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC,
                  display: "inline-flex", alignItems: "center", gap: 7,
                }}>
                  <DocPlusGlyph/> Browse files…
                </button>
              )}
              {!dragOver && (
                <div style={{ marginTop: 10, fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)", letterSpacing: 0.4 }}>
                  PDF · Powered by your browser's built-in viewer
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── glyphs ──────────────────────────────────────────────────────────────
const svgBase = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };

function DocGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...svgBase}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
    </svg>
  );
}
function DocBigGlyph() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" {...svgBase} strokeWidth="1.3">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M9 14h6M9 17h4"/>
    </svg>
  );
}
function DocPlusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...svgBase} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6M12 12v6M9 15h6"/>
    </svg>
  );
}

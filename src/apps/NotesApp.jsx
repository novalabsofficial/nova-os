import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { AiAssist } from "../ui/AiAssist.jsx";
import { renderMarkdown, applyMarkdownAction } from "../lib/markdown.jsx";

// v9.2 — Notes rebuilt as a professional three-pane app (Apple Notes /
// Bear / Obsidian as references). Folder rail + note list + editor, all
// sharing the same `data.folders` and `data.notes` storage the File
// Explorer uses — create a folder here and it shows up there too.
//
// State model: a "view" is either { kind: "all" } (every note), or
// { kind: "folder", id } (one folder's notes). Selecting a note loads it
// into the editor; edits live in local state and write back to
// `data.notes` via a 600ms debounce so typing doesn't spam updateData.

export function NotesApp({ data, updateData, showToast, AC, openNovaAi }) {
  const folders = data?.folders || [];
  const notes   = data?.notes   || [];

  // View routing: which set of notes the middle column should show.
  const [view, setView] = useState({ kind: "all" });

  // Which note is open in the editor.
  const [selectedId, setSelectedId] = useState(null);

  // Local editor state (debounced into data.notes).
  const [editTitle, setEditTitle] = useState("");
  const [editBody,  setEditBody]  = useState("");
  const saveTimerRef = useRef(null);
  const lastSelectedRef = useRef(null); // so swapping notes flushes pending saves

  // "New folder" inline form state.
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // v9.5 — Markdown preview mode + body textarea ref so the toolbar
  // can read/restore the user's selection when inserting markdown.
  const [previewMode, setPreviewMode] = useState(false);
  const bodyRef = useRef(null);

  // Derived view: the notes that belong in the middle column right now.
  const viewNotes = (() => {
    if (view.kind === "all") return notes;
    if (view.kind === "folder") return notes.filter(n => (n.folderId || null) === view.id);
    return notes;
  })();
  // Sorted newest first.
  const sortedNotes = [...viewNotes].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // When the selection changes, load that note into the editor and FLUSH any
  // pending debounced write for the previous note (so unfinished edits don't
  // get lost when you click away mid-debounce).
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      // The flushed-out values target the *previous* selection.
      const prevId = lastSelectedRef.current;
      if (prevId !== null && prevId !== selectedId) {
        // Force-write the in-progress edit to that previous note before swapping.
        const prevTitle = editTitle;
        const prevBody  = editBody;
        updateData(p => ({ ...p, notes: (p.notes || []).map(n => n.id === prevId ? { ...n, title: prevTitle, body: prevBody, ts: Date.now() } : n) }));
      }
    }
    lastSelectedRef.current = selectedId;
    if (selectedId == null) { setEditTitle(""); setEditBody(""); return; }
    const n = notes.find(x => x.id === selectedId);
    if (!n) { setSelectedId(null); return; }
    setEditTitle(n.title || "");
    setEditBody(n.body || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Debounced write-back. Skipped when no note is selected.
  useEffect(() => {
    if (selectedId == null) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateData(p => ({ ...p, notes: (p.notes || []).map(n => n.id === selectedId ? { ...n, title: editTitle, body: editBody, ts: Date.now() } : n) }));
      saveTimerRef.current = null;
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editBody]);

  // ── Actions ──────────────────────────────────────────────────────────
  function createNote() {
    const folderId = view.kind === "folder" ? view.id : null;
    const id = Date.now();
    const fresh = { id, title: "", body: "", ts: id, folderId };
    updateData(p => ({ ...p, notes: [fresh, ...(p.notes || [])] }));
    setSelectedId(id);
    showToast("New note");
  }
  function deleteNote(id) {
    if (!window.confirm("Delete this note?")) return;
    updateData(p => ({ ...p, notes: (p.notes || []).filter(n => n.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    showToast("Deleted");
  }
  function moveNoteToFolder(noteId, folderId) {
    updateData(p => ({ ...p, notes: (p.notes || []).map(n => n.id === noteId ? { ...n, folderId } : n) }));
    showToast("Moved");
  }
  function createFolder() {
    const name = newFolderName.trim(); if (!name) return;
    const f = { id: "f" + Date.now(), name, parentId: null, created: Date.now() };
    updateData(p => ({ ...p, folders: [...(p.folders || []), f] }));
    setNewFolderName(""); setShowNewFolder(false);
    setView({ kind: "folder", id: f.id });
    showToast("Folder created ✓");
  }

  // Count helper for the rail.
  const countInFolder = (fid) => notes.filter(n => (n.folderId || null) === fid).length;

  // Selected note (for the editor / AI context).
  const selected = selectedId != null ? notes.find(n => n.id === selectedId) : null;

  // ── Markdown toolbar action ────────────────────────────────────────
  // Pulls the current selection from the textarea, asks the markdown
  // helper to compute the new value + cursor, and writes it back. We do
  // this imperatively (instead of via React state alone) so we can
  // restore the cursor selection in the same paint — otherwise the
  // textarea reverts to caret-at-end after every keystroke.
  function applyAction(action) {
    if (previewMode) setPreviewMode(false);   // editing only makes sense in edit mode
    const ta = bodyRef.current;
    if (!ta) return;
    const { value, selectionStart, selectionEnd } =
      applyMarkdownAction(action, editBody, ta.selectionStart, ta.selectionEnd);
    setEditBody(value);
    // Re-apply selection after React re-renders — defer to next tick.
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  // ── Markdown keyboard shortcuts ────────────────────────────────────
  // Ctrl/Cmd-B / I / K for bold / italic / link. Anything else falls
  // through. Bound to the textarea so it doesn't fight global shortcuts.
  function onBodyKeyDown(e) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "b") { e.preventDefault(); applyAction("bold"); }
    else if (key === "i") { e.preventDefault(); applyAction("italic"); }
    else if (key === "k") { e.preventDefault(); applyAction("link"); }
  }

  // Display title fallback (the editor stays empty-friendly).
  const titleFallback = "Untitled";
  const previewSnippet = (n) => {
    const s = (n.body || "").replace(/\s+/g, " ").trim();
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* ───────── LEFT RAIL — folders ───────── */}
      <div style={{
        width: 196, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        padding: "16px 10px", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 2,
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ padding: "2px 10px 12px", fontFamily: FFB, fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Notes</div>

        {/* "All Notes" entry */}
        <RailButton
          ac={AC}
          active={view.kind === "all"}
          onClick={() => setView({ kind: "all" })}
          icon={<DocsGlyph />}
          label="All Notes"
          badge={notes.length || null}
        />

        <div style={{ padding: "16px 10px 6px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.1, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Folders</span>
          <button onClick={() => setShowNewFolder(v => !v)} title="New folder" style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: 6, background: showNewFolder ? fill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (showNewFolder ? bdr(AC) : "rgba(255,255,255,0.1)"), cursor: "pointer", color: showNewFolder ? AC : "var(--nv-text)", fontSize: 13, fontWeight: 700, lineHeight: 1, padding: 0 }}>+</button>
        </div>
        {showNewFolder && (
          <div style={{ padding: "0 6px 8px", display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }}
              placeholder="Folder name…"
              style={{ ...INP, flex: 1, padding: "5px 8px", fontSize: 11 }}
            />
          </div>
        )}
        {folders.length === 0 && !showNewFolder && (
          <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic" }}>No folders yet</div>
        )}
        {folders.map(f => (
          <RailButton
            key={f.id}
            ac={AC}
            active={view.kind === "folder" && view.id === f.id}
            onClick={() => setView({ kind: "folder", id: f.id })}
            icon={<FolderGlyph />}
            label={f.name}
            badge={countInFolder(f.id) || null}
          />
        ))}
      </div>

      {/* ───────── MIDDLE COLUMN — note list ───────── */}
      <div style={{
        width: 288, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        display: "flex", flexDirection: "column", minHeight: 0,
        background: "rgba(255,255,255,0.012)",
      }}>
        <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {view.kind === "all" ? "All Notes" : (folders.find(f => f.id === view.id)?.name || "Folder")}
            </div>
            <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2 }}>{sortedNotes.length} {sortedNotes.length === 1 ? "note" : "notes"}</div>
          </div>
          <button onClick={createNote} title="New note" style={{ width: 30, height: 30, borderRadius: 8, background: fill(AC), border: "1px solid " + bdr(AC), cursor: "pointer", color: AC, fontFamily: FFB, fontWeight: 700, fontSize: 17, lineHeight: 1, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 6 }}>
          {sortedNotes.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--nv-text-dim)", fontSize: 12, fontStyle: "italic", padding: "40px 16px" }}>
              No notes yet<br />
              <span style={{ fontSize: 10.5 }}>Tap + to create one</span>
            </div>
          ) : sortedNotes.map(n => {
            const isSel = n.id === selectedId;
            return (
              <button key={n.id} onClick={() => setSelectedId(n.id)} className="fr" style={{
                display: "block", textAlign: "left", width: "100%",
                padding: "10px 12px", marginBottom: 3, borderRadius: 8,
                background: isSel ? fill(AC) : "transparent",
                border: "1px solid " + (isSel ? bdr(AC) : "transparent"),
                cursor: "pointer", fontFamily: FF,
                transition: "background 0.12s",
              }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: isSel ? AC : "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.title?.trim() || titleFallback}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", marginTop: 2, fontFamily: FFM }}>
                  {new Date(n.ts || 0).toLocaleDateString()}{n.body ? " · " + previewSnippet(n) : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ───────── RIGHT PANE — editor ───────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {selected ? (
          <>
            {/* Editor toolbar — folder picker, AI assist, delete */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, color: "var(--nv-text-dim)", fontFamily: FFM }}>
                {new Date(selected.ts || 0).toLocaleString()}
                {saveTimerRef.current && <span style={{ marginLeft: 8, fontStyle: "italic", color: "var(--nv-text-dim)" }}>· saving…</span>}
              </div>
              <div style={{ flex: 1 }} />
              {/* Folder picker */}
              <select
                value={selected.folderId || ""}
                onChange={e => moveNoteToFolder(selected.id, e.target.value || null)}
                style={{ ...INP, padding: "5px 8px", fontSize: 11, width: "auto", maxWidth: 160, cursor: "pointer" }}
                title="Move to folder"
              >
                <option value="">📂 No folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
              </select>
              {/* v9.5 — markdown preview toggle */}
              <button
                onClick={() => setPreviewMode(p => !p)}
                title={previewMode ? "Switch to edit" : "Markdown preview"}
                style={{
                  padding: "5px 10px", borderRadius: 7, cursor: "pointer",
                  background: previewMode ? fill(AC) : "var(--nv-elevated)",
                  border: "1px solid " + (previewMode ? bdr(AC) : "var(--nv-border)"),
                  color: previewMode ? AC : "var(--nv-text)",
                  fontFamily: FFB, fontWeight: 600, fontSize: 11,
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}
              >{previewMode ? "✎ Edit" : "👁 Preview"}</button>
              <AiAssist AC={AC} openNovaAi={openNovaAi} actions={[
                { icon: "✍", label: "Improve writing", prompt: "Improve the writing of the following text without changing its meaning. Output ONLY the rewritten text, no commentary:" },
                { icon: "📝", label: "Summarize in 2–3 sentences", prompt: "Summarize the following text in 2–3 concise sentences:" },
                { icon: "➕", label: "Continue writing", prompt: "Continue this text seamlessly from where it leaves off, matching the tone and style. Output only the continuation:" },
                { icon: "💡", label: "Suggest ideas", prompt: "Read the following text and suggest 3–5 specific ideas or directions the author could expand on:" },
              ]} getContext={() => {
                const t = (editTitle || "").trim();
                const b = (editBody  || "").trim();
                if (!t && !b) return "(The user has not written anything yet — say so and ask what they want to write about.)";
                return (t ? "Title: " + t + "\n\n" : "") + (b || "(empty body)");
              }} />
              <button onClick={() => deleteNote(selected.id)} className="dl" title="Delete note" style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 7, cursor: "pointer", color: "#ff8b8b", fontSize: 12, fontFamily: FFB, fontWeight: 600, padding: "5px 10px" }}>Delete</button>
            </div>

            {/* v9.5 — Markdown toolbar. Only shows in edit mode. */}
            {!previewMode && (
              <div style={{
                display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
                padding: "4px 18px", borderBottom: "1px solid var(--nv-border)",
                background: "rgba(255,255,255,0.02)", flexShrink: 0,
              }}>
                <MdBtn label="H1" title="Heading 1"     onClick={() => applyAction("h1")} />
                <MdBtn label="H2" title="Heading 2"     onClick={() => applyAction("h2")} />
                <MdBtn label="H3" title="Heading 3"     onClick={() => applyAction("h3")} />
                <Sep />
                <MdBtn label={<strong>B</strong>}   title="Bold (Ctrl+B)"   onClick={() => applyAction("bold")} />
                <MdBtn label={<em>I</em>}          title="Italic (Ctrl+I)" onClick={() => applyAction("italic")} />
                <MdBtn label={<code style={{fontFamily:FFM, fontSize:11}}>{`<>`}</code>} title="Inline code" onClick={() => applyAction("code")} />
                <Sep />
                <MdBtn label="•"     title="Bullet list"   onClick={() => applyAction("bullet")} />
                <MdBtn label="1."    title="Numbered list" onClick={() => applyAction("numbered")} />
                <MdBtn label="❝"     title="Quote"         onClick={() => applyAction("quote")} />
                <Sep />
                <MdBtn label="🔗"    title="Link (Ctrl+K)" onClick={() => applyAction("link")} />
                <MdBtn label="―"     title="Horizontal rule" onClick={() => applyAction("hr")} />
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", letterSpacing: 0.4 }}>Markdown · Ctrl+B/I/K</span>
              </div>
            )}

            {/* Title input */}
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder={titleFallback}
              style={{
                margin: "18px 24px 0", padding: "0",
                background: "transparent", border: "none", outline: "none",
                fontFamily: FFB, fontWeight: 700, fontSize: 26, color: "var(--nv-text-strong)",
                letterSpacing: 0.3,
              }}
            />

            {/* Body — edit or preview */}
            {previewMode ? (
              <div style={{
                flex: 1, margin: "12px 24px 18px", overflowY: "auto",
                fontFamily: FF, fontSize: 14, lineHeight: 1.65, color: "var(--nv-text)",
                minHeight: 0,
              }}>
                {editBody.trim()
                  ? renderMarkdown(editBody)
                  : <div style={{ color: "var(--nv-text-dim)", fontStyle: "italic" }}>Nothing to preview yet — switch back to Edit to start writing.</div>}
              </div>
            ) : (
              <textarea
                ref={bodyRef}
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                onKeyDown={onBodyKeyDown}
                placeholder="Start writing… (Markdown supported — toolbar above)"
                style={{
                  flex: 1, margin: "12px 24px 18px", padding: "0",
                  background: "transparent", border: "none", outline: "none", resize: "none",
                  fontFamily: FF, fontSize: 14, lineHeight: 1.65, color: "var(--nv-text)",
                  minHeight: 0,
                }}
              />
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ textAlign: "center", maxWidth: 320 }}>
              <div style={{ fontSize: 52, opacity: 0.45, marginBottom: 14 }}>📝</div>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)", marginBottom: 6 }}>No note selected</div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", lineHeight: 1.6, marginBottom: 16 }}>Pick a note on the left, or create a new one. Folders are shared with the File Explorer — make one here and it appears there too.</div>
              <button onClick={createNote} style={{ padding: "9px 18px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, color: AC }}>+ New note</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rail components ────────────────────────────────────────────────────
function RailButton({ ac, active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 8,
      background: active ? fill(ac) : "transparent",
      border: "1px solid " + (active ? bdr(ac) : "transparent"),
      cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
      color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%",
      transition: "background 0.12s, color 0.12s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ flexShrink: 0, display: "flex" }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && <span style={{ fontFamily: FFM, fontSize: 10.5, color: active ? ac : "var(--nv-text-dim)", opacity: 0.85, flexShrink: 0 }}>{badge}</span>}
    </button>
  );
}

function DocsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}
// v9.5 — Toolbar button + separator for the markdown toolbar.
function MdBtn({ label, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      // onMouseDown preventDefault keeps the textarea's selection alive
      // through the click — otherwise the click would steal focus + the
      // selection collapses before we can wrap it.
      onMouseDown={e => e.preventDefault()}
      style={{
        minWidth: 28, height: 26, padding: "0 8px",
        background: "transparent", border: "1px solid transparent",
        borderRadius: 5, cursor: "pointer",
        color: "var(--nv-text)", fontFamily: FF, fontSize: 12, fontWeight: 500,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--nv-hover)"; e.currentTarget.style.borderColor = "var(--nv-border)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
    >{label}</button>
  );
}
function Sep() {
  return <span style={{ width: 1, height: 16, background: "var(--nv-border)", margin: "0 4px" }}/>;
}

function FolderGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

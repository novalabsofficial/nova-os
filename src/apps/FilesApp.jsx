import { useState } from "react";
import { FF, FFB, FFM, INP, SEC, DEFAULT_AC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { APPS, STORE_CATALOG } from "../ui/constants.js";
import { isPubliclyVisible } from "../lib/moderation.js";
import { openExternalUrl } from "../lib/openUrl.js";

// v9.1 — File Explorer rewritten as a Windows-style two-pane layout: a left
// rail of categories (Home / My Files / Documents / Tasks / Pictures /
// Applications) and a scrolling content pane. Same data model as the v8.x
// FilesApp — folders, notes, tasks live on the user doc — but reorganized
// so each kind has its own focused view. New for v9.1: an Applications
// section that lists every installed app as a launchable tile, grouped by
// category, so installed community apps actually have a "proper folder."

// Monochrome line-glyphs for the left rail. currentColor so the active item
// (accent) and inactive items (dim) both render correctly. Matches the
// Settings rail glyphs visually.
function FGlyph({ id, size = 18 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block", flexShrink: 0 } };
  switch (id) {
    case "home":      return (<svg {...p}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>);
    case "myfiles":   return (<svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>);
    case "documents": return (<svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>);
    case "tasks":     return (<svg {...p}><rect x="3" y="5" width="6" height="6" rx="1"/><path d="M5 8l1.5 1.5L9 7M13 7h7M13 12h7M13 17h7"/><rect x="3" y="14" width="6" height="6" rx="1"/></svg>);
    case "pictures":  return (<svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>);
    case "apps":      return (<svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>);
    default: return null;
  }
}

const SECTIONS = [
  { id: "home",      label: "Home" },
  { id: "myfiles",   label: "My Files" },
  { id: "documents", label: "Documents" },
  { id: "tasks",     label: "Tasks" },
  { id: "pictures",  label: "Pictures" },
  { id: "apps",      label: "Applications" },
];

export function FilesApp({ data, updateData, showToast, AC, commApps = [], openApp }) {
  const ac = AC || DEFAULT_AC;
  const [section, setSection] = useState("myfiles");

  // ── shared data ────────────────────────────────────────────────────────
  const folders = data?.folders || [];
  const notes = data?.notes || [];
  const tasks = data?.tasks || [];
  const installedApps = data?.installedApps || [];
  // v9.1: same legacy-id fallback the desktop uses (see NovaOS.jsx).
  const matchesInstalled = (a) => installedApps.includes(a.id) || (a.legacyId && installedApps.includes(a.legacyId));

  // ── My Files state (folder browser) ────────────────────────────────────
  const [curId, setCurId] = useState(null);                   // null = root
  const [preview, setPreview] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [movingItem, setMovingItem] = useState(null);         // {type,id,name,folderId}
  const [editingFolder, setEditingFolder] = useState(null);   // {id,name}

  function buildPath(id) {
    if (!id) return [];
    const path = []; let cur = id;
    while (cur) { const f = folders.find(x => x.id === cur); if (!f) break; path.unshift(f); cur = f.parentId; }
    return path;
  }
  const breadcrumb = buildPath(curId);
  const subFolders = folders.filter(f => f.parentId === curId);
  const curNotes = notes.filter(n => (n.folderId || null) === curId);
  const curTasks = tasks.filter(t => (t.folderId || null) === curId);

  function createFolder() {
    if (!newFolderName.trim()) return;
    const f = { id: "f" + Date.now(), name: newFolderName.trim(), parentId: curId, created: Date.now() };
    updateData(p => ({ ...p, folders: [...(p.folders || []), f] }));
    setNewFolderName(""); setShowNewFolder(false); showToast("Folder created ✓");
  }
  function deleteFolder(fid) {
    function desc(id) { const ch = folders.filter(f => f.parentId === id); return [id, ...ch.flatMap(c => desc(c.id))]; }
    const dead = new Set(desc(fid));
    if (!window.confirm("Delete this folder and move its contents to root?")) return;
    updateData(p => ({
      ...p,
      folders: p.folders.filter(f => !dead.has(f.id)),
      notes: p.notes.map(n => dead.has(n.folderId) ? { ...n, folderId: null } : n),
      tasks: p.tasks.map(t => dead.has(t.folderId) ? { ...t, folderId: null } : t),
    }));
    showToast("Folder deleted");
  }
  function renameFolder(id, name) {
    if (!name.trim()) return;
    updateData(p => ({ ...p, folders: p.folders.map(f => f.id === id ? { ...f, name: name.trim() } : f) }));
    setEditingFolder(null); showToast("Renamed ✓");
  }
  function createNote() {
    if (!newNoteTitle.trim()) return;
    updateData(p => ({ ...p, notes: [{ id: Date.now(), title: newNoteTitle.trim(), body: newNoteBody.trim(), ts: Date.now(), folderId: curId }, ...(p.notes || [])] }));
    setNewNoteTitle(""); setNewNoteBody(""); setShowNewNote(false); showToast("Note created ✓");
  }
  function deleteNote(id) { updateData(p => ({ ...p, notes: p.notes.filter(n => n.id !== id) })); if (preview?.id === id) setPreview(null); showToast("Deleted"); }
  function deleteTask(id) { updateData(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) })); showToast("Deleted"); }
  function toggleTask(id) { updateData(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) })); }
  function moveNote(noteId, fid) { updateData(p => ({ ...p, notes: p.notes.map(n => n.id === noteId ? { ...n, folderId: fid } : n) })); setMovingItem(null); showToast("Moved ✓"); }
  function moveTask(taskId, fid) { updateData(p => ({ ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, folderId: fid } : t) })); setMovingItem(null); showToast("Moved ✓"); }

  // Folder options for the move dropdown (flat list, indented by depth).
  const folderOpts = [{ id: null, label: "🏠 Home (root)" }];
  function addOpt(fid, depth) {
    const f = folders.find(x => x.id === fid); if (!f) return;
    folderOpts.push({ id: fid, label: " ".repeat(depth * 3) + "📁 " + f.name });
    folders.filter(x => x.parentId === fid).forEach(c => addOpt(c.id, depth + 1));
  }
  folders.filter(f => !f.parentId).forEach(f => addOpt(f.id, 1));

  const itemCount = (fid) => folders.filter(x => x.parentId === fid).length + notes.filter(n => n.folderId === fid).length + tasks.filter(t => t.folderId === fid).length;
  const btStyle = (active) => ({ padding: "5px 11px", background: active ? fill(ac) : "rgba(255,255,255,0.06)", border: "1px solid " + (active ? bdr(ac) : "rgba(255,255,255,0.11)"), borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: active ? ac : "rgba(255,255,255,0.6)" });

  // ── Applications view ──────────────────────────────────────────────────
  // Three sources merge into one launchable list:
  //   • Nova OS built-in apps (always installed)
  //   • STORE_CATALOG apps the user has installed
  //   • Community apps from `commApps` the user has installed
  // Each is normalized to a uniform shape {id, icon, label, cat, launch}.
  function launchApp(app) {
    if (!openApp) return;
    if (app.storeApp) {
      if (app.storeApp.newTab) openExternalUrl(app.storeApp.url);
      else openApp("browser");
    } else {
      openApp(app.id);
    }
  }
  const builtIn = APPS.map(a => ({ ...a, cat: "Nova OS" }));
  const catalogInstalled = STORE_CATALOG.filter(a => installedApps.includes(a.id)).map(a => ({ id: a.id, icon: a.icon, label: a.name, cat: a.cat || "Store", desc: a.desc, storeApp: a }));
  const commInstalled = commApps.filter(a => isPubliclyVisible(a) && matchesInstalled(a)).map(a => ({ id: a.id, icon: a.icon, label: a.name, cat: a.cat || "Store", desc: a.desc, storeApp: a }));
  const allLaunchers = [...builtIn, ...catalogInstalled, ...commInstalled];
  // Group by category for the Applications view.
  const byCategory = {};
  allLaunchers.forEach(a => { (byCategory[a.cat] = byCategory[a.cat] || []).push(a); });
  // Stable order: Nova OS first, then alphabetical.
  const catOrder = Object.keys(byCategory).sort((a, b) => a === "Nova OS" ? -1 : b === "Nova OS" ? 1 : a.localeCompare(b));

  // ── Shared styles ──────────────────────────────────────────────────────
  const PANE_TITLE = { fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)", marginBottom: 3, letterSpacing: 0.2 };
  const PANE_SUB = { fontSize: 11.5, color: "var(--nv-text-dim)", marginBottom: 16, lineHeight: 1.5 };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>

      {/* LEFT RAIL */}
      <div style={{
        width: 184, flexShrink: 0, borderRight: "1px solid var(--nv-border)",
        padding: "16px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2,
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ padding: "2px 10px 14px", fontFamily: FFB, fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>This PC</div>
        {SECTIONS.map(s => {
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9,
              background: active ? fill(ac) : "transparent",
              border: "1px solid " + (active ? bdr(ac) : "transparent"),
              cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
              color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%",
              transition: "background 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <FGlyph id={s.id} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* CONTENT PANE */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── HOME ──────────────────────────────────────────────────── */}
        {section === "home" && (<>
          <div style={PANE_TITLE}>Home</div>
          <div style={PANE_SUB}>Quick access to everything in your File Explorer.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
            {[
              { id: "myfiles",   label: "My Files",     desc: folders.length + " folders" },
              { id: "documents", label: "Documents",    desc: notes.length + " notes" },
              { id: "tasks",     label: "Tasks",        desc: tasks.length + " items" },
              { id: "apps",      label: "Applications", desc: allLaunchers.length + " apps" },
            ].map(t => (
              <button key={t.id} onClick={() => setSection(t.id)} className="fr" style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
                padding: "16px 14px", background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--nv-border)", borderRadius: 11, cursor: "pointer",
                fontFamily: FF, color: "var(--nv-text)", transition: "background 0.15s",
              }}>
                <span style={{ color: ac, display: "flex" }}><FGlyph id={t.id} size={22} /></span>
                <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 13, color: "var(--nv-text-strong)" }}>{t.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)" }}>{t.desc}</div>
              </button>
            ))}
          </div>
          {notes.length > 0 && (<>
            <div style={SEC}>Recent Notes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5).map(n => (
                <button key={n.id} onClick={() => { setSection("documents"); setPreview(n); }} className="fr" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: FF }}>
                  <span style={{ fontSize: 14 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                    <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontFamily: FFM }}>{new Date(n.ts).toLocaleDateString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </>)}
        </>)}

        {/* ── MY FILES (folder browser — preserves all v8.x functionality) ── */}
        {section === "myfiles" && (<>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, flexWrap: "wrap", fontFamily: FFB, fontWeight: 700, fontSize: 14 }}>
              <span style={{ cursor: "pointer", color: curId ? ac : "var(--nv-text-strong)" }} onClick={() => setCurId(null)}>My Files</span>
              {breadcrumb.map((f, i) => (
                <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--nv-text-dim)" }}>›</span>
                  <span style={{ cursor: "pointer", color: i === breadcrumb.length - 1 ? "var(--nv-text-strong)" : ac, fontWeight: i === breadcrumb.length - 1 ? 700 : 600 }} onClick={() => setCurId(f.id)}>{f.name}</span>
                </span>
              ))}
            </div>
            <button onClick={() => { setShowNewFolder(v => !v); setShowNewNote(false); }} style={btStyle(showNewFolder)}>📁 New Folder</button>
            <button onClick={() => { setShowNewNote(v => !v); setShowNewFolder(false); }} style={btStyle(showNewNote)}>📄 New Note</button>
          </div>

          {showNewFolder && (
            <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
              <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === "Enter" && createFolder()} placeholder="Folder name…" style={{ ...INP, flex: 1 }} />
              <button onClick={createFolder} style={{ padding: "7px 14px", background: fill(ac), border: "1px solid " + bdr(ac), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: ac }}>Create</button>
              <button onClick={() => setShowNewFolder(false)} style={{ padding: "7px 11px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 7, cursor: "pointer", color: "rgba(255,255,255,0.5)", fontFamily: FFB, fontSize: 12 }}>✕</button>
            </div>
          )}

          {showNewNote && (
            <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, marginBottom: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              <input autoFocus value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && createNote()} placeholder="Note title…" style={INP} />
              <textarea value={newNoteBody} onChange={e => setNewNoteBody(e.target.value)} placeholder="Content… (optional)" style={{ ...INP, minHeight: 55 }} />
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={createNote} style={{ flex: 1, padding: "7px", background: fill(ac), border: "1px solid " + bdr(ac), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: ac }}>Create Note</button>
                <button onClick={() => setShowNewNote(false)} style={{ padding: "7px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 7, cursor: "pointer", color: "rgba(255,255,255,0.5)", fontFamily: FFB, fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          )}

          {movingItem && (
            <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "var(--nv-text)", marginBottom: 7 }}>Move "<b>{movingItem.name}</b>" to:</div>
              <select onChange={e => { const tid = e.target.value === "null" ? null : e.target.value; movingItem.type === "note" ? moveNote(movingItem.id, tid) : moveTask(movingItem.id, tid); }} style={{ ...INP, cursor: "pointer", marginBottom: 8 }} defaultValue={movingItem.folderId || "null"}>
                {folderOpts.map(o => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
              </select>
              <button onClick={() => setMovingItem(null)} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Cancel</button>
            </div>
          )}

          {subFolders.length === 0 && curNotes.length === 0 && curTasks.length === 0 && !showNewFolder && !showNewNote && (
            <div style={{ textAlign: "center", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic", padding: "44px 0" }}>
              {curId ? "This folder is empty" : "No files yet"}<br />
              <span style={{ fontSize: 11 }}>Use the buttons above to create folders or notes</span>
            </div>
          )}

          {subFolders.length > 0 && <div style={SEC}>Folders ({subFolders.length})</div>}
          {subFolders.map(f => (
            <div key={f.id} className="fr" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", marginBottom: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer", transition: "background 0.12s" }}>
              <span style={{ fontSize: 20, pointerEvents: "none" }}>📁</span>
              {editingFolder?.id === f.id ? (
                <input autoFocus value={editingFolder.name} onChange={e => setEditingFolder(x => ({ ...x, name: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") renameFolder(f.id, editingFolder.name); if (e.key === "Escape") setEditingFolder(null); }} onBlur={() => renameFolder(f.id, editingFolder.name)} style={{ ...INP, flex: 1, padding: "3px 8px", fontSize: 13 }} />
              ) : (
                <div style={{ flex: 1 }} onClick={() => setCurId(f.id)} onDoubleClick={() => setCurId(f.id)}>
                  <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)" }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginTop: 1 }}>{itemCount(f.id)} items</div>
                </div>
              )}
              <button onClick={e => { e.stopPropagation(); setEditingFolder({ id: f.id, name: f.name }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 12, padding: "3px 6px" }} title="Rename">✏️</button>
              <button className="dl" onClick={e => { e.stopPropagation(); deleteFolder(f.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.3)", fontSize: 13, padding: "3px 6px", transition: "color 0.12s" }} title="Delete">✕</button>
            </div>
          ))}

          {curNotes.length > 0 && <div style={{ ...SEC, marginTop: subFolders.length > 0 ? 12 : 0 }}>Notes ({curNotes.length})</div>}
          {curNotes.map(n => (
            <div key={n.id}>
              <div className="fr" onClick={() => setPreview(preview?.id === n.id ? null : n)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", marginBottom: 3, background: preview?.id === n.id ? "rgba(79,158,255,0.1)" : "rgba(255,255,255,0.03)", border: "1px solid " + (preview?.id === n.id ? "rgba(79,158,255,0.35)" : "rgba(255,255,255,0.07)"), borderRadius: 7, cursor: "pointer", transition: "background 0.12s" }}>
                <span style={{ fontSize: 14 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                  <div style={{ fontSize: 9, color: "var(--nv-text-dim)", fontFamily: FFM }}>{new Date(n.ts).toLocaleDateString()}{n.body ? " · " + n.body.slice(0, 28) + "…" : ""}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setMovingItem({ type: "note", id: n.id, name: n.title, folderId: n.folderId || null }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 11, padding: "3px 5px" }} title="Move to folder">↪</button>
                <button className="dl" onClick={e => { e.stopPropagation(); deleteNote(n.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.28)", fontSize: 12, padding: "3px 5px", transition: "color 0.12s" }}>✕</button>
              </div>
              {preview?.id === n.id && (
                <div style={{ marginBottom: 6, padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", marginBottom: 5 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--nv-text)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.body || "(no content)"}</div>
                </div>
              )}
            </div>
          ))}

          {curTasks.length > 0 && <div style={{ ...SEC, marginTop: curNotes.length > 0 || subFolders.length > 0 ? 12 : 0 }}>Tasks ({curTasks.length})</div>}
          {curTasks.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", marginBottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, opacity: t.done ? 0.45 : 1 }}>
              <div onClick={() => toggleTask(t.id)} style={{ width: 17, height: 17, borderRadius: 5, border: "1.5px solid " + (t.done ? ac : "rgba(255,255,255,0.22)"), background: t.done ? ac : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {t.done && <span style={{ color: "#000", fontSize: 9, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ flex: 1, fontFamily: FF, fontSize: 12, color: "var(--nv-text-strong)", textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
              <button onClick={() => setMovingItem({ type: "task", id: t.id, name: t.text, folderId: t.folderId || null })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 11, padding: "3px 5px" }} title="Move">↪</button>
              <button className="dl" onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.28)", fontSize: 12, padding: "3px 5px", transition: "color 0.12s" }}>✕</button>
            </div>
          ))}
        </>)}

        {/* ── DOCUMENTS (flat notes, newest first) ────────────────────── */}
        {section === "documents" && (<>
          <div style={PANE_TITLE}>Documents</div>
          <div style={PANE_SUB}>Every note you've created, newest first. Use My Files to organize them into folders.</div>
          {notes.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic", padding: "60px 0" }}>
              No notes yet<br />
              <span style={{ fontSize: 11 }}>Create one in My Files</span>
            </div>
          ) : [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(n => (
            <div key={n.id}>
              <div className="fr" onClick={() => setPreview(preview?.id === n.id ? null : n)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4, background: preview?.id === n.id ? "rgba(79,158,255,0.1)" : "rgba(255,255,255,0.03)", border: "1px solid " + (preview?.id === n.id ? "rgba(79,158,255,0.35)" : "rgba(255,255,255,0.07)"), borderRadius: 8, cursor: "pointer", transition: "background 0.12s" }}>
                <span style={{ fontSize: 15 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                  <div style={{ fontSize: 10, color: "var(--nv-text-dim)", fontFamily: FFM }}>{new Date(n.ts).toLocaleString()}{n.body ? " · " + n.body.slice(0, 50) + (n.body.length > 50 ? "…" : "") : ""}</div>
                </div>
                <button className="dl" onClick={e => { e.stopPropagation(); deleteNote(n.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.3)", fontSize: 12, padding: "3px 6px" }}>✕</button>
              </div>
              {preview?.id === n.id && (
                <div style={{ marginBottom: 8, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", marginBottom: 6 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--nv-text)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.body || "(no content)"}</div>
                </div>
              )}
            </div>
          ))}
        </>)}

        {/* ── TASKS (flat) ────────────────────────────────────────────── */}
        {section === "tasks" && (<>
          <div style={PANE_TITLE}>Tasks</div>
          <div style={PANE_SUB}>All your to-do items, across every folder. Open the Tasks app to add more.</div>
          {tasks.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic", padding: "60px 0" }}>
              No tasks yet<br />
              <span style={{ fontSize: 11 }}>Open the Tasks app to add some</span>
            </div>
          ) : tasks.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", marginBottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, opacity: t.done ? 0.45 : 1 }}>
              <div onClick={() => toggleTask(t.id)} style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px solid " + (t.done ? ac : "rgba(255,255,255,0.22)"), background: t.done ? ac : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {t.done && <span style={{ color: "#000", fontSize: 9, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ flex: 1, fontFamily: FF, fontSize: 12.5, color: "var(--nv-text-strong)", textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
              <button className="dl" onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.3)", fontSize: 12, padding: "3px 6px" }}>✕</button>
            </div>
          ))}
        </>)}

        {/* ── PICTURES (stub — open Photos app) ───────────────────────── */}
        {section === "pictures" && (<>
          <div style={PANE_TITLE}>Pictures</div>
          <div style={PANE_SUB}>Browse your photos in the dedicated Photos app.</div>
          <div style={{ textAlign: "center", padding: "50px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--nv-border)", borderRadius: 12 }}>
            <div style={{ fontSize: 42, opacity: 0.45, marginBottom: 12 }}>🖼️</div>
            <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 14, color: "var(--nv-text-strong)", marginBottom: 6 }}>Open in Photos</div>
            <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", lineHeight: 1.6, maxWidth: 280, margin: "0 auto 14px" }}>Photos live in the Photos app for now. Open it to view, set a wallpaper, or save screenshots.</div>
            <button onClick={() => openApp && openApp("photos")} style={{ padding: "9px 18px", background: fill(ac), border: "1px solid " + bdr(ac), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: ac }}>Open Photos</button>
          </div>
        </>)}

        {/* ── APPLICATIONS (the new v9.1 part) ────────────────────────── */}
        {section === "apps" && (<>
          <div style={PANE_TITLE}>Applications</div>
          <div style={PANE_SUB}>Every app installed on this account. Double-click a tile to launch it. Manage installs in the Store.</div>
          {catOrder.map(cat => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={SEC}>{cat} <span style={{ color: "var(--nv-text-dim)", fontWeight: 500 }}>({byCategory[cat].length})</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                {byCategory[cat].map(a => (
                  <button key={a.id} onClick={() => launchApp(a)} onDoubleClick={() => launchApp(a)} className="fr" title={a.label + (a.desc ? " — " + a.desc : "")} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                    padding: "14px 8px", background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--nv-border)", borderRadius: 11, cursor: "pointer",
                    fontFamily: FF, color: "var(--nv-text-strong)", transition: "background 0.15s",
                  }}>
                    <span style={{ fontSize: 30, lineHeight: 1 }}>{a.icon || "🚀"}</span>
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 11.5, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{a.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>)}

      </div>
    </div>
  );
}

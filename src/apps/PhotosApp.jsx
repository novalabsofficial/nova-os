// v9.7 — Photos rebuilt into a real photo app (Windows 11 Photos / Apple
// Photos as references). Two-pane layout: sidebar (Library / Recently
// Added / Albums) + a grid, a full-screen viewer, and — the headline
// addition — a canvas-based **editor** (crop, rotate, flip, adjustments,
// filter presets, auto-enhance), saving edits as a new copy.
//
// Storage model unchanged: photos live as blob/data URLs for the session
// in the shared photoStore (so screenshots + uploads + edited copies all
// share one gallery). Albums are session-only groupings in the same store.

import { useState, useEffect, useRef, useMemo } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";
import {
  getStorePhotos, subscribeStorePhotos, addStorePhoto, removeStorePhoto, updateStorePhoto,
  getAlbums, subscribeAlbums, createAlbum, renameAlbum, deleteAlbum, setPhotoAlbum,
} from "../lib/photoStore.js";
import { startDrag, moveDrag } from "../lib/dragStore.js";

const MAX_PHOTO_SIZE = 20 * 1024 * 1024;  // 20 MB soft cap

export function PhotosApp({ AC, showToast, onSetWallpaper }) {
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [view, setView]     = useState({ kind: "library" }); // library | recent | album(id)
  const [viewerIdx, setViewerIdx] = useState(-1);
  const [slideshow, setSlideshow] = useState(false);
  const [editing, setEditing] = useState(null);    // photo object being edited
  const [newAlbum, setNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const inputRef = useRef(null);
  const slideshowRef = useRef(null);

  // Mirror the shared stores.
  useEffect(() => { setPhotos(getStorePhotos()); return subscribeStorePhotos(setPhotos); }, []);
  useEffect(() => { setAlbums(getAlbums()); return subscribeAlbums(setAlbums); }, []);

  // The photo set for the active view.
  const visible = useMemo(() => {
    if (view.kind === "recent") return [...photos].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 30);
    if (view.kind === "album")  return photos.filter(p => p.albumId === view.id);
    return photos;
  }, [photos, view]);

  // ── cross-app drag (set wallpaper / avatar) ──────────────────────────
  const draggedRef = useRef(false);
  function beginPhotoDrag(e, photo) {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let started = false;
    function mv(ev) {
      if (!started && (Math.abs(ev.clientX - start.x) > 8 || Math.abs(ev.clientY - start.y) > 8)) {
        started = true; draggedRef.current = true;
        startDrag({ type: "photo", url: photo.url, name: photo.name, x: ev.clientX, y: ev.clientY });
      }
      if (started) moveDrag(ev.clientX, ev.clientY);
    }
    function up() {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      if (started) setTimeout(() => { draggedRef.current = false; }, 60);
    }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  // ── slideshow ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slideshow || viewerIdx < 0 || visible.length === 0) return;
    slideshowRef.current = setInterval(() => setViewerIdx(i => (i + 1) % visible.length), 4000);
    return () => clearInterval(slideshowRef.current);
  }, [slideshow, viewerIdx, visible.length]);

  // ── viewer keyboard nav ───────────────────────────────────────────────
  useEffect(() => {
    if (viewerIdx < 0 || editing) return;
    function onKey(e) {
      if (e.key === "ArrowLeft")  { e.preventDefault(); setViewerIdx(i => i <= 0 ? visible.length - 1 : i - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); setViewerIdx(i => (i + 1) % visible.length); }
      if (e.key === "Escape")     { e.preventDefault(); closeViewer(); }
      if (e.key === " ")          { e.preventDefault(); setSlideshow(s => !s); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIdx, visible.length, editing]); // eslint-disable-line

  // ── import ──────────────────────────────────────────────────────────
  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const imgs = files.filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(f.name));
    if (imgs.length === 0) { showToast?.("No images selected"); return; }
    const tooBig = imgs.filter(f => f.size > MAX_PHOTO_SIZE);
    if (tooBig.length) showToast?.("Skipped " + tooBig.length + " over 20 MB");
    const usable = imgs.filter(f => f.size <= MAX_PHOTO_SIZE);
    const albumId = view.kind === "album" ? view.id : null;   // import straight into the open album
    const next = usable.map(f => ({
      id: "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: f.name, url: URL.createObjectURL(f), size: f.size, w: null, h: null,
      addedAt: Date.now(), albumId,
    }));
    next.forEach(addStorePhoto);
    next.forEach(p => { const img = new Image(); img.onload = () => updateStorePhoto(p.id, { w: img.width, h: img.height }); img.src = p.url; });
    playSound("success");
    showToast?.("Added " + usable.length + " photo" + (usable.length === 1 ? "" : "s") + " ✓");
    e.target.value = "";
  }

  function removePhoto(photo) {
    if (!photo) return;
    const removed = removeStorePhoto(photo.id);
    if (removed?.url?.startsWith("blob:")) URL.revokeObjectURL(removed.url);
  }
  function removeByViewerIdx(idx) {
    const target = visible[idx];
    if (!target) return;
    removePhoto(target);
    if (visible.length <= 1) closeViewer();
    else setViewerIdx(i => Math.min(i, visible.length - 2));
  }

  // ── set as wallpaper ──────────────────────────────────────────────────
  function setAsWallpaper(photo) {
    if (!onSetWallpaper || !photo) return;
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 900;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        onSetWallpaper(c.toDataURL("image/jpeg", 0.72));
        closeViewer();
      } catch { showToast?.("Couldn't set wallpaper"); }
    };
    img.onerror = () => showToast?.("Couldn't load photo");
    img.src = photo.url;
  }

  // ── editor save: a new copy in the same album ─────────────────────────
  function saveEditedCopy(dataUrl, baseName, albumId) {
    const id = "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const name = baseName.replace(/\.(\w+)$/, "") + " (edited).jpg";
    const photo = { id, name, url: dataUrl, size: Math.round(dataUrl.length * 0.75), w: null, h: null, addedAt: Date.now(), albumId: albumId || null };
    addStorePhoto(photo);
    const img = new Image(); img.onload = () => updateStorePhoto(id, { w: img.width, h: img.height }); img.src = dataUrl;
    playSound("success");
    showToast?.("Saved edited copy ✓");
    setEditing(null);
  }

  function closeViewer() { setViewerIdx(-1); setSlideshow(false); }
  function doCreateAlbum() {
    const n = newAlbumName.trim(); if (!n) return;
    const a = createAlbum(n);
    setNewAlbum(false); setNewAlbumName("");
    setView({ kind: "album", id: a.id });
    showToast?.("Album created ✓");
  }
  function doDeleteAlbum(id) {
    if (!window.confirm("Delete this album? The photos stay in your library.")) return;
    deleteAlbum(id);
    if (view.kind === "album" && view.id === id) setView({ kind: "library" });
  }

  const current = viewerIdx >= 0 ? visible[viewerIdx] : null;
  const viewTitle = view.kind === "recent" ? "Recently Added"
    : view.kind === "album" ? (albums.find(a => a.id === view.id)?.name || "Album")
    : "Library";

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: FF }}>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }}/>

      {/* ───── SIDEBAR ───── */}
      <div style={{ width: 196, flexShrink: 0, borderRight: "1px solid var(--nv-border)", padding: "16px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, background: "rgba(255,255,255,0.02)" }}>
        <div style={{ padding: "2px 10px 12px", fontFamily: FFB, fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Photos</div>
        <RailButton ac={AC} active={view.kind === "library"} onClick={() => setView({ kind: "library" })} icon={<LibGlyph />} label="Library" badge={photos.length || null} />
        <RailButton ac={AC} active={view.kind === "recent"}  onClick={() => setView({ kind: "recent" })}  icon={<RecentGlyph />} label="Recently Added" />

        <div style={{ padding: "16px 10px 6px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.1, color: "var(--nv-text-dim)", textTransform: "uppercase" }}>Albums</span>
          <button onClick={() => setNewAlbum(v => !v)} title="New album" style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: 6, background: newAlbum ? fill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (newAlbum ? bdr(AC) : "rgba(255,255,255,0.1)"), cursor: "pointer", color: newAlbum ? AC : "var(--nv-text)", fontSize: 13, fontWeight: 700, lineHeight: 1, padding: 0 }}>+</button>
        </div>
        {newAlbum && (
          <div style={{ padding: "0 6px 8px" }}>
            <input autoFocus value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doCreateAlbum(); if (e.key === "Escape") setNewAlbum(false); }} placeholder="Album name…" style={{ ...INP, padding: "5px 8px", fontSize: 11 }}/>
          </div>
        )}
        {albums.length === 0 && !newAlbum && <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic" }}>No albums yet</div>}
        {albums.map(a => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", position: "relative" }}
            onMouseEnter={e => { const x = e.currentTarget.querySelector('.al-del'); if (x) x.style.opacity = '1'; }}
            onMouseLeave={e => { const x = e.currentTarget.querySelector('.al-del'); if (x) x.style.opacity = '0'; }}>
            <RailButton ac={AC} active={view.kind === "album" && view.id === a.id} onClick={() => setView({ kind: "album", id: a.id })} icon={<AlbumGlyph />} label={a.name} badge={photos.filter(p => p.albumId === a.id).length || null} />
            <button className="al-del dl" onClick={e => { e.stopPropagation(); doDeleteAlbum(a.id); }} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "rgba(11,13,28,0.85)", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.55)", fontSize: 11, padding: "3px 6px", borderRadius: 5, opacity: 0, transition: "opacity 0.12s" }} title="Delete album">✕</button>
          </div>
        ))}
      </div>

      {/* ───── MAIN ───── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "16px 22px 12px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)" }}>{viewTitle}</div>
            <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", marginTop: 2 }}>{visible.length} {visible.length === 1 ? "photo" : "photos"} · session only</div>
          </div>
          {visible.length > 0 && (
            <button onClick={() => { if (visible.length) { setViewerIdx(0); setSlideshow(true); } }} style={{ padding: "7px 12px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, color: "var(--nv-text)" }}>▶ Slideshow</button>
          )}
          <button onClick={() => inputRef.current?.click()} style={{ padding: "8px 14px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC }}>+ Add photos</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "14px 18px 18px" }}>
          {visible.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center", color: "var(--nv-text-dim)", height: "100%" }}>
              <div style={{ fontSize: 56, opacity: 0.5, marginBottom: 14, filter: "drop-shadow(0 0 24px " + fill(AC) + ")" }}>🖼️</div>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)", marginBottom: 6 }}>
                {view.kind === "album" ? "This album is empty" : "Your gallery is empty"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", maxWidth: 320, lineHeight: 1.6, marginBottom: 16 }}>
                {view.kind === "album" ? "Add photos while this album is open, or move existing photos into it from the viewer." : "Add images from your device — JPG, PNG, WebP, HEIC and more. They stay on your device."}
              </div>
              <button onClick={() => inputRef.current?.click()} style={{ padding: "10px 20px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC }}>+ Add photos</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 6 }}>
              {visible.map((p, idx) => (
                <div key={p.id}
                  onPointerDown={e => beginPhotoDrag(e, p)}
                  onClick={() => { if (draggedRef.current) return; setViewerIdx(idx); setSlideshow(false); }}
                  title="Click to open · drag onto the desktop or profile"
                  style={{ position: "relative", aspectRatio: "1/1", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, overflow: "hidden", cursor: "pointer", transition: "transform 0.18s, border-color 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                  <img src={p.url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); setEditing(p); }} title="Edit" style={thumbBtn()}>✎</button>
                    <button className="dl" onClick={e => { e.stopPropagation(); removePhoto(p); }} title="Remove" style={thumbBtn()}>✕</button>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 8px 4px", background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.7))", fontFamily: FFM, fontSize: 9, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───── viewer overlay ───── */}
      {current && !editing && (
        <div onClick={closeViewer} style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(40px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "menu-up 0.2s cubic-bezier(0.16,1,0.3,1)" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "92vw", maxHeight: "82vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={current.url} alt={current.name} style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 30px 80px rgba(0,0,0,0.65)" }}/>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11, padding: "8px 14px", fontFamily: FF, color: "rgba(255,255,255,0.88)", flexWrap: "wrap", maxWidth: "94vw", justifyContent: "center" }}>
            <span style={{ fontFamily: FFM, fontSize: 12, color: "rgba(255,255,255,0.78)" }}>{viewerIdx + 1} / {visible.length}</span>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }}/>
            <button onClick={() => setEditing(current)} style={viewerBtn(AC, true)}>✎ Edit</button>
            <button onClick={() => setSlideshow(s => !s)} style={viewerBtn(AC, slideshow)}>{slideshow ? "⏸ Slideshow" : "▶ Slideshow"}</button>
            {/* Album assignment */}
            {albums.length > 0 && (
              <select value={current.albumId || ""} onChange={e => setPhotoAlbum(current.id, e.target.value || null)} title="Add to album" style={{ ...INP, padding: "4px 8px", fontSize: 11, width: "auto", cursor: "pointer" }}>
                <option value="">No album</option>
                {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            {onSetWallpaper && <button onClick={() => setAsWallpaper(current)} style={viewerBtn(AC, false)}>🖼 Wallpaper</button>}
            <button onClick={() => removeByViewerIdx(viewerIdx)} style={{ ...viewerBtn(AC, false), border: "1px solid rgba(255,80,80,0.3)", color: "rgba(255,130,130,0.9)" }}>✕ Remove</button>
            <button onClick={closeViewer} style={{ width: 26, height: 26, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, cursor: "pointer", color: "rgba(255,255,255,0.78)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
          </div>
          {visible.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setViewerIdx(i => i <= 0 ? visible.length - 1 : i - 1); }} style={{ position: "fixed", left: 18, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,255,255,0.88)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setViewerIdx(i => (i + 1) % visible.length); }} style={{ position: "fixed", right: 18, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,255,255,0.88)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>›</button>
            </>
          )}
        </div>
      )}

      {/* ───── editor overlay ───── */}
      {editing && (
        <PhotoEditor
          photo={editing}
          AC={AC}
          onClose={() => setEditing(null)}
          onSave={(dataUrl) => saveEditedCopy(dataUrl, editing.name, editing.albumId)}
        />
      )}
    </div>
  );
}

// ───────────────────────── Photo editor ─────────────────────────────────

const FILTER_PRESETS = [
  { id: "none",  label: "Original", f: {} },
  { id: "vivid", label: "Vivid",    f: { saturate: 150, contrast: 110 } },
  { id: "mono",  label: "Mono",     f: { grayscale: 100, contrast: 105 } },
  { id: "noir",  label: "Noir",     f: { grayscale: 100, contrast: 140, brightness: 95 } },
  { id: "sepia", label: "Sepia",    f: { sepia: 80, contrast: 105, brightness: 105 } },
  { id: "fade",  label: "Fade",     f: { saturate: 80, contrast: 88, brightness: 110 } },
  { id: "cool",  label: "Cool",     f: { saturate: 110, hue: 200 } },
  { id: "warm",  label: "Warm",     f: { sepia: 30, saturate: 115, brightness: 103 } },
];
const ASPECTS = [
  { id: "free", label: "Free",  ratio: null },
  { id: "1:1",  label: "1:1",   ratio: 1 },
  { id: "4:3",  label: "4:3",   ratio: 4 / 3 },
  { id: "3:2",  label: "3:2",   ratio: 3 / 2 },
  { id: "16:9", label: "16:9",  ratio: 16 / 9 },
];

// Compose a CSS/canvas filter string from adjustment sliders + a preset.
function buildFilter(adj, preset) {
  const pf = preset?.f || {};
  const brightness = (adj.brightness ?? 0) + (pf.brightness ?? 100);
  const contrast   = (adj.contrast ?? 0) + (pf.contrast ?? 100);
  const saturate   = (adj.saturate ?? 0) + (pf.saturate ?? 100);
  // "Warmth" is faked with a sepia overlay + slight saturation.
  const warmth     = adj.warmth ?? 0;
  const parts = [
    `brightness(${Math.max(0, brightness)}%)`,
    `contrast(${Math.max(0, contrast)}%)`,
    `saturate(${Math.max(0, saturate + Math.abs(warmth) * 0.2)}%)`,
  ];
  if (pf.grayscale) parts.push(`grayscale(${pf.grayscale}%)`);
  const sepia = (pf.sepia || 0) + (warmth > 0 ? warmth * 0.5 : 0);
  if (sepia) parts.push(`sepia(${Math.min(100, sepia)}%)`);
  if (pf.hue || warmth < 0) parts.push(`hue-rotate(${(pf.hue || 0) + (warmth < 0 ? warmth * 0.6 : 0)}deg)`);
  return parts.join(" ");
}

function PhotoEditor({ photo, AC, onClose, onSave }) {
  const [img, setImg] = useState(null);        // loaded HTMLImageElement
  const [tab, setTab] = useState("adjust");     // adjust | filters | crop
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0, saturate: 0, warmth: 0 });
  const [preset, setPreset] = useState(FILTER_PRESETS[0]);
  const [rotation, setRotation] = useState(0);  // 0/90/180/270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState(ASPECTS[0]);
  // Crop rect in fractions (0..1) of the oriented image. null = full frame.
  const [crop, setCrop] = useState(null);
  const previewWrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // Load the source image once.
  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = photo.url;
  }, [photo.url]);

  // Oriented dimensions (after rotation swaps w/h on 90/270).
  const oriented = useMemo(() => {
    if (!img) return { w: 0, h: 0 };
    return (rotation % 180 === 0) ? { w: img.width, h: img.height } : { w: img.height, h: img.width };
  }, [img, rotation]);

  // Render the preview canvas whenever inputs change.
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !img) return;
    const ctx = cv.getContext("2d");
    cv.width = oriented.w; cv.height = oriented.h;
    ctx.save();
    ctx.filter = buildFilter(adj, preset);
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }, [img, adj, preset, rotation, flipH, flipV, oriented.w, oriented.h]);

  // When the aspect changes, seed a centered crop rect at that ratio.
  useEffect(() => {
    if (!aspect.ratio) { setCrop(null); return; }
    const fw = oriented.w, fh = oriented.h;
    if (!fw || !fh) return;
    let cw = fw, ch = fw / aspect.ratio;
    if (ch > fh) { ch = fh; cw = fh * aspect.ratio; }
    setCrop({ x: (fw - cw) / 2 / fw, y: (fh - ch) / 2 / fh, w: cw / fw, h: ch / fh });
  }, [aspect, oriented.w, oriented.h]);

  // ── crop drag (move + corner resize) in display space ────────────────
  function startCropDrag(e, mode) {
    if (!crop || !previewWrapRef.current) return;
    e.preventDefault(); e.stopPropagation();
    const rect = previewWrapRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, crop: { ...crop } };
    function mv(ev) {
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      let { x, y, w, h } = start.crop;
      if (mode === "move") {
        x = Math.min(Math.max(0, x + dx), 1 - w);
        y = Math.min(Math.max(0, y + dy), 1 - h);
      } else {
        // corner resize: mode is "nw"/"ne"/"sw"/"se"
        if (mode.includes("e")) w = Math.min(Math.max(0.08, start.crop.w + dx), 1 - x);
        if (mode.includes("s")) h = Math.min(Math.max(0.08, start.crop.h + dy), 1 - y);
        if (mode.includes("w")) { const nx = Math.min(Math.max(0, start.crop.x + dx), start.crop.x + start.crop.w - 0.08); w = start.crop.x + start.crop.w - nx; x = nx; }
        if (mode.includes("n")) { const ny = Math.min(Math.max(0, start.crop.y + dy), start.crop.y + start.crop.h - 0.08); h = start.crop.y + start.crop.h - ny; y = ny; }
        // keep aspect if locked
        if (aspect.ratio) {
          const targetH = (w * oriented.w) / aspect.ratio / oriented.h;
          h = Math.min(targetH, 1 - y);
        }
      }
      setCrop({ x, y, w, h });
    }
    function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  function reset() {
    setAdj({ brightness: 0, contrast: 0, saturate: 0, warmth: 0 });
    setPreset(FILTER_PRESETS[0]); setRotation(0); setFlipH(false); setFlipV(false);
    setAspect(ASPECTS[0]); setCrop(null);
  }
  function autoEnhance() {
    setAdj({ brightness: 6, contrast: 12, saturate: 14, warmth: 4 });
    setPreset(FILTER_PRESETS[0]);
  }

  function doSave() {
    const src = canvasRef.current; if (!src) return;
    setBusy(true);
    try {
      const cw = src.width, ch = src.height;
      const cr = crop || { x: 0, y: 0, w: 1, h: 1 };
      const sx = Math.round(cr.x * cw), sy = Math.round(cr.y * ch);
      const sw = Math.round(cr.w * cw), sh = Math.round(cr.h * ch);
      const out = document.createElement("canvas");
      out.width = Math.max(1, sw); out.height = Math.max(1, sh);
      out.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
      // Cap exported dimension at 2000px on the long edge to keep doc sizes sane.
      const MAX = 2000;
      let final = out;
      const longEdge = Math.max(out.width, out.height);
      if (longEdge > MAX) {
        const r = MAX / longEdge;
        const scaled = document.createElement("canvas");
        scaled.width = Math.round(out.width * r); scaled.height = Math.round(out.height * r);
        scaled.getContext("2d").drawImage(out, 0, 0, scaled.width, scaled.height);
        final = scaled;
      }
      onSave(final.toDataURL("image/jpeg", 0.9));
    } catch {
      setBusy(false);
    }
  }

  const SLIDERS = [
    { key: "brightness", label: "Brightness" },
    { key: "contrast",   label: "Contrast" },
    { key: "saturate",   label: "Saturation" },
    { key: "warmth",     label: "Warmth" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(30px)", display: "flex", flexDirection: "column", fontFamily: FF, animation: "ss-fade 0.18s" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff" }}>✎ Edit Photo</div>
        <div style={{ fontFamily: FFM, fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{photo.name}</div>
        <button onClick={reset} style={editTopBtn(false)}>↺ Reset</button>
        <button onClick={autoEnhance} style={editTopBtn(false)}>✨ Auto</button>
        <button onClick={onClose} style={editTopBtn(false)}>Cancel</button>
        <button onClick={doSave} disabled={busy || !img} style={{ ...editTopBtn(true, AC), opacity: busy || !img ? 0.5 : 1 }}>{busy ? "Saving…" : "Save copy"}</button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Preview */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
          <div ref={previewWrapRef} style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", display: "inline-block", lineHeight: 0 }}>
            <canvas ref={canvasRef} style={{ maxWidth: "min(60vw, 800px)", maxHeight: "72vh", objectFit: "contain", borderRadius: 6, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "block" }}/>
            {/* Crop overlay */}
            {tab === "crop" && crop && (
              <>
                <div style={{ position: "absolute", inset: 0, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${crop.y * 100}%, 0 ${crop.y * 100}%)`, pointerEvents: "none" }}/>
                <div
                  onPointerDown={e => startCropDrag(e, "move")}
                  style={{ position: "absolute", left: crop.x * 100 + "%", top: crop.y * 100 + "%", width: crop.w * 100 + "%", height: crop.h * 100 + "%", border: "1.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", cursor: "move" }}>
                  {["nw", "ne", "sw", "se"].map(c => (
                    <div key={c} onPointerDown={e => startCropDrag(e, c)} style={{
                      position: "absolute", width: 14, height: 14, background: "#fff", borderRadius: 3, border: "1px solid rgba(0,0,0,0.4)",
                      cursor: c + "-resize",
                      left: c.includes("w") ? -7 : undefined, right: c.includes("e") ? -7 : undefined,
                      top: c.includes("n") ? -7 : undefined, bottom: c.includes("s") ? -7 : undefined,
                    }}/>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", minHeight: 0, background: "rgba(255,255,255,0.02)" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, padding: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {[{ id: "adjust", label: "Adjust" }, { id: "filters", label: "Filters" }, { id: "crop", label: "Crop" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, cursor: "pointer", background: tab === t.id ? fill(AC) : "transparent", border: "1px solid " + (tab === t.id ? bdr(AC) : "transparent"), color: tab === t.id ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 12 }}>{t.label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", minHeight: 0 }}>
            {tab === "adjust" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {SLIDERS.map(s => (
                  <div key={s.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 11.5, color: "var(--nv-text)" }}>{s.label}</span>
                      <span style={{ fontFamily: FFM, fontSize: 10.5, color: "var(--nv-text-dim)" }}>{adj[s.key] > 0 ? "+" : ""}{adj[s.key]}</span>
                    </div>
                    <input type="range" min={-50} max={50} value={adj[s.key]} onChange={e => setAdj(a => ({ ...a, [s.key]: +e.target.value }))} style={{ width: "100%", accentColor: AC }}/>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={() => setRotation(r => (r + 270) % 360)} style={editCtlBtn()}>↶ Rotate</button>
                  <button onClick={() => setRotation(r => (r + 90) % 360)} style={editCtlBtn()}>↷ Rotate</button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setFlipH(v => !v)} style={editCtlBtn(flipH, AC)}>⇋ Flip H</button>
                  <button onClick={() => setFlipV(v => !v)} style={editCtlBtn(flipV, AC)}>⇅ Flip V</button>
                </div>
              </div>
            )}

            {tab === "filters" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {FILTER_PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPreset(p)} style={{
                    padding: "10px 6px", borderRadius: 9, cursor: "pointer",
                    background: preset.id === p.id ? fill(AC) : "var(--nv-elevated)",
                    border: "1px solid " + (preset.id === p.id ? bdr(AC) : "var(--nv-border)"),
                    color: preset.id === p.id ? AC : "var(--nv-text)",
                    fontFamily: FFB, fontWeight: 600, fontSize: 11.5,
                  }}>{p.label}</button>
                ))}
              </div>
            )}

            {tab === "crop" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontFamily: FFB, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 0.5 }}>Aspect ratio</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {ASPECTS.map(a => (
                    <button key={a.id} onClick={() => setAspect(a)} style={{ padding: "8px 0", borderRadius: 8, cursor: "pointer", background: aspect.id === a.id ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (aspect.id === a.id ? bdr(AC) : "var(--nv-border)"), color: aspect.id === a.id ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 11 }}>{a.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--nv-text-dim)", lineHeight: 1.6 }}>
                  {crop ? "Drag the box to move it, or pull the corners to resize. Save bakes the crop into a new copy." : "Pick an aspect ratio (or Free) to start cropping. Drag the corners of the box on the preview."}
                </div>
                {aspect.id === "free" && !crop && (
                  <button onClick={() => setCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })} style={editCtlBtn()}>Start free crop</button>
                )}
                {crop && <button onClick={() => { setCrop(null); setAspect(ASPECTS[0]); }} style={editCtlBtn()}>Clear crop</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── small styles ─────────────────────────────────────────────────────────
function thumbBtn() {
  return { width: 22, height: 22, borderRadius: 6, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,255,255,0.9)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
}
function viewerBtn(AC, active) {
  return { background: active ? fill(AC) : "transparent", border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.15)"), borderRadius: 7, cursor: "pointer", color: active ? AC : "rgba(255,255,255,0.78)", fontSize: 11, padding: "4px 10px", fontFamily: FFB, fontWeight: 600 };
}
function editTopBtn(primary, AC) {
  return { padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: primary ? fill(AC) : "rgba(255,255,255,0.06)", border: "1px solid " + (primary ? bdr(AC) : "rgba(255,255,255,0.14)"), color: primary ? AC : "rgba(255,255,255,0.82)", fontFamily: FFB, fontWeight: 600, fontSize: 12 };
}
function editCtlBtn(active, AC) {
  return { flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer", background: active ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"), color: active ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 11.5 };
}

// ── rail bits ─────────────────────────────────────────────────────────────
function RailButton({ ac, active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 8, background: active ? fill(ac) : "transparent", border: "1px solid " + (active ? bdr(ac) : "transparent"), cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: active ? ac : "var(--nv-text)", textAlign: "left", width: "100%", transition: "background 0.12s" }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ flexShrink: 0, display: "flex", color: active ? ac : "var(--nv-text-dim)" }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge != null && <span style={{ fontFamily: FFM, fontSize: 10.5, color: active ? ac : "var(--nv-text-dim)" }}>{badge}</span>}
    </button>
  );
}
const sg = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };
function LibGlyph()    { return (<svg {...sg}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>); }
function RecentGlyph() { return (<svg {...sg}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>); }
function AlbumGlyph()  { return (<svg {...sg}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/></svg>); }

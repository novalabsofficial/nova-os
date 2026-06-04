// v9.7 — Photos: a real photo app (Windows 11 Photos / Apple Photos for
// the gallery, Canva for the editor). Two-pane layout (Library / Recently
// Added / Albums) + a grid + a full-screen viewer + a layered editor.
//
// v9.7.1 — the editor is now a **Canva-style compositor**: a canvas with a
// background (color or transparent), the photo as the first movable layer,
// and any number of added image layers (from your PC or pasted from the
// clipboard). Drag layers freely; smart alignment guides snap edges/centers
// to the canvas and to other layers. Per-layer filters, adjustments,
// opacity, rotate/flip, and z-order. Export flattens everything to a new
// copy (PNG when the background is transparent, else JPEG).
//
// Storage: photos + albums live session-only in the shared photoStore.

import { useState, useEffect, useRef, useMemo } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";
import {
  getStorePhotos, subscribeStorePhotos, addStorePhoto, removeStorePhoto, updateStorePhoto,
  getAlbums, subscribeAlbums, createAlbum, deleteAlbum, setPhotoAlbum,
} from "../lib/photoStore.js";
import { startDrag, moveDrag } from "../lib/dragStore.js";

const MAX_PHOTO_SIZE = 20 * 1024 * 1024;  // 20 MB soft cap

import { novaConfirm } from "../ui/dialogs.jsx";

export function PhotosApp({ AC, showToast, onSetWallpaper }) {
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [view, setView]     = useState({ kind: "library" });
  const [viewerIdx, setViewerIdx] = useState(-1);
  const [slideshow, setSlideshow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newAlbum, setNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const inputRef = useRef(null);
  const slideshowRef = useRef(null);

  useEffect(() => { setPhotos(getStorePhotos()); return subscribeStorePhotos(setPhotos); }, []);
  useEffect(() => { setAlbums(getAlbums()); return subscribeAlbums(setAlbums); }, []);

  const visible = useMemo(() => {
    if (view.kind === "recent") return [...photos].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 30);
    if (view.kind === "album")  return photos.filter(p => p.albumId === view.id);
    return photos;
  }, [photos, view]);

  // cross-app drag (set wallpaper / avatar)
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

  useEffect(() => {
    if (!slideshow || viewerIdx < 0 || visible.length === 0) return;
    slideshowRef.current = setInterval(() => setViewerIdx(i => (i + 1) % visible.length), 4000);
    return () => clearInterval(slideshowRef.current);
  }, [slideshow, viewerIdx, visible.length]);

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

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const imgs = files.filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(f.name));
    if (imgs.length === 0) { showToast?.("No images selected"); return; }
    const tooBig = imgs.filter(f => f.size > MAX_PHOTO_SIZE);
    if (tooBig.length) showToast?.("Skipped " + tooBig.length + " over 20 MB");
    const usable = imgs.filter(f => f.size <= MAX_PHOTO_SIZE);
    const albumId = view.kind === "album" ? view.id : null;
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

  function saveEditedCopy(dataUrl, baseName, albumId) {
    const id = "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const ext = dataUrl.startsWith("data:image/png") ? ".png" : ".jpg";
    const name = baseName.replace(/\.(\w+)$/, "") + " (edited)" + ext;
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
  async function doDeleteAlbum(id) {
    if (!(await novaConfirm({ title: "Delete album", message: "Delete this album? The photos stay in your library.", danger: true, confirmText: "Delete", accent: AC }))) return;
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

      {/* SIDEBAR */}
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

      {/* MAIN */}
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
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)", marginBottom: 6 }}>{view.kind === "album" ? "This album is empty" : "Your gallery is empty"}</div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", maxWidth: 320, lineHeight: 1.6, marginBottom: 16 }}>{view.kind === "album" ? "Add photos while this album is open, or move existing photos into it from the viewer." : "Add images from your device — JPG, PNG, WebP, HEIC and more. They stay on your device."}</div>
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

      {/* VIEWER */}
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

      {/* EDITOR (Canva-style compositor) */}
      {editing && (
        <PhotoEditor photo={editing} AC={AC} showToast={showToast} onClose={() => setEditing(null)} onSave={(dataUrl) => saveEditedCopy(dataUrl, editing.name, editing.albumId)} />
      )}
    </div>
  );
}

// ───────────────────────── filters ──────────────────────────────────────
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
function buildFilter(adj, preset) {
  const pf = preset?.f || {};
  const brightness = (adj?.brightness ?? 0) + (pf.brightness ?? 100);
  const contrast   = (adj?.contrast ?? 0) + (pf.contrast ?? 100);
  const saturate   = (adj?.saturate ?? 0) + (pf.saturate ?? 100);
  const warmth     = adj?.warmth ?? 0;
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

// ───────────────────────── editor ───────────────────────────────────────
const BG_SWATCHES = ["#000000", "#ffffff", "#0e1320", "#1a1a1a", "#5b9eff", "#34d399", "#fbbf24", "#f472b6", "#f87171", "#a78bfa"];
const CHECKER = "repeating-conic-gradient(#3a3a44 0% 25%, #2a2a32 0% 50%) 50% / 22px 22px";
const SNAP = 0.012;   // alignment threshold (fraction of canvas)

let _layerSeq = 0;
const nextLayerId = () => "ly-" + (++_layerSeq) + "-" + Math.random().toString(36).slice(2, 5);

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

function PhotoEditor({ photo, AC, showToast, onClose, onSave }) {
  const [base, setBase] = useState(null);     // { src, w, h }
  const [layers, setLayers] = useState([]);   // [{id, src, ar, x,y,w,h, rotation, flipH, flipV, opacity, adj, preset}]
  const [bg, setBg] = useState({ transparent: false, color: "#0e1320" });
  const [selId, setSelId] = useState(null);
  const [guides, setGuides] = useState([]);   // [{axis:'x'|'y', pos}]
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const layersRef = useRef(layers); layersRef.current = layers;

  const canvasAR = base ? base.w / base.h : 1;   // w/h
  const sel = layers.find(l => l.id === selId) || null;

  // Load the base photo as layer 0 (fills the canvas).
  useEffect(() => {
    let alive = true;
    loadImage(photo.url).then(img => {
      if (!alive) return;
      setBase({ src: photo.url, w: img.width, h: img.height });
      const baseLayer = { id: "base", src: photo.url, ar: img.width / img.height, x: 0, y: 0, w: 1, h: 1, rotation: 0, flipH: false, flipV: false, opacity: 100, adj: { brightness: 0, contrast: 0, saturate: 0, warmth: 0 }, preset: FILTER_PRESETS[0] };
      setLayers([baseLayer]);
      setSelId("base");
    }).catch(() => showToast?.("Couldn't open this photo"));
    return () => { alive = false; };
  }, [photo.url]);

  // Add an image layer from any src (data URL or blob URL).
  function addLayer(src) {
    loadImage(src).then(img => {
      const ar = img.width / img.height;
      const w = 0.42;
      const h = w * canvasAR / ar;            // preserve the image's aspect ratio
      const id = nextLayerId();
      const layer = { id, src, ar, x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, flipH: false, flipV: false, opacity: 100, adj: { brightness: 0, contrast: 0, saturate: 0, warmth: 0 }, preset: FILTER_PRESETS[0] };
      setLayers(ls => [...ls, layer]);
      setSelId(id);
    }).catch(() => showToast?.("Couldn't load that image"));
  }
  function fromFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => addLayer(r.result); r.readAsDataURL(f);
    e.target.value = "";
  }

  // Paste from clipboard → new layer.
  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items; if (!items) return;
      for (const it of items) {
        if (it.type && it.type.startsWith("image/")) {
          const f = it.getAsFile(); if (!f) continue;
          const r = new FileReader(); r.onload = () => addLayer(r.result); r.readAsDataURL(f);
          e.preventDefault();
          showToast?.("Pasted image added as a layer");
          break;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasAR]);

  function patch(id, p) { setLayers(ls => ls.map(l => l.id === id ? { ...l, ...p } : l)); }
  function delLayer(id) { setLayers(ls => ls.filter(l => l.id !== id)); if (selId === id) setSelId(null); }
  function dupLayer(id) {
    const l = layers.find(x => x.id === id); if (!l) return;
    const copy = { ...l, id: nextLayerId(), x: Math.min(l.x + 0.04, 1 - l.w), y: Math.min(l.y + 0.04, 1 - l.h) };
    setLayers(ls => { const i = ls.findIndex(x => x.id === id); return [...ls.slice(0, i + 1), copy, ...ls.slice(i + 1)]; });
    setSelId(copy.id);
  }
  function reorder(id, dir) {
    setLayers(ls => {
      const i = ls.findIndex(l => l.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const ns = [...ls]; [ns[i], ns[j]] = [ns[j], ns[i]]; return ns;
    });
  }

  // ── move with smart alignment guides ─────────────────────────────────
  function startMove(e, layer) {
    e.preventDefault(); e.stopPropagation();
    setSelId(layer.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, lx: layer.x, ly: layer.y };
    function mv(ev) {
      let nx = start.lx + (ev.clientX - start.x) / rect.width;
      let ny = start.ly + (ev.clientY - start.y) / rect.height;
      nx = Math.min(Math.max(-layer.w * 0.5, nx), 1 - layer.w * 0.5);
      ny = Math.min(Math.max(-layer.h * 0.5, ny), 1 - layer.h * 0.5);
      // candidate snap targets from the canvas + other layers
      const others = layersRef.current.filter(l => l.id !== layer.id);
      const xs = [0, 0.5, 1]; const ys = [0, 0.5, 1];
      others.forEach(o => { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); });
      const g = [];
      const sx = snapAxis(nx, layer.w, xs); if (sx) { nx = sx.v; g.push({ axis: "x", pos: sx.guide }); }
      const sy = snapAxis(ny, layer.h, ys); if (sy) { ny = sy.v; g.push({ axis: "y", pos: sy.guide }); }
      setGuides(g);
      patch(layer.id, { x: nx, y: ny });
    }
    function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); setGuides([]); }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }
  // Snap one axis: tries the layer's near edge / center / far edge against
  // the targets; returns the snapped origin value + the guide position.
  function snapAxis(origin, size, targets) {
    const anchors = [{ off: 0, a: origin }, { off: size / 2, a: origin + size / 2 }, { off: size, a: origin + size }];
    let best = null;
    for (const an of anchors) {
      for (const t of targets) {
        const d = Math.abs(an.a - t);
        if (d < SNAP && (!best || d < best.d)) best = { d, v: t - an.off, guide: t };
      }
    }
    return best;
  }

  function startResize(e, layer) {
    e.preventDefault(); e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const start = { x: e.clientX, lw: layer.w };
    function mv(ev) {
      let nw = start.lw + (ev.clientX - start.x) / rect.width;
      nw = Math.min(Math.max(0.04, nw), 1.5);
      const nh = nw * canvasAR / layer.ar;     // preserve AR
      patch(layer.id, { w: nw, h: nh });
    }
    function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  function reset() {
    if (!base) return;
    setBg({ transparent: false, color: "#0e1320" });
    setLayers([{ id: "base", src: base.src, ar: base.w / base.h, x: 0, y: 0, w: 1, h: 1, rotation: 0, flipH: false, flipV: false, opacity: 100, adj: { brightness: 0, contrast: 0, saturate: 0, warmth: 0 }, preset: FILTER_PRESETS[0] }]);
    setSelId("base");
  }

  async function doSave() {
    if (!base) return;
    setBusy(true);
    try {
      // Export resolution = base photo, capped at 2000px long edge.
      let W = base.w, H = base.h;
      const longEdge = Math.max(W, H);
      if (longEdge > 2000) { const r = 2000 / longEdge; W = Math.round(W * r); H = Math.round(H * r); }
      const out = document.createElement("canvas");
      out.width = W; out.height = H;
      const ctx = out.getContext("2d");
      if (!bg.transparent) { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H); }
      for (const l of layersRef.current) {
        const img = await loadImage(l.src).catch(() => null);
        if (!img) continue;
        ctx.save();
        ctx.globalAlpha = (l.opacity ?? 100) / 100;
        ctx.filter = buildFilter(l.adj, l.preset);
        const dw = l.w * W, dh = l.h * H, cx = l.x * W + dw / 2, cy = l.y * H + dh / 2;
        ctx.translate(cx, cy);
        ctx.rotate((l.rotation * Math.PI) / 180);
        ctx.scale(l.flipH ? -1 : 1, l.flipV ? -1 : 1);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
      onSave(out.toDataURL(bg.transparent ? "image/png" : "image/jpeg", 0.92));
    } catch {
      showToast?.("Couldn't export — see console");
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(30px)", display: "flex", flexDirection: "column", fontFamily: FF, animation: "ss-fade 0.18s" }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={fromFile} style={{ display: "none" }}/>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff" }}>🎨 Edit Photo</div>
        <div style={{ fontFamily: FFM, fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{photo.name} · paste images with Ctrl/⌘+V</div>
        <button onClick={reset} style={editTopBtn(false)}>↺ Reset</button>
        <button onClick={onClose} style={editTopBtn(false)}>Cancel</button>
        <button onClick={doSave} disabled={busy || !base} style={{ ...editTopBtn(true, AC), opacity: busy || !base ? 0.5 : 1 }}>{busy ? "Saving…" : "Save copy"}</button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onPointerDown={() => setSelId(null)}>
          {base && (
            <div ref={canvasRef} onPointerDown={e => e.stopPropagation()} style={{ position: "relative", width: "min(58vw, 760px)", maxHeight: "74vh", aspectRatio: canvasAR, background: bg.transparent ? CHECKER : bg.color, borderRadius: 6, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
              {layers.map(l => {
                const isSel = l.id === selId;
                return (
                  <div key={l.id} onPointerDown={e => startMove(e, l)} style={{ position: "absolute", left: l.x * 100 + "%", top: l.y * 100 + "%", width: l.w * 100 + "%", height: l.h * 100 + "%", cursor: "move", outline: isSel ? "2px solid " + AC : "none", outlineOffset: 0 }}>
                    <img src={l.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: l.id === "base" ? "cover" : "contain", opacity: (l.opacity ?? 100) / 100, filter: buildFilter(l.adj, l.preset), transform: `rotate(${l.rotation}deg) scale(${l.flipH ? -1 : 1}, ${l.flipV ? -1 : 1})`, pointerEvents: "none", display: "block" }}/>
                    {isSel && l.id !== "base" && <div onPointerDown={e => startResize(e, l)} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: AC, border: "2px solid #fff", borderRadius: 3, cursor: "se-resize" }}/>}
                    {isSel && l.id === "base" && <div onPointerDown={e => startResize(e, l)} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: AC, border: "2px solid #fff", borderRadius: 3, cursor: "se-resize" }}/>}
                  </div>
                );
              })}
              {/* alignment guides */}
              {guides.map((g, i) => g.axis === "x"
                ? <div key={i} style={{ position: "absolute", left: g.pos * 100 + "%", top: 0, bottom: 0, width: 1, background: "#ff3b9a", boxShadow: "0 0 4px #ff3b9a", pointerEvents: "none" }}/>
                : <div key={i} style={{ position: "absolute", top: g.pos * 100 + "%", left: 0, right: 0, height: 1, background: "#ff3b9a", boxShadow: "0 0 4px #ff3b9a", pointerEvents: "none" }}/>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ width: 284, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", overflowY: "auto", minHeight: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Background */}
          <div>
            <SecHdr>Background</SecHdr>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer", fontSize: 12, color: "var(--nv-text)" }}>
              <input type="checkbox" checked={bg.transparent} onChange={e => setBg(b => ({ ...b, transparent: e.target.checked }))} style={{ accentColor: AC }}/>
              Transparent (exports PNG)
            </label>
            {!bg.transparent && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {BG_SWATCHES.map(c => (
                  <button key={c} onClick={() => setBg(b => ({ ...b, color: c }))} title={c} style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: "pointer", border: "2px solid " + (bg.color === c ? "#fff" : "transparent"), boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", padding: 0 }}/>
                ))}
                <label style={{ width: 22, height: 22, borderRadius: 5, cursor: "pointer", overflow: "hidden", border: "1px solid var(--nv-border)", display: "flex" }}>
                  <input type="color" value={bg.color} onChange={e => setBg(b => ({ ...b, color: e.target.value }))} style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", transform: "translate(-3px,-3px)" }}/>
                </label>
              </div>
            )}
          </div>

          {/* Add */}
          <div>
            <SecHdr>Add image</SecHdr>
            <button onClick={() => fileRef.current?.click()} style={{ ...editCtlBtn(), width: "100%", marginBottom: 6 }}>⤓ From your PC</button>
            <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)", lineHeight: 1.5 }}>…or copy any image and press <strong style={{ color: "var(--nv-text)" }}>Ctrl/⌘ + V</strong> to drop it on the canvas. Drag layers to move; pink lines show when they align.</div>
          </div>

          {/* Layers list */}
          <div>
            <SecHdr>Layers</SecHdr>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[...layers].reverse().map(l => (
                <button key={l.id} onClick={() => setSelId(l.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, cursor: "pointer", background: selId === l.id ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (selId === l.id ? bdr(AC) : "var(--nv-border)"), textAlign: "left" }}>
                  <img src={l.src} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}/>
                  <span style={{ flex: 1, fontFamily: FF, fontSize: 11.5, color: selId === l.id ? AC : "var(--nv-text)" }}>{l.id === "base" ? "Base photo" : "Image layer"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected-layer controls */}
          {sel && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid var(--nv-border)", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <SecHdr>{sel.id === "base" ? "Base photo" : "Selected layer"}</SecHdr>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button onClick={() => reorder(sel.id, 1)} title="Bring forward" style={miniCtl()}>▲</button>
                  <button onClick={() => reorder(sel.id, -1)} title="Send back" style={miniCtl()}>▼</button>
                  {sel.id !== "base" && <button onClick={() => dupLayer(sel.id)} title="Duplicate" style={miniCtl()}>⧉</button>}
                  {sel.id !== "base" && <button onClick={() => delLayer(sel.id)} className="dl" title="Delete layer" style={{ ...miniCtl(), color: "rgba(255,80,80,0.6)" }}>✕</button>}
                </div>
              </div>

              <div>
                <SliderRow label="Opacity" value={sel.opacity} min={10} max={100} onChange={v => patch(sel.id, { opacity: v })} AC={AC} suffix="%" />
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => patch(sel.id, { rotation: (sel.rotation + 270) % 360 })} style={editCtlBtn()}>↶</button>
                <button onClick={() => patch(sel.id, { rotation: (sel.rotation + 90) % 360 })} style={editCtlBtn()}>↷</button>
                <button onClick={() => patch(sel.id, { flipH: !sel.flipH })} style={editCtlBtn(sel.flipH, AC)}>⇋</button>
                <button onClick={() => patch(sel.id, { flipV: !sel.flipV })} style={editCtlBtn(sel.flipV, AC)}>⇅</button>
              </div>

              {/* Adjustments */}
              <SliderRow label="Brightness" value={sel.adj.brightness} min={-50} max={50} onChange={v => patch(sel.id, { adj: { ...sel.adj, brightness: v } })} AC={AC} />
              <SliderRow label="Contrast"   value={sel.adj.contrast}   min={-50} max={50} onChange={v => patch(sel.id, { adj: { ...sel.adj, contrast: v } })} AC={AC} />
              <SliderRow label="Saturation" value={sel.adj.saturate}   min={-50} max={50} onChange={v => patch(sel.id, { adj: { ...sel.adj, saturate: v } })} AC={AC} />
              <SliderRow label="Warmth"     value={sel.adj.warmth}     min={-50} max={50} onChange={v => patch(sel.id, { adj: { ...sel.adj, warmth: v } })} AC={AC} />

              {/* Filter presets */}
              <div>
                <SecHdr>Filter</SecHdr>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {FILTER_PRESETS.map(p => (
                    <button key={p.id} onClick={() => patch(sel.id, { preset: p })} style={{ padding: "8px 6px", borderRadius: 8, cursor: "pointer", background: sel.preset.id === p.id ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (sel.preset.id === p.id ? bdr(AC) : "var(--nv-border)"), color: sel.preset.id === p.id ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 11 }}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange, AC, suffix }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "var(--nv-text)" }}>{label}</span>
        <span style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)" }}>{value > 0 && !suffix ? "+" : ""}{value}{suffix || ""}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} style={{ width: "100%", accentColor: AC }}/>
    </div>
  );
}
function SecHdr({ children }) { return <div style={{ fontFamily: FFB, fontSize: 10.5, color: "var(--nv-text-dim)", letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>{children}</div>; }

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
  return { flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer", background: active ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"), color: active ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 12 };
}
function miniCtl() {
  return { width: 24, height: 22, borderRadius: 5, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
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

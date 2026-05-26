// v8.0 — Photos.
//
// Pick photos from your device's gallery (the OS handles the file picker UI,
// so you get the standard "Photos / Files" picker on Mac, "Pictures" on
// Windows, etc.) and browse them in a grid. Click a thumbnail to open a
// full-size viewer with arrow-key navigation, slideshow toggle, and delete.
//
// Storage model
// ─────────────
// Photos live as blob URLs for the current session only — same as the Music
// app's approach. We don't persist to Firestore because:
//   1. Image data hits the 1 MB document size cap fast (you'd fit ~1 photo)
//   2. Base64 in Firestore is ~33% larger than the raw bytes
//   3. The user can re-pick the same folder next session — picking is fast
//
// If the user is on Tauri desktop and we want true persistent gallery in
// the future, the right move is Tauri's fs API (read Pictures directory)
// + thumbnail cache. Keeping this session-only for now.

import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";

const PIXELS_PER_THUMB = 132;   // target thumbnail size in the grid
const MAX_PHOTO_SIZE   = 20 * 1024 * 1024;  // 20 MB — soft warning above this

export function PhotosApp({ AC, showToast, onSetWallpaper }) {
  // photos: [{ id, name, url, size, w, h }]
  // Width/height load asynchronously after the file is picked so the grid
  // can lay out cells without a CLS jump.
  const [photos, setPhotos] = useState([]);
  const [viewerIdx, setViewerIdx] = useState(-1);  // -1 = grid view, else fullscreen photo at this index
  const [slideshow, setSlideshow] = useState(false);
  const inputRef = useRef(null);
  const slideshowRef = useRef(null);

  // Cleanup blob URLs when the component unmounts. Without this, picking 100
  // photos and closing the app leaks 100 blob URLs into the browser.
  useEffect(() => () => { photos.forEach(p => URL.revokeObjectURL(p.url)); }, []); // eslint-disable-line

  // Slideshow auto-advance — 4 seconds per photo. Wraps around at the end.
  useEffect(() => {
    if (!slideshow || viewerIdx < 0 || photos.length === 0) return;
    slideshowRef.current = setInterval(() => {
      setViewerIdx(i => (i + 1) % photos.length);
    }, 4000);
    return () => clearInterval(slideshowRef.current);
  }, [slideshow, viewerIdx, photos.length]);

  // Keyboard navigation inside the viewer.
  useEffect(() => {
    if (viewerIdx < 0) return;
    function onKey(e) {
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "Escape")     { e.preventDefault(); closeViewer(); }
      if (e.key === " ")          { e.preventDefault(); setSlideshow(s => !s); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIdx, photos.length]); // eslint-disable-line

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const imgFiles = files.filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(f.name));
    if (imgFiles.length === 0) {
      showToast?.("No images selected");
      return;
    }
    const tooBig = imgFiles.filter(f => f.size > MAX_PHOTO_SIZE);
    if (tooBig.length) {
      showToast?.("Skipped " + tooBig.length + " photo(s) over 20 MB");
    }
    const usable = imgFiles.filter(f => f.size <= MAX_PHOTO_SIZE);
    const next = usable.map(f => ({
      id:   "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: f.name,
      url:  URL.createObjectURL(f),
      size: f.size,
      w:    null,
      h:    null,
    }));
    setPhotos(prev => [...prev, ...next]);
    // Probe each image to capture intrinsic width/height — used by the
    // viewer to size the image without a janky "0×0" → actual transition.
    next.forEach(p => {
      const img = new Image();
      img.onload = () => {
        setPhotos(cur => cur.map(x => x.id === p.id ? { ...x, w: img.width, h: img.height } : x));
      };
      img.src = p.url;
    });
    playSound("success");
    showToast?.("Added " + usable.length + " photo" + (usable.length === 1 ? "" : "s") + " ✓");
    e.target.value = "";  // allow picking the same file again later
  }

  function removePhoto(idx) {
    setPhotos(cur => {
      const next = [...cur];
      const removed = next.splice(idx, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
    // If the deleted photo was being viewed, close the viewer or step back.
    if (viewerIdx === idx) {
      if (photos.length <= 1) closeViewer();
      else setViewerIdx(i => Math.min(i, photos.length - 2));
    } else if (idx < viewerIdx) {
      setViewerIdx(i => i - 1);
    }
  }

  // v8.1 — "Set as wallpaper". Downsamples the photo to the same
  // ~900px / JPEG-0.72 budget the SettingsApp custom-wallpaper handler
  // uses, then hands the base64 data URL to NovaOS via the onSetWallpaper
  // prop. The Firestore image-blob field gets overwritten and the
  // wallpaper preference is set to "custom" so the new image renders
  // immediately and survives a refresh.
  function setAsWallpaper(photo) {
    if (!onSetWallpaper || !photo) return;
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 900;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        onSetWallpaper(dataUrl);
        // closeViewer so the user actually sees the new wallpaper change
        // behind them (toast confirmation is shown by NovaOS).
        closeViewer();
      } catch (e) {
        showToast?.("Couldn't set wallpaper");
      }
    };
    img.onerror = () => showToast?.("Couldn't load photo");
    img.src = photo.url;
  }

  function clearAll() {
    if (!photos.length) return;
    if (!window.confirm("Remove all " + photos.length + " photos? This only clears the gallery — the files stay on your device.")) return;
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]);
    closeViewer();
  }

  function openViewer(idx) { setViewerIdx(idx); setSlideshow(false); }
  function closeViewer()   { setViewerIdx(-1);  setSlideshow(false); }
  function prev() { setViewerIdx(i => i <= 0 ? photos.length - 1 : i - 1); }
  function next() { setViewerIdx(i => (i + 1) % photos.length); }

  const current = viewerIdx >= 0 ? photos[viewerIdx] : null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 12, fontFamily: FF, minHeight: 0 }}>
      {/* Hidden file input — triggered by Add button */}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }}/>

      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: 0.2 }}>📷 Photos</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
            {photos.length === 0 ? "No photos yet" : photos.length + " photo" + (photos.length === 1 ? "" : "s") + " · session only"}
          </div>
        </div>
        {photos.length > 0 && (
          <button onClick={clearAll} title="Clear all" style={{ padding: "7px 11px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,140,140,0.9)" }}>Clear all</button>
        )}
        <button onClick={() => inputRef.current?.click()} style={{ padding: "8px 14px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC }}>
          + Add photos
        </button>
      </div>

      {/* Empty state OR grid */}
      {photos.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16, filter: "drop-shadow(0 0 24px " + fill(AC) + ")" }}>📷</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "rgba(255,255,255,0.78)", marginBottom: 8 }}>Your gallery is empty</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", maxWidth: 320, lineHeight: 1.7, marginBottom: 18 }}>
            Click <strong style={{ color: "rgba(255,255,255,0.7)" }}>Add photos</strong> to pick images from your device's gallery — JPG, PNG, WebP, HEIC and more.
            <br/>
            <span style={{ fontSize: 10, opacity: 0.7 }}>Photos stay on your device. They aren't uploaded anywhere.</span>
          </div>
          <button onClick={() => inputRef.current?.click()} style={{ padding: "10px 22px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC }}>
            + Pick photos
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(" + PIXELS_PER_THUMB + "px, 1fr))",
            gap: 6,
          }}>
            {photos.map((p, idx) => (
              <div key={p.id}
                onClick={() => openViewer(idx)}
                style={{
                  position: "relative",
                  aspectRatio: "1/1",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 9,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 0.18s cubic-bezier(0.4,0,0.2,1), border-color 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                <img src={p.url} alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {/* Per-thumb delete in the top-right; click eats the parent's openViewer */}
                <button className="dl" onClick={e => { e.stopPropagation(); removePhoto(idx); }}
                  title="Remove"
                  style={{
                    position: "absolute", top: 6, right: 6,
                    width: 22, height: 22, borderRadius: 6,
                    background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                    color: "rgba(255,255,255,0.85)", fontSize: 11,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                  }}>✕</button>
                {/* Filename overlay at bottom — hidden until hover-ish; we use opacity-on-hover via CSS */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "12px 8px 4px",
                  background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.7))",
                  fontFamily: FFM, fontSize: 9, color: "rgba(255,255,255,0.85)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  letterSpacing: 0.2,
                }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full-size viewer overlay */}
      {current && (
        <div onClick={closeViewer} style={{
          position: "fixed", inset: 0, zIndex: 99998,
          background: "rgba(0,0,0,0.92)",
          backdropFilter: "blur(40px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "menu-up 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}>
          {/* Stop event bubbling so clicking the image doesn't close the viewer */}
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "92vw", maxHeight: "82vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={current.url} alt={current.name}
              style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 30px 80px rgba(0,0,0,0.65)" }}
            />
          </div>

          {/* Top bar — close + counter + slideshow toggle */}
          <div onClick={e => e.stopPropagation()} style={{
            position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11,
            padding: "8px 14px",
            fontFamily: FF, color: "rgba(255,255,255,0.88)",
          }}>
            <span style={{ fontFamily: FFM, fontSize: 12, color: "rgba(255,255,255,0.78)", letterSpacing: 0.4 }}>
              {viewerIdx + 1} / {photos.length}
            </span>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }}/>
            <button onClick={() => setSlideshow(s => !s)} title={slideshow ? "Pause slideshow (Space)" : "Start slideshow (Space)"}
              style={{ background: slideshow ? fill(AC) : "transparent", border: "1px solid " + (slideshow ? bdr(AC) : "rgba(255,255,255,0.15)"), borderRadius: 7, cursor: "pointer", color: slideshow ? AC : "rgba(255,255,255,0.78)", fontSize: 11, padding: "4px 10px", fontFamily: FFB, fontWeight: 600 }}>
              {slideshow ? "⏸ Slideshow" : "▶ Slideshow"}
            </button>
            {/* v8.1: only show "Set as wallpaper" when NovaOS passed the
                handler (which it always does — but the prop check makes
                the component still work in isolation, e.g. in tests). */}
            {onSetWallpaper && (
              <button onClick={() => setAsWallpaper(current)} title="Set this photo as your desktop wallpaper"
                style={{ background: "transparent", border: "1px solid " + bdr(AC), borderRadius: 7, cursor: "pointer", color: AC, fontSize: 11, padding: "4px 10px", fontFamily: FFB, fontWeight: 600 }}>
                🖼 Set as wallpaper
              </button>
            )}
            <button onClick={() => removePhoto(viewerIdx)} title="Remove this photo"
              style={{ background: "transparent", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 7, cursor: "pointer", color: "rgba(255,130,130,0.9)", fontSize: 11, padding: "4px 10px", fontFamily: FFB, fontWeight: 600 }}>✕ Remove</button>
            <button onClick={closeViewer} title="Close (Esc)"
              style={{ width: 26, height: 26, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, cursor: "pointer", color: "rgba(255,255,255,0.78)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
          </div>

          {/* Bottom-center filename + metadata */}
          <div onClick={e => e.stopPropagation()} style={{
            position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
            maxWidth: "70vw",
            background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
            padding: "8px 16px",
            fontFamily: FF, color: "rgba(255,255,255,0.85)",
            fontSize: 11, textAlign: "center",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <span style={{ fontFamily: FFB, fontWeight: 600 }}>{current.name}</span>
            {current.w && current.h && (
              <span style={{ marginLeft: 10, color: "rgba(255,255,255,0.5)", fontFamily: FFM, fontSize: 10 }}>
                {current.w}×{current.h} · {(current.size / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </div>

          {/* Prev/Next arrows — fixed to the sides, big hit areas */}
          {photos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prev(); }} title="Previous (←)"
                style={{ position: "fixed", left: 18, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,255,255,0.88)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>‹</button>
              <button onClick={e => { e.stopPropagation(); next(); }} title="Next (→)"
                style={{ position: "fixed", right: 18, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,255,255,0.88)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

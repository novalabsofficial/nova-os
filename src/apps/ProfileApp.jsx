import { useState, useRef, useEffect } from "react";
import { FF, FFB, FFM, INP, SEC } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { UserAvatar } from "../ui/icons.jsx";

// v8.5 — Profile picture editor. Upload an image, pan + zoom to frame it in a
// circular crop, save a downsampled 256×256 JPEG to `data.avatar`. The avatar
// then renders via the shared <UserAvatar> here, on the top-right user chip,
// and in the start-menu user card.
const CROP = 220; // crop box size in px (preview); output is a 256² square

export function ProfileApp({ user, data, updateData, showToast, AC }) {
  const [bio, setBio] = useState(data?.bio || "");
  const joined = data?.joined ? new Date(data.joined).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) : "Unknown";
  const installed = data?.installedApps?.length || 0;

  // Cropper state — `editing` holds the loaded image {src,iw,ih} or null.
  const [editing, setEditing] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const dragRef = useRef(null);

  const base = editing ? Math.max(CROP / editing.iw, CROP / editing.ih) : 1; // "cover" scale
  const eff = base * zoom;
  const dispW = editing ? editing.iw * eff : 0;
  const dispH = editing ? editing.ih * eff : 0;

  const clampOff = (o) => ({
    x: Math.min(0, Math.max(CROP - dispW, o.x)),
    y: Math.min(0, Math.max(CROP - dispH, o.y)),
  });
  // Keep the image covering the crop box when the zoom changes.
  useEffect(() => { if (editing) setOff((o) => clampOff(o)); /* eslint-disable-next-line */ }, [zoom, editing]);

  function onFile(e) {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { showToast("File too large (max 8MB)"); return; }
    const rd = new FileReader();
    rd.onload = (ev) => {
      const im = new Image();
      im.onload = () => {
        const b = Math.max(CROP / im.width, CROP / im.height);
        setEditing({ src: ev.target.result, iw: im.width, ih: im.height });
        setZoom(1);
        setOff({ x: (CROP - im.width * b) / 2, y: (CROP - im.height * b) / 2 });
      };
      im.src = ev.target.result;
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  }

  function onDown(e) {
    if (!editing) return;
    e.preventDefault();
    try { boxRef.current.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
  }
  function onMove(e) {
    const d = dragRef.current; if (!d) return;
    setOff(clampOff({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
  }
  function onUp(e) {
    dragRef.current = null;
    try { boxRef.current.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
  }

  function save() {
    const img = imgRef.current; if (!img) return;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    const srcSize = CROP / eff;          // source px shown in the crop box
    const sx = (-off.x) / eff, sy = (-off.y) / eff;
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, 256, 256);
    updateData({ avatar: c.toDataURL("image/jpeg", 0.85) });
    showToast("Profile picture saved ✓");
    setEditing(null);
  }

  function removeAvatar() {
    updateData({ avatar: null });
    showToast("Profile picture removed");
  }

  // ── Cropper view ─────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div style={{ width: "100%", fontFamily: FF }}>
        <div style={SEC}>Adjust Photo</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div
            ref={boxRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: "relative", width: CROP, height: CROP, borderRadius: 14, overflow: "hidden", background: "#000", cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none", userSelect: "none" }}>
            <img ref={imgRef} src={editing.src} draggable={false} alt=""
              style={{ position: "absolute", left: off.x, top: off.y, width: dispW, height: dispH, pointerEvents: "none", userSelect: "none" }}/>
            {/* circular crop mask — darkens everything outside the circle */}
            <div style={{ position: "absolute", left: "50%", top: "50%", width: CROP - 4, height: CROP - 4, transform: "translate(-50%,-50%)", borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", pointerEvents: "none" }}/>
            <div style={{ position: "absolute", left: "50%", top: "50%", width: CROP - 4, height: CROP - 4, transform: "translate(-50%,-50%)", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.55)", pointerEvents: "none" }}/>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: CROP }}>
            <span style={{ fontSize: 13 }}>🔍</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ flex: 1, accentColor: AC }}/>
          </div>
          <div style={{ fontSize: 11, color: "var(--nv-text-dim)" }}>Drag to reposition · slide to zoom</div>
          <div style={{ display: "flex", gap: 8, width: CROP }}>
            <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text)" }}>Cancel</button>
            <button onClick={save} style={{ flex: 1, padding: "9px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: AC }}>Save Photo</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Profile view ─────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", fontFamily: FF }}>
      <div style={SEC}>Profile</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ position: "relative", marginBottom: 11 }}>
          <UserAvatar name={user} img={data?.avatar} ac={AC} size={84}/>
          <button onClick={() => fileRef.current.click()} title="Change photo"
            style={{ position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: "50%", background: AC, border: "2px solid #0a0c18", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", padding: 0 }}>✎</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }}/>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 2 }}>@{user}</div>
        <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)" }}>Member since {joined}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 9 }}>
          <button onClick={() => fileRef.current.click()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: AC }}>{data?.avatar ? "Change photo" : "Add photo"}</button>
          {data?.avatar && <button onClick={removeAvatar} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,120,120,0.8)" }}>Remove</button>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
        {[["📝", data?.notes?.length || 0, "Notes"], ["✅", (data?.tasks?.filter((t) => t.done).length || 0) + "/" + (data?.tasks?.length || 0), "Tasks"], ["🏪", installed, "Installed"]].map(([ic, v, k]) => (
          <div key={k} style={{ padding: "11px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 10, marginBottom: 3 }}>{ic}</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 20, color: AC }}>{v}</div>
            <div style={{ fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2 }}>{k}</div>
          </div>
        ))}
      </div>
      <div style={SEC}>Bio</div>
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write something about yourself…" style={{ ...INP, minHeight: 64, marginBottom: 8 }}/>
      <button onClick={() => { updateData({ bio }); showToast("Bio saved ✓"); }} style={{ width: "100%", padding: "9px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 7, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC }}>Save Bio</button>
    </div>
  );
}

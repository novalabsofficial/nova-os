// v9.7 — Slides: a presentation builder + exporter (Google Slides /
// PowerPoint as references). Build decks of 16:9 slides with text, shapes,
// and images; present fullscreen; export to a real .pptx (via pptxgenjs,
// lazy-loaded) or PNG images.
//
// Layout:
//   Deck home  →  pick / create a deck
//   Editor     →  slide rail (left) + 16:9 canvas (center) + properties (right)
//   Presenter  →  fullscreen, arrow keys
//
// Storage: decks live on the user's data doc at `data.slides` — same
// Firestore-synced model as Notes/Tasks, no new collection or rules. We
// keep a local working copy and debounce-persist so typing stays snappy.
//
// Coordinate model: every element's x/y/w/h are FRACTIONS of the slide
// (0..1), and text size is a percentage of slide height — so slides render
// identically at any size (rail thumbnail, editor canvas, presenter,
// export).

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FF, FFB, FFM, INP } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";
import { playSound } from "../lib/audio.js";
import { getStorePhotos } from "../lib/photoStore.js";

const THEMES = {
  modern: { name: "Modern", bg: "#0e1320", text: "#ffffff", accent: "#5b9eff" },
  mono:   { name: "Mono",   bg: "#121212", text: "#f0f0f0", accent: "#9aa0a6" },
  pastel: { name: "Pastel", bg: "#fdeff6", text: "#3b2f3a", accent: "#ec4899" },
  bold:   { name: "Bold",   bg: "#1a0b2e", text: "#ffffff", accent: "#fbbf24" },
  light:  { name: "Light",  bg: "#ffffff", text: "#161616", accent: "#2563eb" },
  forest: { name: "Forest", bg: "#0f1f17", text: "#eafff3", accent: "#34d399" },
};
const THEME_KEYS = Object.keys(THEMES);

const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function blankSlide(theme) {
  return { id: uid("s"), bg: THEMES[theme].bg, elements: [] };
}
function titleSlide(theme) {
  const t = THEMES[theme];
  return {
    id: uid("s"), bg: t.bg,
    elements: [
      { id: uid("e"), type: "text", x: 0.1, y: 0.34, w: 0.8, h: 0.18, text: "Presentation Title", fontFrac: 11, color: t.text, bold: true, italic: false, align: "center" },
      { id: uid("e"), type: "text", x: 0.2, y: 0.56, w: 0.6, h: 0.1, text: "Your subtitle here", fontFrac: 5, color: t.accent, bold: false, italic: false, align: "center" },
    ],
  };
}
function newDeck() {
  const theme = "modern";
  return { id: uid("d"), title: "Untitled deck", theme, createdAt: Date.now(), updatedAt: Date.now(), slides: [titleSlide(theme)] };
}

import { novaConfirm } from "../ui/dialogs.jsx";

export function SlidesApp({ AC, data, updateData, showToast }) {
  // Local working copy of all decks, initialised from the user doc.
  const [decks, setDecks] = useState(() => (data?.slides && Array.isArray(data.slides)) ? data.slides : []);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [selSlide, setSelSlide] = useState(0);
  const [selEl, setSelEl] = useState(null);   // element id
  const [presenting, setPresenting] = useState(false);
  const [presentIdx, setPresentIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const decksRef = useRef(decks);
  decksRef.current = decks;

  // Debounced persist of the working copy to the user doc.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateData?.(p => ({ ...p, slides: decksRef.current }));
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [decks, updateData]);

  const activeDeck = decks.find(d => d.id === activeDeckId) || null;

  // ── deck-level mutations ──────────────────────────────────────────────
  function mutateDeck(deckId, fn) {
    setDecks(prev => prev.map(d => d.id === deckId ? { ...fn(d), updatedAt: Date.now() } : d));
  }
  function createDeck() {
    const d = newDeck();
    setDecks(prev => [d, ...prev]);
    setActiveDeckId(d.id); setSelSlide(0); setSelEl(null);
  }
  async function deleteDeck(id) {
    if (!(await novaConfirm({ title: "Delete deck", message: "Delete this deck? This can't be undone.", danger: true, confirmText: "Delete", accent: AC }))) return;
    setDecks(prev => prev.filter(d => d.id !== id));
    if (activeDeckId === id) setActiveDeckId(null);
  }

  // ── slide-level mutations (operate on the active deck) ────────────────
  function mutateSlides(fn) {
    if (!activeDeck) return;
    mutateDeck(activeDeck.id, d => ({ ...d, slides: fn(d.slides) }));
  }
  function addSlide() {
    if (!activeDeck) return;
    mutateSlides(s => {
      const ns = [...s.slice(0, selSlide + 1), blankSlide(activeDeck.theme), ...s.slice(selSlide + 1)];
      return ns;
    });
    setSelSlide(i => i + 1); setSelEl(null);
  }
  function dupSlide() {
    mutateSlides(s => {
      const cur = s[selSlide]; if (!cur) return s;
      const copy = { ...cur, id: uid("s"), elements: cur.elements.map(e => ({ ...e, id: uid("e") })) };
      return [...s.slice(0, selSlide + 1), copy, ...s.slice(selSlide + 1)];
    });
    setSelSlide(i => i + 1); setSelEl(null);
  }
  function deleteSlide(idx) {
    if (!activeDeck || activeDeck.slides.length <= 1) { showToast?.("A deck needs at least one slide"); return; }
    mutateSlides(s => s.filter((_, i) => i !== idx));
    setSelSlide(i => Math.max(0, Math.min(i, activeDeck.slides.length - 2)));
    setSelEl(null);
  }
  function moveSlide(idx, dir) {
    mutateSlides(s => {
      const t = idx + dir; if (t < 0 || t >= s.length) return s;
      const ns = [...s]; [ns[idx], ns[t]] = [ns[t], ns[idx]]; return ns;
    });
    setSelSlide(i => Math.max(0, Math.min(i + dir, (activeDeck?.slides.length || 1) - 1)));
  }

  // ── element-level mutations (active slide) ────────────────────────────
  function mutateEls(fn) {
    mutateSlides(s => s.map((sl, i) => i === selSlide ? { ...sl, elements: fn(sl.elements) } : sl));
  }
  function addElement(type) {
    if (!activeDeck) return;
    const t = THEMES[activeDeck.theme];
    const base = { id: uid("e"), x: 0.3, y: 0.4, w: 0.4, h: 0.2 };
    let el;
    if (type === "text")        el = { ...base, type, text: "Text", fontFrac: 6, color: t.text, bold: false, italic: false, align: "left" };
    else if (type === "rect")   el = { ...base, type, fill: t.accent, stroke: "" };
    else if (type === "ellipse")el = { ...base, type, fill: t.accent, stroke: "" };
    else if (type === "line")   el = { ...base, y: 0.5, h: 0.004, type, fill: t.text, stroke: "" };
    mutateEls(els => [...els, el]);
    setSelEl(el.id);
  }
  function addImageEl(src) {
    const el = { id: uid("e"), type: "image", x: 0.25, y: 0.2, w: 0.5, h: 0.5, src };
    mutateEls(els => [...els, el]);
    setSelEl(el.id);
  }
  function patchEl(id, patch) { mutateEls(els => els.map(e => e.id === id ? { ...e, ...patch } : e)); }
  function deleteEl(id) { mutateEls(els => els.filter(e => e.id !== id)); if (selEl === id) setSelEl(null); }

  function applyTheme(themeKey) {
    if (!activeDeck) return;
    const t = THEMES[themeKey];
    mutateDeck(activeDeck.id, d => ({
      ...d, theme: themeKey,
      // Recolor slide backgrounds + any text still using the old theme text
      // color to keep the deck visually coherent.
      slides: d.slides.map(sl => ({
        ...sl,
        bg: t.bg,
        elements: sl.elements.map(e => e.type === "text" ? { ...e, color: e.color === THEMES[d.theme].text ? t.text : e.color } : e),
      })),
    }));
  }

  // ── export ────────────────────────────────────────────────────────────
  async function exportPptx() {
    if (!activeDeck) return;
    setExporting(true);
    try {
      const mod = await import("pptxgenjs");
      const PptxGen = mod.default || mod;
      const pptx = new PptxGen();
      pptx.defineLayout({ name: "NOVA16x9", width: 10, height: 5.625 });
      pptx.layout = "NOVA16x9";
      const W = 10, H = 5.625;
      activeDeck.slides.forEach(sl => {
        const s = pptx.addSlide();
        s.background = { color: (sl.bg || "#0e1320").replace("#", "") };
        sl.elements.forEach(el => {
          const x = el.x * W, y = el.y * H, w = el.w * W, h = el.h * H;
          if (el.type === "text") {
            s.addText(el.text || "", {
              x, y, w, h,
              fontSize: Math.max(6, Math.round((el.fontFrac / 100) * H * 72)),
              color: (el.color || "#ffffff").replace("#", ""),
              bold: !!el.bold, italic: !!el.italic,
              align: el.align || "left", valign: "top",
            });
          } else if (el.type === "rect") {
            // pptxgenjs accepts the string shape name; avoids depending on
            // the ShapeType enum being present on the instance.
            s.addShape("rect", { x, y, w, h, fill: { color: (el.fill || "#5b9eff").replace("#", "") } });
          } else if (el.type === "ellipse") {
            s.addShape("ellipse", { x, y, w, h, fill: { color: (el.fill || "#5b9eff").replace("#", "") } });
          } else if (el.type === "line") {
            s.addShape("line", { x, y, w, h: 0, line: { color: (el.fill || "#ffffff").replace("#", ""), width: 2 } });
          } else if (el.type === "image" && el.src) {
            s.addImage({ data: el.src.startsWith("data:") ? el.src : undefined, path: el.src.startsWith("data:") ? undefined : el.src, x, y, w, h });
          }
        });
      });
      await pptx.writeFile({ fileName: (activeDeck.title || "deck").replace(/[^\w- ]/g, "") + ".pptx" });
      showToast?.("Exported .pptx ✓");
    } catch (e) {
      console.warn("[slides] pptx export failed:", e?.message || e);
      showToast?.("Export failed — see console");
    }
    setExporting(false);
  }

  // ── presenter keyboard ────────────────────────────────────────────────
  useEffect(() => {
    if (!presenting) return;
    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); setPresentIdx(i => Math.min(i + 1, (activeDeck?.slides.length || 1) - 1)); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setPresentIdx(i => Math.max(0, i - 1)); }
      if (e.key === "Escape") { e.preventDefault(); setPresenting(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, activeDeck]);

  // ════════════════════ render ════════════════════
  if (!activeDeck) {
    return <DeckHome decks={decks} AC={AC} onOpen={id => { setActiveDeckId(id); setSelSlide(0); setSelEl(null); }} onCreate={createDeck} onDelete={deleteDeck} />;
  }

  const slide = activeDeck.slides[selSlide] || activeDeck.slides[0];
  const selectedEl = slide?.elements.find(e => e.id === selEl) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
        <button onClick={() => setActiveDeckId(null)} title="Back to decks" style={tbBtn()}>‹ Decks</button>
        <input value={activeDeck.title} onChange={e => mutateDeck(activeDeck.id, d => ({ ...d, title: e.target.value }))} style={{ ...INP, width: 200, padding: "5px 10px", fontSize: 13, fontFamily: FFB, fontWeight: 600 }}/>
        <div style={{ flex: 1 }}/>
        <select value={activeDeck.theme} onChange={e => applyTheme(e.target.value)} title="Theme" style={{ ...INP, width: "auto", padding: "5px 8px", fontSize: 11.5, cursor: "pointer" }}>
          {THEME_KEYS.map(k => <option key={k} value={k}>{THEMES[k].name}</option>)}
        </select>
        <button onClick={() => { setPresentIdx(selSlide); setPresenting(true); }} style={tbBtn()}>▶ Present</button>
        <button onClick={exportPptx} disabled={exporting} style={{ ...tbBtn(true, AC), opacity: exporting ? 0.5 : 1 }}>{exporting ? "Exporting…" : "⤓ Export .pptx"}</button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Slide rail */}
        <div style={{ width: 150, flexShrink: 0, borderRight: "1px solid var(--nv-border)", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 7 }}>
            {activeDeck.slides.map((sl, i) => (
              <div key={sl.id} style={{ position: "relative" }}>
                <button onClick={() => { setSelSlide(i); setSelEl(null); }} style={{ display: "block", width: "100%", padding: 0, borderRadius: 7, overflow: "hidden", cursor: "pointer", border: "2px solid " + (i === selSlide ? AC : "var(--nv-border)"), background: "transparent" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: sl.bg }}>
                    <SlideRender slide={sl} />
                    <div style={{ position: "absolute", top: 2, left: 4, fontFamily: FFM, fontSize: 9, color: "var(--nv-text)", textShadow: "0 1px 2px #000" }}>{i + 1}</div>
                  </div>
                </button>
                <div style={{ position: "absolute", top: 3, right: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveSlide(i, -1)} disabled={i === 0} title="Move up" style={railMini()}>↑</button>
                  <button onClick={() => moveSlide(i, 1)} disabled={i === activeDeck.slides.length - 1} title="Move down" style={railMini()}>↓</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: "1px solid var(--nv-border)", display: "flex", gap: 6 }}>
            <button onClick={addSlide} style={{ ...tbBtn(true, AC), flex: 1, fontSize: 11 }}>+ Slide</button>
            <button onClick={dupSlide} title="Duplicate slide" style={tbBtn()}>⧉</button>
            <button onClick={() => deleteSlide(selSlide)} className="dl" title="Delete slide" style={{ ...tbBtn(), color: "rgba(255,80,80,0.6)" }}>✕</button>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.18)", minHeight: 0, overflow: "hidden" }} onPointerDown={() => setSelEl(null)}>
          <SlideCanvas
            slide={slide} AC={AC} selEl={selEl}
            onSelectEl={setSelEl} onPatchEl={patchEl}
          />
        </div>

        {/* Properties */}
        <div style={{ width: 256, flexShrink: 0, borderLeft: "1px solid var(--nv-border)", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--nv-border)", fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)" }}>Insert</div>
          <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, borderBottom: "1px solid var(--nv-border)" }}>
            <button onClick={() => addElement("text")} style={insBtn()}>＋ Text</button>
            <button onClick={() => addElement("rect")} style={insBtn()}>▭ Rect</button>
            <button onClick={() => addElement("ellipse")} style={insBtn()}>⬭ Ellipse</button>
            <button onClick={() => addElement("line")} style={insBtn()}>／ Line</button>
            <ImagePicker AC={AC} onPick={addImageEl} showToast={showToast} />
          </div>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "12px" }}>
            {selectedEl ? (
              <ElementProps el={selectedEl} AC={AC} onPatch={p => patchEl(selectedEl.id, p)} onDelete={() => deleteEl(selectedEl.id)} />
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", lineHeight: 1.7, textAlign: "center", padding: "30px 8px" }}>
                Select an element on the slide to edit it, or insert one above.<br/><br/>
                Drag elements to move; pull the corner to resize.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Presenter */}
      {presenting && activeDeck && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "min(100vw, 177.7vh)", aspectRatio: "16/9", position: "relative", background: activeDeck.slides[presentIdx]?.bg || "#000" }}>
            <SlideRender slide={activeDeck.slides[presentIdx]} />
          </div>
          <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, background: "rgba(15,17,32,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 14px", fontFamily: FFM, fontSize: 12, color: "var(--nv-text)" }}>
            <button onClick={() => setPresentIdx(i => Math.max(0, i - 1))} style={presBtn()}>‹</button>
            <span>{presentIdx + 1} / {activeDeck.slides.length}</span>
            <button onClick={() => setPresentIdx(i => Math.min(i + 1, activeDeck.slides.length - 1))} style={presBtn()}>›</button>
            <button onClick={() => setPresenting(false)} style={{ ...presBtn(), fontSize: 11 }}>Esc ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Deck home ────────────────────────────────────
function DeckHome({ decks, AC, onOpen, onCreate, onDelete }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: FF, padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>📊 Slides</div>
          <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 3 }}>{decks.length} {decks.length === 1 ? "deck" : "decks"} · synced to your account</div>
        </div>
        <button onClick={onCreate} style={{ marginLeft: "auto", padding: "9px 18px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC }}>+ New deck</button>
      </div>
      {decks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "var(--nv-text-dim)" }}>
          <div style={{ fontSize: 56, opacity: 0.5, marginBottom: 14 }}>📊</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "var(--nv-text-strong)", marginBottom: 6 }}>No decks yet</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 16px" }}>Create a presentation, add slides with text, shapes and images, then present it fullscreen or export to PowerPoint.</div>
          <button onClick={onCreate} style={{ padding: "10px 20px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC }}>+ New deck</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {[...decks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(d => (
            <div key={d.id} className="fr" style={{ borderRadius: 11, overflow: "hidden", border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", cursor: "pointer", position: "relative" }}>
              <button onClick={() => onOpen(d.id)} style={{ display: "block", width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: d.slides[0]?.bg || "#0e1320" }}>
                  <SlideRender slide={d.slides[0]} />
                </div>
                <div style={{ padding: "9px 12px", textAlign: "left" }}>
                  <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "var(--nv-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title || "Untitled"}</div>
                  <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2 }}>{d.slides.length} slide{d.slides.length === 1 ? "" : "s"}</div>
                </div>
              </button>
              <button className="dl" onClick={() => onDelete(d.id)} title="Delete deck" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,120,120,0.9)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Slide render (read-only) ─────────────────────
// Used for thumbnails + presenter. Absolute-positioned elements in % so it
// scales with its container. Text size = fontFrac% of container height,
// measured via a ResizeObserver.
function SlideRender({ slide }) {
  const ref = useRef(null);
  const [hpx, setHpx] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => { for (const e of es) setHpx(e.contentRect.height); });
    ro.observe(ref.current);
    setHpx(ref.current.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  if (!slide) return null;
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {slide.elements.map(el => <ElementView key={el.id} el={el} hpx={hpx} />)}
    </div>
  );
}

function ElementView({ el, hpx }) {
  const box = { position: "absolute", left: el.x * 100 + "%", top: el.y * 100 + "%", width: el.w * 100 + "%", height: el.h * 100 + "%" };
  if (el.type === "text") {
    return <div style={{ ...box, color: el.color, fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? "italic" : "normal", textAlign: el.align || "left", fontFamily: FFB, fontSize: Math.max(6, (el.fontFrac / 100) * hpx), lineHeight: 1.18, overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{el.text}</div>;
  }
  if (el.type === "rect")    return <div style={{ ...box, background: el.fill, border: el.stroke ? "2px solid " + el.stroke : "none" }}/>;
  if (el.type === "ellipse") return <div style={{ ...box, background: el.fill, borderRadius: "50%", border: el.stroke ? "2px solid " + el.stroke : "none" }}/>;
  if (el.type === "line")    return <div style={{ ...box, background: el.fill }}/>;
  if (el.type === "image")   return <img src={el.src} alt="" style={{ ...box, objectFit: "cover" }}/>;
  return null;
}

// ───────────────────────── Editable canvas ──────────────────────────────
function SlideCanvas({ slide, AC, selEl, onSelectEl, onPatchEl }) {
  const ref = useRef(null);
  const [hpx, setHpx] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => { for (const e of es) setHpx(e.contentRect.height); });
    ro.observe(ref.current);
    setHpx(ref.current.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  // Drag (move) + corner resize, in fraction space relative to the canvas.
  function startDrag(e, el, mode) {
    e.preventDefault(); e.stopPropagation();
    onSelectEl(el.id);
    const rect = ref.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, el: { ...el } };
    function mv(ev) {
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      if (mode === "move") {
        onPatchEl(el.id, {
          x: Math.min(Math.max(0, start.el.x + dx), 1 - start.el.w),
          y: Math.min(Math.max(0, start.el.y + dy), 1 - start.el.h),
        });
      } else {
        onPatchEl(el.id, {
          w: Math.min(Math.max(0.03, start.el.w + dx), 1 - start.el.x),
          h: Math.min(Math.max(0.01, start.el.h + dy), 1 - start.el.y),
        });
      }
    }
    function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  return (
    <div ref={ref} onPointerDown={e => e.stopPropagation()} style={{ width: "min(100%, calc((100vh - 200px) * 1.778))", aspectRatio: "16/9", background: slide.bg, position: "relative", borderRadius: 8, overflow: "hidden", boxShadow: "0 16px 50px rgba(0,0,0,0.5)" }}>
      {slide.elements.map(el => {
        const sel = el.id === selEl;
        const box = { position: "absolute", left: el.x * 100 + "%", top: el.y * 100 + "%", width: el.w * 100 + "%", height: el.h * 100 + "%" };
        return (
          <div key={el.id} onPointerDown={e => startDrag(e, el, "move")} style={{ ...box, cursor: "move", outline: sel ? "2px solid " + AC : "1px dashed rgba(255,255,255,0.18)", outlineOffset: 0 }}>
            {/* element visual */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {el.type === "text" && <div style={{ width: "100%", height: "100%", color: el.color, fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? "italic" : "normal", textAlign: el.align || "left", fontFamily: FFB, fontSize: Math.max(6, (el.fontFrac / 100) * hpx), lineHeight: 1.18, overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{el.text}</div>}
              {el.type === "rect" && <div style={{ width: "100%", height: "100%", background: el.fill, border: el.stroke ? "2px solid " + el.stroke : "none" }}/>}
              {el.type === "ellipse" && <div style={{ width: "100%", height: "100%", background: el.fill, borderRadius: "50%", border: el.stroke ? "2px solid " + el.stroke : "none" }}/>}
              {el.type === "line" && <div style={{ width: "100%", height: "100%", background: el.fill }}/>}
              {el.type === "image" && <img src={el.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
            </div>
            {/* resize handle */}
            {sel && <div onPointerDown={e => startDrag(e, el, "resize")} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: AC, border: "2px solid #fff", borderRadius: 3, cursor: "se-resize" }}/>}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── Element properties ───────────────────────────
const SWATCHES = ["#ffffff", "#161616", "#5b9eff", "#34d399", "#fbbf24", "#f472b6", "#f87171", "#a78bfa", "#2dd4bf", "#9aa0a6"];

function ElementProps({ el, AC, onPatch, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 12, color: "var(--nv-text-strong)", textTransform: "capitalize" }}>{el.type}</span>
        <button onClick={onDelete} className="dl" style={{ marginLeft: "auto", padding: "4px 10px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 6, cursor: "pointer", color: "#ff8b8b", fontFamily: FFB, fontWeight: 600, fontSize: 10.5 }}>Delete</button>
      </div>

      {el.type === "text" && (<>
        <div>
          <PropLabel>Text</PropLabel>
          <textarea value={el.text} onChange={e => onPatch({ text: e.target.value })} rows={3} style={{ ...INP, fontSize: 12, padding: "7px 10px", minHeight: 60, resize: "vertical" }}/>
        </div>
        <div>
          <PropLabel>Size</PropLabel>
          <input type="range" min={3} max={24} step={0.5} value={el.fontFrac} onChange={e => onPatch({ fontFrac: +e.target.value })} style={{ width: "100%", accentColor: AC }}/>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onPatch({ bold: !el.bold })} style={propToggle(el.bold, AC)}><b>B</b></button>
          <button onClick={() => onPatch({ italic: !el.italic })} style={propToggle(el.italic, AC)}><i>I</i></button>
          {["left", "center", "right"].map(a => (
            <button key={a} onClick={() => onPatch({ align: a })} style={propToggle(el.align === a, AC)}>{a === "left" ? "⬅" : a === "center" ? "⬌" : "➡"}</button>
          ))}
        </div>
        <ColorRow label="Color" value={el.color} onPick={c => onPatch({ color: c })} />
      </>)}

      {(el.type === "rect" || el.type === "ellipse" || el.type === "line") && (<>
        <ColorRow label={el.type === "line" ? "Line color" : "Fill"} value={el.fill} onPick={c => onPatch({ fill: c })} />
      </>)}

      {el.type === "image" && (
        <div style={{ fontSize: 11, color: "var(--nv-text-dim)", lineHeight: 1.6 }}>Drag to move, pull the corner to resize. Replace by inserting a new image.</div>
      )}

      {/* Position read-out */}
      <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", borderTop: "1px solid var(--nv-border)", paddingTop: 8 }}>
        {Math.round(el.x * 100)}, {Math.round(el.y * 100)} · {Math.round(el.w * 100)}×{Math.round(el.h * 100)}
      </div>
    </div>
  );
}
function PropLabel({ children }) { return <div style={{ fontFamily: FFB, fontSize: 10.5, color: "var(--nv-text-dim)", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>{children}</div>; }
function ColorRow({ label, value, onPick }) {
  return (
    <div>
      <PropLabel>{label}</PropLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {SWATCHES.map(c => (
          <button key={c} onClick={() => onPick(c)} title={c} style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: "pointer", border: "2px solid " + (value === c ? "#fff" : "transparent"), boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", padding: 0 }}/>
        ))}
        <label style={{ width: 22, height: 22, borderRadius: 5, cursor: "pointer", overflow: "hidden", border: "1px solid var(--nv-border)", display: "flex" }}>
          <input type="color" value={value || "#ffffff"} onChange={e => onPick(e.target.value)} style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", transform: "translate(-3px,-3px)" }}/>
        </label>
      </div>
    </div>
  );
}
function ImagePicker({ AC, onPick, showToast }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const photos = getStorePhotos();
  function fromFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { onPick(reader.result); setOpen(false); };
    reader.readAsDataURL(f);
    e.target.value = "";
  }
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={fromFile} style={{ display: "none" }}/>
      <button onClick={() => setOpen(o => !o)} style={{ ...insBtn(), gridColumn: "span 2" }}>🖼 Image</button>
      {open && (
        <div style={{ gridColumn: "span 2", border: "1px solid var(--nv-border)", borderRadius: 8, padding: 8, background: "rgba(0,0,0,0.2)" }}>
          <button onClick={() => inputRef.current?.click()} style={{ ...insBtn(), width: "100%", marginBottom: 6 }}>⤓ Upload from device</button>
          {photos.length > 0 && <div style={{ fontFamily: FFM, fontSize: 9.5, color: "var(--nv-text-dim)", margin: "4px 2px" }}>From Photos:</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, maxHeight: 120, overflowY: "auto" }}>
            {photos.map(p => (
              <button key={p.id} onClick={() => { onPick(p.url); setOpen(false); }} style={{ aspectRatio: "1/1", padding: 0, border: "1px solid var(--nv-border)", borderRadius: 5, overflow: "hidden", cursor: "pointer", background: "transparent" }}>
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── styles ─────────────────────────────────────────────────────────────
function tbBtn(primary, AC) {
  return { padding: "6px 12px", borderRadius: 7, cursor: "pointer", background: primary ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (primary ? bdr(AC) : "var(--nv-border)"), color: primary ? AC : "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, whiteSpace: "nowrap" };
}
function insBtn() {
  return { padding: "8px 6px", borderRadius: 7, cursor: "pointer", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", color: "var(--nv-text)", fontFamily: FFB, fontWeight: 600, fontSize: 11.5 };
}
function railMini() {
  return { width: 18, height: 16, borderRadius: 4, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "var(--nv-text)", fontSize: 9, lineHeight: 1, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" };
}
function presBtn() {
  return { width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", color: "#fff", fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 };
}
function propToggle(active, AC) {
  return { flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", background: active ? fill(AC) : "var(--nv-elevated)", border: "1px solid " + (active ? bdr(AC) : "var(--nv-border)"), color: active ? AC : "var(--nv-text)", fontFamily: FF, fontSize: 12 };
}

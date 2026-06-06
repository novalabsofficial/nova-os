// Sheets — v11.0 Phase C. A mini spreadsheet: A–Z columns × resizable rows, live
// formula engine (lib/sheets.js), formula bar, click/drag range selection with a
// Sum/Avg/Count status bar, bold/italic/alignment, and CSV import/export. Cells
// persist to localStorage. The cell editor is an overlay positioned over the
// active cell, and editing is isolated to its own component so typing doesn't
// re-render the whole grid.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { colName, rcToRef, refToRC, makeEvaluator, aggregateRefs } from "../lib/sheets.js";

const LS = "nova-sheets-v1";
const COLS = 26;
const COLW = 104, ROWH = 26, HEADW = 46, HEADH = 26;
const money = (n) => Math.round(n * 100) / 100;

const loadData = () => {
  try { const d = JSON.parse(localStorage.getItem(LS)); if (d && d.cells) return { cells: d.cells, styles: d.styles || {}, rows: d.rows || 60 }; } catch {}
  return { cells: {}, styles: {}, rows: 60 };
};

export function SheetsApp({ AC = "#1a8f5a", showToast }) {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const C = light
    ? { bg: "#ffffff", head: "#f1f3f7", headSel: "#dde7f6", line: "#e3e7ef", text: "#19202d", dim: "#7a8296", selFill: "#e9f1fe" }
    : { bg: "#12141d", head: "#1a1e29", headSel: "#283246", line: "#272c3a", text: "#e8ebf2", dim: "#8b93a7", selFill: "#1c2740" };

  const [data, setData] = useState(loadData);
  const { cells, styles, rows: ROWS } = data;
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState({ r: 0, c: 0 });
  const [edit, setEdit] = useState(null);              // { ref, init } | null
  const containerRef = useRef(null);
  const dragRef = useRef(false);
  const fileRef = useRef(null);

  useEffect(() => { const id = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(data)); } catch {} }, 200); return () => clearTimeout(id); }, [data]);
  useEffect(() => { const up = () => { dragRef.current = false; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  const ev = useMemo(() => makeEvaluator(cells), [cells]);

  const range = useMemo(() => ({
    r1: Math.min(sel.r, anchor.r), r2: Math.max(sel.r, anchor.r),
    c1: Math.min(sel.c, anchor.c), c2: Math.max(sel.c, anchor.c),
  }), [sel, anchor]);
  const selectedRefs = useMemo(() => {
    const out = []; for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) out.push(rcToRef(r, c)); return out;
  }, [range]);
  const agg = useMemo(() => selectedRefs.length > 1 ? aggregateRefs(selectedRefs, ev) : null, [selectedRefs, ev]);

  // ── mutations ──────────────────────────────────────────────────────────
  const setCell = useCallback((ref, raw) => setData(d => {
    const c = { ...d.cells };
    if (raw === "" || raw == null) delete c[ref]; else c[ref] = raw;
    return { ...d, cells: c };
  }), []);
  const clearRefs = useCallback((refs) => setData(d => { const c = { ...d.cells }; refs.forEach(r => delete c[r]); return { ...d, cells: c }; }), []);
  const applyStyle = useCallback((mut) => setData(d => {
    const st = { ...d.styles };
    selectedRefs.forEach(ref => { st[ref] = mut({ ...(st[ref] || {}) }); });
    return { ...d, styles: st };
  }), [selectedRefs]);

  const ensureVisible = useCallback((r, c) => {
    const el = containerRef.current; if (!el) return;
    const x = HEADW + c * COLW, y = HEADH + r * ROWH;
    if (x < el.scrollLeft + HEADW) el.scrollLeft = x - HEADW;
    else if (x + COLW > el.scrollLeft + el.clientWidth) el.scrollLeft = x + COLW - el.clientWidth;
    if (y < el.scrollTop + HEADH) el.scrollTop = y - HEADH;
    else if (y + ROWH > el.scrollTop + el.clientHeight) el.scrollTop = y + ROWH - el.clientHeight;
  }, []);

  const moveSel = useCallback((dr, dc, extend) => {
    setSel(s => {
      const r = Math.max(0, Math.min(ROWS - 1, s.r + dr));
      const c = Math.max(0, Math.min(COLS - 1, s.c + dc));
      if (!extend) setAnchor({ r, c });
      ensureVisible(r, c);
      return { r, c };
    });
  }, [ROWS, ensureVisible]);

  const beginEdit = useCallback((r, c, init) => {
    const ref = rcToRef(r, c);
    setEdit({ ref, init: init !== undefined ? init : (cells[ref] || "") });
  }, [cells]);

  const commitEdit = useCallback((ref, value, move) => {
    setCell(ref, value);
    setEdit(null);
    if (move === "down") moveSel(1, 0, false);
    else if (move === "up") moveSel(-1, 0, false);
    else if (move === "right") moveSel(0, 1, false);
    else if (move === "left") moveSel(0, -1, false);
    requestAnimationFrame(() => containerRef.current?.focus());
  }, [setCell, moveSel]);

  // ── keyboard ─────────────────────────────────────────────────────────────
  const onKey = (e) => {
    if (edit) return;                       // CellInput owns keys while editing
    const k = e.key;
    if (k === "ArrowUp") { e.preventDefault(); moveSel(-1, 0, e.shiftKey); }
    else if (k === "ArrowDown") { e.preventDefault(); moveSel(1, 0, e.shiftKey); }
    else if (k === "ArrowLeft") { e.preventDefault(); moveSel(0, -1, e.shiftKey); }
    else if (k === "ArrowRight") { e.preventDefault(); moveSel(0, 1, e.shiftKey); }
    else if (k === "Tab") { e.preventDefault(); moveSel(0, e.shiftKey ? -1 : 1, false); }
    else if (k === "Enter" || k === "F2") { e.preventDefault(); beginEdit(sel.r, sel.c); }
    else if (k === "Backspace" || k === "Delete") { e.preventDefault(); clearRefs(selectedRefs); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); beginEdit(sel.r, sel.c, k); }
  };

  // ── mouse (event-delegated on tbody) ──────────────────────────────────────
  const cellFromEvent = (e) => { const td = e.target.closest?.("td[data-r]"); return td ? { r: +td.dataset.r, c: +td.dataset.c } : null; };
  const onDown = (e) => { const rc = cellFromEvent(e); if (!rc) return; dragRef.current = true; setAnchor(rc); setSel(rc); containerRef.current?.focus(); };
  const onOver = (e) => { if (!dragRef.current) return; const rc = cellFromEvent(e); if (rc) setSel(rc); };
  const onDbl = (e) => { const rc = cellFromEvent(e); if (rc) beginEdit(rc.r, rc.c); };

  // ── CSV ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    let maxR = -1, maxC = -1;
    for (const ref in cells) { const rc = refToRC(ref); if (rc) { maxR = Math.max(maxR, rc.r); maxC = Math.max(maxC, rc.c); } }
    if (maxR < 0) { showToast?.("Nothing to export"); return; }
    const esc = (s) => { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [];
    for (let r = 0; r <= maxR; r++) { const row = []; for (let c = 0; c <= maxC; c++) row.push(esc(ev.display(rcToRef(r, c)))); lines.push(row.join(",")); }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sheet.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  const importCSV = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const text = String(rd.result || ""); const rows = parseCSV(text);
      setData(d => {
        const c = { ...d.cells }; let maxR = d.rows;
        rows.forEach((row, r) => row.forEach((val, col) => { if (val !== "") c[rcToRef(r, col)] = val; if (r + 1 > maxR) maxR = r + 1; }));
        return { ...d, cells: c, rows: Math.max(d.rows, maxR + 5) };
      });
      showToast?.("CSV imported");
    };
    rd.readAsText(f); e.target.value = "";
  };

  // ── render ───────────────────────────────────────────────────────────────
  const cols = useMemo(() => Array.from({ length: COLS }, (_, i) => i), []);
  const rowList = useMemo(() => Array.from({ length: ROWS }, (_, i) => i), [ROWS]);
  const activeRef = rcToRef(sel.r, sel.c);
  const inRange = (r, c) => r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;

  const tBtn = (on) => ({ minWidth: 30, height: 28, borderRadius: 7, border: "1px solid " + C.line, background: on ? AC : "transparent", color: on ? "#fff" : C.text, cursor: "pointer", fontFamily: FFB, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px" });
  const selStyle = styles[activeRef] || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: FF, color: C.text, background: C.bg }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: "1px solid " + C.line, flexShrink: 0, flexWrap: "wrap" }}>
        <button style={{ ...tBtn(selStyle.b), fontFamily: "serif", fontWeight: 700 }} title="Bold" onClick={() => applyStyle(s => ({ ...s, b: !s.b }))}>B</button>
        <button style={{ ...tBtn(selStyle.i), fontStyle: "italic", fontFamily: "serif" }} title="Italic" onClick={() => applyStyle(s => ({ ...s, i: !s.i }))}>I</button>
        <span style={{ width: 1, height: 20, background: C.line, margin: "0 3px" }} />
        {[["l", "⬅"], ["c", "≡"], ["r", "➡"]].map(([a, g]) => <button key={a} style={tBtn(selStyle.a === a)} title={"Align " + a} onClick={() => applyStyle(s => ({ ...s, a }))}>{g}</button>)}
        <span style={{ width: 1, height: 20, background: C.line, margin: "0 3px" }} />
        <button style={tBtn(false)} title="Clear selected cells" onClick={() => clearRefs(selectedRefs)}>Clear</button>
        <div style={{ flex: 1 }} />
        <button style={tBtn(false)} onClick={() => fileRef.current?.click()}>Import CSV</button>
        <button style={tBtn(false)} onClick={exportCSV}>Export CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importCSV} style={{ display: "none" }} />
      </div>

      {/* formula bar */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, padding: "6px 10px", borderBottom: "1px solid " + C.line, flexShrink: 0 }}>
        <div style={{ minWidth: 54, display: "grid", placeItems: "center", border: "1px solid " + C.line, borderRadius: 7, fontFamily: FFB, fontSize: 13, color: C.dim }}>{activeRef}</div>
        <span style={{ display: "grid", placeItems: "center", color: C.dim, fontFamily: FFM, fontSize: 13 }}>ƒx</span>
        <FormulaBar key={activeRef} C={C} raw={cells[activeRef] || ""} onCommit={(v) => { setCell(activeRef, v); requestAnimationFrame(() => containerRef.current?.focus()); }} />
      </div>

      {/* grid */}
      <div ref={containerRef} tabIndex={0} onKeyDown={onKey} style={{ flex: 1, overflow: "auto", outline: "none" }}>
        <div style={{ position: "relative", width: HEADW + COLS * COLW, height: HEADH + ROWS * ROWH }}>
          <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: HEADW + COLS * COLW }}>
            <colgroup><col style={{ width: HEADW }} />{cols.map(c => <col key={c} style={{ width: COLW }} />)}</colgroup>
            <thead>
              <tr style={{ height: HEADH }}>
                <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: C.head, border: "1px solid " + C.line }} />
                {cols.map(c => (
                  <th key={c} style={{ position: "sticky", top: 0, zIndex: 2, background: (c >= range.c1 && c <= range.c2) ? C.headSel : C.head, border: "1px solid " + C.line, fontFamily: FFB, fontSize: 11.5, color: C.dim, fontWeight: 600 }}>{colName(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody onMouseDown={onDown} onMouseOver={onOver} onDoubleClick={onDbl}>
              {rowList.map(r => (
                <tr key={r} style={{ height: ROWH }}>
                  <th style={{ position: "sticky", left: 0, zIndex: 1, background: (r >= range.r1 && r <= range.r2) ? C.headSel : C.head, border: "1px solid " + C.line, fontFamily: FFB, fontSize: 11.5, color: C.dim, fontWeight: 600 }}>{r + 1}</th>
                  {cols.map(c => {
                    const ref = rcToRef(r, c);
                    const disp = ev.display(ref);
                    const v = ev.value(ref);
                    const st = styles[ref] || {};
                    const active = r === sel.r && c === sel.c;
                    const align = st.a || (typeof v === "number" ? "r" : "l");
                    const isErr = typeof disp === "string" && disp[0] === "#";
                    return (
                      <td key={c} data-r={r} data-c={c} style={{
                        border: "1px solid " + C.line, padding: "0 5px", overflow: "hidden", whiteSpace: "nowrap",
                        textOverflow: "ellipsis", fontSize: 12.5, cursor: "cell", userSelect: "none",
                        background: active ? C.bg : (inRange(r, c) ? C.selFill : C.bg),
                        textAlign: align === "r" ? "right" : align === "c" ? "center" : "left",
                        fontWeight: st.b ? 700 : 400, fontStyle: st.i ? "italic" : "normal",
                        color: isErr ? "#ef4444" : C.text,
                        boxShadow: active ? `inset 0 0 0 2px ${AC}` : "none",
                      }}>{edit && edit.ref === ref ? "" : disp}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {edit && (() => { const rc = refToRC(edit.ref); return (
            <CellInput key={edit.ref} init={edit.init} AC={AC} C={C}
              style={{ left: HEADW + rc.c * COLW, top: HEADH + rc.r * ROWH, width: COLW, height: ROWH }}
              onCommit={(val, mv) => commitEdit(edit.ref, val, mv)} onCancel={() => { setEdit(null); requestAnimationFrame(() => containerRef.current?.focus()); }} />
          ); })()}
        </div>
      </div>

      {/* status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "5px 12px", borderTop: "1px solid " + C.line, flexShrink: 0, fontSize: 12, color: C.dim, fontFamily: FFM }}>
        <span>{selectedRefs.length > 1 ? `${rcToRef(range.r1, range.c1)}:${rcToRef(range.r2, range.c2)}` : activeRef}</span>
        <div style={{ flex: 1 }} />
        {agg && agg.numCount > 0 && <><span>Sum: {agg.sum}</span><span>Avg: {agg.avg}</span></>}
        {agg && <span>Count: {agg.count}</span>}
        <button onClick={() => setData(d => ({ ...d, rows: d.rows + 30 }))} style={{ border: "1px solid " + C.line, background: "transparent", color: C.dim, borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontSize: 11.5, padding: "2px 9px" }}>+ 30 rows</button>
      </div>
    </div>
  );
}

// Isolated editor — owns its own input state so typing never re-renders the grid.
function CellInput({ init, AC, C, style, onCommit, onCancel }) {
  const [v, setV] = useState(init);
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); const L = el.value.length; el.setSelectionRange(L, L); } }, []);
  return (
    <input ref={ref} value={v} onChange={e => setV(e.target.value)} onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(v, "down"); }
        else if (e.key === "Tab") { e.preventDefault(); onCommit(v, e.shiftKey ? "left" : "right"); }
        else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        else e.stopPropagation();
      }}
      onBlur={() => onCommit(v, null)}
      style={{ position: "absolute", ...style, boxSizing: "border-box", border: `2px solid ${AC}`, borderRadius: 2, padding: "0 4px", fontFamily: FF, fontSize: 12.5, background: C.bg, color: C.text, outline: "none", zIndex: 5 }} />
  );
}

function FormulaBar({ C, raw, onCommit }) {
  const [v, setV] = useState(raw);
  useEffect(() => { setV(raw); }, [raw]);
  return (
    <input value={v} onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onCommit(v); } else if (e.key === "Escape") { setV(raw); e.currentTarget.blur(); } }}
      placeholder="Enter a value or =formula (e.g. =SUM(A1:A5))"
      style={{ flex: 1, border: "1px solid " + C.line, borderRadius: 7, padding: "6px 10px", fontFamily: FFM, fontSize: 13, background: "transparent", color: C.text, outline: "none" }} />
  );
}

// minimal RFC-4180-ish CSV parser (handles quotes + embedded commas/newlines)
function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false, i = 0; const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; } field += ch; i++; continue; }
    if (ch === '"') { q = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  row.push(field); rows.push(row);
  return rows;
}

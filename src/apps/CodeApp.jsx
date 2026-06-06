// Code — v11.0 Phase C. A "mini VS Code" for the user's own files: multi-tab
// editor with hand-rolled syntax highlighting (textarea + highlighted overlay,
// no external editor dependency), line numbers, auto-indent, tab-to-spaces,
// new/open/download, and a sandboxed live preview for HTML/CSS/JS. Files persist
// to localStorage. Edits the user's snippets — NOT Nova OS's own source.

import { useState, useRef, useMemo, useEffect } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";

let _id = 1;
const uid = () => "f" + (_id++) + Math.random().toString(36).slice(2, 5);
const LS = "nova-code-v1";

function langFromName(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) return "js";
  if (ext === "json") return "json";
  if (["html", "htm", "xml", "svg", "vue"].includes(ext)) return "html";
  if (["css", "scss", "less"].includes(ext)) return "css";
  if (["py", "pyw"].includes(ext)) return "py";
  if (["md", "markdown"].includes(ext)) return "md";
  return "txt";
}
const KW = (s) => new Set(s.split(/\s+/).filter(Boolean));
const LANGS = {
  js: { line: "//", block: ["/*", "*/"], kw: KW("const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of try catch finally throw async await yield import export from default null undefined true false void delete static get set") },
  css: { block: ["/*", "*/"], kw: KW("") },
  html: { html: true, block: ["<!--", "-->"], kw: KW("") },
  py: { line: "#", kw: KW("def class return if elif else for while import from as try except finally with lambda None True False and or not in is pass break continue global nonlocal yield raise assert del print self") },
  json: { kw: KW("true false null") },
  md: { kw: KW("") },
  txt: { kw: KW("") },
};
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Single-pass tokenizer → highlighted HTML. Robust against keywords-in-strings etc.
function highlight(code, lang) {
  const cfg = LANGS[lang] || LANGS.txt;
  let out = "", i = 0; const n = code.length;
  const span = (t, s) => `<span class="t-${t}">${esc(s)}</span>`;
  while (i < n) {
    const c = code[i];
    if (cfg.html && c === "<" && /[A-Za-z!\/]/.test(code[i + 1] || "")) {
      if (code.startsWith("<!--", i)) { let j = code.indexOf("-->", i); j = j < 0 ? n : j + 3; out += span("com", code.slice(i, j)); i = j; continue; }
      let j = code.indexOf(">", i); j = j < 0 ? n : j + 1; out += span("tag", code.slice(i, j)); i = j; continue;
    }
    if (cfg.line && code.startsWith(cfg.line, i)) { let j = code.indexOf("\n", i); if (j < 0) j = n; out += span("com", code.slice(i, j)); i = j; continue; }
    if (cfg.block && code.startsWith(cfg.block[0], i)) { let j = code.indexOf(cfg.block[1], i + cfg.block[0].length); j = j < 0 ? n : j + cfg.block[1].length; out += span("com", code.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'" || c === "`") { let j = i + 1; while (j < n) { if (code[j] === "\\") { j += 2; continue; } if (code[j] === c) { j++; break; } j++; } out += span("str", code.slice(i, j)); i = j; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || ""))) { let j = i; while (j < n && /[0-9a-fA-FxX._]/.test(code[j])) j++; out += span("num", code.slice(i, j)); i = j; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_$]/.test(code[j])) j++; const w = code.slice(i, j); out += cfg.kw.has(w) ? span("kw", w) : (/^[A-Z]/.test(w) ? span("type", w) : esc(w)); i = j; continue; }
    out += esc(c); i++;
  }
  return out;
}

function previewDoc(file) {
  if (!file) return "";
  if (file.lang === "html") return file.code;
  if (file.lang === "css") return `<!doctype html><meta charset=utf8><style>${file.code}</style><body style="font-family:system-ui;padding:24px;color:#888">Your CSS is applied to this page.</body>`;
  if (file.lang === "js") return `<!doctype html><meta charset=utf8><body style="font-family:ui-monospace,monospace;padding:16px;color:#0f0;background:#111;white-space:pre-wrap" id=o></body><script>(function(){var o=document.getElementById('o');var log=function(){o.textContent+=[].slice.call(arguments).join(' ')+"\\n";};console.log=log;console.error=log;console.warn=log;try{${file.code}\n}catch(e){o.style.color='#f66';log('Error: '+e.message);}})();<\/script>`;
  return `<!doctype html><body style="font-family:system-ui;padding:24px;color:#888">Live preview supports HTML, CSS and JS files. (This is a <b>${file ? file.lang : ""}</b> file.)</body>`;
}

const SAMPLE = `<!doctype html>
<html>
<head>
  <style>
    body { font-family: system-ui; display: grid; place-items: center; height: 100vh; margin: 0; background: #0e1018; color: #eee; }
    h1 { background: linear-gradient(90deg,#6366f1,#ec4899); -webkit-background-clip: text; color: transparent; }
  </style>
</head>
<body>
  <h1>Hello from Nova Code 👋</h1>
  <script>
    document.querySelector("h1").addEventListener("click", () => alert("It runs!"));
  <\/script>
</body>
</html>`;

export function CodeApp({ AC, showToast }) {
  const [{ files, activeId }, setState] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.files && s.files.length) { _id = (s.files.length + 2); return s; } } catch { /* */ }
    const id = uid();
    return { files: [{ id, name: "index.html", lang: "html", code: SAMPLE }], activeId: id };
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");
  const taRef = useRef(null), preRef = useRef(null), gutRef = useRef(null), fileRef = useRef(null);

  const active = files.find(f => f.id === activeId) || files[0];
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify({ files, activeId })); } catch { /* */ } }, [files, activeId]);

  const setFiles = (fn) => setState(s => ({ ...s, files: fn(s.files) }));
  const setActive = (id) => setState(s => ({ ...s, activeId: id }));
  const updateCode = (code) => setFiles(fs => fs.map(f => f.id === active.id ? { ...f, code } : f));

  function newFile() {
    const id = uid(); const name = "untitled-" + (files.length + 1) + ".js";
    setState(s => ({ files: [...s.files, { id, name, lang: "js", code: "" }], activeId: id }));
    setTimeout(() => taRef.current?.focus(), 0);
  }
  function closeFile(id) {
    setState(s => { const rest = s.files.filter(f => f.id !== id); if (!rest.length) { const nid = uid(); return { files: [{ id: nid, name: "untitled.js", lang: "js", code: "" }], activeId: nid }; } return { files: rest, activeId: s.activeId === id ? rest[rest.length - 1].id : s.activeId }; });
  }
  function renameActive() {
    const name = prompt("File name", active.name); if (!name) return;
    setFiles(fs => fs.map(f => f.id === active.id ? { ...f, name, lang: langFromName(name) } : f));
  }
  function openFiles(e) {
    const list = [...(e.target.files || [])]; e.target.value = "";
    list.forEach(file => { const r = new FileReader(); r.onload = () => { const id = uid(); setState(s => ({ files: [...s.files, { id, name: file.name, lang: langFromName(file.name), code: String(r.result || "") }], activeId: id })); }; r.readAsText(file); });
  }
  function download() {
    const blob = new Blob([active.code], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = active.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast?.("Saved " + active.name);
  }
  function run() { setPreviewSrc(previewDoc(active)); setShowPreview(true); }

  function onKey(e) {
    const ta = e.target;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); download(); return; }
    if (e.key === "Tab") { e.preventDefault(); ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end"); updateCode(ta.value); return; }
    if (e.key === "Enter") {
      const s = ta.selectionStart, ls = active.code.lastIndexOf("\n", s - 1) + 1;
      const indent = (active.code.slice(ls, s).match(/^[ \t]*/) || [""])[0];
      const extra = /[{([:]\s*$/.test(active.code.slice(ls, s)) ? "  " : "";
      e.preventDefault(); ta.setRangeText("\n" + indent + extra, s, ta.selectionEnd, "end"); updateCode(ta.value); return;
    }
  }
  function onScroll() { const ta = taRef.current; if (!ta) return; if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; } if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop; }

  const html = useMemo(() => highlight(active.code, active.lang), [active.code, active.lang]);
  const lineCount = useMemo(() => active.code.split("\n").length, [active.code]);

  const lightT = false; // editor stays dark (a code editor reads best dark); independent of OS theme
  const C = { bg: "#0e0f15", text: "#d4d4d4", gutter: "#6b7280", com: "#6a9955", str: "#ce9178", num: "#b5cea8", kw: "#569cd6", type: "#4ec9b0", tag: "#569cd6" };
  const metrics = { fontFamily: FFM, fontSize: 13, lineHeight: "20px", padding: "10px 12px", tabSize: 2, letterSpacing: 0, whiteSpace: "pre", border: "none", margin: 0, boxSizing: "border-box" };
  const tbtn = { padding: "6px 11px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#dfe3ee", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FF, background: C.bg, color: C.text }}>
      <style>{`.codehl .t-com{color:${C.com}}.codehl .t-str{color:${C.str}}.codehl .t-num{color:${C.num}}.codehl .t-kw{color:${C.kw};font-weight:600}.codehl .t-type{color:${C.type}}.codehl .t-tag{color:${C.tag}}`}</style>

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 13, marginRight: 2 }}>{"</>"} Code</span>
        <button style={tbtn} onClick={newFile}>＋ New</button>
        <button style={tbtn} onClick={() => fileRef.current?.click()}>↥ Open</button>
        <input ref={fileRef} type="file" multiple onChange={openFiles} style={{ display: "none" }} />
        <button style={tbtn} onClick={download}>⬇ Save</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, fontFamily: FFM, color: "#8b93a7", textTransform: "uppercase", letterSpacing: 0.5 }}>{active.lang}</span>
        <button style={{ ...tbtn, borderColor: AC, color: AC }} onClick={run}>▶ Run</button>
        <button style={{ ...tbtn, ...(showPreview ? { borderColor: AC, color: AC } : {}) }} onClick={() => setShowPreview(p => !p)}>{showPreview ? "Hide preview" : "Preview"}</button>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0b0c12", overflowX: "auto", flexShrink: 0 }}>
        {files.map(f => {
          const on = f.id === activeId;
          return (
            <div key={f.id} onClick={() => setActive(f.id)} onDoubleClick={f.id === activeId ? renameActive : undefined} title={on ? "Double-click to rename" : f.name}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", cursor: "pointer", borderRight: "1px solid rgba(255,255,255,0.06)", background: on ? C.bg : "transparent", color: on ? "#fff" : "#9aa3b5", borderTop: "2px solid " + (on ? AC : "transparent"), fontSize: 12, fontFamily: FFM, whiteSpace: "nowrap" }}>
              {f.name}
              <span onClick={(e) => { e.stopPropagation(); closeFile(f.id); }} style={{ opacity: 0.6, fontSize: 13, lineHeight: 1, padding: "0 2px" }}>×</span>
            </div>
          );
        })}
      </div>

      {/* editor + preview */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", position: "relative" }}>
          {/* gutter */}
          <div ref={gutRef} style={{ width: 48, flexShrink: 0, overflow: "hidden", background: "#0b0c12", borderRight: "1px solid rgba(255,255,255,0.06)", color: C.gutter, textAlign: "right", padding: "10px 8px 10px 0", fontFamily: FFM, fontSize: 13, lineHeight: "20px", userSelect: "none" }}>
            {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          {/* code area */}
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <pre ref={preRef} className="codehl" aria-hidden style={{ ...metrics, position: "absolute", inset: 0, overflow: "auto", pointerEvents: "none", color: C.text }} dangerouslySetInnerHTML={{ __html: html + "\n" }} />
            <textarea ref={taRef} value={active.code} onChange={e => updateCode(e.target.value)} onKeyDown={onKey} onScroll={onScroll}
              spellCheck="false" autoCapitalize="off" autoCorrect="off" wrap="off"
              style={{ ...metrics, position: "absolute", inset: 0, width: "100%", height: "100%", resize: "none", overflow: "auto", background: "transparent", color: "transparent", caretColor: "#fff", outline: "none" }} />
          </div>
        </div>
        {showPreview && (
          <div style={{ width: "42%", minWidth: 240, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", background: "#0b0c12", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
              <span style={{ fontSize: 10.5, color: "#8b93a7", fontFamily: FFB, fontWeight: 700, letterSpacing: 0.5 }}>PREVIEW</span>
              <div style={{ flex: 1 }} />
              <button style={{ ...tbtn, padding: "3px 9px", fontSize: 11 }} onClick={run}>↻ Refresh</button>
            </div>
            <iframe title="preview" sandbox="allow-scripts allow-modals" srcDoc={previewSrc} style={{ flex: 1, border: "none", background: "#fff" }} />
          </div>
        )}
      </div>
    </div>
  );
}

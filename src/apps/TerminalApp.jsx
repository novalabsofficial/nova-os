// v10.0 Supernova — sandboxed shell.
//
// A real command interpreter over a virtual filesystem (lib/vfs.js). Every
// command operates on a self-contained, per-user tree persisted in
// localStorage — it never touches the real machine, so it's safe to poke at
// even on the Tauri desktop build.
//
// Supports cd/ls/pwd/cat/mkdir/touch/rm/mv/cp/echo (+ > and >> redirection)/
// tree/find/history/clear, info commands, `open` to launch Nova apps, plus
// command history (↑/↓) and Tab completion for commands and paths.

import { useState, useEffect, useRef } from "react";
import { FFM } from "../ui/styles.js";
import { NOVA_VERSION, APPS } from "../ui/constants.js";
import { loadFS, saveFS, clearFS, defaultFS, resolve, getNode, getParent, pathStr, prettyPath, homeSegs } from "../lib/vfs.js";

const NOVA_ART = [
  " ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ",
  " ████╗  ██║██╔═══██╗██║   ██║██╔══██╗",
  " ██╔██╗ ██║██║   ██║██║   ██║███████║",
  " ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║",
  " ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║",
  " ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝",
];

const HELP = [
  ["ls [path]", "list directory contents"],
  ["cd <path>", "change directory ( .. ~ / supported )"],
  ["pwd", "print working directory"],
  ["cat <file>", "print a file"],
  ["mkdir <dir>", "create a directory"],
  ["touch <file>", "create an empty file"],
  ["echo <text>", "print text — use > file or >> file to write"],
  ["rm [-r] <path>", "remove a file or directory"],
  ["mv <src> <dst>", "move / rename"],
  ["cp <src> <dst>", "copy"],
  ["tree [path]", "show the directory tree"],
  ["find <name>", "search for files/dirs by name"],
  ["open <app>", "launch a Nova OS app"],
  ["history", "show command history"],
  ["clear", "clear the screen"],
  ["sysinfo / neofetch", "system info"],
  ["whoami / date / version", "misc info"],
  ["reset", "wipe the sandbox filesystem"],
  ["man <cmd>", "show usage for a command"],
];

export function TerminalApp({ user, AC, openApp, showToast }) {
  const rootRef = useRef(null);
  if (rootRef.current === null) rootRef.current = loadFS(user);
  const [cwd, setCwd] = useState(() => homeSegs(user));
  const cwdRef = useRef(cwd); cwdRef.current = cwd;
  const [lines, setLines] = useState(() => ([
    { t: "out", v: "Nova Shell (nsh) — v" + NOVA_VERSION + " · sandboxed" },
    { t: "out", v: "Session: " + user + " · " + new Date().toLocaleString() },
    { t: "out", v: 'Type "help" for commands. Files persist per user.' },
    { t: "gap" },
  ]));
  const [cmd, setCmd] = useState("");
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const save = () => saveFS(user, rootRef.current);
  const out = (acc, v) => acc.push({ t: "out", v });
  const err = (acc, v) => acc.push({ t: "err", v });

  // ── command implementations ──────────────────────────────────────────────
  function exec(raw, acc) {
    const root = rootRef.current;
    const cwd = cwdRef.current;
    // split off a redirection (> / >>) for echo-style writes
    let redir = null;
    const rm = raw.match(/\s(>>?)\s*(\S+)\s*$/);
    let body = raw;
    if (rm) { redir = { append: rm[1] === ">>", target: rm[2] }; body = raw.slice(0, rm.index); }
    const parts = body.trim().split(/\s+/);
    const c = (parts[0] || "").toLowerCase();
    const args = parts.slice(1);
    const flags = args.filter(a => a.startsWith("-"));
    const ops = args.filter(a => !a.startsWith("-"));

    const writeTo = (text) => {
      const segs = resolve(cwd, redir.target, user);
      const pinfo = segs && getParent(root, segs);
      if (!pinfo) { err(acc, "cannot write: " + redir.target); return; }
      const ex = pinfo.parent.children[pinfo.name];
      if (ex && ex.type === "dir") { err(acc, redir.target + ": is a directory"); return; }
      const prev = redir.append && ex && ex.type === "file" ? ex.content : "";
      pinfo.parent.children[pinfo.name] = { type: "file", content: prev + text + "\n" };
      save();
    };

    switch (c) {
      case "": return;
      case "help":
        out(acc, "Nova Shell commands:");
        HELP.forEach(([cmd, desc]) => out(acc, "  " + cmd.padEnd(22) + desc));
        return;
      case "pwd": out(acc, pathStr(cwd)); return;
      case "whoami": out(acc, user); return;
      case "date": out(acc, new Date().toLocaleString()); return;
      case "version": out(acc, "Nova OS v" + NOVA_VERSION + " — Nova Systems"); return;
      case "echo": {
        const full = body.trim().slice(4).trim(); // everything after "echo"
        if (redir) writeTo(full); else out(acc, full || "");
        return;
      }
      case "clear": case "cls": return "__clear__";
      case "ls": case "dir": {
        const segs = resolve(cwd, ops[0] || ".", user);
        const node = segs && getNode(root, segs);
        if (!node) { err(acc, "ls: " + (ops[0] || ".") + ": no such file or directory"); return; }
        if (node.type === "file") { out(acc, ops[0]); return; }
        const showAll = flags.includes("-a");
        const names = Object.keys(node.children).sort();
        const list = (showAll ? [".", ".."] : []).concat(names);
        if (list.length === 0) { out(acc, ""); return; }
        if (flags.includes("-l")) {
          list.forEach(n => {
            const ch = n === "." || n === ".." ? { type: "dir" } : node.children[n];
            out(acc, (ch.type === "dir" ? "d " : "- ") + n + (ch.type === "dir" ? "/" : ""));
          });
        } else {
          out(acc, list.map(n => {
            const ch = n === "." || n === ".." ? { type: "dir" } : node.children[n];
            return ch.type === "dir" ? n + "/" : n;
          }).join("   "));
        }
        return;
      }
      case "cd": {
        const target = ops[0] || "~";
        const segs = resolve(cwd, target, user);
        const node = segs && getNode(root, segs);
        if (!node) { err(acc, "cd: " + target + ": no such file or directory"); return; }
        if (node.type !== "dir") { err(acc, "cd: " + target + ": not a directory"); return; }
        setCwd(segs);
        return;
      }
      case "cat": {
        if (!ops.length) { err(acc, "usage: cat <file>"); return; }
        ops.forEach(p => {
          const segs = resolve(cwd, p, user);
          const node = segs && getNode(root, segs);
          if (!node) err(acc, "cat: " + p + ": no such file or directory");
          else if (node.type === "dir") err(acc, "cat: " + p + ": is a directory");
          else node.content.replace(/\n$/, "").split("\n").forEach(l => out(acc, l));
        });
        return;
      }
      case "mkdir": {
        if (!ops.length) { err(acc, "usage: mkdir <dir>"); return; }
        ops.forEach(p => {
          const segs = resolve(cwd, p, user);
          const pinfo = segs && getParent(root, segs);
          if (!pinfo) { err(acc, "mkdir: " + p + ": invalid path"); return; }
          if (pinfo.parent.children[pinfo.name]) { err(acc, "mkdir: " + p + ": already exists"); return; }
          pinfo.parent.children[pinfo.name] = { type: "dir", children: {} };
        });
        save();
        return;
      }
      case "touch": {
        if (!ops.length) { err(acc, "usage: touch <file>"); return; }
        ops.forEach(p => {
          const segs = resolve(cwd, p, user);
          const pinfo = segs && getParent(root, segs);
          if (!pinfo) { err(acc, "touch: " + p + ": invalid path"); return; }
          if (!pinfo.parent.children[pinfo.name]) pinfo.parent.children[pinfo.name] = { type: "file", content: "" };
        });
        save();
        return;
      }
      case "rm": {
        if (!ops.length) { err(acc, "usage: rm [-r] <path>"); return; }
        const recursive = flags.includes("-r") || flags.includes("-rf");
        ops.forEach(p => {
          const segs = resolve(cwd, p, user);
          const pinfo = segs && getParent(root, segs);
          const node = segs && getNode(root, segs);
          if (!pinfo || !node) { err(acc, "rm: " + p + ": no such file or directory"); return; }
          if (node.type === "dir" && Object.keys(node.children).length && !recursive) { err(acc, "rm: " + p + ": is a directory (use -r)"); return; }
          delete pinfo.parent.children[pinfo.name];
        });
        save();
        return;
      }
      case "mv": case "cp": {
        if (ops.length < 2) { err(acc, "usage: " + c + " <src> <dst>"); return; }
        const sSegs = resolve(cwd, ops[0], user);
        const sNode = sSegs && getNode(root, sSegs);
        if (!sNode) { err(acc, c + ": " + ops[0] + ": no such file or directory"); return; }
        let dSegs = resolve(cwd, ops[1], user);
        const dNode = dSegs && getNode(root, dSegs);
        if (dNode && dNode.type === "dir") dSegs = [...dSegs, sSegs[sSegs.length - 1]]; // into dir
        const dInfo = dSegs && getParent(root, dSegs);
        if (!dInfo) { err(acc, c + ": " + ops[1] + ": invalid destination"); return; }
        dInfo.parent.children[dInfo.name] = JSON.parse(JSON.stringify(sNode));
        if (c === "mv") { const sInfo = getParent(root, sSegs); delete sInfo.parent.children[sInfo.name]; }
        save();
        return;
      }
      case "tree": {
        const segs = resolve(cwd, ops[0] || ".", user);
        const node = segs && getNode(root, segs);
        if (!node || node.type !== "dir") { err(acc, "tree: " + (ops[0] || ".") + ": not a directory"); return; }
        out(acc, prettyPath(segs, user) || "/");
        const walk = (n, prefix) => {
          const keys = Object.keys(n.children).sort();
          keys.forEach((k, i) => {
            const last = i === keys.length - 1;
            const ch = n.children[k];
            out(acc, prefix + (last ? "└─ " : "├─ ") + k + (ch.type === "dir" ? "/" : ""));
            if (ch.type === "dir") walk(ch, prefix + (last ? "   " : "│  "));
          });
        };
        walk(node, "");
        return;
      }
      case "find": {
        if (!ops.length) { err(acc, "usage: find <name>"); return; }
        const needle = ops[0].toLowerCase();
        const base = resolve(cwd, ".", user);
        const node = getNode(root, base);
        let found = 0;
        const walk = (n, segs) => {
          Object.keys(n.children).forEach(k => {
            const childSegs = [...segs, k];
            if (k.toLowerCase().includes(needle)) { out(acc, pathStr(childSegs)); found++; }
            if (n.children[k].type === "dir") walk(n.children[k], childSegs);
          });
        };
        if (node?.type === "dir") walk(node, base);
        if (!found) out(acc, "(no matches)");
        return;
      }
      case "history":
        if (!hist.length) out(acc, "(empty)");
        else [...hist].reverse().forEach((h, i) => out(acc, String(i + 1).padStart(3) + "  " + h));
        return;
      case "open": {
        const id = (ops[0] || "").toLowerCase();
        const app = APPS.find(a => a.id === id);
        if (!app) { err(acc, "open: unknown app '" + (ops[0] || "") + "'. Try: " + APPS.slice(0, 8).map(a => a.id).join(", ") + "…"); return; }
        openApp?.(id);
        out(acc, "Opening " + app.label + "…");
        return;
      }
      case "sysinfo":
        out(acc, "OS:         Nova OS v" + NOVA_VERSION);
        out(acc, "Shell:      nsh (sandboxed)");
        out(acc, "Host:       " + (("__TAURI_INTERNALS__" in window) ? "Tauri desktop" : "Web"));
        out(acc, "Resolution: " + window.innerWidth + "x" + window.innerHeight);
        out(acc, "Uptime:     " + Math.floor(performance.now() / 1000) + "s");
        return;
      case "neofetch": {
        const info = ["", "OS: Nova OS v" + NOVA_VERSION, "User: " + user, "Shell: nsh", "Host: " + (("__TAURI_INTERNALS__" in window) ? "Tauri" : "Web"), "", "Type 'help' for commands."];
        NOVA_ART.forEach((l, i) => out(acc, l + "   " + (info[i] || "")));
        return;
      }
      case "about":
        out(acc, "Nova OS — a browser-based desktop OS.");
        out(acc, "This terminal is a sandbox: its filesystem is virtual and");
        out(acc, "isolated. Nothing here can affect your real machine.");
        return;
      case "reset":
        rootRef.current = defaultFS(user);
        clearFS(user); save();
        setCwd(homeSegs(user));
        out(acc, "Filesystem reset to defaults.");
        return;
      case "man": {
        const m = HELP.find(h => h[0].split(" ")[0] === (ops[0] || ""));
        if (m) out(acc, m[0] + "  —  " + m[1]);
        else err(acc, "man: no entry for '" + (ops[0] || "") + "'");
        return;
      }
      default:
        err(acc, c + ": command not found. Type 'help'.");
    }
  }

  function run() {
    const raw = cmd.trim();
    setCmd(""); setHIdx(-1);
    const prompt = promptStr();
    if (!raw) { setLines(ls => [...ls, { t: "in", p: prompt, v: "" }]); return; }
    setHist(h => [raw, ...h]);
    const acc = [{ t: "in", p: prompt, v: raw }];
    const signal = exec(raw, acc);
    if (signal === "__clear__") { setLines([]); return; }
    acc.push({ t: "gap" });
    setLines(ls => [...ls, ...acc]);
  }

  // ── Tab completion (commands + paths) ─────────────────────────────────────
  function complete() {
    const tokens = cmd.split(/(\s+)/);              // keep separators
    const lastTok = cmd.split(/\s+/).pop() || "";
    const isFirst = cmd.trim().split(/\s+/).length <= 1 && !/\s$/.test(cmd);
    let candidates = [];
    if (isFirst) {
      const cmds = ["help", "ls", "cd", "pwd", "cat", "mkdir", "touch", "echo", "rm", "mv", "cp", "tree", "find", "open", "history", "clear", "sysinfo", "neofetch", "whoami", "date", "version", "about", "reset", "man"];
      candidates = cmds.filter(x => x.startsWith(lastTok));
      if (candidates.length === 1) { setCmd(candidates[0] + " "); return; }
    } else {
      const slash = lastTok.lastIndexOf("/");
      const dirPart = slash >= 0 ? lastTok.slice(0, slash + 1) : "";
      const base = slash >= 0 ? lastTok.slice(slash + 1) : lastTok;
      const segs = resolve(cwdRef.current, dirPart || ".", user);
      const node = segs && getNode(rootRef.current, segs);
      if (node?.type === "dir") {
        const names = Object.keys(node.children).filter(n => n.startsWith(base));
        if (names.length === 1) {
          const ch = node.children[names[0]];
          const completed = dirPart + names[0] + (ch.type === "dir" ? "/" : "");
          setCmd(cmd.slice(0, cmd.length - lastTok.length) + completed);
          return;
        }
        candidates = names;
      }
    }
    if (candidates.length > 1) {
      setLines(ls => [...ls, { t: "in", p: promptStr(), v: cmd }, { t: "out", v: candidates.join("   ") }, { t: "gap" }]);
    }
    void tokens;
  }

  function onKey(e) {
    if (e.key === "Enter") { e.preventDefault(); run(); return; }
    if (e.key === "Tab") { e.preventDefault(); complete(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); const i = Math.min(hIdx + 1, hist.length - 1); setHIdx(i); if (hist[i] != null) setCmd(hist[i]); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); const i = Math.max(hIdx - 1, -1); setHIdx(i); setCmd(i === -1 ? "" : (hist[i] || "")); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")) { e.preventDefault(); setLines([]); return; }
    if (e.ctrlKey && (e.key === "c" || e.key === "C") && !window.getSelection()?.toString()) {
      e.preventDefault();
      setLines(ls => [...ls, { t: "in", p: promptStr(), v: cmd + "^C" }]); setCmd("");
    }
  }

  function promptStr() { return user + "@nova:" + prettyPath(cwdRef.current, user) + "$"; }

  return (
    <div onClick={() => inputRef.current?.focus()}
      style={{ width: "100%", height: "100%", fontFamily: FFM, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#04050a", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: l.t === "gap" ? 6 : 1, minHeight: l.t === "gap" ? 2 : undefined, whiteSpace: "pre-wrap", wordBreak: "break-word", color: l.t === "err" ? "#ff7b7b" : "rgba(176,204,255,0.62)" }}>
            {l.t === "in" ? <><span style={{ color: "#4cef90" }}>{l.p} </span><span style={{ color: "#e8eeff" }}>{l.v}</span></> : l.t === "gap" ? null : l.v}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: "#4cef90", fontSize: 12.5, flexShrink: 0 }}>{promptStr()}&nbsp;</span>
          <input ref={inputRef} value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={onKey} autoFocus spellCheck={false} autoComplete="off"
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#e8eeff", fontFamily: FFM, fontSize: 12.5, caretColor: AC }} />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

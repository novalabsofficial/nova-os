// v10.0 Supernova — virtual filesystem for the sandboxed terminal.
//
// A self-contained, in-memory Unix-ish tree persisted per-user in
// localStorage. It is a SANDBOX: it never touches the real machine's files
// (even on the Tauri desktop build) — it's a safe playground that lives
// entirely inside Nova OS.
//
// Node shape:
//   dir : { type:"dir",  children: { <name>: node, ... } }
//   file: { type:"file", content: "<string>" }

import { NOVA_VERSION } from "../ui/constants.js";

const KEY = (user) => "nova-vfs:" + (user || "guest");

export function defaultFS(user) {
  return {
    type: "dir",
    children: {
      home: {
        type: "dir",
        children: {
          [user]: {
            type: "dir",
            children: {
              "welcome.txt": { type: "file", content:
                "Welcome to the Nova sandbox shell.\n\n" +
                "This is a safe, self-contained filesystem — nothing here touches\n" +
                "your real computer. Poke around, make files, break things.\n\n" +
                "Try:  ls   cd projects   cat ../etc/nova.conf   tree   help\n" },
              "readme.md": { type: "file", content:
                "# Nova Sandbox\n\nA tiny Unix-like shell living inside Nova OS.\n" +
                "Files persist between sessions (per user). Run `reset` to wipe.\n" },
              projects: { type: "dir", children: {
                "hello.txt": { type: "file", content: "echo hello, world\n" },
              } },
              notes: { type: "dir", children: {} },
            },
          },
        },
      },
      etc: {
        type: "dir",
        children: {
          "nova.conf": { type: "file", content: "os=Nova OS\nversion=" + NOVA_VERSION + "\nshell=nsh\n" },
          "motd": { type: "file", content: "Have a stellar day. ✨\n" },
        },
      },
      bin: { type: "dir", children: {} },
    },
  };
}

export function loadFS(user) {
  try {
    const raw = localStorage.getItem(KEY(user));
    if (raw) {
      const fs = JSON.parse(raw);
      if (fs && fs.type === "dir") return fs;
    }
  } catch {}
  return defaultFS(user);
}
export function saveFS(user, root) {
  try { localStorage.setItem(KEY(user), JSON.stringify(root)); } catch {}
}
export function clearFS(user) {
  try { localStorage.removeItem(KEY(user)); } catch {}
}

export function homeSegs(user) { return ["home", user]; }

/** Resolve a path string (relative to cwd) into normalised segments, or null
 *  if it tries to escape root. `~` expands to the user's home. */
export function resolve(cwd, path, user) {
  let segs;
  if (!path || path === ".") segs = [...cwd];
  else if (path === "~" || path === "~/") segs = homeSegs(user);
  else if (path.startsWith("~/")) segs = [...homeSegs(user), ...path.slice(2).split("/")];
  else if (path.startsWith("/")) segs = path.split("/");
  else segs = [...cwd, ...path.split("/")];
  const out = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") { if (out.length === 0) return null; out.pop(); }
    else out.push(s);
  }
  return out;
}

export function getNode(root, segs) {
  let node = root;
  for (const s of segs) {
    if (node.type !== "dir" || !node.children[s]) return null;
    node = node.children[s];
  }
  return node;
}

/** Get the parent dir node + the final name for a path (for create/remove). */
export function getParent(root, segs) {
  if (segs.length === 0) return null;
  const parent = getNode(root, segs.slice(0, -1));
  if (!parent || parent.type !== "dir") return null;
  return { parent, name: segs[segs.length - 1] };
}

export function pathStr(segs) { return "/" + segs.join("/"); }

/** Pretty cwd for the prompt: home → ~. */
export function prettyPath(segs, user) {
  const h = homeSegs(user);
  if (segs.length >= h.length && h.every((s, i) => segs[i] === s)) {
    const rest = segs.slice(h.length);
    return "~" + (rest.length ? "/" + rest.join("/") : "");
  }
  return pathStr(segs);
}

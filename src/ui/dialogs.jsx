// v11.0 — Unified dialogs (imperative). Replaces the browser's native
// confirm() / alert() / prompt() — which look nothing like Nova and shatter
// the "real OS" illusion — with promise-based functions that render through
// the <Dialog> design-system primitive. Usable from anywhere:
//
//   if (await novaConfirm({ message: "Delete this?", danger: true })) { ... }
//   await novaAlert({ message: "Saved." });
//   const name = await novaPrompt({ message: "New name:" });   // string | null
//
// Each call mounts a temporary React root on document.body and tears it down
// when the user responds, so there's no provider to wire up.
import { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, Button } from "./primitives.jsx";
import { INP, DEFAULT_AC } from "./styles.js";

function mount(renderFn) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => setTimeout(() => { try { root.unmount(); host.remove(); } catch (e) {} }, 0);
  root.render(renderFn(close));
}

function useKeys(onEnter, onEsc) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onEsc && onEsc(); }
      else if (e.key === "Enter" && !(e.target && e.target.tagName === "TEXTAREA")) { e.preventDefault(); onEnter && onEnter(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
}

const bodyText = (message) =>
  message ? <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--nv-text)", whiteSpace: "pre-wrap" }}>{message}</div> : null;

export function novaConfirm(opts = {}) {
  return new Promise((resolve) => mount((close) => <ConfirmBox {...opts} onDone={(v) => { close(); resolve(v); }} />));
}
export function novaAlert(opts = {}) {
  return new Promise((resolve) => mount((close) => <AlertBox {...opts} onDone={() => { close(); resolve(); }} />));
}
export function novaPrompt(opts = {}) {
  return new Promise((resolve) => mount((close) => <PromptBox {...opts} onDone={(v) => { close(); resolve(v); }} />));
}

function ConfirmBox({ title = "Are you sure?", message, confirmText = "Confirm", cancelText = "Cancel", danger = false, icon, accent = DEFAULT_AC, onDone }) {
  useKeys(() => onDone(true), () => onDone(false));
  return (
    <Dialog open onClose={() => onDone(false)} title={title} icon={icon || (danger ? "⚠️" : undefined)} accent={accent} width={400}
      footer={<>
        <Button variant="ghost" onClick={() => onDone(false)}>{cancelText}</Button>
        <Button variant={danger ? "danger" : "primary"} accent={accent} onClick={() => onDone(true)}>{confirmText}</Button>
      </>}>
      {bodyText(message)}
    </Dialog>
  );
}

function AlertBox({ title = "Notice", message, okText = "OK", icon, accent = DEFAULT_AC, onDone }) {
  useKeys(() => onDone(), () => onDone());
  return (
    <Dialog open onClose={() => onDone()} title={title} icon={icon} accent={accent} width={400}
      footer={<Button variant="primary" accent={accent} onClick={() => onDone()}>{okText}</Button>}>
      {bodyText(message)}
    </Dialog>
  );
}

function PromptBox({ title, message, placeholder = "", defaultValue = "", confirmText = "OK", cancelText = "Cancel", accent = DEFAULT_AC, onDone }) {
  const [val, setVal] = useState(defaultValue);
  const ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => ref.current && ref.current.focus(), 30); return () => clearTimeout(t); }, []);
  return (
    <Dialog open onClose={() => onDone(null)} title={title || "Enter a value"} accent={accent} width={420}
      footer={<>
        <Button variant="ghost" onClick={() => onDone(null)}>{cancelText}</Button>
        <Button variant="primary" accent={accent} onClick={() => onDone(val)}>{confirmText}</Button>
      </>}>
      {message && <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--nv-text)", marginBottom: 12 }}>{message}</div>}
      <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") onDone(val); if (e.key === "Escape") onDone(null); }}
        style={{ ...INP }} />
    </Dialog>
  );
}

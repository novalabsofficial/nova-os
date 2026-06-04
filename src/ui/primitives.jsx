// v11.0 — Design-system primitives.
//
// Reusable, token-driven building blocks so every app renders the same buttons,
// panels, fields, labels and dialogs instead of hand-rolling each one. Built on
// the tokens in styles.js (SPACE / RADIUS / TYPE / EASE / DUR / Z / STATUS).
//
// Migration is incremental: new code uses these directly; existing apps get
// moved over batch by batch. Adopting <Dialog> also advances the "unified
// dialogs" goal (one modal pattern, replacing ad-hoc per-app overlays and the
// browser's native confirm/alert).
import { FF, FFB, FFM, RADIUS, TYPE, SPACE, EASE, DUR, Z, STATUS, SHADOW_DEEP, DEFAULT_AC, tx } from "./styles.js";
import { fill, bdr } from "../lib/format.js";

// ── Button ───────────────────────────────────────────────────────────────
// variant: primary | accent | secondary | ghost | danger   size: sm | md | lg
export function Button({ variant = "secondary", size = "md", accent = DEFAULT_AC, icon, children, style, ...rest }) {
  const pad = size === "sm" ? "6px 12px" : size === "lg" ? "11px 22px" : "9px 16px";
  const fs = size === "sm" ? 12.5 : size === "lg" ? 15 : 13.5;
  const variants = {
    primary:   { background: accent, color: "#fff", borderColor: accent },
    accent:    { background: fill(accent), color: accent, borderColor: bdr(accent) },
    secondary: { background: "var(--nv-elevated)", color: "var(--nv-text-strong)", borderColor: "var(--nv-border)" },
    ghost:     { background: "transparent", color: "var(--nv-text)", borderColor: "transparent" },
    danger:    { background: "rgba(255,107,107,0.14)", color: STATUS.danger, borderColor: "rgba(255,107,107,0.4)" },
  };
  return (
    <button className="nv-btn" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: SPACE[2],
      padding: pad, borderRadius: RADIUS.md, fontFamily: FFB, fontWeight: 600, fontSize: fs,
      cursor: "pointer", border: "1px solid transparent", lineHeight: 1, whiteSpace: "nowrap",
      transition: tx("background", "border-color", "transform", "filter"),
      ...(variants[variant] || variants.secondary), ...style,
    }} {...rest}>
      {icon && <span style={{ fontSize: "1.05em", lineHeight: 1 }}>{icon}</span>}
      {children}
    </button>
  );
}

// ── IconButton — square, icon-only ─────────────────────────────────────────
export function IconButton({ size = 34, accent = DEFAULT_AC, active = false, title, children, style, ...rest }) {
  return (
    <button title={title} className="nv-btn" style={{
      width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: RADIUS.sm, cursor: "pointer", fontSize: Math.round(size * 0.42), padding: 0,
      border: "1px solid " + (active ? bdr(accent) : "var(--nv-border)"),
      background: active ? fill(accent) : "var(--nv-elevated)", color: active ? accent : "var(--nv-text)",
      transition: tx("background", "border-color", "transform"), ...style,
    }} {...rest}>{children}</button>
  );
}

// ── Panel / Card — standard surface container ───────────────────────────────
export function Panel({ pad = SPACE[4], children, style, ...rest }) {
  return (
    <div style={{ background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: RADIUS.lg, padding: pad, ...style }} {...rest}>
      {children}
    </div>
  );
}

// ── SectionLabel — small all-caps section header ────────────────────────────
export function SectionLabel({ children, style }) {
  return <div style={{ ...TYPE.label, color: "var(--nv-text-dim)", marginBottom: SPACE[3], ...style }}>{children}</div>;
}

// ── Field — labeled control wrapper ─────────────────────────────────────────
export function Field({ label, children, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2], ...style }}>
      {label && <span style={{ ...TYPE.label, color: "var(--nv-text-dim)" }}>{label}</span>}
      {children}
    </div>
  );
}

// ── Dialog — the one modal pattern. Fixed overlay + glass panel + optional
// header (icon + title + close) and footer. Click-outside / ✕ closes. ──────
export function Dialog({ open, onClose, title, icon, accent = DEFAULT_AC, footer, width = 420, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: Z.modal, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        width: "100%", maxWidth: width, maxHeight: "86%", overflowY: "auto",
        background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: RADIUS.xl,
        boxShadow: SHADOW_DEEP, fontFamily: FF, animation: "pop-in " + DUR.base + "ms " + EASE.out,
      }}>
        {title != null && (
          <div style={{ display: "flex", alignItems: "center", gap: SPACE[2], padding: "16px 18px", borderBottom: "1px solid var(--nv-border)" }}>
            {icon && <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>}
            <div style={{ ...TYPE.heading, color: "var(--nv-text-strong)", flex: 1, minWidth: 0 }}>{title}</div>
            <IconButton size={30} accent={accent} onClick={onClose} title="Close">✕</IconButton>
          </div>
        )}
        <div style={{ padding: 18 }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: SPACE[2], padding: "0 18px 18px" }}>{footer}</div>}
      </div>
    </div>
  );
}

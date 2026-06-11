// Reusable right-click / long-press context menu. Floats at (x, y) screen
// coords with auto-edge-clamping so it never overflows the viewport. Closes
// on outside click or Escape. Touch users get this via the browser's
// onContextMenu translation of long-press.

import { useEffect, useRef } from "react";
import { FF, FFM } from "./styles.js";

export function ContextMenu({ x, y, items, onClose, AC }) {
  const ref = useRef(null);
  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    function onEsc(e)  { if (e.key === "Escape") onClose(); }
    // Delay so the click that opened the menu doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    document.addEventListener("keydown", onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  // v8.0 — slightly wider for tidier item layout, richer glass effect,
  // multi-layer shadow, larger border radius (matches the new chrome).
  const W = 210;
  const H = items.reduce((acc, i) => acc + (i.type === "divider" ? 9 : 36), 14);
  const ax = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const ay = Math.max(8, Math.min(y, window.innerHeight - H - 8));

  return (
    <div ref={ref} style={{
      position: "fixed", left: ax, top: ay, width: W, zIndex: 99999,
      background: "var(--nv-surface-solid)",
      backdropFilter: "blur(32px) saturate(180%)",
      WebkitBackdropFilter: "blur(32px) saturate(180%)",
      border: "1px solid var(--nv-border)",
      borderRadius: 10,
      boxShadow: "var(--nv-popover-shadow)",
      padding: "5px 6px",
      animation: "menu-up 0.16s cubic-bezier(0.16,1,0.3,1)",
      fontFamily: FF,
    }}>
      {items.map((it, i) => {
        if (it.type === "divider") {
          return <div key={i} style={{height: 1, background: "var(--nv-border)", margin: "5px 8px"}}/>;
        }
        const danger = !!it.danger;
        const disabled = !!it.disabled;
        return (
          <div key={i}
            onClick={disabled ? undefined : () => { try { it.onClick(); } catch {} onClose(); }}
            style={{
              padding: "7px 11px", borderRadius: 6, cursor: disabled ? "default" : "pointer",
              fontSize: 13, fontWeight: 500,
              color: disabled ? "var(--nv-text-dim)" : danger ? "var(--nv-danger, rgba(229,72,77,0.95))" : "var(--nv-text-strong)",
              display: "flex", alignItems: "center", gap: 10, opacity: disabled ? 0.5 : 1,
              transition: "background 0.15s, color 0.15s",
              letterSpacing: 0.1,
            }}
            onPointerEnter={e => {
              if (disabled) return;
              // macOS-style: the whole row fills with a solid accent (or red) and
              // the text/icon go white on hover — not a subtle tint.
              e.currentTarget.style.background = danger ? "rgba(229,72,77,0.95)" : (AC || "#4f9eff");
              e.currentTarget.style.color = "#fff";
            }}
            onPointerLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = danger ? "var(--nv-danger, rgba(229,72,77,0.95))" : "var(--nv-text-strong)";
            }}>
            {it.icon && <span style={{width: 18, textAlign: "center", fontSize: 13, opacity: 0.9, flexShrink: 0}}>{it.icon}</span>}
            <span style={{flex: 1}}>{it.label}</span>
            {it.shortcut && <span style={{fontSize: 10, fontFamily: FFM, color: "inherit", opacity: 0.6, letterSpacing: 0.2}}>{it.shortcut}</span>}
          </div>
        );
      })}
    </div>
  );
}

// Tiny inline hex → rgb so context menu items can tint with the current
// accent color on hover without importing format.js (keeps this module
// self-contained — it was already a leaf).
function hexAccent(hex) {
  if (typeof hex !== "string") return "255,255,255";
  const h = hex.replace("#", "");
  if (h.length !== 6) return "255,255,255";
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  if ([r,g,b].some(n => Number.isNaN(n))) return "255,255,255";
  return r + "," + g + "," + b;
}

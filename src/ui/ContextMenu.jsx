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

  const W = 200;
  // Each item ~36px + dividers/padding. Conservative for edge-clamping.
  const H = items.reduce((acc, i) => acc + (i.type === "divider" ? 9 : 36), 12);
  const ax = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const ay = Math.max(8, Math.min(y, window.innerHeight - H - 8));

  return (
    <div ref={ref} style={{
      position: "fixed", left: ax, top: ay, width: W, zIndex: 99999,
      background: "rgba(9,11,24,0.97)", backdropFilter: "blur(24px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
      boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
      padding: "5px 4px",
      animation: "menu-up 0.18s cubic-bezier(0.4,0,0.2,1)",
      fontFamily: FF,
    }}>
      {items.map((it, i) => {
        if (it.type === "divider") {
          return <div key={i} style={{height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 6px"}}/>;
        }
        const danger = !!it.danger;
        const disabled = !!it.disabled;
        return (
          <div key={i}
            onClick={disabled ? undefined : () => { try { it.onClick(); } catch {} onClose(); }}
            style={{
              padding: "7px 11px", borderRadius: 6, cursor: disabled ? "default" : "pointer",
              fontSize: 12, color: disabled ? "rgba(255,255,255,0.3)" : danger ? "rgba(255,130,130,0.9)" : "rgba(255,255,255,0.85)",
              display: "flex", alignItems: "center", gap: 9, opacity: disabled ? 0.5 : 1,
              transition: "background 0.12s",
            }}
            onPointerEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? "rgba(255,80,80,0.12)" : "rgba(255,255,255,0.07)"; }}
            onPointerLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            {it.icon && <span style={{width: 16, textAlign: "center", fontSize: 13, opacity: 0.85}}>{it.icon}</span>}
            <span style={{flex: 1}}>{it.label}</span>
            {it.shortcut && <span style={{fontSize: 10, fontFamily: FFM, color: "rgba(255,255,255,0.3)"}}>{it.shortcut}</span>}
          </div>
        );
      })}
    </div>
  );
}

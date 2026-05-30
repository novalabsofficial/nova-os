// v10.0 Supernova — Task View (virtual desktops overview).
//
// A Windows 11 Task View / macOS Mission Control style overlay. Shows every
// virtual desktop as a live mini-preview at the top (click to switch, X to
// remove, + to add) and the current desktop's open windows as cards below
// (click to focus, or send to another desktop).
//
// All desktop state lives in NovaOS; this component is pure presentation +
// callbacks. A window's `desk` field (int, default 0) says which desktop it
// belongs to.

import { useEffect, useRef } from "react";
import { FF, FFB, FFM } from "./styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";

const MINI_RATIO = 0.6;       // preview height = width * ratio

export function TaskView({ AC, deskCount, curDesk, wins, apps, onSwitch, onAdd, onRemove, onMoveWin, onFocusWin, onClose }) {
  const activeRef = useRef(null);
  // Esc closes (capture so it beats the global handler).
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  // Keep the active desktop preview in view when arrowing through several.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [curDesk]);

  const appOf = (id) => apps.find(a => a.id === id) || { icon: "▦", label: id };
  const sw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const sh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Big previews: one fills ~64% of the screen, two fit side-by-side at ~46%.
  // They shrink to fit when there are more desktops so the row never overflows.
  const MINI_W = Math.round(Math.max(240, Math.min(sw * (deskCount <= 1 ? 0.64 : deskCount === 2 ? 0.46 : 0.3), 760)));
  const miniH = MINI_W * MINI_RATIO;
  const deskList = Array.from({ length: deskCount }, (_, i) => i);
  const curWins = wins.filter(w => (w.desk || 0) === curDesk);

  return (
    <div
      onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 99990,
        background: "rgba(8,10,18,0.72)", backdropFilter: "blur(22px) saturate(150%)",
        WebkitBackdropFilter: "blur(22px) saturate(150%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "34px 24px", gap: 26, fontFamily: FF, overflowY: "auto",
        animation: "ss-fade 0.16s",
      }}
    >
      {/* Prev / next desktop arrows — live INSIDE Task View. Stepping them
          changes the active desktop (so closing lands you there) without
          leaving the overview, so you can flip through desktops here. */}
      {curDesk > 0 && (
        <button
          className="nv-desk-arrow"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onSwitch(curDesk - 1)}
          title="Previous desktop"
          style={{ position: "fixed", left: 20, top: "50%", transform: "translateY(-50%)", zIndex: 6, width: 56, height: 104, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      {curDesk < deskCount - 1 && (
        <button
          className="nv-desk-arrow"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onSwitch(curDesk + 1)}
          title="Next desktop"
          style={{ position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)", zIndex: 6, width: 56, height: 104, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}

      {/* Heading */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 19, color: "#fff", letterSpacing: 0.2 }}>Task View</div>
        <div style={{ fontFamily: FFM, fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
          Use the ‹ › arrows or click a desktop to switch · Esc to close
        </div>
      </div>

      {/* Desktop strip */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
        {deskList.map(idx => {
          const dWins = wins.filter(w => (w.desk || 0) === idx);
          const active = idx === curDesk;
          return (
            <div key={idx} ref={active ? activeRef : null} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div
                onPointerDown={e => e.stopPropagation()}
                onClick={() => { onSwitch(idx); onClose(); }}
                title={"Switch to Desktop " + (idx + 1)}
                style={{
                  position: "relative", width: MINI_W, height: miniH, borderRadius: 11, cursor: "pointer",
                  background: "linear-gradient(135deg, rgba(90,110,170,0.22), rgba(40,50,90,0.30))",
                  border: active ? "2px solid " + AC : "2px solid rgba(255,255,255,0.12)",
                  boxShadow: active ? "0 0 0 4px rgba(" + hexRgb(AC) + ",0.18), 0 14px 40px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,0,0,0.4)",
                  overflow: "hidden", transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* mini window rects */}
                {dWins.map(w => {
                  const scale = MINI_W / sw;
                  const maxd = w.state === "maximized";
                  const min = w.state === "minimized";
                  const left = maxd ? 0 : (w.x || 0) * scale;
                  const top = maxd ? 0 : (w.y || 0) * scale;
                  const ww = maxd ? MINI_W : Math.max(14, (w.width || 300) * scale);
                  const wh = maxd ? miniH : Math.max(10, (w.height || 240) * (miniH / sh));
                  const a = appOf(w.app);
                  return (
                    <div key={w.id} style={{
                      position: "absolute", left, top, width: ww, height: wh,
                      borderRadius: 4, background: "rgba(20,24,38,0.92)",
                      border: "1px solid rgba(255,255,255,0.18)", opacity: min ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: Math.min(13, wh * 0.7), overflow: "hidden",
                    }}>{a.icon}</div>
                  );
                })}
                {dWins.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: FFM }}>empty</div>
                )}
                {/* remove */}
                {deskCount > 1 && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onRemove(idx); }}
                    title="Remove desktop"
                    style={{
                      position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 6,
                      background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
                      cursor: "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}
                  >×</button>
                )}
              </div>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: active ? AC : "rgba(255,255,255,0.7)" }}>
                Desktop {idx + 1}{dWins.length > 0 ? " · " + dWins.length : ""}
              </div>
            </div>
          );
        })}

        {/* add desktop */}
        {deskCount < 6 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onAdd()}
              title="New desktop"
              style={{
                width: MINI_W, height: miniH, borderRadius: 11, cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.6)", fontSize: 34, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s, border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = fill(AC); e.currentTarget.style.borderColor = bdr(AC); e.currentTarget.style.color = AC; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >+</button>
            <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>New desktop</div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: "min(680px, 90%)", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)" }} />

      {/* Windows on the current desktop */}
      <div style={{ width: "min(820px, 100%)" }}>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 14, textAlign: "center" }}>
          Windows on Desktop {curDesk + 1}
        </div>
        {curWins.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "10px 0" }}>
            No open windows here. Switch to another desktop or open an app.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {curWins.map(w => {
              const a = appOf(w.app);
              return (
                <div key={w.id} style={{
                  width: 180, borderRadius: 12, background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                }}>
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => { onFocusWin(w.id); onClose(); }}
                    title={"Focus " + a.label}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "13px 13px", cursor: "pointer",
                      background: "transparent", border: "none", width: "100%", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{a.icon}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.label}</span>
                      <span style={{ display: "block", fontFamily: FFM, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{w.state === "minimized" ? "minimized" : w.state === "maximized" ? "maximized" : "open"}</span>
                    </span>
                  </button>
                  {deskCount > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 11px 11px", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: FFM, fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginRight: 2 }}>Move to</span>
                      {Array.from({ length: deskCount }, (_, i) => i).filter(i => i !== curDesk).map(i => (
                        <button
                          key={i}
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => onMoveWin(w.id, i)}
                          title={"Move to Desktop " + (i + 1)}
                          style={{
                            width: 22, height: 22, borderRadius: 6, cursor: "pointer",
                            background: fill(AC), border: "1px solid " + bdr(AC), color: AC,
                            fontFamily: FFB, fontWeight: 700, fontSize: 11, padding: 0,
                          }}
                        >{i + 1}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

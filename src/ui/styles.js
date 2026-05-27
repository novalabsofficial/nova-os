// Shared visual constants. Fonts, base input style, section-header style,
// global CSS. Imported by virtually every component file.
//
// v8.0 refresh notes
// ──────────────────
// • Inputs gained 1px more padding + softer 9px radius (matches the new
//   window-chrome radius scale).
// • Section headers got a touch more letter-spacing and shed the gray for
//   a brighter "rgba(255,255,255,0.4)" — labels were borderline invisible
//   on the darkest wallpapers before.
// • New SHADOW_* constants give every component access to a coherent
//   depth ladder. Use SHADOW_SOFT for resting cards, SHADOW_LIFTED for
//   hovers and pop-ups, SHADOW_DEEP for moving/floating windows.

export const DEFAULT_AC = "#4f9eff";

export const FF  = "'DM Sans',sans-serif";
export const FFB = "'Space Grotesk',sans-serif";
export const FFM = "'JetBrains Mono',monospace";

// v8.0: shared depth ladder. Each shadow combines an ambient (large blurry)
// layer with a key (closer, darker) layer for a more physical sense of light.
// Inner highlight at the top sells the "glass" tactile feel.
export const SHADOW_SOFT   = "0 1px 2px rgba(0,0,0,0.18), 0 4px 14px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.04) inset";
export const SHADOW_LIFTED = "0 2px 4px rgba(0,0,0,0.22), 0 10px 30px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.08) inset";
export const SHADOW_DEEP   = "0 8px 16px rgba(0,0,0,0.35), 0 30px 80px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08) inset";

// Standard input/textarea style — apps use {...INP} as a base and override.
export const INP = {
  width: "100%",
  padding: "10px 13px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 9,
  color: "rgba(255,255,255,0.94)",
  fontFamily: FF,
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.18s cubic-bezier(0.4,0,0.2,1), background 0.18s cubic-bezier(0.4,0,0.2,1)",
};

// "Section header" style — small all-caps label between sections of an app.
export const SEC = {
  fontFamily: FFB,
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: 1.8,
  color: "rgba(255,255,255,0.4)",
  marginBottom: 12,
  textTransform: "uppercase",
};

// Global stylesheet injected once via <style>{CSS}</style> on every screen.
// Defines hover transitions for class names used throughout the app (.di, .tb,
// .wx, .wm, .wn, .ma, .ls, .lt, .sb, .dl, .ps, .fr, .sr, .bp, .ad, .ws, .sc,
// .wgt) plus the keyframes used by window/menu/toast animations.
export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;}body{margin:0;background:#07080f;color-scheme:dark;}

  /* v8.0 scrollbar refresh — slightly wider, rounded, smoother fade on hover.
     Firefox uses scrollbar-color; webkit uses ::-webkit-scrollbar. */
  *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.14) transparent;}
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;transition:background 0.2s;}
  ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22);}
  ::-webkit-scrollbar-corner{background:transparent;}

  input,textarea,button{font-family:inherit;}
  input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.28);}
  textarea{resize:vertical;}

  /* Selection color — uses currentColor-friendly tint, looks polished on any wallpaper */
  ::selection{background:rgba(99,102,241,0.35);color:#fff;}

  /* v8.0 keyframes — slightly longer durations for a more premium pace.
     The standard Material curve (0.2,0,0,1 reversed → 0.4,0,0.2,1) stays. */
  @keyframes boot-in{from{opacity:0;transform:translateX(-14px);}to{opacity:1;transform:none;}}
  /* Windows: a bit more pronounced rise + slight overshoot scale */
  @keyframes win-in{from{opacity:0;transform:scale(0.92) translateY(16px);}to{opacity:1;transform:none;}}
  @keyframes menu-up{from{opacity:0;transform:translateY(16px) scale(0.97);}to{opacity:1;transform:none;}}
  @keyframes toast-in{from{opacity:0;transform:translateY(-12px) scale(0.95);}to{opacity:1;transform:none;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
  @keyframes nova-breathe{0%,100%{opacity:0.92;filter:drop-shadow(0 0 24px rgba(99,102,241,0.25));}50%{opacity:1;filter:drop-shadow(0 0 48px rgba(99,102,241,0.55));}}
  @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
  @keyframes float{0%,100%{transform:translateY(0) translateX(0);}50%{transform:translateY(-12px) translateX(6px);}}
  /* v8.5 dynamic wallpaper drift — a gentle but visible pan + zoom. Base scale
     stays ≥1.12 (overscan) and translate is capped well under that, so the
     panning never reveals the wallpaper's edge. */
  @keyframes wp-drift{0%{transform:scale(1.12) translate(-2.4%,-1.6%);}50%{transform:scale(1.2) translate(2.4%,1.6%);}100%{transform:scale(1.12) translate(-2.4%,-1.6%);}}

  /* v8.0 — soft accent-tinged glow ring on focused buttons (used by .sb:focus-visible) */
  @keyframes ring-in{from{box-shadow:0 0 0 0 rgba(99,102,241,0);}to{box-shadow:0 0 0 3px rgba(99,102,241,0.35);}}

  /* ── Interactive class hover states ────────────────────────────────────
     Standardized on cubic-bezier(0.4,0,0.2,1) (Material standard).
     v8.0 increased the hover background opacities so hover states are
     clearly readable on bright wallpapers, where the old v7.x values
     sometimes disappeared into the backdrop. */

  /* Desktop icon — soft selection ring on hover */
  .di{transition:background 0.2s cubic-bezier(0.4,0,0.2,1),transform 0.2s cubic-bezier(0.4,0,0.2,1),border-color 0.2s cubic-bezier(0.4,0,0.2,1);}
  .di:hover{background:rgba(255,255,255,0.12)!important;border-color:rgba(255,255,255,0.14)!important;}

  /* Taskbar window chip — lifts slightly on hover */
  .tb{transition:all 0.2s cubic-bezier(0.4,0,0.2,1);}
  .tb:hover{background:rgba(255,255,255,0.14)!important;border-color:rgba(255,255,255,0.2)!important;transform:translateY(-1px);}

  /* Window controls — close turns red, minimize/maximize gain subtle hovers */
  .wx{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),color 0.18s cubic-bezier(0.4,0,0.2,1);}
  .wx:hover{background:#e5484d!important;color:#fff!important;border-color:#e5484d!important;}
  .wm,.wn{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),color 0.18s cubic-bezier(0.4,0,0.2,1);}
  .wm:hover,.wn:hover{background:rgba(255,255,255,0.14)!important;color:rgba(255,255,255,0.95)!important;}

  /* Start menu app tile */
  .ma{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),transform 0.18s cubic-bezier(0.4,0,0.2,1);}
  .ma:hover{background:rgba(255,255,255,0.1)!important;transform:translateY(-1px);}

  .ls{transition:opacity 0.18s cubic-bezier(0.4,0,0.2,1);}.ls:hover:not(:disabled){opacity:0.82!important;}
  .lt{transition:color 0.18s cubic-bezier(0.4,0,0.2,1);}.lt:hover{color:rgba(160,210,255,0.9)!important;}

  /* System buttons (taskbar start, bell, settings cog, user chip) */
  .sb{transition:all 0.2s cubic-bezier(0.4,0,0.2,1);}
  .sb:hover{background:rgba(255,255,255,0.14)!important;border-color:rgba(255,255,255,0.18)!important;}

  .dl{transition:color 0.18s cubic-bezier(0.4,0,0.2,1);}.dl:hover{color:rgba(255,90,90,0.95)!important;}
  .ps{transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1);}.ps:hover{transform:scale(1.22);z-index:2;}
  .fr{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.fr:hover{background:rgba(255,255,255,0.08)!important;}
  .sr{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.sr:hover{background:rgba(255,255,255,0.07)!important;}
  .bp{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.bp:hover{background:rgba(255,255,255,0.12)!important;}
  .ad{transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1);}.ad:hover{transform:scale(1.16);}
  .ws{transition:border-color 0.2s cubic-bezier(0.4,0,0.2,1),transform 0.2s cubic-bezier(0.4,0,0.2,1);}.ws:hover{border-color:rgba(255,255,255,0.55)!important;transform:scale(1.02);}
  .sc{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.sc:hover{background:rgba(255,255,255,0.07)!important;}
  .wgt{transition:border-color 0.22s cubic-bezier(0.4,0,0.2,1),box-shadow 0.22s cubic-bezier(0.4,0,0.2,1);}.wgt:hover{border-color:rgba(255,255,255,0.24)!important;}

  /* Focus rings — only visible from keyboard navigation, never from mouse clicks */
  button:focus-visible,input:focus-visible,textarea:focus-visible{
    outline:none;
    box-shadow:0 0 0 2px rgba(99,102,241,0.55), 0 0 0 4px rgba(99,102,241,0.18);
  }
`;

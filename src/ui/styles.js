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

// ── v9.0 theme tokens ──────────────────────────────────────────────────────
// These resolve to the CSS variables defined in CSS below. A component that
// uses e.g. `color: T.text` automatically follows the active light/dark theme
// (toggled by setting html[data-theme="light"|"dark"]). Dark is the default;
// light is the new opt-in. Surfaces are converted to these tokens
// incrementally — anything still on a hardcoded rgba simply stays dark for now.
export const T = {
  surface:      "var(--nv-surface)",       // frosted glass panel (taskbar, menus)
  surfaceSolid: "var(--nv-surface-solid)",  // opaque-ish window body
  elevated:     "var(--nv-elevated)",       // faint raised fill (cards, rows)
  border:       "var(--nv-border)",
  borderStrong: "var(--nv-border-strong)",
  text:         "var(--nv-text)",
  textStrong:   "var(--nv-text-strong)",
  textDim:      "var(--nv-text-dim)",
  hover:        "var(--nv-hover)",
  inputBg:      "var(--nv-input-bg)",
};

// Standard input/textarea style — apps use {...INP} as a base and override.
export const INP = {
  width: "100%",
  padding: "10px 13px",
  background: "var(--nv-input-bg)",
  border: "1px solid var(--nv-border)",
  borderRadius: 9,
  color: "var(--nv-text-strong)",
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
  color: "var(--nv-text-dim)",
  marginBottom: 12,
  textTransform: "uppercase",
};

// Global stylesheet injected once via <style>{CSS}</style> on every screen.
// Defines hover transitions for class names used throughout the app (.di, .tb,
// .wx, .wm, .wn, .ma, .ls, .lt, .sb, .dl, .ps, .fr, .sr, .bp, .ad, .ws, .sc,
// .wgt) plus the keyframes used by window/menu/toast animations.
export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;}
  body{margin:0;background:var(--nv-body-bg,#07080f);}

  /* v10.0 — virtual-desktop edge arrows: brighten + nudge outward on hover */
  .nv-desk-arrow:hover{background:rgba(28,31,46,0.7)!important;}
  .nv-desk-arrow:active{transform:translateY(-50%) scale(0.94)!important;}

  /* ── v9.0 theme tokens. Dark is the default (:root); light overrides via
     html[data-theme="light"]. A single root attribute reskins the OS — see
     the T helper in styles.js. */
  :root{
    color-scheme:dark;
    /* v10.0 — shared motion curves. --nv-ease is the smooth ease-out-quint
       used by the desktop slide; --nv-spring adds a touch of overshoot for
       playful pops. Reuse these everywhere for a consistent feel. */
    --nv-ease:cubic-bezier(0.22,1,0.36,1);
    --nv-spring:cubic-bezier(0.34,1.56,0.64,1);
    --nv-body-bg:#07080f;
    --nv-surface:rgba(15,17,32,0.72);
    --nv-surface-solid:rgba(10,12,24,0.92);
    --nv-elevated:rgba(255,255,255,0.04);
    --nv-border:rgba(255,255,255,0.09);
    --nv-border-strong:rgba(255,255,255,0.16);
    --nv-text-strong:rgba(255,255,255,0.95);
    --nv-text:rgba(255,255,255,0.7);
    --nv-text-dim:rgba(255,255,255,0.4);
    --nv-hover:rgba(255,255,255,0.08);
    --nv-input-bg:rgba(255,255,255,0.06);
    --nv-scroll:rgba(255,255,255,0.14);
    --nv-scroll-hover:rgba(255,255,255,0.24);
    --nv-glass-blur:28px;
  }
  /* (v9.0: light mode was scrapped — Nova OS is dark-only. The tokens above
     stay because surfaces reference them; only the light overrides are gone.) */

  /* ── v9.0 Liquid Glass. When enabled (html[data-glass="on"]), surfaces get
     noticeably sheerer + a heavier blur so the wallpaper frosts through —
     the "pane of glass" feel. Glass-off values equal the originals, so the
     default look is unchanged. (Dark-theme tuned; light+glass comes when
     light mode is rebuilt.) */
  html[data-glass="on"]{
    --nv-surface:rgba(15,17,32,0.44);
    --nv-surface-solid:rgba(10,12,24,0.52);
    --nv-glass-blur:40px;
  }

  /* v8.0 scrollbar refresh — slightly wider, rounded, smoother fade on hover.
     Firefox uses scrollbar-color; webkit uses ::-webkit-scrollbar. */
  *{scrollbar-width:thin;scrollbar-color:var(--nv-scroll) transparent;}
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--nv-scroll);border-radius:3px;transition:background 0.2s;}
  ::-webkit-scrollbar-thumb:hover{background:var(--nv-scroll-hover);}
  ::-webkit-scrollbar-corner{background:transparent;}

  input,textarea,button{font-family:inherit;}
  input::placeholder,textarea::placeholder{color:var(--nv-text-dim);}
  textarea{resize:vertical;}

  /* Selection color — uses currentColor-friendly tint, looks polished on any wallpaper */
  ::selection{background:rgba(99,102,241,0.35);color:#fff;}

  /* v8.0 keyframes — slightly longer durations for a more premium pace.
     The standard Material curve (0.2,0,0,1 reversed → 0.4,0,0.2,1) stays. */
  @keyframes boot-in{from{opacity:0;transform:translateX(-14px);}to{opacity:1;transform:none;}}
  /* Windows: a bit more pronounced rise + slight overshoot scale */
  @keyframes win-in{from{opacity:0;transform:scale(0.92) translateY(16px);}to{opacity:1;transform:none;}}
  /* v10.0 — window exit/minimize/restore. Close shrinks + fades in place;
     minimize shrinks down toward the taskbar; restore reverses it. The min/
     restore pair uses transform-origin:50% 100% (set inline) so it collapses
     toward the bottom edge where the taskbar lives. */
  @keyframes win-out{from{opacity:1;transform:none;}to{opacity:0;transform:scale(0.86) translateY(10px);}}
  @keyframes win-min{from{opacity:1;transform:none;}to{opacity:0;transform:scale(0.45) translateY(34vh);}}
  @keyframes win-restore{from{opacity:0;transform:scale(0.6) translateY(26vh);}to{opacity:1;transform:none;}}
  /* v10.0 — launch zoom: a window grows out of the point that opened it
     (transform-origin set inline to the click position). */
  @keyframes win-launch{from{opacity:0;transform:scale(0.32);}60%{opacity:1;}to{opacity:1;transform:none;}}
  /* v10.0 — desktop icons fade+rise in on login, staggered by index. */
  @keyframes icon-pop{from{opacity:0;transform:translateY(12px) scale(0.86);}to{opacity:1;transform:none;}}
  @keyframes menu-up{from{opacity:0;transform:translateY(16px) scale(0.97);}to{opacity:1;transform:none;}}
  @keyframes toast-in{from{opacity:0;transform:translateY(-12px) scale(0.95);}to{opacity:1;transform:none;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes ss-fade{from{opacity:0;}to{opacity:1;}}
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
  /* v9.2 — Discord-style chat rows. Whole row highlights on hover; the
     delete/mod button (.rowact) and the per-message timestamp shown in the
     avatar gutter for grouped messages (.ts-hover) reveal on hover. */
  .msgrow{transition:background 0.12s;}
  .msgrow:hover{background:rgba(255,255,255,0.035);}
  .msgrow:hover .rowact{opacity:1!important;}
  .msgrow:hover .ts-hover{color:var(--nv-text-dim)!important;}
  .bp{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.bp:hover{background:rgba(255,255,255,0.12)!important;}
  .ad{transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1);}.ad:hover{transform:scale(1.16);}
  .ws{transition:border-color 0.2s cubic-bezier(0.4,0,0.2,1),transform 0.2s cubic-bezier(0.4,0,0.2,1);}.ws:hover{border-color:rgba(255,255,255,0.55)!important;transform:scale(1.02);}
  .sc{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.sc:hover{background:rgba(255,255,255,0.07)!important;}
  .wgt{transition:border-color 0.22s cubic-bezier(0.4,0,0.2,1),box-shadow 0.22s cubic-bezier(0.4,0,0.2,1);}.wgt:hover{border-color:rgba(255,255,255,0.24)!important;}

  /* ── v10.0 Supernova — tactile micro-interactions ──────────────────────
     Press feedback (scale-down) + gentle hover lifts using the same smooth
     ease-out-quint family as the desktop slide, so the whole OS feels alive
     and consistent under the hand. Press states are !important so they win
     over the base hover rule's transform. All transform/opacity → GPU-cheap. */
  .sb:hover{transform:translateY(-1px);}
  .sb:active,.bp:active{transform:scale(0.95)!important;}
  .tb:active{transform:translateY(-1px) scale(0.95)!important;}
  .ma:active{transform:translateY(-1px) scale(0.96)!important;}
  .di:hover{transform:translateY(-2px)!important;}
  .di:active{transform:scale(0.95)!important;}
  .bp{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),transform 0.2s var(--nv-ease);}
  /* window controls gain a satisfying press */
  .wx,.wm,.wn{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),color 0.18s cubic-bezier(0.4,0,0.2,1),transform 0.16s var(--nv-ease);}
  .wx:active,.wm:active,.wn:active{transform:scale(0.86);}
  /* sidebar/list rows ease their background instead of snapping */
  .sr,.fr,.sc{transition:background 0.16s var(--nv-ease)!important;}
  /* generic pop-in for popovers/dialogs that want it inline */
  @keyframes pop-in{from{opacity:0;transform:scale(0.94) translateY(8px);}to{opacity:1;transform:none;}}
  @keyframes panel-in-right{from{opacity:0;transform:translateX(26px);}to{opacity:1;transform:none;}}
  /* mobile Control Center drops from the top; App Library rises from the bottom */
  @keyframes panel-down{from{opacity:0;transform:translateY(-22px);}to{opacity:1;transform:none;}}
  @keyframes panel-up{from{opacity:0;transform:translateY(26px);}to{opacity:1;transform:none;}}
  /* iOS-style icon wobble while the mobile home screen is in edit mode */
  @keyframes icon-jiggle{0%{transform:rotate(-1.6deg);}50%{transform:rotate(1.6deg);}100%{transform:rotate(-1.6deg);}}
  /* mobile springboard: spring home-return + tactile icon press */
  @keyframes home-in{from{opacity:0;transform:scale(1.08);}to{opacity:1;transform:none;}}
  @keyframes app-in{from{opacity:0;transform:scale(0.92) translateY(2%);}to{opacity:1;transform:none;}}
  .mb-ic{transition:transform 0.13s var(--nv-ease);-webkit-touch-callout:none;}
  .mb-ic:active{transform:scale(0.88);}
  .mb-cc-tile{transition:transform 0.12s var(--nv-ease),background 0.18s var(--nv-ease);}
  .mb-cc-tile:active{transform:scale(0.93);}
  /* respect reduced-motion: drop all the extra movement */
  @media (prefers-reduced-motion: reduce){
    *{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}
  }

  /* Focus rings — only visible from keyboard navigation, never from mouse clicks */
  button:focus-visible,input:focus-visible,textarea:focus-visible{
    outline:none;
    box-shadow:0 0 0 2px rgba(99,102,241,0.55), 0 0 0 4px rgba(99,102,241,0.18);
  }
`;

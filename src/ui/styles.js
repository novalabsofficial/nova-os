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

// ── v11.0 design tokens ─────────────────────────────────────────────────────
// One source of truth for the values every component should reuse, so the whole
// OS stays consistent as it's migrated onto the design system. Purely additive:
// existing hardcoded values keep working; new / refactored code reaches for
// these. Values are numeric (px / ms) so they drop straight into inline styles.
// See src/ui/primitives.jsx for the reusable components built on top of them.

// Spacing scale (4px base grid). Use SPACE[n] or sp(n).
export const SPACE = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64 };
export const sp = (n) => (SPACE[n] != null ? SPACE[n] : n);

// Corner-radius scale — the window-chrome radius family.
export const RADIUS = { xs: 6, sm: 8, md: 10, lg: 12, xl: 16, xxl: 22, pill: 999 };

// Typography presets — spread one into a style object (family + size + weight +
// line-height tuned together). Keeps headings/body/labels consistent everywhere.
export const TYPE = {
  display: { fontFamily: FFB, fontWeight: 800, fontSize: 26, lineHeight: 1.15 },
  title:   { fontFamily: FFB, fontWeight: 700, fontSize: 20, lineHeight: 1.2 },
  heading: { fontFamily: FFB, fontWeight: 600, fontSize: 15, lineHeight: 1.3 },
  body:    { fontFamily: FF,  fontWeight: 400, fontSize: 14, lineHeight: 1.5 },
  small:   { fontFamily: FF,  fontWeight: 400, fontSize: 12, lineHeight: 1.45 },
  label:   { fontFamily: FFB, fontWeight: 600, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  mono:    { fontFamily: FFM, fontWeight: 500, fontSize: 12.5, lineHeight: 1.4 },
};

// Motion tokens — pair a DUR with an EASE for the shared "motion language".
// These mirror the CSS curves (--nv-ease / --nv-spring) so JS- and CSS-driven
// transitions feel identical. tx(...props) builds a transition string.
export const EASE = {
  standard: "cubic-bezier(0.4,0,0.2,1)",      // Material standard — most UI transitions
  out:      "cubic-bezier(0.22,1,0.36,1)",    // ease-out-quint — enters / slides (= --nv-ease)
  spring:   "cubic-bezier(0.34,1.56,0.64,1)", // slight overshoot — playful pops (= --nv-spring)
};
export const DUR = { fast: 130, base: 200, slow: 300 };
export const tx = (...props) => props.map((p) => p + " " + DUR.base + "ms " + EASE.standard).join(", ");

// z-index ladder — keeps stacking order intentional across the OS.
export const Z = { base: 1, dropdown: 20, sticky: 50, overlay: 9000, modal: 10000, toast: 11000 };

// Semantic status colors (dialogs, toasts, validation).
export const STATUS = { danger: "#ff6b6b", warn: "#ffcc44", ok: "#4cef90", info: "#4f9eff" };

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
  /* ── v11.0 Light mode. Flips the --nv-* tokens; every surface that uses them
     reskins automatically. (Apps still on hardcoded colors get migrated to
     tokens in waves.) Toggle in Settings → Display. */
  html[data-theme="light"]{
    color-scheme:light;
    /* Soft cool-grey, not stark white — easier on the eyes. Panels are fairly
       opaque so the wallpaper doesn't muddy them; borders + text carry a touch
       more contrast so cards stay defined instead of washing out. */
    --nv-body-bg:#d7dbe4;
    --nv-surface:rgba(244,246,250,0.93);
    --nv-surface-solid:rgba(246,248,251,0.99);
    --nv-elevated:rgba(20,28,48,0.05);
    --nv-border:rgba(20,28,48,0.16);
    --nv-border-strong:rgba(20,28,48,0.28);
    --nv-text-strong:rgba(28,34,48,0.92);
    --nv-text:rgba(45,53,70,0.82);
    --nv-text-dim:rgba(60,69,88,0.66);
    --nv-hover:rgba(20,28,48,0.07);
    --nv-input-bg:rgba(20,28,48,0.05);
    --nv-scroll:rgba(20,28,48,0.24);
    --nv-scroll-hover:rgba(20,28,48,0.36);
  }
  html[data-theme="light"][data-glass="on"]{
    --nv-surface:rgba(244,246,250,0.66);
    --nv-surface-solid:rgba(246,248,251,0.8);
  }

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

  /* Hidden-scrollbar utility — for horizontal strips (e.g. the taskbar app
     cluster) that should scroll when crowded without showing a scrollbar. */
  .no-sb{scrollbar-width:none;-ms-overflow-style:none;}
  .no-sb::-webkit-scrollbar{width:0;height:0;display:none;}

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
  /* v11.0 light mode — desktop sits on a light wallpaper, so the icon hover is a faint DARK wash + hairline (not white-on-white) */
  html[data-theme="light"] .di:hover{background:rgba(20,28,48,0.08)!important;border-color:rgba(20,28,48,0.13)!important;}

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
  /* lock-screen "swipe up" handle hint */
  @keyframes ls-hint{0%,100%{transform:translateY(0);opacity:0.55;}50%{transform:translateY(-5px);opacity:1;}}
  /* Native Android app (Capacitor): backdrop-filter blur is extremely janky in
     the WebView and is the main cause of stuttery panel/drawer animations. Drop
     it everywhere (overriding inline styles via !important) and add GPU
     compositing hints — overlays keep their translucent background, just
     unblurred, and motion gets noticeably smoother. */
  html.nova-native *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}
  html.nova-native{-webkit-tap-highlight-color:transparent;}
  /* Lite mode (?kiosk=1) — software-rendered / low-power hosts (e.g. Nova OS as
     the Linux desktop in a VM). Kill backdrop blur everywhere; the heavy
     animated-wallpaper drift is disabled in JS (see wallpapers.jsx). This is
     what unsticks the glassy taskbar/panels on a GPU-less host. */
  html.nova-lite *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}
  /* respect reduced-motion: drop all the extra movement */
  @media (prefers-reduced-motion: reduce){
    *{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}
  }

  /* v11.0 design-system primitive: <Button>/<IconButton> share this class for a
     consistent hover-brighten + press-shrink across the whole OS. */
  .nv-btn{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),border-color 0.18s cubic-bezier(0.4,0,0.2,1),transform 0.16s var(--nv-ease),opacity 0.18s,filter 0.18s;}
  .nv-btn:hover:not(:disabled){filter:brightness(1.08);}
  .nv-btn:active:not(:disabled){transform:scale(0.96);}
  .nv-btn:disabled{opacity:0.45;cursor:default!important;}

  /* Focus rings — only visible from keyboard navigation, never from mouse clicks */
  button:focus-visible,input:focus-visible,textarea:focus-visible{
    outline:none;
    box-shadow:0 0 0 2px rgba(99,102,241,0.55), 0 0 0 4px rgba(99,102,241,0.18);
  }
`;

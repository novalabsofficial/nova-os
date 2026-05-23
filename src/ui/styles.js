// Shared visual constants. Fonts, base input style, section-header style,
// global CSS. Imported by virtually every component file.

export const DEFAULT_AC = "#4f9eff";

export const FF  = "'DM Sans',sans-serif";
export const FFB = "'Space Grotesk',sans-serif";
export const FFM = "'JetBrains Mono',monospace";

// Standard input/textarea style — apps use {...INP} as a base and override.
export const INP = {
  width: "100%",
  padding: "9px 12px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 7,
  color: "rgba(255,255,255,0.92)",
  fontFamily: FF,
  fontSize: 14,
  outline: "none",
};

// "Section header" style — small all-caps label between sections of an app.
export const SEC = {
  fontFamily: FFB,
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: 1.5,
  color: "rgba(255,255,255,0.3)",
  marginBottom: 12,
  textTransform: "uppercase",
};

// Global stylesheet injected once via <style>{CSS}</style> on every screen.
// Defines hover transitions for class names used throughout the app (.di, .tb,
// .wx, .wm, .wn, .ma, .ls, .lt, .sb, .dl, .ps, .fr, .sr, .bp, .ad, .ws, .sc,
// .wgt) plus the keyframes used by window/menu/toast animations.
export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;}body{margin:0;background:#07080f;}
  ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px;}
  input,textarea,button{font-family:inherit;}input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.22);}textarea{resize:vertical;}
  /* Keyframes — slightly larger displacements + later finish for visible smoothness */
  @keyframes boot-in{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:none;}}
  @keyframes win-in{from{opacity:0;transform:scale(0.92) translateY(10px);}to{opacity:1;transform:none;}}
  @keyframes menu-up{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
  @keyframes toast-in{from{opacity:0;transform:translateX(18px) scale(0.97);}to{opacity:1;transform:none;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
  /* Hover transitions standardized on cubic-bezier(0.4,0,0.2,1) — Material's "standard" curve */
  .di{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),transform 0.18s cubic-bezier(0.4,0,0.2,1);}.di:hover{background:rgba(255,255,255,0.14)!important;}
  .tb{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.tb:hover{background:rgba(255,255,255,0.1)!important;}
  .wx{transition:background 0.18s cubic-bezier(0.4,0,0.2,1),color 0.18s cubic-bezier(0.4,0,0.2,1);}.wx:hover{background:#c42b1c!important;color:#fff!important;}
  .wm,.wn{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.wm:hover,.wn:hover{background:rgba(255,255,255,0.1)!important;}
  .ma{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.ma:hover{background:rgba(255,255,255,0.08)!important;}
  .ls{transition:opacity 0.18s cubic-bezier(0.4,0,0.2,1);}.ls:hover:not(:disabled){opacity:0.82!important;}
  .lt{transition:color 0.18s cubic-bezier(0.4,0,0.2,1);}.lt:hover{color:rgba(160,210,255,0.9)!important;}
  .sb{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.sb:hover{background:rgba(255,255,255,0.1)!important;}
  .dl{transition:color 0.18s cubic-bezier(0.4,0,0.2,1);}.dl:hover{color:rgba(255,80,80,0.9)!important;}
  .ps{transition:transform 0.2s cubic-bezier(0.4,0,0.2,1);}.ps:hover{transform:scale(1.2);z-index:2;}
  .fr{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.fr:hover{background:rgba(255,255,255,0.07)!important;}
  .sr{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.sr:hover{background:rgba(255,255,255,0.06)!important;}
  .bp{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.bp:hover{background:rgba(255,255,255,0.1)!important;}
  .ad{transition:transform 0.2s cubic-bezier(0.4,0,0.2,1);}.ad:hover{transform:scale(1.15);}
  .ws{transition:border-color 0.18s cubic-bezier(0.4,0,0.2,1);}.ws:hover{border-color:rgba(255,255,255,0.5)!important;}
  .sc{transition:background 0.18s cubic-bezier(0.4,0,0.2,1);}.sc:hover{background:rgba(255,255,255,0.06)!important;}
  .wgt{transition:border-color 0.2s cubic-bezier(0.4,0,0.2,1);}.wgt:hover{border-color:rgba(255,255,255,0.22)!important;}
`;

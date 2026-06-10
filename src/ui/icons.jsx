// App icon rendering. Three layers:
//   1. NovaSvgIcon — custom-drawn SVG icons for the built-in apps
//   2. StoreIcon   — Clearbit logo API for external store apps (with emoji fallback)
//   3. AppIconDisplay — the unified picker, used everywhere (desktop, taskbar, menu, store)
//
// HAS_SVG_ICON (in ui/constants.js) determines which ids route to NovaSvgIcon.
// Anything else falls back to the app's emoji icon.

import { useState } from "react";
import { HAS_SVG_ICON, STORE_META } from "./constants.js";
import { fill, bdr } from "../lib/format.js";
import { NovaAppIcon, NOVA_ICONS } from "./appicons.jsx";
import novaMarkImg from "../assets/logo/nova-mark.png";

// v8.5 — shared user avatar. Renders the user's saved profile picture
// (a base64 data URL in `img`) when present, otherwise the classic
// first-letter-on-accent circle. `ring` adds the glowing accent border used
// on the prominent user chip; pass ring={false} for the quieter menu chip.
export function UserAvatar({ name, img, ac = "#4f9eff", size = 38, ring = true }) {
  if (img) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        backgroundImage: `url("${img}")`, backgroundSize: "cover", backgroundPosition: "center",
        border: ring ? "1.5px solid " + ac : "1px solid " + bdr(ac),
        boxShadow: ring ? "0 0 12px " + fill(ac) : "none",
      }}/>
    );
  }
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: fill(ac), border: (ring ? "1.5px" : "1px") + " solid " + (ring ? ac : bdr(ac)),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: ac,
      fontSize: Math.round(size * 0.42), lineHeight: 1,
      boxShadow: ring ? "0 0 12px " + fill(ac) : "none",
    }}>{letter}</div>
  );
}

// Built-in app SVG icons. All use a 32x32 viewBox with rounded-rect background.
//
// v8.0 final pass (middle ground): pulled back from the iOS-glossy vertical
// gradients of round-3. Backgrounds are mostly flat with a very subtle radial
// highlight in the upper-left to give a soft dimensional feel — but nothing
// loud. Glyphs stay simple and iconographic.
//
// User-requested colors kept fixed:
//   • Notes  → yellow background with WHITE text lines
//   • Store  → pink (back to v7 era)
//   • Files  → yellow (back to v7 era)
//
// Other colors revert toward the v7-era palette where they had become too
// candied in round-3. Shared `iconHL` is a soft per-svg gradient with a
// unique id so the upper-left highlight doesn't conflict across instances.
export function NovaSvgIcon({ id, size = 26 }) {
  const r = Math.round(size * 0.22);
  const w = size, h = size;
  // Each icon defines its own per-id highlight at the top so it doesn't
  // share globals. Helper: just call it like {hl("notes")} inside an SVG.
  // (Inlined per icon for compactness — see "<radialGradient id=...".)

  if(id==="notes")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="notes-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#fbbf24"/><rect width="32" height="32" rx={r} fill="url(#notes-hl)"/><rect x="7" y="10" width="18" height="2" rx="1" fill="white"/><rect x="7" y="15" width="14" height="2" rx="1" fill="rgba(255,255,255,0.85)"/><rect x="7" y="20" width="16" height="2" rx="1" fill="rgba(255,255,255,0.85)"/></svg>);

  if(id==="tasks")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="tasks-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#10b981"/><rect width="32" height="32" rx={r} fill="url(#tasks-hl)"/><circle cx="11" cy="11.5" r="4.2" fill="white"/><polyline points="8.8,11.5 10.4,13 13.2,9.8" stroke="#059669" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="17.5" y="10.2" width="9" height="2.4" rx="1.2" fill="white"/><circle cx="11" cy="21" r="4.2" fill="none" stroke="white" strokeWidth="1.4"/><rect x="17.5" y="19.8" width="7" height="2.4" rx="1.2" fill="rgba(255,255,255,0.65)"/></svg>);

  if(id==="files")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="files-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#f59e0b"/><rect width="32" height="32" rx={r} fill="url(#files-hl)"/><path d="M6 13 Q6 11 8 11 L13 11 L15 13 L24 13 Q26 13 26 15 L26 23 Q26 25 24 25 L8 25 Q6 25 6 23 Z" fill="white"/><path d="M6 16 L26 16" stroke="rgba(120,53,15,0.15)" strokeWidth="0.6"/></svg>);

  if(id==="paint")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="paint-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#8b5cf6"/><rect width="32" height="32" rx={r} fill="url(#paint-hl)"/><circle cx="10.5" cy="11.5" r="2.3" fill="#ff5a5a"/><circle cx="17" cy="9" r="2.3" fill="#ffd84d"/><circle cx="23" cy="13" r="2.3" fill="#4cef90"/><circle cx="22" cy="21" r="2.3" fill="#4f9eff"/><circle cx="14" cy="22.5" r="2.3" fill="#fb923c"/></svg>);

  if(id==="browser")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="browser-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#06b6d4"/><rect width="32" height="32" rx={r} fill="url(#browser-hl)"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="white" strokeWidth="1.6"/><ellipse cx="16" cy="16" rx="4" ry="8.5" fill="none" stroke="white" strokeWidth="1.3"/><line x1="7.5" y1="16" x2="24.5" y2="16" stroke="white" strokeWidth="1.3"/></svg>);

  if(id==="snake")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="snake-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#22c55e"/><rect width="32" height="32" rx={r} fill="url(#snake-hl)"/><path d="M7 23 Q7 14 13 14 Q19 14 19 10 Q19 7 22 7" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round"/><circle cx="22" cy="7" r="3.3" fill="white"/><circle cx="20.8" cy="6.2" r="0.7" fill="#15803d"/><circle cx="23.2" cy="6.2" r="0.7" fill="#15803d"/></svg>);

  if(id==="2048")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="g2048-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#f97316"/><rect width="32" height="32" rx={r} fill="url(#g2048-hl)"/><rect x="6" y="6"  width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.32)"/><rect x="18" y="6"  width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.55)"/><rect x="6" y="18" width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.55)"/><rect x="18" y="18" width="8" height="8"  rx="1.5" fill="white"/><text x="22" y="25.2" textAnchor="middle" fill="#c2410c" fontSize="7.5" fontWeight="700" fontFamily="sans-serif">8</text></svg>);

  if(id==="store")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="store-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#ec4899"/><rect width="32" height="32" rx={r} fill="url(#store-hl)"/>{/* shopping bag silhouette — simple, clean */}<path d="M9 12 L9 24 Q9 25.5 10.5 25.5 L21.5 25.5 Q23 25.5 23 24 L23 12 Z" fill="white"/><path d="M12 13 L12 11 Q12 8 16 8 Q20 8 20 11 L20 13" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round"/><circle cx="16" cy="17.5" r="2" fill="#ec4899"/></svg>);

  if(id==="terminal")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="term-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.08"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#1e293b"/><rect width="32" height="32" rx={r} fill="url(#term-hl)"/><polyline points="8,11 12,16 8,21" stroke="#4cef90" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="14" y1="22" x2="24" y2="22" stroke="#4cef90" strokeWidth="2.2" strokeLinecap="round"/></svg>);

  if(id==="settings"){
    const spokes=[0,45,90,135,180,225,270,315].map(deg=>{const a=deg*Math.PI/180;return{x1:16+6.5*Math.cos(a),y1:16+6.5*Math.sin(a),x2:16+9.8*Math.cos(a),y2:16+9.8*Math.sin(a)};});
    return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="set-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.16"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#64748b"/><rect width="32" height="32" rx={r} fill="url(#set-hl)"/>{spokes.map((s,i)=><line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="white" strokeWidth="2.5" strokeLinecap="round"/>)}<circle cx="16" cy="16" r="4.5" fill="white"/><circle cx="16" cy="16" r="1.8" fill="#64748b"/></svg>);
  }

  if(id==="profile")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="prof-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#4f9eff"/><rect width="32" height="32" rx={r} fill="url(#prof-hl)"/><circle cx="16" cy="12.5" r="5" fill="white"/><path d="M6 27 Q6 21 16 21 Q26 21 26 27 L26 32 L6 32 Z" fill="white"/></svg>);

  if(id==="chat")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="chat-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#6366f1"/><rect width="32" height="32" rx={r} fill="url(#chat-hl)"/><path d="M6 9 Q6 7 8 7 L24 7 Q26 7 26 9 L26 19 Q26 21 24 21 L14 21 L9 25.5 L9.5 21 L8 21 Q6 21 6 19 Z" fill="white"/><circle cx="12" cy="14" r="1.2" fill="#6366f1"/><circle cx="16" cy="14" r="1.2" fill="#6366f1"/><circle cx="20" cy="14" r="1.2" fill="#6366f1"/></svg>);
  // 5.1 app icons
  if(id==="calculator")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="calc-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.08"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#1a1a1a"/><rect width="32" height="32" rx={r} fill="url(#calc-hl)"/>{/* Two stacked bars = clean equals sign. Most recognizable calculator
        symbol at small sizes. The orange "+" accent at the corner reads as
        "operator", reinforcing the math metaphor. */}<rect x="9" y="12.5" width="14" height="2.6" rx="1.3" fill="white"/><rect x="9" y="17.5" width="14" height="2.6" rx="1.3" fill="white"/><rect x="22.5" y="22.5" width="4.5" height="4.5" rx="1.2" fill="#fb923c"/><text x="24.75" y="26.1" textAnchor="middle" fill="white" fontSize="4.5" fontWeight="700" fontFamily="sans-serif">+</text></svg>);

  if(id==="clock")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="clock-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.08"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#0ea5e9"/><rect width="32" height="32" rx={r} fill="url(#clock-hl)"/><circle cx="16" cy="16" r="10" fill="white"/><line x1="16" y1="16" x2="16" y2="9" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/><line x1="16" y1="16" x2="21" y2="16" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round"/><circle cx="16" cy="16" r="1.2" fill="#1a1a1a"/><circle cx="16" cy="7.8" r="0.55" fill="#1a1a1a"/><circle cx="24.2" cy="16" r="0.55" fill="#1a1a1a"/><circle cx="16" cy="24.2" r="0.55" fill="#1a1a1a"/><circle cx="7.8" cy="16" r="0.55" fill="#1a1a1a"/></svg>);

  if(id==="calendar")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="white"/><text x="16" y="13" textAnchor="middle" fill="#dc2626" fontSize="5.5" fontFamily="sans-serif" fontWeight="700" letterSpacing="0.5">{(new Date()).toLocaleDateString([],{weekday:'short'}).toUpperCase()}</text><text x="16" y="25" textAnchor="middle" fill="#1f2937" fontSize="13" fontFamily="sans-serif" fontWeight="600">{(new Date()).getDate()}</text></svg>);

  if(id==="music")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="music-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#e11d48"/><rect width="32" height="32" rx={r} fill="url(#music-hl)"/><ellipse cx="12.5" cy="21" rx="3" ry="2.5" fill="white"/><ellipse cx="22" cy="19" rx="3" ry="2.5" fill="white"/><rect x="15" y="9" width="1.6" height="13" fill="white"/><rect x="24.4" y="7" width="1.6" height="12.5" fill="white"/><path d="M15 9 Q20.5 7.5 26 7 L26 9 Q20.5 9.5 15 11 Z" fill="white"/></svg>);

  if(id==="pdf")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#fef2f2"/><path d="M8 4 L8 28 L24 28 L24 10 L18 4 Z" fill="white" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5"/><path d="M18 4 L18 10 L24 10 Z" fill="#fca5a5"/><rect x="10" y="18" width="12" height="6" rx="1" fill="#dc2626"/><text x="16" y="22.8" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">PDF</text></svg>);

  if(id==="atmos")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="atmos-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#0ea5e9"/><rect width="32" height="32" rx={r} fill="url(#atmos-hl)"/><circle cx="11.5" cy="11.5" r="4.2" fill="#fde047"/><path d="M9 18.5 Q9 16.5 11.5 16.5 Q12 14.5 14.5 14.5 Q16.5 12.5 19 14.5 Q22 13.8 23 17 Q25 17 25 19.5 Q25 22 22.5 22 L11.5 22 Q9 22 9 19.5 Z" fill="white"/></svg>);
  if(id==="minesweeper")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="mine-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.12"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs>{/* Slate background, just a centered bomb glyph with lit fuse. The
        old icon tried to render the whole game (grid + numbers + bomb)
        and got muddy at 32px. Single iconic glyph reads instantly. */}<rect width="32" height="32" rx={r} fill="#475569"/><rect width="32" height="32" rx={r} fill="url(#mine-hl)"/>{/* Bomb body */}<circle cx="16" cy="19" r="7" fill="#0f172a"/>{/* Subtle highlight on the bomb (sphere shading) */}<circle cx="13.5" cy="16.5" r="1.6" fill="rgba(255,255,255,0.32)"/>{/* Fuse */}<path d="M16 12 Q18.5 9 20 7" stroke="#0f172a" strokeWidth="1.6" fill="none" strokeLinecap="round"/>{/* Spark — yellow core + white hot center */}<circle cx="20.5" cy="6" r="1.8" fill="#fbbf24"/><circle cx="20.5" cy="6" r="0.9" fill="white"/></svg>);
  if(id==="wordle")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f172a"/><rect x="3" y="9" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="5.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">N</text><rect x="9" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><text x="11.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">O</text><rect x="15" y="9" width="5" height="6" rx="0.5" fill="#fbbf24"/><text x="17.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">V</text><rect x="21" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><text x="23.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">A</text><rect x="11" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="13.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">5</text><rect x="17" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="19.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">.2</text></svg>);
  if(id==="tetris")return(<svg width={w} height={h} viewBox="0 0 32 32">{/* Two recognizable pieces — a purple T on top and a cyan I-bar
        across the bottom — instead of trying to render the whole
        playfield. Bigger blocks, more breathing room. */}<rect width="32" height="32" rx={r} fill="#18181b"/>{/* T-piece (purple) — three across + one below middle */}<rect x="8.5" y="6.5" width="5" height="5" rx="0.6" fill="#a855f7"/><rect x="13.5" y="6.5" width="5" height="5" rx="0.6" fill="#a855f7"/><rect x="18.5" y="6.5" width="5" height="5" rx="0.6" fill="#a855f7"/><rect x="13.5" y="11.5" width="5" height="5" rx="0.6" fill="#a855f7"/>{/* I-piece (cyan) — four-block bar across the bottom */}<rect x="5.5" y="20.5" width="5" height="5" rx="0.6" fill="#22d3ee"/><rect x="10.5" y="20.5" width="5" height="5" rx="0.6" fill="#22d3ee"/><rect x="15.5" y="20.5" width="5" height="5" rx="0.6" fill="#22d3ee"/><rect x="20.5" y="20.5" width="5" height="5" rx="0.6" fill="#22d3ee"/></svg>);
  if(id==="novaai")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="ai-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#a855f7"/><rect width="32" height="32" rx={r} fill="url(#ai-hl)"/><path d="M16 7 L18.5 13.5 L25 16 L18.5 18.5 L16 25 L13.5 18.5 L7 16 L13.5 13.5 Z" fill="white"/><circle cx="23" cy="10" r="1.3" fill="white"/><circle cx="9" cy="22" r="1" fill="rgba(255,255,255,0.85)"/></svg>);

  // ── v8.0: icons for the v7.4 games + Photos. Same middle-ground treatment
  // (flat colors with a soft upper-left highlight, no candy gradients).
  if(id==="photos")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="photos-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient><radialGradient id="photos-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.16"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient>{/* Clip everything to the rounded-rect shape so the mountain paths
            don't bleed past the corner radius. Fixes the "icon cuts off"
            issue where the dark teal extended into the corner pixels that
            the rounded background didn't cover. */}<clipPath id="photos-clip"><rect width="32" height="32" rx={r}/></clipPath></defs><g clipPath="url(#photos-clip)"><rect width="32" height="32" fill="url(#photos-sky)"/><rect width="32" height="32" fill="url(#photos-hl)"/>{/* Sun */}<circle cx="10.5" cy="11" r="2.8" fill="white"/>{/* Mountain silhouette — back layer */}<path d="M0 32 L0 22 L8 14 L13 19 L18 12 L22 16 L27 11 L32 17 L32 32 Z" fill="#0e7490"/>{/* Foreground darker layer */}<path d="M0 32 L0 26 L6 22 L11 25 L17 21 L24 24 L32 22 L32 32 Z" fill="#155e75" opacity="0.85"/></g></svg>);

  // ── Game icons (simplified). Each one strips down to a single recognizable
  // glyph. Previous round was too cluttered at 32×32. Rule of thumb: if I
  // can't recognize it from across a room, simplify further.

  // TicTacToe — just the # grid. Clean and instantly readable.
  if(id==="tictactoe")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="ttt-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#0ea5e9"/><rect width="32" height="32" rx={r} fill="url(#ttt-hl)"/><line x1="13" y1="6" x2="13" y2="26" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><line x1="20" y1="6" x2="20" y2="26" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><line x1="6" y1="13" x2="26" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><line x1="6" y1="20" x2="26" y2="20" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>);

  // Pong — just two paddles and a ball. No dashed line clutter.
  if(id==="pong")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#18181b"/><rect x="5" y="10" width="2.8" height="12" rx="1.4" fill="white"/><rect x="24.2" y="10" width="2.8" height="12" rx="1.4" fill="white"/><circle cx="16" cy="16" r="2.2" fill="white"/></svg>);

  // Flappy Bird — single yellow bird, no clouds or extra detail.
  if(id==="flappy")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="flappy-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#38bdf8"/><rect width="32" height="32" rx={r} fill="url(#flappy-hl)"/>{/* Bird: yellow body + wing + eye + beak */}<circle cx="15" cy="16" r="7" fill="#fde047"/><path d="M11 16.5 Q13 19.5 16 19.5 Q15 16.5 11 16.5 Z" fill="#fbbf24"/><circle cx="17.5" cy="14" r="1.4" fill="white"/><circle cx="17.7" cy="14" r="0.7" fill="#1f2937"/><path d="M21 16 L25 15.2 L21 17.2 Z" fill="#fb923c"/></svg>);

  // Space Invaders — just the alien, centered and larger.
  if(id==="invaders")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f172a"/>{/* Centered alien pixel sprite, scaled up vs round-3 */}{[[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[2,2],[4,2],[1,3],[3,3]].map(([c,rr],i)=><rect key={i} x={8+c*3.2} y={9+rr*3.2} width="3" height="3" fill="#4cef90"/>)}</svg>);

  // Pac-Man — just the iconic shape, bigger, no pellets.
  if(id==="pacman")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f0a24"/>{/* Pac-Man: mouth open at 45° toward upper-right */}<path d="M16 16 L28 8 A13 13 0 1 0 28 24 Z" fill="#fde047"/><circle cx="14" cy="11" r="1.3" fill="#0f0a24"/></svg>);

  // Chess — clean white king silhouette on dark navy. No checker grid,
  // no brown wood tone. Reads as "chess piece" instantly.
  if(id==="chess")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="chess-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.12"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#1e293b"/><rect width="32" height="32" rx={r} fill="url(#chess-hl)"/>{/* King: cross + crown + body */}<rect x="15.2" y="5.5" width="1.6" height="4" rx="0.4" fill="white"/><rect x="14" y="6.6" width="4" height="1.4" rx="0.4" fill="white"/><path d="M11 12 L21 12 L21 14.5 L23 16.5 L23 24 Q23 25 22 25 L10 25 Q9 25 9 24 L9 16.5 L11 14.5 Z" fill="white"/><rect x="9" y="24.5" width="14" height="2.5" rx="0.8" fill="white"/></svg>);

  return null; // unknown id — caller falls back to app.icon emoji
}

// Store app icon using Clearbit logo API with emoji fallback
export function StoreIcon({ domain, fallback, size = 26 }) {
  const [failed, setFailed] = useState(false);
  if (failed || !domain) {
    return <span style={{fontSize: size*0.88, lineHeight: 1, display: "block"}}>{fallback}</span>;
  }
  return (
    <img
      src={"https://logo.clearbit.com/" + domain}
      width={size} height={size}
      style={{borderRadius: Math.max(3, size*0.2), objectFit: "contain", display: "block"}}
      onError={() => setFailed(true)}
      alt=""
    />
  );
}

// ── v8.4 Store revamp: cohesive hand-drawn brand icons ──────────────────────
// The old Store leaned on Clearbit logo PNGs — different sizes, paddings, and
// design eras crammed together, which read as amateur. StoreBrandIcon replaces
// that with a unified rounded-square set in the Nova aesthetic: recognizable
// brands get a custom-drawn glyph; the rest get a clean monogram tile tinted
// with the brand accent (STORE_META[id].accent). Community apps (no catalog
// id) fall back to their chosen emoji on a neutral tile.
//
// Each branded glyph is authored in a 0–32 coordinate space. The background
// rect uses a FIXED rx of 7 (≈22% of the 32-unit box) so the rounded-square
// fills its footprint identically at every display size — passing a pixel
// radius in here (the old bug) over-rounded big tiles into blobs that pulled
// away from the square corners.
const BG_RX = 7;
function storeBrandSvg(id) {
  switch (id) {
    case "roblox": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#0084ff"/>
      <g transform="rotate(-13 16 16)">
        <rect x="10" y="10" width="12" height="12" rx="1.6" fill="#fff"/>
        <rect x="13.7" y="13.7" width="4.6" height="4.6" rx="0.6" fill="#0084ff"/>
      </g>
    </>);
    case "youtube": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#ff0000"/>
      <path d="M13.2 10.4 L22.6 16 L13.2 21.6 Z" fill="#fff"/>
    </>);
    case "spotify": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#1db954"/>
      <path d="M8.8 13.4 Q16 11.2 23.6 14.6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
      <path d="M10 17.4 Q16 15.6 22 18.4" stroke="#fff" strokeWidth="2.1" fill="none" strokeLinecap="round"/>
      <path d="M11 21 Q16 19.5 20.6 21.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </>);
    case "steam": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#1b2838"/>
      <circle cx="13.2" cy="19.2" r="5.4" fill="none" stroke="#66c0f4" strokeWidth="2"/>
      <circle cx="13.2" cy="19.2" r="1.7" fill="#66c0f4"/>
      <line x1="17" y1="15.4" x2="20.4" y2="11.6" stroke="#66c0f4" strokeWidth="1.5"/>
      <circle cx="21.4" cy="10.6" r="3.3" fill="#66c0f4"/>
    </>);
    case "ps": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#0070d1"/>
      <text x="16" y="21.6" textAnchor="middle" fontFamily="'Space Grotesk',sans-serif" fontWeight="800" fontStyle="italic" fontSize="13" fill="#fff">PS</text>
    </>);
    case "xbox": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#107c10"/>
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2"/>
      <line x1="10.6" y1="10.6" x2="21.4" y2="21.4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      <line x1="21.4" y1="10.6" x2="10.6" y2="21.4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </>);
    case "twitch": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#9146ff"/>
      <path d="M10 7 L24 7 L24 18 L20 22 L16.4 22 L13.4 25 L13.4 22 L10 22 Z" fill="#fff"/>
      <rect x="14.4" y="11" width="1.8" height="5" fill="#9146ff"/>
      <rect x="18.6" y="11" width="1.8" height="5" fill="#9146ff"/>
    </>);
    case "github": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#1f2328"/>
      <path d="M11 9 L9.4 5.4 L13.6 8 Z" fill="#fff"/>
      <path d="M21 9 L22.6 5.4 L18.4 8 Z" fill="#fff"/>
      <circle cx="16" cy="15.2" r="7.4" fill="#fff"/>
      <circle cx="13" cy="14.6" r="1.4" fill="#1f2328"/>
      <circle cx="19" cy="14.6" r="1.4" fill="#1f2328"/>
      <path d="M22.6 18 Q26.8 20 23.8 24.2" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    </>);
    case "discord": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#5865f2"/>
      {/* Clyde face — wider than tall (the brand mark's true proportions). */}
      <path d="M8.5 12 Q16 9.6 23.5 12 Q25.2 16 23.4 20.4 Q20.6 22.4 18.2 21 Q16 21.6 13.8 21 Q11.4 22.4 8.6 20.4 Q6.8 16 8.5 12 Z" fill="#fff"/>
      <ellipse cx="13" cy="15.8" rx="1.5" ry="1.9" fill="#5865f2"/>
      <ellipse cx="19" cy="15.8" rx="1.5" ry="1.9" fill="#5865f2"/>
    </>);
    case "reddit": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#ff4500"/>
      <line x1="18" y1="9.5" x2="20.2" y2="6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="20.4" cy="5.6" r="1.5" fill="#fff"/>
      <ellipse cx="16" cy="18" rx="9" ry="6.4" fill="#fff"/>
      <circle cx="7.6" cy="16.6" r="2.4" fill="#fff"/>
      <circle cx="24.4" cy="16.6" r="2.4" fill="#fff"/>
      <circle cx="13" cy="17.4" r="1.5" fill="#ff4500"/>
      <circle cx="19" cy="17.4" r="1.5" fill="#ff4500"/>
      <path d="M12.8 21 Q16 23.2 19.2 21" stroke="#ff4500" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    </>);
    case "twitter": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#0f1419"/>
      <line x1="10.8" y1="9.5" x2="20.8" y2="22.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
      <line x1="21" y1="9.5" x2="11" y2="22.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
    </>);
    case "figma": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#2c2c2c"/>
      <rect x="9.6" y="7" width="6.6" height="6" rx="3" fill="#f24e1e"/>
      <rect x="9.6" y="13" width="6.6" height="6" rx="3" fill="#a259ff"/>
      <rect x="9.6" y="19" width="6.6" height="6" rx="3" fill="#0acf83"/>
      <rect x="16.2" y="7" width="6.6" height="6" rx="3" fill="#ff7262"/>
      <circle cx="19.5" cy="16" r="3.3" fill="#1abcfe"/>
    </>);
    case "notion": return (<>
      <rect width="32" height="32" rx={BG_RX} fill="#fff"/>
      <rect x="0.6" y="0.6" width="30.8" height="30.8" rx={BG_RX} fill="none" stroke="rgba(0,0,0,0.12)"/>
      <text x="16" y="22.4" textAnchor="middle" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="17" fill="#191919">N</text>
    </>);
    case "instagram": return (<>
      <defs>
        <radialGradient id="ig-grad" cx="28%" cy="105%" r="130%">
          <stop offset="0%" stopColor="#ffd87a"/>
          <stop offset="28%" stopColor="#fc6c3f"/>
          <stop offset="55%" stopColor="#e0257c"/>
          <stop offset="100%" stopColor="#6b34d4"/>
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx={BG_RX} fill="url(#ig-grad)"/>
      <rect x="9" y="9" width="14" height="14" rx="4.6" fill="none" stroke="#fff" strokeWidth="2"/>
      <circle cx="16" cy="16" r="3.7" fill="none" stroke="#fff" strokeWidth="2"/>
      <circle cx="20.6" cy="11.4" r="1.15" fill="#fff"/>
    </>);
    case "tiktok": {
      const note = (color, dx, dy) => (
        <g fill={color} transform={`translate(${dx},${dy})`}>
          <rect x="16.2" y="7" width="2.4" height="10.6"/>
          <path d="M18.6 7 Q23.2 7.4 23.8 11.4 Q21.4 9.6 18.6 9.9 Z"/>
          <circle cx="14.6" cy="17.2" r="3.5"/>
        </g>
      );
      return (<>
        <rect width="32" height="32" rx={BG_RX} fill="#010101"/>
        {note("#25f4ee", -1.1, 1)}
        {note("#fe2c55", 1.1, -1)}
        {note("#ffffff", 0, 0)}
      </>);
    }
    default: return null; // no custom glyph — caller renders a monogram tile
  }
}

export function StoreBrandIcon({ app, size = 44 }) {
  const id = app?.id;
  const r = Math.round(size * 0.22);
  // v9.0 — a community app can carry an uploaded logo (base64); show it as the icon.
  if (app?.iconImg) {
    return <div style={{ width: size, height: size, borderRadius: r, backgroundImage: `url("${app.iconImg}")`, backgroundSize: "cover", backgroundPosition: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.08)" }}/>;
  }
  const glyph = id ? storeBrandSvg(id) : null;
  if (glyph) {
    // The bg rect inside the glyph already rounds the square (rx=7 in viewBox
    // units), so we DON'T also clip the <svg> element — that mismatch was what
    // made the background look like it didn't fill the square. A hairline ring
    // keeps the rounded-square edge readable even for dark icons (Steam, X…).
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: "block" }}>
        {glyph}
        <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="6.4" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1"/>
      </svg>
    );
  }
  const accent = id && STORE_META[id] ? STORE_META[id].accent : null;
  if (accent) {
    // Monogram tile — first letter of the app name on the brand accent.
    const letter = (app.name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "?";
    return (
      <div style={{ width: size, height: size, borderRadius: r, background: accent, border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: size * 0.46, color: "#fff", lineHeight: 1 }}>{letter}</span>
      </div>
    );
  }
  // Community / unknown app — emoji on a neutral tile.
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.55, lineHeight: 1 }}>{app?.icon || "📦"}</div>
  );
}

// Unified icon display — picks SVG for built-in, Clearbit for store apps,
// emoji for everything else (new apps without custom SVGs yet).
//
// v7.7: emoji fallbacks now render inside a sized rounded box that matches
// the SVG icons' footprint exactly. Previously emoji rendered as a bare
// glyph at 85% of `size`, making apps like the v7.4 games (Tic-Tac-Toe,
// Pac-Man, Chess, etc.) look visually smaller than the SVG-icon apps on
// the desktop. Now every app fills the same WxH box regardless of source.
// v9.0 — iOS "liquid glass" coating for app icons when Liquid Glass is on.
// Frosts whatever's behind the icon (wallpaper on the desktop, the panel in
// menus/taskbar), drops the icon to ~80% so it reads as translucent, and lays
// a diagonal sheen + rim highlight on top for the pane-of-glass feel.
function GlassIcon({ size, children }) {
  const r = Math.round(size * 0.24);
  return (
    <div style={{
      position: "relative", width: size, height: size, borderRadius: r, overflow: "hidden",
      backdropFilter: "blur(4px) saturate(1.5)", WebkitBackdropFilter: "blur(4px) saturate(1.5)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3), inset 0 1.5px 1px rgba(255,255,255,0.45), 0 2px 7px rgba(0,0,0,0.28)",
    }}>
      <div style={{ opacity: 0.82 }}>{children}</div>
      <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.1) 34%, rgba(255,255,255,0) 58%)" }}/>
    </div>
  );
}

// v9.0 — TRUE clear-glass icon redraw (the look you actually want): the glyph
// is re-rendered in white/frosted glass on a CLEAR, colorless tile (no brand
// color), with backdrop-blur so the wallpaper frosts through + a sheen on top.
// Prototyped on a few icons first; the rest fall back to the coating until the
// whole set is redrawn. Glyph shapes mirror their dark-mode NovaSvgIcon, white.
function glassGlyph(id) {
  const W = "rgba(255,255,255,0.95)", Wd = "rgba(255,255,255,0.72)", Wf = "rgba(255,255,255,0.48)", hole = "rgba(255,255,255,0.2)";
  switch (id) {
    case "notes": return (<>
      <rect x="7" y="10" width="18" height="2.4" rx="1.2" fill={W}/>
      <rect x="7" y="15" width="14" height="2.4" rx="1.2" fill={Wd}/>
      <rect x="7" y="20" width="16" height="2.4" rx="1.2" fill={Wd}/>
    </>);
    case "tasks": return (<>
      <circle cx="11" cy="11.5" r="4.2" fill={W}/>
      <polyline points="8.8,11.5 10.4,13 13.2,9.8" stroke={hole} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="17.5" y="10.2" width="9" height="2.4" rx="1.2" fill={W}/>
      <circle cx="11" cy="21" r="4.2" fill="none" stroke={W} strokeWidth="1.4"/>
      <rect x="17.5" y="19.8" width="7" height="2.4" rx="1.2" fill={Wd}/>
    </>);
    case "files": return <path d="M6 13 Q6 11 8 11 L13 11 L15 13 L24 13 Q26 13 26 15 L26 23 Q26 25 24 25 L8 25 Q6 25 6 23 Z" fill={W}/>;
    case "paint": return (<>
      <circle cx="10.5" cy="11.5" r="2.3" fill={W}/><circle cx="17" cy="9" r="2.3" fill={Wd}/><circle cx="23" cy="13" r="2.3" fill={W}/><circle cx="22" cy="21" r="2.3" fill={Wd}/><circle cx="14" cy="22.5" r="2.3" fill={Wf}/>
    </>);
    case "browser": return (<>
      <circle cx="16" cy="16" r="8.5" fill="none" stroke={W} strokeWidth="1.6"/>
      <ellipse cx="16" cy="16" rx="4" ry="8.5" fill="none" stroke={W} strokeWidth="1.3"/>
      <line x1="7.5" y1="16" x2="24.5" y2="16" stroke={W} strokeWidth="1.3"/>
    </>);
    case "snake": return (<>
      <path d="M7 23 Q7 14 13 14 Q19 14 19 10 Q19 7 22 7" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <circle cx="22" cy="7" r="3.3" fill={W}/><circle cx="20.8" cy="6.2" r="0.7" fill={hole}/><circle cx="23.2" cy="6.2" r="0.7" fill={hole}/>
    </>);
    case "2048": return (<>
      <rect x="6" y="6" width="8" height="8" rx="1.5" fill={hole}/><rect x="18" y="6" width="8" height="8" rx="1.5" fill={Wf}/><rect x="6" y="18" width="8" height="8" rx="1.5" fill={Wf}/><rect x="18" y="18" width="8" height="8" rx="1.5" fill={W}/>
      <text x="22" y="25.2" textAnchor="middle" fill={hole} fontSize="7.5" fontWeight="700" fontFamily="sans-serif">8</text>
    </>);
    case "store": return (<>
      <path d="M9 12 L9 24 Q9 25.5 10.5 25.5 L21.5 25.5 Q23 25.5 23 24 L23 12 Z" fill={W}/>
      <path d="M12 13 L12 11 Q12 8 16 8 Q20 8 20 11 L20 13" stroke={W} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <circle cx="16" cy="17.5" r="2" fill={hole}/>
    </>);
    case "terminal": return (<>
      <polyline points="8,11 12,16 8,21" stroke={W} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="14" y1="22" x2="24" y2="22" stroke={W} strokeWidth="2.2" strokeLinecap="round"/>
    </>);
    case "settings": {
      const sp = [0,45,90,135,180,225,270,315].map(d => { const a = d*Math.PI/180; return { x1:16+6.5*Math.cos(a), y1:16+6.5*Math.sin(a), x2:16+9.8*Math.cos(a), y2:16+9.8*Math.sin(a) }; });
      return (<>{sp.map((s,i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={W} strokeWidth="2.4" strokeLinecap="round"/>)}<circle cx="16" cy="16" r="4.5" fill={W}/><circle cx="16" cy="16" r="1.8" fill={hole}/></>);
    }
    case "profile": return (<>
      <circle cx="16" cy="12.5" r="5" fill={W}/>
      <path d="M6 27 Q6 21 16 21 Q26 21 26 27 L26 32 L6 32 Z" fill={W}/>
    </>);
    case "chat": return (<>
      <path d="M6 9 Q6 7 8 7 L24 7 Q26 7 26 9 L26 19 Q26 21 24 21 L14 21 L9 25.5 L9.5 21 L8 21 Q6 21 6 19 Z" fill={W}/>
      <circle cx="12" cy="14" r="1.2" fill={hole}/><circle cx="16" cy="14" r="1.2" fill={hole}/><circle cx="20" cy="14" r="1.2" fill={hole}/>
    </>);
    case "calculator": return (<>
      <rect x="9" y="12.5" width="14" height="2.6" rx="1.3" fill={W}/><rect x="9" y="17.5" width="14" height="2.6" rx="1.3" fill={W}/>
      <rect x="22.5" y="22.5" width="4.5" height="4.5" rx="1.2" fill={Wd}/><text x="24.75" y="26.1" textAnchor="middle" fill={hole} fontSize="4.5" fontWeight="700" fontFamily="sans-serif">+</text>
    </>);
    case "clock": return (<>
      <circle cx="16" cy="16" r="10" fill={W}/>
      <line x1="16" y1="16" x2="16" y2="9" stroke={hole} strokeWidth="1.6" strokeLinecap="round"/><line x1="16" y1="16" x2="21" y2="16" stroke={hole} strokeWidth="1.4" strokeLinecap="round"/><circle cx="16" cy="16" r="1.2" fill={hole}/>
    </>);
    case "calendar": return (<>
      <rect x="5" y="6" width="22" height="21" rx="2.5" fill="none" stroke={W} strokeWidth="1.5"/>
      <text x="16" y="14" textAnchor="middle" fill={Wd} fontSize="5.5" fontFamily="sans-serif" fontWeight="700" letterSpacing="0.5">{(new Date()).toLocaleDateString([],{weekday:'short'}).toUpperCase()}</text>
      <text x="16" y="24" textAnchor="middle" fill={W} fontSize="11" fontFamily="sans-serif" fontWeight="700">{(new Date()).getDate()}</text>
    </>);
    case "music": return (<>
      <ellipse cx="12.5" cy="21" rx="3" ry="2.5" fill={W}/><ellipse cx="22" cy="19" rx="3" ry="2.5" fill={W}/>
      <rect x="15" y="9" width="1.6" height="13" fill={W}/><rect x="24.4" y="7" width="1.6" height="12.5" fill={W}/>
      <path d="M15 9 Q20.5 7.5 26 7 L26 9 Q20.5 9.5 15 11 Z" fill={W}/>
    </>);
    case "pdf": return (<>
      <path d="M8 4 L8 28 L24 28 L24 10 L18 4 Z" fill={W}/><path d="M18 4 L18 10 L24 10 Z" fill={Wd}/>
      <rect x="10" y="18" width="12" height="6" rx="1" fill={hole}/><text x="16" y="22.8" textAnchor="middle" fill={W} fontSize="4.5" fontFamily="sans-serif" fontWeight="800">PDF</text>
    </>);
    case "atmos": return (<>
      <circle cx="11.5" cy="11.5" r="4.2" fill={Wd}/>
      <path d="M9 18.5 Q9 16.5 11.5 16.5 Q12 14.5 14.5 14.5 Q16.5 12.5 19 14.5 Q22 13.8 23 17 Q25 17 25 19.5 Q25 22 22.5 22 L11.5 22 Q9 22 9 19.5 Z" fill={W}/>
    </>);
    case "minesweeper": return (<>
      <circle cx="16" cy="19" r="7" fill={W}/><circle cx="13.5" cy="16.5" r="1.6" fill={hole}/>
      <path d="M16 12 Q18.5 9 20 7" stroke={W} strokeWidth="1.6" fill="none" strokeLinecap="round"/><circle cx="20.5" cy="6" r="1.8" fill={Wd}/><circle cx="20.5" cy="6" r="0.9" fill={W}/>
    </>);
    case "wordle": return (<>
      <rect x="4" y="9" width="5.5" height="6.5" rx="1" fill={W}/><rect x="10.5" y="9" width="5.5" height="6.5" rx="1" fill={hole}/><rect x="17" y="9" width="5.5" height="6.5" rx="1" fill={Wd}/>
      <rect x="7.25" y="16.5" width="5.5" height="6.5" rx="1" fill={Wd}/><rect x="13.75" y="16.5" width="5.5" height="6.5" rx="1" fill={W}/>
    </>);
    case "tetris": return (<>
      <rect x="8.5" y="6.5" width="5" height="5" rx="0.6" fill={W}/><rect x="13.5" y="6.5" width="5" height="5" rx="0.6" fill={W}/><rect x="18.5" y="6.5" width="5" height="5" rx="0.6" fill={W}/><rect x="13.5" y="11.5" width="5" height="5" rx="0.6" fill={W}/>
      <rect x="5.5" y="20.5" width="5" height="5" rx="0.6" fill={Wd}/><rect x="10.5" y="20.5" width="5" height="5" rx="0.6" fill={Wd}/><rect x="15.5" y="20.5" width="5" height="5" rx="0.6" fill={Wd}/><rect x="20.5" y="20.5" width="5" height="5" rx="0.6" fill={Wd}/>
    </>);
    case "novaai": return (<>
      <path d="M16 7 L18.5 13.5 L25 16 L18.5 18.5 L16 25 L13.5 18.5 L7 16 L13.5 13.5 Z" fill={W}/>
      <circle cx="23" cy="10" r="1.3" fill={Wd}/><circle cx="9" cy="22" r="1" fill={Wf}/>
    </>);
    case "photos": return (<>
      <circle cx="10.5" cy="11" r="2.8" fill={W}/>
      <path d="M0 32 L0 22 L8 14 L13 19 L18 12 L22 16 L27 11 L32 17 L32 32 Z" fill={Wf}/>
      <path d="M0 32 L0 26 L6 22 L11 25 L17 21 L24 24 L32 22 L32 32 Z" fill={Wd}/>
    </>);
    case "tictactoe": return (<>
      <line x1="13" y1="6" x2="13" y2="26" stroke={W} strokeWidth="2.2" strokeLinecap="round"/><line x1="20" y1="6" x2="20" y2="26" stroke={W} strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="6" y1="13" x2="26" y2="13" stroke={W} strokeWidth="2.2" strokeLinecap="round"/><line x1="6" y1="20" x2="26" y2="20" stroke={W} strokeWidth="2.2" strokeLinecap="round"/>
    </>);
    case "pong": return (<>
      <rect x="5" y="10" width="2.8" height="12" rx="1.4" fill={W}/><rect x="24.2" y="10" width="2.8" height="12" rx="1.4" fill={W}/><circle cx="16" cy="16" r="2.2" fill={W}/>
    </>);
    case "flappy": return (<>
      <circle cx="15" cy="16" r="7" fill={Wd}/><path d="M11 16.5 Q13 19.5 16 19.5 Q15 16.5 11 16.5 Z" fill={Wf}/><circle cx="17.5" cy="14" r="1.4" fill={W}/><circle cx="17.7" cy="14" r="0.7" fill={hole}/><path d="M21 16 L25 15.2 L21 17.2 Z" fill={W}/>
    </>);
    case "invaders": return (<>{[[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[2,2],[4,2],[1,3],[3,3]].map(([c,rr],i) => <rect key={i} x={8+c*3.2} y={9+rr*3.2} width="3" height="3" fill={W}/>)}</>);
    case "pacman": return (<>
      <path d="M16 16 L28 8 A13 13 0 1 0 28 24 Z" fill={W}/><circle cx="14" cy="11" r="1.3" fill={hole}/>
    </>);
    case "chess": return (<>
      <rect x="15.2" y="5.5" width="1.6" height="4" rx="0.4" fill={W}/><rect x="14" y="6.6" width="4" height="1.4" rx="0.4" fill={W}/>
      <path d="M11 12 L21 12 L21 14.5 L23 16.5 L23 24 Q23 25 22 25 L10 25 Q9 25 9 24 L9 16.5 L11 14.5 Z" fill={W}/><rect x="9" y="24.5" width="14" height="2.5" rx="0.8" fill={W}/>
    </>);
    default: return null;
  }
}
const GLASS_GLYPHS = new Set(["notes","tasks","files","paint","browser","snake","2048","store","terminal","settings","profile","chat","calculator","clock","calendar","music","pdf","atmos","minesweeper","wordle","tetris","novaai","photos","tictactoe","pong","flappy","invaders","pacman","chess"]);

function GlassSvgIcon({ id, size }) {
  const r = Math.round(size * 0.24);
  const glyph = glassGlyph(id);
  if (!glyph) return null;
  return (
    <div style={{
      position: "relative", width: size, height: size, borderRadius: r, overflow: "hidden",
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(6px) saturate(1.4)", WebkitBackdropFilter: "blur(6px) saturate(1.4)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.32), inset 0 2px 2px rgba(255,255,255,0.4), 0 3px 9px rgba(0,0,0,0.3)",
    }}>
      <svg width="100%" height="100%" viewBox="0 0 32 32" style={{ display: "block", position: "relative" }}>{glyph}</svg>
      <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 36%, rgba(255,255,255,0) 60%)" }}/>
    </div>
  );
}

// Colorless-glass version of a store app icon: the app's first letter in white
// on the clear glass tile (brand glyphs/colors would be unrecognizable when
// stripped to glass, so a monogram is the clean colorless choice).
function GlassMonogram({ name, size }) {
  const letter = (name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "?";
  const r = Math.round(size * 0.24);
  return (
    <div style={{
      position: "relative", width: size, height: size, borderRadius: r, overflow: "hidden",
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(6px) saturate(1.4)", WebkitBackdropFilter: "blur(6px) saturate(1.4)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.32), inset 0 2px 2px rgba(255,255,255,0.4), 0 3px 9px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: size * 0.46, color: "rgba(255,255,255,0.95)", lineHeight: 1 }}>{letter}</span>
      <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 36%, rgba(255,255,255,0) 60%)" }}/>
    </div>
  );
}

export function AppIconDisplay({ app, size = 26, glass = false }) {
  // v11.0 — new macOS-style icon set takes precedence as apps are migrated.
  // (Falls through to legacy NovaSvgIcon / emoji for ids not yet redrawn.)
  if (!app.storeApp && NOVA_ICONS.has(app.id)) return <NovaAppIcon id={app.id} size={size} />;
  let inner;
  if (app.storeApp) {
    // v8.4: route store apps through the unified brand-icon set (was Clearbit).
    inner = <StoreBrandIcon app={app.storeApp} size={size}/>;
  } else if (HAS_SVG_ICON.has(app.id)) {
    inner = <NovaSvgIcon id={app.id} size={size}/>;
  } else {
    // Emoji-fallback: wrap in a same-sized box so layout matches SVG/Store icons.
    inner = (
      <div style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.22),
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.65, lineHeight: 1,
      }}>{app.icon || "📦"}</div>
    );
  }
  if (glass) {
    if (app.storeApp) return <GlassMonogram name={app.storeApp.name} size={size}/>;
    if (GLASS_GLYPHS.has(app.id)) return <GlassSvgIcon id={app.id} size={size}/>;
    return <GlassIcon size={size}>{inner}</GlassIcon>; // emoji-fallback apps → coating
  }
  return inner;
}

// v8.0 — Refined window-control glyphs. Previously inline unicode (—, ❐, ✕)
// which rendered inconsistently across platforms and had no centering control.
// These SVG versions are geometrically clean, perfectly centered in their
// hit box, and stroke-based (so they inherit `color` via currentColor).
export function WindowControlIcon({ type, size = 10 }) {
  // All glyphs render inside a 10x10 viewBox. Stroke width is tuned so
  // they all read at the same visual weight even though they're different
  // shapes — close (X) needs a slightly thicker stroke to feel balanced
  // against the rectangles.
  const stroke = 1.5;
  if (type === "minimize") {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none" style={{display:"block"}}>
        <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"/>
      </svg>
    );
  }
  if (type === "maximize") {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none" style={{display:"block"}}>
        <rect x="1.5" y="1.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth={stroke}/>
      </svg>
    );
  }
  if (type === "restore") {
    // Two stacked rectangles — back one peeks behind the front one (this is
    // the convention for "exit maximized state, go back to normal size")
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none" style={{display:"block"}}>
        <rect x="2.7" y="1.4" width="5.9" height="5.9" rx="1" stroke="currentColor" strokeWidth={stroke}/>
        <rect x="1.4" y="2.7" width="5.9" height="5.9" rx="1" fill="var(--bg, #0a0c18)" stroke="currentColor" strokeWidth={stroke}/>
      </svg>
    );
  }
  if (type === "close") {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none" style={{display:"block"}}>
        <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }
  return null;
}

// v11.0 — Nova OS brand mark: the official logo image, baked in. Rendered as a
// rounded square at any requested size — boot splash, login, taskbar start
// button, Store header. The matching favicon / PWA icons are the same artwork
// in /public/nova-icon*.png.
export function NovaLogo({ size = 22 }) {
  return (
    <img src={novaMarkImg} width={size} height={size} alt="Nova OS" draggable={false}
      style={{ display: "block", width: size, height: size, objectFit: "cover", borderRadius: Math.round(size * 0.22) }} />
  );
}

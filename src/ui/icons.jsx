// App icon rendering. Three layers:
//   1. NovaSvgIcon — custom-drawn SVG icons for the built-in apps
//   2. StoreIcon   — Clearbit logo API for external store apps (with emoji fallback)
//   3. AppIconDisplay — the unified picker, used everywhere (desktop, taskbar, menu, store)
//
// HAS_SVG_ICON (in ui/constants.js) determines which ids route to NovaSvgIcon.
// Anything else falls back to the app's emoji icon.

import { useState } from "react";
import { HAS_SVG_ICON } from "./constants.js";

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
  if(id==="calculator")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="calc-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.08"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#1f1f1f"/><rect width="32" height="32" rx={r} fill="url(#calc-hl)"/><rect x="6.5" y="7" width="19" height="5.5" rx="1.3" fill="#0a0a0a"/><text x="23.5" y="11.3" textAnchor="end" fill="white" fontSize="6" fontFamily="monospace" fontWeight="500">0</text>{[0,1,2].map(c=>[0,1,2].map(rr=><rect key={c+"-"+rr} x={6.5+c*4.5} y={14.5+rr*3.7} width="3.7" height="3" rx="0.7" fill="rgba(255,255,255,0.16)"/>))}<rect x="6.5" y="25.5" width="8.2" height="3" rx="0.7" fill="rgba(255,255,255,0.16)"/><rect x="19" y="14.5" width="6.5" height="14" rx="0.7" fill="#fb923c"/></svg>);

  if(id==="clock")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="clock-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.08"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#0ea5e9"/><rect width="32" height="32" rx={r} fill="url(#clock-hl)"/><circle cx="16" cy="16" r="10" fill="white"/><line x1="16" y1="16" x2="16" y2="9" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/><line x1="16" y1="16" x2="21" y2="16" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round"/><circle cx="16" cy="16" r="1.2" fill="#1a1a1a"/><circle cx="16" cy="7.8" r="0.55" fill="#1a1a1a"/><circle cx="24.2" cy="16" r="0.55" fill="#1a1a1a"/><circle cx="16" cy="24.2" r="0.55" fill="#1a1a1a"/><circle cx="7.8" cy="16" r="0.55" fill="#1a1a1a"/></svg>);

  if(id==="calendar")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="white"/><text x="16" y="13" textAnchor="middle" fill="#dc2626" fontSize="5.5" fontFamily="sans-serif" fontWeight="700" letterSpacing="0.5">{(new Date()).toLocaleDateString([],{weekday:'short'}).toUpperCase()}</text><text x="16" y="25" textAnchor="middle" fill="#1f2937" fontSize="13" fontFamily="sans-serif" fontWeight="600">{(new Date()).getDate()}</text></svg>);

  if(id==="music")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="music-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#a855f7"/><rect width="32" height="32" rx={r} fill="url(#music-hl)"/><ellipse cx="12.5" cy="21" rx="3" ry="2.5" fill="white"/><ellipse cx="22" cy="19" rx="3" ry="2.5" fill="white"/><rect x="15" y="9" width="1.6" height="13" fill="white"/><rect x="24.4" y="7" width="1.6" height="12.5" fill="white"/><path d="M15 9 Q20.5 7.5 26 7 L26 9 Q20.5 9.5 15 11 Z" fill="white"/></svg>);

  if(id==="pdf")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#fef2f2"/><path d="M8 4 L8 28 L24 28 L24 10 L18 4 Z" fill="white" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5"/><path d="M18 4 L18 10 L24 10 Z" fill="#fca5a5"/><rect x="10" y="18" width="12" height="6" rx="1" fill="#dc2626"/><text x="16" y="22.8" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">PDF</text></svg>);

  if(id==="atmos")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="atmos-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#0ea5e9"/><rect width="32" height="32" rx={r} fill="url(#atmos-hl)"/><circle cx="11.5" cy="11.5" r="4.2" fill="#fde047"/><path d="M9 18.5 Q9 16.5 11.5 16.5 Q12 14.5 14.5 14.5 Q16.5 12.5 19 14.5 Q22 13.8 23 17 Q25 17 25 19.5 Q25 22 22.5 22 L11.5 22 Q9 22 9 19.5 Z" fill="white"/></svg>);
  if(id==="minesweeper")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#475569"/><rect x="6" y="6" width="20" height="20" rx="1.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><rect x="6" y="13" width="20" height="0.5" fill="rgba(255,255,255,0.15)"/><rect x="6" y="20" width="20" height="0.5" fill="rgba(255,255,255,0.15)"/><rect x="12.7" y="6" width="0.5" height="20" fill="rgba(255,255,255,0.15)"/><rect x="19.3" y="6" width="0.5" height="20" fill="rgba(255,255,255,0.15)"/><circle cx="16" cy="16.5" r="3.5" fill="#0f172a"/><circle cx="14.8" cy="15.3" r="0.7" fill="rgba(255,255,255,0.7)"/><line x1="16" y1="11.5" x2="16" y2="13" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><line x1="11.5" y1="16.5" x2="13" y2="16.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><line x1="19" y1="16.5" x2="20.5" y2="16.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><line x1="16" y1="20" x2="16" y2="21.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><text x="9" y="11" fill="#88c8ff" fontSize="4" fontFamily="monospace" fontWeight="700">2</text><text x="21" y="25" fill="#ff7878" fontSize="4" fontFamily="monospace" fontWeight="700">3</text></svg>);
  if(id==="wordle")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f172a"/><rect x="3" y="9" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="5.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">N</text><rect x="9" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><text x="11.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">O</text><rect x="15" y="9" width="5" height="6" rx="0.5" fill="#fbbf24"/><text x="17.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">V</text><rect x="21" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><text x="23.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">A</text><rect x="11" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="13.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">5</text><rect x="17" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="19.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">.2</text></svg>);
  if(id==="tetris")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#18181b"/><rect x="6" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="10" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="14" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="18" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="10" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="14" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="18" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="14" y="17" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="6" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/><rect x="10" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/><rect x="14" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/><rect x="6" y="18" width="4" height="4" rx="0.5" fill="#fb923c"/></svg>);
  if(id==="novaai")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="ai-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.2"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#a855f7"/><rect width="32" height="32" rx={r} fill="url(#ai-hl)"/><path d="M16 7 L18.5 13.5 L25 16 L18.5 18.5 L16 25 L13.5 18.5 L7 16 L13.5 13.5 Z" fill="white"/><circle cx="23" cy="10" r="1.3" fill="white"/><circle cx="9" cy="22" r="1" fill="rgba(255,255,255,0.85)"/></svg>);

  // ── v8.0: icons for the v7.4 games + Photos. Same middle-ground treatment
  // (flat colors with a soft upper-left highlight, no candy gradients).
  if(id==="photos")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="photos-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.16"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="white"/><rect width="32" height="32" rx={r} fill="url(#photos-hl)"/>{/* Six-petal pinwheel — like iOS Photos */}{[0,60,120,180,240,300].map(deg=>{const a=deg*Math.PI/180;const cx=16+4.5*Math.cos(a);const cy=16+4.5*Math.sin(a);const colors=["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#a855f7"];return<circle key={deg} cx={cx} cy={cy} r="4.5" fill={colors[deg/60]} opacity="0.82"/>})}<circle cx="16" cy="16" r="2.5" fill="white"/></svg>);

  if(id==="tictactoe")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="ttt-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#0ea5e9"/><rect width="32" height="32" rx={r} fill="url(#ttt-hl)"/><line x1="14" y1="7" x2="14" y2="25" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="7" x2="20" y2="25" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="20" x2="25" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><line x1="8.5" y1="8.5" x2="12.5" y2="12.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="12.5" y1="8.5" x2="8.5" y2="12.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><circle cx="23.5" cy="23.5" r="2" fill="none" stroke="white" strokeWidth="1.8"/></svg>);

  if(id==="pong")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#18181b"/><rect x="5" y="11" width="2.5" height="10" rx="1" fill="white"/><rect x="24.5" y="11" width="2.5" height="10" rx="1" fill="white"/><line x1="16" y1="7" x2="16" y2="11" stroke="rgba(255,255,255,0.32)" strokeWidth="1.3" strokeDasharray="2 2"/><line x1="16" y1="21" x2="16" y2="25" stroke="rgba(255,255,255,0.32)" strokeWidth="1.3" strokeDasharray="2 2"/><circle cx="16" cy="16" r="2" fill="white"/></svg>);

  if(id==="flappy")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="flappy-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.18"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#38bdf8"/><rect width="32" height="32" rx={r} fill="url(#flappy-hl)"/><ellipse cx="8" cy="9" rx="3.2" ry="1.3" fill="rgba(255,255,255,0.55)"/><ellipse cx="24" cy="22" rx="2.8" ry="1.2" fill="rgba(255,255,255,0.5)"/><circle cx="15" cy="16" r="5.5" fill="#fde047"/><path d="M13 16 Q14 18 16 18 Q15 16 13 16 Z" fill="#fbbf24"/><circle cx="17" cy="14.5" r="1.1" fill="white"/><circle cx="17.2" cy="14.5" r="0.55" fill="#1f2937"/><path d="M20 16 L23 15.5 L20 17 Z" fill="#fb923c"/></svg>);

  if(id==="invaders")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f172a"/>{[[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[2,2],[4,2],[1,3],[3,3]].map(([c,rr],i)=><rect key={i} x={9+c*2.8} y={8+rr*2.8} width="2.5" height="2.5" fill="#4cef90"/>)}<rect x="14.5" y="22" width="3" height="2.5" fill="white"/><rect x="11" y="24.5" width="10" height="2" fill="white"/></svg>);

  if(id==="pacman")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f0a24"/><path d="M16 16 L26 9 A11 11 0 1 0 26 23 Z" fill="#fde047"/><circle cx="15" cy="12" r="1.1" fill="#0f0a24"/><circle cx="9" cy="22" r="1.1" fill="white"/><circle cx="6" cy="14" r="0.7" fill="white"/></svg>);

  if(id==="chess")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="chess-hl" cx="20%" cy="20%" r="80%"><stop offset="0%" stopColor="white" stopOpacity="0.16"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="#e7e5e4"/><rect width="32" height="32" rx={r} fill="url(#chess-hl)"/>{[...Array(16)].map((_,i)=>{const c=i%4, rr=Math.floor(i/4);const dark=(c+rr)%2===1;return dark?<rect key={i} x={6+c*5} y={6+rr*5} width="5" height="5" fill="rgba(40,30,20,0.5)"/>:null})}<path d="M16 13 L16 11 M14.5 11.5 L17.5 11.5 M14 14 L18 14 L17.5 21 L14.5 21 Z" stroke="#1f2937" strokeWidth="1.4" fill="#1f2937" strokeLinejoin="round"/></svg>);

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

// Unified icon display — picks SVG for built-in, Clearbit for store apps,
// emoji for everything else (new apps without custom SVGs yet).
//
// v7.7: emoji fallbacks now render inside a sized rounded box that matches
// the SVG icons' footprint exactly. Previously emoji rendered as a bare
// glyph at 85% of `size`, making apps like the v7.4 games (Tic-Tac-Toe,
// Pac-Man, Chess, etc.) look visually smaller than the SVG-icon apps on
// the desktop. Now every app fills the same WxH box regardless of source.
export function AppIconDisplay({ app, size = 26 }) {
  if (app.storeApp) {
    return <StoreIcon domain={app.storeApp.domain} fallback={app.storeApp.icon} size={size}/>;
  }
  if (HAS_SVG_ICON.has(app.id)) {
    return <NovaSvgIcon id={app.id} size={size}/>;
  }
  // Emoji-fallback: wrap in a same-sized box so layout matches SVG/Store icons.
  return (
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

// v7.7 — Nova OS brand mark. Used in the taskbar start menu button (replaces
// the previous "◈" glyph) and re-usable for any future "Nova OS logo here"
// surface. Self-contained SVG so it scales cleanly at any size without
// pulling in the heavier filtered version from /public/nova-icon.svg.
export function NovaLogo({ size = 22 }) {
  const gradId = "novaLogoBg-" + size; // unique per render so multiple instances don't share id
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" style={{display: "block"}}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#6366f1"/>
          <stop offset="50%"  stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="200" fill={"url(#" + gradId + ")"}/>
      <text x="512" y="720" textAnchor="middle"
            fontFamily="Space Grotesk, Helvetica, sans-serif"
            fontSize="640" fontWeight="700" fill="white">N</text>
    </svg>
  );
}

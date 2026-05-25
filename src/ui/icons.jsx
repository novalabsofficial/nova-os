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
// v8.0 round-3 refresh: most icons now use vertical gradients (iOS convention)
// rather than flat fills. Glyphs were simplified to feel more iconographic
// and less illustrative. Colors lean toward iOS-standard hues (system Notes
// yellow, Reminders red-orange, Calendar white-on-red) where the metaphor
// maps cleanly. All gradient ids are namespaced with the app id to avoid
// collisions when multiple icons render in the same document.
export function NovaSvgIcon({ id, size = 26 }) {
  const r = Math.round(size * 0.22);
  const w = size, h = size;
  if(id==="notes")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="notes-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#notes-bg)"/><rect x="7" y="10" width="18" height="2" rx="1" fill="rgba(120,53,15,0.85)"/><rect x="7" y="15" width="14" height="2" rx="1" fill="rgba(120,53,15,0.55)"/><rect x="7" y="20" width="16" height="2" rx="1" fill="rgba(120,53,15,0.55)"/></svg>);
  if(id==="tasks")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="tasks-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#059669"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#tasks-bg)"/><circle cx="11" cy="11" r="4.5" fill="white"/><polyline points="8.8,11 10.5,12.6 13.3,9.6" stroke="#059669" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="18" y="9.6" width="8.5" height="2.4" rx="1.2" fill="white" opacity="0.9"/><circle cx="11" cy="21" r="4.5" fill="rgba(255,255,255,0.35)" stroke="white" strokeWidth="1.2"/><rect x="18" y="19.6" width="6.5" height="2.4" rx="1.2" fill="rgba(255,255,255,0.65)"/></svg>);
  if(id==="files")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="files-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc"/><stop offset="100%" stopColor="#0284c7"/></linearGradient><linearGradient id="files-folder" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#files-bg)"/><path d="M6 13 Q6 11 8 11 L13 11 L15 13 L24 13 Q26 13 26 15 L26 23 Q26 25 24 25 L8 25 Q6 25 6 23 Z" fill="url(#files-folder)"/><path d="M6 16 L26 16" stroke="rgba(120,53,15,0.18)" strokeWidth="0.6"/></svg>);
  if(id==="paint")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="paint-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#7c3aed"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#paint-bg)"/><circle cx="10.5" cy="11.5" r="2.4" fill="#ff5a5a"/><circle cx="17" cy="9" r="2.4" fill="#ffd84d"/><circle cx="23" cy="13" r="2.4" fill="#4cef90"/><circle cx="22" cy="21" r="2.4" fill="#4f9eff"/><circle cx="14" cy="22.5" r="2.4" fill="#fb923c"/><circle cx="16" cy="16" r="1.6" fill="white"/></svg>);
  if(id==="browser")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="browser-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67e8f9"/><stop offset="100%" stopColor="#0e7490"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#browser-bg)"/><circle cx="16" cy="16" r="8.5" fill="rgba(255,255,255,0.18)" stroke="white" strokeWidth="1.6"/><path d="M16 7.5 Q21.5 13 21.5 16 Q21.5 19 16 24.5 Q10.5 19 10.5 16 Q10.5 13 16 7.5 Z" fill="none" stroke="white" strokeWidth="1.4"/><line x1="7.5" y1="16" x2="24.5" y2="16" stroke="white" strokeWidth="1.4"/><circle cx="16" cy="16" r="1.5" fill="white"/></svg>);
  if(id==="snake")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="snake-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#86efac"/><stop offset="100%" stopColor="#15803d"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#snake-bg)"/><path d="M7 23 Q7 14 13 14 Q19 14 19 10 Q19 7 22 7" stroke="white" strokeWidth="3.6" fill="none" strokeLinecap="round"/><circle cx="22" cy="7" r="3.4" fill="white"/><circle cx="20.8" cy="6" r="0.7" fill="#15803d"/><circle cx="23.2" cy="6" r="0.7" fill="#15803d"/></svg>);
  if(id==="2048")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="g2048-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fed7aa"/><stop offset="100%" stopColor="#c2410c"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#g2048-bg)"/><rect x="6" y="6"  width="8" height="8"  rx="1.6" fill="rgba(255,255,255,0.32)"/><rect x="18" y="6"  width="8" height="8"  rx="1.6" fill="rgba(255,255,255,0.55)"/><rect x="6" y="18" width="8" height="8"  rx="1.6" fill="rgba(255,255,255,0.55)"/><rect x="18" y="18" width="8" height="8"  rx="1.6" fill="white"/><text x="22" y="25.4" textAnchor="middle" fill="#c2410c" fontSize="7.5" fontWeight="700" fontFamily="sans-serif">8</text></svg>);
  if(id==="store")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="store-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0e7490"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#store-bg)"/><circle cx="16" cy="16" r="9.5" fill="rgba(255,255,255,0.95)"/><path d="M16 10.5 Q15 13 13 13 Q13 14.5 14.5 15 L14 17 L13 19 Q15 19 15 17.5 L17 17.5 Q17 19 19 19 L18 17 L17.5 15 Q19 14.5 19 13 Q17 13 16 10.5 Z" fill="url(#store-bg)"/></svg>);
  if(id==="terminal")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="terminal-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#0f172a"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#terminal-bg)"/><polyline points="7,11 12,16 7,21" stroke="#4cef90" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="14" y1="22" x2="24" y2="22" stroke="#4cef90" strokeWidth="2.2" strokeLinecap="round"/></svg>);
  if(id==="settings"){
    const spokes=[0,45,90,135,180,225,270,315].map(deg=>{const a=deg*Math.PI/180;return{x1:16+6.5*Math.cos(a),y1:16+6.5*Math.sin(a),x2:16+10*Math.cos(a),y2:16+10*Math.sin(a)};});
    return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="settings-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8"/><stop offset="100%" stopColor="#475569"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#settings-bg)"/>{spokes.map((s,i)=><line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="white" strokeWidth="2.6" strokeLinecap="round"/>)}<circle cx="16" cy="16" r="4.8" fill="white"/><circle cx="16" cy="16" r="2" fill="#475569"/></svg>);
  }
  if(id==="profile")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="profile-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#profile-bg)"/><circle cx="16" cy="12.5" r="5" fill="white"/><path d="M6 28 Q6 21 16 21 Q26 21 26 28 L26 32 L6 32 Z" fill="white"/></svg>);
  if(id==="chat")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="chat-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#86efac"/><stop offset="100%" stopColor="#15803d"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#chat-bg)"/><path d="M6 9 Q6 7 8 7 L24 7 Q26 7 26 9 L26 19 Q26 21 24 21 L14 21 L9 25.5 L9.5 21 L8 21 Q6 21 6 19 Z" fill="white"/><circle cx="12" cy="14" r="1.2" fill="#15803d"/><circle cx="16" cy="14" r="1.2" fill="#15803d"/><circle cx="20" cy="14" r="1.2" fill="#15803d"/></svg>);
  // 5.1 app icons
  if(id==="calculator")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="calc-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f2937"/><stop offset="100%" stopColor="#0a0a0a"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#calc-bg)"/><rect x="6" y="6.5" width="20" height="6" rx="1.6" fill="#1a1a1a" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/><text x="24" y="11" textAnchor="end" fill="white" fontSize="6.5" fontFamily="monospace" fontWeight="500">0</text><rect x="6.5" y="14.5" width="4.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="12.5" y="14.5" width="4.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="18.5" y="14.5" width="4.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="24.5" y="14.5" width="3.5" height="3.6" rx="0.9" fill="#fb923c" style={{display:"none"}}/><rect x="6.5" y="19.2" width="4.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="12.5" y="19.2" width="4.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="18.5" y="19.2" width="4.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="6.5" y="23.9" width="10.5" height="3.6" rx="0.9" fill="rgba(255,255,255,0.18)"/><rect x="18.5" y="23.9" width="4.5" height="3.6" rx="0.9" fill="#fb923c"/></svg>);
  if(id==="clock")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="clock-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1a1a1a"/><stop offset="100%" stopColor="#000000"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#clock-bg)"/><circle cx="16" cy="16" r="10" fill="white"/><line x1="16" y1="16" x2="16" y2="9" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round"/><line x1="16" y1="16" x2="21" y2="16" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round"/><line x1="16" y1="16" x2="16.5" y2="22" stroke="#fb923c" strokeWidth="0.8" strokeLinecap="round"/><circle cx="16" cy="16" r="1.2" fill="#fb923c"/><circle cx="16" cy="7.8" r="0.6" fill="#1a1a1a"/><circle cx="24.2" cy="16" r="0.6" fill="#1a1a1a"/><circle cx="16" cy="24.2" r="0.6" fill="#1a1a1a"/><circle cx="7.8" cy="16" r="0.6" fill="#1a1a1a"/></svg>);
  if(id==="calendar")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="white"/><text x="16" y="13" textAnchor="middle" fill="#dc2626" fontSize="5.5" fontFamily="sans-serif" fontWeight="700" letterSpacing="0.5">{(new Date()).toLocaleDateString([],{weekday:'short'}).toUpperCase()}</text><text x="16" y="25" textAnchor="middle" fill="#1f2937" fontSize="13" fontFamily="sans-serif" fontWeight="600">{(new Date()).getDate()}</text></svg>);
  if(id==="music")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="music-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fda4af"/><stop offset="100%" stopColor="#e11d48"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#music-bg)"/><ellipse cx="12.5" cy="21" rx="3" ry="2.5" fill="white"/><ellipse cx="22" cy="19" rx="3" ry="2.5" fill="white"/><rect x="15" y="9" width="1.6" height="13" fill="white"/><rect x="24.4" y="7" width="1.6" height="12.5" fill="white"/><path d="M15 9 Q20.5 7.5 26 7 L26 9 Q20.5 9.5 15 11 Z" fill="white"/></svg>);
  if(id==="pdf")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#fef2f2"/><path d="M8 4 L8 28 L24 28 L24 10 L18 4 Z" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/><path d="M18 4 L18 10 L24 10 Z" fill="#fca5a5"/><rect x="10" y="18" width="12" height="6" rx="1" fill="#dc2626"/><text x="16" y="22.8" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">PDF</text></svg>);
  if(id==="atmos")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="atmos-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc"/><stop offset="100%" stopColor="#0369a1"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#atmos-bg)"/><circle cx="11.5" cy="11.5" r="4.5" fill="#fde047"/><circle cx="11.5" cy="11.5" r="4.5" fill="none" stroke="rgba(255,215,0,0.5)" strokeWidth="0.8"/><path d="M9 18.5 Q9 16.5 11.5 16.5 Q12 14.5 14.5 14.5 Q16.5 12.5 19 14.5 Q22 13.8 23 17 Q25 17 25 19.5 Q25 22 22.5 22 L11.5 22 Q9 22 9 19.5 Z" fill="white"/></svg>);
  if(id==="minesweeper")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#475569"/><rect x="6" y="6" width="20" height="20" rx="1.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><rect x="6" y="13" width="20" height="0.5" fill="rgba(255,255,255,0.15)"/><rect x="6" y="20" width="20" height="0.5" fill="rgba(255,255,255,0.15)"/><rect x="12.7" y="6" width="0.5" height="20" fill="rgba(255,255,255,0.15)"/><rect x="19.3" y="6" width="0.5" height="20" fill="rgba(255,255,255,0.15)"/><circle cx="16" cy="16.5" r="3.5" fill="#0f172a"/><circle cx="14.8" cy="15.3" r="0.7" fill="rgba(255,255,255,0.7)"/><line x1="16" y1="11.5" x2="16" y2="13" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><line x1="11.5" y1="16.5" x2="13" y2="16.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><line x1="19" y1="16.5" x2="20.5" y2="16.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><line x1="16" y1="20" x2="16" y2="21.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/><text x="9" y="11" fill="#88c8ff" fontSize="4" fontFamily="monospace" fontWeight="700">2</text><text x="21" y="25" fill="#ff7878" fontSize="4" fontFamily="monospace" fontWeight="700">3</text></svg>);
  if(id==="wordle")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#0f172a"/><rect x="3" y="9" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="5.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">N</text><rect x="9" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><text x="11.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">O</text><rect x="15" y="9" width="5" height="6" rx="0.5" fill="#fbbf24"/><text x="17.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">V</text><rect x="21" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/><text x="23.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">A</text><rect x="11" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="13.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">5</text><rect x="17" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/><text x="19.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">.2</text></svg>);
  if(id==="tetris")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#18181b"/><rect x="6" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="10" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="14" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="18" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/><rect x="10" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="14" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="18" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="14" y="17" width="4" height="4" rx="0.5" fill="#a855f7"/><rect x="6" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/><rect x="10" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/><rect x="14" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/><rect x="6" y="18" width="4" height="4" rx="0.5" fill="#fb923c"/></svg>);
  if(id==="novaai")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="ai-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c084fc"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#ai-bg)"/><path d="M16 7 L18.5 13.5 L25 16 L18.5 18.5 L16 25 L13.5 18.5 L7 16 L13.5 13.5 Z" fill="white"/><circle cx="23" cy="10" r="1.4" fill="white"/><circle cx="9" cy="22" r="1.1" fill="rgba(255,255,255,0.85)"/></svg>);

  // ── v8.0 round-3: iOS-style icons for the v7.4 games + Photos ────────
  // These previously fell back to emoji, making them visibly smaller than
  // the other apps on the desktop. Now they get proper SVG icons with
  // matching gradients + iconographic glyphs.
  if(id==="photos")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><radialGradient id="photos-bg" cx="50%" cy="50%" r="65%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#fb923c"/></radialGradient></defs><rect width="32" height="32" rx={r} fill="url(#photos-bg)"/>{/* Six-petal pinwheel — like iOS Photos */}{[0,60,120,180,240,300].map(deg=>{const a=deg*Math.PI/180;const cx=16+5*Math.cos(a);const cy=16+5*Math.sin(a);const colors=["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#a855f7"];return<circle key={deg} cx={cx} cy={cy} r="5" fill={colors[deg/60]} opacity="0.78"/>})}<circle cx="16" cy="16" r="3" fill="white"/></svg>);
  if(id==="tictactoe")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="ttt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67e8f9"/><stop offset="100%" stopColor="#0e7490"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#ttt-bg)"/><line x1="14" y1="7" x2="14" y2="25" stroke="white" strokeWidth="1.6" strokeLinecap="round"/><line x1="20" y1="7" x2="20" y2="25" stroke="white" strokeWidth="1.6" strokeLinecap="round"/><line x1="7" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.6" strokeLinecap="round"/><line x1="7" y1="20" x2="25" y2="20" stroke="white" strokeWidth="1.6" strokeLinecap="round"/><line x1="8.5" y1="8.5" x2="12.5" y2="12.5" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="12.5" y1="8.5" x2="8.5" y2="12.5" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="23.5" cy="23.5" r="2" fill="none" stroke="white" strokeWidth="2"/></svg>);
  if(id==="pong")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="pong-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f2937"/><stop offset="100%" stopColor="#020617"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#pong-bg)"/><rect x="5" y="11" width="2.5" height="10" rx="1.2" fill="white"/><rect x="24.5" y="11" width="2.5" height="10" rx="1.2" fill="white"/><line x1="16" y1="7" x2="16" y2="11" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="2 2"/><line x1="16" y1="21" x2="16" y2="25" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="2 2"/><circle cx="16" cy="16" r="2" fill="white"/></svg>);
  if(id==="flappy")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="flappy-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc"/><stop offset="100%" stopColor="#0284c7"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#flappy-bg)"/>{/* clouds */}<ellipse cx="8" cy="9" rx="3.5" ry="1.5" fill="rgba(255,255,255,0.65)"/><ellipse cx="24" cy="22" rx="3" ry="1.3" fill="rgba(255,255,255,0.55)"/>{/* bird body */}<circle cx="16" cy="16" r="5.5" fill="#fde047" stroke="#ca8a04" strokeWidth="0.8"/>{/* wing */}<path d="M13 16 Q14 18.5 16.5 18 Q15 16 13 16 Z" fill="#fbbf24"/>{/* eye */}<circle cx="18" cy="14.5" r="1.2" fill="white"/><circle cx="18.2" cy="14.5" r="0.6" fill="#1f2937"/>{/* beak */}<path d="M21 16 L24 15.5 L21 17 Z" fill="#fb923c"/></svg>);
  if(id==="invaders")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="inv-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e1b4b"/><stop offset="100%" stopColor="#020617"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#inv-bg)"/>{/* Pixel-art invader (5 cols x 5 rows of squares) */}{[[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[2,2],[4,2],[1,3],[3,3]].map(([c,rr],i)=><rect key={i} x={9+c*2.8} y={8+rr*2.8} width="2.5" height="2.5" fill="#4cef90"/>)}{/* Player ship at bottom */}<rect x="14.5" y="22" width="3" height="2.5" fill="white"/><rect x="11" y="24.5" width="10" height="2" fill="white"/></svg>);
  if(id==="pacman")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="pac-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f1147"/><stop offset="100%" stopColor="#0a0418"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#pac-bg)"/><path d="M16 16 L26 9 A11 11 0 1 0 26 23 Z" fill="#fde047"/>{/* eye */}<circle cx="15" cy="12" r="1.2" fill="#0a0418"/>{/* pellets */}<circle cx="9" cy="22" r="1.2" fill="white"/><circle cx="6" cy="14" r="0.8" fill="white"/></svg>);
  if(id==="chess")return(<svg width={w} height={h} viewBox="0 0 32 32"><defs><linearGradient id="chess-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fafaf9"/><stop offset="100%" stopColor="#78716c"/></linearGradient></defs><rect width="32" height="32" rx={r} fill="url(#chess-bg)"/>{/* 4x4 simplified checker */}{[...Array(16)].map((_,i)=>{const c=i%4, rr=Math.floor(i/4);const dark=(c+rr)%2===1;return dark?<rect key={i} x={6+c*5} y={6+rr*5} width="5" height="5" fill="rgba(40,30,20,0.6)"/>:null})}{/* King silhouette overlaid */}<path d="M16 13 L16 11 M14.5 11.5 L17.5 11.5 M14 14 L18 14 L17.5 21 L14.5 21 Z" stroke="#1f2937" strokeWidth="1.5" fill="#1f2937" strokeLinejoin="round"/></svg>);

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

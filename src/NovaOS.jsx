
// NOVA OS v5.3 — Nova Systems
// Drop this into src/NovaOS.jsx
 
import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "./firebase.js";
import {
  TASKBAR_H, MIN_W, MIN_H,
  ICON_W, ICON_H, ICON_GAP, ICON_PAD_X, ICON_PAD_Y,
  WIDGET_SNAP,
} from "./lib/constants.js";
import { hexRgb, fill, bdr, isUrl } from "./lib/format.js";
import { defaultIconPos, snapToFreeGrid, snapW } from "./lib/geometry.js";
import { autoModerate, isAdmin, isPubliclyVisible } from "./lib/moderation.js";
import { rewriteForIframe, isLikelyUnframable } from "./lib/browser.js";
import { detectDevice, effectiveDeviceMode, isTouchMode } from "./lib/device.js";
import { applyOp, formatDisplay, toggleSign, appendKey } from "./lib/calc.js";
import { createBoard as mineCreateBoard, floodReveal, isWin as mineIsWin, mineTotal, MINE_DIFFICULTIES } from "./lib/minesweeper.js";
import { dailyWord, scoreGuess, normalizeGuess } from "./lib/wordle.js";
import { emptyGrid as tetrisEmpty, randomPiece as tetrisRandom, shapeOf, fits as tetrisFits, lockPiece as tetrisLock, clearLines as tetrisClearLines, scoreForLines, tickInterval, PIECE_COLORS, BOARD_W as TETRIS_W, BOARD_H as TETRIS_H } from "./lib/tetris.js";
import { wmoIcon, wmoLabel, geocodeUrl, parseGeocode, forecastUrl, parseForecast, alertsUrl, parseAlerts, isLikelyUS } from "./lib/weather.js";
import { PROVIDERS as AI_PROVIDERS, streamResponse as aiStream, deriveTitle as aiDeriveTitle } from "./lib/ai.js";
import { playTone, speak, cancelSpeech } from "./lib/audio.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEFAULT_AC = "#4f9eff";
const COLL       = "nova_storage";
 
const WIDGET_CONFIGS = {
  clock:    { label:"Clock",        emoji:"🕐", minW:180, minH:80  },
  weather:  { label:"Weather",      emoji:"🌤️", minW:170, minH:120 },
  notesw:   { label:"Quick Notes",  emoji:"📝", minW:200, minH:160 },
  tasksw:   { label:"Tasks",        emoji:"✅", minW:200, minH:160 },
  calendar: { label:"Calendar",     emoji:"📅", minW:240, minH:220 },
  sysinfo:  { label:"System Info",  emoji:"💻", minW:180, minH:110 },
};
 
const DEFAULT_WIDGET_STATE = {
  clock:    { x:200, y:80,  w:240, h:112 },
  weather:  { x:450, y:80,  w:200, h:158 },
  notesw:   { x:200, y:220, w:260, h:280 },
  tasksw:   { x:480, y:220, w:260, h:280 },
  calendar: { x:200, y:220, w:280, h:264 },
  sysinfo:  { x:490, y:220, w:220, h:140 },
};
 
const DEFAULT_SIZES = {
  notes:{w:500,h:520},tasks:{w:460,h:520},files:{w:540,h:520},
  paint:{w:700,h:560},browser:{w:760,h:620},
  snake:{w:460,h:560},"2048":{w:480,h:580},
  store:{w:680,h:600},terminal:{w:580,h:460},
  settings:{w:480,h:640},profile:{w:440,h:540},chat:{w:480,h:580},
  // 5.1 additions
  calculator:{w:300,h:460},clock:{w:480,h:520},
  minesweeper:{w:520,h:600},wordle:{w:430,h:600},tetris:{w:340,h:620},
  pdf:{w:680,h:680},music:{w:480,h:560},calendar:{w:560,h:560},
  atmos:{w:680,h:640},
  // 5.2
  novaai:{w:760,h:640},
};

const APPS = [
  {id:"notes",   icon:"📝",label:"Notes",   desc:"Write & save notes"},
  {id:"tasks",   icon:"✅",label:"Tasks",   desc:"Manage to-dos"},
  {id:"files",   icon:"📁",label:"Files",   desc:"Browse your files"},
  {id:"paint",   icon:"🎨",label:"Paint",   desc:"Draw & create"},
  {id:"browser", icon:"🌐",label:"Browser", desc:"Nova Search & Browse"},
  {id:"snake",   icon:"🐍",label:"Snake",   desc:"Classic snake game"},
  {id:"2048",    icon:"🎮",label:"2048",    desc:"Sliding tile puzzle"},
  {id:"store",   icon:"🏪",label:"Store",   desc:"Nova App Store"},
  {id:"chat",    icon:"💬",label:"Chat",    desc:"Global Nova chat"},
  {id:"terminal",icon:"💻",label:"Terminal",desc:"System terminal"},
  {id:"settings",icon:"⚙️",label:"Settings",desc:"Customize Nova OS"},
  {id:"profile", icon:"👤",label:"Profile", desc:"Your account"},
  // 5.1 additions
  {id:"calculator", icon:"🔢",label:"Calculator", desc:"Quick math"},
  {id:"clock",      icon:"⏰",label:"Clock",      desc:"World clock, stopwatch, timer"},
  {id:"calendar",   icon:"📅",label:"Calendar",   desc:"Schedule events"},
  {id:"music",      icon:"🎵",label:"Music",      desc:"Play local audio files"},
  {id:"pdf",        icon:"📄",label:"PDF Viewer", desc:"Read PDFs in-app"},
  {id:"atmos",      icon:"🌤️",label:"Atmos",     desc:"Weather, forecast & alerts"},
  {id:"minesweeper",icon:"💣",label:"Minesweeper",desc:"Classic mine-grid puzzle"},
  {id:"wordle",     icon:"🟩",label:"Wordle",     desc:"Daily 5-letter word puzzle"},
  {id:"tetris",     icon:"🟪",label:"Tetris",     desc:"Falling-block classic"},
  // 5.2
  {id:"novaai",     icon:"✨",label:"Nova AI",    desc:"Chat with Claude or ChatGPT (BYOK)"},
];
 
// domain field enables Clearbit logo lookup
const STORE_CATALOG = [
  {id:"roblox",    name:"Roblox",       domain:"roblox.com",          icon:"🟥",cat:"Games", url:"https://www.roblox.com",                 newTab:true, badge:"↗ New Tab",desc:"World's leading gaming platform"},
  {id:"xbox",      name:"Xbox Cloud",   domain:"xbox.com",            icon:"🎮",cat:"Games", url:"https://www.xbox.com/en-US/play",        newTab:true, badge:"↗ New Tab",desc:"Stream Xbox Game Pass titles in your browser"},
  {id:"steam",     name:"Steam",        domain:"steampowered.com",    icon:"🎯",cat:"Games", url:"https://store.steampowered.com",         newTab:true, badge:"↗ New Tab",desc:"The ultimate PC gaming destination"},
  {id:"ps",        name:"PlayStation",  domain:"playstation.com",     icon:"🔵",cat:"Games", url:"https://www.playstation.com/en-us/ps-now/",newTab:true,badge:"↗ New Tab",desc:"PlayStation cloud gaming"},
  {id:"itchio",    name:"itch.io",      domain:"itch.io",             icon:"🕹️",cat:"Games", url:"https://itch.io",                        newTab:false,badge:"✓ In-App",desc:"Thousands of free indie & browser games"},
  {id:"poki",      name:"Poki",         domain:"poki.com",            icon:"🎪",cat:"Games", url:"https://poki.com",                       newTab:false,badge:"✓ In-App",desc:"Free online browser games"},
  {id:"crazygames",name:"CrazyGames",   domain:"crazygames.com",      icon:"🃏",cat:"Games", url:"https://www.crazygames.com",             newTab:false,badge:"✓ In-App",desc:"Hundreds of free browser games"},
  {id:"youtube",   name:"YouTube",      domain:"youtube.com",         icon:"▶️", cat:"Media", url:"https://www.youtube.com",                newTab:true, badge:"↗ New Tab",desc:"Watch, share, and create videos"},
  {id:"spotify",   name:"Spotify",      domain:"spotify.com",         icon:"🎵",cat:"Media", url:"https://open.spotify.com",               newTab:true, badge:"↗ New Tab",desc:"Stream 100M+ songs and podcasts"},
  {id:"twitch",    name:"Twitch",       domain:"twitch.tv",           icon:"💜",cat:"Media", url:"https://www.twitch.tv",                  newTab:true, badge:"↗ New Tab",desc:"Live streaming for gaming and more"},
  {id:"soundcloud",name:"SoundCloud",   domain:"soundcloud.com",      icon:"🎧",cat:"Media", url:"https://soundcloud.com",                 newTab:false,badge:"✓ In-App",desc:"Discover and stream independent music"},
  {id:"github",    name:"GitHub",       domain:"github.com",          icon:"🐙",cat:"Tools", url:"https://github.com",                     newTab:true, badge:"↗ New Tab",desc:"Code hosting and collaboration"},
  {id:"figma",     name:"Figma",        domain:"figma.com",           icon:"🎨",cat:"Tools", url:"https://www.figma.com",                  newTab:true, badge:"↗ New Tab",desc:"Collaborative UI design tool"},
  {id:"notion",    name:"Notion",       domain:"notion.so",           icon:"📓",cat:"Tools", url:"https://www.notion.so",                  newTab:true, badge:"↗ New Tab",desc:"All-in-one notes and docs workspace"},
  {id:"codepen",   name:"CodePen",      domain:"codepen.io",          icon:"✏️", cat:"Tools", url:"https://codepen.io",                     newTab:false,badge:"✓ In-App",desc:"Front-end coding environment"},
  {id:"discord",   name:"Discord",      domain:"discord.com",         icon:"💬",cat:"Social",url:"https://discord.com/app",                newTab:true, badge:"↗ New Tab",desc:"Chat, voice, and communities"},
  {id:"reddit",    name:"Reddit",       domain:"reddit.com",          icon:"🤖",cat:"Social",url:"https://www.reddit.com",                 newTab:true, badge:"↗ New Tab",desc:"The front page of the internet"},
  {id:"twitter",   name:"X / Twitter",  domain:"x.com",               icon:"🐦",cat:"Social",url:"https://x.com",                          newTab:true, badge:"↗ New Tab",desc:"Real-time news and conversation"},
  {id:"hn",        name:"Hacker News",  domain:"ycombinator.com",     icon:"🟠",cat:"News",  url:"https://news.ycombinator.com",           newTab:false,badge:"✓ In-App",desc:"Tech news, startups, programming"},
  {id:"wiki",      name:"Wikipedia",    domain:"wikipedia.org",       icon:"📚",cat:"News",  url:"https://en.m.wikipedia.org",             newTab:false,badge:"✓ In-App",desc:"Free encyclopedia"},
  {id:"arxiv",     name:"arXiv",        domain:"arxiv.org",           icon:"🔬",cat:"News",  url:"https://arxiv.org",                      newTab:false,badge:"✓ In-App",desc:"Open-access research papers"},
];
 
const STORE_CATS    = ["All","Games","Media","Tools","Social","News"];
const BOOT_MSGS     = ["NOVA OS v5.3 — Nova Systems","Initializing kernel... OK","Loading hardware abstraction layer... OK","Mounting filesystems... OK","Starting widget engine... OK","Initializing Nova Store... OK","Loading user environment... OK","System ready."];
const ACCENT_PRESETS= ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa"];
const BOOKMARKS     = [{label:"Hacker News",url:"https://news.ycombinator.com"},{label:"Wikipedia",url:"https://en.m.wikipedia.org"},{label:"Archive.org",url:"https://archive.org"},{label:"itch.io",url:"https://itch.io"}];
const PAINT_COLORS  = ["#fff","#000","#ff4444","#ff8800","#ffdd00","#44dd44","#00ccff","#4466ff","#cc44ff","#ff44aa","#8b4513","#888"];
const WALLPAPERS    = {
  aurora:{name:"Aurora",preview:"linear-gradient(180deg,#0a0218 0%,#3b1d6a 35%,#10b981 60%,#0a0218 100%),radial-gradient(ellipse at 50% 90%,#a855f7 0%,transparent 50%)"},
  mesh:  {name:"Mesh",  preview:"radial-gradient(ellipse at 18% 22%,#6366f1 0%,transparent 45%),radial-gradient(ellipse at 82% 18%,#ec4899 0%,transparent 40%),radial-gradient(ellipse at 60% 85%,#06b6d4 0%,transparent 45%),linear-gradient(135deg,#0a0a14,#050510)"},
  nova:  {name:"Nova",  preview:"radial-gradient(ellipse at 25% 20%,#0ea5e9 0%,transparent 55%),radial-gradient(ellipse at 80% 85%,#7c3aed 0%,transparent 50%),linear-gradient(135deg,#07080f,#0d0a1a)"},
  bliss: {name:"Bliss", preview:"linear-gradient(180deg,#4a9fd1 44%,#6ec82e 44%)"},
  night: {name:"Night", preview:"radial-gradient(#1a0f40,#03020d)",  grad:"radial-gradient(ellipse at 50% 0%,#1a0f40,#03020d)"},
  sakura:{name:"Sakura",preview:"linear-gradient(155deg,#ffd6e7,#ff8fa3)", grad:"linear-gradient(155deg,#ffd6e7,#ffb3c6,#ff8fa3)"},
  forest:{name:"Forest",preview:"radial-gradient(#1a5010,#051204)",  grad:"radial-gradient(ellipse at 50% 100%,#1a5010,#051204)"},
  slate: {name:"Slate", preview:"linear-gradient(135deg,#1e2235,#0f1219)", grad:"linear-gradient(135deg,#1e2235,#0f1219)"},
  custom:{name:"Custom",preview:"conic-gradient(#888,#555)"},
};
const WMO = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"🌨️",75:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",95:"⛈️",99:"⛈️"};
 
// ─── STORAGE ──────────────────────────────────────────────────────────────────
const db = {
  async get(k){try{const s=await getDoc(doc(firestoreDb,COLL,k.replace(/[:/]/g,"_")));return s.exists()?s.data().value:null;}catch{return null;}},
  async set(k,v){try{await setDoc(doc(firestoreDb,COLL,k.replace(/[:/]/g,"_")),{value:v});}catch{}},
};
 
// ─── FONTS & STYLES ───────────────────────────────────────────────────────────
const FF ="'DM Sans',sans-serif";
const FFB="'Space Grotesk',sans-serif";
const FFM="'JetBrains Mono',monospace";
const INP={width:"100%",padding:"9px 12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,color:"rgba(255,255,255,0.92)",fontFamily:FF,fontSize:14,outline:"none"};
const SEC={fontFamily:FFB,fontWeight:600,fontSize:11,letterSpacing:1.5,color:"rgba(255,255,255,0.3)",marginBottom:12,textTransform:"uppercase"};
const CSS=`
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
 
// ─── BACKGROUNDS ─────────────────────────────────────────────────────────────
function NovaBg(){
  return(
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="n1" cx="15%" cy="25%" r="70%"><stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.9"/><stop offset="60%" stopColor="#3b0764" stopOpacity="0.5"/><stop offset="100%" stopColor="#030712" stopOpacity="0"/></radialGradient>
        <radialGradient id="n2" cx="85%" cy="80%" r="65%"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.85"/><stop offset="55%" stopColor="#1e1b4b" stopOpacity="0.4"/><stop offset="100%" stopColor="#030712" stopOpacity="0"/></radialGradient>
        <radialGradient id="n3" cx="80%" cy="10%" r="50%"><stop offset="0%" stopColor="#0891b2" stopOpacity="0.7"/><stop offset="100%" stopColor="#0891b2" stopOpacity="0"/></radialGradient>
        <radialGradient id="n4" cx="45%" cy="55%" r="40%"><stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3"/><stop offset="100%" stopColor="#4f46e5" stopOpacity="0"/></radialGradient>
        <radialGradient id="n5" cx="5%"  cy="90%" r="35%"><stop offset="0%" stopColor="#0d9488" stopOpacity="0.5"/><stop offset="100%" stopColor="#0d9488" stopOpacity="0"/></radialGradient>
        <radialGradient id="n6" cx="55%" cy="5%"  r="30%"><stop offset="0%" stopColor="#db2777" stopOpacity="0.45"/><stop offset="100%" stopColor="#db2777" stopOpacity="0"/></radialGradient>
        <filter id="nblur"><feGaussianBlur stdDeviation="28"/></filter>
      </defs>
      {/* Deep base */}
      <rect width="1440" height="900" fill="#020510"/>
      {/* Bloom layers - filtered for soft glow */}
      <g filter="url(#nblur)">
        <rect width="1440" height="900" fill="url(#n1)"/>
        <rect width="1440" height="900" fill="url(#n2)"/>
        <rect width="1440" height="900" fill="url(#n3)"/>
        <rect width="1440" height="900" fill="url(#n4)"/>
        <rect width="1440" height="900" fill="url(#n5)"/>
        <rect width="1440" height="900" fill="url(#n6)"/>
      </g>
      {/* Subtle horizon shimmer */}
      <rect x="0" y="420" width="1440" height="1" fill="rgba(139,92,246,0.15)"/>
      {/* Stars */}
      {[...Array(80)].map((_,i)=>{
        const x=(i*173.7+31)%1440, y=(i*97.3+17)%900, r=i%5===0?1.8:i%3===0?1.2:0.7;
        return <circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.55)"/>;
      })}
    </svg>
  );
}
function BlissBg(){return(<svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1b5c90"/><stop offset="30%" stopColor="#3990cc"/><stop offset="65%" stopColor="#6ab6e8"/><stop offset="100%" stopColor="#a4d4f0"/></linearGradient><linearGradient id="ghb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#478c18"/><stop offset="100%" stopColor="#1e5007"/></linearGradient><linearGradient id="ghm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#57b820"/><stop offset="100%" stopColor="#27680e"/></linearGradient><linearGradient id="ghf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cca2c"/><stop offset="100%" stopColor="#337a14"/></linearGradient><linearGradient id="gfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d8814"/><stop offset="100%" stopColor="#194807"/></linearGradient></defs><rect width="1440" height="900" fill="url(#gsky)"/>{[[310,165,150,50],[278,158,100,37],[350,155,85,40],[970,128,120,40],[940,121,78,29],[1170,200,130,44]].map(([cx,cy,rx,ry],i)=><ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={"rgba(255,255,255,"+(0.42+(i%3)*0.09)+")"}/>)}<path d="M0 590 Q200 450 430 530 Q630 610 860 480 Q1040 365 1210 445 Q1350 505 1440 460 L1440 900 L0 900Z" fill="url(#ghb)"/><path d="M0 645 Q170 515 380 585 Q570 655 775 540 Q955 425 1155 505 Q1305 565 1440 522 L1440 900 L0 900Z" fill="url(#ghm)"/><path d="M-10 725 Q70 640 190 658 Q310 678 440 730 Q615 796 808 682 Q955 598 1090 628 Q1230 658 1360 618 L1460 610 L1460 900 L-10 900Z" fill="url(#ghf)"/><path d="M0 818 Q370 778 720 795 Q1020 810 1440 778 L1440 900 L0 900Z" fill="url(#gfg)"/></svg>);}
 
// Aurora: vertical jewel-toned aurora streaks against a deep purple base, with
// a magenta horizon glow at the bottom. Default wallpaper for NOVA OS 4.1.
function AuroraBg(){
  return(
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="au1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0a0218" stopOpacity="0"/>
          <stop offset="28%" stopColor="#10b981" stopOpacity="0.7"/>
          <stop offset="58%" stopColor="#06b6d4" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#0a0218" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="au2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0a0218" stopOpacity="0"/>
          <stop offset="32%" stopColor="#a855f7" stopOpacity="0.6"/>
          <stop offset="68%" stopColor="#ec4899" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#0a0218" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="au3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0a0218" stopOpacity="0"/>
          <stop offset="38%" stopColor="#22d3ee" stopOpacity="0.55"/>
          <stop offset="78%" stopColor="#3b82f6" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#0a0218" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="auhz" cx="50%" cy="95%" r="55%">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.55"/>
          <stop offset="60%"  stopColor="#1e1b4b" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#080318" stopOpacity="0"/>
        </radialGradient>
        <filter id="aublur"><feGaussianBlur stdDeviation="44"/></filter>
        <filter id="aublur2"><feGaussianBlur stdDeviation="22"/></filter>
      </defs>
      <rect width="1440" height="900" fill="#080318"/>
      <g filter="url(#aublur)">
        <ellipse cx="280"  cy="450" rx="220" ry="560" fill="url(#au1)"/>
        <ellipse cx="720"  cy="450" rx="260" ry="640" fill="url(#au2)"/>
        <ellipse cx="1180" cy="450" rx="240" ry="560" fill="url(#au3)"/>
      </g>
      <g filter="url(#aublur2)">
        <rect width="1440" height="900" fill="url(#auhz)"/>
      </g>
      {[...Array(55)].map((_,i)=>{
        const x=(i*191.3+47)%1440, y=(i*113.7+29)%900, r=i%6===0?1.5:i%3===0?1:0.6;
        const op=0.32+(i%4)*0.13;
        return <circle key={i} cx={x} cy={y} r={r} fill={"rgba(255,255,255,"+op+")"}/>;
      })}
    </svg>
  );
}

// Mesh: clean, modern multi-blob gradient. Designed to feel like the
// landing-page wallpapers of Linear/Vercel/Stripe — minimal, premium,
// large soft color fields without busy texture. Added in 5.2.
function MeshBg(){
  return(
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="me1" cx="20%" cy="22%" r="55%">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.9"/>
          <stop offset="55%"  stopColor="#4338ca" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="me2" cx="80%" cy="18%" r="48%">
          <stop offset="0%"   stopColor="#ec4899" stopOpacity="0.8"/>
          <stop offset="55%"  stopColor="#be185d" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="me3" cx="62%" cy="82%" r="52%">
          <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.85"/>
          <stop offset="55%"  stopColor="#0e7490" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="me4" cx="10%" cy="88%" r="42%">
          <stop offset="0%"   stopColor="#a855f7" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="me5" cx="95%" cy="55%" r="35%">
          <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.32"/>
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/>
        </radialGradient>
        {/* Heavy blur sums the blobs into one continuous "mesh" surface */}
        <filter id="meblur"><feGaussianBlur stdDeviation="80"/></filter>
      </defs>
      {/* Deep base */}
      <rect width="1440" height="900" fill="#0a0a14"/>
      <g filter="url(#meblur)">
        <rect width="1440" height="900" fill="url(#me1)"/>
        <rect width="1440" height="900" fill="url(#me2)"/>
        <rect width="1440" height="900" fill="url(#me3)"/>
        <rect width="1440" height="900" fill="url(#me4)"/>
        <rect width="1440" height="900" fill="url(#me5)"/>
      </g>
      {/* Subtle vignette to keep edges feeling intentional */}
      <radialGradient id="mevign" cx="50%" cy="50%" r="75%">
        <stop offset="60%"  stopColor="#000000" stopOpacity="0"/>
        <stop offset="100%" stopColor="#000000" stopOpacity="0.35"/>
      </radialGradient>
      <rect width="1440" height="900" fill="url(#mevign)"/>
    </svg>
  );
}

function Wallpaper({id,customUrl}){
  if(id==="custom"&&customUrl)return<div style={{position:"absolute",inset:0,background:'url("'+customUrl+'") center/cover no-repeat'}}/>;
  // 5.2 made Mesh the new system default. Aurora is still selectable.
  if(!id||id==="mesh")return<MeshBg/>;
  if(id==="aurora")return<AuroraBg/>;
  if(id==="nova")return<NovaBg/>;
  if(id==="bliss")return<BlissBg/>;
  const wp=WALLPAPERS[id];if(wp&&wp.grad)return<div style={{position:"absolute",inset:0,background:wp.grad}}/>;return<MeshBg/>;
}
 
// ─── ICONS ────────────────────────────────────────────────────────────────────
// Built-in app SVG icons
function NovaSvgIcon({id,size=26}){
  const r=Math.round(size*0.22);
  const w=size,h=size;
  if(id==="notes")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#3b82f6"/><rect x="7" y="9" width="18" height="2.5" rx="1.2" fill="white"/><rect x="7" y="14" width="13" height="2.5" rx="1.2" fill="rgba(255,255,255,0.75)"/><rect x="7" y="19" width="15" height="2.5" rx="1.2" fill="rgba(255,255,255,0.75)"/></svg>);
  if(id==="tasks")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#10b981"/><rect x="7" y="9" width="7" height="7" rx="2" fill="rgba(0,0,0,0.2)"/><polyline points="8.5,12.5 11,15 14.5,10" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="17" y="11.5" width="9" height="2" rx="1" fill="rgba(255,255,255,0.85)"/><rect x="7" y="19" width="7" height="7" rx="2" fill="rgba(0,0,0,0.15)"/><rect x="17" y="21.5" width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/></svg>);
  if(id==="files")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#f59e0b"/><path d="M6 14 Q6 11 9 11 L13 11 L15 13 L26 13 Q26 13 26 15 L26 24 Q26 26 24 26 L8 26 Q6 26 6 24 Z" fill="rgba(255,255,255,0.92)"/><path d="M6 17 L26 17" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/></svg>);
  if(id==="paint")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#8b5cf6"/><circle cx="11" cy="12" r="2.5" fill="#ff6b6b"/><circle cx="18" cy="9" r="2.5" fill="#ffdd57"/><circle cx="24" cy="14" r="2.5" fill="#4cef90"/><circle cx="22" cy="22" r="2.5" fill="#4f9eff"/><path d="M16 16 Q20 18 18 24 Q16 28 14 26" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>);
  if(id==="browser")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#06b6d4"/><circle cx="16" cy="16" r="9" fill="none" stroke="white" strokeWidth="2"/><ellipse cx="16" cy="16" rx="4.5" ry="9" fill="none" stroke="white" strokeWidth="1.5"/><line x1="7" y1="16" x2="25" y2="16" stroke="white" strokeWidth="1.5"/><line x1="8.5" y1="12" x2="23.5" y2="12" stroke="rgba(255,255,255,0.55)" strokeWidth="1"/><line x1="8.5" y1="20" x2="23.5" y2="20" stroke="rgba(255,255,255,0.55)" strokeWidth="1"/></svg>);
  if(id==="snake")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#22c55e"/><path d="M7 23 Q7 14 13 14 Q19 14 19 10 Q19 7 22 7" stroke="rgba(255,255,255,0.9)" strokeWidth="3.5" fill="none" strokeLinecap="round"/><circle cx="22" cy="7" r="3.5" fill="white"/><circle cx="20.5" cy="5.5" r="1" fill="#22c55e"/><circle cx="23.5" cy="5.5" r="1" fill="#22c55e"/></svg>);
  if(id==="2048")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#f97316"/><rect x="6" y="6"  width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.3)"/><rect x="18" y="6"  width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.6)"/><rect x="6" y="18" width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.5)"/><rect x="18" y="18" width="8" height="8"  rx="1.5" fill="rgba(255,255,255,0.9)"/><text x="22" y="25.5" textAnchor="middle" fill="#f97316" fontSize="7.5" fontWeight="bold" fontFamily="monospace">8</text></svg>);
  if(id==="store")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#ec4899"/><path d="M8 13 L10 8 L22 8 L24 13 Z" fill="rgba(255,255,255,0.85)"/><rect x="7" y="13" width="18" height="12" rx="2" fill="rgba(255,255,255,0.88)"/><rect x="13" y="16.5" width="6" height="5" rx="1" fill="rgba(236,72,153,0.45)"/></svg>);
  if(id==="terminal")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#1e293b"/><text x="7" y="21" fill="#4cef90" fontSize="13" fontFamily="monospace" fontWeight="bold">&gt;_</text></svg>);
  if(id==="settings"){
    const spokes=[0,45,90,135,180,225,270,315].map(deg=>{const a=deg*Math.PI/180;return{x1:16+7*Math.cos(a),y1:16+7*Math.sin(a),x2:16+9.5*Math.cos(a),y2:16+9.5*Math.sin(a)};});
    return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#64748b"/>{spokes.map((s,i)=><line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="white" strokeWidth="2.5" strokeLinecap="round"/>)}<circle cx="16" cy="16" r="4.5" fill="white"/><circle cx="16" cy="16" r="2" fill="#64748b"/></svg>);
  }
  if(id==="profile")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#4f9eff"/><circle cx="16" cy="12" r="5.5" fill="rgba(255,255,255,0.95)"/><path d="M5 28 Q5 21 16 21 Q27 21 27 28" fill="rgba(255,255,255,0.9)"/></svg>);
  if(id==="chat")return(<svg width={w} height={h} viewBox="0 0 32 32"><rect width="32" height="32" rx={r} fill="#6366f1"/><path d="M6 8 Q6 6 8 6 L24 6 Q26 6 26 8 L26 19 Q26 21 24 21 L14 21 L9 26 L9 21 L8 21 Q6 21 6 19 Z" fill="rgba(255,255,255,0.92)"/><rect x="10" y="11" width="12" height="1.8" rx="0.9" fill="rgba(99,102,241,0.7)"/><rect x="10" y="14.5" width="8" height="1.8" rx="0.9" fill="rgba(99,102,241,0.5)"/></svg>);
  // ─── 5.1 app icons ────────────────────────────────────────────────────
  if(id==="calculator")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#475569"/>
      <rect x="6" y="6" width="20" height="6.5" rx="1.5" fill="rgba(255,255,255,0.92)"/>
      <rect x="6.5" y="14.5" width="5" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="13.5" y="14.5" width="5" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="20.5" y="14.5" width="5" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="6.5" y="20" width="5" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="13.5" y="20" width="5" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="20.5" y="20" width="5" height="4" rx="1" fill="#fb923c"/>
    </svg>
  );
  if(id==="clock")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#0ea5e9"/>
      <circle cx="16" cy="16" r="10" fill="rgba(255,255,255,0.95)"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
      <line x1="16" y1="16" x2="16" y2="10" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="16" x2="21" y2="16" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="1.2" fill="#0ea5e9"/>
      <circle cx="16" cy="8.5" r="0.6" fill="#0ea5e9"/>
      <circle cx="23.5" cy="16" r="0.6" fill="#0ea5e9"/>
      <circle cx="16" cy="23.5" r="0.6" fill="#0ea5e9"/>
      <circle cx="8.5" cy="16" r="0.6" fill="#0ea5e9"/>
    </svg>
  );
  if(id==="calendar")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#ffffff"/>
      <rect x="5" y="7" width="22" height="20" rx="2" fill="rgba(255,255,255,0.97)" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5"/>
      <rect x="5" y="7" width="22" height="6" rx="2" fill="#dc2626"/>
      <rect x="9" y="5" width="2" height="5" rx="1" fill="#7f1d1d"/>
      <rect x="21" y="5" width="2" height="5" rx="1" fill="#7f1d1d"/>
      <text x="16" y="23" textAnchor="middle" fill="#1f2937" fontSize="9" fontFamily="sans-serif" fontWeight="700">31</text>
    </svg>
  );
  if(id==="music")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#a855f7"/>
      <ellipse cx="12.5" cy="22" rx="3.5" ry="2.8" fill="rgba(255,255,255,0.95)"/>
      <ellipse cx="22" cy="19.5" rx="3.5" ry="2.8" fill="rgba(255,255,255,0.95)"/>
      <rect x="15" y="8" width="1.8" height="14.2" fill="rgba(255,255,255,0.95)"/>
      <rect x="24.5" y="6" width="1.8" height="13.5" fill="rgba(255,255,255,0.95)"/>
      <path d="M15 8 Q21 6.5 26.3 6 L26.3 9 Q21 9.5 15 11 Z" fill="rgba(255,255,255,0.95)"/>
    </svg>
  );
  if(id==="pdf")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#fef2f2"/>
      <path d="M8 4 L8 28 L24 28 L24 10 L18 4 Z" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <path d="M18 4 L18 10 L24 10 Z" fill="#fca5a5"/>
      <rect x="10" y="18" width="12" height="6" rx="1" fill="#dc2626"/>
      <text x="16" y="22.8" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">PDF</text>
    </svg>
  );
  if(id==="atmos")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="atmosBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8"/>
          <stop offset="100%" stopColor="#0284c7"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={r} fill="url(#atmosBg)"/>
      <circle cx="11" cy="11" r="5" fill="#fde047"/>
      <path d="M10 18 Q10 16 12 16 Q12.5 14 14.5 14 Q16 12.5 18 14 Q21 13.5 22 16.5 Q24 16.5 24 19 Q24 21 22 21 L12 21 Q10 21 10 19 Z" fill="rgba(255,255,255,0.95)"/>
    </svg>
  );
  if(id==="minesweeper")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#475569"/>
      <rect x="6" y="6" width="20" height="20" rx="1.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
      <rect x="6" y="13" width="20" height="0.5" fill="rgba(255,255,255,0.15)"/>
      <rect x="6" y="20" width="20" height="0.5" fill="rgba(255,255,255,0.15)"/>
      <rect x="12.7" y="6" width="0.5" height="20" fill="rgba(255,255,255,0.15)"/>
      <rect x="19.3" y="6" width="0.5" height="20" fill="rgba(255,255,255,0.15)"/>
      <circle cx="16" cy="16.5" r="3.5" fill="#0f172a"/>
      <circle cx="14.8" cy="15.3" r="0.7" fill="rgba(255,255,255,0.7)"/>
      <line x1="16" y1="11.5" x2="16" y2="13" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="11.5" y1="16.5" x2="13" y2="16.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="19" y1="16.5" x2="20.5" y2="16.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="16" y1="20" x2="16" y2="21.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round"/>
      <text x="9" y="11" fill="#88c8ff" fontSize="4" fontFamily="monospace" fontWeight="700">2</text>
      <text x="21" y="25" fill="#ff7878" fontSize="4" fontFamily="monospace" fontWeight="700">3</text>
    </svg>
  );
  if(id==="wordle")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#0f172a"/>
      <rect x="3" y="9" width="5" height="6" rx="0.5" fill="#4cef90"/>
      <text x="5.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">N</text>
      <rect x="9" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
      <text x="11.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">O</text>
      <rect x="15" y="9" width="5" height="6" rx="0.5" fill="#fbbf24"/>
      <text x="17.5" y="13.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">V</text>
      <rect x="21" y="9" width="5" height="6" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
      <text x="23.5" y="13.7" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">A</text>
      <rect x="11" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/>
      <text x="13.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">5</text>
      <rect x="17" y="17" width="5" height="6" rx="0.5" fill="#4cef90"/>
      <text x="19.5" y="21.7" textAnchor="middle" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="800">.2</text>
    </svg>
  );
  if(id==="tetris")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={r} fill="#18181b"/>
      <rect x="6" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/>
      <rect x="10" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/>
      <rect x="14" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/>
      <rect x="18" y="6" width="4" height="4" rx="0.5" fill="#22d3ee"/>
      <rect x="10" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/>
      <rect x="14" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/>
      <rect x="18" y="13" width="4" height="4" rx="0.5" fill="#a855f7"/>
      <rect x="14" y="17" width="4" height="4" rx="0.5" fill="#a855f7"/>
      <rect x="6" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/>
      <rect x="10" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/>
      <rect x="14" y="22" width="4" height="4" rx="0.5" fill="#fb923c"/>
      <rect x="6" y="18" width="4" height="4" rx="0.5" fill="#fb923c"/>
    </svg>
  );
  if(id==="novaai")return(
    <svg width={w} height={h} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="aiBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={r} fill="url(#aiBg)"/>
      <path d="M16 7 L18.5 13.5 L25 16 L18.5 18.5 L16 25 L13.5 18.5 L7 16 L13.5 13.5 Z" fill="rgba(255,255,255,0.95)"/>
      <circle cx="23" cy="10" r="1.4" fill="rgba(255,255,255,0.85)"/>
      <circle cx="9" cy="22" r="1.1" fill="rgba(255,255,255,0.7)"/>
    </svg>
  );
  return null; // unknown id — caller falls back to app.icon emoji
}

// Set of app ids that NovaSvgIcon has a real SVG for. Anything not in here
// gets the emoji fallback via AppIconDisplay so 5.1's new apps don't all
// appear as the default 📦 placeholder.
const HAS_SVG_ICON = new Set([
  "notes","tasks","files","paint","browser","snake","2048",
  "store","terminal","settings","profile","chat",
  // 5.1 apps
  "calculator","clock","calendar","music","pdf","atmos",
  "minesweeper","wordle","tetris",
  // 5.2
  "novaai",
]);

// Store app icon using Clearbit logo API with emoji fallback
function StoreIcon({domain,fallback,size=26}){
  const [failed,setFailed]=useState(false);
  if(failed||!domain)return<span style={{fontSize:size*0.88,lineHeight:1,display:"block"}}>{fallback}</span>;
  return<img src={"https://logo.clearbit.com/"+domain} width={size} height={size} style={{borderRadius:Math.max(3,size*0.2),objectFit:"contain",display:"block"}} onError={()=>setFailed(true)} alt=""/>;
}

// Unified icon display — picks SVG for built-in, Clearbit for store apps,
// emoji for everything else (new apps without custom SVGs yet).
function AppIconDisplay({app,size=26}){
  if(app.storeApp)return<StoreIcon domain={app.storeApp.domain} fallback={app.storeApp.icon} size={size}/>;
  if(HAS_SVG_ICON.has(app.id))return<NovaSvgIcon id={app.id} size={size}/>;
  return<span style={{fontSize:size*0.85,lineHeight:1,display:"block"}}>{app.icon||"📦"}</span>;
}
 
// ─── WIDGET SHELL (drag handle + 8-way resize + close button) ─────────────────
// Two sizes — fat handles for touch devices, thin for mouse precision.
const WGT_HANDLES_MOUSE=[
  {id:"n", s:{top:0,left:8,right:8,height:5,cursor:"n-resize"}},
  {id:"s", s:{bottom:0,left:8,right:8,height:5,cursor:"s-resize"}},
  {id:"w", s:{top:8,left:0,bottom:8,width:5,cursor:"w-resize"}},
  {id:"e", s:{top:8,right:0,bottom:8,width:5,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:12,height:12,cursor:"nw-resize"}},
  {id:"ne",s:{top:0,right:0,width:12,height:12,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:12,height:12,cursor:"sw-resize"}},
  {id:"se",s:{bottom:0,right:0,width:12,height:12,cursor:"se-resize"}},
];
const WGT_HANDLES_TOUCH=[
  {id:"n", s:{top:0,left:14,right:14,height:14,cursor:"n-resize"}},
  {id:"s", s:{bottom:0,left:14,right:14,height:14,cursor:"s-resize"}},
  {id:"w", s:{top:14,left:0,bottom:14,width:14,cursor:"w-resize"}},
  {id:"e", s:{top:14,right:0,bottom:14,width:14,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:22,height:22,cursor:"nw-resize"}},
  {id:"ne",s:{top:0,right:0,width:22,height:22,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:22,height:22,cursor:"sw-resize"}},
  {id:"se",s:{bottom:0,right:0,width:22,height:22,cursor:"se-resize"}},
];

function WidgetShell({id,state,onDragStart,onResizeStart,onClose,children,touchy}){
  const {x,y,w,h}=state;
  const handles = touchy ? WGT_HANDLES_TOUCH : WGT_HANDLES_MOUSE;
  return(
    <div className="wgt" style={{position:"absolute",left:x,top:y,width:w,height:h,zIndex:4,background:"rgba(7,8,18,0.72)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.45)",display:"flex",flexDirection:"column"}}>
      {/* Resize handles */}
      {handles.map(hh=><div key={hh.id} onPointerDown={e=>{e.stopPropagation();onResizeStart(e,id,hh.id);}} style={{position:"absolute",...hh.s,zIndex:12,touchAction:"none"}}/>)}
      {/* Header drag strip */}
      <div onPointerDown={e=>{e.stopPropagation();onDragStart(e,id);}}
        style={{height:26,display:"flex",alignItems:"center",padding:"0 8px 0 12px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"grab",userSelect:"none",flexShrink:0,zIndex:11,touchAction:"none"}}>
        <span style={{fontFamily:FFB,fontWeight:600,fontSize:10,letterSpacing:1,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",flex:1}}>{WIDGET_CONFIGS[id]?.label||id}</span>
        <button onClick={e=>{e.stopPropagation();onClose();}}
          style={{width:16,height:16,borderRadius:4,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
      </div>
      {/* Content fills remaining space */}
      <div style={{flex:1,overflow:"hidden",minHeight:0}}>{children}</div>
    </div>
  );
}
 
// ─── WIDGET CONTENTS ─────────────────────────────────────────────────────────
function ClockWidgetContent({state,tick,use24h,AC}){
  const t=use24h?tick.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}):tick.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const d=tick.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"});
  const h=state.h-26; // subtract header
  const fontSize=Math.max(20,Math.min(h*0.38,56));
  return(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 14px",gap:4}}>
      <div style={{fontFamily:FFM,fontSize,fontWeight:400,color:"#fff",lineHeight:1,letterSpacing:2,textAlign:"center"}}>{t}</div>
      <div style={{fontFamily:FF,fontWeight:500,fontSize:Math.max(10,fontSize*0.28),color:"rgba(255,255,255,0.42)",textAlign:"center"}}>{d}</div>
    </div>
  );
}
 
function WeatherWidgetContent({state}){
  const [weather,setWeather]=useState(null);const [loc,setLoc]=useState("");const [status,setStatus]=useState("loading");
  useEffect(()=>{
    if(!navigator.geolocation){setStatus("error");return;}
    navigator.geolocation.getCurrentPosition(async({coords:{latitude:lat,longitude:lon}})=>{
      try{
        const[wR,gR]=await Promise.allSettled([fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&timezone=auto`).then(r=>r.json()),fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`).then(r=>r.json())]);
        if(wR.status==="fulfilled"&&wR.value?.current)setWeather(wR.value.current);
        if(gR.status==="fulfilled"){const a=gR.value?.address;setLoc(a?.city||a?.town||a?.village||a?.county||"");}
        setStatus("ok");
      }catch{setStatus("error");}
    },()=>setStatus("error"),{timeout:8000});
  },[]);
  const h=state.h-26,w=state.w;
  const iconSize=Math.max(24,Math.min(h*0.35,52));const tempSize=Math.max(18,Math.min(h*0.28,44));
  return(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 14px",gap:6}}>
      {status==="loading"&&<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.4)"}}>Getting weather…</span></div>}
      {status==="error"&&<div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>🌡️ Unavailable<br/><span style={{fontSize:9,opacity:0.6}}>Allow location access</span></div>}
      {status==="ok"&&weather&&(<>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:iconSize,lineHeight:1}}>{WMO[weather.weathercode]||"🌡️"}</span>
          <div><div style={{fontFamily:FFM,fontSize:tempSize,fontWeight:400,color:"#fff",lineHeight:1}}>{Math.round(weather.temperature_2m)}°C</div>{loc&&w>170&&<div style={{fontFamily:FF,fontSize:Math.max(9,tempSize*0.32),color:"rgba(255,255,255,0.42)",marginTop:3}}>{loc}</div>}</div>
        </div>
        {weather.windspeed_10m!=null&&h>120&&<div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.3)"}}>💨 {weather.windspeed_10m} km/h</div>}
      </>)}
    </div>
  );
}
 
function NotesWidgetContent({data,state}){
  const notes=(data?.notes||[]).slice(0,8);
  const h=state.h-26;
  return(
    <div style={{width:"100%",height:"100%",overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:5}}>
      {notes.length===0&&<div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic",margin:"auto",textAlign:"center"}}>No notes yet</div>}
      {notes.map(n=>(
        <div key={n.id} style={{padding:"6px 9px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,flexShrink:0}}>
          <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
          {n.body&&h>150&&<div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.42)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{n.body}</div>}
        </div>
      ))}
    </div>
  );
}
 
function TasksWidgetContent({data,updateData,state}){
  const tasks=(data?.tasks||[]).filter(t=>!t.done).slice(0,10);
  function toggle(id){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));}
  return(
    <div style={{width:"100%",height:"100%",overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
      {tasks.length===0&&<div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic",margin:"auto",textAlign:"center"}}>All tasks done! ✓</div>}
      {tasks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 7px",background:"rgba(255,255,255,0.04)",borderRadius:6,flexShrink:0,cursor:"pointer"}} onClick={()=>toggle(t.id)}>
          <div style={{width:14,height:14,borderRadius:4,border:"1.5px solid rgba(255,255,255,0.25)",flexShrink:0}}/>
          <span style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
        </div>
      ))}
      {data?.tasks?.filter(t=>!t.done).length>10&&<div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.25)",textAlign:"center",paddingTop:2}}>+{data.tasks.filter(t=>!t.done).length-10} more</div>}
    </div>
  );
}
 
function CalendarWidgetContent({tick,state,AC}){
  const year=tick.getFullYear(),month=tick.getMonth(),today=tick.getDate();
  const first=new Date(year,month,1).getDay();
  const days=new Date(year,month+1,0).getDate();
  const DAYS=["Su","Mo","Tu","We","Th","Fr","Sa"];
  const cells=[];for(let i=0;i<first;i++)cells.push(null);for(let d=1;d<=days;d++)cells.push(d);
  const w=state.w,h=state.h-26;
  const cellSz=Math.max(18,Math.min((w-24)/7,(h-40)/Math.ceil(cells.length/7)));
  return(
    <div style={{width:"100%",height:"100%",padding:"6px 10px",display:"flex",flexDirection:"column",gap:4}}>
      <div style={{fontFamily:FFB,fontWeight:600,fontSize:Math.max(10,cellSz*0.55),color:"rgba(255,255,255,0.7)",textAlign:"center"}}>
        {tick.toLocaleDateString([],{month:"long",year:"numeric"})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
        {DAYS.map(d=><div key={d} style={{textAlign:"center",fontFamily:FFB,fontWeight:600,fontSize:Math.max(8,cellSz*0.42),color:"rgba(255,255,255,0.3)",padding:"2px 0"}}>{d}</div>)}
        {cells.map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontFamily:FF,fontSize:Math.max(9,cellSz*0.48),color:d===today?"#fff":"rgba(255,255,255,0.6)",background:d===today?AC:"transparent",borderRadius:4,padding:"1px 0",fontWeight:d===today?700:400}}>{d||""}</div>
        ))}
      </div>
    </div>
  );
}
 
function SysInfoWidgetContent({state}){
  const [uptime,setUptime]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setUptime(Math.floor(performance.now()/1000)),1000);return()=>clearInterval(t);},[]);
  const fmtUp=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?`${h}h ${m}m`:`${m}m ${sec}s`;};
  const cpu=55+Math.floor((uptime%30)/30*30);const ram=62+Math.floor((uptime%20)/20*20);
  const Bar=({pct,col="#4f9eff"})=>(<div style={{flex:1,height:5,background:"rgba(255,255,255,0.1)",borderRadius:3,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:col,borderRadius:3,transition:"width 1s"}}/></div>);
  const h=state.h-26;
  const fs=Math.max(9,Math.min(h*0.1,12));
  return(
    <div style={{width:"100%",height:"100%",padding:"8px 13px",display:"flex",flexDirection:"column",justifyContent:"space-evenly",gap:4}}>
      {[["CPU","Virtual Core",cpu,"#4f9eff"],["RAM","8.0 GB",ram,"#4cef90"]].map(([lbl,sub,pct,col])=>(
        <div key={lbl}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontFamily:FFB,fontWeight:600,fontSize:fs,color:"rgba(255,255,255,0.7)"}}>{lbl}</span>
            <span style={{fontFamily:FFM,fontSize:fs,color:col}}>{pct}%</span>
          </div>
          <Bar pct={pct} col={col}/>
          {h>120&&<div style={{fontFamily:FF,fontSize:fs*0.88,color:"rgba(255,255,255,0.28)",marginTop:1}}>{sub}</div>}
        </div>
      ))}
      {h>110&&<div style={{fontFamily:FFM,fontSize:fs,color:"rgba(255,255,255,0.35)"}}>⏱ {fmtUp(uptime)}&nbsp;&nbsp;{window.innerWidth}×{window.innerHeight}</div>}
    </div>
  );
}
 
// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Toggle({label,value,onChange,ac}){
  const c=ac||DEFAULT_AC;
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,marginBottom:6}}>
      <span style={{fontFamily:FF,fontSize:13,color:"rgba(255,255,255,0.8)"}}>{label}</span>
      <div onClick={()=>onChange(!value)} style={{width:40,height:22,borderRadius:11,background:value?c:"rgba(255,255,255,0.12)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
        <div style={{position:"absolute",top:3,left:value?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
      </div>
    </div>
  );
}
function BrowserNav({bar,setBar,onGo,onBack,onFwd,onRefresh,canBack,canFwd,canRefresh,AC}){
  const navBtn=(enabled)=>({
    width:30,height:30,borderRadius:8,
    background:enabled?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)",
    border:"1px solid "+(enabled?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.05)"),
    cursor:enabled?"pointer":"default",
    color:enabled?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.25)",
    fontSize:14,
    display:"flex",alignItems:"center",justifyContent:"center",
    flexShrink:0,
  });
  return(
    <div style={{display:"flex",gap:6,marginBottom:9,alignItems:"center"}}>
      <button onClick={onBack}    disabled={!canBack}    title="Back"    style={navBtn(canBack)}>←</button>
      <button onClick={onFwd}     disabled={!canFwd}     title="Forward" style={navBtn(canFwd)}>→</button>
      <button onClick={onRefresh} disabled={!canRefresh} title="Refresh" style={navBtn(canRefresh)}>↻</button>
      <input
        value={bar}
        onChange={e=>setBar(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&onGo()}
        placeholder="Search or enter URL…"
        style={{
          flex:1,minWidth:0,
          padding:"8px 14px",
          background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:18,
          color:"rgba(255,255,255,0.92)",
          fontFamily:FFM,fontSize:12,
          outline:"none",
        }}/>
      <button onClick={onGo} style={{padding:"7px 16px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:16,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC,flexShrink:0}}>Go</button>
    </div>
  );
}
// Two sizes of resize handles: thin for mouse precision, fat for touch hit targets.
// Tablet/mobile users get the fat version (~3x the hit area) so resize is actually usable.
const HANDLE_DEFS_MOUSE=[
  {id:"n",s:{top:0,left:8,right:8,height:5,cursor:"n-resize"}},{id:"s",s:{bottom:0,left:8,right:8,height:5,cursor:"s-resize"}},
  {id:"w",s:{top:8,left:0,bottom:8,width:5,cursor:"w-resize"}},{id:"e",s:{top:8,right:0,bottom:8,width:5,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:12,height:12,cursor:"nw-resize"}},{id:"ne",s:{top:0,right:0,width:12,height:12,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:12,height:12,cursor:"sw-resize"}},{id:"se",s:{bottom:0,right:0,width:12,height:12,cursor:"se-resize"}},
];
const HANDLE_DEFS_TOUCH=[
  {id:"n",s:{top:0,left:14,right:14,height:14,cursor:"n-resize"}},{id:"s",s:{bottom:0,left:14,right:14,height:14,cursor:"s-resize"}},
  {id:"w",s:{top:14,left:0,bottom:14,width:14,cursor:"w-resize"}},{id:"e",s:{top:14,right:0,bottom:14,width:14,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:22,height:22,cursor:"nw-resize"}},{id:"ne",s:{top:0,right:0,width:22,height:22,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:22,height:22,cursor:"sw-resize"}},{id:"se",s:{bottom:0,right:0,width:22,height:22,cursor:"se-resize"}},
];
function ResizeHandles({winId,onStartResize,touchy}){
  const defs=touchy?HANDLE_DEFS_TOUCH:HANDLE_DEFS_MOUSE;
  return defs.map(h=><div key={h.id} onPointerDown={e=>{e.stopPropagation();onStartResize(e,winId,h.id);}} style={{position:"absolute",...h.s,zIndex:20,touchAction:"none"}}/>);
}
 
// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function NovaOS(){
  const [screen,     setScreen]     = useState("boot");
  const [bootLines,  setBootLines]  = useState([]);
  const [mode,       setMode]       = useState("login");
  const [uname,      setUname]      = useState("");
  const [pass,       setPass]       = useState("");
  const [authErr,    setAuthErr]    = useState("");
  const [busy,       setBusy]       = useState(false);
  const [user,       setUser]       = useState(null);
  const [data,       setData]       = useState(null);
  const [customWp,   setCustomWp]   = useState(null);
  const [wins,       setWins]       = useState([]);
  const [maxZ,       setMaxZ]       = useState(100);
  const [tick,       setTick]       = useState(new Date());
  const [toast,      setToast]      = useState(null);
  const [drag,       setDrag]       = useState(null);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [menuSrch,   setMenuSrch]   = useState("");
  const [iconPos,    setIconPos]    = useState({});
  const [iconDrag,   setIconDrag]   = useState(null);
  const [widgetState,setWidgetState]= useState(DEFAULT_WIDGET_STATE);
  const [widgetDrag, setWidgetDrag] = useState(null);
  const [widgetResize,setWidgetResize]=useState(null);
  // Detected device mode — re-detect on window resize so rotating a tablet
  // or resizing the browser shifts the layout. The user's saved preference
  // (data.settings.displayMode) is layered on top via effectiveDeviceMode.
  const [detectedMode, setDetectedMode] = useState(()=>detectDevice());
  // localStorage flag so the mobile-notice splash only shows once per device.
  const [mobileNoticeAck, setMobileNoticeAck] = useState(
    ()=>typeof localStorage!=="undefined" && localStorage.getItem("nova-mobile-ack")==="1"
  );

  const iconPosRef    = useRef({});
  const widgetRef     = useRef(DEFAULT_WIDGET_STATE);
  const menuRef       = useRef(null);
  const winsRef       = useRef(wins);
  useEffect(()=>{iconPosRef.current=iconPos;},[iconPos]);
  useEffect(()=>{widgetRef.current=widgetState;},[widgetState]);
  useEffect(()=>{winsRef.current=wins;},[wins]);
 
  const settings=data?.settings||{};
  const AC      =settings.accent    ||DEFAULT_AC;
  const use24h  =settings.clock24h  ||false;
  const winBlur =settings.winBlur   ??18;
  const largeFnt=settings.largeFont ||false;
  const wpId    =settings.wallpaper ||data?.wallpaper||"mesh";
  const widgets =settings.widgets   ||{};
  // Resolved device mode: user's saved preference overrides detection. "auto"
  // (or any unset/invalid value) defers to the viewport+touch heuristic.
  const deviceMode = effectiveDeviceMode(settings.displayMode, detectedMode);
  const touchy = isTouchMode(deviceMode);
 
  useEffect(()=>{let i=0,dead=false;function nxt(){if(dead)return;if(i>=BOOT_MSGS.length){setTimeout(()=>{if(!dead)setScreen("login");},700);return;}setBootLines(p=>[...p,BOOT_MSGS[i++]]);setTimeout(nxt,i<2?90:230);}setTimeout(nxt,380);return()=>{dead=true;};},[]);
  useEffect(()=>{const t=setInterval(()=>setTick(new Date()),1000);return()=>clearInterval(t);},[]);
  // Watch viewport size so the detected device mode stays current (e.g. on
  // rotation or window resize). Throttled-by-debounce isn't needed — resize
  // fires sparingly and detectDevice is cheap.
  useEffect(()=>{
    function onResize(){setDetectedMode(detectDevice());}
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);
  // When the effective mode flips to mobile mid-session, snap any "normal"
  // (windowed) apps to maximized so they don't keep spilling off-screen.
  // prevBounds preserves the windowed position so toggling out of maximize
  // later still works.
  useEffect(()=>{
    if(deviceMode!=="mobile")return;
    setWins(ws=>ws.map(w=>{
      if(w.state!=="normal")return w;
      return {...w,state:"maximized",prevBounds:w.prevBounds||{x:w.x,y:w.y,width:w.width,height:w.height}};
    }));
  },[deviceMode]);
  useEffect(()=>{if(user&&wpId==="custom")db.get("user:"+user+":wpimg").then(url=>{if(url)setCustomWp(url);});},[user,wpId]);
  // Outside-click closes menu. pointerdown covers both mouse and touch in one go.
  useEffect(()=>{if(!menuOpen)return;function h(e){if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);}setTimeout(()=>document.addEventListener("pointerdown",h),0);return()=>document.removeEventListener("pointerdown",h);},[menuOpen]);

  // All drag/resize tracking uses Pointer Events (pointermove/pointerup/pointercancel).
  // Pointer Events fire for mouse, touch, AND pen with a unified API — this is what
  // makes drag/resize work on tablet touchscreens without a separate touch code path.
  // pointercancel fires if the OS interrupts the gesture (system gesture, call, etc.);
  // we clean up exactly like pointerup so the dragged item doesn't get stuck.

  // Window drag/resize
  useEffect(()=>{
    function onMove(e){if(!drag)return;if(drag.type==="move"){setWins(ws=>ws.map(w=>{if(w.id!==drag.winId)return w;return{...w,x:Math.max(0,e.clientX-drag.ox),y:Math.max(0,Math.min(e.clientY-drag.oy,window.innerHeight-80))};}));}else if(drag.type==="resize"){const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;setWins(ws=>ws.map(w=>{if(w.id!==drag.winId)return w;let nx=drag.wx,ny=drag.wy,nw=drag.ww,nh=drag.wh;if(drag.edge.includes("e"))nw=Math.max(MIN_W,drag.ww+dx);if(drag.edge.includes("s"))nh=Math.max(MIN_H,drag.wh+dy);if(drag.edge.includes("w")){nw=Math.max(MIN_W,drag.ww-dx);nx=drag.wx+drag.ww-nw;}if(drag.edge.includes("n")){nh=Math.max(MIN_H,drag.wh-dy);ny=drag.wy+drag.wh-nh;}return{...w,x:nx,y:ny,width:nw,height:nh};}));}}
    function onUp(){setDrag(null);}
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[drag]);

  // Icon drag — free move, snap-to-free-grid on release
  useEffect(()=>{
    if(!iconDrag)return;
    function onMove(e){const nx=Math.max(0,Math.min(e.clientX-iconDrag.ox,window.innerWidth-ICON_W));const ny=Math.max(0,Math.min(e.clientY-iconDrag.oy,window.innerHeight-TASKBAR_H-ICON_H));setIconPos(prev=>({...prev,[iconDrag.id]:{x:nx,y:ny}}));}
    function onUp(){const allPos={};(iconDrag.allIcons||[]).forEach((app,idx)=>{allPos[app.id]=iconPosRef.current[app.id]||defaultIconPos(idx);});const raw=iconPosRef.current[iconDrag.id]||allPos[iconDrag.id];const snapped=raw?snapToFreeGrid(iconDrag.id,raw.x,raw.y,allPos):null;const fp=snapped?{...iconPosRef.current,[iconDrag.id]:snapped}:iconPosRef.current;setIconPos(fp);db.set("user:"+iconDrag.user+":iconpos",fp).catch(()=>{});setIconDrag(null);}
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[iconDrag]);

  // Widget drag — free move, snap to 20px grid on release
  useEffect(()=>{
    if(!widgetDrag)return;
    function onMove(e){const nx=Math.max(0,Math.min(e.clientX-widgetDrag.ox,window.innerWidth-100));const ny=Math.max(0,Math.min(e.clientY-widgetDrag.oy,window.innerHeight-TASKBAR_H-60));setWidgetState(prev=>({...prev,[widgetDrag.id]:{...prev[widgetDrag.id],x:nx,y:ny}}));}
    function onUp(){setWidgetState(prev=>{const s=prev[widgetDrag.id];const snapped=snapW(s.x,s.y);const np={...prev,[widgetDrag.id]:{...s,...snapped}};const fin=np;updateData(d=>({...d,settings:{...(d.settings||{}),widgetState:fin}}));return fin;});setWidgetDrag(null);}
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[widgetDrag]);

  // Widget resize — 8-direction, snap position to grid on release
  useEffect(()=>{
    if(!widgetResize)return;
    function onMove(e){
      const dx=e.clientX-widgetResize.sx,dy=e.clientY-widgetResize.sy;
      const cfg=WIDGET_CONFIGS[widgetResize.id]||{minW:120,minH:80};
      setWidgetState(prev=>{
        const s={...prev[widgetResize.id]};
        let nx=widgetResize.x0,ny=widgetResize.y0,nw=widgetResize.w0,nh=widgetResize.h0;
        if(widgetResize.edge.includes("e"))nw=Math.max(cfg.minW,widgetResize.w0+dx);
        if(widgetResize.edge.includes("s"))nh=Math.max(cfg.minH,widgetResize.h0+dy);
        if(widgetResize.edge.includes("w")){nw=Math.max(cfg.minW,widgetResize.w0-dx);nx=widgetResize.x0+widgetResize.w0-nw;}
        if(widgetResize.edge.includes("n")){nh=Math.max(cfg.minH,widgetResize.h0-dy);ny=widgetResize.y0+widgetResize.h0-nh;}
        return {...prev,[widgetResize.id]:{...s,x:nx,y:ny,w:nw,h:nh}};
      });
    }
    function onUp(){
      setWidgetState(prev=>{const s=prev[widgetResize.id];const snapped=snapW(s.x,s.y);const np={...prev,[widgetResize.id]:{...s,...snapped}};updateData(d=>({...d,settings:{...(d.settings||{}),widgetState:np}}));return np;});
      setWidgetResize(null);
    }
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[widgetResize]);
 
  const showToast     =useCallback((msg)=>{setToast(msg);setTimeout(()=>setToast(null),2500);},[]);
  const saveData      =useCallback(async(d)=>{if(user)await db.set("user:"+user+":data",d);},[user]);
  const updateData    =useCallback((patch)=>{setData(prev=>{const next=typeof patch==="function"?patch(prev):{...prev,...patch};saveData(next);return next;});},[saveData]);
  const updateSettings=useCallback((patch)=>{updateData(prev=>({...prev,settings:{...(prev.settings||{}),...patch}}));},[updateData]);
  const handleCustomWallpaper=useCallback(async(url)=>{setCustomWp(url);await db.set("user:"+user+":wpimg",url);updateSettings({wallpaper:"custom"});showToast("Custom wallpaper set ✓");},[user,updateSettings,showToast]);
  const focusWin=useCallback((id)=>{setMaxZ(z=>{const nz=z+1;setWins(ws=>ws.map(w=>w.id===id?{...w,z:nz}:w));return nz;});},[]);
  // On mobile, every new window opens MAXIMIZED. Default sizes (520x480 etc.)
  // are wider than a ~360px phone and would otherwise spill off the right edge.
  // We still stash the windowed position in prevBounds so toggling out of
  // maximize restores to a sane place if the user later switches modes.
  const openApp=useCallback((appId)=>{
    setMenuOpen(false);
    setMaxZ(z=>{
      const nz=z+1;
      setWins(ws=>{
        const ex=ws.find(w=>w.app===appId);
        if(ex) return ws.map(w=>w.id===ex.id?{...w,z:nz,state:w.state==="minimized"?(deviceMode==="mobile"?"maximized":"normal"):w.state}:w);
        const n=ws.length%6;
        const sz=DEFAULT_SIZES[appId]||{w:520,h:480};
        const baseX=120+n*28, baseY=36+n*22;
        const mobileFirst = deviceMode==="mobile";
        return [...ws,{
          id:Date.now()+Math.random(), app:appId, z:nz,
          x:baseX, y:baseY, width:sz.w, height:sz.h,
          state: mobileFirst ? "maximized" : "normal",
          prevBounds: mobileFirst ? {x:baseX,y:baseY,width:sz.w,height:sz.h} : null,
        }];
      });
      return nz;
    });
  },[deviceMode]);
  function startDrag(e,winId){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"move",winId,ox:e.clientX-w.x,oy:e.clientY-w.y});focusWin(winId);}}
  function startResize(e,winId,edge){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"resize",winId,edge,sx:e.clientX,sy:e.clientY,wx:w.x,wy:w.y,ww:w.width,wh:w.height});focusWin(winId);}}
  function closeWin(id){setWins(ws=>ws.filter(w=>w.id!==id));}
  function minimizeWin(id){setWins(ws=>ws.map(w=>w.id===id?{...w,state:w.state==="minimized"?"normal":"minimized"}:w));}
  function maximizeWin(id){setWins(ws=>ws.map(w=>{if(w.id!==id)return w;if(w.state==="maximized")return{...w,state:"normal",...(w.prevBounds||{}),prevBounds:null};return{...w,state:"maximized",prevBounds:{x:w.x,y:w.y,width:w.width,height:w.height}};}));}
  function onIconMouseDown(e,appId,allIcons){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const idx=allIcons.findIndex(a=>a.id===appId);const pos=iconPos[appId]||defaultIconPos(idx);setIconDrag({id:appId,ox:e.clientX-pos.x,oy:e.clientY-pos.y,user,allIcons:[...allIcons]});}
  function onWidgetDragStart(e,id){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const s=widgetState[id]||DEFAULT_WIDGET_STATE[id];setWidgetDrag({id,ox:e.clientX-s.x,oy:e.clientY-s.y});}
  function onWidgetResizeStart(e,id,edge){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const s=widgetState[id]||DEFAULT_WIDGET_STATE[id];setWidgetResize({id,edge,sx:e.clientX,sy:e.clientY,x0:s.x,y0:s.y,w0:s.w,h0:s.h});}
  function closeWidget(id){updateSettings({widgets:{...widgets,[id]:false}});}

  // Mobile splash visibility — only show when the effective mode actually
  // resolves to mobile (so a user who set Tablet override won't see it).
  const showMobileNotice = deviceMode === "mobile" && !mobileNoticeAck;
  function ackMobileNotice(){
    if(typeof localStorage!=="undefined") localStorage.setItem("nova-mobile-ack","1");
    setMobileNoticeAck(true);
  }
  function switchToTabletMode(){
    if(user) updateSettings({displayMode:"tablet"});
    ackMobileNotice();
  }

  // Reusable mobile-notice overlay — rendered on top of every screen state
  // when showMobileNotice is true. Phones get this on first load (or any time
  // the saved ack is cleared).
  const MobileNotice = !showMobileNotice ? null : (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(7,8,18,0.96)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:FF}}>
      <div style={{maxWidth:380,width:"100%",background:"rgba(15,18,32,0.96)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"28px 24px",textAlign:"center",boxShadow:"0 30px 90px rgba(0,0,0,0.7)"}}>
        <div style={{fontSize:48,marginBottom:12}}>📱</div>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"#fff",marginBottom:10,letterSpacing:0.3}}>Small Screen Detected</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.65,marginBottom:20}}>
          Nova OS is built around draggable windows and a desktop metaphor — it works best on a <strong style={{color:"rgba(255,255,255,0.85)"}}>tablet or computer</strong>. On a phone-sized screen, windows and controls get tight.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {user && (
            <button onClick={switchToTabletMode} style={{padding:"11px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC}}>Try Tablet Layout</button>
          )}
          <button onClick={ackMobileNotice} style={{padding:"11px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.78)"}}>Continue Anyway</button>
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:14,fontStyle:"italic"}}>Change this any time in Settings → Display Mode.</div>
      </div>
    </div>
  );

  async function handleAuth(){
    const u=uname.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");const p=pass.trim();
    if(!u||!p){setAuthErr("All fields required.");return;}if(u.length<3){setAuthErr("Username needs 3+ characters.");return;}
    setBusy(true);setAuthErr("");
    if(mode==="register"){
      const ex=await db.get("user:"+u+":pw");if(ex!==null){setAuthErr("Username taken.");setBusy(false);return;}
      await db.set("user:"+u+":pw",p);const init={notes:[],tasks:[],wallpaper:"mesh",bio:"",joined:Date.now(),settings:{},installedApps:[],folders:[],migratedTo41:true,migratedTo52:true};
      await db.set("user:"+u+":data",init);setUser(u);setData(init);setIconPos({});setWidgetState(DEFAULT_WIDGET_STATE);setScreen("desktop");
    }else{
      const stored=await db.get("user:"+u+":pw");if(stored===null){setAuthErr("Account not found.");setBusy(false);return;}
      if(stored!==p){setAuthErr("Incorrect password.");setBusy(false);return;}
      const d=await db.get("user:"+u+":data");const savedIconPos=await db.get("user:"+u+":iconpos");
      // One-time migrations layered by release. Each runs at most once per user
      // (gated by its own migratedToX.Y flag) and only re-points the wallpaper
      // if the user is on the *previous* default — anyone who deliberately
      // picked sakura / forest / etc. keeps their choice.
      let migratedNow = false;
      if(d&&!d.migratedTo41){
        // 4.1: Nova → Aurora as the default wallpaper.
        if(d.wallpaper==="nova")d.wallpaper="aurora";
        if(d.settings?.wallpaper==="nova")d.settings={...d.settings,wallpaper:"aurora"};
        d.migratedTo41=true;
        migratedNow=true;
      }
      if(d&&!d.migratedTo52){
        // 5.2: Aurora → Mesh as the default wallpaper. This runs *after* the
        // 4.1 step above, so a user who came from v3.x (wallpaper: "nova")
        // gets bumped nova → aurora → mesh in a single login.
        if(d.wallpaper==="aurora")d.wallpaper="mesh";
        if(d.settings?.wallpaper==="aurora")d.settings={...d.settings,wallpaper:"mesh"};
        d.migratedTo52=true;
        migratedNow=true;
      }
      if(migratedNow) await db.set("user:"+u+":data",d);
      setUser(u);setData(d||{notes:[],tasks:[],wallpaper:"mesh",bio:"",joined:Date.now(),settings:{},installedApps:[],folders:[],migratedTo41:true,migratedTo52:true});
      setIconPos(savedIconPos||{});
      if(d?.settings?.widgetState)setWidgetState({...DEFAULT_WIDGET_STATE,...d.settings.widgetState});
      setScreen("desktop");
    }
    setBusy(false);
  }
  function logout(){setUser(null);setData(null);setCustomWp(null);setWins([]);setMaxZ(100);setMenuOpen(false);setIconPos({});setIconDrag(null);setWidgetState(DEFAULT_WIDGET_STATE);setWidgetDrag(null);setWidgetResize(null);setUname("");setPass("");setAuthErr("");setMode("login");setScreen("login");}
 
  const fmtTime=d=>use24h?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false}):d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const fmtDate=d=>d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
  const installedApps=data?.installedApps||[];
  const storeIcons=STORE_CATALOG.filter(a=>installedApps.includes(a.id)).map(a=>({id:"store_"+a.id,icon:a.icon,label:a.name,desc:a.desc,storeApp:a}));
  const allDesktopIcons=[...APPS,...storeIcons];
  const filteredMenu=allDesktopIcons.filter(a=>a.label.toLowerCase().includes(menuSrch.toLowerCase())||a.desc?.toLowerCase().includes(menuSrch.toLowerCase()));
  const isAnyDrag=drag||iconDrag||widgetDrag||widgetResize;
  const dragCursor=drag?(drag.type==="move"?"grabbing":drag.edge+"-resize"):widgetResize?(widgetResize.edge+"-resize"):isAnyDrag?"grabbing":"default";
 
  // ── BOOT ─────────────────────────────────────────────────────────────────
  if(screen==="boot")return(<div style={{width:"100%",height:"100vh",background:"#07080f",display:"flex",flexDirection:"column",justifyContent:"center",padding:"10vh max(24px, 12%)"}}><style>{CSS}</style><div style={{fontFamily:FFB,fontWeight:700,fontSize:"clamp(40px, 12vw, 66px)",letterSpacing:4,color:"#fff",marginBottom:4,lineHeight:1}}>NOVA</div><div style={{fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.22)",letterSpacing:5,marginBottom:46}}>OPERATING SYSTEM  ·  v5.3</div>{bootLines.map((l,i)=><div key={i} style={{fontFamily:FFM,fontSize:12,color:l.includes("ready")?"#4f9eff":"rgba(255,255,255,0.42)",marginBottom:5,animation:"boot-in 0.22s cubic-bezier(0.4,0,0.2,1)"}}>{l.includes("OK")?<>{l.replace("... OK","")}... <span style={{color:"#4cef90"}}>OK</span></>:l}</div>)}{MobileNotice}</div>);
 
  // ── LOGIN ────────────────────────────────────────────────────────────────
  if(screen==="login")return(<div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}><style>{CSS}</style><MeshBg/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"rgba(8,10,22,0.86)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:16,padding:"44px 40px",width:376,maxWidth:"calc(100vw - 24px)",boxShadow:"0 40px 100px rgba(0,0,0,0.6)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,"+DEFAULT_AC+",transparent)"}}/><div style={{fontFamily:FFB,fontWeight:700,fontSize:38,color:"#fff",textAlign:"center",letterSpacing:4,marginBottom:4}}>NOVA</div><div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.22)",textAlign:"center",letterSpacing:4,marginBottom:36}}>OPERATING SYSTEM  ·  v5.3</div><div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.09)",marginBottom:24}}>{["login","register"].map(m=><button key={m} className="lt" onClick={()=>{setMode(m);setAuthErr("");}} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:mode===m?"2px solid "+DEFAULT_AC:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,letterSpacing:1,color:mode===m?DEFAULT_AC:"rgba(255,255,255,0.28)",transition:"color 0.15s"}}>{m==="login"?"SIGN IN":"REGISTER"}</button>)}</div><input style={{...INP,marginBottom:11}} placeholder="Username" value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} autoFocus/><input style={INP} type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/><button className="ls" disabled={busy} onClick={handleAuth} style={{width:"100%",padding:"12px",background:fill(DEFAULT_AC),border:"1px solid "+bdr(DEFAULT_AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:14,letterSpacing:1,color:"#fff",marginTop:14,transition:"opacity 0.15s"}}>{busy?"AUTHENTICATING…":mode==="login"?"SIGN IN →":"CREATE ACCOUNT →"}</button>{authErr&&<div style={{color:"#ff7878",fontFamily:FF,fontSize:13,textAlign:"center",marginTop:12}}>⚠ {authErr}</div>}<div style={{marginTop:20,fontFamily:FF,fontStyle:"italic",fontSize:11,color:"rgba(255,255,255,0.14)",textAlign:"center"}}>Don't reuse real passwords — demo auth only.</div></div></div>{MobileNotice}</div>);
 
  // ── DESKTOP ──────────────────────────────────────────────────────────────
  return(
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",cursor:dragCursor,fontSize:largeFnt?15:13}}>
      <style>{CSS}</style>
      <Wallpaper id={wpId} customUrl={customWp}/>
      {toast&&<div style={{position:"fixed",top:14,right:14,zIndex:99999,padding:"10px 18px",background:"rgba(8,10,22,0.97)",border:"1px solid "+AC,borderRadius:9,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",animation:"toast-in 0.24s cubic-bezier(0.16,1,0.3,1)",boxShadow:"0 8px 36px rgba(0,0,0,0.6)"}}>{toast}</div>}
 
      {/* Desktop widgets */}
      {Object.keys(WIDGET_CONFIGS).map(id=>{
        if(!widgets[id])return null;
        const s=widgetState[id]||DEFAULT_WIDGET_STATE[id]||{x:200,y:200,w:240,h:140};
        return(
          <WidgetShell key={id} id={id} state={s} onDragStart={onWidgetDragStart} onResizeStart={onWidgetResizeStart} onClose={()=>closeWidget(id)} touchy={touchy}>
            {id==="clock"   &&<ClockWidgetContent   state={s} tick={tick} use24h={use24h} AC={AC}/>}
            {id==="weather" &&<WeatherWidgetContent  state={s}/>}
            {id==="notesw"  &&<NotesWidgetContent    state={s} data={data}/>}
            {id==="tasksw"  &&<TasksWidgetContent    state={s} data={data} updateData={updateData}/>}
            {id==="calendar"&&<CalendarWidgetContent state={s} tick={tick} AC={AC}/>}
            {id==="sysinfo" &&<SysInfoWidgetContent  state={s}/>}
          </WidgetShell>
        );
      })}
 
      {/* Desktop icons */}
      {allDesktopIcons.map((app,idx)=>{
        const pos=iconPos[app.id]||defaultIconPos(idx);
        const isDrg=iconDrag?.id===app.id;
        function launch(){if(app.storeApp){if(app.storeApp.newTab)window.open(app.storeApp.url,"_blank");else openApp("browser");}else openApp(app.id);}
        return(
          <div key={app.id} style={{position:"absolute",left:pos.x,top:pos.y,width:ICON_W,zIndex:isDrg?500:2,cursor:isDrg?"grabbing":"grab",userSelect:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:9,background:"rgba(0,0,0,0.1)",border:"1px solid transparent",transition:isDrg?"none":"background 0.18s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1), top 0.25s cubic-bezier(0.4,0,0.2,1)",boxShadow:isDrg?"0 8px 32px rgba(0,0,0,0.6)":"none"}}
            className={isDrg?"":"di"} title={app.desc} onPointerDown={e=>onIconMouseDown(e,app.id,allDesktopIcons)} onDoubleClick={launch}>
            <div style={{pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.7))"}}>
              <AppIconDisplay app={app} size={28}/>
            </div>
            <span style={{fontFamily:FF,fontWeight:600,fontSize:10,color:"#fff",textAlign:"center",lineHeight:1.2,textShadow:"0 1px 4px #000",pointerEvents:"none"}}>{app.label}</span>
          </div>
        );
      })}
 
      {/* Start menu */}
      {menuOpen&&(<div ref={menuRef} style={{position:"fixed",bottom:TASKBAR_H,left:0,width:360,background:"rgba(9,11,24,0.97)",backdropFilter:"blur(30px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"0 14px 0 0",boxShadow:"6px -6px 48px rgba(0,0,0,0.65)",zIndex:9998,display:"flex",flexDirection:"column",animation:"menu-up 0.22s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden"}}>
        <div style={{padding:"16px 16px 10px"}}><div style={{display:"flex",alignItems:"center",gap:9,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"9px 14px"}}><span style={{fontSize:13,opacity:0.5}}>🔍</span><input value={menuSrch} onChange={e=>setMenuSrch(e.target.value)} placeholder="Search apps…" autoFocus style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,0.92)",fontFamily:FF,fontSize:14}}/>{menuSrch&&<button onClick={()=>setMenuSrch("")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>✕</button>}</div></div>
        <div style={{padding:"0 14px 14px",flex:1,overflowY:"auto"}}>
          <div style={SEC}>{menuSrch?`Results for "${menuSrch}"`:"All Apps"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
            {filteredMenu.map(app=>(
              <div key={app.id} className="ma" onClick={()=>{if(app.storeApp){if(app.storeApp.newTab)window.open(app.storeApp.url,"_blank");else openApp("browser");}else openApp(app.id);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 4px",borderRadius:9,cursor:"pointer",transition:"background 0.12s",position:"relative"}}>
                {wins.some(w=>w.app===app.id)&&<div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:AC}}/>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><AppIconDisplay app={app} size={24}/></div>
                <span style={{fontFamily:FF,fontWeight:600,fontSize:10,color:"rgba(255,255,255,0.8)",textAlign:"center",lineHeight:1.25}}>{app.label}</span>
              </div>
            ))}
            {filteredMenu.length===0&&<div style={{gridColumn:"span 4",color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:12,textAlign:"center",padding:"18px 0"}}>No apps found</div>}
          </div>
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:fill(AC),border:"1.5px solid "+AC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>👤</div>
          <div style={{flex:1}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff"}}>@{user}</div><div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.3)"}}>Nova OS v5.3</div></div>
          <button onClick={logout} style={{padding:"6px 12px",background:"rgba(200,40,40,0.12)",border:"1px solid rgba(200,40,40,0.3)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,140,140,0.9)"}}>Logout</button>
        </div>
      </div>)}
 
      {/* Windows */}
      {wins.map(win=>{
        const app=APPS.find(a=>a.id===win.app);
        const isMax=win.state==="maximized",isMin=win.state==="minimized",isDrg=drag&&drag.winId===win.id;
        if(isMin)return null;
        const winStyle=isMax?{position:"fixed",top:0,left:0,right:0,bottom:TASKBAR_H+"px",zIndex:win.z,borderRadius:0}:{position:"absolute",left:win.x,top:win.y,width:win.width,height:win.height,zIndex:win.z,borderRadius:12};
        return(
          <div key={win.id} onClick={()=>focusWin(win.id)} style={{...winStyle,background:"rgba(10,12,26,0.93)",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 "+(isDrg?30:15)+"px "+(isDrg?90:50)+"px rgba(0,0,0,"+(isDrg?0.8:0.6)+")",display:"flex",flexDirection:"column",animation:"win-in 0.24s cubic-bezier(0.16,1,0.3,1)",backdropFilter:"blur("+winBlur+"px)",transition:isDrg?"box-shadow 0.18s cubic-bezier(0.4,0,0.2,1)":"box-shadow 0.18s cubic-bezier(0.4,0,0.2,1), left 0.28s cubic-bezier(0.4,0,0.2,1), top 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1), height 0.28s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden"}}>
            {!isMax&&<ResizeHandles winId={win.id} onStartResize={startResize} touchy={touchy}/>}
            <div onPointerDown={e=>!isMax&&startDrag(e,win.id)} style={{height:38,display:"flex",alignItems:"center",padding:"0 8px 0 12px",gap:9,background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.07)",borderRadius:isMax?"0":"12px 12px 0 0",cursor:isMax?"default":isDrg?"grabbing":"grab",userSelect:"none",flexShrink:0,touchAction:"none"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={16}/></div>
              <span style={{flex:1,fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.88)"}}>{app?.label}</span>
              <button className="wn" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimizeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(255,255,255,0.5)",transition:"background 0.12s",flexShrink:0}}>–</button>
              <button className="wm" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();maximizeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"rgba(255,255,255,0.5)",transition:"background 0.12s",flexShrink:0}}>{isMax?"❐":"⬜"}</button>
              <button className="wx" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();closeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"rgba(255,255,255,0.5)",transition:"background 0.12s, color 0.12s",flexShrink:0}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:18,minWidth:0}}>
              {win.app==="notes"    &&<NotesApp    data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="tasks"    &&<TasksApp    data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="files"    &&<FilesApp    data={data} updateData={updateData} showToast={showToast}/>}
              {win.app==="paint"    &&<PaintApp    showToast={showToast} AC={AC}/>}
              {win.app==="browser"  &&<BrowserApp  AC={AC}/>}
              {win.app==="snake"    &&<SnakeApp    AC={AC}/>}
              {win.app==="2048"     &&<Game2048App AC={AC}/>}
              {win.app==="store"    &&<StoreApp    user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="terminal" &&<TerminalApp user={user} AC={AC}/>}
              {win.app==="chat"     &&<ChatApp     user={user} AC={AC}/>}
              {win.app==="settings" &&<SettingsApp user={user} data={data} updateSettings={updateSettings} showToast={showToast} AC={AC} onCustomWallpaper={handleCustomWallpaper}/>}
              {win.app==="profile"  &&<ProfileApp  user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="calculator" &&<CalculatorApp AC={AC}/>}
              {win.app==="clock"      &&<ClockApp AC={AC}/>}
              {win.app==="calendar"   &&<CalendarApp data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="music"      &&<MusicApp AC={AC} showToast={showToast}/>}
              {win.app==="pdf"        &&<PdfApp AC={AC} showToast={showToast}/>}
              {win.app==="atmos"      &&<AtmosApp AC={AC} showToast={showToast}/>}
              {win.app==="minesweeper"&&<MinesweeperApp AC={AC}/>}
              {win.app==="wordle"     &&<WordleApp AC={AC} showToast={showToast}/>}
              {win.app==="tetris"     &&<TetrisApp AC={AC}/>}
              {win.app==="novaai"     &&<NovaAiApp AC={AC} showToast={showToast}/>}
            </div>
          </div>
        );
      })}
 
      {/* Taskbar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:TASKBAR_H,background:"rgba(9,11,24,0.92)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",padding:"0 10px",gap:5,zIndex:9999}}>
        <button className="sb" onClick={()=>{setMenuOpen(o=>!o);setMenuSrch("");}} style={{width:38,height:38,borderRadius:10,background:menuOpen?fill(AC):"rgba(255,255,255,0.07)",border:menuOpen?"1px solid "+bdr(AC):"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",fontSize:17,color:menuOpen?AC:"rgba(255,255,255,0.7)"}}>◈</button>
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.09)",margin:"0 3px"}}/>
        {wins.map(win=>{const app=APPS.find(a=>a.id===win.app);const isMin=win.state==="minimized";const isTop=wins.length>0&&win.z===Math.max(...wins.map(w=>w.z));return(<button key={win.id} className="tb" onClick={()=>{if(isMin){setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"normal"}:w));focusWin(win.id);}else if(isTop){setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"minimized"}:w));}else focusWin(win.id);}} style={{height:36,padding:"0 10px",background:isTop&&!isMin?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,cursor:"pointer",fontFamily:FF,fontSize:12,fontWeight:600,color:isMin?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.82)",whiteSpace:"nowrap",transition:"all 0.12s",display:"flex",alignItems:"center",gap:6,position:"relative"}}><div style={{pointerEvents:"none",display:"flex",alignItems:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={14}/></div>{deviceMode!=="mobile"&&<span>{app?.label}</span>}{!isMin&&<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:isTop?18:6,height:2,borderRadius:2,background:AC,transition:"width 0.2s"}}/>}</button>);})}
        <div style={{flex:1}}/>
        {/* Username chip + divider hidden on mobile to save horizontal space — */}
        {/* profile is still reachable via the menu, so this only loses a shortcut. */}
        {deviceMode!=="mobile"&&<div style={{fontFamily:FFB,fontWeight:600,fontSize:12,color:AC,cursor:"pointer"}} onClick={()=>openApp("profile")}>@{user}</div>}
        {deviceMode!=="mobile"&&<div style={{width:1,height:20,background:"rgba(255,255,255,0.09)"}}/>}
        <button className="sb" onClick={()=>openApp("settings")} style={{width:30,height:30,borderRadius:7,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"rgba(255,255,255,0.45)",transition:"background 0.12s"}}>⚙️</button>
        <div style={{textAlign:"right",cursor:"default"}}>
          <div style={{fontFamily:FFM,fontWeight:500,fontSize:12,color:"rgba(255,255,255,0.78)"}}>{fmtTime(tick)}</div>
          {deviceMode!=="mobile"&&<div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.35)"}}>{fmtDate(tick)}</div>}
        </div>
      </div>
      {MobileNotice}
    </div>
  );
}
 
// ─── APP COMPONENTS ───────────────────────────────────────────────────────────
function NotesApp({data,updateData,showToast,AC}){
  const [title,setTitle]=useState("");const [body,setBody]=useState("");
  function add(){if(!title.trim())return;updateData(p=>({...p,notes:[{id:Date.now(),title:title.trim(),body:body.trim(),ts:Date.now()},...(p.notes||[])]}));setTitle("");setBody("");showToast("Note saved ✓");}
  function del(id){updateData(p=>({...p,notes:p.notes.filter(n=>n.id!==id)}));}
  const notes=data?.notes||[];
  return(<div style={{width:"100%",fontFamily:FF}}><div style={SEC}>Notes</div><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title…" style={INP} onKeyDown={e=>e.key==="Enter"&&add()}/><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write something…" style={{...INP,minHeight:80}}/><button onClick={add} style={{padding:"9px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>+ Add Note</button></div>{notes.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:12,textAlign:"center",padding:"22px 0",fontStyle:"italic"}}>No notes yet</div>}{notes.map(n=>(<div key={n.id} style={{padding:"11px 13px",marginBottom:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,position:"relative"}}><div style={{fontWeight:600,fontSize:14,color:"rgba(255,255,255,0.92)",paddingRight:26,marginBottom:n.body?3:0}}>{n.title}</div>{n.body&&<div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body}</div>}<div style={{fontFamily:FFM,fontSize:9,color:"rgba(255,255,255,0.18)",marginTop:5}}>{new Date(n.ts).toLocaleDateString()}</div><button className="dl" onClick={()=>del(n.id)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,transition:"color 0.12s"}}>✕</button></div>))}</div>);
}
 
function TasksApp({data,updateData,showToast,AC}){
  const [input,setInput]=useState("");
  function add(){if(!input.trim())return;updateData(p=>({...p,tasks:[...(p.tasks||[]),{id:Date.now(),text:input.trim(),done:false}]}));setInput("");showToast("Task added ✓");}
  function toggle(id){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));}
  function del(id){updateData(p=>({...p,tasks:p.tasks.filter(t=>t.id!==id)}));}
  const tasks=data?.tasks||[];const pending=tasks.filter(t=>!t.done);const done=tasks.filter(t=>t.done);
  return(<div style={{width:"100%",fontFamily:FF}}><div style={SEC}>Tasks</div><div style={{display:"flex",gap:7,marginBottom:16}}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Add a task…" style={{...INP,flex:1}} onKeyDown={e=>e.key==="Enter"&&add()}/><button onClick={add} style={{width:40,background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:18,color:AC}}>+</button></div>{tasks.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:12,textAlign:"center",padding:"22px 0",fontStyle:"italic"}}>All clear!</div>}{pending.map(t=><TRow key={t.id} t={t} onToggle={toggle} onDel={del} AC={AC}/>)}{done.length>0&&<><div style={{...SEC,marginTop:14}}>Done ({done.length})</div>{done.map(t=><TRow key={t.id} t={t} onToggle={toggle} onDel={del} AC={AC}/>)}</>}</div>);
}
function TRow({t,onToggle,onDel,AC}){return(<div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,opacity:t.done?0.4:1,transition:"opacity 0.2s"}}><div onClick={()=>onToggle(t.id)} style={{width:17,height:17,borderRadius:5,border:"1.5px solid "+(t.done?AC:"rgba(255,255,255,0.22)"),background:t.done?AC:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.14s"}}>{t.done&&<span style={{color:"#000",fontSize:9,fontWeight:900}}>✓</span>}</div><span style={{flex:1,fontFamily:FF,fontSize:13,color:"rgba(255,255,255,0.88)",textDecoration:t.done?"line-through":"none"}}>{t.text}</span><button className="dl" onClick={()=>onDel(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:0,transition:"color 0.12s"}}>✕</button></div>);}
 
function FilesApp({data,updateData,showToast,AC}){
  const [curId,setCurId]=useState(null); // null = root
  const [preview,setPreview]=useState(null);
  const [newFolderName,setNewFolderName]=useState("");
  const [showNewFolder,setShowNewFolder]=useState(false);
  const [showNewNote,setShowNewNote]=useState(false);
  const [newNoteTitle,setNewNoteTitle]=useState("");
  const [newNoteBody,setNewNoteBody]=useState("");
  const [movingItem,setMovingItem]=useState(null); // {type,id,name}
  const [editingFolder,setEditingFolder]=useState(null); // {id,name}
 
  const ac=AC||DEFAULT_AC;
  const folders=data?.folders||[];
  const notes=data?.notes||[];
  const tasks=data?.tasks||[];
 
  // Build breadcrumb path
  function buildPath(id){
    if(!id)return [];
    const path=[];let cur=id;
    while(cur){const f=folders.find(x=>x.id===cur);if(!f)break;path.unshift(f);cur=f.parentId;}
    return path;
  }
  const breadcrumb=buildPath(curId);
  const subFolders=folders.filter(f=>f.parentId===curId);
  const curNotes=notes.filter(n=>(n.folderId||null)===curId);
  const curTasks=tasks.filter(t=>(t.folderId||null)===curId);
 
  function createFolder(){
    if(!newFolderName.trim())return;
    const f={id:"f"+Date.now(),name:newFolderName.trim(),parentId:curId,created:Date.now()};
    updateData(p=>({...p,folders:[...(p.folders||[]),f]}));
    setNewFolderName("");setShowNewFolder(false);showToast("Folder created ✓");
  }
  function deleteFolder(fid){
    function desc(id){const ch=folders.filter(f=>f.parentId===id);return[id,...ch.flatMap(c=>desc(c.id))];}
    const dead=new Set(desc(fid));
    if(!window.confirm("Delete this folder and move its contents to root?"))return;
    updateData(p=>({...p,
      folders:p.folders.filter(f=>!dead.has(f.id)),
      notes:p.notes.map(n=>dead.has(n.folderId)?{...n,folderId:null}:n),
      tasks:p.tasks.map(t=>dead.has(t.folderId)?{...t,folderId:null}:t),
    }));
    showToast("Folder deleted");
  }
  function renameFolder(id,name){
    if(!name.trim())return;
    updateData(p=>({...p,folders:p.folders.map(f=>f.id===id?{...f,name:name.trim()}:f)}));
    setEditingFolder(null);showToast("Renamed ✓");
  }
  function createNote(){
    if(!newNoteTitle.trim())return;
    updateData(p=>({...p,notes:[{id:Date.now(),title:newNoteTitle.trim(),body:newNoteBody.trim(),ts:Date.now(),folderId:curId},...(p.notes||[])]}));
    setNewNoteTitle("");setNewNoteBody("");setShowNewNote(false);showToast("Note created ✓");
  }
  function deleteNote(id){updateData(p=>({...p,notes:p.notes.filter(n=>n.id!==id)}));if(preview?.id===id)setPreview(null);showToast("Deleted");}
  function deleteTask(id){updateData(p=>({...p,tasks:p.tasks.filter(t=>t.id!==id)}));showToast("Deleted");}
  function toggleTask(id){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));}
  function moveNote(noteId,fid){updateData(p=>({...p,notes:p.notes.map(n=>n.id===noteId?{...n,folderId:fid}:n)}));setMovingItem(null);showToast("Moved ✓");}
  function moveTask(taskId,fid){updateData(p=>({...p,tasks:p.tasks.map(t=>t.id===taskId?{...t,folderId:fid}:t)}));setMovingItem(null);showToast("Moved ✓");}
 
  // All folder options for move dropdown
  const folderOpts=[{id:null,label:"🏠 Home (root)"}];
  function addOpt(fid,depth){
    const f=folders.find(x=>x.id===fid);if(!f)return;
    folderOpts.push({id:fid,label:"\u00a0".repeat(depth*3)+"📁 "+f.name});
    folders.filter(x=>x.parentId===fid).forEach(c=>addOpt(c.id,depth+1));
  }
  folders.filter(f=>!f.parentId).forEach(f=>addOpt(f.id,1));
 
  const itemCount=(fid)=>folders.filter(x=>x.parentId===fid).length+notes.filter(n=>n.folderId===fid).length+tasks.filter(t=>t.folderId===fid).length;
  const btStyle=(active)=>({padding:"5px 11px",background:active?fill(ac):"rgba(255,255,255,0.06)",border:"1px solid "+(active?bdr(ac):"rgba(255,255,255,0.11)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:active?ac:"rgba(255,255,255,0.6)"});
 
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      {/* Breadcrumb + action buttons */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:4,flex:1,flexWrap:"wrap",fontFamily:FFB,fontWeight:600,fontSize:12}}>
          <span style={{cursor:"pointer",color:curId?ac:"rgba(255,255,255,0.6)"}} onClick={()=>setCurId(null)}>🏠 Home</span>
          {breadcrumb.map((f,i)=>(
            <span key={f.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{color:"rgba(255,255,255,0.2)"}}>{">"}</span>
              <span style={{cursor:"pointer",color:i===breadcrumb.length-1?"rgba(255,255,255,0.7)":ac}} onClick={()=>setCurId(f.id)}>{f.name}</span>
            </span>
          ))}
        </div>
        <button onClick={()=>{setShowNewFolder(v=>!v);setShowNewNote(false);}} style={btStyle(showNewFolder)}>📁 New Folder</button>
        <button onClick={()=>{setShowNewNote(v=>!v);setShowNewFolder(false);}} style={btStyle(showNewNote)}>📄 New Note</button>
      </div>
 
      {/* New folder input */}
      {showNewFolder&&(
        <div style={{display:"flex",gap:7,marginBottom:10}}>
          <input autoFocus value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createFolder()} placeholder="Folder name…" style={{...INP,flex:1}}/>
          <button onClick={createFolder} style={{padding:"7px 14px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:ac}}>Create</button>
          <button onClick={()=>setShowNewFolder(false)} style={{padding:"7px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:7,cursor:"pointer",color:"rgba(255,255,255,0.5)",fontFamily:FFB,fontSize:12}}>✕</button>
        </div>
      )}
 
      {/* New note input */}
      {showNewNote&&(
        <div style={{padding:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,marginBottom:10,display:"flex",flexDirection:"column",gap:7}}>
          <input autoFocus value={newNoteTitle} onChange={e=>setNewNoteTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createNote()} placeholder="Note title…" style={INP}/>
          <textarea value={newNoteBody} onChange={e=>setNewNoteBody(e.target.value)} placeholder="Content… (optional)" style={{...INP,minHeight:55}}/>
          <div style={{display:"flex",gap:7}}>
            <button onClick={createNote} style={{flex:1,padding:"7px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:ac}}>Create Note</button>
            <button onClick={()=>setShowNewNote(false)} style={{padding:"7px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:7,cursor:"pointer",color:"rgba(255,255,255,0.5)",fontFamily:FFB,fontSize:12}}>Cancel</button>
          </div>
        </div>
      )}
 
      {/* Move dialog */}
      {movingItem&&(
        <div style={{padding:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,marginBottom:10}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:7}}>Move "<b>{movingItem.name}</b>" to:</div>
          <select onChange={e=>{const tid=e.target.value==="null"?null:e.target.value;movingItem.type==="note"?moveNote(movingItem.id,tid):moveTask(movingItem.id,tid);}} style={{...INP,cursor:"pointer",marginBottom:8}} defaultValue={movingItem.folderId||"null"}>
            {folderOpts.map(o=><option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
          </select>
          <button onClick={()=>setMovingItem(null)} style={{padding:"5px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontSize:11,color:"rgba(255,255,255,0.5)"}}>Cancel</button>
        </div>
      )}
 
      {/* Empty state */}
      {subFolders.length===0&&curNotes.length===0&&curTasks.length===0&&!showNewFolder&&!showNewNote&&(
        <div style={{textAlign:"center",color:"rgba(255,255,255,0.18)",fontSize:13,fontStyle:"italic",padding:"32px 0"}}>
          {curId?"This folder is empty":"No files yet"}<br/>
          <span style={{fontSize:11}}>Use the buttons above to create folders or notes</span>
        </div>
      )}
 
      {/* Subfolders */}
      {subFolders.length>0&&<div style={SEC}>Folders ({subFolders.length})</div>}
      {subFolders.map(f=>(
        <div key={f.id} className="fr" style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:4,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer",transition:"background 0.12s"}}>
          <span style={{fontSize:20,pointerEvents:"none"}}>📁</span>
          {editingFolder?.id===f.id?(
            <input autoFocus value={editingFolder.name} onChange={e=>setEditingFolder(x=>({...x,name:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")renameFolder(f.id,editingFolder.name);if(e.key==="Escape")setEditingFolder(null);}} onBlur={()=>renameFolder(f.id,editingFolder.name)} style={{...INP,flex:1,padding:"3px 8px",fontSize:13}}/>
          ):(
            <div style={{flex:1}} onClick={()=>setCurId(f.id)} onDoubleClick={()=>setCurId(f.id)}>
              <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)"}}>{f.name}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginTop:1}}>{itemCount(f.id)} items</div>
            </div>
          )}
          <button onClick={e=>{e.stopPropagation();setEditingFolder({id:f.id,name:f.name});}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.28)",fontSize:12,padding:"3px 6px"}} title="Rename">✏️</button>
          <button className="dl" onClick={e=>{e.stopPropagation();deleteFolder(f.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,padding:"3px 6px",transition:"color 0.12s"}} title="Delete">✕</button>
        </div>
      ))}
 
      {/* Notes */}
      {curNotes.length>0&&<div style={{...SEC,marginTop:subFolders.length>0?12:0}}>Notes ({curNotes.length})</div>}
      {curNotes.map(n=>(
        <div key={n.id}>
          <div className="fr" onClick={()=>setPreview(preview?.id===n.id?null:n)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:3,background:preview?.id===n.id?"rgba(79,158,255,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(preview?.id===n.id?"rgba(79,158,255,0.35)":"rgba(255,255,255,0.07)"),borderRadius:7,cursor:"pointer",transition:"background 0.12s"}}>
            <span style={{fontSize:14}}>📄</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.28)",fontFamily:FFM}}>{new Date(n.ts).toLocaleDateString()}{n.body?" · "+n.body.slice(0,28)+"…":""}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();setMovingItem({type:"note",id:n.id,name:n.title,folderId:n.folderId||null});}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,padding:"3px 5px"}} title="Move to folder">↪</button>
            <button className="dl" onClick={e=>{e.stopPropagation();deleteNote(n.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:"3px 5px",transition:"color 0.12s"}}>✕</button>
          </div>
          {preview?.id===n.id&&(
            <div style={{marginBottom:6,padding:"11px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7}}>
              <div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:5}}>{n.title}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.65,whiteSpace:"pre-wrap"}}>{n.body||"(no content)"}</div>
            </div>
          )}
        </div>
      ))}
 
      {/* Tasks */}
      {curTasks.length>0&&<div style={{...SEC,marginTop:curNotes.length>0||subFolders.length>0?12:0}}>Tasks ({curTasks.length})</div>}
      {curTasks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,opacity:t.done?0.45:1}}>
          <div onClick={()=>toggleTask(t.id)} style={{width:17,height:17,borderRadius:5,border:"1.5px solid "+(t.done?ac:"rgba(255,255,255,0.22)"),background:t.done?ac:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {t.done&&<span style={{color:"#000",fontSize:9,fontWeight:900}}>✓</span>}
          </div>
          <span style={{flex:1,fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.88)",textDecoration:t.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
          <button onClick={()=>setMovingItem({type:"task",id:t.id,name:t.text,folderId:t.folderId||null})} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,padding:"3px 5px"}} title="Move">↪</button>
          <button className="dl" onClick={()=>deleteTask(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:"3px 5px",transition:"color 0.12s"}}>✕</button>
        </div>
      ))}
    </div>
  );
}
 
function PaintApp({showToast,AC}){
  const CW=1000,CH=600;const canvasRef=useRef(null);const lastPos=useRef(null);
  const [color,setColor]=useState("#000000");const [size,setSize]=useState(6);const [tool,setTool]=useState("pen");const [drawing,setDrawing]=useState(false);
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,CW,CH);},[]);
  function gp(e){const c=canvasRef.current;const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*(CW/r.width),y:(e.clientY-r.top)*(CH/r.height)};}
  function down(e){e.stopPropagation();setDrawing(true);const pos=gp(e);lastPos.current=pos;const ctx=canvasRef.current.getContext("2d");ctx.beginPath();ctx.arc(pos.x,pos.y,size/2,0,Math.PI*2);ctx.fillStyle=tool==="eraser"?"#fff":color;ctx.fill();}
  function move(e){if(!drawing||!lastPos.current)return;e.stopPropagation();const pos=gp(e);const ctx=canvasRef.current.getContext("2d");ctx.beginPath();ctx.moveTo(lastPos.current.x,lastPos.current.y);ctx.lineTo(pos.x,pos.y);ctx.strokeStyle=tool==="eraser"?"#fff":color;ctx.lineWidth=size;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();lastPos.current=pos;}
  function up(e){e.stopPropagation();setDrawing(false);lastPos.current=null;}
  function TBtn({id,lbl}){return<button onClick={()=>setTool(id)} style={{padding:"6px 11px",background:tool===id?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(tool===id?bdr(AC):"rgba(255,255,255,0.11)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:tool===id?AC:"rgba(255,255,255,0.6)"}}>{lbl}</button>;}
  return(<div style={{width:"100%",display:"flex",flexDirection:"column",gap:10,fontFamily:FF}}><div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}><TBtn id="pen" lbl="✏️ Pen"/><TBtn id="eraser" lbl="⬜ Eraser"/><div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}><span style={{fontSize:10,fontFamily:FFB,fontWeight:600,letterSpacing:1,color:"rgba(255,255,255,0.3)"}}>SIZE</span><input type="range" min={2} max={60} value={size} onChange={e=>setSize(+e.target.value)} style={{width:80,accentColor:AC}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.5)",width:20}}>{size}</span></div><div style={{flex:1}}/><button onClick={()=>{const c=canvasRef.current;const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,CW,CH);}} style={{padding:"6px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.55)"}}>Clear</button><button onClick={()=>{const a=document.createElement("a");a.download="nova-paint.png";a.href=canvasRef.current.toDataURL();a.click();showToast("Saved ✓");}} style={{padding:"6px 11px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:AC}}>⬇ Save</button></div><canvas ref={canvasRef} width={CW} height={CH} style={{width:"100%",height:"auto",borderRadius:7,cursor:tool==="eraser"?"cell":"crosshair",display:"block",border:"1px solid rgba(255,255,255,0.1)",touchAction:"none"}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}/><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>{PAINT_COLORS.map(c=><div key={c} className="ps" onClick={()=>{setColor(c);setTool("pen");}} style={{width:22,height:22,borderRadius:5,background:c,cursor:"pointer",border:(color===c&&tool==="pen")?"2.5px solid #fff":"2px solid rgba(255,255,255,0.14)",transition:"transform 0.1s",boxSizing:"border-box"}}/>)}<input type="color" value={color} onChange={e=>{setColor(e.target.value);setTool("pen");}} style={{width:26,height:26,borderRadius:5,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",background:"none",marginLeft:4}}/></div></div>);
}
 
function BrowserApp({AC}){
  const [bar,setBar]=useState("");
  const [view,setView]=useState("home");
  const [results,setResults]=useState(null);
  const [frameUrl,setFrameUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [hist,setHist]=useState([]);
  const [hIdx,setHIdx]=useState(-1);
  // Bumped to force a fresh iframe mount on manual refresh. We can't call
  // iframe.contentWindow.location.reload() on cross-origin frames, so the
  // remount-via-key trick is the cleanest reload mechanism.
  const [reloadKey,setReloadKey]=useState(0);
  // Tracks whether the current iframe page has fired onLoad yet, so we can
  // show a thin progress bar at the top of the iframe while it's loading.
  const [framing,setFraming]=useState(false);

  // Whenever the URL or refresh key changes, the iframe will remount. Mark
  // it as loading until onLoad fires.
  useEffect(()=>{
    if(view==="browse"&&frameUrl&&!isLikelyUnframable(frameUrl))setFraming(true);
  },[frameUrl,reloadKey,view]);

  // Wrapper around rewriteForIframe + history bookkeeping. Centralized so
  // back/forward and bookmarks all flow through the same URL normalization.
  function browse(url){
    const full=rewriteForIframe(url);
    if(!full)return;
    const nh=[...hist.slice(0,hIdx+1),full];
    setHist(nh);setHIdx(nh.length-1);
    setFrameUrl(full);setBar(full);setView("browse");
  }
  async function novaSearch(q){setLoading(true);setView("results");setResults(null);try{const[d,w]=await Promise.allSettled([fetch("https://api.duckduckgo.com/?q="+encodeURIComponent(q)+"&format=json&no_html=1&skip_disambig=1").then(r=>r.json()),fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(q)+"&format=json&origin=*&srlimit=7").then(r=>r.json())]);setResults({q,ddg:d.status==="fulfilled"?d.value:null,wiki:w.status==="fulfilled"?w.value:null});}catch{setResults({q,ddg:null,wiki:null});}setLoading(false);}
  function go(i){const q=(i||bar).trim();if(!q)return;if(isUrl(q))browse(q);else novaSearch(q);}
  function back(){if(hIdx>0){const i=hIdx-1;setHIdx(i);setFrameUrl(hist[i]);setBar(hist[i]);setView("browse");}}
  function fwd(){if(hIdx<hist.length-1){const i=hIdx+1;setHIdx(i);setFrameUrl(hist[i]);setBar(hist[i]);setView("browse");}}
  function refresh(){
    if(view==="browse"&&frameUrl) setReloadKey(k=>k+1);
    else if(view==="results"&&results?.q) novaSearch(results.q);
  }

  // CRITICAL: do NOT extract this into a Shell sub-component defined inside
  // BrowserApp. Doing so creates a new component identity on every render,
  // which makes React unmount/remount the iframe — and re-fetch the page —
  // on every parent tick (the clock fires setTick every second, cascading
  // a re-render to here). That bug shipped in 4.3 originally; the fix is
  // to inline the layout in each branch below.

  const canRefresh = (view==="browse" && !!frameUrl) || (view==="results" && !!results?.q);
  const navProps={bar,setBar,onGo:()=>go(),onBack:back,onFwd:fwd,onRefresh:refresh,canBack:hIdx>0,canFwd:hIdx<hist.length-1,canRefresh,AC};

  const bookmarks=(
    <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap",flexShrink:0}}>
      {BOOKMARKS.map(b=>
        <button key={b.url} className="bp" onClick={()=>browse(b.url)} style={{padding:"4px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.6)"}}>{b.label}</button>
      )}
      <button className="bp" onClick={()=>window.open("https://www.bing.com","_blank","noopener,noreferrer")} style={{padding:"4px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.6)"}}>Bing ↗</button>
      <button className="bp" onClick={()=>window.open("https://www.google.com","_blank","noopener,noreferrer")} style={{padding:"4px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.6)"}}>Google ↗</button>
    </div>
  );

  if(view==="home"){
    return(
      <div style={{width:"100%",height:"100%",fontFamily:FF,display:"flex",flexDirection:"column",minHeight:0}}>
        <BrowserNav {...navProps}/>
        {bookmarks}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))",minHeight:0,padding:"30px 20px"}}>
          <div style={{fontSize:48,filter:"drop-shadow(0 0 18px rgba(79,158,255,0.35))"}}>🌐</div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"rgba(255,255,255,0.85)",letterSpacing:0.3}}>Nova Browser</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",lineHeight:1.75,maxWidth:420}}>
            Search with Nova Search (DDG + Wikipedia) or paste any URL.<br/>
            <span style={{color:"rgba(255,255,255,0.3)"}}>YouTube watch links auto-convert to embed mode so videos play in-app.</span>
          </div>
        </div>
      </div>
    );
  }

  if(view==="browse"){
    // X-Frame-Options / CSP can't be detected from JS for cross-origin iframes,
    // so we use a curated host list to predict failures and short-circuit to a
    // friendly card with an Open-in-new-tab button.
    const blocked=isLikelyUnframable(frameUrl);
    return(
      <div style={{width:"100%",height:"100%",fontFamily:FF,display:"flex",flexDirection:"column",minHeight:0}}>
        <BrowserNav {...navProps}/>
        {bookmarks}
        {blocked ? (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"30px 20px",textAlign:"center",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))",minHeight:0}}>
            <div style={{fontSize:48,opacity:0.55}}>🚫</div>
            <div style={{fontFamily:FFB,fontWeight:700,fontSize:18,color:"rgba(255,255,255,0.8)"}}>This site can't be embedded</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",maxWidth:440,lineHeight:1.7}}>
              <span style={{color:"rgba(255,255,255,0.75)",fontFamily:FFM,fontSize:11,wordBreak:"break-all"}}>{frameUrl}</span><br/>
              blocks framing via X-Frame-Options or CSP — a security feature enforced by your browser, not a Nova OS limitation.
            </div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setView("home")} style={{padding:"8px 16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.7)"}}>← Back</button>
              <button onClick={()=>window.open(frameUrl,"_blank","noopener,noreferrer")} style={{padding:"8px 16px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>Open in new tab ↗</button>
            </div>
          </div>
        ) : (
          <div style={{flex:1,minHeight:0,position:"relative",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,overflow:"hidden",background:"#fff"}}>
            {/* Thin progress bar at top of iframe while loading */}
            {framing && (
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"rgba(255,255,255,0.1)",zIndex:2}}>
                <div style={{height:"100%",width:"40%",background:AC,animation:"pulse 1.2s ease-in-out infinite"}}/>
              </div>
            )}
            <iframe
              key={frameUrl+":"+reloadKey}
              src={frameUrl}
              title="browser"
              onLoad={()=>setFraming(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              style={{width:"100%",height:"100%",border:"none",background:"#fff",display:"block"}}/>
          </div>
        )}
      </div>
    );
  }

  const ddg=results?.ddg;const wiki=results?.wiki;const ddgT=(ddg?.RelatedTopics||[]).filter(t=>t.FirstURL&&t.Text).slice(0,7);const wikiH=wiki?.query?.search||[];
  return(
    <div style={{width:"100%",height:"100%",fontFamily:FF,display:"flex",flexDirection:"column",minHeight:0}}>
      <BrowserNav {...navProps}/>
      {bookmarks}
      {loading?(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:12,flexDirection:"column",minHeight:0}}>
          <div style={{width:28,height:28,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Searching…</div>
        </div>
      ):(
        <div style={{flex:1,overflowY:"auto",minHeight:0}}>
          <div style={{...SEC,marginBottom:10}}>Results for "{results?.q}"</div>
          {ddg?.AbstractText&&<div style={{padding:"13px 14px",marginBottom:10,background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:AC,marginBottom:5}}>{ddg.Heading}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.65}}>{ddg.AbstractText}</div>{ddg.AbstractURL&&<a href={ddg.AbstractURL} target="_blank" rel="noreferrer" style={{fontSize:10,color:AC,opacity:0.7,marginTop:6,display:"inline-block",fontFamily:FFM}}>Source ↗</a>}</div>}
          {wikiH.length>0&&<><div style={SEC}>Wikipedia</div>{wikiH.map(h=><div key={h.pageid} className="sr" onClick={()=>browse("https://en.wikipedia.org/wiki/"+encodeURIComponent(h.title))} style={{padding:"10px 12px",marginBottom:5,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer"}}><div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:3}}>{h.title}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.55}}>{h.snippet?h.snippet.replace(/<[^>]*>/g,"")+"…":""}</div></div>)}</>}
          {ddgT.length>0&&<><div style={{...SEC,marginTop:10}}>Related</div>{ddgT.map((t,i)=><div key={i} className="sr" onClick={()=>browse(t.FirstURL)} style={{padding:"9px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,cursor:"pointer"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.55}}>{t.Text}</div><div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.2)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.FirstURL}</div></div>)}</>}
          {!ddg?.AbstractText&&wikiH.length===0&&ddgT.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic"}}>No results found.</div>}
        </div>
      )}
    </div>
  );
}
 
function SnakeApp({AC}){
  const GRID=20,CELL=18,W=GRID*CELL,H=GRID*CELL;const canvasRef=useRef(null);const [phase,setPhase]=useState("idle");const [score,setScore]=useState(0);const [best,setBest]=useState(0);
  const st=useRef({snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],dir:{x:1,y:0},nextDir:{x:1,y:0},food:{x:15,y:8},score:0});const intv=useRef(null);
  function randFood(s){let p;do{p={x:Math.floor(Math.random()*GRID),y:Math.floor(Math.random()*GRID)};}while(s.some(x=>x.x===p.x&&x.y===p.y));return p;}
  function draw(){const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");ctx.fillStyle="#0a0a14";ctx.fillRect(0,0,W,H);ctx.strokeStyle="rgba(255,255,255,0.03)";for(let i=0;i<GRID;i++){ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(W,i*CELL);ctx.stroke();}const f=st.current.food;ctx.fillStyle="#ff4444";ctx.beginPath();ctx.arc(f.x*CELL+CELL/2,f.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2);ctx.fill();st.current.snake.forEach((seg,i)=>{ctx.fillStyle=i===0?AC:"rgba("+hexRgb(AC)+","+(Math.max(0.3,0.9-i*0.015))+")";ctx.beginPath();if(ctx.roundRect)ctx.roundRect(seg.x*CELL+1,seg.y*CELL+1,CELL-2,CELL-2,3);else ctx.rect(seg.x*CELL+1,seg.y*CELL+1,CELL-2,CELL-2);ctx.fill();});}
  function tick(){const s=st.current;s.dir=s.nextDir;const head={x:s.snake[0].x+s.dir.x,y:s.snake[0].y+s.dir.y};if(head.x<0||head.x>=GRID||head.y<0||head.y>=GRID||s.snake.some(seg=>seg.x===head.x&&seg.y===head.y)){clearInterval(intv.current);setBest(b=>Math.max(b,s.score));setPhase("over");return;}s.snake.unshift(head);if(head.x===s.food.x&&head.y===s.food.y){s.score++;setScore(s.score);s.food=randFood(s.snake);}else s.snake.pop();draw();}
  function start(){st.current={snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],dir:{x:1,y:0},nextDir:{x:1,y:0},food:randFood([]),score:0};setScore(0);setPhase("playing");clearInterval(intv.current);intv.current=setInterval(tick,130);draw();}
  useEffect(()=>{if(phase!=="playing")return;const DM={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},W:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},S:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},A:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0},D:{x:1,y:0}};function onKey(e){const d=DM[e.key];if(!d)return;e.preventDefault();const s=st.current;if(d.x===-s.dir.x&&d.y===-s.dir.y)return;s.nextDir=d;}window.addEventListener("keydown",onKey);return()=>{window.removeEventListener("keydown",onKey);clearInterval(intv.current);};},[phase]);
  useEffect(()=>{draw();},[]);
  return(<div style={{width:"100%",fontFamily:FF,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}><div style={{display:"flex",gap:24,width:"100%",maxWidth:W}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:14,color:AC}}>🐍 SNAKE</div><div style={{flex:1}}/><div style={{fontFamily:FFM,fontSize:12,color:"rgba(255,255,255,0.6)"}}>Score: {score}</div><div style={{fontFamily:FFM,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Best: {best}</div></div><div style={{position:"relative",width:"100%",maxWidth:W}}><canvas ref={canvasRef} width={W} height={H} style={{width:"100%",height:"auto",display:"block",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)"}}/>{(phase==="idle"||phase==="over")&&(<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,background:"rgba(7,8,15,0.75)",borderRadius:8}}>{phase==="over"&&<><div style={{fontFamily:FFB,fontSize:20,color:"#ff4444",fontWeight:700}}>Game Over</div><div style={{fontFamily:FFM,fontSize:14,color:"rgba(255,255,255,0.6)"}}>Score: {score}</div></>}<button onClick={start} style={{padding:"11px 32px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:15,color:AC}}>{phase==="over"?"Play Again":"Start Game"}</button>{phase==="idle"&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:FF}}>Arrow keys or WASD to move</div>}</div>)}</div></div>);
}
 
function Game2048App({AC}){
  const TC={0:"rgba(255,255,255,0.05)",2:"#eee4da",4:"#ede0c8",8:"#f2b179",16:"#f59563",32:"#f67c5f",64:"#f65e3b",128:"#edcf72",256:"#edcc61",512:"#edc850",1024:"#edc53f",2048:"#edc22e"};
  const TT={0:"rgba(255,255,255,0.1)",2:"#776e65",4:"#776e65",8:"#f9f6f2",16:"#f9f6f2",32:"#f9f6f2",64:"#f9f6f2",128:"#f9f6f2",256:"#f9f6f2",512:"#f9f6f2",1024:"#f9f6f2",2048:"#f9f6f2"};
  function newGrid(){const g=Array.from({length:4},()=>Array(4).fill(0));addTile(g);addTile(g);return g;}
  function addTile(g){const e=[];g.forEach((r,ri)=>r.forEach((v,ci)=>{if(!v)e.push([ri,ci]);}));if(!e.length)return;const[r,c]=e[Math.floor(Math.random()*e.length)];g[r][c]=Math.random()<0.9?2:4;}
  function slide(row){const nz=row.filter(x=>x);const out=[];let gained=0,i=0;while(i<nz.length){if(i+1<nz.length&&nz[i]===nz[i+1]){out.push(nz[i]*2);gained+=nz[i]*2;i+=2;}else{out.push(nz[i]);i++;}}while(out.length<4)out.push(0);return{row:out,gained};}
  function tr(g){return g[0].map((_,c)=>g.map(r=>r[c]));}
  function moveGrid(g,dir){let ng=g.map(r=>[...r]),gained=0;const rv=r=>[...r].reverse();if(dir==="left")ng=ng.map(r=>{const{row,gained:g2}=slide(r);gained+=g2;return row;});if(dir==="right")ng=ng.map(r=>{const{row,gained:g2}=slide(rv(r));gained+=g2;return rv(row);});if(dir==="up"){ng=tr(ng);ng=ng.map(r=>{const{row,gained:g2}=slide(r);gained+=g2;return row;});ng=tr(ng);}if(dir==="down"){ng=tr(ng);ng=ng.map(r=>{const{row,gained:g2}=slide(rv(r));gained+=g2;return rv(row);});ng=tr(ng);}return{grid:ng,gained};}
  function changed(a,b){return a.some((r,ri)=>r.some((v,ci)=>v!==b[ri][ci]));}
  function hasMove(g){if(g.some(r=>r.some(v=>!v)))return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){if(c<3&&g[r][c]===g[r][c+1])return true;if(r<3&&g[r][c]===g[r+1][c])return true;}return false;}
  const [grid,setGrid]=useState(()=>newGrid());const [score,setScore]=useState(0);const [best,setBest]=useState(0);const [over,setOver]=useState(false);const [won,setWon]=useState(false);
  function move(dir){setGrid(g=>{const{grid:ng,gained}=moveGrid(g,dir);if(!changed(g,ng))return g;const ng2=ng.map(r=>[...r]);addTile(ng2);setScore(s=>{const ns=s+gained;setBest(b=>Math.max(b,ns));return ns;});if(ng2.some(r=>r.some(v=>v===2048)))setWon(true);if(!hasMove(ng2))setOver(true);return ng2;});}
  useEffect(()=>{const MAP={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down",A:"left",D:"right",W:"up",S:"down"};function onKey(e){if(MAP[e.key]){e.preventDefault();if(!over)move(MAP[e.key]);}}window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[over]);
  function restart(){setGrid(newGrid());setScore(0);setOver(false);setWon(false);}
  return(<div style={{width:"100%",fontFamily:FF,display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:AC}}>2048</div><div style={{flex:1}}/>{[["SCORE",score],["BEST",best]].map(([l,v])=>(<div key={l} style={{padding:"5px 12px",background:"rgba(255,255,255,0.08)",borderRadius:6,textAlign:"center"}}><div style={{fontFamily:FFM,fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>{l}</div><div style={{fontFamily:FFB,fontWeight:700,fontSize:15,color:"#fff"}}>{v}</div></div>))}<button onClick={restart} style={{padding:"6px 13px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>New</button></div><div style={{position:"relative"}}><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1.5%",background:"rgba(255,255,255,0.08)",padding:"1.5%",borderRadius:10}}>{grid.flat().map((v,i)=>(<div key={i} style={{aspectRatio:"1",borderRadius:"8%",background:TC[v]||"#3c3a32",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FFB,fontWeight:700,fontSize:"clamp(14px,4vw,28px)",color:TT[v]||"#f9f6f2",transition:"background 0.1s"}}>{v>0?v:""}</div>))}</div>{(over||won)&&(<div style={{position:"absolute",inset:0,background:"rgba(7,8,15,0.78)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}><div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:won?"#edcf72":"#ff7878"}}>{won?"You Win! 🎉":"Game Over"}</div><button onClick={restart} style={{padding:"10px 28px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:14,color:AC}}>Try Again</button></div>)}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.28)",fontFamily:FF,textAlign:"center"}}>Arrow keys or WASD · Combine to reach 2048</div></div>);
}
 
// Stars and AppCard are at module scope (not nested inside StoreApp) so React
// keeps the same component identity across renders. When they were nested, the
// parent's clock-tick re-render every second created fresh function refs, which
// React treated as different component types and remounted the whole card —
// remounting the <img> inside StoreIcon, which flickered.
function Stars({appId, ratings, rateApp, ac}){
  const r=ratings[appId]||{avg:0,count:0,mine:0};
  const display=r.mine>0?r.mine:r.avg;
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
      {[1,2,3,4,5].map(s=>(
        <span key={s} onClick={e=>{e.stopPropagation();rateApp(appId,s);}}
          style={{cursor:"pointer",fontSize:15,color:s<=Math.round(display)?"#ffcc44":"rgba(255,255,255,0.18)",transition:"color 0.1s,transform 0.1s",lineHeight:1}}
          onMouseEnter={e=>e.target.style.transform="scale(1.25)"}
          onMouseLeave={e=>e.target.style.transform="scale(1)"}>
          ★
        </span>
      ))}
      {r.count>0&&<span style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.35)"}}>{r.avg.toFixed(1)} ({r.count})</span>}
      {r.count===0&&<span style={{fontSize:10,fontFamily:FF,color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>Rate this</span>}
      {r.mine>0&&<span style={{fontSize:9,fontFamily:FF,color:ac,opacity:0.8}}>your: {r.mine}★</span>}
    </div>
  );
}

function AppCard({app, isIn, ac, ratings, rateApp, toggleInstall, currentUser, onDeleteApp}){
  // Only the user who submitted a community app can remove it from the store.
  // Official (catalog) apps have no `submitter`, so this is always false for them.
  // Defensive checks: submitter must be a non-empty string that matches the
  // current logged-in user exactly. The final authority is the re-fetch in
  // deleteApp — this just hides the button when it shouldn't be clickable.
  const canDeleteFromStore =
    typeof app.submitter === "string" && app.submitter.length > 0 &&
    typeof currentUser === "string" && currentUser.length > 0 &&
    app.submitter === currentUser;
  return(
    <div className="sc" style={{padding:"14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,display:"flex",flexDirection:"column",gap:0,transition:"background 0.12s"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:8}}>
        <div style={{width:44,height:44,borderRadius:10,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",fontSize:app.domain?undefined:22}}>
          {app.domain?<StoreIcon domain={app.domain} fallback={app.icon} size={32}/>:app.icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.92)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{app.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2,flexWrap:"wrap"}}>
            <span style={{fontSize:9,fontFamily:FFM,padding:"1px 6px",background:app.newTab?"rgba(255,180,0,0.12)":"rgba(79,200,100,0.12)",border:"1px solid "+(app.newTab?"rgba(255,180,0,0.3)":"rgba(79,200,100,0.3)"),borderRadius:4,color:app.newTab?"rgba(255,200,80,0.9)":"rgba(100,220,120,0.9)"}}>{app.badge||"↗ New Tab"}</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.28)"}}>{app.cat}</span>
            {app.submitter&&<span style={{fontSize:9,color:"rgba(255,255,255,0.22)",fontFamily:FFM}}>by @{app.submitter}</span>}
          </div>
          <Stars appId={app.id} ratings={ratings} rateApp={rateApp} ac={ac}/>
        </div>
        {canDeleteFromStore && (
          <button
            className="dl"
            onClick={()=>onDeleteApp(app)}
            title="Remove your submission from the store"
            style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.35)",fontSize:13,padding:"3px 6px",transition:"color 0.12s",flexShrink:0}}>🗑</button>
        )}
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.48)",lineHeight:1.5,marginBottom:10,flex:1}}>{app.desc}</div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>toggleInstall(app.id)} style={{flex:1,padding:"6px",background:isIn?"rgba(255,80,80,0.1)":"rgba(255,255,255,0.06)",border:"1px solid "+(isIn?"rgba(255,80,80,0.3)":"rgba(255,255,255,0.12)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:isIn?"rgba(255,130,130,0.9)":"rgba(255,255,255,0.6)"}}>{isIn?"– Remove":"+ Desktop"}</button>
        <button onClick={()=>window.open(app.url,"_blank")} style={{flex:1,padding:"6px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:ac}}>Launch ↗</button>
      </div>
    </div>
  );
}

function StoreApp({user,data,updateData,showToast,AC}){
  const ac=AC||DEFAULT_AC;
  const [tab,setTab]=useState("official");
  const [cat,setCat]=useState("All");
  const [search,setSearch]=useState("");
  const [ratings,setRatings]=useState({});
  const [commApps,setCommApps]=useState([]);
  const [loadingComm,setLoadingComm]=useState(true);
  const [sName,setSName]=useState(""); const [sUrl,setSUrl]=useState("");
  const [sDesc,setSDesc]=useState(""); const [sCat,setSCat]=useState("Tools");
  const [sIcon,setSIcon]=useState("🚀"); const [submitting,setSubmitting]=useState(false);
  const installed=data?.installedApps||[];
 
  // Real-time ratings from Firestore
  useEffect(()=>{
    const unsub=onSnapshot(collection(firestoreDb,"nova_ratings"),snap=>{
      const agg={};
      snap.docs.forEach(d=>{
        const r=d.data();
        if(!agg[r.appId])agg[r.appId]={total:0,count:0,mine:0};
        agg[r.appId].total+=r.rating; agg[r.appId].count++;
        if(r.user===user)agg[r.appId].mine=r.rating;
      });
      const out={};
      Object.entries(agg).forEach(([id,v])=>{out[id]={avg:v.total/v.count,count:v.count,mine:v.mine};});
      setRatings(out);
    },()=>{});
    return()=>unsub();
  },[user]);
 
  // Real-time community apps
  useEffect(()=>{
    const q=query(collection(firestoreDb,"nova_user_apps"),orderBy("ts","desc"),limit(60));
    const unsub=onSnapshot(q,snap=>{setCommApps(snap.docs.map(d=>({id:d.id,...d.data()})));setLoadingComm(false);},()=>setLoadingComm(false));
    return()=>unsub();
  },[]);
 
  async function rateApp(appId,rating){
    try{await setDoc(doc(firestoreDb,"nova_ratings",appId+"_"+user),{appId,user,rating,ts:Date.now()});showToast("Rated "+rating+"★ ✓");}
    catch{showToast("Rating failed");}
  }
  async function submitApp(){
    const name=sName.trim(), desc=sDesc.trim();
    let url=sUrl.trim();
    if(!name||!url||!desc){showToast("All fields required");return;}
    if(!url.startsWith("http"))url="https://"+url;
    setSubmitting(true);
    // Run auto-filter. Flags don't block — they just decorate the queue entry
    // so admins can prioritize what to look at first.
    const autoFlags=autoModerate({name,desc,url});
    try{
      await addDoc(collection(firestoreDb,"nova_user_apps"),{
        name,url,desc,cat:sCat,icon:sIcon,submitter:user,ts:Date.now(),
        newTab:true,badge:"↗ New Tab",
        status:"pending",autoFlags,reviewedBy:null,reviewedAt:null,rejectReason:null,
      });
      showToast(autoFlags.length>0
        ? "Submitted — flagged for review ⚠"
        : "Submitted — pending admin review ✓");
      setSName("");setSUrl("");setSDesc("");setSIcon("🚀");setTab("community");
    }catch{showToast("Submission failed");}
    setSubmitting(false);
  }

  async function approveApp(app){
    if(!isAdmin(user))return;
    try{
      await updateDoc(doc(firestoreDb,"nova_user_apps",app.id),{
        status:"approved",reviewedBy:user,reviewedAt:Date.now(),
      });
      showToast("Approved \""+app.name+"\" ✓");
    }catch{showToast("Approve failed");}
  }

  async function rejectApp(app){
    if(!isAdmin(user))return;
    const reason=window.prompt("Reject \""+app.name+"\" — optional reason (visible to submitter):","");
    if(reason===null)return; // user cancelled
    try{
      await updateDoc(doc(firestoreDb,"nova_user_apps",app.id),{
        status:"rejected",rejectReason:reason||null,reviewedBy:user,reviewedAt:Date.now(),
      });
      showToast("Rejected \""+app.name+"\"");
    }catch{showToast("Reject failed");}
  }
  function toggleInstall(appId){
    const isIn=installed.includes(appId);
    updateData(p=>({...p,installedApps:isIn?p.installedApps.filter(id=>id!==appId):[...(p.installedApps||[]),appId]}));
    showToast(isIn?"App removed":"Added to desktop ✓");
  }

  async function deleteApp(app){
    // Defense in depth: re-fetch the document so we check the AUTHORITATIVE
    // submitter from Firestore, not the prop (which could be stale or wrong).
    // The prop-level guard above the UI is the first gate; this is the second.
    if(!app?.id){showToast("Missing app id");return;}
    let fresh;
    try{
      const snap=await getDoc(doc(firestoreDb,"nova_user_apps",app.id));
      if(!snap.exists()){showToast("App already removed");return;}
      fresh=snap.data();
    }catch{showToast("Couldn't verify owner — try again");return;}
    if(!fresh.submitter||fresh.submitter!==user){
      showToast("Only @"+(fresh.submitter||"the submitter")+" can delete this app");
      return;
    }
    if(!window.confirm("Remove \""+(fresh.name||app.name)+"\" from the store? This can't be undone."))return;
    try{
      await deleteDoc(doc(firestoreDb,"nova_user_apps",app.id));
      showToast("App removed from store ✓");
    }catch{showToast("Delete failed");}
  }
 
  // Stars hoisted to module scope (above StoreApp).
 
  // AppCard hoisted to module scope (above StoreApp).
 
  const filtered=STORE_CATALOG.filter(a=>{
    if(cat!=="All"&&a.cat!==cat)return false;
    if(search&&!a.name.toLowerCase().includes(search.toLowerCase())&&!a.desc.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });
  const matchesSearch=a=>!search||a.name.toLowerCase().includes(search.toLowerCase())||a.desc.toLowerCase().includes(search.toLowerCase());
  // Community feed: only show approved (or legacy unstamped) apps. Pending/rejected are hidden from non-admins.
  const filtComm=commApps.filter(a=>isPubliclyVisible(a)&&matchesSearch(a));
  // Moderation queue: every app awaiting review. Only admins see this list.
  const modQueue=commApps.filter(a=>a.status==="pending");
  // The current user's own submissions, regardless of status, so they can track what they've sent in.
  const mySubmissions=commApps.filter(a=>a.submitter===user&&a.status&&a.status!=="approved");
  const userIsAdmin=isAdmin(user);
 
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      {/* Header + search */}
      <div style={{marginBottom:12}}>
        <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"#fff",marginBottom:8}}>🏪 Nova Store 5.3</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search all apps…" style={INP}/>
      </div>
 
      {/* Tab bar */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:14}}>
        {[
          ["official","🏆 Official"],
          ["community","🌍 Community"+(filtComm.length>0?" ("+filtComm.length+")":"")],
          ["submit","+ Submit App"],
          ...(userIsAdmin?[["moderation","🛡 Moderation"+(modQueue.length>0?" ("+modQueue.length+")":"")]]:[]),
        ].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 14px",background:"none",border:"none",borderBottom:tab===id?"2px solid "+ac:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:tab===id?ac:"rgba(255,255,255,0.38)",transition:"all 0.15s",whiteSpace:"nowrap"}}>{lbl}</button>
        ))}
      </div>
 
      {/* Official tab */}
      {tab==="official"&&(<>
        <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
          {STORE_CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"4px 11px",background:cat===c?fill(ac):"rgba(255,255,255,0.06)",border:"1px solid "+(cat===c?bdr(ac):"rgba(255,255,255,0.1)"),borderRadius:20,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:cat===c?ac:"rgba(255,255,255,0.5)",transition:"all 0.12s"}}>{c}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:9}}>
          {filtered.map(app=><AppCard key={app.id} app={app} isIn={installed.includes(app.id)} ac={ac} ratings={ratings} rateApp={rateApp} toggleInstall={toggleInstall} currentUser={user} onDeleteApp={deleteApp}/>)}
          {filtered.length===0&&<div style={{gridColumn:"span 2",color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>No apps match.</div>}
        </div>
        {installed.length>0&&<div style={{marginTop:14,padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.35)"}}>{installed.length} app{installed.length!==1?"s":""} on desktop</div>}
      </>)}
 
      {/* Community tab */}
      {tab==="community"&&(<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Apps submitted by Nova users · click ★ to rate</span>
          <button onClick={()=>setTab("submit")} style={{padding:"5px 12px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:ac}}>+ Submit</button>
        </div>
        {/* Your submissions in moderation — only renders if you have any */}
        {mySubmissions.length>0&&(
          <div style={{marginBottom:14,padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8}}>
            <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:6,letterSpacing:0.5}}>YOUR SUBMISSIONS</div>
            {mySubmissions.map(a=>{
              const isPending=a.status==="pending";
              const badgeColor=isPending?"#ffcc44":"#ff7878";
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.7)"}}>
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                  <span style={{fontFamily:FFM,fontSize:10,padding:"1px 6px",borderRadius:4,background:"rgba("+hexRgb(badgeColor)+",0.15)",border:"1px solid "+badgeColor,color:badgeColor}}>{isPending?"Pending review":"Rejected"}</span>
                  {!isPending&&a.rejectReason&&<span style={{fontSize:11,fontStyle:"italic",color:"rgba(255,255,255,0.4)",marginLeft:6}}>"{a.rejectReason}"</span>}
                </div>
              );
            })}
          </div>
        )}
        {loadingComm&&<div style={{textAlign:"center",padding:"36px 0"}}><div style={{width:24,height:24,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:ac,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/></div>}
        {!loadingComm&&filtComm.length===0&&<div style={{color:"rgba(255,255,255,0.18)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>No community apps yet — be the first! 🚀</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:9}}>
          {filtComm.map(app=><AppCard key={app.id} app={app} isIn={installed.includes(app.id)} ac={ac} ratings={ratings} rateApp={rateApp} toggleInstall={toggleInstall} currentUser={user} onDeleteApp={deleteApp}/>)}
        </div>
      </>)}

      {/* Moderation tab — admins only */}
      {tab==="moderation"&&userIsAdmin&&(<>
        <div style={{marginBottom:12}}>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:14,color:"#fff"}}>🛡 Moderation Queue</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{modQueue.length} app{modQueue.length===1?"":"s"} awaiting review · red flags from auto-filter need extra attention</div>
        </div>
        {modQueue.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>Queue is empty — nothing to review 🎉</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {modQueue.map(app=>(
            <div key={app.id} style={{padding:"12px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{fontSize:24,flexShrink:0,lineHeight:1}}>{app.icon||"📦"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff"}}>{app.name}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>by @{app.submitter||"unknown"} · {app.cat||"Uncategorized"}</div>
                  <a href={app.url} target="_blank" rel="noreferrer" style={{fontSize:11,fontFamily:FFM,color:ac,textDecoration:"none",marginTop:3,display:"inline-block",wordBreak:"break-all"}}>{app.url}</a>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,lineHeight:1.5}}>{app.desc}</div>
                  {app.autoFlags&&app.autoFlags.length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                      {app.autoFlags.map((f,i)=>(
                        <span key={i} style={{fontSize:10,fontFamily:FFM,padding:"2px 7px",borderRadius:4,background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.4)",color:"#ff9898"}}>⚠ {f}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:"flex",gap:7,marginTop:11,justifyContent:"flex-end"}}>
                <button onClick={()=>rejectApp(app)} style={{padding:"6px 14px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,130,130,0.95)"}}>✕ Reject</button>
                <button onClick={()=>approveApp(app)} style={{padding:"6px 14px",background:"rgba(76,239,144,0.1)",border:"1px solid rgba(76,239,144,0.4)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"#4cef90"}}>✓ Approve</button>
              </div>
            </div>
          ))}
        </div>
      </>)}
 
      {/* Submit tab */}
      {tab==="submit"&&(
        <div style={{maxWidth:460}}>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>Submit Your App</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:18}}>Share any web app or website with the Nova community. It appears instantly in the Community tab.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:9}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{...SEC,marginBottom:0}}>Icon</label>
                <input value={sIcon} onChange={e=>setSIcon(e.target.value)} maxLength={2} style={{...INP,width:54,textAlign:"center",fontSize:22,padding:"6px 4px"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,flex:1}}>
                <label style={{...SEC,marginBottom:0}}>App Name</label>
                <input value={sName} onChange={e=>setSName(e.target.value)} placeholder="My Cool App" style={INP} maxLength={50}/>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{...SEC,marginBottom:0}}>URL</label>
              <input value={sUrl} onChange={e=>setSUrl(e.target.value)} placeholder="https://myapp.com" style={INP}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{...SEC,marginBottom:0}}>Description</label>
              <textarea value={sDesc} onChange={e=>setSDesc(e.target.value)} placeholder="What does your app do?" style={{...INP,minHeight:66}} maxLength={200}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{...SEC,marginBottom:0}}>Category</label>
              <select value={sCat} onChange={e=>setSCat(e.target.value)} style={{...INP,cursor:"pointer"}}>
                {["Games","Media","Tools","Social","News","Other"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={submitApp} disabled={submitting||!sName.trim()||!sUrl.trim()||!sDesc.trim()}
              style={{padding:"11px",background:fill(ac),border:"1px solid "+bdr(ac),borderRadius:8,cursor:submitting?"default":"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:ac,opacity:submitting||!sName.trim()||!sUrl.trim()||!sDesc.trim()?0.4:1}}>
              {submitting?"Submitting…":"Submit App →"}
            </button>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic"}}>Submissions are public and visible to all Nova OS users. Keep it appropriate.</div>
          </div>
        </div>
      )}

      {/* Clearbit attribution — required by their Logo API terms */}
      <div style={{marginTop:16,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:10,fontFamily:FF,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>
        App logos provided by <a href="https://clearbit.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>Clearbit</a>
      </div>
    </div>
  );
}
 
function TerminalApp({user,AC}){
  const [lines,setLines]=useState([{t:"out",v:"NOVA Terminal v5.3.0"},{t:"out",v:"Session: "+user+" — "+new Date().toLocaleString()},{t:"out",v:'Type "help" for commands.'},{t:"gap"}]);
  const [cmd,setCmd]=useState("");const [hist,setHist]=useState([]);const [hIdx,setHIdx]=useState(-1);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[lines]);
  const CMDS={help:()=>["Commands: help, whoami, date, echo <text>, version, sysinfo, ls, neofetch, clear"],whoami:()=>[user],date:()=>[new Date().toLocaleString()],version:()=>["NOVA OS v5.3.0 — Nova Systems Inc."],sysinfo:()=>["CPU: Nova Virtual Core™","RAM: 8.0 GB","Storage: Firebase Firestore","Resolution: "+window.innerWidth+"x"+window.innerHeight,"Uptime: "+Math.floor(performance.now()/1000)+"s"],ls:()=>["notes/ tasks/ files/ paint/ browser/ snake/ 2048/ store/ terminal/ settings/"],neofetch:()=>[" ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ "," ████╗  ██║██╔═══██╗██║   ██║██╔══██╗"," ██╔██╗ ██║██║   ██║██║   ██║███████║"," ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║"," ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║","OS: Nova v5.3  User: "+user,"Widgets: Clock·Weather·Notes·Tasks·Calendar·SysInfo"],echo:args=>[args.join(" ")||"(empty)"],clear:()=>"__clear__"};
  function run(){const raw=cmd.trim();if(!raw)return;const parts=raw.split(" ");const c=parts[0].toLowerCase();const args=parts.slice(1);setHist(h=>[raw,...h]);setHIdx(-1);setCmd("");const nl=[...lines,{t:"in",v:raw}];const h=CMDS[c];if(!h){nl.push({t:"err",v:c+': not found. Try "help".'});}else{const r=h(args);if(r==="__clear__"){setLines([]);return;}r.forEach(v=>nl.push({t:"out",v}));}nl.push({t:"gap"});setLines(nl);}
  function onKey(e){if(e.key==="Enter"){run();return;}if(e.key==="ArrowUp"){const i=Math.min(hIdx+1,hist.length-1);setHIdx(i);if(hist[i])setCmd(hist[i]);}if(e.key==="ArrowDown"){const i=Math.max(hIdx-1,-1);setHIdx(i);setCmd(i===-1?"":(hist[i]||""));}}
  return(<div style={{width:"100%",fontFamily:FFM}}><div style={{background:"#030407",borderRadius:8,padding:"13px 15px",height:"100%",minHeight:280,overflowY:"auto",border:"1px solid rgba(255,255,255,0.07)"}}>{lines.map((l,i)=><div key={i} style={{color:l.t==="in"?AC:l.t==="err"?"#ff7878":"rgba(180,210,255,0.58)",fontSize:12,marginBottom:l.t==="gap"?5:2,minHeight:l.t==="gap"?4:undefined,whiteSpace:"pre"}}>{l.t==="in"?"$ "+l.v:l.t==="gap"?null:l.v}</div>)}<div style={{display:"flex",alignItems:"center"}}><span style={{color:"#4cef90",marginRight:7,fontSize:12}}>$</span><input value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={onKey} autoFocus style={{flex:1,background:"none",border:"none",outline:"none",color:AC,fontFamily:FFM,fontSize:12,caretColor:AC}}/></div><div ref={endRef}/></div></div>);
}
 
function SettingsApp({user,data,updateSettings,showToast,AC,onCustomWallpaper}){
  const settings=data?.settings||{};const fileRef=useRef(null);
  function handleUpload(e){const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){showToast("File too large (max 8MB)");return;}const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const canvas=document.createElement("canvas");const MAX=900;const ratio=Math.min(MAX/img.width,MAX/img.height,1);canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);onCustomWallpaper(canvas.toDataURL("image/jpeg",0.72));};img.src=ev.target.result;};reader.readAsDataURL(file);e.target.value="";}
  const wpId=settings.wallpaper||data?.wallpaper||"mesh";
  const widgets=settings.widgets||{};
  function setWidget(id,val){updateSettings({widgets:{...widgets,[id]:val}});}
  return(
    <div style={{width:"100%",fontFamily:FF}}>
      <div style={SEC}>Accent Color</div>
      <div style={{display:"flex",gap:7,marginBottom:6,flexWrap:"wrap"}}>{ACCENT_PRESETS.map(c=><div key={c} className="ad" onClick={()=>{updateSettings({accent:c});showToast("Accent updated ✓");}} style={{width:28,height:28,borderRadius:7,background:c,cursor:"pointer",border:AC===c?"2.5px solid #fff":"2.5px solid transparent",transition:"transform 0.12s,border 0.12s",boxSizing:"border-box"}}/>)}<input type="color" value={AC} onChange={e=>updateSettings({accent:e.target.value})} style={{width:28,height:28,borderRadius:7,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",background:"none"}} title="Custom color"/></div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",marginBottom:20,fontFamily:FFM}}>Current: {AC}</div>
      <div style={SEC}>Wallpaper</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>{Object.entries(WALLPAPERS).filter(([k])=>k!=="custom").map(([k,w])=>(<div key={k} className="ws" onClick={()=>{updateSettings({wallpaper:k});showToast("Wallpaper: "+w.name+" ✓");}} style={{height:52,borderRadius:8,background:w.preview,cursor:"pointer",border:wpId===k?"2.5px solid #fff":"2px solid transparent",transition:"border 0.14s",boxSizing:"border-box",display:"flex",alignItems:"flex-end",padding:"5px 7px"}}><span style={{fontSize:9,fontFamily:FFB,fontWeight:600,color:"rgba(255,255,255,0.85)",textShadow:"0 1px 4px rgba(0,0,0,0.9)"}}>{w.name}</span></div>))}</div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{display:"none"}}/>
      <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:"10px",background:wpId==="custom"?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(wpId==="custom"?bdr(AC):"rgba(255,255,255,0.12)"),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:wpId==="custom"?AC:"rgba(255,255,255,0.6)",marginBottom:22}}>{wpId==="custom"?"✓ Custom Wallpaper Active — Click to Change":"📁 Upload Custom Wallpaper"}</button>
      <div style={SEC}>Desktop Widgets</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:10}}>Drag header to move · Drag edges/corners to resize · Snaps to 20px grid on release.</div>
      {Object.entries(WIDGET_CONFIGS).map(([id,cfg])=>(
        <Toggle key={id} label={cfg.emoji+"  "+cfg.label} value={!!widgets[id]} onChange={v=>setWidget(id,v)} ac={AC}/>
      ))}
      {widgets.weather&&<div style={{fontSize:11,color:"rgba(255,200,80,0.7)",fontFamily:FF,padding:"7px 10px",background:"rgba(255,200,0,0.06)",border:"1px solid rgba(255,200,0,0.15)",borderRadius:6,marginBottom:6,marginTop:2}}>⚠ Weather needs location access — allow it in your browser when prompted.</div>}
      <div style={{...SEC,marginTop:20}}>Window Blur</div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><input type="range" min={0} max={30} value={settings.winBlur??18} onChange={e=>updateSettings({winBlur:+e.target.value})} style={{flex:1,accentColor:AC}}/><span style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.4)",width:32}}>{settings.winBlur??18}px</span></div>
      <div style={SEC}>Display</div>
      <Toggle label="24-Hour Clock" value={!!settings.clock24h}  onChange={v=>updateSettings({clock24h:v})}  ac={AC}/>
      <Toggle label="Large Text"    value={!!settings.largeFont} onChange={v=>updateSettings({largeFont:v})} ac={AC}/>
      <div style={{...SEC,marginTop:22}}>Display Mode</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:9,lineHeight:1.55}}>How Nova OS sizes for your device. "Auto" picks based on screen size + touch capability — override here if you want a specific look.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:7,marginBottom:6}}>
        {[
          {id:"auto",   label:"⚙ Auto",     desc:"Detect from device"},
          {id:"desktop",label:"🖥 Desktop",  desc:"Mouse-precision UI"},
          {id:"tablet", label:"📱 Tablet",  desc:"Larger touch targets"},
          {id:"mobile", label:"📲 Mobile",  desc:"Phone-size notice"},
        ].map(m=>{
          const active=(settings.displayMode||"auto")===m.id;
          return(
            <button key={m.id} onClick={()=>{updateSettings({displayMode:m.id});showToast("Display: "+m.label+" ✓");}}
              style={{textAlign:"left",padding:"10px 12px",background:active?fill(AC):"rgba(255,255,255,0.04)",border:"1px solid "+(active?bdr(AC):"rgba(255,255,255,0.08)"),borderRadius:8,cursor:"pointer",fontFamily:FF,color:active?AC:"rgba(255,255,255,0.7)"}}>
              <div style={{fontFamily:FFB,fontWeight:600,fontSize:12}}>{m.label}</div>
              <div style={{fontSize:10,color:active?AC:"rgba(255,255,255,0.4)",marginTop:1,opacity:active?0.85:1}}>{m.desc}</div>
            </button>
          );
        })}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.22)",marginBottom:22,fontStyle:"italic"}}>Resize the browser window to test — Nova will re-detect on the fly.</div>
      <div style={{...SEC,marginTop:0}}>Account</div>
      <div style={{padding:"11px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8}}><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:2}}>Signed in as</div><div style={{fontFamily:FFB,fontWeight:600,fontSize:16,color:"#fff"}}>@{user}</div></div>
    </div>
  );
}
 
function ProfileApp({user,data,updateData,showToast,AC}){
  const [bio,setBio]=useState(data?.bio||"");
  const joined=data?.joined?new Date(data.joined).toLocaleDateString([],{year:"numeric",month:"long",day:"numeric"}):"Unknown";
  const installed=data?.installedApps?.length||0;
  return(<div style={{width:"100%",fontFamily:FF}}><div style={SEC}>Profile</div><div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:16,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,0.07)"}}><div style={{width:62,height:62,borderRadius:"50%",background:fill(AC),border:"2px solid "+AC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:11}}>👤</div><div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"#fff",marginBottom:2}}>@{user}</div><div style={{fontFamily:FFM,fontSize:10,color:"rgba(255,255,255,0.28)"}}>Member since {joined}</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>{[["📝",data?.notes?.length||0,"Notes"],["✅",(data?.tasks?.filter(t=>t.done).length||0)+"/"+(data?.tasks?.length||0),"Tasks"],["🏪",installed,"Installed"]].map(([ic,v,k])=>(<div key={k} style={{padding:"11px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,marginBottom:3}}>{ic}</div><div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:AC}}>{v}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.32)",marginTop:2}}>{k}</div></div>))}</div><div style={SEC}>Bio</div><textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Write something about yourself…" style={{...INP,minHeight:64,marginBottom:8}}/><button onClick={()=>{updateData({bio});showToast("Bio saved ✓");}} style={{width:"100%",padding:"9px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>Save Bio</button></div>);
}
 
// ─── GLOBAL CHAT ─────────────────────────────────────────────────────────────
// Messages stored in Firestore collection "nova_chat" — shared across ALL users
// Real-time via onSnapshot listener — updates instantly for everyone
function ChatApp({ user, AC }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [lastSent,  setLastSent]  = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
 
  // Subscribe to real-time messages
  useEffect(() => {
    const q = query(
      collection(firestoreDb, "nova_chat"),
      orderBy("ts", "asc"),
      limit(120)
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);
 
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
 
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    // Simple client-side rate limit: 1 message per 1.5 seconds
    const now = Date.now();
    if (now - lastSent < 1500) return;
    if (text.length > 500) return;
    setSending(true);
    setLastSent(now);
    setInput("");
    try {
      // Reset chat when the 120-message buffer is full. Wipes all existing
      // messages (visible to every user) before adding the new one. The
      // collection is shared, so any sender hitting the cap resets globally.
      if (messages.length >= 120) {
        await Promise.all(
          messages.map(m => deleteDoc(doc(firestoreDb, "nova_chat", m.id)))
        );
      }
      await addDoc(collection(firestoreDb, "nova_chat"), {
        user,
        text,
        ts: Date.now(),
      });
    } catch { /* silent */ }
    setSending(false);
    inputRef.current?.focus();
  }

  async function deleteMessage(id) {
    try {
      await deleteDoc(doc(firestoreDb, "nova_chat", id));
    } catch { /* silent — onSnapshot will refresh either way */ }
  }
 
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(ts) {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
 
  // Group messages by day for date separators
  const grouped = [];
  let lastDay = null;
  messages.forEach(msg => {
    const day = new Date(msg.ts).toDateString();
    if (day !== lastDay) { grouped.push({ type: "day", label: fmtDay(msg.ts), key: "day-"+msg.ts }); lastDay = day; }
    grouped.push({ type: "msg", ...msg });
  });
 
  // Unique color per user (deterministic from username)
  function userColor(name) {
    const colors = ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa","#f97316","#06b6d4"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  }
 
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: FF }}>
 
      {/* Header */}
      <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "#888" : "#4cef90", flexShrink: 0, boxShadow: loading ? "none" : "0 0 6px #4cef90" }} />
          <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "#fff" }}>Nova Global Chat</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
            {loading ? "Connecting…" : messages.length + " messages"}
          </span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>
          All Nova OS users see this chat in real time · be respectful
        </div>
      </div>
 
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, flexDirection: "column" }}>
            <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading chat…</span>
          </div>
        )}
 
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic", margin: "auto" }}>
            No messages yet — say hello! 👋
          </div>
        )}
 
        {grouped.map(item => {
          if (item.type === "day") {
            return (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 6px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                <span style={{ fontFamily: FFB, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 0.8 }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              </div>
            );
          }
 
          const isMe = item.user === user;
          const uc = userColor(item.user);
 
          return (
            <div key={item.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 6 }}>
              {/* Username label (not for own messages) */}
              {!isMe && (
                <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 10, color: uc, marginBottom: 3, marginLeft: 2 }}>
                  @{item.user}
                </span>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMe ? "row-reverse" : "row" }}>
                {/* Avatar dot */}
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba("+hexRgb(uc)+",0.2)", border: "1.5px solid "+uc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginBottom: 2 }}>
                  {(item.user||"?")[0].toUpperCase()}
                </div>
                {/* Bubble */}
                <div style={{
                  maxWidth: "70%",
                  padding: "8px 12px",
                  borderRadius: isMe ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                  background: isMe ? "rgba("+hexRgb(AC)+",0.18)" : "rgba(255,255,255,0.06)",
                  border: "1px solid " + (isMe ? "rgba("+hexRgb(AC)+",0.45)" : "rgba(255,255,255,0.1)"),
                  fontSize: 13,
                  color: "rgba(255,255,255,0.92)",
                  lineHeight: 1.55,
                  wordBreak: "break-word",
                  fontFamily: FF,
                }}>
                  {item.text}
                </div>
                {/* Delete button — only on your own messages */}
                {isMe && (
                  <button
                    className="dl"
                    onClick={() => deleteMessage(item.id)}
                    title="Delete message"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(255,80,80,0.35)", fontSize: 12, padding: "2px 5px",
                      transition: "color 0.12s", flexShrink: 0, marginBottom: 2,
                    }}>✕</button>
                )}
              </div>
              {/* Timestamp */}
              <span style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.2)", marginTop: 2, marginLeft: isMe ? 0 : 28, marginRight: isMe ? 28 : 0 }}>
                {fmtTime(item.ts)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
 
      {/* Input bar */}
      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={"Message as @" + user + "  (Enter to send, Shift+Enter for newline)"}
          rows={1}
          maxLength={500}
          style={{ ...INP, flex: 1, resize: "none", minHeight: 38, maxHeight: 100, lineHeight: 1.5, overflow: "auto", fontSize: 13 }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{ padding: "9px 16px", background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 8, cursor: sending || !input.trim() ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, color: AC, opacity: sending || !input.trim() ? 0.4 : 1, flexShrink: 0, height: 38 }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── 5.1 APPS ─────────────────────────────────────────────────────────────────

function CalculatorApp({AC}){
  // Display string holds the in-progress entry (or last result after =).
  // pending holds {prev, op} when we're waiting for the second operand.
  const [display,setDisplay]=useState("0");
  const [pending,setPending]=useState(null);
  const [justEvaluated,setJustEvaluated]=useState(false);

  function pressDigit(d){
    if(justEvaluated){setDisplay(d==="."?"0.":d);setJustEvaluated(false);return;}
    setDisplay(prev=>appendKey(prev,d));
  }
  function pressOp(op){
    const cur=parseFloat(display);
    if(pending&&!justEvaluated){
      const r=applyOp(pending.prev,pending.op,cur);
      setDisplay(formatDisplay(r));
      setPending({prev:r,op});
    } else {
      setPending({prev:cur,op});
    }
    setJustEvaluated(true); // next digit starts fresh entry
  }
  function pressEquals(){
    if(!pending)return;
    const cur=parseFloat(display);
    const r=applyOp(pending.prev,pending.op,cur);
    setDisplay(formatDisplay(r));
    setPending(null);
    setJustEvaluated(true);
  }
  function pressClear(){setDisplay("0");setPending(null);setJustEvaluated(false);}
  function pressSign(){setDisplay(s=>toggleSign(s));}
  function pressPercent(){const n=parseFloat(display);setDisplay(formatDisplay(n/100));setJustEvaluated(true);}
  function pressBackspace(){
    if(justEvaluated){pressClear();return;}
    setDisplay(s=>{
      if(s.length<=1||(s.length===2&&s.startsWith("-")))return "0";
      return s.slice(0,-1);
    });
  }

  // Layout: 5 rows × 4 cols. The "0" key spans two cols on the bottom row.
  const btn=(label,onClick,style={})=>(
    <button onClick={onClick} style={{
      height:54,borderRadius:14,
      background:"rgba(255,255,255,0.06)",
      border:"1px solid rgba(255,255,255,0.08)",
      cursor:"pointer",
      fontFamily:FFB,fontWeight:600,fontSize:18,
      color:"rgba(255,255,255,0.92)",
      transition:"background 0.15s",
      touchAction:"manipulation",
      ...style,
    }} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.11)"}
       onMouseOut={e=>e.currentTarget.style.background=style.background||"rgba(255,255,255,0.06)"}>{label}</button>
  );
  const acStyle={background:fill(AC),border:"1px solid "+bdr(AC),color:AC};
  const opStyle={background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.13)",color:"#fff"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,fontFamily:FF,height:"100%",minHeight:0}}>
      {/* Display */}
      <div style={{flexShrink:0,padding:"22px 14px 18px",background:"rgba(0,0,0,0.25)",borderRadius:14,border:"1px solid rgba(255,255,255,0.05)",textAlign:"right",minHeight:80,display:"flex",flexDirection:"column",justifyContent:"flex-end",overflow:"hidden"}}>
        {pending && <div style={{fontFamily:FFM,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>{formatDisplay(pending.prev)} {pending.op}</div>}
        <div style={{fontFamily:FFM,fontWeight:500,fontSize:display.length>10?28:36,color:"#fff",letterSpacing:1,lineHeight:1,wordBreak:"break-all"}}>{display}</div>
      </div>
      {/* Keypad */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,flex:1,minHeight:0}}>
        {btn("AC",pressClear,acStyle)}
        {btn("±",pressSign)}
        {btn("%",pressPercent)}
        {btn("÷",()=>pressOp("÷"),opStyle)}
        {btn("7",()=>pressDigit("7"))}
        {btn("8",()=>pressDigit("8"))}
        {btn("9",()=>pressDigit("9"))}
        {btn("×",()=>pressOp("×"),opStyle)}
        {btn("4",()=>pressDigit("4"))}
        {btn("5",()=>pressDigit("5"))}
        {btn("6",()=>pressDigit("6"))}
        {btn("−",()=>pressOp("-"),opStyle)}
        {btn("1",()=>pressDigit("1"))}
        {btn("2",()=>pressDigit("2"))}
        {btn("3",()=>pressDigit("3"))}
        {btn("+",()=>pressOp("+"),opStyle)}
        {btn("0",()=>pressDigit("0"),{gridColumn:"span 2"})}
        {btn(".",()=>pressDigit("."))}
        {btn("=",pressEquals,{background:AC,border:"1px solid "+AC,color:"#fff"})}
        {btn("⌫",pressBackspace,{gridColumn:"span 4",height:42,fontSize:14,background:"rgba(255,255,255,0.03)"})}
      </div>
    </div>
  );
}

// Placeholders — each gets a real implementation below as we work through the list.
const CLOCK_ZONES = [
  {label:"New York",   tz:"America/New_York"},
  {label:"Los Angeles",tz:"America/Los_Angeles"},
  {label:"London",     tz:"Europe/London"},
  {label:"Paris",      tz:"Europe/Paris"},
  {label:"Tokyo",      tz:"Asia/Tokyo"},
  {label:"Sydney",     tz:"Australia/Sydney"},
  {label:"Dubai",      tz:"Asia/Dubai"},
  {label:"São Paulo",  tz:"America/Sao_Paulo"},
];

function ClockApp({AC}){
  const [tab,setTab]=useState("world");
  const [tick,setTick]=useState(()=>new Date());
  // Stopwatch state
  const [swRunning,setSwRunning]=useState(false);
  const [swElapsed,setSwElapsed]=useState(0);      // total elapsed ms
  const [swStart,setSwStart]=useState(0);          // perf timestamp when last started
  const [swLaps,setSwLaps]=useState([]);
  // Timer state
  const [tMin,setTMin]=useState(5);
  const [tSec,setTSec]=useState(0);
  const [tRemaining,setTRemaining]=useState(0);    // ms until done
  const [tRunning,setTRunning]=useState(false);
  const tEndRef=useRef(0);

  // Drives world clock + stopwatch display + timer countdown. 100ms is plenty
  // smooth and avoids draining the battery on phones.
  useEffect(()=>{
    const id=setInterval(()=>{
      setTick(new Date());
      if(swRunning) setSwElapsed(prev=>prev + (performance.now()-swStart));
      // ^ that update pattern would over-count if swStart isn't reset every tick.
      // We actually compute elapsed live from swStart in the render — keep that simple.
    },1000);
    return ()=>clearInterval(id);
  },[swRunning,swStart]);

  // Smoother stopwatch tick: 50ms refresh for hundredths
  useEffect(()=>{
    if(!swRunning)return;
    const id=setInterval(()=>setTick(new Date()),50);
    return ()=>clearInterval(id);
  },[swRunning]);

  // Timer countdown
  useEffect(()=>{
    if(!tRunning)return;
    const id=setInterval(()=>{
      const left=Math.max(0,tEndRef.current-performance.now());
      setTRemaining(left);
      if(left<=0){setTRunning(false);}
    },100);
    return ()=>clearInterval(id);
  },[tRunning]);

  function fmtTimeTZ(date,tz){
    try{return date.toLocaleTimeString([],{timeZone:tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});}
    catch{return "—";}
  }
  function fmtDateTZ(date,tz){
    try{return date.toLocaleDateString([],{timeZone:tz,weekday:"short",month:"short",day:"numeric"});}
    catch{return "";}
  }
  // Stopwatch: render the live elapsed, not the (lagging) stored swElapsed
  const liveElapsed = swRunning ? swElapsed + (performance.now() - swStart) : swElapsed;
  function fmtStopwatch(ms){
    const total=Math.floor(ms);
    const cs=Math.floor((total%1000)/10);
    const s=Math.floor(total/1000)%60;
    const m=Math.floor(total/60000)%60;
    const h=Math.floor(total/3600000);
    const pad=n=>String(n).padStart(2,"0");
    return (h>0?pad(h)+":":"")+pad(m)+":"+pad(s)+"."+pad(cs);
  }
  function startStopwatch(){
    if(swRunning){
      setSwElapsed(prev=>prev + (performance.now()-swStart));
      setSwRunning(false);
    } else {
      setSwStart(performance.now());
      setSwRunning(true);
    }
  }
  function lapStopwatch(){
    if(!swRunning)return;
    setSwLaps(l=>[liveElapsed,...l]);
  }
  function resetStopwatch(){
    setSwRunning(false);setSwElapsed(0);setSwLaps([]);
  }

  function startTimer(){
    const ms=Math.max(0,(tMin*60+tSec)*1000);
    if(ms<=0)return;
    tEndRef.current=performance.now()+ms;
    setTRemaining(ms);
    setTRunning(true);
  }
  function stopTimer(){setTRunning(false);}
  function resetTimer(){setTRunning(false);setTRemaining(0);}
  function fmtTimer(ms){
    const total=Math.max(0,Math.ceil(ms/1000));
    const s=total%60;const m=Math.floor(total/60)%60;const h=Math.floor(total/3600);
    const pad=n=>String(n).padStart(2,"0");
    return (h>0?pad(h)+":":"")+pad(m)+":"+pad(s);
  }

  const tabBtn=(id,label)=>(
    <button onClick={()=>setTab(id)} style={{flex:1,padding:"10px 8px",background:"none",border:"none",borderBottom:tab===id?"2px solid "+AC:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:tab===id?AC:"rgba(255,255,255,0.4)"}}>{label}</button>
  );
  const ctrlBtn=(label,onClick,active=false,danger=false)=>(
    <button onClick={onClick} style={{
      flex:1,padding:"12px 0",borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,touchAction:"manipulation",
      background:danger?"rgba(255,80,80,0.1)":active?fill(AC):"rgba(255,255,255,0.07)",
      border:"1px solid "+(danger?"rgba(255,80,80,0.4)":active?bdr(AC):"rgba(255,255,255,0.12)"),
      color:danger?"#ff8b8b":active?AC:"rgba(255,255,255,0.8)",
    }}>{label}</button>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:FF,minHeight:0}}>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:14,flexShrink:0}}>
        {tabBtn("world","🌍 World")}{tabBtn("stop","⏱ Stopwatch")}{tabBtn("timer","⏲ Timer")}
      </div>
      {tab==="world"&&(
        <div style={{flex:1,overflowY:"auto",minHeight:0,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{padding:"14px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:10,marginBottom:6}}>
            <div style={{fontSize:11,fontFamily:FFB,fontWeight:600,color:AC,letterSpacing:1,marginBottom:5}}>LOCAL TIME</div>
            <div style={{fontFamily:FFM,fontWeight:500,fontSize:30,color:"#fff",letterSpacing:1.5}}>{tick.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}</div>
            <div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:2}}>{tick.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
          </div>
          {CLOCK_ZONES.map(z=>(
            <div key={z.tz} style={{padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.85)"}}>{z.label}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:FFM}}>{fmtDateTZ(tick,z.tz)}</div>
              </div>
              <div style={{fontFamily:FFM,fontWeight:500,fontSize:18,color:"#fff",letterSpacing:1}}>{fmtTimeTZ(tick,z.tz)}</div>
            </div>
          ))}
        </div>
      )}
      {tab==="stop"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          <div style={{textAlign:"center",padding:"30px 0 24px"}}>
            <div style={{fontFamily:FFM,fontWeight:400,fontSize:46,color:"#fff",letterSpacing:1.5}}>{fmtStopwatch(liveElapsed)}</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexShrink:0}}>
            {ctrlBtn(swRunning?"Pause":liveElapsed>0?"Resume":"Start",startStopwatch,true)}
            {ctrlBtn("Lap",lapStopwatch)}
            {ctrlBtn("Reset",resetStopwatch,false,true)}
          </div>
          <div style={{flex:1,overflowY:"auto",minHeight:0}}>
            {swLaps.length===0?<div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontStyle:"italic",fontSize:12,padding:"24px 0"}}>No laps yet</div>:swLaps.map((ms,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)",fontFamily:FFM,fontSize:13,color:"rgba(255,255,255,0.75)"}}>
                <span style={{color:"rgba(255,255,255,0.45)"}}>Lap {swLaps.length-i}</span><span>{fmtStopwatch(ms)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab==="timer"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,alignItems:"center",justifyContent:"flex-start",paddingTop:18}}>
          {!tRunning && tRemaining===0 ? (
            <>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
                <input type="number" min={0} max={99} value={tMin} onChange={e=>setTMin(Math.max(0,Math.min(99,+e.target.value||0)))} style={{...INP,width:80,textAlign:"center",fontFamily:FFM,fontSize:24}}/>
                <span style={{fontFamily:FFM,fontWeight:600,fontSize:22,color:"rgba(255,255,255,0.5)"}}>:</span>
                <input type="number" min={0} max={59} value={tSec} onChange={e=>setTSec(Math.max(0,Math.min(59,+e.target.value||0)))} style={{...INP,width:80,textAlign:"center",fontFamily:FFM,fontSize:24}}/>
              </div>
              <div style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:18}}>MIN  :  SEC</div>
            </>
          ):(
            <div style={{textAlign:"center",marginBottom:22}}>
              <div style={{fontFamily:FFM,fontWeight:400,fontSize:56,color:tRunning?"#fff":AC,letterSpacing:2}}>{fmtTimer(tRemaining)}</div>
              {!tRunning&&tRemaining===0&&<div style={{fontSize:14,fontFamily:FFB,fontWeight:700,color:AC,marginTop:8}}>Done ✓</div>}
            </div>
          )}
          <div style={{display:"flex",gap:8,width:"100%",maxWidth:300}}>
            {!tRunning ? ctrlBtn(tRemaining>0?"Resume":"Start",startTimer,true) : ctrlBtn("Stop",stopTimer,true,true)}
            {(tRemaining>0||tRunning)&&ctrlBtn("Reset",resetTimer)}
          </div>
        </div>
      )}
    </div>
  );
}
function CalendarApp({data,updateData,showToast,AC}){
  const events = data?.calendarEvents || {};   // { "YYYY-MM-DD": [{id,title,time?}, ...] }
  const today=new Date(); today.setHours(0,0,0,0);
  const [viewYear,setViewYear]=useState(today.getFullYear());
  const [viewMonth,setViewMonth]=useState(today.getMonth());  // 0-indexed
  const [selectedKey,setSelectedKey]=useState(()=>dateKey(today));
  const [newTitle,setNewTitle]=useState("");
  const [newTime,setNewTime]=useState("");

  function dateKey(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+dd;
  }
  function keyToParts(k){const [y,m,d]=k.split("-").map(Number);return {y,m:m-1,d};}

  // Grid: render 42 cells (6 weeks). Start from the Sunday on or before the 1st of the month.
  const first=new Date(viewYear,viewMonth,1);
  const startOffset=first.getDay();
  const gridStart=new Date(viewYear,viewMonth,1-startOffset);
  const cells=Array.from({length:42}).map((_,i)=>{
    const d=new Date(gridStart); d.setDate(gridStart.getDate()+i);
    return d;
  });

  function nav(delta){
    let m=viewMonth+delta, y=viewYear;
    if(m<0){m=11;y--;} else if(m>11){m=0;y++;}
    setViewMonth(m);setViewYear(y);
  }
  function goToday(){setViewMonth(today.getMonth());setViewYear(today.getFullYear());setSelectedKey(dateKey(today));}

  function addEvent(){
    const t=newTitle.trim();
    if(!t){showToast?.("Add a title first");return;}
    const ev={id:Date.now()+Math.random(),title:t,time:newTime||null};
    const next={...events, [selectedKey]:[...(events[selectedKey]||[]), ev]};
    updateData({calendarEvents:next});
    setNewTitle("");setNewTime("");
  }
  function deleteEvent(key,id){
    const list=(events[key]||[]).filter(e=>e.id!==id);
    const next={...events};
    if(list.length===0) delete next[key]; else next[key]=list;
    updateData({calendarEvents:next});
  }

  const monthName=new Date(viewYear,viewMonth,1).toLocaleDateString([],{month:"long",year:"numeric"});
  const todayKey=dateKey(today);
  const selectedEvents=events[selectedKey]||[];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",fontFamily:FF,minHeight:0}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <button onClick={()=>nav(-1)} style={{width:30,height:30,borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"rgba(255,255,255,0.75)",fontSize:14}}>←</button>
        <div style={{flex:1,textAlign:"center",fontFamily:FFB,fontWeight:700,fontSize:15,color:"#fff"}}>{monthName}</div>
        <button onClick={goToday} style={{padding:"5px 11px",borderRadius:7,background:fill(AC),border:"1px solid "+bdr(AC),cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:AC}}>Today</button>
        <button onClick={()=>nav(1)}  style={{width:30,height:30,borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"rgba(255,255,255,0.75)",fontSize:14}}>→</button>
      </div>

      {/* Weekday header */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,flexShrink:0}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gridAutoRows:"minmax(36px, 1fr)",gap:3,flexShrink:0}}>
        {cells.map((d,i)=>{
          const k=dateKey(d);
          const inMonth=d.getMonth()===viewMonth;
          const isToday=k===todayKey;
          const isSel=k===selectedKey;
          const has=events[k]&&events[k].length>0;
          return(
            <button key={i} onClick={()=>setSelectedKey(k)} style={{
              padding:6,borderRadius:7,cursor:"pointer",fontFamily:FF,fontSize:12,
              background:isSel?fill(AC):isToday?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",
              border:"1px solid "+(isSel?bdr(AC):isToday?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.05)"),
              color:isSel?AC:inMonth?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.25)",
              fontWeight:isToday||isSel?700:400,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",
            }}>
              <span>{d.getDate()}</span>
              {has && <div style={{position:"absolute",bottom:3,width:4,height:4,borderRadius:"50%",background:isSel?AC:"#4cef90"}}/>}
            </button>
          );
        })}
      </div>

      {/* Events for the selected date */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0,marginTop:4}}>
        <div style={{fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.45)",letterSpacing:1,marginBottom:8,textTransform:"uppercase",flexShrink:0}}>
          {(() => { const p=keyToParts(selectedKey); return new Date(p.y,p.m,p.d).toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"}); })()}
        </div>
        <div style={{flex:1,overflowY:"auto",minHeight:0,marginBottom:8}}>
          {selectedEvents.length===0 ? (
            <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontStyle:"italic",padding:"6px 0"}}>No events. Add one below.</div>
          ) : selectedEvents.map(ev=>(
            <div key={ev.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",marginBottom:4,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7}}>
              {ev.time && <span style={{fontFamily:FFM,fontSize:10,color:AC,minWidth:42}}>{ev.time}</span>}
              <span style={{flex:1,fontSize:13,color:"rgba(255,255,255,0.88)"}}>{ev.title}</span>
              <button className="dl" onClick={()=>deleteEvent(selectedKey,ev.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:12}}>✕</button>
            </div>
          ))}
        </div>
        {/* New event form */}
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <input value={newTime} onChange={e=>setNewTime(e.target.value)} placeholder="HH:MM" style={{...INP,width:74,fontSize:12,fontFamily:FFM,textAlign:"center"}}/>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEvent()} placeholder="New event…" style={{...INP,flex:1,fontSize:12}}/>
          <button onClick={addEvent} style={{padding:"7px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>Add</button>
        </div>
      </div>
    </div>
  );
}
function MusicApp({AC,showToast}){
  const [tracks,setTracks]=useState([]);     // [{name, url, size}]
  const [idx,setIdx]=useState(-1);
  const [playing,setPlaying]=useState(false);
  const [progress,setProgress]=useState(0);  // current time in seconds
  const [duration,setDuration]=useState(0);
  const [volume,setVolume]=useState(0.8);
  const audioRef=useRef(null);
  const inputRef=useRef(null);

  // Apply volume to the audio element whenever it changes.
  useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;},[volume]);
  // Cleanup blob URLs when the component unmounts (or tracks change).
  useEffect(()=>()=>{tracks.forEach(t=>URL.revokeObjectURL(t.url));},[]); // eslint-disable-line

  function handleFiles(e){
    const files=Array.from(e.target.files||[]);
    const audioFiles=files.filter(f=>f.type.startsWith("audio/")||/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name));
    if(audioFiles.length===0){showToast?.("No audio files selected");return;}
    const next=audioFiles.map(f=>({name:f.name,url:URL.createObjectURL(f),size:f.size}));
    setTracks(prev=>{
      const combined=[...prev,...next];
      // If nothing was playing, queue up the first new track
      if(idx<0)setIdx(prev.length);
      return combined;
    });
    e.target.value="";
  }

  function play(i){
    if(i<0||i>=tracks.length)return;
    setIdx(i);
    // Browsers require play() after a user gesture; this handler IS one.
    setTimeout(()=>{audioRef.current?.play().catch(()=>{});},0);
  }
  function togglePlay(){
    if(idx<0)return;
    if(playing) audioRef.current?.pause();
    else audioRef.current?.play().catch(()=>{});
  }
  function prev(){if(idx>0)play(idx-1);}
  function next(){if(idx<tracks.length-1)play(idx+1);}
  function seek(e){
    const el=audioRef.current;
    if(!el||!duration)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
    el.currentTime=ratio*duration;
  }
  function removeTrack(i){
    setTracks(prev=>{
      const copy=[...prev];
      const removed=copy.splice(i,1)[0];
      if(removed)URL.revokeObjectURL(removed.url);
      return copy;
    });
    if(i===idx){setIdx(-1);setPlaying(false);}
    else if(i<idx)setIdx(idx-1);
  }
  function fmt(s){
    if(!Number.isFinite(s))return "0:00";
    const m=Math.floor(s/60),sec=Math.floor(s%60);
    return m+":"+String(sec).padStart(2,"0");
  }

  const cur=idx>=0?tracks[idx]:null;
  const progPct=duration>0?(progress/duration)*100:0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12,height:"100%",fontFamily:FF,minHeight:0}}>
      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={handleFiles} style={{display:"none"}}/>

      {/* Now-playing card */}
      <div style={{padding:"16px 16px",background:"linear-gradient(135deg,"+fill(AC)+", rgba(255,255,255,0.03))",border:"1px solid "+bdr(AC),borderRadius:12,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:54,height:54,borderRadius:9,background:fill(AC),border:"1px solid "+bdr(AC),display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🎵</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:FFB,fontWeight:600,fontSize:14,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur?cur.name:"No track loaded"}</div>
            <div style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.5)",marginTop:2}}>{cur?fmt(progress)+" / "+fmt(duration):"—:—"}</div>
          </div>
        </div>
        {/* Progress bar */}
        <div onClick={seek} style={{marginTop:12,height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,cursor:cur?"pointer":"default",overflow:"hidden"}}>
          <div style={{height:"100%",width:progPct+"%",background:AC,transition:"width 0.1s linear"}}/>
        </div>
        {/* Controls */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12}}>
          <button onClick={prev} disabled={idx<=0} style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:idx>0?"pointer":"default",color:"rgba(255,255,255,0.8)",fontSize:14,opacity:idx>0?1:0.4}}>⏮</button>
          <button onClick={togglePlay} disabled={!cur} style={{width:44,height:44,borderRadius:10,background:fill(AC),border:"1px solid "+bdr(AC),cursor:cur?"pointer":"default",color:AC,fontSize:16,opacity:cur?1:0.4}}>{playing?"⏸":"▶"}</button>
          <button onClick={next} disabled={idx>=tracks.length-1} style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:idx<tracks.length-1?"pointer":"default",color:"rgba(255,255,255,0.8)",fontSize:14,opacity:idx<tracks.length-1?1:0.4}}>⏭</button>
          <div style={{flex:1}}/>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>🔊</span>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(+e.target.value)} style={{width:80,accentColor:AC}}/>
        </div>
      </div>

      {/* Playlist */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={SEC}>Playlist ({tracks.length})</div>
        <button onClick={()=>inputRef.current?.click()} style={{padding:"5px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.75)"}}>+ Add files</button>
      </div>
      <div style={{flex:1,overflowY:"auto",minHeight:0}}>
        {tracks.length===0 ? (
          <div style={{textAlign:"center",padding:"30px 16px",color:"rgba(255,255,255,0.25)",fontStyle:"italic",fontSize:12}}>No tracks. Add audio files from your device — MP3, WAV, OGG, M4A all work.</div>
        ) : tracks.map((t,i)=>(
          <div key={i} className="sr" onClick={()=>play(i)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:4,background:i===idx?fill(AC):"rgba(255,255,255,0.03)",border:"1px solid "+(i===idx?bdr(AC):"rgba(255,255,255,0.06)"),borderRadius:7,cursor:"pointer"}}>
            <div style={{width:24,textAlign:"center",fontFamily:FFM,fontSize:11,color:i===idx?AC:"rgba(255,255,255,0.35)"}}>{i===idx&&playing?"▶":i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:i===idx?"#fff":"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
            </div>
            <button className="dl" onClick={e=>{e.stopPropagation();removeTrack(i);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.3)",fontSize:13,padding:"3px 6px"}}>✕</button>
          </div>
        ))}
      </div>

      {/* The actual <audio> element. Hidden — we drive it via refs. */}
      {cur && <audio
        ref={audioRef}
        src={cur.url}
        onPlay={()=>setPlaying(true)}
        onPause={()=>setPlaying(false)}
        onTimeUpdate={e=>setProgress(e.currentTarget.currentTime)}
        onDurationChange={e=>setDuration(e.currentTarget.duration)}
        onEnded={()=>{if(idx<tracks.length-1)play(idx+1);else setPlaying(false);}}
      />}
    </div>
  );
}
function PdfApp({AC,showToast}){
  // We render PDFs via an <iframe> pointed at a blob: URL. The browser's
  // built-in PDF viewer handles paging, zoom, search, and print — no
  // external dependency needed. Trade-off: we can't customize the toolbar.
  const [url,setUrl]=useState(null);
  const [name,setName]=useState("");
  const inputRef=useRef(null);

  // Clean up the blob URL when a new file is loaded or the app closes,
  // otherwise the browser holds onto the file's memory indefinitely.
  useEffect(()=>()=>{ if(url) URL.revokeObjectURL(url); },[url]);

  function handleFile(e){
    const file=e.target.files?.[0];
    if(!file)return;
    if(file.type && file.type!=="application/pdf" && !file.name.toLowerCase().endsWith(".pdf")){
      showToast?.("Not a PDF file");
      e.target.value="";
      return;
    }
    if(url) URL.revokeObjectURL(url);
    const next=URL.createObjectURL(file);
    setUrl(next);
    setName(file.name);
    e.target.value="";
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",fontFamily:FF,minHeight:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={()=>inputRef.current?.click()} style={{padding:"8px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>📄 {url?"Open another":"Open PDF"}</button>
        {name && <span style={{fontFamily:FFM,fontSize:11,color:"rgba(255,255,255,0.55)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{name}</span>}
      </div>
      {url ? (
        <iframe
          src={url}
          title="pdf"
          style={{flex:1,width:"100%",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"#fff",minHeight:0}}/>
      ) : (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))",minHeight:0,padding:30,textAlign:"center"}}>
          <div style={{fontSize:48,opacity:0.55}}>📄</div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:18,color:"rgba(255,255,255,0.75)"}}>No PDF loaded</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",maxWidth:320,lineHeight:1.6}}>Open a PDF from your device. It opens in your browser's built-in viewer with paging, zoom, search, and print.</div>
          <button onClick={()=>inputRef.current?.click()} style={{marginTop:8,padding:"10px 18px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC}}>Browse files…</button>
        </div>
      )}
    </div>
  );
}
// Severity → swatch color for NWS alerts.
const ALERT_COLOR = {
  Extreme:  {bg:"rgba(255,80,80,0.18)",  border:"rgba(255,80,80,0.55)",  fg:"#ff8080"},
  Severe:   {bg:"rgba(255,150,40,0.16)", border:"rgba(255,150,40,0.5)",  fg:"#ffaa44"},
  Moderate: {bg:"rgba(255,200,80,0.14)", border:"rgba(255,200,80,0.45)", fg:"#ffd060"},
  Minor:    {bg:"rgba(100,200,255,0.12)",border:"rgba(100,200,255,0.4)", fg:"#88c8ff"},
};

function AtmosApp({AC,showToast}){
  const [query,setQuery]=useState("");
  const [suggestions,setSuggestions]=useState([]);    // array of suggestion objects
  const [openSuggest,setOpenSuggest]=useState(false);
  const [loadingSuggest,setLoadingSuggest]=useState(false);
  const [loc,setLoc]=useState(null);                  // selected {label,lat,lon,countryCode}
  const [forecast,setForecast]=useState(null);
  const [alerts,setAlerts]=useState([]);
  const [loadingForecast,setLoadingForecast]=useState(false);
  const [units,setUnits]=useState("imperial");        // imperial | metric
  const [expandedAlert,setExpandedAlert]=useState(null);
  const debounceRef=useRef(null);

  // Debounced geocode lookup as the user types. 350ms is just slow enough to
  // not hammer Nominatim's 1-req/sec policy, and just fast enough to feel live.
  useEffect(()=>{
    if(!query.trim()){setSuggestions([]);setOpenSuggest(false);return;}
    clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(async()=>{
      setLoadingSuggest(true);
      try{
        const res=await fetch(geocodeUrl(query));
        const json=await res.json();
        setSuggestions(parseGeocode(json));
        setOpenSuggest(true);
      }catch{setSuggestions([]);}
      setLoadingSuggest(false);
    },350);
    return ()=>clearTimeout(debounceRef.current);
  },[query]);

  async function pickLocation(s){
    // Whenever we switch locations we want to silence any in-progress TTS
    // read-out from the previous location's alerts. Otherwise queued
    // utterances would keep playing over the new selection.
    cancelSpeech();
    setLoc(s);
    setQuery(s.label);
    setOpenSuggest(false);
    setLoadingForecast(true);
    setForecast(null);setAlerts([]);
    try{
      const fres=await fetch(forecastUrl(s.lat,s.lon,units));
      const fjson=await fres.json();
      setForecast(parseForecast(fjson));
    }catch{showToast?.("Couldn't load forecast");}
    // Only ping NWS for US points — it returns empty for non-US anyway, and
    // we'd rather not waste the request.
    if(isLikelyUS(s.lat,s.lon)){
      try{
        const ares=await fetch(alertsUrl(s.lat,s.lon),{headers:{Accept:"application/geo+json"}});
        const ajson=await ares.json();
        const parsed=parseAlerts(ajson);
        setAlerts(parsed);
        // Audible alert sequence when active alerts are present:
        //   1. 607 Hz tone for 3 seconds (jolts the user to look)
        //   2. After ~3.1 s, TTS reads each alert's event + headline so the
        //      user can hear what's happening without looking at the screen.
        // The tone plays each time a location with alerts is loaded; the
        // TTS queues all alerts in order, automatically read back-to-back
        // by the browser's SpeechSynthesis queue.
        if(parsed.length>0){
          playTone(607, 3000);
          setTimeout(()=>{
            for(const a of parsed){
              const summary = a.event + (a.headline ? ". " + a.headline : "");
              speak(summary);
            }
          }, 3100);
        }
      }catch{/* alerts are optional — don't surface error */}
    }
    setLoadingForecast(false);
  }

  // Re-fetch forecast when units flip (only if we already have a location)
  useEffect(()=>{
    if(!loc)return;
    setLoadingForecast(true);
    (async()=>{
      try{
        const r=await fetch(forecastUrl(loc.lat,loc.lon,units));
        setForecast(parseForecast(await r.json()));
      }catch{}
      setLoadingForecast(false);
    })();
  },[units]); // eslint-disable-line

  function fmtHour(iso){
    try{return new Date(iso).toLocaleTimeString([],{hour:"numeric",hour12:true});}
    catch{return iso;}
  }
  function fmtDay(iso){
    try{return new Date(iso+"T12:00:00").toLocaleDateString([],{weekday:"short"});}
    catch{return iso;}
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,height:"100%",fontFamily:FF,minHeight:0}}>
      {/* Header / search */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,position:"relative"}}>
        <div style={{flex:1,position:"relative"}}>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            onFocus={()=>suggestions.length>0&&setOpenSuggest(true)}
            placeholder="Search for a city, town, ZIP code…"
            style={{...INP,fontSize:13,fontFamily:FF,paddingLeft:34}}
          />
          <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:0.5,pointerEvents:"none"}}>🔍</span>
          {/* Autocomplete dropdown */}
          {openSuggest && (loadingSuggest||suggestions.length>0) && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:5,background:"rgba(15,18,32,0.97)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,boxShadow:"0 20px 60px rgba(0,0,0,0.5)",maxHeight:220,overflowY:"auto",zIndex:10}}>
              {loadingSuggest && <div style={{padding:"10px 13px",fontSize:11,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Searching…</div>}
              {!loadingSuggest && suggestions.length===0 && <div style={{padding:"10px 13px",fontSize:11,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>No matches</div>}
              {!loadingSuggest && suggestions.map((s,i)=>(
                <div key={i} className="sr" onClick={()=>pickLocation(s)} style={{padding:"9px 13px",cursor:"pointer",fontSize:13,color:"rgba(255,255,255,0.85)",borderBottom:i<suggestions.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                  📍 {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={()=>setUnits(u=>u==="imperial"?"metric":"imperial")} style={{padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.7)"}}>{units==="imperial"?"°F":"°C"}</button>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",minHeight:0,display:"flex",flexDirection:"column",gap:12}}>
        {!loc && !loadingForecast && (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:30,textAlign:"center",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,background:"linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005))"}}>
            <div style={{fontSize:60,filter:"drop-shadow(0 0 16px rgba(79,158,255,0.4))"}}>🌤️</div>
            <div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:"rgba(255,255,255,0.9)",letterSpacing:0.4}}>Atmos</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",maxWidth:340,lineHeight:1.7}}>Search any location to see current conditions, live radar, hourly + 7-day forecast, and active NWS alerts for US locations. US locations with active alerts also trigger an audible 607 Hz tone followed by a TTS read-out of each alert.</div>
          </div>
        )}

        {loadingForecast && (
          <div style={{padding:"30px 0",textAlign:"center"}}>
            <div style={{width:30,height:30,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:10}}>Loading forecast for {loc?.label}…</div>
          </div>
        )}

        {!loadingForecast && forecast && (
          <>
            {/* Current conditions */}
            <div style={{padding:"16px 18px",background:"linear-gradient(135deg,"+fill(AC)+",rgba(255,255,255,0.03))",border:"1px solid "+bdr(AC),borderRadius:12}}>
              <div style={{fontSize:11,fontFamily:FFM,color:"rgba(255,255,255,0.55)",letterSpacing:1,marginBottom:4}}>CURRENT · {loc.label}</div>
              <div style={{display:"flex",alignItems:"center",gap:14,marginTop:4}}>
                <div style={{fontSize:62,lineHeight:1}}>{wmoIcon(forecast.current.code)}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:FFM,fontWeight:300,fontSize:48,color:"#fff",lineHeight:1}}>{Math.round(forecast.current.temp)}<span style={{fontSize:24,opacity:0.7}}>{forecast.units.temp}</span></div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:2}}>{wmoLabel(forecast.current.code)}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:14,marginTop:14,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Feels like <span style={{color:"#fff",fontFamily:FFM}}>{Math.round(forecast.current.feelsLike)}{forecast.units.temp}</span></div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Humidity <span style={{color:"#fff",fontFamily:FFM}}>{forecast.current.humidity}%</span></div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Wind <span style={{color:"#fff",fontFamily:FFM}}>{Math.round(forecast.current.wind)} {forecast.units.wind}</span></div>
              </div>
            </div>

            {/* Live Radar — Windy's official embed. Free, no API key, and Windy */}
            {/* explicitly supports embedding (their site has an "Embed widget" wizard). */}
            {/* We center the map on the location's lat/lon with radar overlay enabled. */}
            <div>
              <div style={SEC}>Live Radar</div>
              <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",aspectRatio:"16 / 10",background:"#000"}}>
                <iframe
                  key={loc.lat+","+loc.lon}
                  src={"https://embed.windy.com/embed2.html?lat="+loc.lat+"&lon="+loc.lon+"&detailLat="+loc.lat+"&detailLon="+loc.lon+"&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1"}
                  title="Live radar"
                  loading="lazy"
                  style={{position:"absolute",inset:0,width:"100%",height:"100%",border:0}}
                />
              </div>
            </div>

            {/* NWS alerts */}
            {alerts.length>0 && (
              <div>
                <div style={SEC}>⚠ NWS Alerts ({alerts.length})</div>
                {alerts.map(a=>{
                  const col=ALERT_COLOR[a.severity]||ALERT_COLOR.Minor;
                  const expanded=expandedAlert===a.id;
                  return(
                    <div key={a.id} onClick={()=>setExpandedAlert(expanded?null:a.id)} style={{padding:"10px 13px",marginBottom:6,background:col.bg,border:"1px solid "+col.border,borderRadius:8,cursor:"pointer"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:FFB,fontWeight:700,fontSize:12,color:col.fg,padding:"2px 7px",border:"1px solid "+col.border,borderRadius:4,whiteSpace:"nowrap"}}>{a.severity}</span>
                        <span style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.event}</span>
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{expanded?"▲":"▼"}</span>
                      </div>
                      {expanded && (
                        <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,0.78)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                          {a.headline && <div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",marginBottom:6}}>{a.headline}</div>}
                          {a.description}
                          {a.sender && <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:8,fontStyle:"italic"}}>— {a.sender}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hourly */}
            {forecast.hourly.length>0 && (
              <div>
                <div style={SEC}>Next 24 Hours</div>
                <div style={{display:"flex",overflowX:"auto",gap:5,paddingBottom:6}}>
                  {forecast.hourly.map((h,i)=>(
                    <div key={i} style={{flex:"0 0 auto",minWidth:62,padding:"8px 6px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,textAlign:"center"}}>
                      <div style={{fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.45)"}}>{i===0?"Now":fmtHour(h.time)}</div>
                      <div style={{fontSize:20,marginTop:2}}>{wmoIcon(h.code)}</div>
                      <div style={{fontFamily:FFM,fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{Math.round(h.temp)}°</div>
                      {h.pop>0&&<div style={{fontSize:9,color:"#88c8ff",fontFamily:FFM}}>{h.pop}%</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7-day */}
            <div>
              <div style={SEC}>7-Day Forecast</div>
              {forecast.days.map((d,i)=>(
                <div key={d.date} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7}}>
                  <div style={{width:60,fontFamily:FFB,fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.85)"}}>{i===0?"Today":fmtDay(d.date)}</div>
                  <div style={{fontSize:22,width:34,textAlign:"center"}}>{wmoIcon(d.code)}</div>
                  <div style={{flex:1,fontSize:11,color:"rgba(255,255,255,0.55)"}}>{wmoLabel(d.code)}</div>
                  <div style={{fontFamily:FFM,fontSize:13,color:"#fff",minWidth:62,textAlign:"right"}}>
                    {Math.round(d.high)}° <span style={{color:"rgba(255,255,255,0.4)"}}>/ {Math.round(d.low)}°</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Attribution — required by Nominatim's usage policy */}
        <div style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.25)",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:"auto"}}>
          Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>OpenStreetMap</a> contributors · Forecast by <a href="https://open-meteo.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>Open-Meteo</a> · Radar by <a href="https://www.windy.com" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>Windy</a> · Alerts by <a href="https://www.weather.gov" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.4)"}}>NWS</a>
        </div>
      </div>
    </div>
  );
}
const MINE_NUM_COLOR = ["", "#4f9eff", "#4cef90", "#ff6b6b", "#cc44ff", "#ff8c44", "#44ddcc", "#fff", "#888"];

function MinesweeperApp({AC}){
  const [diff,setDiff]=useState("easy");
  const cfg=MINE_DIFFICULTIES[diff];
  const [board,setBoard]=useState(null);             // null until first click
  const [revealed,setRevealed]=useState(()=>new Set());
  const [flagged,setFlagged]=useState(()=>new Set());
  const [status,setStatus]=useState("idle");          // idle | playing | won | lost
  const [startedAt,setStartedAt]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const pressTimer=useRef(null);
  const pressIsLong=useRef(false);

  // Timer tick during play
  useEffect(()=>{
    if(status!=="playing")return;
    const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startedAt)/1000)),250);
    return ()=>clearInterval(id);
  },[status,startedAt]);

  function newGame(d=diff){
    setDiff(d);
    setBoard(null);
    setRevealed(new Set());
    setFlagged(new Set());
    setStatus("idle");
    setElapsed(0);
  }

  function reveal(r,c){
    if(status==="won"||status==="lost")return;
    const key=r+","+c;
    if(flagged.has(key))return;
    let b=board;
    if(!b){
      // First click — generate the board, guaranteed safe at (r,c)
      b=mineCreateBoard(cfg.rows,cfg.cols,cfg.mines,r,c);
      setBoard(b);
      setStartedAt(Date.now());
      setStatus("playing");
    }
    if(revealed.has(key))return;
    if(b[r][c].isMine){
      setRevealed(new Set([...revealed,key]));
      setStatus("lost");
      return;
    }
    const flood=floodReveal(b,r,c);
    const next=new Set(revealed);
    flood.forEach(k=>next.add(k));
    setRevealed(next);
    if(mineIsWin(b,next))setStatus("won");
  }

  function toggleFlag(r,c){
    if(status==="won"||status==="lost")return;
    const key=r+","+c;
    if(revealed.has(key))return;
    const next=new Set(flagged);
    if(next.has(key))next.delete(key); else next.add(key);
    setFlagged(next);
  }

  // Long-press detection for touch users — short press reveals, long press flags.
  function onCellPointerDown(r,c){
    pressIsLong.current=false;
    pressTimer.current=setTimeout(()=>{
      pressIsLong.current=true;
      toggleFlag(r,c);
    },350);
  }
  function onCellPointerUp(r,c){
    clearTimeout(pressTimer.current);
    if(!pressIsLong.current) reveal(r,c);
  }
  function onCellPointerCancel(){
    clearTimeout(pressTimer.current);
    pressIsLong.current=false;
  }
  function onCellContextMenu(e,r,c){
    e.preventDefault();
    toggleFlag(r,c);
  }

  const minesLeft=cfg.mines-flagged.size;
  const cellSize=Math.max(22,Math.min(34,Math.floor(280/cfg.cols)));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,fontFamily:FF,height:"100%",minHeight:0}}>
      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
        {Object.keys(MINE_DIFFICULTIES).map(d=>(
          <button key={d} onClick={()=>newGame(d)} style={{padding:"5px 11px",borderRadius:18,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,background:diff===d?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(diff===d?bdr(AC):"rgba(255,255,255,0.1)"),color:diff===d?AC:"rgba(255,255,255,0.55)",textTransform:"capitalize"}}>{d}</button>
        ))}
        <div style={{flex:1}}/>
        <div style={{fontFamily:FFM,fontSize:13,color:"rgba(255,255,255,0.7)"}}>💣 {minesLeft}</div>
        <div style={{fontFamily:FFM,fontSize:13,color:"rgba(255,255,255,0.5)"}}>⏱ {elapsed}s</div>
        <button onClick={()=>newGame(diff)} style={{padding:"5px 11px",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.75)"}}>↻ New</button>
      </div>

      {status==="won" && <div style={{padding:"8px 12px",background:"rgba(76,239,144,0.1)",border:"1px solid rgba(76,239,144,0.35)",borderRadius:7,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#4cef90",textAlign:"center"}}>🎉 You won in {elapsed}s!</div>}
      {status==="lost" && <div style={{padding:"8px 12px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:7,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#ff7878",textAlign:"center"}}>💥 You hit a mine — try again</div>}

      <div style={{flex:1,overflow:"auto",minHeight:0,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:4}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat("+cfg.cols+",1fr)",gap:2,touchAction:"none"}}>
          {Array.from({length:cfg.rows}).map((_,r)=>Array.from({length:cfg.cols}).map((__,c)=>{
            const key=r+","+c;
            const isRev=revealed.has(key);
            const isFlag=flagged.has(key);
            const cell=board?board[r][c]:null;
            const showMine=isRev&&cell&&cell.isMine;
            const num=isRev&&cell&&!cell.isMine?cell.neighbors:0;
            return(
              <div key={key}
                onPointerDown={()=>onCellPointerDown(r,c)}
                onPointerUp={()=>onCellPointerUp(r,c)}
                onPointerCancel={onCellPointerCancel}
                onPointerLeave={onCellPointerCancel}
                onContextMenu={e=>onCellContextMenu(e,r,c)}
                style={{
                  width:cellSize,height:cellSize,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:FFB,fontWeight:700,fontSize:Math.floor(cellSize*0.55),
                  borderRadius:3,cursor:"pointer",userSelect:"none",
                  touchAction:"none",
                  background: isRev ? (showMine ? "rgba(255,80,80,0.25)" : "rgba(255,255,255,0.04)") : "rgba(255,255,255,0.1)",
                  border:"1px solid "+(isRev ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)"),
                  color: showMine ? "#ff7878" : num>0 ? MINE_NUM_COLOR[num] : "transparent",
                }}>
                {showMine ? "💣" : isFlag ? "🚩" : num>0 ? num : ""}
              </div>
            );
          }))}
        </div>
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center",fontStyle:"italic"}}>Tap to reveal · Long-press (or right-click) to flag</div>
    </div>
  );
}
function WordleApp({AC,showToast}){
  const [answer]=useState(()=>dailyWord());
  const [guesses,setGuesses]=useState([]);            // array of {word, score}
  const [current,setCurrent]=useState("");
  const [status,setStatus]=useState("playing");       // playing | won | lost
  const MAX=6;

  function submitGuess(){
    if(status!=="playing")return;
    const g=normalizeGuess(current);
    if(!g){showToast?.("Need 5 letters");return;}
    const sc=scoreGuess(g,answer);
    const next=[...guesses,{word:g,score:sc}];
    setGuesses(next);
    setCurrent("");
    if(g===answer){setStatus("won");return;}
    if(next.length>=MAX){setStatus("lost");}
  }
  function onKey(e){
    if(e.key==="Enter"){submitGuess();return;}
    if(e.key==="Backspace"){setCurrent(s=>s.slice(0,-1));return;}
    if(/^[a-zA-Z]$/.test(e.key)&&current.length<5){
      setCurrent(s=>(s+e.key).toUpperCase());
    }
  }
  // Per-letter color used for both completed guesses AND the keyboard hint.
  function colorFor(state){
    if(state==="correct")return {bg:"rgba(76,239,144,0.25)",border:"rgba(76,239,144,0.6)",fg:"#4cef90"};
    if(state==="present")return {bg:"rgba(255,200,80,0.22)",border:"rgba(255,200,80,0.55)",fg:"#ffcc44"};
    if(state==="absent") return {bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.08)",fg:"rgba(255,255,255,0.35)"};
    return {bg:"rgba(255,255,255,0.05)",border:"rgba(255,255,255,0.12)",fg:"rgba(255,255,255,0.85)"};
  }
  // Build a key-state map from previous guesses so the on-screen keyboard
  // reflects what's known about each letter (priority: correct > present > absent).
  const keyStates={};
  for(const g of guesses){
    for(let i=0;i<g.word.length;i++){
      const L=g.word[i], s=g.score[i];
      const prev=keyStates[L];
      const rank={correct:3,present:2,absent:1};
      if(!prev || (rank[s]||0)>(rank[prev]||0)) keyStates[L]=s;
    }
  }
  // 6 rows of 5 cells; fill in completed guesses, then current entry, then empties.
  const rows=[];
  for(let r=0;r<MAX;r++){
    const guess=guesses[r];
    const isCur=!guess && r===guesses.length && status==="playing";
    rows.push({guess, isCur});
  }

  const KB_ROWS=["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];
  function pressKey(k){
    if(status!=="playing")return;
    if(k==="ENTER"){submitGuess();return;}
    if(k==="BACK"){setCurrent(s=>s.slice(0,-1));return;}
    if(current.length<5)setCurrent(s=>s+k);
  }

  return(
    <div tabIndex={0} onKeyDown={onKey} style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:FF,outline:"none",alignItems:"center",gap:14,minHeight:0}}>
      <div style={{fontFamily:FFB,fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.55)",letterSpacing:1.5,textTransform:"uppercase"}}>Daily Wordle</div>

      {status==="won" && <div style={{padding:"7px 14px",background:"rgba(76,239,144,0.12)",border:"1px solid rgba(76,239,144,0.4)",borderRadius:7,fontFamily:FFB,fontWeight:700,fontSize:13,color:"#4cef90"}}>🎉 Got it in {guesses.length}!</div>}
      {status==="lost" && <div style={{padding:"7px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.4)",borderRadius:7,fontFamily:FFB,fontWeight:700,fontSize:13,color:"#ff8b8b"}}>Answer: {answer}</div>}

      {/* Guess grid */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {rows.map((row,ri)=>(
          <div key={ri} style={{display:"flex",gap:6}}>
            {[0,1,2,3,4].map(i=>{
              const letter = row.guess ? row.guess.word[i] : (row.isCur ? current[i] : "");
              const state = row.guess ? row.guess.score[i] : null;
              const col=colorFor(state);
              return(
                <div key={i} style={{
                  width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:FFB,fontWeight:700,fontSize:22,letterSpacing:1,
                  borderRadius:6,
                  background:col.bg,border:"1px solid "+col.border,color:col.fg,
                  transition:"background 0.18s, border-color 0.18s",
                }}>{letter||""}</div>
              );
            })}
          </div>
        ))}
      </div>

      {/* On-screen keyboard */}
      <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4,maxWidth:360,width:"100%"}}>
        {KB_ROWS.map((row,ri)=>(
          <div key={ri} style={{display:"flex",gap:3,justifyContent:"center"}}>
            {ri===2 && <button onClick={()=>pressKey("ENTER")} style={{flex:"1.4 1 0",height:38,borderRadius:5,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",fontFamily:FFB,fontWeight:700,fontSize:11,cursor:"pointer",touchAction:"manipulation"}}>ENTER</button>}
            {row.split("").map(k=>{
              const st=keyStates[k];
              const col=colorFor(st);
              return(
                <button key={k} onClick={()=>pressKey(k)} style={{
                  flex:"1 1 0",height:38,borderRadius:5,
                  background:col.bg,border:"1px solid "+col.border,color:col.fg,
                  fontFamily:FFB,fontWeight:700,fontSize:13,cursor:"pointer",touchAction:"manipulation",
                  transition:"background 0.18s, border-color 0.18s",
                }}>{k}</button>
              );
            })}
            {ri===2 && <button onClick={()=>pressKey("BACK")} style={{flex:"1.4 1 0",height:38,borderRadius:5,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",fontFamily:FFB,fontWeight:700,fontSize:14,cursor:"pointer",touchAction:"manipulation"}}>⌫</button>}
          </div>
        ))}
      </div>

      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center",fontStyle:"italic"}}>Type letters or tap keys · Enter to submit · New word every UTC day</div>
    </div>
  );
}
function TetrisApp({AC}){
  const [grid,setGrid]=useState(()=>tetrisEmpty());
  const [piece,setPiece]=useState(()=>tetrisRandom());
  const [next,setNext]=useState(()=>tetrisRandom());
  const [score,setScore]=useState(0);
  const [lines,setLines]=useState(0);
  const [level,setLevel]=useState(1);
  const [over,setOver]=useState(false);
  const [paused,setPaused]=useState(false);
  // Refs let the keyboard handler and the gravity tick read the latest values
  // without becoming dependencies that re-create handlers every render.
  const gridRef=useRef(grid);   useEffect(()=>{gridRef.current=grid;},[grid]);
  const pieceRef=useRef(piece); useEffect(()=>{pieceRef.current=piece;},[piece]);

  function newGame(){
    setGrid(tetrisEmpty());setPiece(tetrisRandom());setNext(tetrisRandom());
    setScore(0);setLines(0);setLevel(1);setOver(false);setPaused(false);
  }

  // Try to move/rotate; commit if the move fits. Locks the piece when downward
  // movement is blocked, then spawns the next piece (game over if it can't fit).
  function tryMove(dr,dc){
    const p=pieceRef.current;
    if(!p)return false;
    const moved={...p,row:p.row+dr,col:p.col+dc};
    if(tetrisFits(gridRef.current,moved)){setPiece(moved);return true;}
    if(dr>0){lockAndSpawn();}
    return false;
  }
  function rotate(){
    const p=pieceRef.current;
    if(!p)return;
    const r=(p.rotation+1)%4;
    if(tetrisFits(gridRef.current,p,p.row,p.col,r)){setPiece({...p,rotation:r});}
    // Simple "wall kick": try shifting +/-1 column if the basic rotation didn't fit
    else if(tetrisFits(gridRef.current,p,p.row,p.col-1,r)){setPiece({...p,rotation:r,col:p.col-1});}
    else if(tetrisFits(gridRef.current,p,p.row,p.col+1,r)){setPiece({...p,rotation:r,col:p.col+1});}
  }
  function hardDrop(){
    let p=pieceRef.current;
    if(!p)return;
    let dropped=0;
    while(tetrisFits(gridRef.current,p,p.row+1,p.col)){p={...p,row:p.row+1};dropped++;}
    setPiece(p);
    setScore(s=>s+dropped*2);  // bonus points for hard drops
    setTimeout(lockAndSpawn,0);
  }
  function lockAndSpawn(){
    const locked=tetrisLock(gridRef.current,pieceRef.current);
    const {grid:cleared,linesCleared}=tetrisClearLines(locked);
    setGrid(cleared);
    if(linesCleared>0){
      setScore(s=>s+scoreForLines(linesCleared,level));
      setLines(l=>{
        const n=l+linesCleared;
        setLevel(Math.floor(n/10)+1);
        return n;
      });
    }
    const spawned=next;
    const newNext=tetrisRandom();
    setNext(newNext);
    if(!tetrisFits(cleared,spawned)){setOver(true);return;}
    setPiece(spawned);
  }

  // Gravity tick — falls one row every interval(level). Paused/over freezes it.
  useEffect(()=>{
    if(over||paused)return;
    const id=setInterval(()=>tryMove(1,0),tickInterval(level));
    return ()=>clearInterval(id);
  },[level,over,paused]); // eslint-disable-line

  // Keyboard controls
  useEffect(()=>{
    function onKey(e){
      if(over)return;
      if(e.key==="ArrowLeft"){e.preventDefault();tryMove(0,-1);}
      else if(e.key==="ArrowRight"){e.preventDefault();tryMove(0,1);}
      else if(e.key==="ArrowDown"){e.preventDefault();tryMove(1,0);setScore(s=>s+1);}
      else if(e.key==="ArrowUp"){e.preventDefault();rotate();}
      else if(e.key===" "){e.preventDefault();hardDrop();}
      else if(e.key==="p"||e.key==="P"){setPaused(p=>!p);}
    }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[over]); // eslint-disable-line

  // Build a display grid that includes the active piece overlaid on the locked grid.
  const display=grid.map(r=>r.slice());
  if(!over){
    const s=shapeOf(piece);
    for(let r=0;r<s.length;r++)for(let c=0;c<s[r].length;c++){
      if(s[r][c]){
        const gr=piece.row+r, gc=piece.col+c;
        if(gr>=0&&gr<TETRIS_H&&gc>=0&&gc<TETRIS_W) display[gr][gc]=piece.color;
      }
    }
  }
  // Render the "next" preview piece too
  const nextShape=shapeOf(next);

  const ctrlBtn=(label,onClick,opts={})=>(
    <button onClick={onClick} style={{
      width:opts.w||44,height:44,borderRadius:8,
      background:opts.danger?"rgba(255,80,80,0.1)":"rgba(255,255,255,0.07)",
      border:"1px solid "+(opts.danger?"rgba(255,80,80,0.3)":"rgba(255,255,255,0.12)"),
      cursor:"pointer",color:opts.danger?"#ff8b8b":"rgba(255,255,255,0.85)",
      fontFamily:FFB,fontWeight:700,fontSize:16,touchAction:"manipulation",
    }}>{label}</button>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",fontFamily:FF,minHeight:0,alignItems:"center"}}>
      {/* Top info */}
      <div style={{display:"flex",gap:10,width:"100%",flexShrink:0}}>
        <div style={{flex:1,padding:"7px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7}}>
          <div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>SCORE</div>
          <div style={{fontFamily:FFM,fontWeight:600,fontSize:16,color:"#fff"}}>{score}</div>
        </div>
        <div style={{flex:1,padding:"7px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7}}>
          <div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>LINES · LVL</div>
          <div style={{fontFamily:FFM,fontWeight:600,fontSize:16,color:"#fff"}}>{lines} · {level}</div>
        </div>
        <div style={{padding:"5px 7px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,minWidth:48}}>
          <div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.4)",letterSpacing:1,textAlign:"center"}}>NEXT</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat("+nextShape[0].length+",1fr)",gap:1,marginTop:2}}>
            {nextShape.flat().map((c,i)=><div key={i} style={{width:8,height:8,background:c?PIECE_COLORS[next.color]:"transparent",borderRadius:1}}/>)}
          </div>
        </div>
      </div>

      {over && <div style={{padding:"6px 12px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.4)",borderRadius:7,fontFamily:FFB,fontWeight:700,fontSize:12,color:"#ff8b8b",flexShrink:0}}>Game Over · Score: {score}</div>}

      {/* Playfield */}
      <div style={{display:"grid",gridTemplateColumns:"repeat("+TETRIS_W+",1fr)",gridAutoRows:"1fr",gap:1,background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:3,aspectRatio:TETRIS_W/TETRIS_H,maxHeight:"100%",width:"min(100%, 240px)",touchAction:"none"}}>
        {display.flat().map((c,i)=><div key={i} style={{background:c?PIECE_COLORS[c]:"rgba(255,255,255,0.03)",borderRadius:1}}/>)}
      </div>

      {/* Touch controls (also nice on desktop) */}
      <div style={{display:"flex",gap:6,flexShrink:0,marginTop:2}}>
        {ctrlBtn("←",()=>tryMove(0,-1))}
        {ctrlBtn("↻",rotate)}
        {ctrlBtn("→",()=>tryMove(0,1))}
        {ctrlBtn("↓",()=>{tryMove(1,0);setScore(s=>s+1);})}
        {ctrlBtn("⤓",hardDrop,{w:60})}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        {ctrlBtn(paused?"▶":"⏸",()=>setPaused(p=>!p),{w:60})}
        {ctrlBtn("↻ New",newGame,{w:80,danger:over})}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textAlign:"center",fontStyle:"italic",flexShrink:0}}>← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause</div>
    </div>
  );
}

// ─── 5.2 APPS ─────────────────────────────────────────────────────────────────

// LocalStorage keys for Nova AI. We store everything client-side per the BYOK
// promise — no API key, no conversation history, no model preferences ever
// touch Firestore. That means data is per-device per-browser. Users who want
// cross-device sync can copy/paste their API key into each device.
const AI_LS_KEYS    = "nova-ai-keys";    // {claude, openai}
const AI_LS_CONFIG  = "nova-ai-config";  // {provider, model:{claude,openai}}
const AI_LS_CHATS   = "nova-ai-chats";   // [{id,title,provider,model,messages,createdAt,updatedAt}]

function aiLoad(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function aiSave(key, value) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function NovaAiApp({AC, showToast}){
  // Persistent state — loaded from localStorage at first render.
  const [keys, setKeys]       = useState(()=>aiLoad(AI_LS_KEYS, {claude:"", openai:""}));
  const [config, setConfig]   = useState(()=>aiLoad(AI_LS_CONFIG, {provider:"claude", model:{claude:AI_PROVIDERS.claude.defaultModel, openai:AI_PROVIDERS.openai.defaultModel}}));
  const [chats, setChats]     = useState(()=>aiLoad(AI_LS_CHATS, []));
  const [activeId, setActiveId] = useState(()=>chats[0]?.id || null);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");      // live-updating assistant text mid-stream
  const [error, setError]     = useState(null);
  const [view, setView]       = useState("chat");      // chat | settings — controls right-side panel
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef(null);

  // Persist on every change
  useEffect(()=>aiSave(AI_LS_KEYS, keys),     [keys]);
  useEffect(()=>aiSave(AI_LS_CONFIG, config), [config]);
  useEffect(()=>aiSave(AI_LS_CHATS, chats),   [chats]);

  // Scroll the message list to the bottom whenever it grows.
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight, behavior:"smooth"});}, [activeId, streamBuf, chats]);

  const provider = config.provider;
  const model    = config.model[provider] || AI_PROVIDERS[provider].defaultModel;
  const apiKey   = keys[provider] || "";
  const hasKey   = !!apiKey.trim();
  const active   = chats.find(c=>c.id===activeId) || null;

  function newChat(){
    setActiveId(null);
    setInput("");
    setError(null);
    setStreamBuf("");
  }
  function selectChat(id){
    setActiveId(id);
    setError(null);
    setStreamBuf("");
  }
  function deleteChat(id){
    setChats(prev=>prev.filter(c=>c.id!==id));
    if(id===activeId) setActiveId(null);
  }

  async function send(){
    const text = input.trim();
    if (!text || sending) return;
    if (!hasKey) { setError("Add your API key in Settings first."); setView("settings"); return; }

    setError(null);
    setSending(true);
    setInput("");
    setStreamBuf("");

    // Build/extend the conversation. If we're not in one yet, create it.
    let chatId = activeId;
    let chatMessages;
    if (!chatId) {
      const newId = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
      const newChatObj = {
        id: newId,
        title: aiDeriveTitle(text),
        provider, model,
        messages: [{role:"user", content:text}],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      setChats(prev=>[newChatObj, ...prev]);
      setActiveId(newId);
      chatId = newId;
      chatMessages = newChatObj.messages;
    } else {
      chatMessages = [...active.messages, {role:"user", content:text}];
      setChats(prev=>prev.map(c=>c.id===chatId?{...c,messages:chatMessages,updatedAt:Date.now()}:c));
    }

    let acc = "";
    try {
      for await (const chunk of aiStream(provider, model, apiKey, chatMessages)) {
        acc += chunk;
        setStreamBuf(acc);
      }
      // Stream finished — bake the assistant response into the chat record.
      setChats(prev=>prev.map(c=>c.id===chatId?{...c, messages:[...chatMessages,{role:"assistant",content:acc}], updatedAt:Date.now()}:c));
      setStreamBuf("");
    } catch (err) {
      // Surface API error; don't drop the user message (it's already saved).
      const msg = err?.message || "Request failed";
      setError(msg);
      setStreamBuf("");
    } finally {
      setSending(false);
    }
  }
  function onKey(e){
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Renders the message list area (right side of layout).
  function renderMessages(){
    if (view === "settings") return renderSettings();
    if (!active && streamBuf === "" && !sending) {
      return (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:30,textAlign:"center",minHeight:0}}>
          <div style={{fontSize:46,filter:"drop-shadow(0 0 18px rgba(168,85,247,0.4))"}}>✨</div>
          <div style={{fontFamily:FFB,fontWeight:700,fontSize:20,color:"rgba(255,255,255,0.85)"}}>Nova AI</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",maxWidth:380,lineHeight:1.7}}>
            Chat with <strong>{AI_PROVIDERS.claude.label}</strong> or <strong>{AI_PROVIDERS.openai.label}</strong> using your own API key.<br/>
            <span style={{color:"rgba(255,255,255,0.3)"}}>All requests go from your browser straight to the provider — Nova OS never sees your key or your messages.</span>
          </div>
          {!hasKey && (
            <button onClick={()=>setView("settings")} style={{padding:"10px 18px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC,marginTop:6}}>Add your API key</button>
          )}
        </div>
      );
    }
    const msgs = active?.messages || [];
    return (
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"14px 14px 18px",display:"flex",flexDirection:"column",gap:10,minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{
              maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",
              background:m.role==="user"?fill(AC):"rgba(255,255,255,0.05)",
              border:"1px solid "+(m.role==="user"?bdr(AC):"rgba(255,255,255,0.08)"),
              fontSize:13,color:"rgba(255,255,255,0.92)",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:FF,
            }}>{m.content}</div>
          </div>
        ))}
        {(streamBuf || sending) && (
          <div style={{display:"flex",justifyContent:"flex-start"}}>
            <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:"14px 14px 14px 4px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",fontSize:13,color:"rgba(255,255,255,0.92)",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:FF}}>
              {streamBuf || <span style={{opacity:0.5,fontStyle:"italic"}}>Thinking…</span>}
              {streamBuf && sending && <span style={{opacity:0.5,animation:"pulse 1s ease-in-out infinite"}}>▍</span>}
            </div>
          </div>
        )}
        {error && (
          <div style={{padding:"8px 12px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.35)",borderRadius:7,fontSize:12,color:"#ff8b8b",fontFamily:FFM}}>⚠ {error}</div>
        )}
      </div>
    );
  }

  function renderSettings(){
    const p = AI_PROVIDERS[provider];
    return (
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",minHeight:0}}>
        <div style={SEC}>Provider</div>
        <div style={{display:"flex",gap:6,marginBottom:18}}>
          {Object.keys(AI_PROVIDERS).map(k=>(
            <button key={k} onClick={()=>setConfig(c=>({...c,provider:k}))} style={{flex:1,padding:"8px 12px",background:provider===k?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(provider===k?bdr(AC):"rgba(255,255,255,0.1)"),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,color:provider===k?AC:"rgba(255,255,255,0.7)"}}>{AI_PROVIDERS[k].label}</button>
          ))}
        </div>

        <div style={SEC}>API Key</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,lineHeight:1.55}}>
          Get a key from <a href={p.keyDocsUrl} target="_blank" rel="noreferrer" style={{color:AC}}>{p.keyDocsUrl.replace(/^https?:\/\//,"")}</a> — {p.keyHint}. Stored only in this browser's localStorage; never sent to Nova OS servers.
        </div>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <input
            type="password"
            value={apiKey}
            onChange={e=>setKeys(k=>({...k,[provider]:e.target.value}))}
            placeholder={"Paste your "+p.label+" API key"}
            style={{...INP,flex:1,fontFamily:FFM,fontSize:12}}
          />
          {apiKey && <button onClick={()=>setKeys(k=>({...k,[provider]:""}))} style={{padding:"7px 12px",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"#ff8b8b"}}>Clear</button>}
        </div>
        <div style={{fontSize:10,color:hasKey?"#4cef90":"rgba(255,255,255,0.3)",marginBottom:20,fontFamily:FFM}}>{hasKey?"✓ Key saved locally":"No key yet"}</div>

        <div style={SEC}>Model</div>
        <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>
          {p.presetModels.map(m=>(
            <button key={m} onClick={()=>setConfig(c=>({...c,model:{...c.model,[provider]:m}}))} style={{padding:"5px 10px",background:model===m?fill(AC):"rgba(255,255,255,0.05)",border:"1px solid "+(model===m?bdr(AC):"rgba(255,255,255,0.08)"),borderRadius:6,cursor:"pointer",fontFamily:FFM,fontWeight:500,fontSize:10,color:model===m?AC:"rgba(255,255,255,0.6)"}}>{m}</button>
          ))}
        </div>
        <input
          value={model}
          onChange={e=>setConfig(c=>({...c,model:{...c.model,[provider]:e.target.value}}))}
          placeholder="Or type any model id…"
          style={{...INP,fontFamily:FFM,fontSize:11,marginBottom:22}}
        />

        <div style={SEC}>About</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.65,padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7}}>
          Nova AI runs entirely in your browser — your API key, model choice, and chat history live in <code style={{fontFamily:FFM,color:"#fff"}}>localStorage</code> on this device only.<br/><br/>
          Every API call goes directly from your browser to {AI_PROVIDERS.claude.label} or {AI_PROVIDERS.openai.label}. Nova OS and its operator pay nothing for your usage; you pay your provider's normal per-token rates.
        </div>

        <button onClick={()=>setView("chat")} style={{marginTop:18,width:"100%",padding:"10px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC}}>← Back to chat</button>
      </div>
    );
  }

  // Sidebar — chat list, hidden on mobile-narrow widths
  const sidebar = (
    <div style={{width:200,flexShrink:0,borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",minHeight:0,background:"rgba(0,0,0,0.15)"}}>
      <div style={{padding:"10px 10px 8px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        <button onClick={newChat} style={{width:"100%",padding:"8px 10px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:7,cursor:"pointer",fontFamily:FFB,fontWeight:700,fontSize:12,color:AC}}>＋ New chat</button>
      </div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"6px 6px"}}>
        {chats.length===0 ? (
          <div style={{padding:"14px 8px",fontSize:11,color:"rgba(255,255,255,0.3)",fontStyle:"italic",textAlign:"center"}}>No chats yet</div>
        ) : chats.map(c=>(
          <div key={c.id} onClick={()=>{selectChat(c.id);setView("chat");}} style={{padding:"7px 9px",marginBottom:3,borderRadius:6,cursor:"pointer",background:c.id===activeId?fill(AC):"transparent",border:"1px solid "+(c.id===activeId?bdr(AC):"transparent"),display:"flex",alignItems:"center",gap:6}}>
            <span style={{flex:1,minWidth:0,fontSize:11,color:c.id===activeId?AC:"rgba(255,255,255,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
            <button className="dl" onClick={e=>{e.stopPropagation();deleteChat(c.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.4)",fontSize:11,padding:"2px 4px",lineHeight:1}}>✕</button>
          </div>
        ))}
      </div>
      <div style={{padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0,fontSize:10,fontFamily:FFM,color:"rgba(255,255,255,0.32)"}}>
        <div style={{marginBottom:2}}>{AI_PROVIDERS[provider].label} · {hasKey?"key set":"no key"}</div>
        <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{model}</div>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100%",fontFamily:FF,minHeight:0}}>
      {showSidebar && sidebar}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,minWidth:0}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
          <button onClick={()=>setShowSidebar(s=>!s)} title="Toggle sidebar" style={{width:30,height:30,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:14}}>☰</button>
          <div style={{flex:1,minWidth:0,fontFamily:FFB,fontWeight:700,fontSize:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {active ? active.title : "New chat"}
          </div>
          <button onClick={()=>setView(v=>v==="chat"?"settings":"chat")} title="Settings" style={{width:30,height:30,borderRadius:6,background:view==="settings"?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(view==="settings"?bdr(AC):"rgba(255,255,255,0.1)"),cursor:"pointer",color:view==="settings"?AC:"rgba(255,255,255,0.7)",fontSize:14}}>⚙</button>
        </div>

        {renderMessages()}

        {/* Input bar — hidden in settings */}
        {view === "chat" && (
          <div style={{display:"flex",gap:7,padding:"10px 12px 12px",borderTop:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={hasKey ? "Ask Nova AI… (Enter to send, Shift+Enter for newline)" : "Add your API key in Settings to start chatting"}
              rows={1}
              disabled={sending}
              style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.92)",fontFamily:FF,fontSize:13,outline:"none",resize:"none",minHeight:40,maxHeight:160,lineHeight:1.5,opacity:sending?0.5:1}}
            />
            <button onClick={send} disabled={sending||!input.trim()} style={{padding:"0 18px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:10,cursor:sending||!input.trim()?"default":"pointer",fontFamily:FFB,fontWeight:700,fontSize:13,color:AC,opacity:sending||!input.trim()?0.4:1,whiteSpace:"nowrap"}}>{sending?"…":"Send"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

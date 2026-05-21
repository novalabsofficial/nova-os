// NOVA OS v3.5 — Nova Systems
// Drop this into src/NovaOS.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "./firebase.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEFAULT_AC = "#4f9eff";
const COLL       = "nova_storage";
const TASKBAR_H  = 52;
const MIN_W      = 280;
const MIN_H      = 200;
const ICON_W     = 76;
const ICON_H     = 92;
const ICON_GAP   = 4;
const ICON_PAD_X = 10;
const ICON_PAD_Y = 14;
const WIDGET_SNAP = 20;

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
  settings:{w:480,h:640},profile:{w:440,h:540},
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
  {id:"terminal",icon:"💻",label:"Terminal",desc:"System terminal"},
  {id:"settings",icon:"⚙️",label:"Settings",desc:"Customize Nova OS"},
  {id:"profile", icon:"👤",label:"Profile", desc:"Your account"},
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
const BOOT_MSGS     = ["NOVA OS v3.5 — Nova Systems","Initializing kernel... OK","Loading hardware abstraction layer... OK","Mounting filesystems... OK","Starting widget engine... OK","Loading user environment... OK","System ready."];
const ACCENT_PRESETS= ["#4f9eff","#ff6b6b","#4cef90","#ffcc44","#cc44ff","#ff8c44","#44ddcc","#ff44aa"];
const BOOKMARKS     = [{label:"Hacker News",url:"https://news.ycombinator.com"},{label:"Wikipedia",url:"https://en.m.wikipedia.org"},{label:"Archive.org",url:"https://archive.org"},{label:"itch.io",url:"https://itch.io"}];
const PAINT_COLORS  = ["#fff","#000","#ff4444","#ff8800","#ffdd00","#44dd44","#00ccff","#4466ff","#cc44ff","#ff44aa","#8b4513","#888"];
const WALLPAPERS    = {
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hexRgb(h){const c=h.replace("#","");return parseInt(c.slice(0,2),16)+","+parseInt(c.slice(2,4),16)+","+parseInt(c.slice(4,6),16);}
function fill(ac){return "rgba("+hexRgb(ac)+",0.16)";}
function bdr(ac) {return "rgba("+hexRgb(ac)+",0.55)";}
function isUrl(s){const t=s.trim();return /^https?:\/\//i.test(t)||/^[\w-]+\.[\w]{2,}(\/|$)/.test(t);}

function defaultIconPos(i){
  const availH=window.innerHeight-TASKBAR_H-ICON_PAD_Y-10;
  const rows=Math.max(1,Math.floor(availH/(ICON_H+ICON_GAP)));
  return {x:ICON_PAD_X+Math.floor(i/rows)*(ICON_W+ICON_GAP), y:ICON_PAD_Y+(i%rows)*(ICON_H+ICON_GAP)};
}

function snapToFreeGrid(dragId,rawX,rawY,allPos){
  const cW=ICON_W+ICON_GAP,cH=ICON_H+ICON_GAP;
  const maxC=Math.floor((window.innerWidth-ICON_PAD_X)/cW);
  const maxR=Math.floor((window.innerHeight-TASKBAR_H-ICON_PAD_Y)/cH);
  const tc=Math.max(0,Math.min(Math.round((rawX-ICON_PAD_X)/cW),maxC-1));
  const tr=Math.max(0,Math.min(Math.round((rawY-ICON_PAD_Y)/cH),maxR-1));
  const occ=new Set();
  Object.entries(allPos).forEach(([id,pos])=>{
    if(id===dragId)return;
    occ.add(Math.round((pos.x-ICON_PAD_X)/cW)+","+Math.round((pos.y-ICON_PAD_Y)/cH));
  });
  const vis=new Set([tc+","+tr]);const q=[[tc,tr]];
  while(q.length){
    const [c,r]=q.shift();
    if(c>=0&&r>=0&&c<maxC&&r<maxR&&!occ.has(c+","+r))
      return {x:ICON_PAD_X+c*cW,y:ICON_PAD_Y+r*cH};
    for(const [dc,dr] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nk=(c+dc)+","+(r+dr);
      if(!vis.has(nk)){vis.add(nk);q.push([c+dc,r+dr]);}
    }
  }
  return {x:ICON_PAD_X+tc*cW,y:ICON_PAD_Y+tr*cH};
}

function snapW(x,y){const g=WIDGET_SNAP;return{x:Math.round(x/g)*g,y:Math.round(y/g)*g};}

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
  @keyframes boot-in{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:none;}}
  @keyframes win-in{from{opacity:0;transform:scale(0.95) translateY(6px);}to{opacity:1;transform:none;}}
  @keyframes menu-up{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
  @keyframes toast-in{from{opacity:0;transform:translateX(14px);}to{opacity:1;transform:none;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
  .di:hover{background:rgba(255,255,255,0.14)!important;}.tb:hover{background:rgba(255,255,255,0.1)!important;}
  .wx:hover{background:#c42b1c!important;color:#fff!important;}.wm:hover,.wn:hover{background:rgba(255,255,255,0.1)!important;}
  .ma:hover{background:rgba(255,255,255,0.08)!important;}.ls:hover:not(:disabled){opacity:0.82!important;}
  .lt:hover{color:rgba(160,210,255,0.9)!important;}.sb:hover{background:rgba(255,255,255,0.1)!important;}
  .dl:hover{color:rgba(255,80,80,0.9)!important;}.ps:hover{transform:scale(1.2);z-index:2;}
  .fr:hover{background:rgba(255,255,255,0.07)!important;}.sr:hover{background:rgba(255,255,255,0.06)!important;}
  .bp:hover{background:rgba(255,255,255,0.1)!important;}.ad:hover{transform:scale(1.15);}
  .ws:hover{border-color:rgba(255,255,255,0.5)!important;}.sc:hover{background:rgba(255,255,255,0.06)!important;}
  .wgt{transition:border-color 0.15s;}.wgt:hover{border-color:rgba(255,255,255,0.22)!important;}
`;

// ─── BACKGROUNDS ─────────────────────────────────────────────────────────────
function NovaBg(){return(<svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="nb1" cx="22%" cy="18%" r="60%"><stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.55"/><stop offset="100%" stopColor="#0ea5e9" stopOpacity="0"/></radialGradient><radialGradient id="nb2" cx="82%" cy="82%" r="55%"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.5"/><stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/></radialGradient><radialGradient id="nb3" cx="72%" cy="8%" r="40%"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.35"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient><radialGradient id="nb4" cx="8%" cy="78%" r="35%"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/><stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/></radialGradient></defs><rect width="1440" height="900" fill="#07080f"/><rect width="1440" height="900" fill="url(#nb1)"/><rect width="1440" height="900" fill="url(#nb2)"/><rect width="1440" height="900" fill="url(#nb3)"/><rect width="1440" height="900" fill="url(#nb4)"/>{[...Array(55)].map((_,i)=>{const x=(i*137.5)%1440,y=(i*97.3)%900;return<circle key={i} cx={x} cy={y} r={i%3===0?1.5:1} fill="rgba(255,255,255,0.3)"/>;})}</svg>);}

function BlissBg(){return(<svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1b5c90"/><stop offset="30%" stopColor="#3990cc"/><stop offset="65%" stopColor="#6ab6e8"/><stop offset="100%" stopColor="#a4d4f0"/></linearGradient><linearGradient id="ghb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#478c18"/><stop offset="100%" stopColor="#1e5007"/></linearGradient><linearGradient id="ghm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#57b820"/><stop offset="100%" stopColor="#27680e"/></linearGradient><linearGradient id="ghf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cca2c"/><stop offset="100%" stopColor="#337a14"/></linearGradient><linearGradient id="gfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d8814"/><stop offset="100%" stopColor="#194807"/></linearGradient></defs><rect width="1440" height="900" fill="url(#gsky)"/>{[[310,165,150,50],[278,158,100,37],[350,155,85,40],[970,128,120,40],[940,121,78,29],[1170,200,130,44]].map(([cx,cy,rx,ry],i)=><ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={"rgba(255,255,255,"+(0.42+(i%3)*0.09)+")"}/>)}<path d="M0 590 Q200 450 430 530 Q630 610 860 480 Q1040 365 1210 445 Q1350 505 1440 460 L1440 900 L0 900Z" fill="url(#ghb)"/><path d="M0 645 Q170 515 380 585 Q570 655 775 540 Q955 425 1155 505 Q1305 565 1440 522 L1440 900 L0 900Z" fill="url(#ghm)"/><path d="M-10 725 Q70 640 190 658 Q310 678 440 730 Q615 796 808 682 Q955 598 1090 628 Q1230 658 1360 618 L1460 610 L1460 900 L-10 900Z" fill="url(#ghf)"/><path d="M0 818 Q370 778 720 795 Q1020 810 1440 778 L1440 900 L0 900Z" fill="url(#gfg)"/></svg>);}

function Wallpaper({id,customUrl}){
  if(id==="custom"&&customUrl)return<div style={{position:"absolute",inset:0,background:'url("'+customUrl+'") center/cover no-repeat'}}/>;
  if(!id||id==="nova")return<NovaBg/>;if(id==="bliss")return<BlissBg/>;
  const wp=WALLPAPERS[id];if(wp&&wp.grad)return<div style={{position:"absolute",inset:0,background:wp.grad}}/>;return<NovaBg/>;
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
  return <span style={{fontSize:size*0.9,lineHeight:1,display:"block"}}>📦</span>;
}

// Store app icon using Clearbit logo API with emoji fallback
function StoreIcon({domain,fallback,size=26}){
  const [failed,setFailed]=useState(false);
  if(failed||!domain)return<span style={{fontSize:size*0.88,lineHeight:1,display:"block"}}>{fallback}</span>;
  return<img src={"https://logo.clearbit.com/"+domain} width={size} height={size} style={{borderRadius:Math.max(3,size*0.2),objectFit:"contain",display:"block"}} onError={()=>setFailed(true)} alt=""/>;
}

// Unified icon display — picks SVG for built-in, Clearbit for store apps
function AppIconDisplay({app,size=26}){
  if(app.storeApp)return<StoreIcon domain={app.storeApp.domain} fallback={app.storeApp.icon} size={size}/>;
  return<NovaSvgIcon id={app.id} size={size}/>;
}

// ─── WIDGET SHELL (drag handle + 8-way resize + close button) ─────────────────
const WGT_HANDLES=[
  {id:"n", s:{top:0,left:8,right:8,height:5,cursor:"n-resize"}},
  {id:"s", s:{bottom:0,left:8,right:8,height:5,cursor:"s-resize"}},
  {id:"w", s:{top:8,left:0,bottom:8,width:5,cursor:"w-resize"}},
  {id:"e", s:{top:8,right:0,bottom:8,width:5,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:12,height:12,cursor:"nw-resize"}},
  {id:"ne",s:{top:0,right:0,width:12,height:12,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:12,height:12,cursor:"sw-resize"}},
  {id:"se",s:{bottom:0,right:0,width:12,height:12,cursor:"se-resize"}},
];

function WidgetShell({id,state,onDragStart,onResizeStart,onClose,children}){
  const {x,y,w,h}=state;
  return(
    <div className="wgt" style={{position:"absolute",left:x,top:y,width:w,height:h,zIndex:4,background:"rgba(7,8,18,0.72)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.45)",display:"flex",flexDirection:"column"}}>
      {/* Resize handles */}
      {WGT_HANDLES.map(hh=><div key={hh.id} onMouseDown={e=>{e.stopPropagation();onResizeStart(e,id,hh.id);}} style={{position:"absolute",...hh.s,zIndex:12}}/>)}
      {/* Header drag strip */}
      <div onMouseDown={e=>{e.stopPropagation();onDragStart(e,id);}}
        style={{height:26,display:"flex",alignItems:"center",padding:"0 8px 0 12px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"grab",userSelect:"none",flexShrink:0,zIndex:11}}>
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
function BrowserNav({bar,setBar,onGo,onBack,onFwd,canBack,canFwd,AC}){
  return(
    <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
      <button onClick={onBack} disabled={!canBack} style={{width:28,height:28,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:canBack?"pointer":"default",color:"rgba(255,255,255,0.5)",fontSize:13,opacity:canBack?1:0.3}}>←</button>
      <button onClick={onFwd}  disabled={!canFwd}  style={{width:28,height:28,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:canFwd?"pointer":"default",color:"rgba(255,255,255,0.5)",fontSize:13,opacity:canFwd?1:0.3}}>→</button>
      <input value={bar} onChange={e=>setBar(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onGo()} placeholder="Search or enter URL…" style={{...INP,flex:1,fontFamily:FFM,fontSize:12}}/>
      <button onClick={onGo} style={{padding:"7px 14px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,color:AC}}>Go</button>
    </div>
  );
}
const HANDLE_DEFS=[
  {id:"n",s:{top:0,left:8,right:8,height:5,cursor:"n-resize"}},{id:"s",s:{bottom:0,left:8,right:8,height:5,cursor:"s-resize"}},
  {id:"w",s:{top:8,left:0,bottom:8,width:5,cursor:"w-resize"}},{id:"e",s:{top:8,right:0,bottom:8,width:5,cursor:"e-resize"}},
  {id:"nw",s:{top:0,left:0,width:12,height:12,cursor:"nw-resize"}},{id:"ne",s:{top:0,right:0,width:12,height:12,cursor:"ne-resize"}},
  {id:"sw",s:{bottom:0,left:0,width:12,height:12,cursor:"sw-resize"}},{id:"se",s:{bottom:0,right:0,width:12,height:12,cursor:"se-resize"}},
];
function ResizeHandles({winId,onStartResize}){return HANDLE_DEFS.map(h=><div key={h.id} onMouseDown={e=>{e.stopPropagation();onStartResize(e,winId,h.id);}} style={{position:"absolute",...h.s,zIndex:20}}/>);}

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
  const wpId    =settings.wallpaper ||data?.wallpaper||"nova";
  const widgets =settings.widgets   ||{};

  useEffect(()=>{let i=0,dead=false;function nxt(){if(dead)return;if(i>=BOOT_MSGS.length){setTimeout(()=>{if(!dead)setScreen("login");},700);return;}setBootLines(p=>[...p,BOOT_MSGS[i++]]);setTimeout(nxt,i<2?90:230);}setTimeout(nxt,380);return()=>{dead=true;};},[]);
  useEffect(()=>{const t=setInterval(()=>setTick(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(user&&wpId==="custom")db.get("user:"+user+":wpimg").then(url=>{if(url)setCustomWp(url);});},[user,wpId]);
  useEffect(()=>{if(!menuOpen)return;function h(e){if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);}setTimeout(()=>document.addEventListener("mousedown",h),0);return()=>document.removeEventListener("mousedown",h);},[menuOpen]);

  // Window drag/resize
  useEffect(()=>{
    function onMove(e){if(!drag)return;if(drag.type==="move"){setWins(ws=>ws.map(w=>{if(w.id!==drag.winId)return w;return{...w,x:Math.max(0,e.clientX-drag.ox),y:Math.max(0,Math.min(e.clientY-drag.oy,window.innerHeight-80))};}));}else if(drag.type==="resize"){const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;setWins(ws=>ws.map(w=>{if(w.id!==drag.winId)return w;let nx=drag.wx,ny=drag.wy,nw=drag.ww,nh=drag.wh;if(drag.edge.includes("e"))nw=Math.max(MIN_W,drag.ww+dx);if(drag.edge.includes("s"))nh=Math.max(MIN_H,drag.wh+dy);if(drag.edge.includes("w")){nw=Math.max(MIN_W,drag.ww-dx);nx=drag.wx+drag.ww-nw;}if(drag.edge.includes("n")){nh=Math.max(MIN_H,drag.wh-dy);ny=drag.wy+drag.wh-nh;}return{...w,x:nx,y:ny,width:nw,height:nh};}));}}
    function onUp(){setDrag(null);}
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[drag]);

  // Icon drag — free move, snap-to-free-grid on release
  useEffect(()=>{
    if(!iconDrag)return;
    function onMove(e){const nx=Math.max(0,Math.min(e.clientX-iconDrag.ox,window.innerWidth-ICON_W));const ny=Math.max(0,Math.min(e.clientY-iconDrag.oy,window.innerHeight-TASKBAR_H-ICON_H));setIconPos(prev=>({...prev,[iconDrag.id]:{x:nx,y:ny}}));}
    function onUp(){const allPos={};(iconDrag.allIcons||[]).forEach((app,idx)=>{allPos[app.id]=iconPosRef.current[app.id]||defaultIconPos(idx);});const raw=iconPosRef.current[iconDrag.id]||allPos[iconDrag.id];const snapped=raw?snapToFreeGrid(iconDrag.id,raw.x,raw.y,allPos):null;const fp=snapped?{...iconPosRef.current,[iconDrag.id]:snapped}:iconPosRef.current;setIconPos(fp);db.set("user:"+iconDrag.user+":iconpos",fp).catch(()=>{});setIconDrag(null);}
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[iconDrag]);

  // Widget drag — free move, snap to 20px grid on release
  useEffect(()=>{
    if(!widgetDrag)return;
    function onMove(e){const nx=Math.max(0,Math.min(e.clientX-widgetDrag.ox,window.innerWidth-100));const ny=Math.max(0,Math.min(e.clientY-widgetDrag.oy,window.innerHeight-TASKBAR_H-60));setWidgetState(prev=>({...prev,[widgetDrag.id]:{...prev[widgetDrag.id],x:nx,y:ny}}));}
    function onUp(){setWidgetState(prev=>{const s=prev[widgetDrag.id];const snapped=snapW(s.x,s.y);const np={...prev,[widgetDrag.id]:{...s,...snapped}};const fin=np;updateData(d=>({...d,settings:{...(d.settings||{}),widgetState:fin}}));return fin;});setWidgetDrag(null);}
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
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
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[widgetResize]);

  const showToast     =useCallback((msg)=>{setToast(msg);setTimeout(()=>setToast(null),2500);},[]);
  const saveData      =useCallback(async(d)=>{if(user)await db.set("user:"+user+":data",d);},[user]);
  const updateData    =useCallback((patch)=>{setData(prev=>{const next=typeof patch==="function"?patch(prev):{...prev,...patch};saveData(next);return next;});},[saveData]);
  const updateSettings=useCallback((patch)=>{updateData(prev=>({...prev,settings:{...(prev.settings||{}),...patch}}));},[updateData]);
  const handleCustomWallpaper=useCallback(async(url)=>{setCustomWp(url);await db.set("user:"+user+":wpimg",url);updateSettings({wallpaper:"custom"});showToast("Custom wallpaper set ✓");},[user,updateSettings,showToast]);
  const focusWin=useCallback((id)=>{setMaxZ(z=>{const nz=z+1;setWins(ws=>ws.map(w=>w.id===id?{...w,z:nz}:w));return nz;});},[]);
  const openApp=useCallback((appId)=>{setMenuOpen(false);setMaxZ(z=>{const nz=z+1;setWins(ws=>{const ex=ws.find(w=>w.app===appId);if(ex)return ws.map(w=>w.id===ex.id?{...w,z:nz,state:w.state==="minimized"?"normal":w.state}:w);const n=ws.length%6;const sz=DEFAULT_SIZES[appId]||{w:520,h:480};return[...ws,{id:Date.now()+Math.random(),app:appId,z:nz,x:120+n*28,y:36+n*22,width:sz.w,height:sz.h,state:"normal",prevBounds:null}];});return nz;});},[]);
  function startDrag(e,winId){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"move",winId,ox:e.clientX-w.x,oy:e.clientY-w.y});focusWin(winId);}}
  function startResize(e,winId,edge){if(e.button!==0)return;e.preventDefault();const w=winsRef.current.find(w=>w.id===winId);if(w){setDrag({type:"resize",winId,edge,sx:e.clientX,sy:e.clientY,wx:w.x,wy:w.y,ww:w.width,wh:w.height});focusWin(winId);}}
  function closeWin(id){setWins(ws=>ws.filter(w=>w.id!==id));}
  function minimizeWin(id){setWins(ws=>ws.map(w=>w.id===id?{...w,state:w.state==="minimized"?"normal":"minimized"}:w));}
  function maximizeWin(id){setWins(ws=>ws.map(w=>{if(w.id!==id)return w;if(w.state==="maximized")return{...w,state:"normal",...(w.prevBounds||{}),prevBounds:null};return{...w,state:"maximized",prevBounds:{x:w.x,y:w.y,width:w.width,height:w.height}};}));}
  function onIconMouseDown(e,appId,allIcons){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const idx=allIcons.findIndex(a=>a.id===appId);const pos=iconPos[appId]||defaultIconPos(idx);setIconDrag({id:appId,ox:e.clientX-pos.x,oy:e.clientY-pos.y,user,allIcons:[...allIcons]});}
  function onWidgetDragStart(e,id){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const s=widgetState[id]||DEFAULT_WIDGET_STATE[id];setWidgetDrag({id,ox:e.clientX-s.x,oy:e.clientY-s.y});}
  function onWidgetResizeStart(e,id,edge){if(e.button!==0)return;e.stopPropagation();e.preventDefault();const s=widgetState[id]||DEFAULT_WIDGET_STATE[id];setWidgetResize({id,edge,sx:e.clientX,sy:e.clientY,x0:s.x,y0:s.y,w0:s.w,h0:s.h});}
  function closeWidget(id){updateSettings({widgets:{...widgets,[id]:false}});}

  async function handleAuth(){
    const u=uname.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");const p=pass.trim();
    if(!u||!p){setAuthErr("All fields required.");return;}if(u.length<3){setAuthErr("Username needs 3+ characters.");return;}
    setBusy(true);setAuthErr("");
    if(mode==="register"){
      const ex=await db.get("user:"+u+":pw");if(ex!==null){setAuthErr("Username taken.");setBusy(false);return;}
      await db.set("user:"+u+":pw",p);const init={notes:[],tasks:[],wallpaper:"nova",bio:"",joined:Date.now(),settings:{},installedApps:[]};
      await db.set("user:"+u+":data",init);setUser(u);setData(init);setIconPos({});setWidgetState(DEFAULT_WIDGET_STATE);setScreen("desktop");
    }else{
      const stored=await db.get("user:"+u+":pw");if(stored===null){setAuthErr("Account not found.");setBusy(false);return;}
      if(stored!==p){setAuthErr("Incorrect password.");setBusy(false);return;}
      const d=await db.get("user:"+u+":data");const savedIconPos=await db.get("user:"+u+":iconpos");
      setUser(u);setData(d||{notes:[],tasks:[],wallpaper:"nova",bio:"",joined:Date.now(),settings:{},installedApps:[]});
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
  if(screen==="boot")return(<div style={{width:"100%",height:"100vh",background:"#07080f",display:"flex",flexDirection:"column",justifyContent:"center",padding:"10vh 12%"}}><style>{CSS}</style><div style={{fontFamily:FFB,fontWeight:700,fontSize:66,letterSpacing:4,color:"#fff",marginBottom:4,lineHeight:1}}>NOVA</div><div style={{fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.22)",letterSpacing:5,marginBottom:46}}>OPERATING SYSTEM  ·  v3.5</div>{bootLines.map((l,i)=><div key={i} style={{fontFamily:FFM,fontSize:12,color:l.includes("ready")?"#4f9eff":"rgba(255,255,255,0.42)",marginBottom:5,animation:"boot-in 0.13s ease-out"}}>{l.includes("OK")?<>{l.replace("... OK","")}... <span style={{color:"#4cef90"}}>OK</span></>:l}</div>)}</div>);

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if(screen==="login")return(<div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden"}}><style>{CSS}</style><NovaBg/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"rgba(8,10,22,0.86)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:16,padding:"44px 40px",width:376,boxShadow:"0 40px 100px rgba(0,0,0,0.6)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,"+DEFAULT_AC+",transparent)"}}/><div style={{fontFamily:FFB,fontWeight:700,fontSize:38,color:"#fff",textAlign:"center",letterSpacing:4,marginBottom:4}}>NOVA</div><div style={{fontFamily:FF,fontSize:11,color:"rgba(255,255,255,0.22)",textAlign:"center",letterSpacing:4,marginBottom:36}}>OPERATING SYSTEM  ·  v3.5</div><div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.09)",marginBottom:24}}>{["login","register"].map(m=><button key={m} className="lt" onClick={()=>{setMode(m);setAuthErr("");}} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:mode===m?"2px solid "+DEFAULT_AC:"2px solid transparent",cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:12,letterSpacing:1,color:mode===m?DEFAULT_AC:"rgba(255,255,255,0.28)",transition:"color 0.15s"}}>{m==="login"?"SIGN IN":"REGISTER"}</button>)}</div><input style={{...INP,marginBottom:11}} placeholder="Username" value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} autoFocus/><input style={INP} type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/><button className="ls" disabled={busy} onClick={handleAuth} style={{width:"100%",padding:"12px",background:fill(DEFAULT_AC),border:"1px solid "+bdr(DEFAULT_AC),borderRadius:8,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:14,letterSpacing:1,color:"#fff",marginTop:14,transition:"opacity 0.15s"}}>{busy?"AUTHENTICATING…":mode==="login"?"SIGN IN →":"CREATE ACCOUNT →"}</button>{authErr&&<div style={{color:"#ff7878",fontFamily:FF,fontSize:13,textAlign:"center",marginTop:12}}>⚠ {authErr}</div>}<div style={{marginTop:20,fontFamily:FF,fontStyle:"italic",fontSize:11,color:"rgba(255,255,255,0.14)",textAlign:"center"}}>Don't reuse real passwords — demo auth only.</div></div></div></div>);

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  return(
    <div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",cursor:dragCursor,fontSize:largeFnt?15:13}}>
      <style>{CSS}</style>
      <Wallpaper id={wpId} customUrl={customWp}/>
      {toast&&<div style={{position:"fixed",top:14,right:14,zIndex:99999,padding:"10px 18px",background:"rgba(8,10,22,0.97)",border:"1px solid "+AC,borderRadius:9,fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff",animation:"toast-in 0.17s ease-out",boxShadow:"0 8px 36px rgba(0,0,0,0.6)"}}>{toast}</div>}

      {/* Desktop widgets */}
      {Object.keys(WIDGET_CONFIGS).map(id=>{
        if(!widgets[id])return null;
        const s=widgetState[id]||DEFAULT_WIDGET_STATE[id]||{x:200,y:200,w:240,h:140};
        return(
          <WidgetShell key={id} id={id} state={s} onDragStart={onWidgetDragStart} onResizeStart={onWidgetResizeStart} onClose={()=>closeWidget(id)}>
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
          <div key={app.id} style={{position:"absolute",left:pos.x,top:pos.y,width:ICON_W,zIndex:isDrg?500:2,cursor:isDrg?"grabbing":"grab",userSelect:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:9,background:"rgba(0,0,0,0.1)",border:"1px solid transparent",transition:isDrg?"none":"background 0.12s",boxShadow:isDrg?"0 8px 32px rgba(0,0,0,0.6)":"none"}}
            className={isDrg?"":"di"} title={app.desc} onMouseDown={e=>onIconMouseDown(e,app.id,allDesktopIcons)} onDoubleClick={launch}>
            <div style={{pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.7))"}}>
              <AppIconDisplay app={app} size={28}/>
            </div>
            <span style={{fontFamily:FF,fontWeight:600,fontSize:10,color:"#fff",textAlign:"center",lineHeight:1.2,textShadow:"0 1px 4px #000",pointerEvents:"none"}}>{app.label}</span>
          </div>
        );
      })}

      {/* Start menu */}
      {menuOpen&&(<div ref={menuRef} style={{position:"fixed",bottom:TASKBAR_H,left:0,width:360,background:"rgba(9,11,24,0.97)",backdropFilter:"blur(30px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"0 14px 0 0",boxShadow:"6px -6px 48px rgba(0,0,0,0.65)",zIndex:9998,display:"flex",flexDirection:"column",animation:"menu-up 0.15s ease-out",overflow:"hidden"}}>
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
          <div style={{flex:1}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:"#fff"}}>@{user}</div><div style={{fontFamily:FF,fontSize:10,color:"rgba(255,255,255,0.3)"}}>Nova OS v3.5</div></div>
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
          <div key={win.id} onClick={()=>focusWin(win.id)} style={{...winStyle,background:"rgba(10,12,26,0.93)",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 "+(isDrg?30:15)+"px "+(isDrg?90:50)+"px rgba(0,0,0,"+(isDrg?0.8:0.6)+")",display:"flex",flexDirection:"column",animation:"win-in 0.15s ease-out",backdropFilter:"blur("+winBlur+"px)",transition:"box-shadow 0.12s",overflow:"hidden"}}>
            {!isMax&&<ResizeHandles winId={win.id} onStartResize={startResize}/>}
            <div onMouseDown={e=>!isMax&&startDrag(e,win.id)} style={{height:38,display:"flex",alignItems:"center",padding:"0 8px 0 12px",gap:9,background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.07)",borderRadius:isMax?"0":"12px 12px 0 0",cursor:isMax?"default":isDrg?"grabbing":"grab",userSelect:"none",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={16}/></div>
              <span style={{flex:1,fontFamily:FFB,fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.88)"}}>{app?.label}</span>
              <button className="wn" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();minimizeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(255,255,255,0.5)",transition:"background 0.12s",flexShrink:0}}>–</button>
              <button className="wm" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();maximizeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"rgba(255,255,255,0.5)",transition:"background 0.12s",flexShrink:0}}>{isMax?"❐":"⬜"}</button>
              <button className="wx" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();closeWin(win.id);}} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"rgba(255,255,255,0.5)",transition:"background 0.12s, color 0.12s",flexShrink:0}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:18,minWidth:0}}>
              {win.app==="notes"    &&<NotesApp    data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="tasks"    &&<TasksApp    data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="files"    &&<FilesApp    data={data} updateData={updateData} showToast={showToast}/>}
              {win.app==="paint"    &&<PaintApp    showToast={showToast} AC={AC}/>}
              {win.app==="browser"  &&<BrowserApp  AC={AC}/>}
              {win.app==="snake"    &&<SnakeApp    AC={AC}/>}
              {win.app==="2048"     &&<Game2048App AC={AC}/>}
              {win.app==="store"    &&<StoreApp    data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
              {win.app==="terminal" &&<TerminalApp user={user} AC={AC}/>}
              {win.app==="settings" &&<SettingsApp user={user} data={data} updateSettings={updateSettings} showToast={showToast} AC={AC} onCustomWallpaper={handleCustomWallpaper}/>}
              {win.app==="profile"  &&<ProfileApp  user={user} data={data} updateData={updateData} showToast={showToast} AC={AC}/>}
            </div>
          </div>
        );
      })}

      {/* Taskbar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:TASKBAR_H,background:"rgba(9,11,24,0.92)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",padding:"0 10px",gap:5,zIndex:9999}}>
        <button className="sb" onClick={()=>{setMenuOpen(o=>!o);setMenuSrch("");}} style={{width:38,height:38,borderRadius:10,background:menuOpen?fill(AC):"rgba(255,255,255,0.07)",border:menuOpen?"1px solid "+bdr(AC):"1px solid rgba(255,255,255,0.09)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",fontSize:17,color:menuOpen?AC:"rgba(255,255,255,0.7)"}}>◈</button>
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.09)",margin:"0 3px"}}/>
        {wins.map(win=>{const app=APPS.find(a=>a.id===win.app);const isMin=win.state==="minimized";const isTop=wins.length>0&&win.z===Math.max(...wins.map(w=>w.z));return(<button key={win.id} className="tb" onClick={()=>{if(isMin){setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"normal"}:w));focusWin(win.id);}else if(isTop){setWins(ws=>ws.map(w=>w.id===win.id?{...w,state:"minimized"}:w));}else focusWin(win.id);}} style={{height:36,padding:"0 10px",background:isTop&&!isMin?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,cursor:"pointer",fontFamily:FF,fontSize:12,fontWeight:600,color:isMin?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.82)",whiteSpace:"nowrap",transition:"all 0.12s",display:"flex",alignItems:"center",gap:6,position:"relative"}}><div style={{pointerEvents:"none",display:"flex",alignItems:"center"}}><AppIconDisplay app={{id:win.app,icon:app?.icon||"📦"}} size={14}/></div><span>{app?.label}</span>{!isMin&&<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:isTop?18:6,height:2,borderRadius:2,background:AC,transition:"width 0.2s"}}/>}</button>);})}
        <div style={{flex:1}}/>
        <div style={{fontFamily:FFB,fontWeight:600,fontSize:12,color:AC,cursor:"pointer"}} onClick={()=>openApp("profile")}>@{user}</div>
        <div style={{width:1,height:20,background:"rgba(255,255,255,0.09)"}}/>
        <button className="sb" onClick={()=>openApp("settings")} style={{width:30,height:30,borderRadius:7,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"rgba(255,255,255,0.45)",transition:"background 0.12s"}}>⚙️</button>
        <div style={{textAlign:"right",cursor:"default"}}><div style={{fontFamily:FFM,fontWeight:500,fontSize:12,color:"rgba(255,255,255,0.78)"}}>{fmtTime(tick)}</div><div style={{fontFamily:FF,fontSize:9,color:"rgba(255,255,255,0.35)"}}>{fmtDate(tick)}</div></div>
      </div>
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

function FilesApp({data,updateData,showToast}){
  const [path,setPath]=useState("home");const [preview,setPreview]=useState(null);
  const notes=data?.notes||[];const tasks=data?.tasks||[];
  if(path==="home")return(<div style={{width:"100%",fontFamily:FF}}><div style={SEC}>File Explorer</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{[{id:"notes",icon:"📄",label:"Notes",count:notes.length},{id:"tasks",icon:"📋",label:"Tasks",count:tasks.length}].map(f=>(<div key={f.id} className="fr" onClick={()=>setPath(f.id)} style={{display:"flex",alignItems:"center",gap:11,padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer",transition:"background 0.12s"}}><span style={{fontSize:26}}>{f.icon}</span><div><div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)"}}>{f.label}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>{f.count} file{f.count!==1?"s":""}</div></div></div>))}</div></div>);
  if(path==="notes")return(<div style={{width:"100%",fontFamily:FF}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><button onClick={()=>{setPath("home");setPreview(null);}} style={{padding:"4px 11px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,255,255,0.55)"}}>← Back</button><div style={SEC}>📄 Notes</div></div>{notes.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:12,fontStyle:"italic"}}>No notes yet.</div>}{notes.map(n=>(<div key={n.id} className="fr" onClick={()=>setPreview(n)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",marginBottom:4,background:preview?.id===n.id?"rgba(79,158,255,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(preview?.id===n.id?"rgba(79,158,255,0.35)":"rgba(255,255,255,0.07)"),borderRadius:7,cursor:"pointer",transition:"background 0.12s"}}><span style={{fontSize:14}}>📄</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.28)",fontFamily:FFM}}>{new Date(n.ts).toLocaleDateString()}</div></div><button className="dl" onClick={e=>{e.stopPropagation();updateData(p=>({...p,notes:p.notes.filter(x=>x.id!==n.id)}));if(preview?.id===n.id)setPreview(null);showToast("Deleted");}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.28)",fontSize:12,padding:0,transition:"color 0.12s",flexShrink:0}}>✕</button></div>))}{preview&&<div style={{marginTop:12,padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8}}><div style={{fontWeight:600,fontSize:14,color:"rgba(255,255,255,0.92)",marginBottom:7}}>{preview.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.52)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{preview.body||"(no content)"}</div></div>}</div>);
  return(<div style={{width:"100%",fontFamily:FF}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><button onClick={()=>setPath("home")} style={{padding:"4px 11px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:10,color:"rgba(255,255,255,0.55)"}}>← Back</button><div style={SEC}>📋 Tasks</div></div>{tasks.length===0&&<div style={{color:"rgba(255,255,255,0.2)",fontSize:12,fontStyle:"italic"}}>No tasks yet.</div>}{tasks.map(t=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,opacity:t.done?0.42:1}}><span style={{fontSize:12}}>{t.done?"✅":"⬜"}</span><span style={{flex:1,fontSize:12,color:"rgba(255,255,255,0.85)",textDecoration:t.done?"line-through":"none"}}>{t.text}</span><span style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.22)"}}>{t.done?"done":"open"}</span></div>))}</div>);
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
  return(<div style={{width:"100%",display:"flex",flexDirection:"column",gap:10,fontFamily:FF}}><div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}><TBtn id="pen" lbl="✏️ Pen"/><TBtn id="eraser" lbl="⬜ Eraser"/><div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}><span style={{fontSize:10,fontFamily:FFB,fontWeight:600,letterSpacing:1,color:"rgba(255,255,255,0.3)"}}>SIZE</span><input type="range" min={2} max={60} value={size} onChange={e=>setSize(+e.target.value)} style={{width:80,accentColor:AC}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.5)",width:20}}>{size}</span></div><div style={{flex:1}}/><button onClick={()=>{const c=canvasRef.current;const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,CW,CH);}} style={{padding:"6px 11px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.55)"}}>Clear</button><button onClick={()=>{const a=document.createElement("a");a.download="nova-paint.png";a.href=canvasRef.current.toDataURL();a.click();showToast("Saved ✓");}} style={{padding:"6px 11px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:AC}}>⬇ Save</button></div><canvas ref={canvasRef} width={CW} height={CH} style={{width:"100%",height:"auto",borderRadius:7,cursor:tool==="eraser"?"cell":"crosshair",display:"block",border:"1px solid rgba(255,255,255,0.1)"}} onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}/><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>{PAINT_COLORS.map(c=><div key={c} className="ps" onClick={()=>{setColor(c);setTool("pen");}} style={{width:22,height:22,borderRadius:5,background:c,cursor:"pointer",border:(color===c&&tool==="pen")?"2.5px solid #fff":"2px solid rgba(255,255,255,0.14)",transition:"transform 0.1s",boxSizing:"border-box"}}/>)}<input type="color" value={color} onChange={e=>{setColor(e.target.value);setTool("pen");}} style={{width:26,height:26,borderRadius:5,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",background:"none",marginLeft:4}}/></div></div>);
}

function BrowserApp({AC}){
  const [bar,setBar]=useState("");const [view,setView]=useState("home");const [results,setResults]=useState(null);const [frameUrl,setFrameUrl]=useState("");const [loading,setLoading]=useState(false);const [hist,setHist]=useState([]);const [hIdx,setHIdx]=useState(-1);
  function browse(url){const full=url.startsWith("http")?url:"https://"+url;const nh=[...hist.slice(0,hIdx+1),full];setHist(nh);setHIdx(nh.length-1);setFrameUrl(full);setBar(full);setView("browse");}
  async function novaSearch(q){setLoading(true);setView("results");setResults(null);try{const[d,w]=await Promise.allSettled([fetch("https://api.duckduckgo.com/?q="+encodeURIComponent(q)+"&format=json&no_html=1&skip_disambig=1").then(r=>r.json()),fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(q)+"&format=json&origin=*&srlimit=7").then(r=>r.json())]);setResults({q,ddg:d.status==="fulfilled"?d.value:null,wiki:w.status==="fulfilled"?w.value:null});}catch{setResults({q,ddg:null,wiki:null});}setLoading(false);}
  function go(i){const q=(i||bar).trim();if(!q)return;if(isUrl(q))browse(q);else novaSearch(q);}
  function back(){if(hIdx>0){const i=hIdx-1;setHIdx(i);setFrameUrl(hist[i]);setBar(hist[i]);setView("browse");}}
  function fwd(){if(hIdx<hist.length-1){const i=hIdx+1;setHIdx(i);setFrameUrl(hist[i]);setBar(hist[i]);setView("browse");}}
  const Nav=<BrowserNav bar={bar} setBar={setBar} onGo={()=>go()} onBack={back} onFwd={fwd} canBack={hIdx>0} canFwd={hIdx<hist.length-1} AC={AC}/>;
  const Bkm=(<div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap"}}>{BOOKMARKS.map(b=><button key={b.url} className="bp" onClick={()=>browse(b.url)} style={{padding:"4px 11px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.65)",transition:"background 0.12s"}}>{b.label}</button>)}<button className="bp" onClick={()=>window.open("https://www.bing.com","_blank")} style={{padding:"4px 11px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.65)"}}>Bing ↗</button><button className="bp" onClick={()=>window.open("https://www.google.com","_blank")} style={{padding:"4px 11px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,cursor:"pointer",fontFamily:FF,fontWeight:500,fontSize:11,color:"rgba(255,255,255,0.65)"}}>Google ↗</button></div>);
  if(view==="home")return(<div style={{width:"100%",fontFamily:FF}}>{Nav}{Bkm}<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:260,gap:14,border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,background:"rgba(255,255,255,0.02)"}}><div style={{fontSize:44}}>🌐</div><div style={{fontFamily:FFB,fontWeight:700,fontSize:18,color:"rgba(255,255,255,0.55)"}}>Nova Browser</div><div style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",lineHeight:1.7,maxWidth:380}}>Search with Nova Search (DDG + Wikipedia) or enter a URL.</div></div></div>);
  if(view==="browse")return(<div style={{width:"100%",fontFamily:FF}}>{Nav}{Bkm}<iframe src={frameUrl} title="browser" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style={{width:"100%",height:"calc(100% - 80px)",minHeight:340,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"#fff",display:"block"}}/></div>);
  const ddg=results?.ddg;const wiki=results?.wiki;const ddgT=(ddg?.RelatedTopics||[]).filter(t=>t.FirstURL&&t.Text).slice(0,7);const wikiH=wiki?.query?.search||[];
  return(<div style={{width:"100%",fontFamily:FF}}>{Nav}{Bkm}{loading?(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:280,gap:12,flexDirection:"column"}}><div style={{width:28,height:28,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:AC,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Searching…</div></div>):(<div style={{overflowY:"auto"}}><div style={{...SEC,marginBottom:10}}>Results for "{results?.q}"</div>{ddg?.AbstractText&&<div style={{padding:"13px 14px",marginBottom:10,background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:9}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:13,color:AC,marginBottom:5}}>{ddg.Heading}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.65}}>{ddg.AbstractText}</div>{ddg.AbstractURL&&<a href={ddg.AbstractURL} target="_blank" rel="noreferrer" style={{fontSize:10,color:AC,opacity:0.7,marginTop:6,display:"inline-block",fontFamily:FFM}}>Source ↗</a>}</div>}{wikiH.length>0&&<><div style={SEC}>Wikipedia</div>{wikiH.map(h=><div key={h.pageid} className="sr" onClick={()=>browse("https://en.wikipedia.org/wiki/"+encodeURIComponent(h.title))} style={{padding:"10px 12px",marginBottom:5,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer",transition:"background 0.12s"}}><div style={{fontWeight:600,fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:3}}>{h.title}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.55}}>{h.snippet?h.snippet.replace(/<[^>]*>/g,"")+"…":""}</div></div>)}</>}{ddgT.length>0&&<><div style={{...SEC,marginTop:10}}>Related</div>{ddgT.map((t,i)=><div key={i} className="sr" onClick={()=>browse(t.FirstURL)} style={{padding:"9px 12px",marginBottom:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,cursor:"pointer",transition:"background 0.12s"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.55}}>{t.Text}</div><div style={{fontSize:9,fontFamily:FFM,color:"rgba(255,255,255,0.2)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.FirstURL}</div></div>)}</>}{!ddg?.AbstractText&&wikiH.length===0&&ddgT.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic"}}>No results found.</div>}</div>)}</div>);
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

function StoreApp({data,updateData,showToast,AC}){
  const [cat,setCat]=useState("All");const [search,setSearch]=useState("");
  const installed=data?.installedApps||[];
  const filtered=STORE_CATALOG.filter(a=>{if(cat!=="All"&&a.cat!==cat)return false;if(search&&!a.name.toLowerCase().includes(search.toLowerCase())&&!a.desc.toLowerCase().includes(search.toLowerCase()))return false;return true;});
  function toggleInstall(appId){const isIn=installed.includes(appId);updateData(p=>({...p,installedApps:isIn?p.installedApps.filter(id=>id!==appId):[...(p.installedApps||[]),appId]}));showToast(isIn?"App removed from desktop":"Added to desktop ✓");}
  return(<div style={{width:"100%",fontFamily:FF}}><div style={{marginBottom:16}}><div style={{fontFamily:FFB,fontWeight:700,fontSize:22,color:"#fff",marginBottom:4}}>🏪 Nova Store</div><div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Icons via Clearbit · ✓ In-App opens in Nova Browser · ↗ New Tab opens externally.</div></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search apps…" style={{...INP,marginBottom:12}}/><div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{STORE_CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"5px 13px",background:cat===c?fill(AC):"rgba(255,255,255,0.06)",border:"1px solid "+(cat===c?bdr(AC):"rgba(255,255,255,0.1)"),borderRadius:20,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:cat===c?AC:"rgba(255,255,255,0.55)",transition:"all 0.12s"}}>{c}</button>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>{filtered.map(app=>{const isIn=installed.includes(app.id);return(<div key={app.id} className="sc" style={{padding:"14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,transition:"background 0.12s"}}><div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}><div style={{width:44,height:44,borderRadius:10,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}><StoreIcon domain={app.domain} fallback={app.icon} size={32}/></div><div style={{flex:1,minWidth:0}}><div style={{fontFamily:FFB,fontWeight:600,fontSize:14,color:"rgba(255,255,255,0.92)",marginBottom:2}}>{app.name}</div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:9,fontFamily:FFM,padding:"2px 6px",background:app.newTab?"rgba(255,180,0,0.12)":"rgba(79,200,100,0.12)",border:"1px solid "+(app.newTab?"rgba(255,180,0,0.3)":"rgba(79,200,100,0.3)"),borderRadius:4,color:app.newTab?"rgba(255,200,80,0.9)":"rgba(100,220,120,0.9)"}}>{app.badge}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{app.cat}</span></div></div></div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.55,marginBottom:12}}>{app.desc}</div><div style={{display:"flex",gap:7}}><button onClick={()=>toggleInstall(app.id)} style={{flex:1,padding:"7px",background:isIn?"rgba(255,80,80,0.1)":"rgba(255,255,255,0.06)",border:"1px solid "+(isIn?"rgba(255,80,80,0.3)":"rgba(255,255,255,0.12)"),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:isIn?"rgba(255,130,130,0.9)":"rgba(255,255,255,0.6)"}}>{isIn?"– Remove":"+ Desktop"}</button><button onClick={()=>window.open(app.url,"_blank")} style={{flex:1,padding:"7px",background:fill(AC),border:"1px solid "+bdr(AC),borderRadius:6,cursor:"pointer",fontFamily:FFB,fontWeight:600,fontSize:11,color:AC}}>Launch ↗</button></div></div>);})}  {filtered.length===0&&<div style={{gridColumn:"span 2",color:"rgba(255,255,255,0.2)",fontFamily:FF,fontStyle:"italic",fontSize:13,textAlign:"center",padding:"40px 0"}}>No apps match your search.</div>}</div>{installed.length>0&&<div style={{marginTop:16,padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,fontFamily:FF,fontSize:12,color:"rgba(255,255,255,0.4)"}}>{installed.length} app{installed.length!==1?"s":""} on desktop · Double-click to launch</div>}</div>);
}

function TerminalApp({user,AC}){
  const [lines,setLines]=useState([{t:"out",v:"NOVA Terminal v3.5.0"},{t:"out",v:"Session: "+user+" — "+new Date().toLocaleString()},{t:"out",v:'Type "help" for commands.'},{t:"gap"}]);
  const [cmd,setCmd]=useState("");const [hist,setHist]=useState([]);const [hIdx,setHIdx]=useState(-1);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[lines]);
  const CMDS={help:()=>["Commands: help, whoami, date, echo <text>, version, sysinfo, ls, neofetch, clear"],whoami:()=>[user],date:()=>[new Date().toLocaleString()],version:()=>["NOVA OS v3.5.0 — Nova Systems Inc."],sysinfo:()=>["CPU: Nova Virtual Core™","RAM: 8.0 GB","Storage: Firebase Firestore","Resolution: "+window.innerWidth+"x"+window.innerHeight,"Uptime: "+Math.floor(performance.now()/1000)+"s"],ls:()=>["notes/ tasks/ files/ paint/ browser/ snake/ 2048/ store/ terminal/ settings/"],neofetch:()=>[" ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ "," ████╗  ██║██╔═══██╗██║   ██║██╔══██╗"," ██╔██╗ ██║██║   ██║██║   ██║███████║"," ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║"," ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║","OS: Nova v3.5  User: "+user,"Widgets: Clock·Weather·Notes·Tasks·Calendar·SysInfo"],echo:args=>[args.join(" ")||"(empty)"],clear:()=>"__clear__"};
  function run(){const raw=cmd.trim();if(!raw)return;const parts=raw.split(" ");const c=parts[0].toLowerCase();const args=parts.slice(1);setHist(h=>[raw,...h]);setHIdx(-1);setCmd("");const nl=[...lines,{t:"in",v:raw}];const h=CMDS[c];if(!h){nl.push({t:"err",v:c+': not found. Try "help".'});}else{const r=h(args);if(r==="__clear__"){setLines([]);return;}r.forEach(v=>nl.push({t:"out",v}));}nl.push({t:"gap"});setLines(nl);}
  function onKey(e){if(e.key==="Enter"){run();return;}if(e.key==="ArrowUp"){const i=Math.min(hIdx+1,hist.length-1);setHIdx(i);if(hist[i])setCmd(hist[i]);}if(e.key==="ArrowDown"){const i=Math.max(hIdx-1,-1);setHIdx(i);setCmd(i===-1?"":(hist[i]||""));}}
  return(<div style={{width:"100%",fontFamily:FFM}}><div style={{background:"#030407",borderRadius:8,padding:"13px 15px",height:"100%",minHeight:280,overflowY:"auto",border:"1px solid rgba(255,255,255,0.07)"}}>{lines.map((l,i)=><div key={i} style={{color:l.t==="in"?AC:l.t==="err"?"#ff7878":"rgba(180,210,255,0.58)",fontSize:12,marginBottom:l.t==="gap"?5:2,minHeight:l.t==="gap"?4:undefined,whiteSpace:"pre"}}>{l.t==="in"?"$ "+l.v:l.t==="gap"?null:l.v}</div>)}<div style={{display:"flex",alignItems:"center"}}><span style={{color:"#4cef90",marginRight:7,fontSize:12}}>$</span><input value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={onKey} autoFocus style={{flex:1,background:"none",border:"none",outline:"none",color:AC,fontFamily:FFM,fontSize:12,caretColor:AC}}/></div><div ref={endRef}/></div></div>);
}

function SettingsApp({user,data,updateSettings,showToast,AC,onCustomWallpaper}){
  const settings=data?.settings||{};const fileRef=useRef(null);
  function handleUpload(e){const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){showToast("File too large (max 8MB)");return;}const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const canvas=document.createElement("canvas");const MAX=900;const ratio=Math.min(MAX/img.width,MAX/img.height,1);canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);onCustomWallpaper(canvas.toDataURL("image/jpeg",0.72));};img.src=ev.target.result;};reader.readAsDataURL(file);e.target.value="";}
  const wpId=settings.wallpaper||data?.wallpaper||"nova";
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
      <div style={{...SEC,marginTop:22}}>Account</div>
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

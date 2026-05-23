// SVG-based wallpaper components + the Wallpaper router that picks which one
// to render. Gradient-only wallpapers (night/sakura/forest/slate) fall through
// the router and use their `grad` value from WALLPAPERS in constants.js.
//
// 5.2 made Mesh the system default; Aurora and the others remain selectable.

import { WALLPAPERS } from "./constants.js";

function NovaBg() {
  return (
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
      <rect width="1440" height="900" fill="#020510"/>
      <g filter="url(#nblur)">
        <rect width="1440" height="900" fill="url(#n1)"/>
        <rect width="1440" height="900" fill="url(#n2)"/>
        <rect width="1440" height="900" fill="url(#n3)"/>
        <rect width="1440" height="900" fill="url(#n4)"/>
        <rect width="1440" height="900" fill="url(#n5)"/>
        <rect width="1440" height="900" fill="url(#n6)"/>
      </g>
      <rect x="0" y="420" width="1440" height="1" fill="rgba(139,92,246,0.15)"/>
      {[...Array(80)].map((_, i) => {
        const x = (i*173.7+31)%1440, y = (i*97.3+17)%900, r = i%5===0 ? 1.8 : i%3===0 ? 1.2 : 0.7;
        return <circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.55)"/>;
      })}
    </svg>
  );
}

function BlissBg() {
  return (<svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1b5c90"/><stop offset="30%" stopColor="#3990cc"/><stop offset="65%" stopColor="#6ab6e8"/><stop offset="100%" stopColor="#a4d4f0"/></linearGradient><linearGradient id="ghb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#478c18"/><stop offset="100%" stopColor="#1e5007"/></linearGradient><linearGradient id="ghm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#57b820"/><stop offset="100%" stopColor="#27680e"/></linearGradient><linearGradient id="ghf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cca2c"/><stop offset="100%" stopColor="#337a14"/></linearGradient><linearGradient id="gfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d8814"/><stop offset="100%" stopColor="#194807"/></linearGradient></defs><rect width="1440" height="900" fill="url(#gsky)"/>{[[310,165,150,50],[278,158,100,37],[350,155,85,40],[970,128,120,40],[940,121,78,29],[1170,200,130,44]].map(([cx,cy,rx,ry],i)=><ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={"rgba(255,255,255,"+(0.42+(i%3)*0.09)+")"}/>)}<path d="M0 590 Q200 450 430 530 Q630 610 860 480 Q1040 365 1210 445 Q1350 505 1440 460 L1440 900 L0 900Z" fill="url(#ghb)"/><path d="M0 645 Q170 515 380 585 Q570 655 775 540 Q955 425 1155 505 Q1305 565 1440 522 L1440 900 L0 900Z" fill="url(#ghm)"/><path d="M-10 725 Q70 640 190 658 Q310 678 440 730 Q615 796 808 682 Q955 598 1090 628 Q1230 658 1360 618 L1460 610 L1460 900 L-10 900Z" fill="url(#ghf)"/><path d="M0 818 Q370 778 720 795 Q1020 810 1440 778 L1440 900 L0 900Z" fill="url(#gfg)"/></svg>);
}

// Aurora: vertical jewel-toned aurora streaks against a deep purple base, with
// a magenta horizon glow at the bottom. Default wallpaper for NOVA OS 4.1.
function AuroraBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="au1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0218" stopOpacity="0"/><stop offset="28%" stopColor="#10b981" stopOpacity="0.7"/><stop offset="58%" stopColor="#06b6d4" stopOpacity="0.5"/><stop offset="100%" stopColor="#0a0218" stopOpacity="0"/></linearGradient>
        <linearGradient id="au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0218" stopOpacity="0"/><stop offset="32%" stopColor="#a855f7" stopOpacity="0.6"/><stop offset="68%" stopColor="#ec4899" stopOpacity="0.4"/><stop offset="100%" stopColor="#0a0218" stopOpacity="0"/></linearGradient>
        <linearGradient id="au3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0218" stopOpacity="0"/><stop offset="38%" stopColor="#22d3ee" stopOpacity="0.55"/><stop offset="78%" stopColor="#3b82f6" stopOpacity="0.35"/><stop offset="100%" stopColor="#0a0218" stopOpacity="0"/></linearGradient>
        <radialGradient id="auhz" cx="50%" cy="95%" r="55%"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.55"/><stop offset="60%" stopColor="#1e1b4b" stopOpacity="0.18"/><stop offset="100%" stopColor="#080318" stopOpacity="0"/></radialGradient>
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
      {[...Array(55)].map((_, i) => {
        const x=(i*191.3+47)%1440, y=(i*113.7+29)%900, r=i%6===0?1.5:i%3===0?1:0.6;
        const op=0.32+(i%4)*0.13;
        return <circle key={i} cx={x} cy={y} r={r} fill={"rgba(255,255,255,"+op+")"}/>;
      })}
    </svg>
  );
}

// Mesh: clean, modern multi-blob gradient. Designed to feel like the
// landing-page wallpapers of Linear/Vercel/Stripe — minimal, premium,
// large soft color fields without busy texture. Added in 5.2, default in 5.2+.
function MeshBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="me1" cx="20%" cy="22%" r="55%"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.9"/><stop offset="55%" stopColor="#4338ca" stopOpacity="0.25"/><stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/></radialGradient>
        <radialGradient id="me2" cx="80%" cy="18%" r="48%"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.8"/><stop offset="55%" stopColor="#be185d" stopOpacity="0.2"/><stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/></radialGradient>
        <radialGradient id="me3" cx="62%" cy="82%" r="52%"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.85"/><stop offset="55%" stopColor="#0e7490" stopOpacity="0.22"/><stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/></radialGradient>
        <radialGradient id="me4" cx="10%" cy="88%" r="42%"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.6"/><stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/></radialGradient>
        <radialGradient id="me5" cx="95%" cy="55%" r="35%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32"/><stop offset="100%" stopColor="#0a0a14" stopOpacity="0"/></radialGradient>
        <filter id="meblur"><feGaussianBlur stdDeviation="80"/></filter>
      </defs>
      <rect width="1440" height="900" fill="#0a0a14"/>
      <g filter="url(#meblur)">
        <rect width="1440" height="900" fill="url(#me1)"/>
        <rect width="1440" height="900" fill="url(#me2)"/>
        <rect width="1440" height="900" fill="url(#me3)"/>
        <rect width="1440" height="900" fill="url(#me4)"/>
        <rect width="1440" height="900" fill="url(#me5)"/>
      </g>
      <radialGradient id="mevign" cx="50%" cy="50%" r="75%"><stop offset="60%" stopColor="#000000" stopOpacity="0"/><stop offset="100%" stopColor="#000000" stopOpacity="0.35"/></radialGradient>
      <rect width="1440" height="900" fill="url(#mevign)"/>
    </svg>
  );
}

/**
 * Picks the right background component for the user's wallpaper choice.
 * "custom" requires a customUrl (the user-uploaded base64 image).
 * Empty / unknown id falls through to Mesh — the system default since 5.2.
 */
export function Wallpaper({ id, customUrl }) {
  if (id === "custom" && customUrl) {
    return <div style={{position:"absolute",inset:0,background:'url("'+customUrl+'") center/cover no-repeat'}}/>;
  }
  if (!id || id === "mesh")  return <MeshBg/>;
  if (id === "aurora")       return <AuroraBg/>;
  if (id === "nova")         return <NovaBg/>;
  if (id === "bliss")        return <BlissBg/>;
  const wp = WALLPAPERS[id];
  if (wp && wp.grad) {
    return <div style={{position:"absolute",inset:0,background:wp.grad}}/>;
  }
  return <MeshBg/>;
}

// Also export the individual backgrounds — the login screen uses MeshBg directly.
export { NovaBg, BlissBg, AuroraBg, MeshBg };

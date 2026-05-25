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

// v8.0 — Cascade: macOS-Big-Sur-style flowing ridges layered over a sky.
// Recolored to Mesh's actual saturated palette (not the earlier pastel
// approximation) so the wallpaper reads as warm/dim rather than bright.
// Each ridge now caps at Mesh's hex color and fades to a much darker
// matching base — gives the wallpaper Mesh's signature "rich color glow
// against deep shadow" feel applied to layered ridges instead of blobs.
//
// Mesh color order (back to front):
//   1. Indigo  #6366f1  — sky (deeper, dimmer)
//   2. Pink    #ec4899  — distant ridge
//   3. Cyan    #06b6d4  — mid ridge
//   4. Purple  #a855f7  — closer ridge
//   5. Amber   #f59e0b  — foreground mountain
function CascadeBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Sky — Mesh indigo at top, fading to deep navy at horizon. Dimmer
            than the previous pastel sky so the ridges pop against it. */}
        <linearGradient id="cas-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4338ca"/>
          <stop offset="50%"  stopColor="#312e81"/>
          <stop offset="100%" stopColor="#1e1b4b"/>
        </linearGradient>
        {/* Ridge 1 — pink. Crest = Mesh hex; base = deep wine.
            Saturated, dim, no pastel light bands. */}
        <linearGradient id="cas-r1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ec4899"/>
          <stop offset="40%"  stopColor="#be185d"/>
          <stop offset="100%" stopColor="#500724"/>
        </linearGradient>
        {/* Ridge 2 — cyan. Crest = Mesh hex; base = deep teal. */}
        <linearGradient id="cas-r2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#06b6d4"/>
          <stop offset="40%"  stopColor="#0e7490"/>
          <stop offset="100%" stopColor="#083344"/>
        </linearGradient>
        {/* Ridge 3 — purple. Crest = Mesh hex; base = deep violet. */}
        <linearGradient id="cas-r3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#a855f7"/>
          <stop offset="40%"  stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#3b0764"/>
        </linearGradient>
        {/* Ridge 4 — amber, foreground "Big Sur" mountain.
            Crest = Mesh hex; base = burnt umber for warmth at the base. */}
        <linearGradient id="cas-r4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f59e0b"/>
          <stop offset="40%"  stopColor="#d97706"/>
          <stop offset="100%" stopColor="#7c2d12"/>
        </linearGradient>
        {/* Sun-glow — dimmer than before so it doesn't bleach the scene. */}
        <radialGradient id="cas-sun" cx="68%" cy="38%" r="22%">
          <stop offset="0%"   stopColor="#fed7aa" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#fed7aa" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width="1440" height="900" fill="url(#cas-sky)"/>

      {/* Warm sun glow before the ridges so they cast over it */}
      <rect width="1440" height="900" fill="url(#cas-sun)"/>

      {/* Ridge 1 — pink (furthest back) */}
      <path d="M 0 380
               C 240 300, 480 330, 720 360
               S 1200 400, 1440 340
               L 1440 900 L 0 900 Z" fill="url(#cas-r1)"/>

      {/* Ridge 2 — cyan */}
      <path d="M 0 510
               C 200 420, 460 480, 720 470
               S 1180 540, 1440 470
               L 1440 900 L 0 900 Z" fill="url(#cas-r2)"/>

      {/* Ridge 3 — purple */}
      <path d="M 0 620
               C 280 560, 540 600, 800 590
               S 1220 670, 1440 600
               L 1440 900 L 0 900 Z" fill="url(#cas-r3)"/>

      {/* Ridge 4 — amber foreground peak */}
      <path d="M 0 540
               C 200 430, 420 360, 640 480
               C 820 580, 1080 720, 1440 720
               L 1440 900 L 0 900 Z" fill="url(#cas-r4)"/>
    </svg>
  );
}

// v8.0 — Iris: a Windows-11-Bloom-style wallpaper. Six translucent
// multi-color glass petals radiate from the canvas center on a tinted
// indigo backdrop. Each petal is an elongated ellipse rotated 60° from
// the previous, with its own color gradient. Heavy gaussian blur on the
// petal group gives the glassy, refractive feel; a faint white center
// dot sells the "light passing through prism" effect.
function IrisBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Backdrop — radial deep-indigo to near-black so the petals pop */}
        <radialGradient id="iris-bg" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="#312e81"/>
          <stop offset="55%"  stopColor="#1e1b4b"/>
          <stop offset="100%" stopColor="#020010"/>
        </radialGradient>

        {/* Six petal gradients — each color hot at the inner tip,
            fading to transparent at the outer edge for glass refraction */}
        <radialGradient id="iris-p1" cx="50%" cy="100%" r="100%">
          <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#f59e0b" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#92400e" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="iris-p2" cx="50%" cy="100%" r="100%">
          <stop offset="0%"   stopColor="#f9a8d4" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#ec4899" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#831843" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="iris-p3" cx="50%" cy="100%" r="100%">
          <stop offset="0%"   stopColor="#f0abfc" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#d946ef" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#86198f" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="iris-p4" cx="50%" cy="100%" r="100%">
          <stop offset="0%"   stopColor="#c4b5fd" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#a855f7" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#581c87" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="iris-p5" cx="50%" cy="100%" r="100%">
          <stop offset="0%"   stopColor="#a5b4fc" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#6366f1" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#312e81" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="iris-p6" cx="50%" cy="100%" r="100%">
          <stop offset="0%"   stopColor="#67e8f9" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#06b6d4" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#0e7490" stopOpacity="0"/>
        </radialGradient>

        {/* Gaussian blur on the petals — gives them the glassy / refractive
            feel. Without this the petals look like solid stained glass; with
            it, they look like light bending through a prism. */}
        <filter id="iris-blur"><feGaussianBlur stdDeviation="18"/></filter>

        {/* Soft white center highlight — light leaking out through the
            center of the prism */}
        <radialGradient id="iris-core" cx="50%" cy="50%" r="12%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.42"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Layer 1: backdrop */}
      <rect width="1440" height="900" fill="url(#iris-bg)"/>

      {/* Layer 2: six radiating translucent petals, blurred together */}
      <g transform="translate(720 450)" filter="url(#iris-blur)">
        <ellipse cx="0" cy="-230" rx="160" ry="380" fill="url(#iris-p1)" transform="rotate(0)"/>
        <ellipse cx="0" cy="-230" rx="160" ry="380" fill="url(#iris-p2)" transform="rotate(60)"/>
        <ellipse cx="0" cy="-230" rx="160" ry="380" fill="url(#iris-p3)" transform="rotate(120)"/>
        <ellipse cx="0" cy="-230" rx="160" ry="380" fill="url(#iris-p4)" transform="rotate(180)"/>
        <ellipse cx="0" cy="-230" rx="160" ry="380" fill="url(#iris-p5)" transform="rotate(240)"/>
        <ellipse cx="0" cy="-230" rx="160" ry="380" fill="url(#iris-p6)" transform="rotate(300)"/>
      </g>

      {/* Layer 3: bright center core */}
      <rect width="1440" height="900" fill="url(#iris-core)"/>
    </svg>
  );
}

// v8.0 — Ember: a Mac-Ventura-style wallpaper. Layered curved petal/flame
// shapes flowing through a warm-to-cool palette — bright amber at the
// top fading through orange and red into deep magenta and violet at the
// bottom. The shapes have S-curve silhouettes (similar to Cascade's
// ridges) but here they're shorter and overlap more like flames rather
// than mountain ridges. Light gaussian blur softens the edges where
// shapes meet, giving the "luxurious gradient" feel of Ventura without
// looking pixelated.
function EmberBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Backdrop — very dark warm undertone (almost black with a hint
            of plum) so the layers above glow */}
        <linearGradient id="ember-bg" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%"   stopColor="#1c0a14"/>
          <stop offset="100%" stopColor="#080208"/>
        </linearGradient>

        {/* Layer 1 — bright amber (top, the "sun" tone) */}
        <linearGradient id="ember-l1" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#fde68a"/>
          <stop offset="45%"  stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#7c2d12"/>
        </linearGradient>
        {/* Layer 2 — orange */}
        <linearGradient id="ember-l2" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#fdba74"/>
          <stop offset="45%"  stopColor="#ea580c"/>
          <stop offset="100%" stopColor="#7c2d12"/>
        </linearGradient>
        {/* Layer 3 — red */}
        <linearGradient id="ember-l3" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#fb7185"/>
          <stop offset="45%"  stopColor="#dc2626"/>
          <stop offset="100%" stopColor="#7c1d1d"/>
        </linearGradient>
        {/* Layer 4 — magenta */}
        <linearGradient id="ember-l4" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#e879f9"/>
          <stop offset="45%"  stopColor="#a21caf"/>
          <stop offset="100%" stopColor="#581c87"/>
        </linearGradient>
        {/* Layer 5 — deep violet (foreground / lower-left, the "twilight" */}
        <linearGradient id="ember-l5" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#a78bfa"/>
          <stop offset="45%"  stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#3b0764"/>
        </linearGradient>

        {/* Light blur for the soft "draped silk" edges that make Ventura
            wallpapers feel luxurious — not too heavy or shapes lose definition */}
        <filter id="ember-blur"><feGaussianBlur stdDeviation="8"/></filter>
      </defs>

      {/* Layer 0: backdrop */}
      <rect width="1440" height="900" fill="url(#ember-bg)"/>

      <g filter="url(#ember-blur)">
        {/* Layer 1: amber, large petal covering most of the upper canvas.
            Tapers down toward the lower-right as if a flame's tip. */}
        <path d="M -100 -100 L 1100 -100 Q 1500 200 1200 700 Q 900 600 700 400 Q 500 200 -100 300 Z"
              fill="url(#ember-l1)"/>

        {/* Layer 2: orange, narrower petal rising from the mid-bottom up
            into the upper-right. Slight S-curve silhouette. */}
        <path d="M 200 900 L 1100 900 Q 1300 600 1100 300 Q 900 100 700 200 Q 500 400 400 700 Q 300 800 200 900 Z"
              fill="url(#ember-l2)"/>

        {/* Layer 3: red, S-curve through the middle/lower area, sweeping
            from the right edge down to the bottom-center */}
        <path d="M 1440 250 L 1440 900 L 350 900 Q 600 700 800 600 Q 1000 500 1100 350 Q 1200 200 1440 250 Z"
              fill="url(#ember-l3)"/>

        {/* Layer 4: magenta, a tall petal from the bottom-center reaching
            up toward the middle */}
        <path d="M 300 900 L 900 900 Q 800 600 700 500 Q 600 400 500 500 Q 400 700 300 900 Z"
              fill="url(#ember-l4)"/>

        {/* Layer 5: deep violet, the foreground "shadow" sweeping the
            lower-left corner. This is what makes Ventura wallpapers feel
            grounded — a dark cool foreground anchoring the warm light. */}
        <path d="M -100 600 L -100 900 L 600 900 Q 500 800 400 750 Q 250 700 100 650 Z"
              fill="url(#ember-l5)"/>
      </g>
    </svg>
  );
}

// v8.0 — Tide: a sister wallpaper to Cascade — same Big-Sur-style flowing
// ridges and curve geometry, but rendered entirely in blue→purple shades.
// Designed for users who want Cascade's composition without the warm
// pink/amber palette. Atmospheric perspective drives the color choice:
// distant ridges are LIGHTER and bluer (haze), foreground ridges are
// DARKER and more saturated violet.
//
//   Sky:     sky-blue → deep navy
//   Ridge 1: blue-300 → blue-900   (lightest, furthest back)
//   Ridge 2: blue-500 → blue-950
//   Ridge 3: indigo-400 → indigo-900
//   Ridge 4: violet-500 → purple-950 (darkest, foreground)
function TideBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Sky — sky-blue top fading to deep navy at horizon */}
        <linearGradient id="tide-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7dd3fc"/>
          <stop offset="40%"  stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#1e1b4b"/>
        </linearGradient>
        {/* Ridge 1 — light blue (furthest back, lightest from haze) */}
        <linearGradient id="tide-r1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#93c5fd"/>
          <stop offset="40%"  stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#1e3a8a"/>
        </linearGradient>
        {/* Ridge 2 — medium blue */}
        <linearGradient id="tide-r2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#60a5fa"/>
          <stop offset="40%"  stopColor="#2563eb"/>
          <stop offset="100%" stopColor="#172554"/>
        </linearGradient>
        {/* Ridge 3 — periwinkle / indigo */}
        <linearGradient id="tide-r3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#a5b4fc"/>
          <stop offset="40%"  stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#312e81"/>
        </linearGradient>
        {/* Ridge 4 — deep violet (foreground, darkest and most saturated) */}
        <linearGradient id="tide-r4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c4b5fd"/>
          <stop offset="40%"  stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#3b0764"/>
        </linearGradient>
        {/* Soft cool moon-glow over the horizon — opposite mood to Cascade's
            warm sun-glow. Gives Tide a "twilight" feel rather than golden hour. */}
        <radialGradient id="tide-glow" cx="32%" cy="38%" r="22%">
          <stop offset="0%"   stopColor="#dbeafe" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width="1440" height="900" fill="url(#tide-sky)"/>

      {/* Cool moon-glow (drawn before ridges so they cast over it) */}
      <rect width="1440" height="900" fill="url(#tide-glow)"/>

      {/* Ridge 1 — light blue (furthest back) */}
      <path d="M 0 380
               C 240 300, 480 330, 720 360
               S 1200 400, 1440 340
               L 1440 900 L 0 900 Z" fill="url(#tide-r1)"/>

      {/* Ridge 2 — medium blue */}
      <path d="M 0 510
               C 200 420, 460 480, 720 470
               S 1180 540, 1440 470
               L 1440 900 L 0 900 Z" fill="url(#tide-r2)"/>

      {/* Ridge 3 — periwinkle */}
      <path d="M 0 620
               C 280 560, 540 600, 800 590
               S 1220 670, 1440 600
               L 1440 900 L 0 900 Z" fill="url(#tide-r3)"/>

      {/* Ridge 4 — deep violet foreground peak */}
      <path d="M 0 540
               C 200 430, 420 360, 640 480
               C 820 580, 1080 720, 1440 720
               L 1440 900 L 0 900 Z" fill="url(#tide-r4)"/>
    </svg>
  );
}

// v8.0 — Halcyon: a mesh-grade multi-blob wallpaper designed as a warmer
// companion to Mesh. Same restrained four-blob composition + heavy blur +
// vignette that gives Mesh its premium feel, but a distinct color story:
// coral pink, indigo, mint, and amber on a deep purple-charcoal base.
// Reads as "polished, designed, intentional" without ever shouting.
function HalcyonBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Coral pink (upper-left) — warm anchor */}
        <radialGradient id="halc1" cx="22%" cy="25%" r="55%">
          <stop offset="0%"   stopColor="#fb7185" stopOpacity="0.88"/>
          <stop offset="55%"  stopColor="#9f1239" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#0c0a1a" stopOpacity="0"/>
        </radialGradient>
        {/* Indigo (upper-right) — cool counterpoint */}
        <radialGradient id="halc2" cx="78%" cy="28%" r="50%">
          <stop offset="0%"   stopColor="#818cf8" stopOpacity="0.85"/>
          <stop offset="55%"  stopColor="#3730a3" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#0c0a1a" stopOpacity="0"/>
        </radialGradient>
        {/* Mint (lower-left) — fresh accent */}
        <radialGradient id="halc3" cx="28%" cy="82%" r="50%">
          <stop offset="0%"   stopColor="#5eead4" stopOpacity="0.78"/>
          <stop offset="55%"  stopColor="#0f766e" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#0c0a1a" stopOpacity="0"/>
        </radialGradient>
        {/* Amber (lower-right) — small warm pop */}
        <radialGradient id="halc4" cx="78%" cy="80%" r="38%">
          <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.42"/>
          <stop offset="100%" stopColor="#0c0a1a" stopOpacity="0"/>
        </radialGradient>
        {/* Heavy blur for that signature melted-color quality */}
        <filter id="halc-blur"><feGaussianBlur stdDeviation="80"/></filter>
        {/* Soft vignette */}
        <radialGradient id="halc-vign" cx="50%" cy="50%" r="78%">
          <stop offset="60%" stopColor="#000" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.36"/>
        </radialGradient>
      </defs>

      {/* Layer 1: deep purple-charcoal base */}
      <rect width="1440" height="900" fill="#0c0a1a"/>

      {/* Layer 2: the four blobs, heavily blurred */}
      <g filter="url(#halc-blur)">
        <rect width="1440" height="900" fill="url(#halc1)"/>
        <rect width="1440" height="900" fill="url(#halc2)"/>
        <rect width="1440" height="900" fill="url(#halc3)"/>
        <rect width="1440" height="900" fill="url(#halc4)"/>
      </g>

      {/* Layer 3: vignette */}
      <rect width="1440" height="900" fill="url(#halc-vign)"/>
    </svg>
  );
}

// v8.0 — Prism: holographic shimmer. Soft rainbow gradient swept across the
// canvas with overlapping blurry color blobs to mimic the look of light
// refracting through cut glass. Designed for the new v8.0 chrome — feels
// fresh and modern without overwhelming the foreground.
function PrismBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Base sweep — pink → violet → cyan → green diagonal */}
        <linearGradient id="prismSweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#ff7eb6"/>
          <stop offset="22%"  stopColor="#c084fc"/>
          <stop offset="45%"  stopColor="#7c83fd"/>
          <stop offset="65%"  stopColor="#3ec5ff"/>
          <stop offset="85%"  stopColor="#5fe3c4"/>
          <stop offset="100%" stopColor="#d4ff80"/>
        </linearGradient>
        <radialGradient id="prismBlob1" cx="20%" cy="20%" r="55%"><stop offset="0%" stopColor="#ff5e93" stopOpacity="0.75"/><stop offset="100%" stopColor="#ff5e93" stopOpacity="0"/></radialGradient>
        <radialGradient id="prismBlob2" cx="80%" cy="30%" r="50%"><stop offset="0%" stopColor="#7b3eff" stopOpacity="0.55"/><stop offset="100%" stopColor="#7b3eff" stopOpacity="0"/></radialGradient>
        <radialGradient id="prismBlob3" cx="65%" cy="85%" r="55%"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/></radialGradient>
        <radialGradient id="prismBlob4" cx="15%" cy="80%" r="40%"><stop offset="0%" stopColor="#4cef90" stopOpacity="0.45"/><stop offset="100%" stopColor="#4cef90" stopOpacity="0"/></radialGradient>
        {/* Heavy blur on the blob layer creates the soft holographic look */}
        <filter id="prismBlur"><feGaussianBlur stdDeviation="70"/></filter>
        {/* Final vignette for depth */}
        <radialGradient id="prismVign" cx="50%" cy="50%" r="80%"><stop offset="55%" stopColor="#000" stopOpacity="0"/><stop offset="100%" stopColor="#000" stopOpacity="0.4"/></radialGradient>
      </defs>
      <rect width="1440" height="900" fill="#1a0a2a"/>
      <rect width="1440" height="900" fill="url(#prismSweep)" opacity="0.55"/>
      <g filter="url(#prismBlur)">
        <rect width="1440" height="900" fill="url(#prismBlob1)"/>
        <rect width="1440" height="900" fill="url(#prismBlob2)"/>
        <rect width="1440" height="900" fill="url(#prismBlob3)"/>
        <rect width="1440" height="900" fill="url(#prismBlob4)"/>
      </g>
      <rect width="1440" height="900" fill="url(#prismVign)"/>
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
  if (id === "halcyon")      return <HalcyonBg/>;
  if (id === "cascade")      return <CascadeBg/>;
  if (id === "tide")         return <TideBg/>;
  if (id === "iris")         return <IrisBg/>;
  if (id === "ember")        return <EmberBg/>;
  if (id === "prism")        return <PrismBg/>;
  const wp = WALLPAPERS[id];
  if (wp && wp.grad) {
    return <div style={{position:"absolute",inset:0,background:wp.grad}}/>;
  }
  return <MeshBg/>;
}

// Also export the individual backgrounds — the login screen uses MeshBg directly.
export { NovaBg, BlissBg, AuroraBg, MeshBg };

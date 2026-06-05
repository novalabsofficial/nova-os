// SVG-based wallpaper components + the Wallpaper router that picks which one
// to render. Gradient-only wallpapers (night/sakura/forest/slate) fall through
// the router and use their `grad` value from WALLPAPERS in constants.js.
//
// 5.2 made Mesh the system default; Aurora and the others remain selectable.

import { useState, useEffect } from "react";
import { WALLPAPERS } from "./constants.js";
import { isLiteMode } from "../lib/lite.js";

// v11.0 — optional bundled high-quality default LIGHT wallpaper. Drop ONE image
// (png/jpg/jpeg/webp/avif) into src/assets/wallpapers/ and it becomes the
// "Bloom" light wallpaper at full original resolution — no recompression,
// unlike the in-app uploader. Empty folder → the built-in SVG fallback is used.
// Vite discovers the file at build time; restart the dev server after adding it.
const _wpImgs = import.meta.glob("../assets/wallpapers/*.{png,jpg,jpeg,webp,avif}", { eager: true });
export const CUSTOM_LIGHT_WP = (() => {
  const first = Object.values(_wpImgs)[0];
  return first ? (first.default || first) : null;
})();
// Same idea for the DARK default ("Bloom Dark") — drop an image into
// src/assets/wallpapers-dark/. Empty folder → Bloom Dark falls back to Mesh.
const _wpImgsDark = import.meta.glob("../assets/wallpapers-dark/*.{png,jpg,jpeg,webp,avif}", { eager: true });
export const CUSTOM_DARK_WP = (() => {
  const first = Object.values(_wpImgsDark)[0];
  return first ? (first.default || first) : null;
})();

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

// v8.0 — Ember: a Mac-Ventura-style wallpaper, redesigned. The earlier
// polygon-path approach made harsh edges visible at all but the smallest
// preview sizes. This version follows Mesh's proven design pattern —
// large radial-gradient blobs heavily gaussian-blurred — but applied
// to a warm/cool palette that lands in Ventura territory:
//   • Bright amber center-top (the "sun")
//   • Orange and red flanking blobs
//   • Magenta blob centered lower
//   • Deep violet blob anchoring the bottom-left
//   • Subtle indigo blob in the upper-right corner
// Heavy blur (stdDeviation=85) melts all five into a single flowing
// atmosphere where you can't see any single shape — exactly the
// "luxurious gradient" feel of a real Ventura wallpaper.
function EmberBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Backdrop — very dark warm undertone (deep plum-black) so the
            blobs glow against it like a fire on a dark wall */}
        <linearGradient id="ember-bg" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#1c0a14"/>
          <stop offset="100%" stopColor="#0a0210"/>
        </linearGradient>

        {/* Amber: the "sun" — bright warm center near the top */}
        <radialGradient id="ember-1" cx="52%" cy="22%" r="58%">
          <stop offset="0%"   stopColor="#fde68a" stopOpacity="0.92"/>
          <stop offset="30%"  stopColor="#f59e0b" stopOpacity="0.65"/>
          <stop offset="65%"  stopColor="#92400e" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#0a0210" stopOpacity="0"/>
        </radialGradient>
        {/* Orange: right side, slightly lower than the amber */}
        <radialGradient id="ember-2" cx="80%" cy="50%" r="48%">
          <stop offset="0%"   stopColor="#fb923c" stopOpacity="0.85"/>
          <stop offset="35%"  stopColor="#ea580c" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#7c2d12" stopOpacity="0"/>
        </radialGradient>
        {/* Red: lower-right, transitions warm into the magenta */}
        <radialGradient id="ember-3" cx="68%" cy="78%" r="46%">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.85"/>
          <stop offset="40%"  stopColor="#be185d" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#500724" stopOpacity="0"/>
        </radialGradient>
        {/* Magenta: lower-center, the warm-to-cool pivot */}
        <radialGradient id="ember-4" cx="36%" cy="82%" r="48%">
          <stop offset="0%"   stopColor="#a21caf" stopOpacity="0.82"/>
          <stop offset="50%"  stopColor="#7c3aed" stopOpacity="0.42"/>
          <stop offset="100%" stopColor="#3b0764" stopOpacity="0"/>
        </radialGradient>
        {/* Violet: bottom-left, the deep "twilight" foreground */}
        <radialGradient id="ember-5" cx="14%" cy="70%" r="42%">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.78"/>
          <stop offset="50%"  stopColor="#4c1d95" stopOpacity="0.38"/>
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0"/>
        </radialGradient>
        {/* Indigo accent: upper-left, balances the composition */}
        <radialGradient id="ember-6" cx="14%" cy="22%" r="36%">
          <stop offset="0%"   stopColor="#fb923c" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#7c2d12" stopOpacity="0"/>
        </radialGradient>

        {/* Heavy blur to melt every blob into one smooth atmosphere.
            This is the secret to Mesh's quality — and now Ember's too. */}
        <filter id="ember-blur"><feGaussianBlur stdDeviation="85"/></filter>

        {/* Soft vignette for depth */}
        <radialGradient id="ember-vign" cx="50%" cy="50%" r="80%">
          <stop offset="55%" stopColor="#000" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.35"/>
        </radialGradient>
      </defs>

      {/* Layer 0: backdrop */}
      <rect width="1440" height="900" fill="url(#ember-bg)"/>

      {/* Layer 1: all six blobs, heavily blurred into a single flowing field */}
      <g filter="url(#ember-blur)">
        <rect width="1440" height="900" fill="url(#ember-1)"/>
        <rect width="1440" height="900" fill="url(#ember-2)"/>
        <rect width="1440" height="900" fill="url(#ember-3)"/>
        <rect width="1440" height="900" fill="url(#ember-4)"/>
        <rect width="1440" height="900" fill="url(#ember-5)"/>
        <rect width="1440" height="900" fill="url(#ember-6)"/>
      </g>

      {/* Layer 2: vignette */}
      <rect width="1440" height="900" fill="url(#ember-vign)"/>
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

// v10.0 — Supernova: the edition's signature wallpaper. A cool, crisp stellar
// glow — a luminous blue-white core melting out through cyan and electric blue
// into deep navy and black space, over a fine star field. No rings, no hard
// edges: built the Mesh/Ember way from large heavily-blurred radial glows so
// it stays smooth and premium. The core sits in the upper third so the lower
// desktop stays calm for icons.
function SupernovaBg() {
  const cx = 720, cy = 372;
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Deep-space backdrop: a faint blue bloom around the star, falling to
            near-black navy at the edges */}
        <radialGradient id="sn-bg" cx="50%" cy="41%" r="82%">
          <stop offset="0%"   stopColor="#0d2350"/>
          <stop offset="45%"  stopColor="#071632"/>
          <stop offset="100%" stopColor="#03070f"/>
        </radialGradient>
        {/* Energy field — concentric cool zones, brightest in the middle */}
        <radialGradient id="sn-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#eaf6ff" stopOpacity="0.95"/>
          <stop offset="34%"  stopColor="#a5e8ff" stopOpacity="0.8"/>
          <stop offset="66%"  stopColor="#22d3ee" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sn-mid" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.6"/>
          <stop offset="55%"  stopColor="#0ea5e9" stopOpacity="0.26"/>
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sn-out" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.5"/>
          <stop offset="60%"  stopColor="#2563eb" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sn-far" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1e3a8a" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0"/>
        </radialGradient>
        {/* soft halo bloom for the core (no hard dot) */}
        <radialGradient id="sn-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#f2fbff" stopOpacity="0.9"/>
          <stop offset="45%"  stopColor="#bdecff" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0"/>
        </radialGradient>
        <filter id="sn-blur"><feGaussianBlur stdDeviation="82"/></filter>
        <filter id="sn-coreblur"><feGaussianBlur stdDeviation="26"/></filter>
        <radialGradient id="sn-vign" cx="50%" cy="42%" r="82%">
          <stop offset="55%" stopColor="#000" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.5"/>
        </radialGradient>
      </defs>

      <rect width="1440" height="900" fill="url(#sn-bg)"/>

      {/* Star field (behind the glow so the star washes over nearby ones) */}
      {[...Array(95)].map((_, i) => {
        const x = (i*167.3+41)%1440, y = (i*101.7+23)%900, r = i%7===0 ? 1.7 : i%3===0 ? 1.1 : 0.6;
        const op = 0.26 + (i%5)*0.12;
        return <circle key={i} cx={x} cy={y} r={r} fill={"rgba(214,236,255,"+op+")"}/>;
      })}

      {/* Energy field — blurred concentric cool glows */}
      <g filter="url(#sn-blur)">
        <circle cx={cx} cy={cy} r="660" fill="url(#sn-far)"/>
        <circle cx={cx} cy={cy} r="480" fill="url(#sn-out)"/>
        <circle cx={cx} cy={cy} r="330" fill="url(#sn-mid)"/>
        <circle cx={cx} cy={cy} r="240" fill="url(#sn-core)"/>
      </g>

      {/* Soft luminous core bloom — blurred, no hard white edge */}
      <g filter="url(#sn-coreblur)"><circle cx={cx} cy={cy} r="86" fill="url(#sn-glow)"/></g>

      <rect width="1440" height="900" fill="url(#sn-vign)"/>
    </svg>
  );
}

// v10.0 — Nebula: a calm, spacious deep-space companion to Supernova. Soft
// teal / indigo / violet / rose clouds drift over near-black, heavily blurred
// (Mesh-grade) so they melt into one smooth field, with a dense star field
// and a gentle vignette. Lots of usable dark space; reads premium + serene.
function NebulaBg() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="neb1" cx="26%" cy="30%" r="52%">
          <stop offset="0%"   stopColor="#2dd4bf" stopOpacity="0.62"/>
          <stop offset="55%"  stopColor="#0f766e" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#05051a" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="neb2" cx="74%" cy="32%" r="54%">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.66"/>
          <stop offset="55%"  stopColor="#3730a3" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#05051a" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="neb3" cx="52%" cy="80%" r="56%">
          <stop offset="0%"   stopColor="#c026d3" stopOpacity="0.6"/>
          <stop offset="55%"  stopColor="#86198f" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#05051a" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="neb4" cx="86%" cy="76%" r="40%">
          <stop offset="0%"   stopColor="#fb7185" stopOpacity="0.42"/>
          <stop offset="100%" stopColor="#05051a" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="neb5" cx="12%" cy="82%" r="38%">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.38"/>
          <stop offset="100%" stopColor="#05051a" stopOpacity="0"/>
        </radialGradient>
        <filter id="neb-blur"><feGaussianBlur stdDeviation="92"/></filter>
        <radialGradient id="neb-vign" cx="50%" cy="50%" r="78%">
          <stop offset="58%" stopColor="#000" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.42"/>
        </radialGradient>
      </defs>

      <rect width="1440" height="900" fill="#05051a"/>

      <g filter="url(#neb-blur)">
        <rect width="1440" height="900" fill="url(#neb1)"/>
        <rect width="1440" height="900" fill="url(#neb2)"/>
        <rect width="1440" height="900" fill="url(#neb3)"/>
        <rect width="1440" height="900" fill="url(#neb4)"/>
        <rect width="1440" height="900" fill="url(#neb5)"/>
      </g>

      {/* Star field */}
      {[...Array(120)].map((_, i) => {
        const x = (i*151.7+19)%1440, y = (i*89.3+13)%900, r = i%8===0 ? 1.6 : i%3===0 ? 1 : 0.55;
        const op = 0.3 + (i%5)*0.12;
        return <circle key={i} cx={x} cy={y} r={r} fill={"rgba(255,255,255,"+op+")"}/>;
      })}

      <rect width="1440" height="900" fill="url(#neb-vign)"/>
    </svg>
  );
}

// v11.0 — Bloom: the signature LIGHT wallpaper of Nova OS 11 (auto-picked in
// Light mode). A Windows-11-Bloom-inspired abstract flower — layered
// translucent petals in the Nova palette (indigo · violet · pink · cyan)
// radiating from a luminous white core, softly blurred for a glassy
// depth-of-field feel — over a graduated cool-white canvas that deepens
// toward the edges so it never reads flat or blinding. The bloom sits
// center-right, leaving the top-left calm for dark icon labels.
function BloomBg() {
  // If a high-quality image was dropped into src/assets/wallpapers/, use it at
  // full resolution. Otherwise render the built-in SVG bloom as a fallback.
  if (CUSTOM_LIGHT_WP) {
    return <div style={{position:"absolute",inset:0,background:'url("'+CUSTOM_LIGHT_WP+'") center/cover no-repeat'}}/>;
  }
  const CX = 760, CY = 420;
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="bl-base" cx="53%" cy="44%" r="80%">
          <stop offset="0%"   stopColor="#f7f8fc"/>
          <stop offset="50%"  stopColor="#e8ebf3"/>
          <stop offset="100%" stopColor="#cfd6e6"/>
        </radialGradient>
        <radialGradient id="bl-p1" cx="50%" cy="100%" r="100%"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.55"/><stop offset="55%" stopColor="#818cf8" stopOpacity="0.26"/><stop offset="100%" stopColor="#818cf8" stopOpacity="0"/></radialGradient>
        <radialGradient id="bl-p2" cx="50%" cy="100%" r="100%"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.52"/><stop offset="55%" stopColor="#c084fc" stopOpacity="0.24"/><stop offset="100%" stopColor="#c084fc" stopOpacity="0"/></radialGradient>
        <radialGradient id="bl-p3" cx="50%" cy="100%" r="100%"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.5"/><stop offset="55%" stopColor="#f472b6" stopOpacity="0.22"/><stop offset="100%" stopColor="#f472b6" stopOpacity="0"/></radialGradient>
        <radialGradient id="bl-p4" cx="50%" cy="100%" r="100%"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5"/><stop offset="55%" stopColor="#38bdf8" stopOpacity="0.22"/><stop offset="100%" stopColor="#38bdf8" stopOpacity="0"/></radialGradient>
        <radialGradient id="bl-p5" cx="50%" cy="100%" r="100%"><stop offset="0%" stopColor="#5b8def" stopOpacity="0.5"/><stop offset="55%" stopColor="#93b4fb" stopOpacity="0.22"/><stop offset="100%" stopColor="#93b4fb" stopOpacity="0"/></radialGradient>
        <radialGradient id="bl-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"/><stop offset="45%" stopColor="#eaf0ff" stopOpacity="0.45"/><stop offset="100%" stopColor="#eaf0ff" stopOpacity="0"/></radialGradient>
        <filter id="bl-soft"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="bl-haze"><feGaussianBlur stdDeviation="26"/></filter>
        <radialGradient id="bl-vign" cx="53%" cy="44%" r="74%"><stop offset="56%" stopColor="#aab4cd" stopOpacity="0"/><stop offset="100%" stopColor="#93a0bf" stopOpacity="0.36"/></radialGradient>
      </defs>

      <rect width="1440" height="900" fill="url(#bl-base)"/>

      {/* hazy halo behind the bloom — large, soft, low-contrast for depth */}
      <g filter="url(#bl-haze)" transform={"translate("+CX+" "+CY+")"} opacity="0.7">
        {[0,45,90,135,180,225,270,315].map((r,i)=>(
          <ellipse key={"h"+i} cx="0" cy="-160" rx="170" ry="340" transform={"rotate("+r+")"} fill={"url(#bl-p"+((i%5)+1)+")"}/>
        ))}
      </g>

      {/* main bloom — crisper layered petals */}
      <g filter="url(#bl-soft)" transform={"translate("+CX+" "+CY+")"}>
        {[15,60,105,150,195,240,285,330].map((r,i)=>(
          <ellipse key={"m"+i} cx="0" cy="-120" rx="98" ry="252" transform={"rotate("+r+")"} fill={"url(#bl-p"+((i%5)+1)+")"}/>
        ))}
        {[0,72,144,216,288].map((r,i)=>(
          <ellipse key={"in"+i} cx="0" cy="-66" rx="56" ry="146" transform={"rotate("+r+")"} fill={"url(#bl-p"+(((i+2)%5)+1)+")"}/>
        ))}
      </g>

      {/* luminous center */}
      <g filter="url(#bl-soft)"><circle cx={CX} cy={CY} r="116" fill="url(#bl-core)"/></g>

      {/* fine speckle for texture so the canvas isn't flat */}
      {[...Array(64)].map((_, i) => {
        const x=(i*193.3+37)%1440, y=(i*101.7+23)%900, rr=i%5===0?1.3:0.7;
        const op=0.03+(i%4)*0.02;
        return <circle key={"sp"+i} cx={x} cy={y} r={rr} fill={"rgba(60,76,128,"+op+")"}/>;
      })}

      <rect width="1440" height="900" fill="url(#bl-vign)"/>
    </svg>
  );
}

// v11.0 — Bloom Dark: the signature DARK wallpaper, paired with light Bloom.
// Renders the bundled dark image if one was dropped into wallpapers-dark/;
// otherwise falls back to Mesh so dark mode never breaks before the art exists.
function BloomDarkBg() {
  if (CUSTOM_DARK_WP) {
    return <div style={{position:"absolute",inset:0,background:'url("'+CUSTOM_DARK_WP+'") center/cover no-repeat'}}/>;
  }
  return <MeshBg/>;
}

/**
 * Resolve the concrete background element for a wallpaper id.
 * "custom" requires a customUrl (the user-uploaded base64 image).
 * Empty / unknown id falls through to Mesh — the system default since 5.2.
 */
function renderBg(id, customUrl) {
  if (id === "custom" && customUrl) {
    return <div style={{position:"absolute",inset:0,background:'url("'+customUrl+'") center/cover no-repeat'}}/>;
  }
  if (!id || id === "mesh")  return <MeshBg/>;
  if (id === "bloom" || id === "lumina") return <BloomBg/>;   // "lumina" = pre-release alias
  if (id === "bloomdark")    return <BloomDarkBg/>;
  if (id === "supernova")    return <SupernovaBg/>;
  if (id === "nebula")       return <NebulaBg/>;
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

// v8.5 dynamic wallpapers — "Auto" maps the time of day to a fitting
// wallpaper. Re-checked every few minutes so it transitions through the day.
export function autoWallpaperId(d = new Date()) {
  const h = d.getHours();
  if (h < 5)  return "night";    // deep night — the "Night" wallpaper
  if (h < 8)  return "halcyon";  // dawn — warm coral glow
  if (h < 11) return "cascade";  // morning — sunrise ridges
  if (h < 16) return "mesh";     // midday — bright & vibrant
  if (h < 19) return "ember";    // sunset — golden hour
  if (h < 21) return "tide";     // dusk — cool twilight
  return "night";                // night — the "Night" wallpaper
}

/**
 * Wallpaper renderer.
 *  • id "auto"  → resolves to a time-of-day wallpaper (re-checked every 5 min).
 *  • animate    → wraps the backdrop in a slow, subtle drift (CSS wp-drift).
 *    A constant ≥8% overscan on the inner layer keeps the edges covered while
 *    it pans, so you never see the wallpaper's border.
 */
export function Wallpaper({ id, customUrl, animate }) {
  const [autoId, setAutoId] = useState(() => autoWallpaperId());
  useEffect(() => {
    if (id !== "auto") return;
    setAutoId(autoWallpaperId());
    const t = setInterval(() => setAutoId(autoWallpaperId()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [id]);
  const realId = id === "auto" ? autoId : id;
  // Lite mode (?kiosk=1): the SVG-blur wallpapers are by far the most expensive
  // thing to rasterize in software, so on a GPU-less host (Nova OS as the Linux
  // desktop in a VM) skip them entirely and paint a flat gradient instead. A
  // custom photo wallpaper is a single cheap image, so that one is kept.
  if (isLiteMode()) {
    if (realId === "custom" && customUrl) {
      return <div style={{position:"absolute",inset:0,background:'url("'+customUrl+'") center/cover no-repeat'}}/>;
    }
    return <div style={{position:"absolute",inset:0,background:"radial-gradient(120% 90% at 50% 32%, #14315f 0%, #0b1c3e 44%, #050a16 100%)"}}/>;
  }
  const bg = renderBg(realId, customUrl);
  if (!animate) return bg;
  return (
    <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,transformOrigin:"center",animation:"wp-drift 26s ease-in-out infinite",willChange:"transform"}}>{bg}</div>
    </div>
  );
}

// Also export the individual backgrounds — the login screen uses one directly.
export { NovaBg, BlissBg, AuroraBg, MeshBg, SupernovaBg, NebulaBg };

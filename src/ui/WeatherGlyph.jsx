// v11.0 — SVG weather glyphs that replace the WMO emoji table. Colored and
// cross-theme (gold sun, cool-grey cloud, blue rain, pale snow, gold bolt) so
// they read on both the dark glass widgets and the light surfaces. Keyed off
// Open-Meteo WMO codes via wType(). wmoIcon()/wmoLabel() in lib/weather.js are
// left untouched (still used for text labels + AI summaries).

const GOLD = "#f5b933", CLOUD = "#aab4c6", RAIN = "#5b9bef", SNOW = "#cfe1f7";

export function wType(code) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || code === 80 || code === 81) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 82 || code === 95 || code === 96 || code === 99) return "thunder";
  return "cloud";
}

function Cloud({ c = CLOUD }) {
  return (
    <g fill={c}>
      <circle cx="8.5" cy="14.5" r="4" />
      <circle cx="13" cy="11.8" r="5.2" />
      <circle cx="16.8" cy="15" r="3.6" />
      <rect x="6" y="15" width="13.2" height="4.6" rx="2.3" />
    </g>
  );
}

function rays(cx, cy, n, inner, outer, color, w) {
  return (
    <g stroke={color} strokeWidth={w} strokeLinecap="round">
      {n.map(a => {
        const r = a * Math.PI / 180;
        return <line key={a} x1={cx + Math.cos(r) * inner} y1={cy + Math.sin(r) * inner} x2={cx + Math.cos(r) * outer} y2={cy + Math.sin(r) * outer} />;
      })}
    </g>
  );
}

export function WeatherGlyph({ code, size = 20 }) {
  const t = wType(code);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", overflow: "visible" }}>
      {t === "clear" && (<g>
        <circle cx="12" cy="12" r="5" fill={GOLD} />
        {rays(12, 12, [0, 45, 90, 135, 180, 225, 270, 315], 8.4, 10.8, GOLD, 1.8)}
      </g>)}
      {t === "partly" && (<g>
        <circle cx="9" cy="9" r="3.8" fill={GOLD} />
        {rays(9, 9, [200, 245, 290, 335], 6, 8, GOLD, 1.5)}
        <Cloud />
      </g>)}
      {t === "cloud" && <Cloud />}
      {t === "fog" && (<g>
        <Cloud />
        <g stroke={CLOUD} strokeWidth="1.7" strokeLinecap="round"><line x1="5" y1="21.6" x2="15" y2="21.6" /><line x1="9" y1="23.6" x2="19" y2="23.6" /></g>
      </g>)}
      {t === "rain" && (<g>
        <Cloud />
        <g stroke={RAIN} strokeWidth="2" strokeLinecap="round"><line x1="9" y1="20.4" x2="8" y2="23.4" /><line x1="13" y1="20.4" x2="12" y2="23.4" /><line x1="17" y1="20.4" x2="16" y2="23.4" /></g>
      </g>)}
      {t === "snow" && (<g>
        <Cloud />
        <g fill={SNOW}><circle cx="8.5" cy="22" r="1.35" /><circle cx="13" cy="23" r="1.35" /><circle cx="17" cy="22" r="1.35" /></g>
      </g>)}
      {t === "thunder" && (<g>
        <Cloud />
        <path d="M13 19.5l-3.4 4.4h2.5l-1.3 3.4 4.4-5h-2.7z" fill={GOLD} />
      </g>)}
    </svg>
  );
}

// v11.0 — macOS-inspired app icon set.
//
// Each icon is a "squircle" tile: a rounded-rect with a vertical gradient
// (lighter top → deeper bottom), a soft top sheen, a 1px light bevel + hairline
// dark edge for definition, a gentle drop shadow, and a clean centered glyph.
// This is the new professional/modern look replacing the flat emoji + legacy
// SVGs. Rolled out per-app: AppIconDisplay prefers NovaAppIcon for ids in
// NOVA_ICONS and falls back to the old icons/emoji for the rest until migrated.
//
// Coordinates are a 48×48 viewBox; the tile fills it and glyphs center on 24,24.

const SPECS = {
  files: {
    from: "#54a8ff", to: "#2575e6",
    glyph: (<>
      <path d="M14 19 a2 2 0 0 1 2-2 h6 l2.6 2.6 H32 a2 2 0 0 1 2 2 v9.4 a2 2 0 0 1 -2 2 H16 a2 2 0 0 1 -2-2 Z" fill="#fff" />
      <path d="M14 23.4 H34" stroke="#0b3d8f" strokeOpacity="0.12" strokeWidth="1" />
    </>),
  },
  browser: {
    from: "#2ed0e6", to: "#1391c9",
    glyph: (<>
      <circle cx="24" cy="24" r="9.5" fill="none" stroke="#fff" strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="4" ry="9.5" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M14.6 21 H33.4 M14.6 27 H33.4" stroke="#fff" strokeWidth="1.5" />
    </>),
  },
  chat: {
    from: "#43dd80", to: "#1ba84e",
    glyph: (<>
      <path d="M15 17 h18 a3.5 3.5 0 0 1 3.5 3.5 v7.8 a3.5 3.5 0 0 1 -3.5 3.5 H23.5 l-5.6 4.4 v-4.4 H15 a3.5 3.5 0 0 1 -3.5 -3.5 v-7.8 A3.5 3.5 0 0 1 15 17 Z" fill="#fff" />
      <g fill="#1ba84e"><circle cx="19.6" cy="24.4" r="1.7" /><circle cx="24" cy="24.4" r="1.7" /><circle cx="28.4" cy="24.4" r="1.7" /></g>
    </>),
  },
  settings: {
    from: "#9aa3b2", to: "#5c6677",
    glyph: (<>
      <g fill="#fff">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="22.4" y="9.6" width="3.2" height="6" rx="1.3" transform={`rotate(${a} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="8.4" fill="#fff" />
      <circle cx="24" cy="24" r="3.8" fill="url(#ng-settings)" />
    </>),
  },
  store: {
    from: "#5b8cff", to: "#3556e0",
    glyph: (<>
      <path d="M15.5 20 h17 v12.4 a3 3 0 0 1 -3 3 H18.5 a3 3 0 0 1 -3 -3 Z" fill="#fff" />
      <path d="M19.6 20 v-1 a4.4 4.4 0 0 1 8.8 0 v1" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
    </>),
  },
  notes: {
    from: "#ffd34d", to: "#f6a823",
    glyph: (<>
      <rect x="14" y="13" width="20" height="22" rx="2.6" fill="#fff" />
      <g stroke="#eda01c" strokeWidth="2" strokeLinecap="round" opacity="0.75">
        <path d="M18 19.5 H30" /><path d="M18 24 H30" /><path d="M18 28.5 H26" />
      </g>
    </>),
  },
  tasks: {
    from: "#3ddc84", to: "#12a866",
    glyph: (<>
      <circle cx="18" cy="19.5" r="3.6" fill="#fff" />
      <polyline points="16.3,19.6 17.7,21 20,18.2" fill="none" stroke="#12a866" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23.5" y="18" width="11" height="3" rx="1.5" fill="#fff" />
      <circle cx="18" cy="29" r="3.6" fill="#fff" opacity="0.92" />
      <polyline points="16.3,29.1 17.7,30.5 20,27.7" fill="none" stroke="#12a866" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23.5" y="27.5" width="8.5" height="3" rx="1.5" fill="#fff" opacity="0.82" />
    </>),
  },
  calculator: {
    from: "#3a3f4b", to: "#20242d", sheen: 0.16,
    glyph: (<>
      <rect x="14" y="13" width="20" height="6.4" rx="2" fill="#fff" />
      <g fill="#fff" opacity="0.92">
        <rect x="14" y="22" width="5.2" height="4.4" rx="1.4" /><rect x="21.4" y="22" width="5.2" height="4.4" rx="1.4" />
        <rect x="14" y="28.5" width="5.2" height="4.4" rx="1.4" /><rect x="21.4" y="28.5" width="5.2" height="4.4" rx="1.4" />
      </g>
      <rect x="28.8" y="22" width="5.2" height="10.9" rx="1.6" fill="#ff9f0a" />
    </>),
  },
  music: {
    from: "#fb6a86", to: "#ef2b57",
    glyph: (<>
      <g fill="#fff">
        <rect x="22" y="15" width="2.1" height="15.6" rx="1" /><rect x="31" y="13.3" width="2.1" height="15.6" rx="1" />
        <path d="M22 15 L33.1 13.3 V17 L22 18.7 Z" />
        <ellipse cx="20.4" cy="31" rx="3.6" ry="2.9" /><ellipse cx="29.4" cy="29.3" rx="3.6" ry="2.9" />
      </g>
    </>),
  },
  atmos: {
    from: "#57c6ff", to: "#2f8fe6",
    glyph: (<>
      <circle cx="20" cy="19.5" r="4.8" fill="#ffe06e" />
      <g stroke="#ffe06e" strokeWidth="1.7" strokeLinecap="round">
        <path d="M20 10.2 V12.6" /><path d="M11 19.5 H13.4" /><path d="M26.6 19.5 H29" />
        <path d="M13.6 13.1 l1.7 1.7" /><path d="M26.4 13.1 l-1.7 1.7" />
      </g>
      <g fill="#fff">
        <circle cx="21" cy="31" r="4.5" /><circle cx="27" cy="28.6" r="5.4" /><circle cx="31.8" cy="31.4" r="4" />
        <rect x="20" y="31" width="13" height="5" rx="2.5" />
      </g>
    </>),
  },
  photos: {
    from: "#ffffff", to: "#eef1f6", sheen: 0,
    glyph: (<>
      {[{ a: 0, c: "#fb5c5c" }, { a: 60, c: "#ffae3a" }, { a: 120, c: "#ffd23d" }, { a: 180, c: "#4cc76b" }, { a: 240, c: "#4aa3ff" }, { a: 300, c: "#a86bff" }].map((p) => (
        <ellipse key={p.a} cx="24" cy="16.6" rx="4.3" ry="7.2" fill={p.c} transform={`rotate(${p.a} 24 24)`} opacity="0.92" />
      ))}
      <circle cx="24" cy="24" r="3" fill="#fff" />
    </>),
  },
  terminal: {
    from: "#2c313c", to: "#171a22", sheen: 0.18,
    glyph: (<>
      <rect x="13" y="14.5" width="22" height="19" rx="3" fill="#10131a" />
      <polyline points="17.5,21 21.5,24 17.5,27" fill="none" stroke="#4cef90" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23.5" y="26" width="7" height="2.1" rx="1" fill="#4cef90" />
    </>),
  },
};

export const NOVA_ICONS = new Set(Object.keys(SPECS));

export function NovaAppIcon({ id, size = 26 }) {
  const spec = SPECS[id];
  if (!spec) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", filter: `drop-shadow(0 ${(size * 0.035).toFixed(2)}px ${(size * 0.07).toFixed(2)}px rgba(0,0,0,0.32))` }}>
      <defs>
        <linearGradient id={"ng-" + id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={spec.from} />
          <stop offset="1" stopColor={spec.to} />
        </linearGradient>
        <linearGradient id={"ns-" + id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={spec.sheen != null ? spec.sheen : 0.3} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="10.6" fill={"url(#ng-" + id + ")"} />
      <rect x="1.5" y="1.5" width="45" height="45" rx="10.6" fill={"url(#ns-" + id + ")"} />
      {spec.glyph}
      <rect x="2" y="2" width="44" height="44" rx="10.2" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="10.6" fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="1" />
    </svg>
  );
}

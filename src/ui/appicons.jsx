// v11.0 — Nova icon set: flat & minimal.
//
// One flat color per tile, simple rounded corners, a clean centered glyph with
// generous padding, and only a whisper-faint hairline edge for definition — no
// sheen, no bevel, no gloss, no drop shadow. Calm and modern. Rolled out
// per-app: AppIconDisplay prefers NovaAppIcon for ids in NOVA_ICONS and falls
// back to legacy SVG / emoji for the rest until migrated.
//
// 48×48 viewBox; tile fills it, glyphs center on (24,24). A uniform 0.88 scale
// is applied to every glyph for consistent breathing room.

const SPECS = {
  files: {
    color: "#3b82f6",
    glyph: (<>
      <path d="M14 19 a2 2 0 0 1 2-2 h6 l2.6 2.6 H32 a2 2 0 0 1 2 2 v9.4 a2 2 0 0 1 -2 2 H16 a2 2 0 0 1 -2-2 Z" fill="#fff" />
    </>),
  },
  browser: {
    color: "#0ea7c4",
    glyph: (<>
      <circle cx="24" cy="24" r="9.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      <ellipse cx="24" cy="24" rx="4" ry="9.5" fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d="M14.6 21 H33.4 M14.6 27 H33.4" stroke="#fff" strokeWidth="1.4" />
    </>),
  },
  chat: {
    color: "#28b463",
    glyph: (<>
      <path d="M15 17 h18 a3.5 3.5 0 0 1 3.5 3.5 v7.8 a3.5 3.5 0 0 1 -3.5 3.5 H23.5 l-5.6 4.4 v-4.4 H15 a3.5 3.5 0 0 1 -3.5 -3.5 v-7.8 A3.5 3.5 0 0 1 15 17 Z" fill="#fff" />
      <g fill="#28b463"><circle cx="19.6" cy="24.4" r="1.7" /><circle cx="24" cy="24.4" r="1.7" /><circle cx="28.4" cy="24.4" r="1.7" /></g>
    </>),
  },
  settings: {
    color: "#64748b",
    glyph: (<>
      <g fill="#fff">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="22.6" y="9.8" width="2.8" height="5.6" rx="1.2" transform={`rotate(${a} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="8.2" fill="#fff" />
      <circle cx="24" cy="24" r="3.7" fill="#64748b" />
    </>),
  },
  store: {
    color: "#5570e6",
    glyph: (<>
      <path d="M15.5 20 h17 v12.4 a3 3 0 0 1 -3 3 H18.5 a3 3 0 0 1 -3 -3 Z" fill="#fff" />
      <path d="M19.6 20 v-1 a4.4 4.4 0 0 1 8.8 0 v1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </>),
  },
  notes: {
    color: "#f5b324",
    glyph: (<>
      <rect x="14" y="13" width="20" height="22" rx="2.6" fill="#fff" />
      <g stroke="#e7a01b" strokeWidth="1.8" strokeLinecap="round" opacity="0.7">
        <path d="M18 19.5 H30" /><path d="M18 24 H30" /><path d="M18 28.5 H26" />
      </g>
    </>),
  },
  tasks: {
    color: "#11a884",
    glyph: (<>
      <circle cx="18" cy="19.5" r="3.5" fill="#fff" />
      <polyline points="16.3,19.6 17.7,21 20,18.2" fill="none" stroke="#11a884" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23.5" y="18" width="11" height="2.8" rx="1.4" fill="#fff" />
      <circle cx="18" cy="29" r="3.5" fill="#fff" opacity="0.9" />
      <polyline points="16.3,29.1 17.7,30.5 20,27.7" fill="none" stroke="#11a884" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23.5" y="27.6" width="8.5" height="2.8" rx="1.4" fill="#fff" opacity="0.8" />
    </>),
  },
  calculator: {
    color: "#2d323d",
    glyph: (<>
      <rect x="14" y="13" width="20" height="6.4" rx="2" fill="#fff" />
      <g fill="#fff" opacity="0.9">
        <rect x="14" y="22" width="5.2" height="4.4" rx="1.4" /><rect x="21.4" y="22" width="5.2" height="4.4" rx="1.4" />
        <rect x="14" y="28.5" width="5.2" height="4.4" rx="1.4" /><rect x="21.4" y="28.5" width="5.2" height="4.4" rx="1.4" />
      </g>
      <rect x="28.8" y="22" width="5.2" height="10.9" rx="1.6" fill="#f5a623" />
    </>),
  },
  music: {
    color: "#f43f6b",
    glyph: (<>
      <g fill="#fff">
        <rect x="22" y="15" width="2" height="15.6" rx="1" /><rect x="31" y="13.3" width="2" height="15.6" rx="1" />
        <path d="M22 15 L33 13.3 V16.8 L22 18.5 Z" />
        <ellipse cx="20.4" cy="31" rx="3.5" ry="2.8" /><ellipse cx="29.4" cy="29.3" rx="3.5" ry="2.8" />
      </g>
    </>),
  },
  atmos: {
    color: "#3aa6f0",
    glyph: (<>
      <circle cx="20" cy="19.5" r="4.6" fill="#ffe06e" />
      <g stroke="#ffe06e" strokeWidth="1.5" strokeLinecap="round">
        <path d="M20 10.4 V12.6" /><path d="M11.2 19.5 H13.4" /><path d="M26.6 19.5 H28.8" />
        <path d="M13.8 13.3 l1.6 1.6" /><path d="M26.2 13.3 l-1.6 1.6" />
      </g>
      <g fill="#fff">
        <circle cx="21" cy="31" r="4.4" /><circle cx="27" cy="28.7" r="5.3" /><circle cx="31.7" cy="31.4" r="3.9" />
        <rect x="20" y="31" width="13" height="5" rx="2.5" />
      </g>
    </>),
  },
  photos: {
    color: "#f2f3f7",
    glyph: (<>
      {[{ a: 0, c: "#fb5c5c" }, { a: 60, c: "#ffae3a" }, { a: 120, c: "#ffd23d" }, { a: 180, c: "#4cc76b" }, { a: 240, c: "#4aa3ff" }, { a: 300, c: "#a86bff" }].map((p) => (
        <ellipse key={p.a} cx="24" cy="16.8" rx="4.1" ry="7" fill={p.c} transform={`rotate(${p.a} 24 24)`} opacity="0.95" />
      ))}
      <circle cx="24" cy="24" r="2.9" fill="#fff" />
    </>),
  },
  terminal: {
    color: "#1c2027",
    glyph: (<>
      <polyline points="16.5,20 21,24 16.5,28" fill="none" stroke="#4cef90" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23" y="26.2" width="8" height="2" rx="1" fill="#4cef90" />
    </>),
  },
};

export const NOVA_ICONS = new Set(Object.keys(SPECS));

export function NovaAppIcon({ id, size = 26 }) {
  const spec = SPECS[id];
  if (!spec) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
      <rect x="2" y="2" width="44" height="44" rx="10" fill={spec.color} />
      <g transform="translate(24 24) scale(0.88) translate(-24 -24)">{spec.glyph}</g>
      <rect x="2.5" y="2.5" width="43" height="43" rx="9.6" fill="none" stroke="#000" strokeOpacity="0.07" strokeWidth="1" />
    </svg>
  );
}

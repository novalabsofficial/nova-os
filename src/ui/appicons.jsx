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
    color: "#ec4899",
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
  paint: {
    color: "#8b5cf6",
    glyph: (<>
      <circle cx="24" cy="24" r="10.5" fill="#fff" />
      <circle cx="27.5" cy="29.5" r="2.6" fill="#8b5cf6" />
      <circle cx="18.5" cy="21" r="1.8" fill="#f43f6b" />
      <circle cx="24" cy="18.5" r="1.8" fill="#f5b324" />
      <circle cx="29" cy="21.5" r="1.8" fill="#3aa6f0" />
      <circle cx="18.5" cy="27" r="1.8" fill="#28b463" />
    </>),
  },
  snake: {
    color: "#57c84a",
    glyph: (<>
      <g fill="#fff">
        <rect x="13" y="20" width="6.2" height="6.2" rx="2" /><rect x="19.2" y="20" width="6.2" height="6.2" rx="2" />
        <rect x="19.2" y="26.2" width="6.2" height="6.2" rx="2" /><rect x="25.4" y="26.2" width="6.2" height="6.2" rx="2" />
      </g>
      <circle cx="31.5" cy="18.5" r="2.4" fill="#f43f6b" />
    </>),
  },
  "2048": {
    color: "#ed8f2e",
    glyph: (<>
      <rect x="13" y="13" width="9" height="9" rx="2.4" fill="#fff" opacity="0.55" />
      <rect x="26" y="13" width="9" height="9" rx="2.4" fill="#fff" opacity="0.8" />
      <rect x="13" y="26" width="9" height="9" rx="2.4" fill="#fff" />
      <rect x="26" y="26" width="9" height="9" rx="2.4" fill="#fff" opacity="0.7" />
    </>),
  },
  profile: {
    color: "#6366f1",
    glyph: (<>
      <circle cx="24" cy="19" r="5.4" fill="#fff" />
      <path d="M13.8 35 c0-5.9 4.6-9.4 10.2-9.4 s10.2 3.5 10.2 9.4 Z" fill="#fff" />
    </>),
  },
  clock: {
    color: "#ff7a59",
    glyph: (<>
      <circle cx="24" cy="24" r="10.5" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M24 24 V16.5 M24 24 L29 27" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </>),
  },
  calendar: {
    color: "#ef4444",
    glyph: (<>
      <g fill="#fff"><rect x="18" y="12" width="2.2" height="5" rx="1.1" /><rect x="27.8" y="12" width="2.2" height="5" rx="1.1" /></g>
      <rect x="13" y="15" width="22" height="20" rx="2.6" fill="#fff" />
      <rect x="13" y="15" width="22" height="6" rx="2.6" fill="#ef4444" />
      <rect x="13" y="18.5" width="22" height="2.5" fill="#ef4444" />
      <g fill="#ef4444" opacity="0.5"><circle cx="19" cy="27" r="1.4" /><circle cx="24" cy="27" r="1.4" /><circle cx="29" cy="27" r="1.4" /><circle cx="19" cy="31.5" r="1.4" /><circle cx="24" cy="31.5" r="1.4" /></g>
    </>),
  },
  pdf: {
    color: "#c0392b",
    glyph: (<>
      <path d="M16 13 h9 l7 7 v13 a2 2 0 0 1 -2 2 H16 a2 2 0 0 1 -2-2 V15 a2 2 0 0 1 2-2 Z" fill="#fff" />
      <path d="M25 13 v7 h7" fill="none" stroke="#c0392b" strokeWidth="1.6" strokeLinejoin="round" />
      <g stroke="#c0392b" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"><path d="M19 26 H29" /><path d="M19 30 H27" /></g>
    </>),
  },
  minesweeper: {
    color: "#475569",
    glyph: (<>
      <circle cx="23" cy="26" r="7.6" fill="#fff" />
      <path d="M28 21 l3.5 -3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32.5" cy="16.5" r="1.7" fill="#ffd23d" />
      <circle cx="20.3" cy="23.3" r="1.6" fill="#475569" />
    </>),
  },
  wordle: {
    color: "#6aaa64",
    glyph: (<>
      <rect x="11" y="20" width="8" height="8" rx="1.6" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="20" y="20" width="8" height="8" rx="1.6" fill="#fff" />
      <rect x="29" y="20" width="8" height="8" rx="1.6" fill="none" stroke="#fff" strokeWidth="2" />
    </>),
  },
  tetris: {
    color: "#7048d6",
    glyph: (<>
      <g fill="#fff">
        <rect x="14" y="19" width="6.4" height="6.4" rx="1.2" /><rect x="20.8" y="19" width="6.4" height="6.4" rx="1.2" />
        <rect x="27.6" y="19" width="6.4" height="6.4" rx="1.2" /><rect x="20.8" y="25.8" width="6.4" height="6.4" rx="1.2" />
      </g>
    </>),
  },
  novaai: {
    color: "#7c5cff",
    glyph: (<>
      <path d="M24 12.5 C25 18.5 25.5 19 31.5 21 C25.5 23 25 23.5 24 29.5 C23 23.5 22.5 23 16.5 21 C22.5 19 23 18.5 24 12.5 Z" fill="#fff" />
      <path d="M31.5 27 C31.9 29.4 32 29.5 34.5 30 C32 30.5 31.9 30.6 31.5 33 C31.1 30.6 31 30.5 28.5 30 C31 29.5 31.1 29.4 31.5 27 Z" fill="#fff" opacity="0.85" />
    </>),
  },
  tictactoe: {
    color: "#3b4252",
    glyph: (<>
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M20.7 14 V34" /><path d="M27.3 14 V34" /><path d="M14 20.7 H34" /><path d="M14 27.3 H34" />
      </g>
      <path d="M15.6 15.6 l3.5 3.5 M19.1 15.6 l-3.5 3.5" stroke="#fb6a86" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.5" fill="none" stroke="#57c6ff" strokeWidth="2" />
    </>),
  },
  pong: {
    color: "#0ea5a5",
    glyph: (<>
      <path d="M24 14 V34" stroke="#fff" strokeWidth="1.4" strokeDasharray="2 3" opacity="0.5" />
      <g fill="#fff"><rect x="13" y="18" width="3" height="12" rx="1.5" /><rect x="32" y="20" width="3" height="12" rx="1.5" /><circle cx="24" cy="24" r="2.4" /></g>
    </>),
  },
  flappy: {
    color: "#2fb0e8",
    glyph: (<>
      <circle cx="23" cy="24" r="7" fill="#fff" />
      <path d="M30 24 l4.5 -1.8 v3.6 Z" fill="#ff9f0a" />
      <circle cx="25.5" cy="22" r="1.5" fill="#1c2027" />
      <path d="M16.5 24.5 q-3.5 -0.5 -4.5 2.5 q3.5 1 5.5 -1 Z" fill="#fff" opacity="0.85" />
    </>),
  },
  invaders: {
    color: "#2b2f4a",
    glyph: (<>
      <g fill="#fff">
        <rect x="17" y="18" width="14" height="9" rx="2" />
        <rect x="13.5" y="21" width="3" height="5" /><rect x="31.5" y="21" width="3" height="5" />
        <rect x="17" y="27" width="3" height="3" /><rect x="28" y="27" width="3" height="3" /><rect x="22" y="27" width="4" height="4" />
      </g>
      <g fill="#2b2f4a"><rect x="20" y="21" width="2.6" height="2.6" /><rect x="25.4" y="21" width="2.6" height="2.6" /></g>
    </>),
  },
  pacman: {
    color: "#22262f",
    glyph: (<>
      <path d="M21 24 L28.8 19.5 A9 9 0 1 0 28.8 28.5 Z" fill="#ffce3d" />
      <circle cx="33" cy="24" r="1.6" fill="#fff" /><circle cx="37.5" cy="24" r="1.6" fill="#fff" opacity="0.8" />
    </>),
  },
  chess: {
    color: "#7a6450",
    glyph: (<>
      <path d="M24 13.5 a3.3 3.3 0 0 1 1.9 6 c1.7 1 2.7 2.9 2.7 4.8 h-9.2 c0-1.9 1-3.8 2.7-4.8 A3.3 3.3 0 0 1 24 13.5 Z" fill="#fff" />
      <path d="M19.5 25 h9 l1.6 8.5 h-12.2 Z" fill="#fff" />
      <rect x="16.5" y="33" width="15" height="2.6" rx="1.3" fill="#fff" />
    </>),
  },
  screenshot: {
    color: "#506072",
    glyph: (<>
      <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M16 20 V16 H20" /><path d="M28 16 H32 V20" /><path d="M32 28 V32 H28" /><path d="M20 32 H16 V28" />
      </g>
      <circle cx="24" cy="24" r="2" fill="#fff" />
    </>),
  },
  slides: {
    color: "#fb923c",
    glyph: (<>
      <rect x="13" y="14" width="22" height="16" rx="2.5" fill="#fff" />
      <g fill="#fb923c"><rect x="17" y="22" width="3" height="5" rx="0.6" /><rect x="22.5" y="19" width="3" height="8" rx="0.6" /><rect x="28" y="24" width="3" height="3" rx="0.6" /></g>
      <rect x="23" y="30" width="2" height="4" fill="#fff" /><rect x="18.5" y="34" width="11" height="2.2" rx="1.1" fill="#fff" />
    </>),
  },
  assetstudio: {
    color: "#c026d3",
    glyph: (<>
      <rect x="13.5" y="16" width="13" height="13" rx="2.6" fill="#fff" />
      <circle cx="29" cy="29" r="7" fill="none" stroke="#fff" strokeWidth="2.6" />
    </>),
  },
  atlas: {
    color: "#16b3a0",
    glyph: (<>
      <path d="M24 13 c-5 0-9 4-9 9 c0 6.6 9 14 9 14 s9-7.4 9-14 c0-5-4-9-9-9 Z" fill="#fff" />
      <circle cx="24" cy="22" r="3.3" fill="#16b3a0" />
    </>),
  },
  currency: {
    color: "#0fa36b",
    glyph: (<>
      <g stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21 H31" /><path d="M28 18 l3 3 -3 3" /><path d="M32 28 H17" /><path d="M20 25 l-3 3 3 3" />
      </g>
    </>),
  },
  dictionary: {
    color: "#5563de",
    glyph: (<>
      <path d="M24 17 c-3-2-7-2.4-10-1.9 v15.8 c3-0.5 7-0.1 10 1.9 c3-2 7-2.4 10-1.9 V15.1 c-3-0.5-7-0.1-10 1.9 Z" fill="#fff" />
      <path d="M24 17 V32.8" stroke="#5563de" strokeWidth="1.6" />
    </>),
  },
  translate: {
    color: "#4f8af0",
    glyph: (<>
      <g fill="#fff">
        <rect x="13" y="16.5" width="9" height="2.3" rx="1.1" /><rect x="13" y="20.5" width="6" height="2.3" rx="1.1" />
        <rect x="26" y="26.5" width="9" height="2.3" rx="1.1" /><rect x="29" y="30.5" width="6" height="2.3" rx="1.1" />
      </g>
      <path d="M21.5 30 l-3 3 -3 -3 M26.5 18 l3 -3 3 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>),
  },
  crypto: {
    color: "#f7931a",
    glyph: (<>
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <polyline points="18.5,27.5 22,23.5 25,26 29.5,20" fill="none" stroke="#f7931a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="26.5,20 29.5,20 29.5,23" fill="none" stroke="#f7931a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>),
  },
  qr: {
    color: "#eef0f4",
    glyph: (<>
      <g fill="none" stroke="#1c2027" strokeWidth="2">
        <rect x="13" y="13" width="8.5" height="8.5" rx="1.5" /><rect x="26.5" y="13" width="8.5" height="8.5" rx="1.5" /><rect x="13" y="26.5" width="8.5" height="8.5" rx="1.5" />
      </g>
      <g fill="#1c2027">
        <rect x="16" y="16" width="2.5" height="2.5" /><rect x="29.5" y="16" width="2.5" height="2.5" /><rect x="16" y="29.5" width="2.5" height="2.5" />
        <rect x="26.5" y="26.5" width="3" height="3" /><rect x="32" y="26.5" width="3" height="3" /><rect x="26.5" y="32" width="3" height="3" /><rect x="32" y="32" width="3" height="3" />
      </g>
    </>),
  },
  sudoku: {
    color: "#6d6fd6",
    glyph: (<>
      <rect x="14" y="14" width="20" height="20" rx="2" fill="none" stroke="#fff" strokeWidth="2" />
      <g stroke="#fff" strokeWidth="1.4" opacity="0.8"><path d="M20.7 14 V34" /><path d="M27.3 14 V34" /><path d="M14 20.7 H34" /><path d="M14 27.3 H34" /></g>
      <rect x="14.5" y="14.5" width="6.2" height="6.2" fill="#fff" opacity="0.85" />
    </>),
  },
  typing: {
    color: "#51607a",
    glyph: (<>
      <rect x="12" y="18" width="24" height="14" rx="2.5" fill="#fff" />
      <g fill="#51607a">
        <rect x="15" y="21" width="2.8" height="2.8" rx="0.7" /><rect x="19.3" y="21" width="2.8" height="2.8" rx="0.7" /><rect x="23.6" y="21" width="2.8" height="2.8" rx="0.7" /><rect x="27.9" y="21" width="2.8" height="2.8" rx="0.7" /><rect x="32.2" y="21" width="1.8" height="2.8" rx="0.7" />
        <rect x="18" y="27.5" width="12" height="2.6" rx="1" />
      </g>
    </>),
  },
  camera: {
    color: "#4b5bd6",
    glyph: (<>
      <rect x="13" y="18" width="22" height="14" rx="3" fill="#fff" />
      <rect x="19" y="14.5" width="7" height="4.5" rx="1.5" fill="#fff" />
      <circle cx="24" cy="25" r="4.6" fill="#4b5bd6" />
      <circle cx="24" cy="25" r="2.3" fill="#fff" />
      <circle cx="31" cy="21.5" r="1.2" fill="#4b5bd6" />
    </>),
  },
  recorder: {
    color: "#e0563b",
    glyph: (<>
      <rect x="20" y="13" width="8" height="15" rx="4" fill="#fff" />
      <path d="M16 24 a8 8 0 0 0 16 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="23" y="31.5" width="2" height="4.5" fill="#fff" />
      <rect x="19.5" y="35.5" width="9" height="2.2" rx="1.1" fill="#fff" />
    </>),
  },
  solitaire: {
    color: "#1f8a55",
    glyph: (<>
      <rect x="14" y="17" width="13" height="17" rx="2.5" fill="#fff" transform="rotate(-9 20.5 25.5)" />
      <rect x="20" y="15" width="13" height="17" rx="2.5" fill="#fff" />
      <path d="M26.5 20 c-1.3-2.1-4.1-1-4.1 1.1 c0 2 4.1 4.7 4.1 4.7 s4.1-2.7 4.1-4.7 c0-2.1-2.8-3.2-4.1-1.1 Z" fill="#e5484d" />
    </>),
  },
};

export const NOVA_ICONS = new Set(Object.keys(SPECS));

// Shade a hex toward white (amt>0) or black (amt<0) by `|amt|` (0..1). Used to
// derive the top-light / bottom-shade stops of each tile's gradient.
function shade(hex, amt) {
  let h = (hex || "#888888").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const t = amt < 0 ? 0 : 255, a = Math.abs(amt), m = c => Math.round(c + (t - c) * a);
  return "rgb(" + m(r) + "," + m(g) + "," + m(b) + ")";
}

// v11.0 — app-icon tile. Dead-flat fills read as "web project," but a sheen/
// bevel reads as dated gloss. The middle ground (Windows 11 / macOS): keep the
// flat minimal glyph style, add only a WHISPER of top-to-bottom gradient (a few
// % lighter at top, a few % darker at bottom) so the tile has quiet dimension,
// plus a crisp hairline edge. No sheen, no bevel.
export function NovaAppIcon({ id, size = 26 }) {
  const spec = SPECS[id];
  if (!spec) return null;
  const g = "nai-" + id;   // gradient id (identical per app id, safe to share across instances)
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={shade(spec.color, 0.07)} />
          <stop offset="100%" stopColor={shade(spec.color, -0.10)} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="11" fill={"url(#" + g + ")"} />
      <g transform="translate(24 24) scale(1.2) translate(-24 -24)">{spec.glyph}</g>
      <rect x="2.5" y="2.5" width="43" height="43" rx="10.6" fill="none" stroke="#000" strokeOpacity="0.10" strokeWidth="1" />
    </svg>
  );
}

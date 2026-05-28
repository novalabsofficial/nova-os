// Icon/widget positioning math. Reads window.innerWidth/Height — tests
// must run under jsdom (or set those globals explicitly).

import {
  TASKBAR_H,
  ICON_W,
  ICON_H,
  ICON_GAP,
  ICON_PAD_X,
  ICON_PAD_Y,
  WIDGET_SNAP,
} from "./constants.js";

export function defaultIconPos(i) {
  const availH = window.innerHeight - TASKBAR_H - ICON_PAD_Y - 10;
  const rows = Math.max(1, Math.floor(availH / (ICON_H + ICON_GAP)));
  return {
    x: ICON_PAD_X + Math.floor(i / rows) * (ICON_W + ICON_GAP),
    y: ICON_PAD_Y + (i % rows) * (ICON_H + ICON_GAP),
  };
}

/**
 * v9.3 (issue #21) — Lay out every desktop icon into a consistent grid for
 * the current viewport. Honors saved positions when they're still in bounds
 * and not colliding; for everything else, packs into the next available
 * column-major grid slot.
 *
 * Why this exists: the v8.x code did `iconPos[id] || defaultIconPos(idx)`
 * per icon at render time. defaultIconPos depends on the window height
 * (rows = floor(availH / cellHeight)), so resizing the window changed the
 * fallback positions of ALL un-saved icons — they "danced" around. Saved
 * icons could also drift off-screen entirely. This helper computes one
 * coherent layout per render: nothing moves unless it has to, and nothing
 * sits off-screen leaving a visible gap.
 *
 * Returns: { [iconId]: {x, y} }
 */
export function layoutIcons(icons, savedPos) {
  const cW = ICON_W + ICON_GAP;
  const cH = ICON_H + ICON_GAP;
  const maxC = Math.max(1, Math.floor((window.innerWidth - ICON_PAD_X) / cW));
  const availH = window.innerHeight - TASKBAR_H - ICON_PAD_Y - 10;
  const maxR = Math.max(1, Math.floor(availH / cH));
  const occupied = new Set();
  const out = {};

  // Pass 1: honour saved positions that snap to a valid in-bounds cell that
  // isn't already taken. (Two icons sharing the same saved cell is rare but
  // possible — earlier in-bounds wins, the loser falls through to pass 2.)
  for (const icon of icons) {
    const s = savedPos[icon.id];
    if (!s) continue;
    const col = Math.round((s.x - ICON_PAD_X) / cW);
    const row = Math.round((s.y - ICON_PAD_Y) / cH);
    if (col < 0 || col >= maxC || row < 0 || row >= maxR) continue;
    const key = col + "," + row;
    if (occupied.has(key)) continue;
    occupied.add(key);
    out[icon.id] = { x: ICON_PAD_X + col * cW, y: ICON_PAD_Y + row * cH };
  }

  // Pass 2: assign every remaining icon to the next unoccupied grid slot in
  // column-major order. Guarantees a compact layout with no gaps.
  let cursor = 0;
  for (const icon of icons) {
    if (out[icon.id]) continue;
    while (cursor < maxC * maxR) {
      const col = Math.floor(cursor / maxR);
      const row = cursor % maxR;
      cursor++;
      const key = col + "," + row;
      if (!occupied.has(key)) {
        occupied.add(key);
        out[icon.id] = { x: ICON_PAD_X + col * cW, y: ICON_PAD_Y + row * cH };
        break;
      }
    }
    // If we ran out of cells (more icons than fit), stack the extras at
    // (0,0) — bad case but graceful (rather than blowing up).
    if (!out[icon.id]) out[icon.id] = { x: ICON_PAD_X, y: ICON_PAD_Y };
  }

  return out;
}

export function snapToFreeGrid(dragId, rawX, rawY, allPos) {
  const cW = ICON_W + ICON_GAP;
  const cH = ICON_H + ICON_GAP;
  const maxC = Math.floor((window.innerWidth - ICON_PAD_X) / cW);
  const maxR = Math.floor((window.innerHeight - TASKBAR_H - ICON_PAD_Y) / cH);
  const tc = Math.max(0, Math.min(Math.round((rawX - ICON_PAD_X) / cW), maxC - 1));
  const tr = Math.max(0, Math.min(Math.round((rawY - ICON_PAD_Y) / cH), maxR - 1));
  const occ = new Set();
  Object.entries(allPos).forEach(([id, pos]) => {
    if (id === dragId) return;
    occ.add(Math.round((pos.x - ICON_PAD_X) / cW) + "," + Math.round((pos.y - ICON_PAD_Y) / cH));
  });
  const vis = new Set([tc + "," + tr]);
  const q = [[tc, tr]];
  while (q.length) {
    const [c, r] = q.shift();
    if (c >= 0 && r >= 0 && c < maxC && r < maxR && !occ.has(c + "," + r)) {
      return { x: ICON_PAD_X + c * cW, y: ICON_PAD_Y + r * cH };
    }
    for (const [dc, dr] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nk = (c + dc) + "," + (r + dr);
      if (!vis.has(nk)) {
        vis.add(nk);
        q.push([c + dc, r + dr]);
      }
    }
  }
  return { x: ICON_PAD_X + tc * cW, y: ICON_PAD_Y + tr * cH };
}

export function snapW(x, y) {
  const g = WIDGET_SNAP;
  return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
}

/**
 * v8.0 — Snap a widget's width and height to the same WIDGET_SNAP grid that
 * positions snap to. Respects per-widget minimum sizes (so a snap-down can
 * never shrink a widget below its registered minimum dimensions).
 *
 * With both snapW() (position) and snapWSize() (dimensions) applied at the
 * end of every drag/resize, all four edges of a widget always land on grid
 * lines — meaning two widgets aligned next to each other look perfectly
 * lined up even after independent resize operations.
 */
export function snapWSize(w, h, minW = 0, minH = 0) {
  const g = WIDGET_SNAP;
  return {
    w: Math.max(minW, Math.round(w / g) * g),
    h: Math.max(minH, Math.round(h / g) * g),
  };
}

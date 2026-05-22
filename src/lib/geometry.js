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

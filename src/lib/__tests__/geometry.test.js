import { describe, it, expect, beforeEach } from 'vitest';
import { defaultIconPos, snapToFreeGrid, snapW } from '../geometry.js';
import {
  TASKBAR_H, TOPBAR_H, ICON_W, ICON_H, ICON_GAP, ICON_PAD_X, ICON_PAD_Y,
} from '../constants.js';

// v11.1 — the icon grid starts BELOW the top status bar, so its y-origin is
// ICON_PAD_Y + TOPBAR_H (not just ICON_PAD_Y). TOP captures that origin.
const TOP = ICON_PAD_Y + TOPBAR_H;

// Pin window dimensions so layout math is deterministic across machines.
// 1024×768 is the jsdom default but we set explicitly so a future config
// change doesn't silently move our expected coordinates.
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth',  { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768,  configurable: true });
});

describe('defaultIconPos', () => {
  // At 768px tall: availH = 768 - TASKBAR_H(66) - TOP(46) - 10 = 646;
  // rows = floor(646 / (ICON_H 78 + ICON_GAP 6 = 84)) = 7.
  const ROWS = 7;
  const CW = ICON_W + ICON_GAP; // column width
  const CH = ICON_H + ICON_GAP; // row height

  it('places icon 0 at the top-left padding offset (below the top bar)', () => {
    expect(defaultIconPos(0)).toEqual({ x: ICON_PAD_X, y: TOP });
  });

  it('fills the first column top-to-bottom', () => {
    expect(defaultIconPos(1)).toEqual({ x: ICON_PAD_X,        y: TOP + CH });
    expect(defaultIconPos(ROWS - 1)).toEqual({ x: ICON_PAD_X, y: TOP + (ROWS - 1) * CH });
  });

  it('wraps to the next column after filling a column', () => {
    expect(defaultIconPos(ROWS)).toEqual({ x: ICON_PAD_X + CW, y: TOP });
  });

  it('places icons into the third column at index 2*ROWS', () => {
    expect(defaultIconPos(2 * ROWS)).toEqual({ x: ICON_PAD_X + 2 * CW, y: TOP });
  });
});

describe('snapW', () => {
  it('snaps to the nearest 20px multiple', () => {
    expect(snapW(0, 0)).toEqual({ x: 0, y: 0 });
    expect(snapW(10, 10)).toEqual({ x: 20, y: 20 });  // halfway rounds up
    expect(snapW(9, 9)).toEqual({ x: 0, y: 0 });      // under halfway rounds down
    expect(snapW(30, 30)).toEqual({ x: 40, y: 40 });
    expect(snapW(60, 60)).toEqual({ x: 60, y: 60 });
  });

  it('snaps x and y independently', () => {
    expect(snapW(13, 47)).toEqual({ x: 20, y: 40 });
  });
});

describe('snapToFreeGrid', () => {
  // Helpers to translate cell coordinates to pixel positions, so tests
  // read in cells (intuitive) but compare in pixels (what the fn returns).
  // y-origin is TOP (icon padding + top-bar band).
  const CW = ICON_W + ICON_GAP;
  const CH = ICON_H + ICON_GAP;
  const cell = (c, r) => ({ x: ICON_PAD_X + c * CW, y: TOP + r * CH });
  const pixelAt = (c, r) => ({ x: ICON_PAD_X + c * CW, y: TOP + r * CH });

  it('snaps raw coords to the nearest cell when nothing is in the way', () => {
    // Drop "icon-A" near cell (1, 2) with no other occupants → returns cell (1,2).
    const target = pixelAt(1, 2);
    const result = snapToFreeGrid('icon-A', target.x + 5, target.y - 5, {
      'icon-A': cell(1, 2), // the icon's own current position should be ignored
    });
    expect(result).toEqual(pixelAt(1, 2));
  });

  it('falls back to a neighbor when the target cell is occupied', () => {
    // Target (1,2) is occupied by another icon → must return a different cell.
    const target = pixelAt(1, 2);
    const result = snapToFreeGrid('dragging', target.x, target.y, {
      occupant: cell(1, 2),
    });
    expect(result).not.toEqual(pixelAt(1, 2));
    // BFS visits neighbors in [s, e, n, w, se, ne, sw, nw] order — first free is (1,3).
    expect(result).toEqual(pixelAt(1, 3));
  });

  it('clamps to the rightmost column when raw x is beyond screen width', () => {
    // maxC = floor((1024 - 10) / (ICON_W 76 + ICON_GAP 6 = 82)) = 12 → valid columns 0..11
    const result = snapToFreeGrid('icon-A', 9999, TOP, {});
    expect(result).toEqual(pixelAt(11, 0));
  });

  it('clamps to row 0 when raw y is negative', () => {
    const result = snapToFreeGrid('icon-A', ICON_PAD_X, -500, {});
    expect(result).toEqual(pixelAt(0, 0));
  });
});

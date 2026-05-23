import { describe, it, expect } from 'vitest';
import { createBoard, floodReveal, isWin, mineTotal, MINE_DIFFICULTIES } from '../minesweeper.js';

// A deterministic RNG so tests don't rely on Math.random.
// Linear congruential generator — boring but enough for shuffle tests.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('createBoard', () => {
  it('places exactly the requested number of mines', () => {
    const b = createBoard(9, 9, 10, null, null, makeRng(42));
    expect(mineTotal(b)).toBe(10);
  });

  it('produces a board of the requested dimensions', () => {
    const b = createBoard(7, 12, 5, null, null, makeRng(1));
    expect(b.length).toBe(7);
    expect(b[0].length).toBe(12);
  });

  it('guarantees the safe cell is not a mine (first-click safety)', () => {
    // Try several seeds — invariant must hold every time
    for (let seed = 1; seed <= 20; seed++) {
      const b = createBoard(5, 5, 20, 2, 2, makeRng(seed));
      expect(b[2][2].isMine).toBe(false);
    }
  });

  it('keeps the 3×3 area around the safe cell mine-free when there is room', () => {
    // 9×9 with only 10 mines — plenty of room to reserve the 3x3 around (4,4).
    for (let seed = 1; seed <= 10; seed++) {
      const b = createBoard(9, 9, 10, 4, 4, makeRng(seed));
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          expect(b[4 + dr][4 + dc].isMine).toBe(false);
        }
      }
    }
  });

  it('computes correct neighbor counts', () => {
    // Force a known mine layout by stubbing rng to always pick the first
    // candidate, then verifying neighbors around it.
    // Easier: build a board and spot-check the count math by re-counting manually.
    const b = createBoard(5, 5, 5, null, null, makeRng(7));
    const rows = b.length, cols = b[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (b[r][c].isMine) continue;
        let expected = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (b[nr][nc].isMine) expected++;
          }
        }
        expect(b[r][c].neighbors).toBe(expected);
      }
    }
  });

  it('throws if asked to place more mines than fit', () => {
    expect(() => createBoard(2, 2, 5)).toThrow();
  });
});

describe('floodReveal', () => {
  it('returns just the clicked cell when it has neighbors > 0', () => {
    // Hand-build a tiny board: mine at (0,0), click at (0,1) which has 1 neighbor mine.
    const b = [
      [{ isMine: true, neighbors: 0 }, { isMine: false, neighbors: 1 }],
      [{ isMine: false, neighbors: 1 }, { isMine: false, neighbors: 1 }],
    ];
    const out = floodReveal(b, 0, 1);
    expect(out.has('0,1')).toBe(true);
    expect(out.size).toBe(1);
  });

  it('returns just the clicked cell when it is a mine', () => {
    const b = [[{ isMine: true, neighbors: 0 }]];
    const out = floodReveal(b, 0, 0);
    expect(out.has('0,0')).toBe(true);
    expect(out.size).toBe(1);
  });

  it('floods through 0-neighbor cells and stops at numbered cells', () => {
    // 3x3 with a single mine in the corner — most cells are 0 or 1.
    //   . . .
    //   . . 1
    //   . 1 M
    const b = [
      [{ isMine: false, neighbors: 0 }, { isMine: false, neighbors: 0 }, { isMine: false, neighbors: 1 }],
      [{ isMine: false, neighbors: 0 }, { isMine: false, neighbors: 1 }, { isMine: false, neighbors: 1 }],
      [{ isMine: false, neighbors: 0 }, { isMine: false, neighbors: 1 }, { isMine: true,  neighbors: 0 }],
    ];
    const out = floodReveal(b, 0, 0);
    // Every non-mine cell should be revealed in one click from the empty corner.
    expect(out.size).toBe(8);
    expect(out.has('2,2')).toBe(false); // the mine
  });
});

describe('isWin', () => {
  it('is true when every non-mine cell is revealed', () => {
    const b = [
      [{ isMine: false, neighbors: 1 }, { isMine: true,  neighbors: 0 }],
      [{ isMine: false, neighbors: 1 }, { isMine: false, neighbors: 1 }],
    ];
    expect(isWin(b, new Set(['0,0', '1,0', '1,1']))).toBe(true);
  });

  it('is false if any non-mine cell is still unrevealed', () => {
    const b = [
      [{ isMine: false, neighbors: 1 }, { isMine: true,  neighbors: 0 }],
      [{ isMine: false, neighbors: 1 }, { isMine: false, neighbors: 1 }],
    ];
    expect(isWin(b, new Set(['0,0', '1,0']))).toBe(false);
  });
});

describe('MINE_DIFFICULTIES', () => {
  it('exposes easy/medium/hard presets with sensible mine counts', () => {
    expect(MINE_DIFFICULTIES.easy.mines).toBeGreaterThan(0);
    expect(MINE_DIFFICULTIES.hard.mines).toBeGreaterThan(MINE_DIFFICULTIES.easy.mines);
    // No preset should put more mines than fit on its grid
    for (const k of Object.keys(MINE_DIFFICULTIES)) {
      const d = MINE_DIFFICULTIES[k];
      expect(d.mines).toBeLessThan(d.rows * d.cols);
    }
  });
});

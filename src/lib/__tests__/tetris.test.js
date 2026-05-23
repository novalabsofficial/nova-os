import { describe, it, expect } from 'vitest';
import {
  PIECES, PIECE_COLORS,
  emptyGrid, randomPiece, shapeOf, fits, lockPiece, clearLines,
  scoreForLines, tickInterval,
  BOARD_W, BOARD_H,
} from '../tetris.js';

describe('emptyGrid', () => {
  it('returns the right dimensions and all zeros', () => {
    const g = emptyGrid();
    expect(g.length).toBe(BOARD_H);
    expect(g[0].length).toBe(BOARD_W);
    for (const row of g) for (const cell of row) expect(cell).toBe(0);
  });
});

describe('PIECES', () => {
  it('defines exactly 7 tetrominoes', () => {
    expect(Object.keys(PIECES).sort()).toEqual(['I','J','L','O','S','T','Z']);
  });

  it('every piece has 4 rotation states', () => {
    for (const name of Object.keys(PIECES)) {
      expect(PIECES[name].shapes.length).toBe(4);
    }
  });

  it('every piece has exactly 4 filled cells in each rotation', () => {
    for (const name of Object.keys(PIECES)) {
      for (const shape of PIECES[name].shapes) {
        let filled = 0;
        for (const row of shape) for (const cell of row) if (cell) filled++;
        expect(filled).toBe(4);
      }
    }
  });

  it('O piece is rotationally symmetric (all shapes identical)', () => {
    const [a, b, c, d] = PIECES.O.shapes;
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(d).toEqual(a);
  });
});

describe('randomPiece', () => {
  it('spawns the piece centered horizontally on the playfield', () => {
    const p = randomPiece(() => 0);  // always picks first piece (I)
    expect(p.name).toBe('I');
    expect(p.row).toBe(0);
    // I-piece shape is 4 wide, board is 10 wide → col = 3
    expect(p.col).toBe(3);
  });

  it('returns one of the seven defined names', () => {
    const names = new Set();
    let rng = 0;
    for (let i = 0; i < 50; i++) names.add(randomPiece(() => (rng++ * 0.137) % 1).name);
    // Should hit a few different ones
    expect(names.size).toBeGreaterThan(2);
    for (const n of names) expect(PIECES[n]).toBeDefined();
  });
});

describe('fits', () => {
  it('returns true for a fresh piece on an empty grid', () => {
    const g = emptyGrid();
    const p = randomPiece(() => 0);
    expect(fits(g, p)).toBe(true);
  });

  it('returns false when the piece would go past the left/right wall', () => {
    const g = emptyGrid();
    const p = randomPiece(() => 0); // I piece at col 3
    expect(fits(g, p, p.row, -2)).toBe(false);    // left wall
    expect(fits(g, p, p.row, BOARD_W)).toBe(false); // right wall
  });

  it('returns false when the piece would go past the floor', () => {
    const g = emptyGrid();
    const p = randomPiece(() => 0);
    expect(fits(g, p, BOARD_H, p.col)).toBe(false);
  });

  it('returns false when the piece would overlap a filled cell', () => {
    const g = emptyGrid();
    // Block the spawn position
    g[1][5] = 1;
    const p = { ...randomPiece(() => 0), col: 3 }; // I piece occupies row 1, cols 3-6
    expect(fits(g, p)).toBe(false);
  });
});

describe('lockPiece', () => {
  it('writes the piece color into every cell it occupies', () => {
    const g = emptyGrid();
    const p = randomPiece(() => 0); // I piece
    const locked = lockPiece(g, p);
    // I piece row-0 shape has its row at index 1, all 4 cols filled
    for (let c = p.col; c < p.col + 4; c++) {
      expect(locked[p.row + 1][c]).toBe(p.color);
    }
  });

  it('does not mutate the input grid', () => {
    const g = emptyGrid();
    const p = randomPiece(() => 0);
    lockPiece(g, p);
    for (const row of g) for (const cell of row) expect(cell).toBe(0);
  });
});

describe('clearLines', () => {
  it('clears a single full row and reports 1 line', () => {
    const g = emptyGrid();
    for (let c = 0; c < BOARD_W; c++) g[BOARD_H - 1][c] = 3;
    const { grid, linesCleared } = clearLines(g);
    expect(linesCleared).toBe(1);
    // Bottom row should now be empty (everything shifted down by 1)
    expect(grid[BOARD_H - 1].every(c => c === 0)).toBe(true);
  });

  it('clears multiple full rows at once (a "Tetris")', () => {
    const g = emptyGrid();
    for (let r = BOARD_H - 4; r < BOARD_H; r++) {
      for (let c = 0; c < BOARD_W; c++) g[r][c] = 1;
    }
    const { linesCleared } = clearLines(g);
    expect(linesCleared).toBe(4);
  });

  it('does not clear rows with gaps', () => {
    const g = emptyGrid();
    for (let c = 0; c < BOARD_W - 1; c++) g[BOARD_H - 1][c] = 1;  // one gap
    const { linesCleared } = clearLines(g);
    expect(linesCleared).toBe(0);
  });

  it('does not mutate the input', () => {
    const g = emptyGrid();
    for (let c = 0; c < BOARD_W; c++) g[BOARD_H - 1][c] = 5;
    clearLines(g);
    // Original bottom row should still be full
    expect(g[BOARD_H - 1].every(c => c === 5)).toBe(true);
  });
});

describe('scoreForLines', () => {
  it('uses the standard scoring table', () => {
    expect(scoreForLines(1, 1)).toBe(100);
    expect(scoreForLines(2, 1)).toBe(300);
    expect(scoreForLines(3, 1)).toBe(500);
    expect(scoreForLines(4, 1)).toBe(800);
  });

  it('multiplies by the current level', () => {
    expect(scoreForLines(1, 5)).toBe(500);
    expect(scoreForLines(4, 3)).toBe(2400);
  });

  it('returns 0 for no lines', () => {
    expect(scoreForLines(0, 1)).toBe(0);
  });
});

describe('tickInterval', () => {
  it('gets faster at higher levels', () => {
    expect(tickInterval(2)).toBeLessThan(tickInterval(1));
    expect(tickInterval(5)).toBeLessThan(tickInterval(2));
  });

  it('has a minimum floor so it does not become unplayable', () => {
    expect(tickInterval(100)).toBeGreaterThanOrEqual(80);
  });
});

describe('PIECE_COLORS', () => {
  it('has 8 entries (index 0 = empty + 7 pieces)', () => {
    expect(PIECE_COLORS.length).toBe(8);
    expect(PIECE_COLORS[0]).toBe('');
  });
});

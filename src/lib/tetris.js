// Tetris piece definitions + collision/rotation/line-clear logic.
//
// Each piece has 4 rotation states represented as 4x4 grids of 0/1 (where 1
// means "this cell is part of the piece"). The piece's position (row, col)
// places its top-left at that point on the playfield.
//
// Color codes:
//   1=cyan(I), 2=yellow(O), 3=purple(T), 4=green(S), 5=red(Z), 6=blue(J), 7=orange(L)
// Color 0 means empty on the playfield.

export const BOARD_W = 10;
export const BOARD_H = 20;

export const PIECE_COLORS = ["", "#22d3ee", "#fbbf24", "#a855f7", "#4cef90", "#ff6b6b", "#3b82f6", "#fb923c"];

export const PIECES = {
  I: {
    color: 1,
    shapes: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    ],
  },
  O: {
    color: 2,
    shapes: [
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    ],
  },
  T: {
    color: 3,
    shapes: [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]],
    ],
  },
  S: {
    color: 4,
    shapes: [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]],
      [[0,0,0],[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,0],[0,1,0]],
    ],
  },
  Z: {
    color: 5,
    shapes: [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,0],[0,1,1]],
      [[0,1,0],[1,1,0],[1,0,0]],
    ],
  },
  J: {
    color: 6,
    shapes: [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]],
    ],
  },
  L: {
    color: 7,
    shapes: [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]],
    ],
  },
};

const PIECE_NAMES = Object.keys(PIECES);

/** Returns an empty playfield (a BOARD_H x BOARD_W array of zeros). */
export function emptyGrid() {
  return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(0));
}

/**
 * Pick a random piece. Returns a fresh piece object ready to spawn at top center.
 * @param {() => number} [rng] random source
 */
export function randomPiece(rng = Math.random) {
  const name = PIECE_NAMES[Math.floor(rng() * PIECE_NAMES.length)];
  const def = PIECES[name];
  // Center the piece on the playfield (column 3 is left edge of a 4-wide spawn).
  // Each piece's shape grid has its own size — use the actual shape width.
  const shape = def.shapes[0];
  const w = shape[0].length;
  return {
    name,
    rotation: 0,
    color: def.color,
    row: 0,
    col: Math.floor((BOARD_W - w) / 2),
  };
}

/** Returns the 2D shape array for a piece in its current rotation. */
export function shapeOf(piece) {
  return PIECES[piece.name].shapes[piece.rotation % 4];
}

/**
 * Returns true if the piece (at the given row/col/rotation) fits on the grid:
 *   - every filled cell of the shape is inside the playfield
 *   - every filled cell maps to an empty cell of the grid
 */
export function fits(grid, piece, row = piece.row, col = piece.col, rotation = piece.rotation) {
  const shape = PIECES[piece.name].shapes[rotation % 4];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gr = row + r, gc = col + c;
      if (gr < 0 || gr >= BOARD_H || gc < 0 || gc >= BOARD_W) return false;
      if (grid[gr][gc] !== 0) return false;
    }
  }
  return true;
}

/**
 * Lock the piece into the grid (writes its color to each occupied cell)
 * and return a new grid. Doesn't mutate the input.
 */
export function lockPiece(grid, piece) {
  const next = grid.map(row => row.slice());
  const shape = shapeOf(piece);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gr = piece.row + r, gc = piece.col + c;
      if (gr >= 0 && gr < BOARD_H && gc >= 0 && gc < BOARD_W) {
        next[gr][gc] = piece.color;
      }
    }
  }
  return next;
}

/**
 * Remove any completed rows from the grid and shift everything down.
 * Returns { grid, linesCleared }.
 */
export function clearLines(grid) {
  const kept = [];
  let cleared = 0;
  for (const row of grid) {
    if (row.every(cell => cell !== 0)) { cleared++; continue; }
    kept.push(row);
  }
  const empties = Array.from({ length: cleared }, () => Array(BOARD_W).fill(0));
  return { grid: [...empties, ...kept], linesCleared: cleared };
}

/**
 * Standard Tetris scoring for a single line-clear event.
 *   1 line  = 100 * level
 *   2 lines = 300 * level
 *   3 lines = 500 * level
 *   4 lines = 800 * level  (a "Tetris")
 */
export function scoreForLines(lines, level) {
  const base = [0, 100, 300, 500, 800][lines] || 0;
  return base * level;
}

/** Tick interval (ms) at the given level — gets faster as you progress. */
export function tickInterval(level) {
  return Math.max(80, 600 - (level - 1) * 60);
}

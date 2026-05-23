// Minesweeper board logic. Kept pure (no React, no DOM) so the gameplay
// invariants — mine count, first-click safety, flood-reveal correctness —
// can be unit-tested without touching the UI.
//
// Board representation: rows x cols array of cell objects:
//   { isMine: boolean, neighbors: number }   (neighbors only meaningful when isMine === false)
//
// "Reveal" / "flag" state is kept by the React component, not the board,
// so the board itself is immutable after generation.

/**
 * Generate a Minesweeper board.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {number} mineCount
 * @param {number|null} safeR  row of guaranteed-safe cell (first click), or null
 * @param {number|null} safeC  col of guaranteed-safe cell (first click), or null
 * @param {() => number} [rng] random source (defaults to Math.random) — exposed for tests
 * @returns {{ isMine: boolean, neighbors: number }[][]}
 */
export function createBoard(rows, cols, mineCount, safeR = null, safeC = null, rng = Math.random) {
  const total = rows * cols;
  if (mineCount > total - 1) throw new Error("too many mines for grid size");

  // Pool of valid cell indices, excluding the safe-cell and (optionally) its neighbors
  // so the first click always lands in a 0-neighbor cell when possible.
  const safeZone = new Set();
  if (safeR !== null && safeC !== null) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeR + dr, c = safeC + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) safeZone.add(r * cols + c);
      }
    }
  }
  const pool = [];
  for (let i = 0; i < total; i++) if (!safeZone.has(i)) pool.push(i);
  // If too few non-safe cells remain to fit the mines, fall back to just the
  // safe cell itself (don't expand the safe zone). Sane for tiny boards.
  if (pool.length < mineCount) {
    pool.length = 0;
    for (let i = 0; i < total; i++) if (!(safeR !== null && safeC !== null && i === safeR * cols + safeC)) pool.push(i);
  }
  // Partial Fisher-Yates: pick `mineCount` random elements from `pool`.
  for (let i = 0; i < mineCount && i < pool.length; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const mineSet = new Set(pool.slice(0, mineCount));

  const board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ isMine: mineSet.has(r * cols + c), neighbors: 0 });
    }
    board.push(row);
  }
  // Compute neighbor counts for non-mine cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (board[nr][nc].isMine) n++;
        }
      }
      board[r][c].neighbors = n;
    }
  }
  return board;
}

/**
 * BFS flood-reveal starting at (r,c). Returns a Set of "r,c" keys to mark
 * revealed. Stops expansion at any cell with neighbors > 0 (which is still
 * included in the result so its number gets shown).
 *
 * Returns just {"r,c"} if (r,c) is a mine — caller handles game-over.
 */
export function floodReveal(board, r, c) {
  const out = new Set();
  if (!board[r] || !board[r][c]) return out;
  if (board[r][c].isMine) { out.add(r + "," + c); return out; }

  const rows = board.length, cols = board[0].length;
  const queue = [[r, c]];
  out.add(r + "," + c);
  while (queue.length) {
    const [cr, cc] = queue.shift();
    if (board[cr][cc].neighbors !== 0) continue; // only flood through empties
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const k = nr + "," + nc;
        if (out.has(k)) continue;
        if (board[nr][nc].isMine) continue;
        out.add(k);
        queue.push([nr, nc]);
      }
    }
  }
  return out;
}

/** Win when every non-mine cell is revealed. */
export function isWin(board, revealed) {
  let nonMineCount = 0;
  for (const row of board) for (const cell of row) if (!cell.isMine) nonMineCount++;
  return revealed.size === nonMineCount;
}

/** Total mine count on the board — useful for the "mines remaining" UI. */
export function mineTotal(board) {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell.isMine) n++;
  return n;
}

// Difficulty presets. UI selects one of these when starting a new game.
export const MINE_DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 12, cols: 12, mines: 22 },
  hard:   { rows: 14, cols: 14, mines: 34 },
};

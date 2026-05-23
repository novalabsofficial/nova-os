import { describe, it, expect } from 'vitest';
import { WORDS, dailyWord, scoreGuess, normalizeGuess } from '../wordle.js';

describe('WORDS', () => {
  it('contains only 5-letter uppercase A-Z words', () => {
    for (const w of WORDS) {
      expect(w).toMatch(/^[A-Z]{5}$/);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('contains at least 100 words', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(100);
  });
});

describe('dailyWord', () => {
  it('returns the same word for the same date', () => {
    const d = new Date('2026-05-15T10:30:00Z');
    expect(dailyWord(d)).toBe(dailyWord(d));
  });

  it('returns a different word for different dates (usually)', () => {
    // Sample 7 consecutive days; we expect at least 5 distinct picks.
    const base = Date.UTC(2026, 0, 1);
    const picks = new Set();
    for (let i = 0; i < 7; i++) {
      picks.add(dailyWord(new Date(base + i * 86400000)));
    }
    expect(picks.size).toBeGreaterThanOrEqual(5);
  });

  it('always returns a word from the WORDS pool', () => {
    const wordSet = new Set(WORDS);
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
      expect(wordSet.has(dailyWord(d))).toBe(true);
    }
  });

  it('is timezone-independent (uses UTC date components)', () => {
    // Same UTC day across different local times should produce the same word
    const d1 = new Date('2026-06-15T00:00:00Z');
    const d2 = new Date('2026-06-15T23:59:59Z');
    expect(dailyWord(d1)).toBe(dailyWord(d2));
  });
});

describe('scoreGuess', () => {
  it('returns all "correct" when guess matches answer', () => {
    expect(scoreGuess('APPLE', 'APPLE')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('returns all "absent" when no letters overlap', () => {
    expect(scoreGuess('QUICK', 'JUMP_'.replace('_','S'))).toEqual(expect.any(Array));
    // Use a cleaner example
    expect(scoreGuess('ABCDE', 'FGHIJ')).toEqual(['absent', 'absent', 'absent', 'absent', 'absent']);
  });

  it('marks correct positions vs. wrong positions', () => {
    // Answer: BRAVE, guess: BRAIN
    //   B B → correct
    //   R R → correct
    //   A A → correct
    //   I V → absent
    //   N E → absent
    expect(scoreGuess('BRAIN', 'BRAVE')).toEqual(['correct', 'correct', 'correct', 'absent', 'absent']);
  });

  it('marks "present" for letters in the answer but in wrong position', () => {
    // Answer: HEART, guess: TEACH
    //   T H → absent (T is in answer but at index 4 — we mark "present")
    // Wait, T IS in HEART at index 4. So T at index 0 should be "present".
    //   T → present (in answer, wrong pos)
    //   E → correct (HEART[1]=E)
    //   A → correct (HEART[2]=A)
    //   C → absent
    //   H → present (HEART[0]=H)
    expect(scoreGuess('TEACH', 'HEART')).toEqual(['present', 'correct', 'correct', 'absent', 'present']);
  });

  // The classic Wordle gotcha: duplicate letters in the guess vs. answer.
  it('does NOT mark extra duplicate letters as present (the "ROBOT/FOOOO" case)', () => {
    // Answer: ROBOT  contains 2 Os (positions 1 and 3)
    // Guess:  FOOOO  contains 4 Os
    //   F     → absent
    //   O@1   → correct (matches ROBOT[1]) — consumes one O from the answer
    //   O@3   → correct (matches ROBOT[3]) — consumes the other O
    //   O@2,4 → absent  (no Os left in answer to assign as "present")
    expect(scoreGuess('FOOOO', 'ROBOT')).toEqual(['absent', 'correct', 'absent', 'correct', 'absent']);
  });

  it('handles double letters in the answer properly', () => {
    // Answer: APPLE — two Ps
    // Guess:  PAPER
    //   P → present (matches APPLE[1] or APPLE[2])
    //   A → present (matches APPLE[0])
    //   P → correct (APPLE[2]=P)
    //   E → present (APPLE[4]=E)
    //   R → absent
    expect(scoreGuess('PAPER', 'APPLE')).toEqual(['present', 'present', 'correct', 'present', 'absent']);
  });

  it('returns [] for mismatched lengths or non-string input', () => {
    expect(scoreGuess('ABC', 'ABCDE')).toEqual([]);
    expect(scoreGuess(null, 'ABCDE')).toEqual([]);
    expect(scoreGuess('ABCDE', undefined)).toEqual([]);
  });
});

describe('normalizeGuess', () => {
  it('uppercases valid 5-letter input', () => {
    expect(normalizeGuess('apple')).toBe('APPLE');
    expect(normalizeGuess('Apple')).toBe('APPLE');
  });

  it('trims whitespace', () => {
    expect(normalizeGuess('  apple  ')).toBe('APPLE');
  });

  it('returns null for wrong length', () => {
    expect(normalizeGuess('apples')).toBeNull();
    expect(normalizeGuess('abc')).toBeNull();
    expect(normalizeGuess('')).toBeNull();
  });

  it('returns null for non-letter input', () => {
    expect(normalizeGuess('apple1')).toBeNull();
    expect(normalizeGuess('appl3')).toBeNull();
    expect(normalizeGuess('app le')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(normalizeGuess(null)).toBeNull();
    expect(normalizeGuess(undefined)).toBeNull();
    expect(normalizeGuess(12345)).toBeNull();
  });
});

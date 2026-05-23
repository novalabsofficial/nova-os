import { describe, it, expect } from 'vitest';
import { applyOp, formatDisplay, toggleSign, appendKey } from '../calc.js';

describe('applyOp', () => {
  it('handles all four basic operators', () => {
    expect(applyOp(2, '+', 3)).toBe(5);
    expect(applyOp(5, '-', 2)).toBe(3);
    expect(applyOp(4, '×', 3)).toBe(12);
    expect(applyOp(10, '÷', 4)).toBe(2.5);
  });

  it('accepts ASCII * and / aliases', () => {
    expect(applyOp(4, '*', 3)).toBe(12);
    expect(applyOp(10, '/', 4)).toBe(2.5);
  });

  it('returns Infinity for divide by zero', () => {
    expect(applyOp(1, '÷', 0)).toBe(Infinity);
    expect(applyOp(-1, '÷', 0)).toBe(-Infinity);
  });

  it('returns NaN for unknown operator', () => {
    expect(applyOp(1, '?', 2)).toBeNaN();
  });
});

describe('formatDisplay', () => {
  it('renders integers without decimals', () => {
    expect(formatDisplay(42)).toBe('42');
    expect(formatDisplay(-7)).toBe('-7');
    expect(formatDisplay(0)).toBe('0');
  });

  it('renders finite decimals trimmed of trailing zeros', () => {
    expect(formatDisplay(3.14)).toBe('3.14');
    expect(formatDisplay(2.5)).toBe('2.5');
    expect(formatDisplay(1.1)).toBe('1.1');
  });

  it('uses exponential notation for very large or very small numbers', () => {
    expect(formatDisplay(1e15)).toMatch(/e/);
    expect(formatDisplay(1e-10)).toMatch(/e/);
  });

  it('returns "Error" for non-finite or NaN', () => {
    expect(formatDisplay(NaN)).toBe('Error');
    expect(formatDisplay(Infinity)).toBe('Error');
    expect(formatDisplay(-Infinity)).toBe('Error');
  });

  it('handles null/undefined safely', () => {
    expect(formatDisplay(null)).toBe('0');
    expect(formatDisplay(undefined)).toBe('0');
  });
});

describe('toggleSign', () => {
  it('flips positive numbers to negative and back', () => {
    expect(toggleSign('5')).toBe('-5');
    expect(toggleSign('-5')).toBe('5');
    expect(toggleSign('3.14')).toBe('-3.14');
  });

  it('leaves zero unchanged', () => {
    expect(toggleSign('0')).toBe('0');
    expect(toggleSign('0.')).toBe('0.');
  });

  it('leaves empty/error inputs unchanged', () => {
    expect(toggleSign('')).toBe('');
    expect(toggleSign('Error')).toBe('Error');
  });
});

describe('appendKey', () => {
  it('replaces a leading zero when typing a digit', () => {
    expect(appendKey('0', '5')).toBe('5');
    expect(appendKey('0', '7')).toBe('7');
  });

  it('appends digits to existing entries', () => {
    expect(appendKey('1', '2')).toBe('12');
    expect(appendKey('42', '0')).toBe('420');
  });

  it('appends a leading 0 before a bare decimal point', () => {
    expect(appendKey('', '.')).toBe('0.');
    expect(appendKey('-', '.')).toBe('-0.');
  });

  it('does not allow two decimal points', () => {
    expect(appendKey('3.14', '.')).toBe('3.14');
  });

  it('starts fresh after an Error state', () => {
    expect(appendKey('Error', '5')).toBe('5');
  });

  it('preserves negative sign when replacing leading -0', () => {
    expect(appendKey('-0', '5')).toBe('-5');
  });
});

import { describe, it, expect } from 'vitest';
import { hexRgb, fill, bdr, isUrl } from '../format.js';

describe('hexRgb', () => {
  it('parses a hex color with leading #', () => {
    expect(hexRgb('#4f9eff')).toBe('79,158,255');
  });

  it('parses a hex color without leading #', () => {
    expect(hexRgb('4f9eff')).toBe('79,158,255');
  });

  it('handles uppercase hex', () => {
    expect(hexRgb('#FF0000')).toBe('255,0,0');
  });

  it('handles pure black and white', () => {
    expect(hexRgb('#000000')).toBe('0,0,0');
    expect(hexRgb('#ffffff')).toBe('255,255,255');
  });
});

describe('fill', () => {
  it('wraps hexRgb in rgba() with 0.16 alpha', () => {
    expect(fill('#4f9eff')).toBe('rgba(79,158,255,0.16)');
  });
});

describe('bdr', () => {
  it('wraps hexRgb in rgba() with 0.55 alpha', () => {
    expect(bdr('#4f9eff')).toBe('rgba(79,158,255,0.55)');
  });
});

describe('isUrl', () => {
  it('accepts http/https URLs', () => {
    expect(isUrl('https://example.com')).toBe(true);
    expect(isUrl('http://example.com')).toBe(true);
    expect(isUrl('HTTPS://EXAMPLE.COM')).toBe(true);
  });

  it('accepts single-segment bare domains', () => {
    expect(isUrl('example.com')).toBe(true);
    expect(isUrl('foo.io')).toBe(true);
  });

  // BUG: the regex /^[\w-]+\.[\w]{2,}(\/|$)/ requires the domain to end after
  // the TLD, so multi-segment bare domains like "news.ycombinator.com" fall
  // through to search instead of navigating. Pre-existing behavior — pinning
  // it here so a future regex fix forces a deliberate test update.
  it('does NOT match multi-segment bare domains (pre-existing bug)', () => {
    expect(isUrl('news.ycombinator.com')).toBe(false);
    expect(isUrl('docs.google.com')).toBe(false);
  });

  it('trims whitespace before checking', () => {
    expect(isUrl('  example.com  ')).toBe(true);
  });

  it('rejects plain words and search-style queries', () => {
    expect(isUrl('foo')).toBe(false);
    expect(isUrl('hello world')).toBe(false);
    expect(isUrl('')).toBe(false);
    expect(isUrl('http')).toBe(false);
  });

  // Documents current behavior: dotted IPs aren't matched by the bare-domain regex.
  // If we ever want to support them, update isUrl AND this test together.
  it('does not match dotted IP addresses (current limitation)', () => {
    expect(isUrl('192.168.1.1')).toBe(false);
  });
});

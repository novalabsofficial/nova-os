import { describe, it, expect } from 'vitest';
import {
  extractHostname,
  isLikelyUnframable,
  transformYouTubeUrl,
  rewriteForIframe,
  UNFRAMABLE_DOMAINS,
} from '../browser.js';

describe('extractHostname', () => {
  it('extracts plain hostnames', () => {
    expect(extractHostname('example.com')).toBe('example.com');
    expect(extractHostname('foo.io')).toBe('foo.io');
  });

  it('strips protocol', () => {
    expect(extractHostname('https://example.com')).toBe('example.com');
    expect(extractHostname('http://example.com')).toBe('example.com');
  });

  it('strips www.', () => {
    expect(extractHostname('www.example.com')).toBe('example.com');
    expect(extractHostname('https://www.example.com')).toBe('example.com');
  });

  it('cuts at first slash, query, or fragment', () => {
    expect(extractHostname('https://example.com/path/to/page')).toBe('example.com');
    expect(extractHostname('https://example.com?q=foo')).toBe('example.com');
    expect(extractHostname('https://example.com#section')).toBe('example.com');
  });

  it('strips port', () => {
    expect(extractHostname('https://example.com:8080/foo')).toBe('example.com');
  });

  it('returns empty string for non-string or empty input', () => {
    expect(extractHostname(null)).toBe('');
    expect(extractHostname(undefined)).toBe('');
    expect(extractHostname('')).toBe('');
    expect(extractHostname(42)).toBe('');
  });

  it('preserves subdomains beyond www', () => {
    expect(extractHostname('https://m.youtube.com/watch')).toBe('m.youtube.com');
    expect(extractHostname('https://docs.google.com')).toBe('docs.google.com');
  });
});

describe('isLikelyUnframable', () => {
  it('flags known unframable domains', () => {
    expect(isLikelyUnframable('https://www.roblox.com')).toBe(true);
    expect(isLikelyUnframable('https://twitter.com')).toBe(true);
    expect(isLikelyUnframable('https://www.reddit.com/r/programming')).toBe(true);
  });

  it('flags subdomains of unframable domains', () => {
    expect(isLikelyUnframable('https://m.youtube.com/watch?v=x')).toBe(true);
    expect(isLikelyUnframable('https://store.steampowered.com')).toBe(true);
  });

  it('passes safe domains', () => {
    expect(isLikelyUnframable('https://en.wikipedia.org')).toBe(false);
    expect(isLikelyUnframable('https://archive.org')).toBe(false);
    expect(isLikelyUnframable('https://news.ycombinator.com')).toBe(false);
  });

  // Crucial: the /embed/ path for YouTube DOES allow framing, so we want
  // those URLs to slip through the unframable check.
  it('lets YouTube /embed/ URLs through', () => {
    expect(isLikelyUnframable('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(false);
    expect(isLikelyUnframable('https://youtube.com/embed/abc12345')).toBe(false);
  });

  it('handles invalid input safely', () => {
    expect(isLikelyUnframable('')).toBe(false);
    expect(isLikelyUnframable(null)).toBe(false);
    expect(isLikelyUnframable(undefined)).toBe(false);
  });

  it('accepts a custom domain list', () => {
    expect(isLikelyUnframable('https://example.com', ['example.com'])).toBe(true);
    expect(isLikelyUnframable('https://example.com', ['other.com'])).toBe(false);
  });

  it('does not false-match on substrings (e.g. youtube.com vs notyoutube.com)', () => {
    // host.endsWith("." + domain) prevents notyoutube.com from matching youtube.com
    expect(isLikelyUnframable('https://notyoutube.com')).toBe(false);
  });

  it('UNFRAMABLE_DOMAINS contains expected core entries', () => {
    expect(UNFRAMABLE_DOMAINS).toContain('roblox.com');
    expect(UNFRAMABLE_DOMAINS).toContain('twitter.com');
    expect(UNFRAMABLE_DOMAINS).toContain('youtube.com');
  });
});

describe('transformYouTubeUrl', () => {
  it('converts a standard watch URL', () => {
    expect(transformYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('converts youtu.be short URLs', () => {
    expect(transformYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('converts mobile m.youtube.com URLs', () => {
    expect(transformYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('preserves start time via ?t parameter', () => {
    expect(transformYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=42');
  });

  it('handles t= with unit suffix (e.g. "42s")', () => {
    expect(transformYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=42');
  });

  it('ignores t=0 (no useful start)', () => {
    expect(transformYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('passes through existing embed URLs unchanged', () => {
    expect(transformYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(transformYouTubeUrl('https://example.com')).toBeNull();
    expect(transformYouTubeUrl('https://wikipedia.org')).toBeNull();
  });

  it('returns null for YouTube URLs without a video id', () => {
    expect(transformYouTubeUrl('https://www.youtube.com/watch')).toBeNull();
    expect(transformYouTubeUrl('https://www.youtube.com/watch?other=x')).toBeNull();
  });

  it('handles invalid input safely', () => {
    expect(transformYouTubeUrl(null)).toBeNull();
    expect(transformYouTubeUrl(undefined)).toBeNull();
    expect(transformYouTubeUrl('')).toBeNull();
    expect(transformYouTubeUrl(42)).toBeNull();
  });
});

describe('rewriteForIframe', () => {
  it('adds https:// to bare hostnames', () => {
    expect(rewriteForIframe('example.com')).toBe('https://example.com');
    expect(rewriteForIframe('wikipedia.org/wiki/Main_Page')).toBe('https://wikipedia.org/wiki/Main_Page');
  });

  it('preserves existing http/https protocol', () => {
    expect(rewriteForIframe('http://example.com')).toBe('http://example.com');
    expect(rewriteForIframe('https://example.com')).toBe('https://example.com');
  });

  it('rewrites YouTube watch URLs to embed URLs', () => {
    expect(rewriteForIframe('youtube.com/watch?v=abc12345'))
      .toBe('https://www.youtube.com/embed/abc12345');
    expect(rewriteForIframe('https://www.youtube.com/watch?v=abc12345'))
      .toBe('https://www.youtube.com/embed/abc12345');
  });

  it('rewrites youtu.be short links to embed URLs', () => {
    expect(rewriteForIframe('youtu.be/abc12345'))
      .toBe('https://www.youtube.com/embed/abc12345');
  });

  it('trims whitespace', () => {
    expect(rewriteForIframe('  https://example.com  ')).toBe('https://example.com');
  });

  it('returns empty string for invalid input', () => {
    expect(rewriteForIframe('')).toBe('');
    expect(rewriteForIframe(null)).toBe('');
    expect(rewriteForIframe(undefined)).toBe('');
  });
});

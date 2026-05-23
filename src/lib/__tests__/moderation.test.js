import { describe, it, expect } from 'vitest';
import { autoModerate, isAdmin, isPubliclyVisible, ADMINS } from '../moderation.js';

describe('isAdmin', () => {
  it('recognizes usernames in the ADMINS list', () => {
    // Spot-check: NovaMod is the seed admin — if you remove it, update this test.
    expect(ADMINS).toContain('NovaMod');
    expect(isAdmin('NovaMod')).toBe(true);
  });

  it('rejects non-admin usernames', () => {
    expect(isAdmin('randomuser')).toBe(false);
    expect(isAdmin('sammygoldencars')).toBe(false);
  });

  it('handles non-string input safely', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin(42)).toBe(false);
    expect(isAdmin({})).toBe(false);
  });

  it('matches admins case-insensitively', () => {
    // The auth flow lowercases usernames at registration ("NovaMod" -> "novamod"),
    // so the check has to be case-insensitive or the admin would never match.
    expect(isAdmin('novamod')).toBe(true);
    expect(isAdmin('NOVAMOD')).toBe(true);
    expect(isAdmin('NovaMod')).toBe(true);
  });
});

describe('autoModerate', () => {
  it('returns no flags for a clean submission', () => {
    expect(autoModerate({
      name: 'Cool Game',
      desc: 'A fun indie puzzle game',
      url: 'https://example.com',
    })).toEqual([]);
  });

  it('flags profanity in the name', () => {
    const flags = autoModerate({
      name: 'Fuck This',
      desc: 'innocent description',
      url: 'https://example.com',
    });
    expect(flags).toContain('Profanity in name/description');
  });

  it('flags profanity in the description', () => {
    const flags = autoModerate({
      name: 'Innocent App',
      desc: 'Some shit happens here',
      url: 'https://example.com',
    });
    expect(flags).toContain('Profanity in name/description');
  });

  it('only emits one profanity flag even with multiple hits', () => {
    const flags = autoModerate({
      name: 'fuck shit',
      desc: 'bitch nude porn',
      url: 'https://example.com',
    });
    const profanityFlags = flags.filter(f => f.startsWith('Profanity'));
    expect(profanityFlags).toHaveLength(1);
  });

  it('flags blocked URL patterns', () => {
    const flags = autoModerate({
      name: 'Get Free Stuff',
      desc: 'Totally legit',
      url: 'https://free-robux.example.net',
    });
    expect(flags.some(f => f.startsWith('URL pattern blocked'))).toBe(true);
  });

  it('flags URLs that are missing the protocol', () => {
    const flags = autoModerate({
      name: 'Cool Game',
      desc: 'A nice game',
      url: 'example.com',
    });
    expect(flags).toContain('URL missing http(s)://');
  });

  it('does not flag http or https URLs as missing-protocol', () => {
    expect(autoModerate({ name: 'X', desc: 'y', url: 'http://example.com' }))
      .not.toContain('URL missing http(s)://');
    expect(autoModerate({ name: 'X', desc: 'y', url: 'https://example.com' }))
      .not.toContain('URL missing http(s)://');
  });

  it('handles missing/empty fields without throwing', () => {
    expect(() => autoModerate({})).not.toThrow();
    expect(() => autoModerate(null)).not.toThrow();
    expect(() => autoModerate(undefined)).not.toThrow();
    expect(autoModerate({})).toEqual([]);
  });

  it('returns multiple distinct flag types when several conditions match', () => {
    const flags = autoModerate({
      name: 'Shit App',
      desc: 'whatever',
      url: 'free-robux.com', // missing protocol AND blocked pattern
    });
    expect(flags.length).toBeGreaterThanOrEqual(2);
    expect(flags.some(f => f.startsWith('Profanity'))).toBe(true);
    expect(flags.some(f => f.startsWith('URL pattern blocked'))).toBe(true);
  });
});

describe('isPubliclyVisible', () => {
  it('shows apps with status approved', () => {
    expect(isPubliclyVisible({ status: 'approved' })).toBe(true);
  });

  it('hides apps with status pending', () => {
    expect(isPubliclyVisible({ status: 'pending' })).toBe(false);
  });

  it('hides apps with status rejected', () => {
    expect(isPubliclyVisible({ status: 'rejected' })).toBe(false);
  });

  // Backwards-compatibility: old submissions predating the moderation feature
  // have no `status` field. We want them visible by default so they don't vanish.
  it('shows legacy apps without a status field', () => {
    expect(isPubliclyVisible({ name: 'Old App' })).toBe(true);
    expect(isPubliclyVisible({ status: null })).toBe(true);
    expect(isPubliclyVisible({ status: undefined })).toBe(true);
  });

  it('handles null/undefined input safely', () => {
    expect(isPubliclyVisible(null)).toBe(false);
    expect(isPubliclyVisible(undefined)).toBe(false);
  });
});

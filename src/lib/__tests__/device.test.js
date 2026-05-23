import { describe, it, expect } from 'vitest';
import { detectDevice, effectiveDeviceMode, isTouchMode, VALID_MODES } from '../device.js';

describe('detectDevice', () => {
  // ── Width thresholds ─────────────────────────────────────────────
  it('reads narrow viewports as mobile regardless of touch', () => {
    expect(detectDevice({ width: 360, hasTouch: true, coarsePointer: true })).toBe('mobile');
    expect(detectDevice({ width: 360, hasTouch: false, coarsePointer: false })).toBe('mobile');
    expect(detectDevice({ width: 599, hasTouch: true, coarsePointer: false })).toBe('mobile');
  });

  it('reads mid-width touch viewports as tablet', () => {
    expect(detectDevice({ width: 768, hasTouch: true, coarsePointer: true })).toBe('tablet');
    expect(detectDevice({ width: 1024, hasTouch: true, coarsePointer: false })).toBe('tablet');
    expect(detectDevice({ width: 1199, hasTouch: false, coarsePointer: true })).toBe('tablet');
  });

  it('reads mid-width non-touch viewports as desktop (e.g. small laptops)', () => {
    expect(detectDevice({ width: 1024, hasTouch: false, coarsePointer: false })).toBe('desktop');
    expect(detectDevice({ width: 800, hasTouch: false, coarsePointer: false })).toBe('desktop');
  });

  it('reads wide viewports as desktop regardless of touch (touchscreen laptops)', () => {
    expect(detectDevice({ width: 1440, hasTouch: true, coarsePointer: false })).toBe('desktop');
    expect(detectDevice({ width: 1920, hasTouch: true, coarsePointer: true })).toBe('desktop');
  });

  // ── Boundary behavior ────────────────────────────────────────────
  it('600px exactly is the mobile/tablet boundary', () => {
    expect(detectDevice({ width: 599, hasTouch: true, coarsePointer: true })).toBe('mobile');
    expect(detectDevice({ width: 600, hasTouch: true, coarsePointer: true })).toBe('tablet');
  });

  it('1200px exactly is the tablet/desktop boundary', () => {
    expect(detectDevice({ width: 1199, hasTouch: true, coarsePointer: true })).toBe('tablet');
    expect(detectDevice({ width: 1200, hasTouch: true, coarsePointer: true })).toBe('desktop');
  });

  // ── Touch signal combinations ─────────────────────────────────────
  // Either signal alone is enough to be considered "touchy" in the tablet range
  it('treats coarsePointer alone as touch', () => {
    expect(detectDevice({ width: 800, hasTouch: false, coarsePointer: true })).toBe('tablet');
  });
  it('treats hasTouch alone as touch', () => {
    expect(detectDevice({ width: 800, hasTouch: true, coarsePointer: false })).toBe('tablet');
  });
});

describe('effectiveDeviceMode', () => {
  it('returns the setting when it is an explicit valid mode', () => {
    expect(effectiveDeviceMode('desktop', 'mobile')).toBe('desktop');
    expect(effectiveDeviceMode('tablet', 'mobile')).toBe('tablet');
    expect(effectiveDeviceMode('mobile', 'desktop')).toBe('mobile');
  });

  it('falls back to detected when setting is "auto"', () => {
    expect(effectiveDeviceMode('auto', 'desktop')).toBe('desktop');
    expect(effectiveDeviceMode('auto', 'tablet')).toBe('tablet');
    expect(effectiveDeviceMode('auto', 'mobile')).toBe('mobile');
  });

  it('falls back to detected when setting is null/undefined', () => {
    expect(effectiveDeviceMode(undefined, 'tablet')).toBe('tablet');
    expect(effectiveDeviceMode(null, 'tablet')).toBe('tablet');
  });

  it('falls back to detected when setting is an unknown string', () => {
    expect(effectiveDeviceMode('random-garbage', 'desktop')).toBe('desktop');
    expect(effectiveDeviceMode('', 'mobile')).toBe('mobile');
  });

  it('returns desktop as last-resort fallback', () => {
    expect(effectiveDeviceMode(undefined, undefined)).toBe('desktop');
    expect(effectiveDeviceMode('garbage', 'also-garbage')).toBe('desktop');
  });
});

describe('isTouchMode', () => {
  it('is true for tablet and mobile', () => {
    expect(isTouchMode('tablet')).toBe(true);
    expect(isTouchMode('mobile')).toBe(true);
  });

  it('is false for desktop and unknown values', () => {
    expect(isTouchMode('desktop')).toBe(false);
    expect(isTouchMode('unknown')).toBe(false);
    expect(isTouchMode(undefined)).toBe(false);
  });
});

describe('VALID_MODES', () => {
  it('exposes the three canonical mode strings', () => {
    expect(VALID_MODES).toEqual(['desktop', 'tablet', 'mobile']);
  });
});

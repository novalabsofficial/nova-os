import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playTone } from '../audio.js';

// Build a minimal AudioContext mock that records calls so we can assert
// playTone wired everything correctly without needing a real audio device
// (jsdom doesn't provide one).
function makeMockAC() {
  const calls = { oscStarted: 0, oscStopped: 0, frequencySet: null, oscType: null, contextClosed: 0, resumed: 0 };
  const gainNode = {
    gain: {
      setValueAtTime:        vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(function () { return this; }),
  };
  const oscNode = {
    type: "",
    frequency: { value: 0 },
    connect: vi.fn(function () { return gainNode; }),
    start: vi.fn(() => { calls.oscStarted++; }),
    stop:  vi.fn(() => { calls.oscStopped++; }),
    onended: null,
  };
  class MockAC {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.state = "running";
    }
    createOscillator() { return oscNode; }
    createGain()       { return gainNode; }
    resume() { calls.resumed++; return Promise.resolve(); }
    close()  { calls.contextClosed++; return Promise.resolve(); }
  }
  return { MockAC, oscNode, gainNode, calls };
}

describe('playTone', () => {
  let originalAC;
  beforeEach(() => {
    originalAC = window.AudioContext;
  });
  afterEach(() => {
    window.AudioContext = originalAC;
    vi.restoreAllMocks();
  });

  it('starts and stops an oscillator with the requested frequency', () => {
    const { MockAC, oscNode } = makeMockAC();
    window.AudioContext = MockAC;

    playTone(607, 3000);

    expect(oscNode.type).toBe('sine');
    expect(oscNode.frequency.value).toBe(607);
    expect(oscNode.start).toHaveBeenCalledOnce();
    expect(oscNode.stop).toHaveBeenCalledOnce();
  });

  it('applies an attack and release envelope via gain ramps', () => {
    const { MockAC, gainNode } = makeMockAC();
    window.AudioContext = MockAC;

    playTone(607, 3000);

    // We expect at least two gain ramps (rise + fall) and at least two set
    // points (start at 0, hold at peak). Don't pin exact counts in case we
    // tweak the envelope shape later.
    expect(gainNode.gain.linearRampToValueAtTime.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(gainNode.gain.setValueAtTime.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('schedules stop later than start (i.e. tone has positive duration)', () => {
    const { MockAC, oscNode } = makeMockAC();
    window.AudioContext = MockAC;

    playTone(440, 1000);

    const startTime = oscNode.start.mock.calls[0][0];
    const stopTime = oscNode.stop.mock.calls[0][0];
    expect(stopTime).toBeGreaterThan(startTime);
  });

  it('enforces a minimum tone length so very small durations still work', () => {
    const { MockAC, oscNode } = makeMockAC();
    window.AudioContext = MockAC;

    // Asking for 1ms shouldn't collapse the envelope into nothing.
    playTone(440, 1);

    const startTime = oscNode.start.mock.calls[0][0];
    const stopTime = oscNode.stop.mock.calls[0][0];
    expect(stopTime - startTime).toBeGreaterThanOrEqual(0.05); // ≥ the 50ms floor
  });

  it('no-ops when AudioContext is not available', () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    // Should not throw
    expect(() => playTone(440, 1000)).not.toThrow();
  });

  it('attempts to resume a suspended context (handles browser autoplay block)', () => {
    const { MockAC, calls } = makeMockAC();
    // Override the AC so we start in "suspended"
    class SuspendedAC extends MockAC {
      constructor() { super(); this.state = "suspended"; }
    }
    window.AudioContext = SuspendedAC;

    playTone(440, 500);

    expect(calls.resumed).toBe(1);
  });

  it('cleans up the context after the tone ends', () => {
    const { MockAC, oscNode, calls } = makeMockAC();
    window.AudioContext = MockAC;

    playTone(440, 500);

    // The onended callback closes the context. Invoke it to simulate end-of-tone.
    expect(typeof oscNode.onended).toBe('function');
    oscNode.onended();
    expect(calls.contextClosed).toBe(1);
  });
});

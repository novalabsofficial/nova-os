import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playTone, speak, cancelSpeech, playSound, getSoundConfig, setSoundConfig, SOUND_NAMES } from '../audio.js';

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

// ── TTS ─────────────────────────────────────────────────────────────────
// jsdom has no real SpeechSynthesis, so we stub a minimal one and assert
// that speak() forwards the text + options correctly.

describe('speak', () => {
  let originalSpeech, originalUtterance;
  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
    originalUtterance = globalThis.SpeechSynthesisUtterance;
  });
  afterEach(() => {
    if (originalSpeech === undefined) delete window.speechSynthesis;
    else window.speechSynthesis = originalSpeech;
    if (originalUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
    else globalThis.SpeechSynthesisUtterance = originalUtterance;
  });

  function installMockSpeech() {
    const spoken = [];
    class MockUtterance {
      constructor(text) {
        this.text = text;
        this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = "en-US";
      }
    }
    globalThis.SpeechSynthesisUtterance = MockUtterance;
    window.speechSynthesis = {
      speak: vi.fn(u => { spoken.push(u); }),
      cancel: vi.fn(),
    };
    return { spoken };
  }

  it('forwards the text to speechSynthesis.speak()', () => {
    const { spoken } = installMockSpeech();
    speak("Tornado Warning for Travis County");
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("Tornado Warning for Travis County");
  });

  it('applies provided opts (rate, pitch, volume, lang)', () => {
    const { spoken } = installMockSpeech();
    speak("test", { rate: 1.4, pitch: 0.8, volume: 0.7, lang: "en-GB" });
    expect(spoken[0].rate).toBe(1.4);
    expect(spoken[0].pitch).toBe(0.8);
    expect(spoken[0].volume).toBe(0.7);
    expect(spoken[0].lang).toBe("en-GB");
  });

  it('uses sensible defaults when no opts are passed', () => {
    const { spoken } = installMockSpeech();
    speak("hi");
    expect(spoken[0].rate).toBe(1.0);
    expect(spoken[0].pitch).toBe(1.0);
    expect(spoken[0].volume).toBe(1.0);
    expect(spoken[0].lang).toBe("en-US");
  });

  it('ignores empty / whitespace / non-string input', () => {
    const { spoken } = installMockSpeech();
    speak("");
    speak("   ");
    speak(null);
    speak(42);
    expect(spoken).toHaveLength(0);
  });

  it('no-ops when speechSynthesis is not available', () => {
    delete window.speechSynthesis;
    expect(() => speak("hello")).not.toThrow();
  });

  it('no-ops when SpeechSynthesisUtterance is not available', () => {
    window.speechSynthesis = { speak: vi.fn(), cancel: vi.fn() };
    delete globalThis.SpeechSynthesisUtterance;
    expect(() => speak("hello")).not.toThrow();
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });
});

describe('cancelSpeech', () => {
  let originalSpeech;
  beforeEach(() => { originalSpeech = window.speechSynthesis; });
  afterEach(() => {
    if (originalSpeech === undefined) delete window.speechSynthesis;
    else window.speechSynthesis = originalSpeech;
  });

  it('calls speechSynthesis.cancel()', () => {
    const cancelFn = vi.fn();
    window.speechSynthesis = { speak: vi.fn(), cancel: cancelFn };
    cancelSpeech();
    expect(cancelFn).toHaveBeenCalledOnce();
  });

  it('no-ops without speechSynthesis available', () => {
    delete window.speechSynthesis;
    expect(() => cancelSpeech()).not.toThrow();
  });
});

// ── Sound preferences ──────────────────────────────────────────────────

describe('getSoundConfig / setSoundConfig', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('defaults to enabled + 0.6 volume when nothing saved', () => {
    const cfg = getSoundConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.volume).toBeCloseTo(0.6);
  });

  it('round-trips through localStorage', () => {
    setSoundConfig({ enabled: false, volume: 0.3 });
    const cfg = getSoundConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.volume).toBeCloseTo(0.3);
  });

  it('clamps volume into 0..1', () => {
    setSoundConfig({ volume: 5 });
    expect(getSoundConfig().volume).toBe(1);
    setSoundConfig({ volume: -3 });
    expect(getSoundConfig().volume).toBe(0);
  });

  it('survives a corrupt localStorage value', () => {
    try { localStorage.setItem('nova-sounds', '{not json'); } catch {}
    const cfg = getSoundConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.volume).toBeCloseTo(0.6);
  });
});

describe('SOUND_NAMES', () => {
  it('includes the core system sounds we promised', () => {
    expect(SOUND_NAMES).toContain('notification');
    expect(SOUND_NAMES).toContain('startup');
    expect(SOUND_NAMES).toContain('login');
    expect(SOUND_NAMES).toContain('logout');
    expect(SOUND_NAMES).toContain('error');
    expect(SOUND_NAMES).toContain('windowOpen');
    expect(SOUND_NAMES).toContain('windowClose');
    expect(SOUND_NAMES).toContain('appLaunch');
    expect(SOUND_NAMES).toContain('toast');
  });
});

describe('playSound', () => {
  let originalAC;
  beforeEach(() => {
    originalAC = window.AudioContext;
    try { localStorage.clear(); } catch {}
  });
  afterEach(() => {
    window.AudioContext = originalAC;
    vi.restoreAllMocks();
  });

  function installMockAC() {
    const oscNodes = [];
    class MockOsc {
      constructor() {
        this.type = ""; this.frequency = { value: 0 };
        this.connect = vi.fn(function () { return this; });
        this.start = vi.fn(); this.stop = vi.fn(); this.onended = null;
        oscNodes.push(this);
      }
    }
    class MockGain {
      constructor() {
        this.gain = {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        };
        this.connect = vi.fn(function () { return this; });
      }
    }
    class MockAC {
      constructor() { this.currentTime = 0; this.destination = {}; this.state = "running"; }
      createOscillator() { return new MockOsc(); }
      createGain() { return new MockGain(); }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }
    window.AudioContext = MockAC;
    return { oscNodes };
  }

  it('schedules at least one oscillator for a known sound', () => {
    const { oscNodes } = installMockAC();
    playSound('notification');
    expect(oscNodes.length).toBeGreaterThan(0);
  });

  it('schedules multiple oscillators for layered sounds (startup arpeggio)', () => {
    const { oscNodes } = installMockAC();
    playSound('startup');
    // startup has 4 notes
    expect(oscNodes.length).toBe(4);
  });

  it('does nothing when sounds are disabled in config', () => {
    const { oscNodes } = installMockAC();
    setSoundConfig({ enabled: false });
    playSound('notification');
    expect(oscNodes.length).toBe(0);
  });

  it('does nothing when volume is zero', () => {
    const { oscNodes } = installMockAC();
    setSoundConfig({ volume: 0 });
    playSound('notification');
    expect(oscNodes.length).toBe(0);
  });

  it('does nothing for an unknown sound name', () => {
    const { oscNodes } = installMockAC();
    playSound('totally-made-up');
    expect(oscNodes.length).toBe(0);
  });

  it('no-ops when AudioContext is unavailable', () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    expect(() => playSound('notification')).not.toThrow();
  });
});

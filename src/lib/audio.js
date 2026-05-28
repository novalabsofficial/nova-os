// Web Audio + Speech API helpers. Used by Atmos to surface active NWS alerts
// as an audible cue (607 Hz tone) followed by a TTS read-out of the alert
// summaries. v6.0 will likely expand this into a full sound system; for now
// we keep the scope tight.
//
// All functions are safe to call in environments without the underlying API
// (e.g. SSR, jsdom, older browsers) — they no-op rather than throw.

/**
 * Play a sine-wave tone at the given frequency for the given duration.
 * Uses a short attack/release envelope (~40ms / ~80ms) so the tone fades
 * in and out instead of popping.
 *
 * @param {number} frequency      Hz — e.g. 607 for the NWS alert tone
 * @param {number} durationMs     length of the tone in milliseconds
 * @param {number} [volume=0.3]   0.0–1.0, headroom volume; 0.3 is "noticeable but not piercing"
 */
export function playTone(frequency, durationMs, volume = 0.3) {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  let ctx;
  try { ctx = new AC(); } catch { return; }

  // Browsers may park new contexts in "suspended" until a user gesture.
  // Resume eagerly — if the call wasn't actually user-initiated the resume
  // promise will reject silently and the tone just won't play. That's OK
  // (it's a notification cue, not critical functionality).
  if (typeof ctx.resume === "function" && ctx.state === "suspended") {
    try { ctx.resume(); } catch {}
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const dur = Math.max(0.05, durationMs / 1000);
  const attack = Math.min(0.04, dur / 4);
  const release = Math.min(0.08, dur / 4);
  const sustain = Math.max(0, dur - attack - release);

  osc.type = "sine";
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.setValueAtTime(volume, now + attack + sustain);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur);

  // Tear down the AudioContext when the tone ends so we don't leak resources
  // if the user triggers a lot of tones in quick succession.
  osc.onended = () => { try { ctx.close(); } catch {} };
}

/**
 * Speak a string aloud via the browser's built-in SpeechSynthesis. Multiple
 * calls queue automatically — pass each alert's summary in turn and the
 * browser will play them back-to-back.
 *
 * Free, no API key, no network. The actual voice depends on the user's OS.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.rate=1.0]    speech rate, 0.1–10
 * @param {number} [opts.pitch=1.0]   pitch, 0–2
 * @param {number} [opts.volume=1.0]  volume, 0–1
 * @param {string} [opts.lang="en-US"]
 */
export function speak(text, opts = {}) {
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis) return;
  if (typeof SpeechSynthesisUtterance !== "function") return;
  if (typeof text !== "string" || !text.trim()) return;

  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate   = opts.rate   ?? 1.0;
    u.pitch  = opts.pitch  ?? 1.0;
    u.volume = opts.volume ?? 1.0;
    u.lang   = opts.lang   ?? "en-US";
    window.speechSynthesis.speak(u);
  } catch { /* silently ignore — TTS is a nice-to-have, never critical */ }
}

/** Stop any in-flight or queued speech. */
export function cancelSpeech() {
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis) return;
  try { window.speechSynthesis.cancel(); } catch {}
}

// ── System Sounds (v9.0 engine) ─────────────────────────────────────────
//
// All system sounds are *procedurally generated* via Web Audio — no audio
// files, no fetch, no bundle bloat. Each sound is a small composition of
// clean tones routed through a shared master bus.
//
// v9.0 rewrite — why it sounded "off" before, and what changed:
//   The old engine connected every oscillator straight to ctx.destination
//   with no headroom management. Layered recipes (the login chord stacked a
//   body note plus three detuned 4-oscillator bells) summed well past 0dBFS
//   and *clipped* — that harsh digital distortion is what made the login
//   "not resonate correctly". The atmospheric tail was also faked with very
//   long note decays rather than real space.
//
//   The new engine routes everything through a master bus:
//       note gains → lowpass (de-fizz) → limiter (catch peaks) → destination
//                                       ↘ convolution reverb ↗
//   • The lowpass shaves the brittle digital top end off pure oscillators.
//   • The limiter (a compressor pushed toward brickwall) keeps the summed
//     signal under 0dBFS, so layered chords stay clean instead of clipping.
//   • A generated impulse-response reverb gives genuine resonant tails, so
//     the notes can be short and clean and still "ring out" in a space.
//   Recipes are accordingly simpler: fewer, better-voiced notes that let the
//   reverb do the atmosphere instead of overlapping detuned bells = mud.
//
// Sound preferences live in localStorage under "nova-sounds":
//   { enabled: boolean, volume: 0..1 }
// Each call to playSound() reads that synchronously so toggling sounds in
// Settings takes effect immediately.

const SOUND_LS_KEY = "nova-sounds";
const SOUND_DEFAULTS = { enabled: true, volume: 0.6 };

// v6.2: per-wallpaper transpose. Each wallpaper has a `semitones` value in
// src/ui/constants.js — we mirror the active wallpaper id here and translate
// it to a frequency ratio at sound-play time. Lives separately from the
// {enabled,volume} sound config so picking a new wallpaper doesn't accidentally
// clobber the user's mute or volume.
const SOUND_WALLPAPER_LS_KEY = "nova-sound-wallpaper";

// Semitones offset per wallpaper id. Must mirror WALLPAPERS in
// src/ui/constants.js. Kept here as a duplicate (rather than imported) so
// this module stays a pure leaf with no circular import risk.
const WALLPAPER_SEMITONES = {
  mesh:   0,
  // v8.0 additions
  halcyon: 2,
  cascade: 4,
  iris:    1,
  ember:  -1,
  prism:   6,
  glass:   4,
  solar:  -2,
  tide:   -2,
  velvet: -1,
  // v7.0 additions
  lumen: -1,
  drift:  8,
  halo:   2,
  aurora: 5,
  nova:  -2,
  ocean: -4,
  sunset: 4,
  cyber:  3,
  zen:   -7,
  bliss:  7,
  night: -5,
  sakura: 9,
  forest:-3,
  slate:  1,
  custom: 0,
};

/**
 * Tell the sound system which wallpaper is currently active. Call this when
 * the user picks a new wallpaper in Settings, and again at app boot once the
 * saved wallpaper preference loads from Firestore. The id is persisted to
 * localStorage so the transpose survives a full reload.
 */
export function setSoundWallpaper(id) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(SOUND_WALLPAPER_LS_KEY, id || "mesh"); } catch {}
}

// Internal — read the saved wallpaper id, translate to a frequency ratio.
// 2^(semitones/12) is the equal-temperament ratio; 0 semitones → 1.0.
function getActivePitchRatio() {
  if (typeof localStorage === "undefined") return 1;
  try {
    const id = localStorage.getItem(SOUND_WALLPAPER_LS_KEY) || "mesh";
    const semis = WALLPAPER_SEMITONES[id] ?? 0;
    return Math.pow(2, semis / 12);
  } catch { return 1; }
}

/** Read the user's sound preferences. Safe outside the browser. */
export function getSoundConfig() {
  if (typeof localStorage === "undefined") return { ...SOUND_DEFAULTS };
  try {
    const raw = localStorage.getItem(SOUND_LS_KEY);
    if (!raw) return { ...SOUND_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false,                        // default true
      volume: typeof parsed.volume === "number"
        ? Math.max(0, Math.min(1, parsed.volume))
        : SOUND_DEFAULTS.volume,
    };
  } catch { return { ...SOUND_DEFAULTS }; }
}

/** Save the user's sound preferences. */
// v9.3 (issue #22) — let other components (e.g. the taskbar volume icon)
// react to sound-config changes regardless of who made them. Subscribers
// are invoked synchronously on every setSoundConfig with the freshly-read
// config so callers see the merged result, not the patch.
const _soundSubs = new Set();
export function subscribeSoundConfig(fn) { _soundSubs.add(fn); return () => _soundSubs.delete(fn); }

export function setSoundConfig(cfg) {
  if (typeof localStorage === "undefined") return;
  try {
    const cur = getSoundConfig();
    const next = { ...cur, ...cfg };
    localStorage.setItem(SOUND_LS_KEY, JSON.stringify(next));
    _soundSubs.forEach(fn => { try { fn(next); } catch { /* ignore */ } });
  } catch {}
}

// ── v9.0 voice helpers ───────────────────────────────────────────────────
// Every recipe is built from these. Notes connect to a `dest` node (the
// master-bus input) rather than ctx.destination directly, so the limiter
// and reverb apply to everything. `dest` falls back to ctx.destination when
// the master bus can't be built (see _buildBus), keeping behaviour and tests
// intact.

// A single clean tone with a soft exponential attack and a natural
// exponential decay. Exponential ramps (vs the old linear attack→hold→fall)
// sound smoother and never click. Gains are clamped above zero because
// exponentialRampToValueAtTime can't target 0.
function _voice(ctx, dest, freq, t, durMs, gain, type = "sine", attackMs = 8) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const dur = durMs / 1000;
  const peak = Math.max(0.0002, gain);
  const a = Math.min(attackMs / 1000, dur * 0.5);
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur);
}

// A clean "chime": a sine fundamental, a quiet octave for clarity, and a
// faint slightly-inharmonic 12th (×3.01) for a touch of sparkle. Far lighter
// than the old 4-oscillator detuned bell — the reverb bus supplies the body
// and tail, so the note itself stays uncluttered.
function _chime(ctx, dest, t, freq, durMs, gain, attackMs = 6) {
  _voice(ctx, dest, freq,        t, durMs,        gain,        "sine", attackMs);
  _voice(ctx, dest, freq * 2.0,  t, durMs * 0.55, gain * 0.26, "sine", attackMs);
  _voice(ctx, dest, freq * 3.01, t, durMs * 0.32, gain * 0.09, "sine", attackMs);
}

// A slow swelling pad: fundamental + perfect fifth + sub-octave, all with a
// long attack so it builds in like a filter sweep. Sits under the arpeggios
// in startup / focus / achievement to set the mood.
function _swell(ctx, dest, freq, t, durMs, gain, attackMs = 220) {
  _voice(ctx, dest, freq,        t, durMs,        gain,        "sine", attackMs);
  _voice(ctx, dest, freq * 1.5,  t, durMs * 0.9,  gain * 0.45, "sine", attackMs);
  _voice(ctx, dest, freq * 0.5,  t, durMs * 1.1,  gain * 0.60, "sine", attackMs);
}

// v9.0 sound design: modern, clean, resonant. Inspired by the restraint of
// contemporary OS sounds (macOS, iOS, Windows 11) — short, well-voiced notes
// in consonant intervals, given space by the reverb bus rather than by piling
// on layers. Pitches resolve to musical chords so overlapping notes harmonise.
//
// Recipe signature: (ctx, t, v, r, d)
//   ctx — AudioContext   t — start time (ctx.currentTime)
//   v   — volume 0..1     r — per-wallpaper pitch ratio (1.0 = no transpose)
//   d   — master-bus input node to connect notes to
//
// Note name → Hz reference (at r=1):
//   C3=130.81  G3=196.00  C4=261.63  E4=329.63  G4=392.00  A4=440.00
//   C5=523.25  D5=587.33  E5=659.25  G5=783.99  A5=880.00  C6=1046.50  G6=1568
const SOUND_RECIPES = {
  // Welcome chord — a clean rising major triad (C5–E5–G5) over a soft
  // sub-octave body. With the limiter keeping it under 0dBFS and the reverb
  // supplying the tail, the three notes ring *together* into one resonant
  // moment. This is the sound the whole v9.0 pass was built to fix.
  login: (ctx, t, v, r, d) => {
    _voice(ctx, d, 130.81 * r, t + 0.00, 1400, 0.06 * v, "sine", 120);   // C3 body
    _chime(ctx, d, t + 0.00, 523.25 * r, 900,  0.15 * v);                // C5
    _chime(ctx, d, t + 0.10, 659.25 * r, 950,  0.15 * v);                // E5
    _chime(ctx, d, t + 0.20, 783.99 * r, 1300, 0.16 * v);                // G5 — rings out
  },

  // Logout — a calm two-step descent (G5 → C5) settling onto a low C body.
  // "Winding down" without being mournful.
  logout: (ctx, t, v, r, d) => {
    _chime(ctx, d, t + 0.00, 783.99 * r, 700,  0.13 * v);                // G5
    _chime(ctx, d, t + 0.16, 523.25 * r, 900,  0.13 * v);                // C5
    _voice(ctx, d, 130.81 * r, t + 0.10, 1500, 0.06 * v, "sine", 150);   // C3 settle
  },

  // Startup — a short cinematic pad swell, then a four-note C-major-add9
  // arpeggio resolving an octave up. The reverb carries the tail so the
  // notes stay clean instead of smearing into mud.
  startup: (ctx, t, v, r, d) => {
    _swell(ctx, d, 130.81 * r, t + 0.00, 1900, 0.06 * v, 320);           // C3 pad
    _chime(ctx, d, t + 0.30, 261.63 * r, 800,  0.11 * v);                // C4
    _chime(ctx, d, t + 0.55, 392.00 * r, 850,  0.12 * v);                // G4
    _chime(ctx, d, t + 0.80, 587.33 * r, 950,  0.12 * v);                // D5 (add9)
    _chime(ctx, d, t + 1.10, 1046.50 * r, 1500, 0.13 * v);               // C6 — sparkle
  },

  // Notification — a friendly rising perfect fourth (G5 → C6); two clean
  // chimes that overlap into a single shimmer. Modern, not a doorbell.
  notification: (ctx, t, v, r, d) => {
    _chime(ctx, d, t + 0.00, 783.99 * r, 850,  0.14 * v);                // G5
    _chime(ctx, d, t + 0.12, 1046.50 * r, 1050, 0.14 * v);               // C6
  },

  // Message ping — one soft chime with a high sparkle. A light "drop" for
  // the frequent chat / DM moment, distinct from a full notification.
  message: (ctx, t, v, r, d) => {
    _chime(ctx, d, t + 0.00, 880.00 * r, 620, 0.12 * v);                 // A5
    _voice(ctx, d, 1760.00 * r, t + 0.04, 240, 0.04 * v, "sine", 6);     // A6 air
  },

  // Success — a quick two-note lift to a major sixth (C5 → A5). Used for
  // routine "saved / applied" moments, so it's brief but still smooth.
  success: (ctx, t, v, r, d) => {
    _chime(ctx, d, t + 0.00, 523.25 * r, 600, 0.13 * v);                 // C5
    _chime(ctx, d, t + 0.10, 880.00 * r, 800, 0.14 * v);                 // A5
  },

  // Error — a soft low minor-third fall (F3 → D3). Sine-based so it's never
  // harsh; transpose is capped at 1.0 so it can't read as cheerfully bright.
  error: (ctx, t, v, r, d) => {
    const er = Math.min(1, r);
    _voice(ctx, d, 174.61 * er, t + 0.00, 420, 0.22 * v, "sine", 14);    // F3
    _voice(ctx, d, 146.83 * er, t + 0.10, 520, 0.18 * v, "sine", 14);    // D3
  },

  // Alert — two chimes a minor third apart (A4 → C5). Purposeful attention
  // pull that lingers (via reverb) rather than stops the presses.
  alert: (ctx, t, v, r, d) => {
    _chime(ctx, d, t + 0.00, 440.00 * r, 650, 0.16 * v);                 // A4
    _chime(ctx, d, t + 0.16, 523.25 * r, 850, 0.17 * v);                 // C5
  },

  // Focus — a low swelling pad and a single mid chime; reads as "settling
  // in", with a long attack so it doesn't punch. For entering focus/fullscreen.
  focus: (ctx, t, v, r, d) => {
    _swell(ctx, d, 196.00 * r, t + 0.00, 1400, 0.06 * v, 260);           // G3 pad
    _chime(ctx, d, t + 0.18, 587.33 * r, 950, 0.10 * v);                 // D5 mid bell
  },

  // Achievement — a four-note rising arpeggio with a held top and a final
  // sparkle. Triumphant but graceful; the reverb tail lets the chord ring on.
  achievement: (ctx, t, v, r, d) => {
    _swell(ctx, d, 196.00 * r, t + 0.00, 1400, 0.05 * v, 120);           // G3 body
    _chime(ctx, d, t + 0.00, 392.00 * r, 600, 0.12 * v);                 // G4
    _chime(ctx, d, t + 0.12, 523.25 * r, 650, 0.13 * v);                 // C5
    _chime(ctx, d, t + 0.24, 659.25 * r, 750, 0.14 * v);                 // E5
    _chime(ctx, d, t + 0.38, 783.99 * r, 1300, 0.15 * v);                // G5 — held
    _voice(ctx, d, 1567.98 * r, t + 0.40, 700, 0.06 * v, "sine", 6);     // G6 — sparkle
  },

  // ── light UI ticks ────────────────────────────────────────────────────
  // Short, quiet, low-latency. These skip the reverb send (see playSound) so
  // the frequent ones stay crisp and cheap.

  // Window open — a quick soft upward tick.
  windowOpen: (ctx, t, v, r, d) => {
    _voice(ctx, d, 740 * r,  t + 0.00, 70,  0.07 * v, "sine", 4);
    _voice(ctx, d, 1110 * r, t + 0.02, 120, 0.07 * v, "sine", 4);
  },

  // Window close — a quick soft downward tick.
  windowClose: (ctx, t, v, r, d) => {
    _voice(ctx, d, 880 * r, t + 0.00, 80,  0.07 * v, "sine", 4);
    _voice(ctx, d, 587 * r, t + 0.04, 130, 0.06 * v, "sine", 4);
  },

  // App launch — an airy high sparkle.
  appLaunch: (ctx, t, v, r, d) => {
    _voice(ctx, d, 1046.50 * r, t + 0.00, 90,  0.08 * v, "sine", 4);
    _voice(ctx, d, 1568.00 * r, t + 0.03, 150, 0.05 * v, "sine", 4);
  },

  // Toast — a very light high chime + air. Plays often, stays subtle.
  toast: (ctx, t, v, r, d) => {
    _voice(ctx, d, 1046.50 * r, t + 0.00, 200, 0.080 * v, "sine", 6);    // C6
    _voice(ctx, d, 1568.00 * r, t + 0.00, 130, 0.035 * v, "sine", 6);    // G6 air
  },

  // Click — a tiny short tick for buttons/menus.
  click: (ctx, t, v, r, d) => {
    _voice(ctx, d, 1480 * r, t + 0.00, 28, 0.05 * v, "sine", 2);
  },

  // ── v9.4 — alarm recipes (Clock app) ─────────────────────────────────
  // Three distinct alarm voices, all in the same master-bus engine so the
  // limiter + reverb + lowpass apply (no harsh clipping even at louder
  // settings). Each is ~3 seconds long so a single firing has enough
  // sustained attention-grab. NovaOS's alarm scheduler may also fire
  // playSound() multiple times in a row for a real "ringing" effect.

  // Gentle ascending bell sequence — a Nova-style sunrise wake.
  alarmSunrise: (ctx, t, v, r, d) => {
    _chime(ctx, d, t + 0.00, 523.25 * r, 1200, 0.16 * v);  // C5
    _chime(ctx, d, t + 0.45, 659.25 * r, 1200, 0.16 * v);  // E5
    _chime(ctx, d, t + 0.90, 783.99 * r, 1400, 0.18 * v);  // G5
    _chime(ctx, d, t + 1.35, 1046.50 * r, 1600, 0.18 * v); // C6
    // Second cycle, a major-sixth lift to keep the ear pulling forward
    _chime(ctx, d, t + 2.00, 880.00 * r, 1400, 0.17 * v);  // A5
    _chime(ctx, d, t + 2.45, 1318.51 * r, 1600, 0.19 * v); // E6
  },

  // Pulsing low+high two-tone — urgent but warm, like a hotel alarm.
  alarmPulse: (ctx, t, v, r, d) => {
    for (let i = 0; i < 6; i++) {
      const start = t + i * 0.5;
      _voice(ctx, d, 220 * r, start, 280, 0.16 * v, "sine", 18); // A3 body
      _voice(ctx, d, 440 * r, start, 280, 0.13 * v, "sine", 18); // A4 layer
    }
  },

  // Classic alarm clock — fast square-wave beeps with a sine layer for body.
  // The square wave gives it that unmistakable "the alarm is ringing" feel
  // without being harsh (the master limiter + lowpass tames it).
  alarmClassic: (ctx, t, v, r, d) => {
    const er = Math.min(1, r);   // cap transpose so it can't get piercing
    for (let i = 0; i < 8; i++) {
      const start = t + i * 0.25;
      _voice(ctx, d, 880 * er, start, 130, 0.20 * v, "square", 8);
      _voice(ctx, d, 440 * er, start, 130, 0.10 * v, "sine", 8);  // body
    }
  },

  // v9.4 — Volume-sample tone. Plays when the user moves the volume
  // slider (Settings → Sound, or the taskbar quick-settings flyout) so
  // they can hear how loud the new level actually is — same UX trick
  // Windows uses. Two-note rising chime (A5 → C#6, a major third) is
  // short, instantly recognizable as "this is a volume preview," and
  // plays at the just-set volume (playSound reads the live config on
  // every call).
  volumeSample: (ctx, t, v, r, d) => {
    _voice(ctx, d, 880.00 * r, t + 0.00, 100, 0.18 * v, "sine", 5);   // A5
    _voice(ctx, d, 1108.73 * r, t + 0.06, 130, 0.16 * v, "sine", 5);  // C#6
  },

  // ── v9.4 — Atmos severe-weather alert ──────────────────────────────
  // Three-pulse 607 Hz sawtooth — mirrors the classic Weatherscan alarm
  // cadence (three urgent bursts) using the original NWS alert frequency.
  // Sawtooth carries the "this is an alert" timbre; the master lowpass
  // softens the harshness so it grabs attention without piercing.
  nwsAlert: (ctx, t, v, r, d) => {
    const er = Math.min(1, r);
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.55;
      _voice(ctx, d, 607 * er, start, 400, 0.22 * v, "sawtooth", 12);
      _voice(ctx, d, 303.5 * er, start, 400, 0.10 * v, "sine", 12);   // sub-octave body
    }
  },
};

/** Names of all available system sounds. Useful for Settings UI previews. */
export const SOUND_NAMES = Object.keys(SOUND_RECIPES);

// Approximate active duration per sound (ms) — used only to schedule context
// teardown. The reverb tail is added on top when the bus has convolution.
const SOUND_TAILS = {
  startup: 2700, login: 1500, logout: 1700, notification: 1200,
  achievement: 1800, focus: 1500, alert: 1100, success: 950,
  error: 700, message: 900, toast: 450, windowOpen: 250,
  windowClose: 300, appLaunch: 300, click: 100,
  // v9.4 — alarm + NWS recipes ring out longer than typical UI sounds.
  alarmSunrise: 4200, alarmPulse: 3500, alarmClassic: 2500, nwsAlert: 2200,
  // v9.4 — volume preview is a quick chime, no reverb tail (see DRY_SOUNDS).
  volumeSample: 250,
};

// Sounds that skip the reverb send — short UI ticks that should stay crisp
// and cheap (no impulse generation, no lingering tail).
const DRY_SOUNDS = new Set(["click", "windowOpen", "windowClose", "appLaunch", "toast", "volumeSample"]);

// Build a decaying-white-noise impulse response — a cheap, plausible "small
// room" reverb tail. Stereo so the space feels wide.
function _impulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate || 44100;
  const len = Math.max(1, Math.floor(seconds * rate));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// Build the master bus and return its input node. Routing:
//   notes → tone (lowpass) → limiter → destination
//                          ↘ convolver → wet gain ↗   (musical sounds only)
// Feature-detects the advanced nodes; if any are missing (e.g. the jsdom
// test mock), falls back to ctx.destination so recipes still schedule.
function _buildBus(ctx, withReverb) {
  let input = ctx.destination;
  let reverb = false;
  try {
    if (typeof ctx.createDynamicsCompressor === "function" &&
        typeof ctx.createBiquadFilter === "function" &&
        typeof ctx.createGain === "function") {
      // Limiter — a compressor pushed toward brickwall to catch peaks before
      // they clip. Soft knee + moderate ratio keeps it transparent on quiet
      // sounds and only clamps the loudest layered chords.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2;
      limiter.knee.value = 6;
      limiter.ratio.value = 18;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      limiter.connect(ctx.destination);

      // Gentle lowpass — shaves the brittle digital top off pure oscillators.
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 8800;
      tone.Q.value = 0.4;
      tone.connect(limiter);

      input = tone;

      // Reverb send — only for musical sounds, and only if convolution is
      // available. Generating the impulse is cheap and these sounds are rare.
      if (withReverb &&
          typeof ctx.createConvolver === "function" &&
          typeof ctx.createBuffer === "function") {
        const conv = ctx.createConvolver();
        conv.buffer = _impulse(ctx, 1.6, 2.6);
        const wet = ctx.createGain();
        wet.gain.value = 0.2;
        tone.connect(conv);
        conv.connect(wet).connect(limiter);
        reverb = true;
      }
    }
  } catch { input = ctx.destination; reverb = false; }
  return { input, reverb };
}

/**
 * Play a named system sound. Respects the user's enabled / volume preferences
 * automatically. Calling with an unknown name is a no-op.
 *
 * @param {string} name  one of SOUND_NAMES
 */
export function playSound(name) {
  if (typeof window === "undefined") return;
  const recipe = SOUND_RECIPES[name];
  if (!recipe) return;
  const cfg = getSoundConfig();
  if (!cfg.enabled || cfg.volume <= 0) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  let ctx;
  try { ctx = new AC(); } catch { return; }
  if (typeof ctx.resume === "function" && ctx.state === "suspended") {
    try { ctx.resume(); } catch {}
  }

  const bus = _buildBus(ctx, !DRY_SOUNDS.has(name));
  const r = getActivePitchRatio();
  try {
    recipe(ctx, ctx.currentTime, cfg.volume, r, bus.input);
  } catch {}

  // Tear the context down after the sound (plus its reverb tail) finishes.
  // Closing too early would chop the trailing decay and reintroduce the
  // abrupt feel this pass was meant to eliminate.
  const closeMs = (SOUND_TAILS[name] ?? 1200) + (bus.reverb ? 1800 : 250);
  setTimeout(() => { try { ctx.close(); } catch {} }, closeMs);
}

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

// ── System Sounds ──────────────────────────────────────────────────────
//
// All system sounds are *procedurally generated* via Web Audio — no audio
// files, no fetch, no bundle bloat. Each sound is a small composition of
// short tones with attack/release envelopes; the design feels "modern" /
// musical rather than the classic OS bleeps.
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
export function setSoundConfig(cfg) {
  if (typeof localStorage === "undefined") return;
  try {
    const cur = getSoundConfig();
    const next = { ...cur, ...cfg };
    localStorage.setItem(SOUND_LS_KEY, JSON.stringify(next));
  } catch {}
}

// Schedule one note on a shared AudioContext with a percussive envelope.
// Caller is responsible for the ctx lifecycle.
function _scheduleNote(ctx, freq, startTime, durationMs, peakGain, type = "sine") {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dur = durationMs / 1000;
  osc.type = type;
  osc.frequency.value = freq;
  const attack = Math.min(0.012, dur * 0.15);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  // Exponential decay sounds more natural than linear for percussive tones
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + dur);
}

// v7.0 helper: a "modern bell" — fundamental + slightly-inharmonic upper
// partials. Real bells have non-integer overtones (2.01x, 3.03x rather than
// pure 2x and 3x), which is why they sound rich and "alive" instead of
// cold and pure-toned. Triangle base softens the attack vs sine.
function _bell(ctx, t, freq, durationMs, peakGain) {
  _scheduleNote(ctx, freq,         t, durationMs,        peakGain,         "triangle");
  _scheduleNote(ctx, freq * 2.01,  t, durationMs * 0.70, peakGain * 0.40,  "sine");
  _scheduleNote(ctx, freq * 3.03,  t, durationMs * 0.50, peakGain * 0.18,  "sine");
}

// v7.0 helper: a soft "shimmer" — fundamental + octave + perfect fifth,
// faster decay. Used for short positive feedback (windowOpen, appLaunch).
// More compact than _bell, more luminous than a single sine.
function _shimmer(ctx, t, freq, durationMs, peakGain) {
  _scheduleNote(ctx, freq,        t, durationMs,        peakGain,        "triangle");
  _scheduleNote(ctx, freq * 1.5,  t, durationMs * 0.60, peakGain * 0.25, "sine");
  _scheduleNote(ctx, freq * 2,    t, durationMs * 0.50, peakGain * 0.20, "sine");
}

// ── v8.0 smooth-sound helpers ──────────────────────────────────────────
// Designed for the "Windows 11 but better" target. Two key changes vs the
// percussive _scheduleNote/_bell pair above:
//   1. Softer attack (~45ms vs 12ms) — sounds emerge gently rather than
//      pop in. Reads as "smooth", "modern", "polished".
//   2. Longer trailing decay — notes ring out into atmospheric tails,
//      mimicking the reverb-like quality of OS sounds without needing
//      actual convolution reverb.
//
// Plus a slight detune layer on _smoothBell creates a chorus effect that
// gives the tone organic depth — the difference between a synthesized
// chime and one recorded in a small room.

// Smooth single-tone scheduler. Optional attackMs lets a recipe slow the
// onset further for swell-style notes (used by `startup`).
function _smoothNote(ctx, freq, startTime, durationMs, peakGain, type = "sine", attackMs = 45) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dur = durationMs / 1000;
  osc.type = type;
  osc.frequency.value = freq;
  const attack = Math.min(attackMs / 1000, dur * 0.4);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + dur);
}

// Smooth bell — like _bell but with longer tail, soft attack, and a
// slight chorus from a detuned twin fundamental. Sounds like a clean
// glassy chime with body, not a struck triangle.
function _smoothBell(ctx, t, freq, durationMs, peakGain) {
  _smoothNote(ctx, freq,           t, durationMs * 1.4, peakGain,          "sine");
  _smoothNote(ctx, freq * 1.0035,  t, durationMs * 1.4, peakGain * 0.55,   "sine");   // chorus detune
  _smoothNote(ctx, freq * 2.005,   t, durationMs * 0.85, peakGain * 0.32,  "sine");   // octave shimmer
  _smoothNote(ctx, freq * 3.01,    t, durationMs * 0.50, peakGain * 0.12,  "sine");   // upper sparkle
}

// Atmospheric pad — long slow swell for backgrounds. Used by startup to
// build mood under the bell arpeggio. The slow attack means it builds
// in like a synthesizer's filter sweep without any actual filter.
function _pad(ctx, t, freq, durationMs, peakGain, attackMs = 200) {
  _smoothNote(ctx, freq,         t, durationMs,         peakGain,         "sine", attackMs);
  _smoothNote(ctx, freq * 1.499, t, durationMs * 0.92,  peakGain * 0.55,  "sine", attackMs);  // perfect 5th
  _smoothNote(ctx, freq * 0.5,   t, durationMs * 1.10,  peakGain * 0.70,  "sine", attackMs);  // sub octave
}

// v7.0 sound design: modern, organic, less "ping" more "chime." Every
// recipe routes through _bell or _shimmer (defined above) which add slightly-
// inharmonic upper partials for richness — the difference between a pure
// sine and a struck bell. Pitches still resolve to musical chords so layered
// notes harmonize.
//
// `r` is the per-wallpaper pitch ratio (1.0 = no transpose). See
// getActivePitchRatio() above.
//
// Note name → Hz reference (at r=1):
//   C4=261.63  E4=329.63  G4=392.00  C5=523.25  E5=659.25  G5=783.99
//   A4=440.00  D5=587.33  A5=880.00  C6=1046.50  E6=1318.51  G6=1568
const SOUND_RECIPES = {
  // v8.0 — smooth notification. A bell pair with a major 9th lift (D5 → E6
  // an octave up) instead of the v7 perfect fifth. Major 9 voicings sound
  // "modern atmospheric" rather than "classical fanfare". Long decay tails
  // make the two bells overlap into a single shimmering moment. A soft
  // sub-octave body sustains underneath for warmth.
  notification: (ctx, t, v, r) => {
    _smoothNote(ctx, 146.83 * r, t + 0.00, 1100, 0.05 * v, "sine", 80);  // D3 body
    _smoothBell(ctx, t + 0.00, 587.33 * r, 1100, 0.15 * v);              // D5
    _smoothBell(ctx, t + 0.13, 1318.51 * r, 1300, 0.13 * v);             // E6 — major 9 lift
  },

  // v8.0 — cinematic startup. A slow pad swell sets the mood (4 seconds!),
  // then a 5-note ascending C-major-add9 arpeggio resolves into a final
  // upper-octave shimmer. Designed to feel like a real OS boot sound where
  // you sense atmosphere first, then notes emerge from it.
  startup: (ctx, t, v, r) => {
    // Slow pad swell — sets the room before any bells ring
    _pad(ctx, t + 0.00, 130.81 * r, 2200, 0.07 * v, 350);                 // C3 pad
    // Bell arpeggio rising through C major add9 (C, E, G, D, G higher)
    _smoothBell(ctx, t + 0.35, 261.63 * r, 950,  0.11 * v);               // C4
    _smoothBell(ctx, t + 0.62, 392.00 * r, 950,  0.12 * v);               // G4
    _smoothBell(ctx, t + 0.89, 523.25 * r, 1050, 0.13 * v);               // C5
    _smoothBell(ctx, t + 1.16, 587.33 * r, 1150, 0.13 * v);               // D5
    _smoothBell(ctx, t + 1.50, 1046.50 * r, 1400, 0.12 * v);              // C6 — final sparkle
  },

  // v8.0 — smooth login. Three rising bells in a major 6th voicing (C, E,
  // A — the C6 chord; richer than a plain triad). Slower spacing and
  // longer tails so the chord rings together for a beat at the end.
  login: (ctx, t, v, r) => {
    _smoothNote(ctx, 261.63 * r, t + 0.00, 1200, 0.05 * v, "sine", 120);  // C4 body
    _smoothBell(ctx, t + 0.00, 523.25 * r, 900,  0.14 * v);               // C5
    _smoothBell(ctx, t + 0.16, 659.25 * r, 950,  0.14 * v);               // E5
    _smoothBell(ctx, t + 0.32, 880.00 * r, 1100, 0.16 * v);               // A5 — major 6th lift
  },

  // v8.0 — smooth logout. A slow descending fade — A5 → E5 → C5 → C4
  // — that gives the sense of "winding down" without being mournful.
  // The final low C is held longest, like the last echo of the session.
  logout: (ctx, t, v, r) => {
    _smoothBell(ctx, t + 0.00, 880.00 * r, 700,  0.13 * v);               // A5
    _smoothBell(ctx, t + 0.18, 659.25 * r, 800,  0.13 * v);               // E5
    _smoothBell(ctx, t + 0.36, 523.25 * r, 950,  0.13 * v);               // C5
    _smoothBell(ctx, t + 0.58, 261.63 * r, 1500, 0.14 * v);               // C4 — final settle
  },

  // Soft low "bonk" instead of the old sawtooth buzz. Serious but not harsh.
  // Errors cap their transpose at 1.0 so they never get cheerfully bright.
  // v8.0 — slightly softer attack so it doesn't startle.
  error: (ctx, t, v, r) => {
    const er = Math.min(1, r);
    _smoothNote(ctx, 174.61 * er, t + 0.00, 380, 0.24 * v, "sine", 30);  // F3
    _smoothNote(ctx, 116.54 * er, t + 0.00, 440, 0.16 * v, "sine", 30);  // Bb2 octave-down body
  },

  // Quick window-open swell — kept short for low-latency feel.
  windowOpen: (ctx, t, v, r) => {
    _shimmer(ctx, t, 880 * r, 90, 0.10 * v);
  },

  // Soft descending close — two falling notes
  windowClose: (ctx, t, v, r) => {
    _scheduleNote(ctx, 880 * r, t + 0.00, 80, 0.09 * v, "triangle");
    _scheduleNote(ctx, 587 * r, t + 0.05, 110, 0.08 * v, "triangle");
  },

  // Bright launch sparkle — like windowOpen but airier
  appLaunch: (ctx, t, v, r) => {
    _shimmer(ctx, t, 1046.50 * r, 100, 0.10 * v);
  },

  // Subtle chime with a hint of high sparkle — plays often, stays light.
  // v8.0 — slightly longer tail so toasts feel less abrupt.
  toast: (ctx, t, v, r) => {
    _smoothNote(ctx, 1046.50 * r, t + 0.00, 220, 0.09 * v, "sine", 20);  // C6
    _smoothNote(ctx, 2093.00 * r, t + 0.00, 140, 0.04 * v, "sine", 20);  // C7 air
  },

  // Tiny click for buttons/menus — very short, very quiet
  click: (ctx, t, v, r) => {
    _scheduleNote(ctx, 1567.98 * r, t + 0.00, 30, 0.06 * v, "triangle");
  },

  // ── v8.0 sound additions ──────────────────────────────────────────────
  // Designed to plug into existing UI moments — success/error existed but
  // are tied to specific message kinds; these give us more granular voicing
  // for chat messages, focus mode, attention pulls, and triumphant moments.

  // v8.0 — smooth success. Two-note rise to a major 6th (C5 → A5) with a
  // sub-octave body for warmth. Shorter than `login` since it's used in
  // routine moments (saved, applied, etc.) but still smooth.
  success: (ctx, t, v, r) => {
    _smoothNote(ctx, 261.63 * r, t + 0.00, 700, 0.04 * v, "sine", 60);   // C4 body
    _smoothBell(ctx, t + 0.00, 523.25 * r, 700, 0.13 * v);               // C5
    _smoothBell(ctx, t + 0.11, 880.00 * r, 850, 0.14 * v);               // A5 — major 6 lift
  },

  // v8.0 — smooth message ping. Single soft bell with a quick high-sparkle
  // overtone. Designed to feel like a "drop" rather than a chord — appropriate
  // for the frequent-but-light chat / DM moment.
  message: (ctx, t, v, r) => {
    _smoothBell(ctx, t + 0.00, 880.00 * r, 600, 0.12 * v); // A5
    _smoothNote(ctx, 1760.00 * r, t + 0.05, 280, 0.05 * v, "sine", 25);  // A6 sparkle
  },

  // v8.0 — smooth focus. Slow swelling pad on G3 with a fifth above,
  // then a single mid bell. Reads as "settling in", longer attack so it
  // doesn't punch you — perfect for entering fullscreen / focus mode.
  focus: (ctx, t, v, r) => {
    _pad(ctx, t + 0.00, 196.00 * r, 1500, 0.07 * v, 280);                // G3 pad
    _smoothBell(ctx, t + 0.20, 587.33 * r, 1000, 0.10 * v);              // D5 mid bell
  },

  // v8.0 — smooth alert. Two bells with a minor-third rise (A4 → C#5).
  // Purposeful attention pull, but with the new long tails it lingers in
  // a way that says "look at this" rather than "stop the presses".
  alert: (ctx, t, v, r) => {
    _smoothBell(ctx, t + 0.00, 440.00 * r, 700, 0.16 * v);               // A4
    _smoothBell(ctx, t + 0.18, 554.37 * r, 900, 0.18 * v);               // C#5
  },

  // v8.0 — smooth achievement. 4-note rising arpeggio + held G6 sparkle.
  // Triumphant but graceful — the longer tails make the chord ring out
  // for a beat after the final note, like a proper "you did it" moment.
  achievement: (ctx, t, v, r) => {
    _smoothNote(ctx, 196.00 * r, t + 0.00, 1500, 0.05 * v, "sine", 100); // G3 body
    _smoothBell(ctx, t + 0.00, 392.00 * r, 700, 0.13 * v);               // G4
    _smoothBell(ctx, t + 0.13, 523.25 * r, 750, 0.14 * v);               // C5
    _smoothBell(ctx, t + 0.26, 659.25 * r, 850, 0.15 * v);               // E5
    _smoothBell(ctx, t + 0.42, 783.99 * r, 1200, 0.17 * v);              // G5 — held
    _smoothBell(ctx, t + 0.55, 1567.98 * r, 900, 0.10 * v);              // G6 — final sparkle
  },
};

/** Names of all available system sounds. Useful for Settings UI previews. */
export const SOUND_NAMES = Object.keys(SOUND_RECIPES);

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
  const pitchRatio = getActivePitchRatio();
  try {
    recipe(ctx, ctx.currentTime, cfg.volume, pitchRatio);
  } catch {}
  // Tear the context down a bit after the longest possible sound finishes.
  // v8.0: extended to 4000ms because the new smooth recipes have much
  // longer atmospheric tails (startup is ~3000ms total, achievement +
  // notification can ring out for 2+ seconds). Closing too early would
  // chop off the trailing reverb-like decays and reintroduce the abrupt
  // feel the smoothness pass was meant to eliminate.
  setTimeout(() => { try { ctx.close(); } catch {} }, 4000);
}

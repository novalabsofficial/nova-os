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
  prism:  6,
  glass:  4,
  solar: -2,
  mono:   1,
  velvet:-1,
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
  // Soft two-note bell chime — fifth interval (D5 → A5) feels open + friendly
  notification: (ctx, t, v, r) => {
    _bell(ctx, t + 0.00, 587.33 * r, 420, 0.20 * v);
    _bell(ctx, t + 0.09, 880.00 * r, 540, 0.22 * v);
  },

  // Cinematic startup — low octave drone provides body, mid-bells stack up
  // to a C major triad. Slower, more spacious than the old arpeggio.
  startup: (ctx, t, v, r) => {
    // Low body — long, soft, sets the mood
    _scheduleNote(ctx, 130.81 * r, t + 0.00, 1300, 0.09 * v, "triangle");
    // Bells climb a major triad
    _bell(ctx, t + 0.00, 261.63 * r, 760,  0.13 * v);  // C4
    _bell(ctx, t + 0.22, 392.00 * r, 800,  0.14 * v);  // G4
    _bell(ctx, t + 0.44, 523.25 * r, 900,  0.16 * v);  // C5
    _bell(ctx, t + 0.66, 783.99 * r, 1100, 0.14 * v);  // G5 — sparkle on top
  },

  // Bright welcome chime — C major arpeggio with bell richness
  login: (ctx, t, v, r) => {
    _bell(ctx, t + 0.00, 523.25 * r, 380, 0.18 * v);  // C5
    _bell(ctx, t + 0.08, 659.25 * r, 380, 0.18 * v);  // E5
    _bell(ctx, t + 0.16, 783.99 * r, 480, 0.20 * v);  // G5
  },

  // Gentle descending farewell — three soft bells walking down
  logout: (ctx, t, v, r) => {
    _bell(ctx, t + 0.00, 523.25 * r, 360, 0.16 * v);  // C5
    _bell(ctx, t + 0.13, 392.00 * r, 460, 0.16 * v);  // G4
    _bell(ctx, t + 0.26, 261.63 * r, 620, 0.14 * v);  // C4
  },

  // Soft low "bonk" instead of the old sawtooth buzz. Serious but not harsh.
  // Errors cap their transpose at 1.0 so they never get cheerfully bright.
  error: (ctx, t, v, r) => {
    const er = Math.min(1, r);
    _scheduleNote(ctx, 174.61 * er, t + 0.00, 280, 0.26 * v, "triangle");  // F3
    _scheduleNote(ctx, 116.54 * er, t + 0.00, 340, 0.18 * v, "triangle");  // Bb2 octave-down body
  },

  // Crisp "pop" with a touch of sparkle on top
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

  // Subtle chime with a hint of high sparkle — plays often, stays light
  toast: (ctx, t, v, r) => {
    _scheduleNote(ctx, 1046.50 * r, t + 0.00, 140, 0.10 * v, "triangle");  // C6
    _scheduleNote(ctx, 2093.00 * r, t + 0.00, 90,  0.04 * v, "sine");      // C7 air
  },

  // Tiny click for buttons/menus — very short, very quiet
  click: (ctx, t, v, r) => {
    _scheduleNote(ctx, 1567.98 * r, t + 0.00, 30, 0.06 * v, "triangle");
  },

  // ── v8.0 sound additions ──────────────────────────────────────────────
  // Designed to plug into existing UI moments — success/error existed but
  // are tied to specific message kinds; these give us more granular voicing
  // for chat messages, focus mode, attention pulls, and triumphant moments.

  // "success" — bright affirmative chord (C major triad + octave sparkle).
  // Used by completed-action moments (file saved, settings applied, etc.).
  // Longer/richer than `login` so it carries more weight as a "done!" cue.
  success: (ctx, t, v, r) => {
    _bell(ctx, t + 0.00, 523.25 * r, 320, 0.16 * v);  // C5
    _bell(ctx, t + 0.06, 659.25 * r, 340, 0.16 * v);  // E5
    _bell(ctx, t + 0.12, 783.99 * r, 380, 0.18 * v);  // G5
    _bell(ctx, t + 0.20, 1046.50 * r, 480, 0.14 * v); // C6 — sparkle on top
  },

  // "message" — soft two-note pop for chat / DM arrivals. E5 → A5 minor third
  // step has a friendly, attention-without-alarm character.
  message: (ctx, t, v, r) => {
    _shimmer(ctx, t + 0.00, 659.25 * r, 220, 0.13 * v); // E5
    _shimmer(ctx, t + 0.07, 880.00 * r, 280, 0.14 * v); // A5
  },

  // "focus" — calm tone for entering fullscreen / focus mode. Single low
  // shimmer with a fifth above it; settles the listener rather than
  // exciting them. Sounds "ready to concentrate."
  focus: (ctx, t, v, r) => {
    _scheduleNote(ctx, 196.00 * r, t + 0.00, 700, 0.09 * v, "triangle"); // G3 body
    _shimmer(ctx, t + 0.05, 392.00 * r, 520, 0.10 * v);                  // G4
    _shimmer(ctx, t + 0.15, 587.33 * r, 480, 0.08 * v);                  // D5 fifth
  },

  // "alert" — attention pull that's NOT an error. Used for important
  // notifications (e.g. NWS alerts, mod actions). Two short bells with a
  // slight pitch rise — feels purposeful, not alarming.
  alert: (ctx, t, v, r) => {
    _bell(ctx, t + 0.00, 440.00 * r, 280, 0.18 * v); // A4
    _bell(ctx, t + 0.18, 554.37 * r, 320, 0.20 * v); // C#5 — minor third up
  },

  // "achievement" — triumphant 4-note rising arpeggio. Reserved for
  // milestone moments (high-score beat, level-up in games, etc.) — long
  // and clearly celebratory so it feels earned rather than routine.
  achievement: (ctx, t, v, r) => {
    _bell(ctx, t + 0.00, 392.00 * r, 320, 0.15 * v);  // G4
    _bell(ctx, t + 0.10, 523.25 * r, 320, 0.16 * v);  // C5
    _bell(ctx, t + 0.20, 659.25 * r, 380, 0.18 * v);  // E5
    _bell(ctx, t + 0.32, 783.99 * r, 560, 0.20 * v);  // G5 — held final
    _shimmer(ctx, t + 0.40, 1567.98 * r, 320, 0.08 * v); // G6 sparkle
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
  // Startup is ~870ms; everything else is shorter. 1500ms is comfortable.
  setTimeout(() => { try { ctx.close(); } catch {} }, 1500);
}

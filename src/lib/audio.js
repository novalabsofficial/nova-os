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

// Each entry is (ctx, now, vol) => schedule notes. Frequencies are tuned to
// musical pitches so layered notes harmonize.
//
// Note name → Hz reference:
//   A4=440  C5=523.25  D5=587.33  E5=659.25  G5=783.99  A5=880
//   C4=261.63  E4=329.63  G4=392  E6=1318.51
const SOUND_RECIPES = {
  // Two ascending notes — D5 then A5 — fast and friendly, the bell-like default
  notification: (ctx, t, v) => {
    _scheduleNote(ctx, 587.33, t + 0.00, 240, 0.28 * v);
    _scheduleNote(ctx, 880.00, t + 0.07, 320, 0.28 * v);
  },
  // C-major arpeggio cascading in. Warm welcome.
  startup: (ctx, t, v) => {
    _scheduleNote(ctx, 261.63, t + 0.00, 520, 0.22 * v);
    _scheduleNote(ctx, 329.63, t + 0.11, 520, 0.22 * v);
    _scheduleNote(ctx, 392.00, t + 0.22, 520, 0.22 * v);
    _scheduleNote(ctx, 523.25, t + 0.33, 540, 0.24 * v);
  },
  // Bright ascending chime — A4, E5, A5
  login: (ctx, t, v) => {
    _scheduleNote(ctx, 440.00, t + 0.00, 200, 0.22 * v);
    _scheduleNote(ctx, 659.25, t + 0.08, 250, 0.22 * v);
    _scheduleNote(ctx, 880.00, t + 0.16, 380, 0.24 * v);
  },
  // Descending — A4 to D4 — gentle goodbye
  logout: (ctx, t, v) => {
    _scheduleNote(ctx, 440.00, t + 0.00, 220, 0.22 * v);
    _scheduleNote(ctx, 293.66, t + 0.18, 360, 0.22 * v);
  },
  // Low sawtooth buzz for errors. Sawtooth is harsher than sine, intentionally.
  error: (ctx, t, v) => {
    _scheduleNote(ctx, 220, t + 0.00, 220, 0.30 * v, "sawtooth");
    _scheduleNote(ctx, 196, t + 0.10, 200, 0.20 * v, "sawtooth");
  },
  // Short high blip — UI feedback for opening
  windowOpen: (ctx, t, v) => {
    _scheduleNote(ctx, 880.00, t + 0.00, 70, 0.14 * v);
    _scheduleNote(ctx, 1318.51, t + 0.03, 80, 0.12 * v);
  },
  // Brief descending whoosh for closing
  windowClose: (ctx, t, v) => {
    _scheduleNote(ctx, 880.00, t + 0.00, 90, 0.14 * v);
    _scheduleNote(ctx, 440.00, t + 0.06, 110, 0.12 * v);
  },
  // Soft launch ping
  appLaunch: (ctx, t, v) => {
    _scheduleNote(ctx, 783.99, t + 0.00, 70, 0.14 * v);
    _scheduleNote(ctx, 1175.00, t + 0.04, 90, 0.10 * v);
  },
  // Toast — the most subtle, plays often
  toast: (ctx, t, v) => {
    _scheduleNote(ctx, 1318.51, t + 0.00, 100, 0.10 * v);
  },
  // Click for buttons/menus — very short, very quiet
  click: (ctx, t, v) => {
    _scheduleNote(ctx, 1567.98, t + 0.00, 35, 0.08 * v);
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
  try {
    recipe(ctx, ctx.currentTime, cfg.volume);
  } catch {}
  // Tear the context down a bit after the longest possible sound finishes.
  // Startup is ~870ms; everything else is shorter. 1500ms is comfortable.
  setTimeout(() => { try { ctx.close(); } catch {} }, 1500);
}

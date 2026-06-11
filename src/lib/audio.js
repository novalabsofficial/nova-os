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
  // v10.0 Supernova edition wallpapers
  supernova: 7,   // bright, energetic (perfect fifth up)
  nebula:   -3,   // calm, spacious
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

// v11.1 sound font — "less xylophone, more real OS". The old glass-bell + wooden
// mallet onset (a struck-tine that bloomed through a long reverb) read as slow
// and toy-like. The new signature voice is a clean *synthetic* UI tone: a sine
// core, a very slightly detuned twin (a subtle chorus that says "designed", not
// "struck wooden bar"), a short octave for presence, and a crisp filtered-noise
// onset for tactility instead of the wooden knock. Fast attack, tight decay so
// nothing blooms.

// A short filtered-noise onset — a crisp "tk" of attack transient, bandpassed
// near the note so it blends tonally. Gives the voice a tactile, designed edge
// without the wooden-mallet thunk. No-ops where the buffer API is unavailable
// (jsdom/tests), so recipes still schedule everything else.
function _transient(ctx, dest, t, freq, gain) {
  if (typeof ctx.createBuffer !== "function" || typeof ctx.createBufferSource !== "function") return;
  try {
    const rate = ctx.sampleRate || 44100;
    const len = Math.max(1, Math.floor(rate * 0.016));
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = Math.max(0.0001, gain);
    let node = src;
    if (typeof ctx.createBiquadFilter === "function") {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.min(Math.max(freq * 1.6, 900), 7200);
      bp.Q.value = 0.7;
      src.connect(bp);
      node = bp;
    }
    node.connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.03);
  } catch { /* transient is a flourish; never let it break the note */ }
}

// The signature Nova tone — clean, synthetic, snappy. Replaces the old _chime.
// Sine core + a ~5-cent detuned twin (subtle chorus width) + a short octave for
// presence + a crisp onset. Decays quickly so it reads as a modern UI "tone",
// never a ringing xylophone.
function _tone(ctx, dest, t, freq, durMs, gain, attackMs = 3) {
  _voice(ctx, dest, freq,         t, durMs,                        gain,        "sine", attackMs); // core
  _voice(ctx, dest, freq * 1.003, t, durMs * 0.85,                gain * 0.40, "sine", attackMs); // detuned twin → chorus
  _voice(ctx, dest, freq * 2.0,   t, Math.min(durMs * 0.30, 150), gain * 0.09, "sine", attackMs); // octave presence
  _transient(ctx, dest, t, freq, gain * 0.42);                                                     // crisp onset
}

// Light UI tick — one clean fast blip with a crisp onset, same family as _tone.
// For clicks, window/app ticks, message pings: short and out of the way.
function _tick(ctx, dest, t, freq, durMs, gain, attackMs = 2) {
  _voice(ctx, dest, freq,        t, durMs,                       gain,        "sine", attackMs);
  _voice(ctx, dest, freq * 2.0,  t, Math.min(durMs * 0.5, 70),   gain * 0.10, "sine", attackMs);
  _transient(ctx, dest, t, freq, gain * 0.35);
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
  // Welcome — a warm major chord that blooms in the mid register (G4–C5–E5)
  // over a soft low body. Voiced lower and gentler than a bright triad so it
  // reads as a calm, premium "you're in" rather than a fanfare. The reverb
  // carries the tail; the limiter keeps the stacked notes under 0dBFS.
  login: (ctx, t, v, r, d) => {
    _voice(ctx, d, 130.81 * r, t + 0.00, 1100, 0.045 * v, "sine", 120);  // C3 warm body
    _tone(ctx, d, t + 0.00, 392.00 * r, 640, 0.12 * v);                  // G4
    _tone(ctx, d, t + 0.06, 523.25 * r, 720, 0.13 * v);                  // C5
    _tone(ctx, d, t + 0.12, 659.25 * r, 920, 0.13 * v);                  // E5 — rings out
  },

  // Logout — a calm step down (E5 → G4) settling onto a low C body.
  // "Winding down", gentle and unhurried.
  logout: (ctx, t, v, r, d) => {
    _tone(ctx, d, t + 0.00, 659.25 * r, 460, 0.11 * v);                  // E5
    _tone(ctx, d, t + 0.10, 392.00 * r, 720, 0.12 * v);                  // G4
    _voice(ctx, d, 130.81 * r, t + 0.05, 950, 0.045 * v, "sine", 120);   // C3 settle
  },

  // Startup — a slow warm pad swell, then a gentle four-note ascending bell
  // line (C4–E4–G4–C5) that stays in a mellow register and rings out. Calm
  // and welcoming, not a flourish — the pad builds the space, the reverb
  // carries the tail.
  startup: (ctx, t, v, r, d) => {
    _swell(ctx, d, 130.81 * r, t + 0.00, 1500, 0.05 * v, 240);           // C3 pad (quicker build)
    _tone(ctx, d, t + 0.12, 261.63 * r, 520, 0.10 * v);                  // C4
    _tone(ctx, d, t + 0.28, 329.63 * r, 560, 0.10 * v);                  // E4
    _tone(ctx, d, t + 0.44, 392.00 * r, 640, 0.11 * v);                  // G4
    _tone(ctx, d, t + 0.62, 523.25 * r, 1100, 0.12 * v);                 // C5 — rings out
  },

  // Notification — a soft, calm descending major third (E5 → C5). Two gentle
  // bells that bloom together; a quiet "here's something" rather than a chime
  // that demands attention.
  notification: (ctx, t, v, r, d) => {
    _tone(ctx, d, t + 0.00, 659.25 * r, 440, 0.12 * v);                  // E5
    _tone(ctx, d, t + 0.09, 523.25 * r, 600, 0.13 * v);                  // C5
  },

  // Message ping — one soft mallet note with a faint high shimmer. A light,
  // frequent "drop" for chat / DMs, distinct from a full notification.
  message: (ctx, t, v, r, d) => {
    _tick(ctx, d, t + 0.00, 659.25 * r, 360, 0.11 * v);                  // E5 tick
    _voice(ctx, d, 1318.51 * r, t + 0.02, 150, 0.025 * v, "sine", 4);    // E6 air
  },

  // Success — a gentle two-note lift to a perfect fifth (C5 → G5). Brief and
  // smooth for routine "saved / applied" moments.
  success: (ctx, t, v, r, d) => {
    _tone(ctx, d, t + 0.00, 523.25 * r, 420, 0.12 * v);                  // C5
    _tone(ctx, d, t + 0.08, 783.99 * r, 620, 0.13 * v);                  // G5
  },

  // Error — a soft, warm low fall (G3 → E3). Pure sines so it's rounded and
  // never harsh; transpose capped at 1.0 so it can't read as cheerful.
  error: (ctx, t, v, r, d) => {
    const er = Math.min(1, r);
    _voice(ctx, d, 196.00 * er, t + 0.00, 440, 0.20 * v, "sine",     16); // G3
    _voice(ctx, d, 196.00 * er, t + 0.00, 360, 0.06 * v, "triangle", 16); // warmth
    _voice(ctx, d, 164.81 * er, t + 0.12, 580, 0.16 * v, "sine",     16); // E3
  },

  // Alert — two soft bells a minor third apart (A4 → C5). Purposeful attention
  // that lingers via the reverb rather than startling.
  alert: (ctx, t, v, r, d) => {
    _tone(ctx, d, t + 0.00, 440.00 * r, 480, 0.15 * v);                  // A4
    _tone(ctx, d, t + 0.12, 523.25 * r, 680, 0.16 * v);                  // C5
  },

  // Focus — a low swelling pad and one soft mid bell; "settling in", with a
  // long attack so it never punches. For entering focus / fullscreen.
  focus: (ctx, t, v, r, d) => {
    _swell(ctx, d, 196.00 * r, t + 0.00, 1100, 0.05 * v, 220);           // G3 pad
    _tone(ctx, d, t + 0.14, 587.33 * r, 680, 0.09 * v);                  // D5 mid tone
  },

  // Achievement — a graceful four-note rising arpeggio (G4–C5–E5–G5) over a
  // soft body, the top note held to ring out. Rewarding without a fanfare.
  achievement: (ctx, t, v, r, d) => {
    _swell(ctx, d, 196.00 * r, t + 0.00, 1100, 0.04 * v, 120);           // G3 body
    _tone(ctx, d, t + 0.00, 392.00 * r, 440, 0.11 * v);                  // G4
    _tone(ctx, d, t + 0.09, 523.25 * r, 480, 0.12 * v);                  // C5
    _tone(ctx, d, t + 0.18, 659.25 * r, 540, 0.12 * v);                  // E5
    _tone(ctx, d, t + 0.28, 783.99 * r, 1000, 0.13 * v);                 // G5 — held
  },

  // ── light UI ticks ────────────────────────────────────────────────────
  // Short, quiet, low-latency. These skip the reverb send (see playSound) so
  // the frequent ones stay crisp and cheap. All voiced with the soft mallet so
  // they feel like the same instrument family as the bells, just lighter.

  // Window open — a soft upward two-note tick.
  windowOpen: (ctx, t, v, r, d) => {
    _tick(ctx, d, t + 0.00, 523.25 * r, 95, 0.06 * v);                   // C5
    _voice(ctx, d, 783.99 * r, t + 0.015, 80, 0.035 * v, "sine", 2);     // G5
  },

  // Window close — a soft downward two-note tick.
  windowClose: (ctx, t, v, r, d) => {
    _tick(ctx, d, t + 0.00, 523.25 * r, 90, 0.05 * v);                   // C5
    _voice(ctx, d, 349.23 * r, t + 0.02, 110, 0.035 * v, "sine", 2);     // F4
  },

  // App launch — a soft mid note with a faint high air. Gentle, not a sparkle.
  appLaunch: (ctx, t, v, r, d) => {
    _tick(ctx, d, t + 0.00, 659.25 * r, 100, 0.06 * v);                  // E5
    _voice(ctx, d, 1318.51 * r, t + 0.02, 90, 0.025 * v, "sine", 2);     // E6 air
  },

  // Toast — a very light, soft high note + air. Plays often, stays subtle.
  toast: (ctx, t, v, r, d) => {
    _voice(ctx, d, 880.00 * r, t + 0.00, 140, 0.055 * v, "sine", 4);     // A5
    _voice(ctx, d, 1318.51 * r, t + 0.00, 85, 0.022 * v, "sine", 4);     // E6 air
  },

  // Click — a tiny, crisp tick for buttons / menus. A micro sine blip plus the
  // filtered-noise onset so it reads tactile and "designed", not a soft thud.
  click: (ctx, t, v, r, d) => {
    _voice(ctx, d, 1200 * r, t + 0.00, 22, 0.045 * v, "sine", 1);
    _transient(ctx, d, t + 0.00, 1200 * r, 0.05 * v);
  },

  // ── v9.4 — alarm recipes (Clock app) ─────────────────────────────────
  // Three distinct alarm voices, all in the same master-bus engine so the
  // limiter + reverb + lowpass apply (no harsh clipping even at louder
  // settings). Each is ~3 seconds long so a single firing has enough
  // sustained attention-grab. NovaOS's alarm scheduler may also fire
  // playSound() multiple times in a row for a real "ringing" effect.

  // Gentle ascending bell sequence — a Nova-style sunrise wake.
  alarmSunrise: (ctx, t, v, r, d) => {
    _tone(ctx, d, t + 0.00, 523.25 * r, 1000, 0.16 * v);  // C5
    _tone(ctx, d, t + 0.42, 659.25 * r, 1000, 0.16 * v);  // E5
    _tone(ctx, d, t + 0.84, 783.99 * r, 1150, 0.18 * v);  // G5
    _tone(ctx, d, t + 1.26, 1046.50 * r, 1300, 0.18 * v); // C6
    // Second cycle, a major-sixth lift to keep the ear pulling forward
    _tone(ctx, d, t + 1.85, 880.00 * r, 1150, 0.17 * v);  // A5
    _tone(ctx, d, t + 2.27, 1318.51 * r, 1300, 0.19 * v); // E6
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
  // EAS attention signal — the real one. Three 1-second bursts of harsh
  // digital noise: dual-tone 853 Hz + 960 Hz played SIMULTANEOUSLY, hard
  // sawtooth waves, flat-line gain envelope (no attack/decay/release).
  // Reverbless (see DRY_SOUNDS) so the abrupt cutoffs actually ARE abrupt.
  //
  // Earlier v9.4 cuts pitched it at 607 + 683 Hz for "Nova branding" and
  // used sine waves through the full ADSR path — both made it sound like
  // a car chime instead of a severe-weather alarm. The actual EAS spec
  // (FCC §11.31) is 853 + 960 Hz, and the iconic harshness comes from
  // sawtooth harmonics PLUS the hard-edged envelope, not just the dyad.
  // No frequency transpose (pitch is the signal's identity here).
  //
  // The flat envelope is scheduled directly with setValueAtTime — we
  // don't use the _voice helper because its exponential attack/decay
  // ramps are the opposite of what's wanted here.
  nwsAlert: (ctx, t, v, r, d) => {
    function flatTone(freq, startSec, durSec, peak, type) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      // ADSR 0 / 0 / 100% / 0 — flat-line at peak from start to end.
      gain.gain.setValueAtTime(peak, startSec);
      gain.gain.setValueAtTime(peak, startSec + durSec - 0.001);
      gain.gain.setValueAtTime(0,    startSec + durSec);
      osc.connect(gain).connect(d);
      osc.start(startSec);
      osc.stop(startSec + durSec + 0.01);
    }
    const dur = 1.0;          // 1 s per burst
    const gap = 0.10;         // short gap between bursts
    const peak = 0.18 * v;    // per-tone peak; two tones simultaneously
    for (let i = 0; i < 3; i++) {
      const start = t + i * (dur + gap);
      flatTone(853, start, dur, peak, "sawtooth");
      flatTone(960, start, dur, peak, "sawtooth");
    }
  },
};

/** Names of all available system sounds. Useful for Settings UI previews. */
export const SOUND_NAMES = Object.keys(SOUND_RECIPES);

// Approximate active duration per sound (ms) — used only to schedule context
// teardown. The reverb tail is added on top when the bus has convolution.
const SOUND_TAILS = {
  startup: 2000, login: 1200, logout: 1100, notification: 750,
  achievement: 1400, focus: 1300, alert: 850, success: 720,
  error: 650, message: 420, toast: 260, windowOpen: 150,
  windowClose: 160, appLaunch: 160, click: 70,
  // v9.4 — alarm + NWS recipes ring out longer than typical UI sounds.
  alarmSunrise: 4200, alarmPulse: 3500, alarmClassic: 2500, nwsAlert: 3500,
  // v9.4 — volume preview is a quick chime, no reverb tail (see DRY_SOUNDS).
  volumeSample: 250,
};

// Sounds that skip the reverb send — short UI ticks that should stay crisp
// and cheap (no impulse generation, no lingering tail).
// `nwsAlert` is dry on purpose — its 0 ms release envelope is the whole
// point of the EAS recipe, and a reverb tail would defeat it.
const DRY_SOUNDS = new Set(["click", "windowOpen", "windowClose", "appLaunch", "toast", "volumeSample", "nwsAlert"]);

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

      // v10.0 tone shaping. A gentle lowpass shaves the brittle digital top
      // off pure oscillators; a highpass clears sub-rumble so the sounds read
      // clean and "present" rather than boomy. Together they give the tight,
      // expensive midband modern OS sounds sit in.
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 10500;  // v11.1 — brighter/cleaner top for a crisp, present "real OS" feel
      lowpass.Q.value = 0.5;
      lowpass.connect(limiter);

      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 72;
      highpass.connect(lowpass);

      input = highpass;

      // Reverb send — musical sounds only. v10.0: a shorter, smoother tail
      // with a small pre-delay (separates the dry hit from the wash for
      // clarity) and a highpass on the wet so the tail stays airy, never
      // muddy. Fed post-EQ so the reverb inherits the clean band.
      if (withReverb &&
          typeof ctx.createConvolver === "function" &&
          typeof ctx.createBuffer === "function") {
        const conv = ctx.createConvolver();
        conv.buffer = _impulse(ctx, 0.75, 2.6);
        let head = conv;
        if (typeof ctx.createDelay === "function") {
          const pre = ctx.createDelay(0.2);
          pre.delayTime.value = 0.022;
          pre.connect(conv);
          head = pre;
        }
        const wetHp = ctx.createBiquadFilter();
        wetHp.type = "highpass";
        wetHp.frequency.value = 320;
        const wet = ctx.createGain();
        wet.gain.value = 0.10;   // v11.1 — much drier: tight & present, not a slow bloom
        conv.connect(wetHp).connect(wet).connect(limiter);
        lowpass.connect(head);
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

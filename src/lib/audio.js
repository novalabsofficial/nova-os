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

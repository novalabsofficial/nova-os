// Web Audio API helpers. Currently just `playTone` — used by Atmos to surface
// active NWS alerts as an audible cue. v6.0 will likely expand this into a
// full sound system, but for now we keep the scope tight.
//
// All functions are safe to call in environments without the Web Audio API
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

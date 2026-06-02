// Wordle game logic. Pure functions — the React component owns the input
// and history state; this module just handles the word list, daily-word
// selection, and per-letter scoring.

// Curated answer pool of common 5-letter words. Real Wordle uses ~2,300;
// this is a smaller sample sized to keep the bundle slim. All UPPERCASE
// so equality checks are straightforward.
export const WORDS = [
  "ABOUT","ABOVE","ABUSE","ACTOR","ACUTE","ADMIT","ADOPT","ADULT","AFTER","AGAIN",
  "AGENT","AGREE","AHEAD","ALARM","ALBUM","ALERT","ALIEN","ALIVE","ALLOW","ALONE",
  "ALONG","ALTER","AMONG","ANGER","ANGLE","ANGRY","APART","APPLE","APPLY","ARENA",
  "ARGUE","ARISE","ARRAY","ASIDE","ASSET","AVOID","AWARD","AWARE","BASIC","BEACH",
  "BEGAN","BEGIN","BEING","BELOW","BENCH","BIRTH","BLACK","BLAME","BLIND","BLOCK",
  "BLOOD","BOARD","BOOST","BRAIN","BRAND","BRAVE","BREAD","BREAK","BRIEF","BRING",
  "BROAD","BROWN","BUILD","BUYER","CABLE","CARRY","CATCH","CAUSE","CHAIN","CHAIR",
  "CHART","CHASE","CHEAP","CHECK","CHIEF","CHILD","CHOSE","CIVIL","CLAIM","CLASS",
  "CLEAN","CLEAR","CLICK","CLIMB","CLOCK","CLOSE","COACH","COAST","COVER","CRAFT",
  "CRASH","CRAZY","CREAM","CRIME","CROSS","CROWD","CROWN","CURVE","DAILY","DANCE",
  "DEALT","DEATH","DEBUT","DELAY","DEPTH","DOING","DOUBT","DOZEN","DRAFT","DRAMA",
  "DRAWN","DREAM","DRESS","DRINK","DRIVE","DROVE","DYING","EAGER","EARLY","EARTH",
  "EIGHT","ELITE","EMPTY","ENEMY","ENJOY","ENTER","ENTRY","EQUAL","ERROR","EVENT",
  "EVERY","EXACT","EXIST","EXTRA","FAITH","FALSE","FAULT","FIBER","FIELD","FIFTH",
  "FIFTY","FIGHT","FINAL","FIRST","FIXED","FLASH","FLEET","FLOOR","FLUID","FOCUS",
  "FORCE","FORTH","FORTY","FORUM","FOUND","FRAME","FRANK","FRAUD","FRESH","FRONT",
  "FRUIT","FULLY","GAINS","GAMES","GIANT","GIVEN","GLASS","GLOBE","GOING","GRACE",
  "GRADE","GRAND","GRANT","GRASS","GREAT","GREEN","GROSS","GROUP","GROWN","GUARD",
  "GUESS","GUEST","GUIDE","HAPPY","HARSH","HEART","HEAVY","HENCE","HORSE","HOTEL",
  "HOUSE","HUMAN","IDEAL","IMAGE","INDEX","INNER","INPUT","ISSUE","JOINT","JUDGE",
];

/**
 * Pick the word for a specific calendar day. Deterministic — same date always
 * yields the same word. Uses days-since-epoch as the index so it advances
 * exactly once per local midnight.
 *
 * @param {Date} [date=new Date()]
 * @returns {string} 5-letter uppercase word
 */
export function dailyWord(date = new Date()) {
  // Days since Unix epoch in the local timezone
  const dayMs = 24 * 60 * 60 * 1000;
  // Use UTC date so the same calendar day worldwide gets the same word.
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.floor(utc / dayMs);
  // Mix the index with a small prime so we don't always end up advancing by 1
  // through the alphabet of the WORDS array
  const idx = ((days * 6151) % WORDS.length + WORDS.length) % WORDS.length;
  return WORDS[idx];
}

/** Pick a random word from the pool — powers the app's Infinite practice mode. */
export function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

/**
 * Score a single guess against the answer. Returns an array of 5 strings,
 * one per letter: "correct" (green), "present" (yellow), or "absent" (gray).
 *
 * Implements the standard two-pass algorithm so duplicate letters are
 * handled the way Wordle players expect:
 *   answer = "ROBOT", guess = "FOOOO"
 *   → [absent, correct, absent, absent, absent]   (only one O turns green;
 *     the remaining Os in the guess are NOT all yellow because there's
 *     only one un-accounted-for O in the answer.)
 *
 * @param {string} guess  5-letter uppercase
 * @param {string} answer 5-letter uppercase
 * @returns {("correct"|"present"|"absent")[]}
 */
export function scoreGuess(guess, answer) {
  if (typeof guess !== "string" || typeof answer !== "string") return [];
  if (guess.length !== answer.length) return [];

  const n = guess.length;
  const result = new Array(n).fill("absent");
  // Track answer letters that haven't been "consumed" by a green or yellow yet.
  const remaining = {};
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === "correct") continue;
    const g = guess[i];
    if (remaining[g] > 0) {
      result[i] = "present";
      remaining[g]--;
    }
  }
  return result;
}

/** Normalize/validate a raw user input. Returns null if not a 5-letter A–Z string. */
export function normalizeGuess(input) {
  if (typeof input !== "string") return null;
  const s = input.trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(s)) return null;
  return s;
}

// App store moderation: auto-filter + admin queue.
//
// Auto-filter is a quick first pass that flags submissions with obvious red
// signals (banned URLs, profanity in name/description). It does NOT block the
// submission — every app goes to the admin queue with status="pending". The
// flags surface as red badges in the queue so admins can prioritize.
//
// To add an admin: add their username to ADMINS.
// To extend the URL or profanity lists: append entries to the arrays below.

export const ADMINS = ["NovaMod"];

export function isAdmin(username) {
  return typeof username === "string" && ADMINS.includes(username);
}

// Substring patterns. Comparison is case-insensitive (we lowercase the URL).
// Keep this minimal — the admin queue is the real safety net. Listing too many
// patterns produces false positives and creates noise.
export const URL_BLOCKLIST = [
  // Adult content
  "pornhub.com", "xvideos.com", "xnxx.com", "redtube.com", "onlyfans.com",
  // Common scam / phishing patterns
  "free-robux", "free-vbucks", "free-nitro", "free-gift-card",
  // Known malware-distribution patterns
  "warez", "crack-download", "keygen-",
];

// Substring patterns checked against (name + " " + desc).toLowerCase().
// Word boundaries aren't checked, so embed false-positives can happen — that's
// fine, this is meant to flag for review, not auto-reject.
export const PROFANITY_LIST = [
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard",
  "porn", "nude", "nsfw", "xxx",
];

/**
 * Run the auto-filter against a submission. Returns an array of human-readable
 * flag strings (empty if nothing caught). Never throws.
 *
 * @param {object} sub - { name, desc, url }
 * @returns {string[]} array of flag messages
 */
export function autoModerate(sub) {
  const flags = [];
  const name = (sub?.name || "").toString();
  const desc = (sub?.desc || "").toString();
  const url  = (sub?.url  || "").toString();

  const text = (name + " " + desc).toLowerCase();
  const lowerUrl = url.toLowerCase();

  for (const word of PROFANITY_LIST) {
    if (text.includes(word)) {
      flags.push("Profanity in name/description");
      break; // one profanity flag is enough
    }
  }
  for (const bad of URL_BLOCKLIST) {
    if (lowerUrl.includes(bad)) {
      flags.push('URL pattern blocked: "' + bad + '"');
      break;
    }
  }
  // Soft heuristic — non-https URLs are sketchier than https.
  if (lowerUrl && !lowerUrl.startsWith("https://") && !lowerUrl.startsWith("http://")) {
    flags.push("URL missing http(s)://");
  }
  return flags;
}

/**
 * Whether an app document should be visible in the public community feed.
 * Treats missing status as "approved" so apps submitted before moderation
 * was added stay visible.
 */
export function isPubliclyVisible(app) {
  if (!app) return false;
  const s = app.status;
  if (s === undefined || s === null || s === "approved") return true;
  return false;
}

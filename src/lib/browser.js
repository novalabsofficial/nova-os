// Browser-app URL helpers.
//
// The in-app browser uses an <iframe> to display sites. Most modern sites
// refuse to be framed (X-Frame-Options / CSP frame-ancestors), so we can't
// actually load them in-app — that's a browser-level enforcement, not
// something Nova OS can override.
//
// This module:
//   1. Converts YouTube watch URLs to YouTube's official embed URL (which IS
//      framable for individual videos).
//   2. Classifies known-unframable domains so the UI can show a friendly
//      "open in new tab" card instead of a silent blank iframe.

// Domains known to block iframe embedding. Matched as a suffix on the
// hostname (so "youtube.com" matches "www.youtube.com" and "m.youtube.com").
// Note: youtube.com is in this list, but the special embed path (via
// transformYouTubeUrl) bypasses the check — see isLikelyUnframable's URL
// argument handling.
export const UNFRAMABLE_DOMAINS = [
  // Big sites with strict frame-ancestors / X-Frame-Options
  "youtube.com", "youtu.be",
  "google.com", "googlesearch.com",
  "twitter.com", "x.com",
  "facebook.com", "instagram.com", "threads.net",
  "reddit.com",
  "discord.com", "discordapp.com",
  "twitch.tv",
  "tiktok.com",
  "linkedin.com",
  "pinterest.com",
  "snapchat.com",
  // Game platforms — most also have JS-level iframe checks beyond headers
  "roblox.com",
  "fortnite.com",
  "minecraft.net",
  "ea.com",
  "playstation.com",
  "xbox.com",
  "nintendo.com",
  "steam.com", "steampowered.com", "steamcommunity.com",
  "epicgames.com",
  // Streaming / media
  "netflix.com", "hulu.com", "disneyplus.com", "primevideo.com", "max.com",
  "spotify.com", "apple.com", "icloud.com",
  // Productivity / chat
  "notion.so", "figma.com",
  "slack.com", "zoom.us", "teams.microsoft.com",
  // Banking / sensitive
  "paypal.com", "venmo.com", "cashapp.com",
  "chase.com", "bankofamerica.com", "wellsfargo.com", "citi.com",
  "amazon.com", "ebay.com",
];

/**
 * Extract a hostname from any URL-ish string. Returns the lowercased hostname
 * with leading "www." stripped, or empty string if it can't parse one.
 *
 * Tolerant of: missing protocol, surrounding whitespace, fully bare hostnames.
 */
export function extractHostname(url) {
  if (typeof url !== "string") return "";
  let s = url.trim().toLowerCase();
  if (!s) return "";
  // Strip protocol if present
  s = s.replace(/^[a-z]+:\/\//, "");
  // Cut at first slash, query, or fragment
  s = s.split(/[/?#]/)[0];
  // Strip leading www.
  s = s.replace(/^www\./, "");
  // Strip port
  s = s.split(":")[0];
  return s;
}

/**
 * Does the URL's hostname match (exactly or as a subdomain suffix) any of
 * the given known unframable domains? Pre-converted YouTube embed URLs are
 * explicitly allowed (those DO frame).
 *
 * @param {string} url - any URL-ish string
 * @param {string[]} [list] - override the default UNFRAMABLE_DOMAINS list
 */
export function isLikelyUnframable(url, list = UNFRAMABLE_DOMAINS) {
  if (typeof url !== "string" || !url) return false;
  // YouTube's /embed/ path IS framable — always treat as embeddable.
  if (/^https?:\/\/(www\.)?youtube\.com\/embed\//i.test(url.trim())) return false;
  const host = extractHostname(url);
  if (!host) return false;
  return list.some(d => host === d || host.endsWith("." + d));
}

/**
 * Detect a YouTube watch URL and return the canonical embed URL for the same
 * video, or null if the input isn't a YouTube watch URL.
 *
 * Recognizes:
 *   - youtube.com/watch?v=VIDEO_ID
 *   - m.youtube.com/watch?v=VIDEO_ID
 *   - youtu.be/VIDEO_ID
 *   - URLs with extra query params (?v=X&t=42 -> embed/X?start=42)
 */
export function transformYouTubeUrl(url) {
  if (typeof url !== "string" || !url) return null;
  const s = url.trim();

  // Already an embed URL — return as-is so callers can use the result safely.
  const embedMatch = s.match(/^https?:\/\/(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
  if (embedMatch) return s;

  // youtu.be/<id>
  const shortMatch = s.match(/^https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{6,})/i);
  if (shortMatch) return "https://www.youtube.com/embed/" + shortMatch[1];

  // youtube.com/watch?v=<id>
  const watchMatch = s.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(.+)$/i);
  if (watchMatch) {
    const params = new URLSearchParams(watchMatch[1]);
    const id = params.get("v");
    if (!id) return null;
    const t = params.get("t") || params.get("start");
    const start = t ? parseInt(String(t).replace(/[^\d]/g, ""), 10) : null;
    return "https://www.youtube.com/embed/" + id + (Number.isFinite(start) && start > 0 ? "?start=" + start : "");
  }

  return null;
}

/**
 * Take a user-entered URL and produce the URL the browser should actually
 * load in the iframe, doing any safe rewrites first.
 *
 *   - Adds https:// if no protocol
 *   - Converts YouTube watch URLs to embed URLs
 *
 * Returns the rewritten URL string.
 */
export function rewriteForIframe(url) {
  if (typeof url !== "string") return "";
  let s = url.trim();
  if (!s) return "";
  if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s;
  const yt = transformYouTubeUrl(s);
  if (yt) return yt;
  return s;
}

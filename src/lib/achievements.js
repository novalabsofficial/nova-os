// Achievements — v11.0 Phase D. Deliberately scoped to GAMES only (Steam-style),
// so the rest of the OS stays clean and professional. A personal best in any
// leaderboard game reports through recordGameWin(); NovaOS tracks the set of
// distinct games you've topped and unlocks milestone badges. Unlocked state lives
// in the user's profile data (data.achievements = { id: unlockedAt }), so it syncs
// across devices and rides along in profile backups.

export const ACHIEVEMENTS = [
  { id: "first_score",   title: "On the board",   desc: "Set your first personal best in a game.",     icon: "🎯", cat: "Games" },
  { id: "hat_trick",     title: "Hat trick",      desc: "Set a personal best in 3 different games.",   icon: "🎮", cat: "Games" },
  { id: "arcade_master", title: "Arcade master",  desc: "Set a personal best in 6 different games.",    icon: "🕹️", cat: "Games" },
  { id: "all_star",      title: "Nova all-star",  desc: "Set a personal best in 10 different games.",   icon: "🏆", cat: "Games", secret: true },
];

export const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;
export const ACH_CATEGORIES = [...new Set(ACHIEVEMENTS.map(a => a.cat))];

// A game reports a fresh personal best here; NovaOS registers the handler.
let _gameHandler = null;
export function setGameWinHandler(fn) { _gameHandler = fn; }
export function recordGameWin(gameId) { try { if (_gameHandler) _gameHandler(gameId); } catch (e) { /* no-op */ } }

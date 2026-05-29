// v9.8 — Global game leaderboards.
//
// Storage is deliberately tiny: ONE doc per (game, user) at a deterministic
// id `nova_scores/<gameId>_<uid>`, holding only that user's personal best.
//   { gameId, uid, user, score, ts }
//
// Why this is cheap on Firestore:
//   • Writes happen ONLY when a player beats their own best — not per game,
//     not per frame. Most sessions write zero docs.
//   • Reads are one capped query per leaderboard open (≤200 docs), sorted
//     client-side, so there's NO composite index to create (we filter on a
//     single field, `gameId`). Same index-free pattern the rest of Nova uses.
//
// `dir` picks the ranking direction per game:
//   "high" — bigger is better (Flappy score, Snake apples, …)
//   "low"  — smaller is better (Minesweeper completion time)

import { collection, doc, getDoc, setDoc, query, where, limit, getDocs } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

function scoreId(gameId, uid) { return gameId + "_" + uid; }

/**
 * Record a score, but only if it beats the player's stored personal best
 * for this game. Returns true if a new best was written, false otherwise
 * (no improvement, bad input, or error). Never throws.
 */
export async function submitScore(gameId, score, dir, uid, username) {
  if (!gameId || !uid || typeof score !== "number" || !Number.isFinite(score)) return false;
  const ref = doc(firestoreDb, "nova_scores", scoreId(gameId, uid));
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const prev = snap.data().score;
      const improved = dir === "high" ? score > prev : score < prev;
      if (!improved) return false;
    }
    await setDoc(ref, { gameId, uid, user: username || "", score, ts: Date.now() });
    return true;
  } catch (e) {
    console.warn("[scores] submit failed:", e?.message || e);
    return false;
  }
}

/**
 * Fetch the top-N leaderboard for a game. Single-field query (no composite
 * index), sorted client-side by `dir`. Returns [{ id, gameId, uid, user,
 * score, ts }] already ranked, capped at topN.
 */
export async function fetchLeaderboard(gameId, dir, topN = 10) {
  try {
    const q = query(collection(firestoreDb, "nova_scores"), where("gameId", "==", gameId), limit(200));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => dir === "high" ? (b.score - a.score) : (a.score - b.score));
    return rows.slice(0, topN);
  } catch (e) {
    console.warn("[scores] fetch failed:", e?.message || e);
    return [];
  }
}

/** Read just this user's stored best for a game (or null). */
export async function fetchMyBest(gameId, uid) {
  if (!gameId || !uid) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, "nova_scores", scoreId(gameId, uid)));
    return snap.exists() ? snap.data().score : null;
  } catch { return null; }
}

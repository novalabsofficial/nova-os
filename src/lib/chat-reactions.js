// v9.4 — Emoji reactions on global-chat messages.
//
// Stored in their own top-level collection (`nova_chat_reactions`) so we
// don't have to relax the append-only `update` rule on `nova_chat`.
// Doc id format is deterministic: `<msgId>_<uid>_<emoji>` — exactly one
// doc per (message, user, emoji). Clicking the same emoji again deletes
// the doc; clicking a different one creates a second doc (a user can
// react with multiple emojis on the same message, just not the same one
// twice).
//
// Why a top-level collection (vs. a subcollection of nova_chat)?
//   - Subscribers can listen to ALL recent reactions in one onSnapshot
//     and filter client-side per visible message, which is simpler than
//     spinning up N subscriptions for N visible messages.
//   - Rules stay flat and easy to reason about (no nested matchers).

import { collection, doc, getDoc, setDoc, deleteDoc, query, onSnapshot, limit } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

/**
 * Build the deterministic reaction doc id for (msgId, uid, emoji).
 * `_` is a safe separator because Firestore doc ids can't contain `/`
 * but otherwise allow most printable characters; we sanitize the emoji
 * to keep the id within a sensible byte length.
 */
function reactionId(msgId, uid, emoji) {
  return msgId + "_" + uid + "_" + encodeURIComponent(emoji);
}

/**
 * Toggle a user's reaction on a message. If the (msg, uid, emoji)
 * reaction already exists, deletes it; otherwise creates it.
 *
 * Returns the new state ("added" | "removed") so callers can play a
 * different sound for each, if they want. Logs the error (no throw) on
 * permission/network failures so the click feels resilient.
 */
export async function toggleReaction(msgId, emoji, myUid, myUsername) {
  if (!msgId || !emoji || !myUid) return null;
  const rxId = reactionId(msgId, myUid, emoji);
  const ref = doc(firestoreDb, "nova_chat_reactions", rxId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return "removed";
    }
    await setDoc(ref, {
      msgId,
      uid: myUid,
      user: myUsername || "",
      emoji,
      ts: Date.now(),
    });
    return "added";
  } catch (err) {
    console.warn("[chat-reactions] toggle failed:", err?.message || err);
    return null;
  }
}

/**
 * Subscribe to the latest reactions across global chat. Calls `cb` with
 * the full array on every change. The caller filters by msgId for the
 * messages they're rendering. Limited to 500 to bound subscription cost;
 * old reactions on old messages naturally fall off as the chat scrolls
 * past the 120-message cap.
 */
export function subscribeAllReactions(cb) {
  const q = query(collection(firestoreDb, "nova_chat_reactions"), limit(500));
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn("[chat-reactions] subscription error:", err?.message || err); cb([]); },
  );
}

/**
 * Aggregate a flat list of reactions into a per-message map:
 *   { [msgId]: { [emoji]: [{ uid, user }, ...] } }
 *
 * The rendering code uses this to show one button per emoji with a
 * count, and to highlight emojis the current user has reacted with.
 */
export function aggregateReactions(reactions) {
  const out = {};
  for (const r of reactions) {
    if (!r || !r.msgId || !r.emoji) continue;
    if (!out[r.msgId]) out[r.msgId] = {};
    if (!out[r.msgId][r.emoji]) out[r.msgId][r.emoji] = [];
    out[r.msgId][r.emoji].push({ uid: r.uid, user: r.user });
  }
  return out;
}

/** Reaction emojis offered in the picker per message. Kept small + universal. */
export const REACTION_PRESETS = ["👍", "❤️", "😂", "😮", "😢"];

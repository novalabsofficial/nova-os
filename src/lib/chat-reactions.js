// v9.4 — Emoji reactions on global-chat messages.
// v9.5 — Extended to also handle DM reactions (separate collection,
//        nova_dm_reactions, since the DM message lookup needs the
//        threadId in the doc for the rule's membership check).
//
// Stored in their own top-level collection so we don't have to relax the
// append-only `update` rule on the parent message collection.
//
// Doc id formats:
//   global chat: `<msgId>_<uid>_<emoji>`
//   DM:          `<threadId>_<msgId>_<uid>_<emoji>`
// Exactly one doc per (message, user, emoji). Clicking the same emoji
// again deletes; clicking a different one creates a second doc.
//
// Why top-level collections (vs. subcollections)?
//   - One onSnapshot can stream all recent reactions; the renderer
//     filters per visible message. Cheaper than N subscriptions.
//   - Rules stay flat and easy to reason about.

import { collection, doc, getDoc, setDoc, deleteDoc, query, onSnapshot, limit, where } from "firebase/firestore";
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

// ── v9.5: DM reactions ──────────────────────────────────────────────────
// Same shape + ergonomics, just gated to nova_dm_reactions which lives in
// its own collection so the rule can check thread membership via the
// threadId field in the reaction doc.

function dmReactionId(threadId, msgId, uid, emoji) {
  return threadId + "_" + msgId + "_" + uid + "_" + encodeURIComponent(emoji);
}

/**
 * Toggle a DM reaction. Same return semantics as `toggleReaction`
 * ("added" | "removed" | null on error).
 */
export async function toggleDmReaction(threadId, msgId, emoji, myUid, myUsername) {
  if (!threadId || !msgId || !emoji || !myUid) return null;
  const rxId = dmReactionId(threadId, msgId, myUid, emoji);
  const ref = doc(firestoreDb, "nova_dm_reactions", rxId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return "removed";
    }
    await setDoc(ref, {
      threadId, msgId,
      uid: myUid,
      user: myUsername || "",
      emoji,
      ts: Date.now(),
    });
    return "added";
  } catch (err) {
    console.warn("[chat-reactions] DM toggle failed:", err?.message || err);
    return null;
  }
}

/**
 * Subscribe to all DM reactions for a specific thread. Caller provides
 * threadId; we filter the subscription server-side via where(). Capped at
 * 500 — at typical chat scale, plenty for a single thread's recent
 * messages.
 */
export function subscribeDmReactions(threadId, cb) {
  if (!threadId) { cb([]); return () => {}; }
  const q = query(
    collection(firestoreDb, "nova_dm_reactions"),
    where("threadId", "==", threadId),
    limit(500),
  );
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn("[chat-reactions] DM subscription error:", err?.message || err); cb([]); },
  );
}

// ── v9.6: server message reactions ──────────────────────────────────────
// Mirrors DM reactions but keyed by serverId. The rule checks server
// membership via a get() into the parent server doc using the serverId
// field on the reaction.

function serverReactionId(serverId, msgId, uid, emoji) {
  return serverId + "_" + msgId + "_" + uid + "_" + encodeURIComponent(emoji);
}

/** Toggle a reaction on a server message. ("added" | "removed" | null). */
export async function toggleServerReaction(serverId, msgId, emoji, myUid, myUsername) {
  if (!serverId || !msgId || !emoji || !myUid) return null;
  const rxId = serverReactionId(serverId, msgId, myUid, emoji);
  const ref = doc(firestoreDb, "nova_server_reactions", rxId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return "removed";
    }
    await setDoc(ref, {
      serverId, msgId,
      uid: myUid,
      user: myUsername || "",
      emoji,
      ts: Date.now(),
    });
    return "added";
  } catch (err) {
    console.warn("[chat-reactions] server toggle failed:", err?.message || err);
    return null;
  }
}

/** Subscribe to all reactions for a server (filtered by serverId). */
export function subscribeServerReactions(serverId, cb) {
  if (!serverId) { cb([]); return () => {}; }
  const q = query(
    collection(firestoreDb, "nova_server_reactions"),
    where("serverId", "==", serverId),
    limit(500),
  );
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn("[chat-reactions] server subscription error:", err?.message || err); cb([]); },
  );
}

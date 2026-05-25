// v7.3 — Direct messages: thin helpers around Firestore for 1-on-1 DMs.
//
// Data model:
//   nova_username_index/<username>        { uid, username, ts }
//   nova_dm_threads/<threadId>            { participantUids[], participantUsernames[],
//                                            lastMessage, lastTs, lastSenderUid, createdAt }
//   nova_dm_threads/<threadId>/messages/* { uid, user, text, ts }
//
// threadId is a deterministic concat of the two participants' uids in sorted
// order, so calling openDmByUsername() from either side always lands on the
// same doc. No "who started it" race.

import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc,
  query, where, orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { normalizeUsername } from "./auth.js";

/**
 * Compute the deterministic thread doc ID for two Auth uids.
 * Sorting ensures both users hash to the same thread regardless of who initiated.
 */
export function threadIdFor(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

/**
 * Resolve a username → { uid, username } via the index. Returns null if no
 * user with that name exists. Username is normalized first.
 */
export async function resolveUsername(rawUsername) {
  const u = normalizeUsername(rawUsername);
  if (!u || u.length < 3) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, "nova_username_index", u));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to the current user's DM threads (most-recent first).
 * Calls cb with an array of thread docs each time anything changes.
 * Returns an unsubscribe function.
 */
export function watchMyThreads(myUid, cb) {
  if (!myUid) return () => {};
  const q = query(
    collection(firestoreDb, "nova_dm_threads"),
    where("participantUids", "array-contains", myUid),
    orderBy("lastTs", "desc"),
    limit(100),
  );
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => cb([]),  // permission errors → empty list (graceful degradation)
  );
}

/**
 * Subscribe to messages in a specific DM thread (oldest → newest, capped at 200).
 */
export function watchThreadMessages(threadId, cb) {
  if (!threadId) return () => {};
  const q = query(
    collection(firestoreDb, "nova_dm_threads", threadId, "messages"),
    orderBy("ts", "asc"),
    limit(200),
  );
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

/**
 * Open (or create) a DM thread with `otherUsername`. Returns the resolved
 * thread metadata. Throws with a user-friendly message on failure.
 */
export async function openDmByUsername(otherUsername, myUid, myUsername) {
  if (!myUid || !myUsername) {
    throw new Error("Sign in to start a DM.");
  }
  const other = await resolveUsername(otherUsername);
  if (!other) {
    throw new Error("No user with that name.");
  }
  if (other.uid === myUid) {
    throw new Error("You can't DM yourself.");
  }
  const threadId = threadIdFor(myUid, other.uid);
  const threadRef = doc(firestoreDb, "nova_dm_threads", threadId);
  // v7.5: getDoc may throw permission-denied on a non-existent thread doc
  // under older rules (pre-7.5 read rule didn't allow `resource == null`).
  // Treat any read failure as "thread doesn't exist yet" — the subsequent
  // setDoc has its own create rule that gates against impersonation, so this
  // never grants access we shouldn't have.
  let exists = false;
  try {
    const snap = await getDoc(threadRef);
    exists = snap.exists();
  } catch {
    exists = false;
  }
  if (!exists) {
    // First message between this pair — create the thread doc. Note that
    // both rules and sort ordering depend on participantUids being sorted.
    await setDoc(threadRef, {
      participantUids: [myUid, other.uid].sort(),
      participantUsernames: [myUsername, other.username],
      lastMessage: "",
      lastTs: Date.now(),
      lastSenderUid: null,
      createdAt: Date.now(),
    });
  }
  return {
    threadId,
    otherUid: other.uid,
    otherUsername: other.username,
  };
}

/**
 * Send a DM. Writes to the messages subcollection AND updates the parent
 * thread's `lastMessage` / `lastTs` so the sidebar list stays in order.
 *
 * Throws on failure (caller can show a toast).
 */
export async function sendDm(threadId, text, myUid, myUsername) {
  if (!threadId || !text || !text.trim() || !myUid) return;
  const trimmed = text.trim().slice(0, 500);   // mirror global-chat cap
  // 1) append message to subcollection
  await addDoc(
    collection(firestoreDb, "nova_dm_threads", threadId, "messages"),
    {
      uid: myUid,
      user: myUsername,
      text: trimmed,
      ts: Date.now(),
    }
  );
  // 2) update the thread doc with preview info. Non-atomic with #1 — if
  // this fails, the message still landed; only the sidebar preview lags.
  try {
    await updateDoc(doc(firestoreDb, "nova_dm_threads", threadId), {
      lastMessage: trimmed.slice(0, 100),
      lastTs: Date.now(),
      lastSenderUid: myUid,
    });
  } catch { /* preview update is best-effort */ }
}

/**
 * Given a thread doc + the current user's uid, return the OTHER participant's
 * display name. Used by the sidebar to show "@alice" not your own name.
 */
export function otherParticipantName(thread, myUid) {
  if (!thread || !Array.isArray(thread.participantUids)) return "?";
  const idx = thread.participantUids.findIndex(u => u !== myUid);
  return thread.participantUsernames?.[idx] || "?";
}

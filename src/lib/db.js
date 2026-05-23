// Thin Firestore wrapper used as the "storage" layer for per-user data.
//
// v6.3 update: every write is stamped with the current Firebase Auth uid
// (via setDbUid below). Firestore security rules use that uid field to
// verify ownership of user-scoped docs in `nova_storage`. Calls made before
// auth is established (e.g. during the migration handshake) skip the stamp
// — those reads are protected by separate "legacy" rule branches.
//
// Keys are sanitized by replacing : and / with _ since Firestore doc IDs
// can't contain those characters.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { COLL } from "../ui/constants.js";

// Module-scope reference to the currently signed-in uid. NovaOS calls
// setDbUid(uid) after login, and setDbUid(null) on logout. Kept here
// (rather than passed per-call) so existing call-sites — there are dozens
// — don't all need to grow an extra argument.
let _currentUid = null;
export function setDbUid(uid) { _currentUid = uid || null; }
export function getDbUid()   { return _currentUid; }

export const db = {
  async get(k) {
    try {
      const snap = await getDoc(doc(firestoreDb, COLL, k.replace(/[:/]/g, "_")));
      return snap.exists() ? snap.data().value : null;
    } catch { return null; }
  },
  async set(k, v) {
    try {
      // Inject uid alongside the value so rules can verify ownership. If
      // we're not signed in (rare — only happens before login completes)
      // skip the stamp and let the rule reject the write.
      const payload = _currentUid ? { value: v, uid: _currentUid } : { value: v };
      await setDoc(doc(firestoreDb, COLL, k.replace(/[:/]/g, "_")), payload);
    } catch {}
  },
};

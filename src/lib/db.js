// Thin Firestore wrapper used as the "storage" layer for the homegrown auth
// system (will be replaced by Firebase Auth + per-user docs in 6.2).
//
// Keys are sanitized by replacing : and / with _ since Firestore doc IDs
// can't contain those characters.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { COLL } from "../ui/constants.js";

export const db = {
  async get(k) {
    try {
      const snap = await getDoc(doc(firestoreDb, COLL, k.replace(/[:/]/g, "_")));
      return snap.exists() ? snap.data().value : null;
    } catch { return null; }
  },
  async set(k, v) {
    try {
      await setDoc(doc(firestoreDb, COLL, k.replace(/[:/]/g, "_")), { value: v });
    } catch {}
  },
};

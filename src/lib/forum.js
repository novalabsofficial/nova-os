// v11.0 — Nova Forum backend (Reddit/Quora-style). One Firestore doc per post in
// `nova_forum`, with votes + comments embedded (low traffic, keeps rules + reads
// simple — no subcollections, no composite index). Post:
//   { id, title, body, topic, author, uid, createdAt, score, voters:{uid:±1}, comments:[{id,author,uid,body,at}] }

import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

const COLL = "nova_forum";
let _seq = 0;
const pid = () => "p" + Date.now().toString(36) + (_seq++).toString(36);
const cid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export async function createPost({ title, body, topic, uid, user }) {
  if (!title || !title.trim() || !uid) return null;
  const id = pid();
  const post = { id, title: title.trim().slice(0, 160), body: (body || "").slice(0, 8000), topic: topic || "general", author: user || "anon", uid, createdAt: Date.now(), score: 0, voters: {}, comments: [] };
  try { await setDoc(doc(firestoreDb, COLL, id), post); return post; } catch (e) { console.warn("[forum] create", e?.message || e); return null; }
}
export async function fetchPosts(max = 120) {
  try { const q = query(collection(firestoreDb, COLL), orderBy("createdAt", "desc"), limit(max)); const snap = await getDocs(q); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { console.warn("[forum] fetch", e?.message || e); return []; }
}
export async function votePost(id, uid, dir) {   // dir: 1 | -1 | 0 (clear)
  try {
    const ref = doc(firestoreDb, COLL, id); const snap = await getDoc(ref); if (!snap.exists()) return null;
    const voters = { ...(snap.data().voters || {}) };
    if (dir === 0) delete voters[uid]; else voters[uid] = dir;
    const score = Object.values(voters).reduce((s, v) => s + v, 0);
    await updateDoc(ref, { voters, score });
    return { voters, score };
  } catch (e) { console.warn("[forum] vote", e?.message || e); return null; }
}
export async function addComment(id, { uid, user, body }) {
  if (!body || !body.trim()) return null;
  try {
    const ref = doc(firestoreDb, COLL, id); const snap = await getDoc(ref); if (!snap.exists()) return null;
    const c = { id: cid(), author: user || "anon", uid, body: body.trim().slice(0, 4000), at: Date.now() };
    const comments = [...(snap.data().comments || []), c].slice(-400);
    await updateDoc(ref, { comments });
    return c;
  } catch (e) { console.warn("[forum] comment", e?.message || e); return null; }
}
export async function deletePost(id) { try { await deleteDoc(doc(firestoreDb, COLL, id)); return true; } catch (e) { console.warn("[forum] del", e?.message || e); return false; } }
export async function deleteComment(id, commentId) {
  try { const ref = doc(firestoreDb, COLL, id); const snap = await getDoc(ref); if (!snap.exists()) return false; const comments = (snap.data().comments || []).filter(c => c.id !== commentId); await updateDoc(ref, { comments }); return true; }
  catch (e) { console.warn("[forum] delc", e?.message || e); return false; }
}

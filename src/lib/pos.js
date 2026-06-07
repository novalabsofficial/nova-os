// Nova POS backend — v11.0. Two layers:
//
//  1) OS launcher gate — `nova_pos/access` { users:[usernames] }. Decides whether
//     the POS app icon is even visible in Nova OS (NovaMod + granted accounts).
//
//  2) Accounts → many stores. One LOGIN per account (username + password); each
//     account owns any number of stores. Storage:
//       nova_pos_accounts/{accountId} → { id, username, passHash, createdAt,
//           createdByUid, stores:[{ id, name }] }   (the store roster)
//       nova_pos_stores/{storeId}     → { id, accountId, name, taxRate, state,
//           items:[{id,name,price,cost,stock,category}], sales:[…], agg:{…},
//           expenses:[…], createdAt }
//       nova_pos_imgs/{storeId}       → { [itemId]: dataURL }   (image blobs kept
//           out of the store doc so each sale-write stays small + under 1 MiB)
//
//  Passwords are SHA-256 hashed client-side (Web Crypto) — pragmatic for a
//  personal project, not backend-verified auth.

import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

const norm = (u) => (u || "").trim().toLowerCase();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
let _sid = 0;
const newStoreId = (acct) => acct + "_s" + Date.now().toString(36) + (_sid++).toString(36);

// ───────────────────────── OS launcher access allowlist ─────────────────────
const COLL = "nova_pos";
export async function fetchAccessList() {
  try { const s = await getDoc(doc(firestoreDb, COLL, "access")); return s.exists() ? (s.data().users || []) : []; }
  catch (e) { console.warn("[pos] access", e?.message || e); return []; }
}
export async function saveAccessList(users) {
  try { await setDoc(doc(firestoreDb, COLL, "access"), { users: Array.from(new Set(users.map(norm).filter(Boolean))) }, { merge: true }); return true; }
  catch (e) { console.warn("[pos] saveAccess", e?.message || e); return false; }
}
export async function grantAccess(username) {
  const list = await fetchAccessList(); const u = norm(username); if (!u) return list;
  if (!list.includes(u)) { const next = [...list, u]; await saveAccessList(next); return next; }
  return list;
}
export async function revokeAccess(username) {
  const list = await fetchAccessList(); const u = norm(username);
  const next = list.filter(x => x !== u); await saveAccessList(next); return next;
}

// ───────────────────────────────── crypto ───────────────────────────────────
const ACCTS = "nova_pos_accounts";
const STORES = "nova_pos_stores";
const IMGS = "nova_pos_imgs";
const slug = (u) => "a_" + norm(u).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export async function hashPw(pw) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("novapos" + pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0; const s = "novapos" + pw; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "f" + h.toString(16);
  }
}

const splitImgs = (items) => {
  const meta = []; const imgs = {};
  for (const it of items || []) { const { img, ...rest } = it; meta.push(rest); if (img) imgs[it.id] = img; }
  return { meta, imgs };
};
const mergeImgs = (meta, imgs) => (meta || []).map(it => ({ ...it, img: (imgs || {})[it.id] || null }));
const emptyAgg = () => ({ revenue: 0, cost: 0, profit: 0, tax: 0, gross: 0, count: 0 });

// ───────────────────────────────── accounts ─────────────────────────────────
export async function createAccount({ username, password, byUid }) {
  const id = slug(username);
  if (!id || id === "a_") return { error: "Pick a username (letters/numbers)." };
  if (!password || password.length < 3) return { error: "Password must be at least 3 characters." };
  try {
    const ref = doc(firestoreDb, ACCTS, id);
    if ((await getDoc(ref)).exists()) return { error: "An account with that username already exists." };
    const account = { id, username: norm(username), passHash: await hashPw(password), createdAt: Date.now(), createdByUid: byUid || null, stores: [] };
    await setDoc(ref, account);
    return { account: { id, username: account.username, stores: [] } };
  } catch (e) { console.warn("[pos] createAccount", e?.message || e); return { error: "Couldn't create account (connection or rules)." }; }
}

export async function loginAccount({ username, password }) {
  const id = slug(username);
  try {
    const snap = await getDoc(doc(firestoreDb, ACCTS, id));
    if (!snap.exists()) return { error: "No account found with that username." };
    const d = snap.data();
    if (d.passHash !== await hashPw(password)) return { error: "Incorrect password." };
    return { account: { id, username: d.username, stores: d.stores || [] } };
  } catch (e) { console.warn("[pos] login", e?.message || e); return { error: "Couldn't sign in (connection)." }; }
}

// ────────────────────────────────── stores ──────────────────────────────────
export async function createStore(accountId, name) {
  const nm = (name || "").trim().slice(0, 60) || "My Store";
  try {
    const id = newStoreId(accountId);
    const store = { id, accountId, name: nm, kind: "retail", taxRate: 0, state: "", items: [], sales: [], agg: emptyAgg(), expenses: [], createdAt: Date.now() };
    await setDoc(doc(firestoreDb, STORES, id), store);
    const aref = doc(firestoreDb, ACCTS, accountId);
    const asnap = await getDoc(aref);
    const stores = [...((asnap.exists() && asnap.data().stores) || []), { id, name: nm }];
    await updateDoc(aref, { stores });
    return { store: { ...store, items: [] }, stores };
  } catch (e) { console.warn("[pos] createStore", e?.message || e); return { error: "Couldn't create store." }; }
}

export async function loadStore(storeId) {
  try {
    const snap = await getDoc(doc(firestoreDb, STORES, storeId));
    if (!snap.exists()) return { error: "Store not found." };
    const d = snap.data();
    const imgsSnap = await getDoc(doc(firestoreDb, IMGS, storeId));
    const imgs = imgsSnap.exists() ? imgsSnap.data() : {};
    return { store: { ...d, id: storeId, agg: { ...emptyAgg(), ...(d.agg || {}) }, sales: d.sales || [], expenses: d.expenses || [], items: mergeImgs(d.items, imgs) } };
  } catch (e) { console.warn("[pos] loadStore", e?.message || e); return { error: "Couldn't open store (connection)." }; }
}

export async function renameStore(accountId, storeId, name) {
  const nm = (name || "").trim().slice(0, 60); if (!nm) return null;
  try {
    await updateDoc(doc(firestoreDb, STORES, storeId), { name: nm });
    const aref = doc(firestoreDb, ACCTS, accountId);
    const asnap = await getDoc(aref);
    const stores = ((asnap.exists() && asnap.data().stores) || []).map(s => s.id === storeId ? { ...s, name: nm } : s);
    await updateDoc(aref, { stores });
    return stores;
  } catch (e) { console.warn("[pos] renameStore", e?.message || e); return null; }
}

export async function deleteStore(accountId, storeId) {
  try {
    await deleteDoc(doc(firestoreDb, STORES, storeId));
    try { await deleteDoc(doc(firestoreDb, IMGS, storeId)); } catch { /* may not exist */ }
    const aref = doc(firestoreDb, ACCTS, accountId);
    const asnap = await getDoc(aref);
    const stores = ((asnap.exists() && asnap.data().stores) || []).filter(s => s.id !== storeId);
    await updateDoc(aref, { stores });
    return stores;
  } catch (e) { console.warn("[pos] deleteStore", e?.message || e); return null; }
}

// Persist the catalog: item metadata → store doc, image blobs → imgs doc.
export async function saveItems(storeId, items) {
  try {
    const { meta, imgs } = splitImgs(items);
    await updateDoc(doc(firestoreDb, STORES, storeId), { items: meta, updatedAt: Date.now() });
    await setDoc(doc(firestoreDb, IMGS, storeId), imgs);
    return true;
  } catch (e) { console.warn("[pos] saveItems", e?.message || e); return false; }
}

export async function saveStoreMeta(storeId, patch) {
  try { await updateDoc(doc(firestoreDb, STORES, storeId), patch); return true; }
  catch (e) { console.warn("[pos] saveMeta", e?.message || e); return false; }
}

// Mirror a store's logo into the account roster so the store picker can show it
// (the picker only has the lightweight {id,name,logo} roster, not full stores).
export async function setRosterLogo(accountId, storeId, logo) {
  try {
    const aref = doc(firestoreDb, ACCTS, accountId);
    const asnap = await getDoc(aref);
    const stores = ((asnap.exists() && asnap.data().stores) || []).map(s => s.id === storeId ? { ...s, logo: logo || null } : s);
    await updateDoc(aref, { stores });
    return stores;
  } catch (e) { console.warn("[pos] setRosterLogo", e?.message || e); return null; }
}

export async function commitSale(storeId, { items, sale }) {
  try {
    const ref = doc(firestoreDb, STORES, storeId);
    const snap = await getDoc(ref); if (!snap.exists()) return null;
    const cur = snap.data();
    const { meta } = splitImgs(items);
    const sales = [sale, ...(cur.sales || [])].slice(0, 200);
    const a = { ...emptyAgg(), ...(cur.agg || {}) };
    const agg = {
      revenue: round2(a.revenue + sale.revenue), cost: round2(a.cost + sale.cost),
      profit: round2(a.profit + sale.profit), tax: round2(a.tax + sale.tax),
      gross: round2(a.gross + sale.total), count: a.count + 1,
    };
    await updateDoc(ref, { items: meta, sales, agg, updatedAt: Date.now() });
    return { sales, agg };
  } catch (e) { console.warn("[pos] commitSale", e?.message || e); return null; }
}

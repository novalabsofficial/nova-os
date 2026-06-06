// Nova POS backend — v11.0 (remastered). Two layers:
//
//  1) OS launcher gate — `nova_pos/access` { users:[usernames] }. Drives whether
//     the POS app icon is even visible in Nova OS (NovaMod + granted accounts).
//     Managed by NovaMod. (fetchAccessList / grantAccess / revokeAccess)
//
//  2) Multi-store POS — each store is its own login (username + password) with its
//     own catalog, stock, sales ledger and revenue/profit totals. Stored in:
//       nova_pos_stores/{storeId} → { id, name, username, passHash, taxRate,
//           items:[{id,name,price,cost,stock,category}], sales:[…recent],
//           agg:{revenue,cost,profit,tax,gross,count}, createdAt, createdByUid }
//       nova_pos_imgs/{storeId}   → { [itemId]: dataURL }   (image blobs kept out
//           of the store doc so every sale-write stays small + under the 1 MiB cap)
//
//  Passwords are SHA-256 hashed client-side (Web Crypto). This is a pragmatic,
//  client-trust model suited to a personal project — not bank-grade auth (a real
//  deployment would verify on a backend). Hashing still beats storing plaintext.

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

const norm = (u) => (u || "").trim().toLowerCase();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

// ───────────────────────────── multi-store POS ──────────────────────────────
const STORES = "nova_pos_stores";
const IMGS = "nova_pos_imgs";
const slug = (u) => "s_" + norm(u).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export async function hashPw(pw) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("novapos" + pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback for non-secure contexts where crypto.subtle is unavailable.
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

export async function createStore({ name, username, password, byUid }) {
  const id = slug(username);
  if (!id || id === "s_") return { error: "Pick a store username (letters/numbers)." };
  if (!password || password.length < 3) return { error: "Password must be at least 3 characters." };
  try {
    const ref = doc(firestoreDb, STORES, id);
    if ((await getDoc(ref)).exists()) return { error: "A store with that username already exists." };
    const store = {
      id, name: (name || username).trim().slice(0, 60), username: norm(username),
      passHash: await hashPw(password), taxRate: 0, state: "", items: [], sales: [], agg: emptyAgg(),
      createdAt: Date.now(), createdByUid: byUid || null,
    };
    await setDoc(ref, store);
    return { store: { ...store, items: [] } };
  } catch (e) { console.warn("[pos] createStore", e?.message || e); return { error: "Couldn't create store (connection or rules)." }; }
}

export async function loginStore({ username, password }) {
  const id = slug(username);
  try {
    const snap = await getDoc(doc(firestoreDb, STORES, id));
    if (!snap.exists()) return { error: "No store found with that username." };
    const d = snap.data();
    if (d.passHash !== await hashPw(password)) return { error: "Incorrect password." };
    const imgsSnap = await getDoc(doc(firestoreDb, IMGS, id));
    const imgs = imgsSnap.exists() ? imgsSnap.data() : {};
    return { store: { ...d, id, agg: { ...emptyAgg(), ...(d.agg || {}) }, sales: d.sales || [], items: mergeImgs(d.items, imgs) } };
  } catch (e) { console.warn("[pos] login", e?.message || e); return { error: "Couldn't sign in (connection)." }; }
}

// Persist the catalog: item metadata → store doc, image blobs → imgs doc.
export async function saveItems(id, items) {
  try {
    const { meta, imgs } = splitImgs(items);
    await updateDoc(doc(firestoreDb, STORES, id), { items: meta, updatedAt: Date.now() });
    await setDoc(doc(firestoreDb, IMGS, id), imgs);
    return true;
  } catch (e) { console.warn("[pos] saveItems", e?.message || e); return false; }
}

export async function saveTaxRate(id, taxRate) {
  try { await updateDoc(doc(firestoreDb, STORES, id), { taxRate: Math.max(0, Math.min(100, Number(taxRate) || 0)) }); return true; }
  catch (e) { console.warn("[pos] saveTax", e?.message || e); return false; }
}
// Generic small-field patch (e.g. { state, taxRate }).
export async function saveStoreMeta(id, patch) {
  try { await updateDoc(doc(firestoreDb, STORES, id), patch); return true; }
  catch (e) { console.warn("[pos] saveMeta", e?.message || e); return false; }
}

// Commit a completed sale: write the stock-decremented catalog, prepend the sale
// to the (capped) ledger, and roll the running revenue/cost/profit totals.
export async function commitSale(id, { items, sale }) {
  try {
    const ref = doc(firestoreDb, STORES, id);
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

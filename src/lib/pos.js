// Nova POS backend — v11.0 Phase C. A small point-of-sale store gated to the
// NovaMod account (and anyone NovaMod explicitly grants). All state lives in the
// `nova_pos` Firestore collection so a business can ring sales across devices:
//   access  → { users: [lowercased usernames granted POS access] }
//   catalog → { items: [{ id, name, price, emoji, category, stock }] }
//   sales   → { log:   [{ id, at, items:[{id,name,price,qty}], subtotal, tax, total, tender, paid, cashier }] }
//
// Access gating is enforced in the UI (NovaOS hides the launcher entry) AND should
// be backed by Firestore security rules (see the rules snippet shipped with 11.0).

import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

const COLL = "nova_pos";
const norm = (u) => (u || "").trim().toLowerCase();

// ---- access allowlist -------------------------------------------------------
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

// ---- catalog ----------------------------------------------------------------
export async function fetchCatalog() {
  try { const s = await getDoc(doc(firestoreDb, COLL, "catalog")); return s.exists() ? (s.data().items || []) : null; }
  catch (e) { console.warn("[pos] catalog", e?.message || e); return null; }
}
export async function saveCatalog(items) {
  try { await setDoc(doc(firestoreDb, COLL, "catalog"), { items, updatedAt: Date.now() }); return true; }
  catch (e) { console.warn("[pos] saveCatalog", e?.message || e); return false; }
}

// ---- sales ------------------------------------------------------------------
export async function fetchSales() {
  try { const s = await getDoc(doc(firestoreDb, COLL, "sales")); return s.exists() ? (s.data().log || []) : []; }
  catch (e) { console.warn("[pos] sales", e?.message || e); return []; }
}
export async function recordSale(sale) {
  try {
    const cur = await fetchSales();
    const log = [sale, ...cur].slice(0, 500);
    await setDoc(doc(firestoreDb, COLL, "sales"), { log, updatedAt: Date.now() });
    return true;
  } catch (e) { console.warn("[pos] recordSale", e?.message || e); return false; }
}

// Starter catalog seeded the first time NovaMod opens the register on a fresh DB.
export const SEED_CATALOG = [
  { id: "p1", name: "Espresso",      price: 2.75, emoji: "☕", category: "Drinks" },
  { id: "p2", name: "Latte",         price: 4.50, emoji: "🥛", category: "Drinks" },
  { id: "p3", name: "Cold Brew",     price: 4.25, emoji: "🧊", category: "Drinks" },
  { id: "p4", name: "Croissant",     price: 3.25, emoji: "🥐", category: "Bakery" },
  { id: "p5", name: "Bagel",         price: 2.50, emoji: "🥯", category: "Bakery" },
  { id: "p6", name: "Muffin",        price: 3.00, emoji: "🧁", category: "Bakery" },
  { id: "p7", name: "Sandwich",      price: 7.50, emoji: "🥪", category: "Food" },
  { id: "p8", name: "Salad",         price: 8.00, emoji: "🥗", category: "Food" },
  { id: "p9", name: "Cookie",        price: 1.75, emoji: "🍪", category: "Snacks" },
  { id: "p10", name: "Chips",        price: 1.50, emoji: "🥨", category: "Snacks" },
  { id: "p11", name: "Bottled Water",price: 1.25, emoji: "💧", category: "Drinks" },
  { id: "p12", name: "Sparkling",    price: 2.00, emoji: "🫧", category: "Drinks" },
];

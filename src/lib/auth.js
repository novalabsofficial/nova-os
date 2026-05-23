// v6.3 — Firebase Auth migration layer
//
// Why this exists: pre-6.3, accounts were stored as plaintext-password
// documents at `nova_storage/user_<username>_pw`. That worked for a demo but
// couldn't be locked down with Firestore security rules (rules need a
// `request.auth.uid` to verify ownership; there was no auth at all).
//
// 6.3 switches to Firebase Email/Password Auth, using a synthesized email
// (`<username>@nova.local`) so the username UX stays identical. Existing
// accounts migrate transparently on their first 6.3 login:
//   1. Try Firebase signIn — if the user already migrated, done.
//   2. If user-not-found, read the legacy plaintext doc.
//   3. If the legacy password matches, create a Firebase Auth account using
//      the SAME password they just typed, then delete the legacy doc and
//      stamp the user data doc with the new uid.
//
// After everyone has logged in once post-6.3, there are zero plaintext
// passwords left in Firestore.
//
// Synthesized-email caveat: Firebase email validation is lenient on TLDs
// like .local, but if you switch to a stricter setup (e.g. requiring
// verification) you may need to swap the domain for a real one you own.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, firestoreDb } from "../firebase.js";
import { COLL } from "../ui/constants.js";

// Synthesized email pattern. `@nova.local` is intentionally non-routable so
// Firebase password-reset emails never go anywhere — the OS handles its own
// password story per-user via the demo UI.
const EMAIL_DOMAIN = "@nova.local";

export function usernameToEmail(username) {
  return username + EMAIL_DOMAIN;
}

// Sanitize and normalize a username. Same rules as pre-6.3 (lowercase, alnum
// + underscore) so existing accounts hash to the same email.
export function normalizeUsername(raw) {
  return String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

// ── Doc key helpers ──────────────────────────────────────────────────
// All user-scoped docs in `nova_storage` follow the legacy key shape
// `user_<username>_<kind>` because that's what was there before 6.3 and we
// want migration to be a no-op for data. Rules check ownership via a `uid`
// field on each doc.
const legacyPwKey   = (u) => "user_" + u + "_pw";   // legacy plaintext, deleted on migration
const legacyDataKey = (u) => "user_" + u + "_data";
const legacyIconKey = (u) => "user_" + u + "_iconpos";

async function readLegacyDoc(key) {
  const snap = await getDoc(doc(firestoreDb, COLL, key));
  return snap.exists() ? snap.data() : null;
}

/**
 * Register a brand-new account. Creates the Firebase Auth user, then writes
 * the initial user data doc stamped with the uid so security rules accept
 * future writes from this account.
 *
 * @returns { uid, username }  on success
 * @throws  Error with .code = "username-taken" | "weak-password" | "internal"
 */
export async function register(username, password, initialData) {
  const u = normalizeUsername(username);
  if (!u || u.length < 3) throw Object.assign(new Error("Username needs 3+ characters."), {code: "bad-username"});
  if (!password || password.length < 4) throw Object.assign(new Error("Password needs 4+ characters."), {code: "weak-password"});

  // Pre-check legacy plaintext doc so we surface "username taken" cleanly
  // even if the legacy migration hasn't run for that username yet.
  const legacy = await readLegacyDoc(legacyPwKey(u));
  if (legacy) throw Object.assign(new Error("Username taken."), {code: "username-taken"});

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, usernameToEmail(u), password);
  } catch (e) {
    if (e?.code === "auth/email-already-in-use") {
      throw Object.assign(new Error("Username taken."), {code: "username-taken"});
    }
    if (e?.code === "auth/weak-password") {
      throw Object.assign(new Error("Password is too weak (Firebase requires 6+ characters)."), {code: "weak-password"});
    }
    throw Object.assign(new Error("Could not create account: " + (e?.message || "unknown error")), {code: "internal"});
  }

  // Write the user-data doc stamped with the uid. This is what rules verify
  // against on subsequent writes.
  const payload = { uid: cred.user.uid, value: initialData };
  await setDoc(doc(firestoreDb, COLL, legacyDataKey(u)), payload);

  return { uid: cred.user.uid, username: u };
}

/**
 * Log in. Tries Firebase Auth first; if the account doesn't exist there yet,
 * falls back to the legacy plaintext check and silently upgrades the account
 * to Firebase Auth on success.
 *
 * @returns { uid, username, migrated }  migrated=true if this was a legacy
 *                                       account that just got upgraded
 * @throws  Error with .code = "no-account" | "wrong-password" | "internal"
 */
export async function login(username, password) {
  const u = normalizeUsername(username);
  if (!u) throw Object.assign(new Error("Account not found."), {code: "no-account"});

  // Step 1: try Firebase Auth.
  try {
    const cred = await signInWithEmailAndPassword(auth, usernameToEmail(u), password);
    return { uid: cred.user.uid, username: u, migrated: false };
  } catch (e) {
    // Only fall through to legacy migration for "user not found". Wrong
    // password on an already-migrated account should fail loudly.
    if (e?.code === "auth/wrong-password" || e?.code === "auth/invalid-credential") {
      // Could be a legitimate wrong password OR a legacy user typing the
      // right password. Try legacy check before giving up.
      const legacyMigrated = await tryLegacyMigration(u, password);
      if (legacyMigrated) return legacyMigrated;
      throw Object.assign(new Error("Incorrect password."), {code: "wrong-password"});
    }
    if (e?.code !== "auth/user-not-found") {
      throw Object.assign(new Error("Sign-in failed: " + (e?.message || "unknown")), {code: "internal"});
    }
  }

  // Step 2: legacy fallback — read the plaintext doc.
  const migrated = await tryLegacyMigration(u, password);
  if (migrated) return migrated;
  throw Object.assign(new Error("Account not found."), {code: "no-account"});
}

// Internal — try to migrate a pre-6.3 account by verifying the plaintext
// password and upgrading the user into Firebase Auth using the same password.
async function tryLegacyMigration(u, password) {
  const pwDoc = await readLegacyDoc(legacyPwKey(u));
  if (!pwDoc) return null;
  // Legacy doc shape: { value: "<plaintext-password>" }
  const stored = pwDoc.value;
  if (stored !== password) return null; // wrong password — bubble up, don't migrate

  // Create the Firebase Auth identity with the SAME password the user just
  // typed. They won't notice — same username + password as before.
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, usernameToEmail(u), password);
  } catch (e) {
    if (e?.code === "auth/weak-password") {
      // Pre-6.3 had no minimum length; Firebase requires 6+. Surface a
      // helpful error rather than silently failing.
      throw Object.assign(new Error("Your old password is too short for the v6.3 upgrade (needs 6+ characters). Pick a longer one in Settings after signing in via a workaround, or contact a mod."), {code: "weak-password"});
    }
    throw Object.assign(new Error("Migration failed: " + (e?.message || "unknown")), {code: "internal"});
  }

  // Stamp the existing user-data doc with the new uid so rules accept it.
  // If the data doc doesn't exist yet, create an empty one — that shouldn't
  // happen in practice but it's a cheap safety net.
  const dataKey = legacyDataKey(u);
  const dataSnap = await getDoc(doc(firestoreDb, COLL, dataKey));
  if (dataSnap.exists()) {
    const existing = dataSnap.data() || {};
    await setDoc(doc(firestoreDb, COLL, dataKey), { ...existing, uid: cred.user.uid });
  } else {
    await setDoc(doc(firestoreDb, COLL, dataKey), { uid: cred.user.uid, value: {} });
  }

  // Also stamp the iconpos doc if it exists, so future writes pass rules.
  const iconSnap = await getDoc(doc(firestoreDb, COLL, legacyIconKey(u)));
  if (iconSnap.exists()) {
    const existing = iconSnap.data() || {};
    await setDoc(doc(firestoreDb, COLL, legacyIconKey(u)), { ...existing, uid: cred.user.uid });
  }

  // Delete the plaintext-password doc. From this point on the only password
  // for this account lives in Firebase Auth (hashed + salted).
  try { await deleteDoc(doc(firestoreDb, COLL, legacyPwKey(u))); } catch {}

  return { uid: cred.user.uid, username: u, migrated: true };
}

export async function logoutUser() {
  try { await signOut(auth); } catch {}
}

// Reactive auth state — call cb(currentUser | null) on any auth change.
// Returns an unsubscribe function.
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// v9.5 — User-created servers (Discord-style). Each server is its own little
// world: a member list, a set of channels, a stream of messages.
//
// Data model
// ──────────
//   nova_servers/{serverId}            { name, icon, ownerUid, ownerUsername,
//                                        memberUids[], memberUsernames[],
//                                        inviteCode, channels[{id,name}],
//                                        createdAt }
//   nova_server_invites/{inviteCode}   { serverId, name, icon, ownerUsername }
//   nova_servers/{serverId}/messages/* { uid, user, text, ts, channelId }
//
// Why two collections?
//   • The invite collection is the "front door" — readable by anyone
//     signed-in *who knows the code*. Listing is denied so codes can't be
//     enumerated.
//   • The actual server doc gates everything else on membership.
//
// Joining flow
//   1. User enters a code → resolveInvite(code) reads the invite doc.
//   2. Client calls joinServer(serverId, username) which arrayUnion's the
//      user's uid+username onto the server doc. Rules permit the self-add
//      from a non-member; everything else stays immutable.
//
// Owner rules
//   • Only the owner can edit the server doc beyond join/leave (rename,
//     add/remove channels, delete server).
//   • The owner can't "leave" — they have to delete the server. (Avoids
//     orphan servers with no owner; keeps the rules simple.)

import {
  collection, doc, getDoc, setDoc, deleteDoc, updateDoc,
  addDoc, query, where, orderBy, limit, onSnapshot,
  arrayUnion, arrayRemove, writeBatch, getDocs, deleteField,
} from "firebase/firestore";
import { firestoreDb } from "../firebase.js";

// v9.6 — role constants. Owner is immutable (the creator). Admins get
// moderation powers (delete any message); members are the default.
export const ROLE_OWNER = "owner";
export const ROLE_ADMIN = "admin";
export const ROLE_MEMBER = "member";

/** Clean a per-server nickname. Empty string clears it (falls back to username). */
export function cleanNick(raw, maxLen = 24) {
  return (raw || "").toString().trim().replace(/\s+/g, " ").slice(0, maxLen);
}

/**
 * Resolve a member's display name within a server: their nickname if set,
 * otherwise their username. `server.members[uid]` holds the metadata.
 */
export function memberDisplayName(server, uid, fallbackUser) {
  const m = server?.members?.[uid];
  if (m && m.nick && m.nick.trim()) return m.nick.trim();
  return (m && m.user) || fallbackUser || "?";
}

/** A member's role in a server (defaults to "member" for legacy/missing entries). */
export function memberRole(server, uid) {
  if (server?.ownerUid === uid) return ROLE_OWNER;
  return server?.members?.[uid]?.role || ROLE_MEMBER;
}

// ── helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a 6-character invite code. Avoids the visually-ambiguous
 * O/0/I/1/L pairs. Caller should verify uniqueness — collision odds at
 * 32^6 ≈ 1B are fine for a project this size, and joinByCode just resolves
 * whichever invite it finds.
 */
export function newInviteCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 chars, no O/0/1/I/L
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Sanitize a server / channel name. Used both server-side (length cap) and client-side (UX). */
export function cleanServerName(raw, maxLen = 40) {
  return (raw || "").toString().trim().replace(/\s+/g, " ").slice(0, maxLen);
}
export function cleanChannelName(raw, maxLen = 28) {
  // Channels are slug-ish: lowercase, hyphens, no spaces. Matches the
  // Discord look "#general", "#bots", etc.
  return (raw || "")
    .toString().trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, maxLen);
}

// ── reads ──────────────────────────────────────────────────────────────

/**
 * Subscribe to the current user's joined servers. Sorted client-side by
 * createdAt (newest first) — composite-index avoidance, same pattern as
 * watchMyThreads.
 */
export function watchMyServers(myUid, cb) {
  if (!myUid) return () => {};
  const q = query(
    collection(firestoreDb, "nova_servers"),
    where("memberUids", "array-contains", myUid),
    limit(80),
  );
  return onSnapshot(q,
    snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(list);
    },
    err => { console.warn("[servers] watchMyServers error:", err?.message || err); cb([]); },
  );
}

/**
 * Subscribe to a server's messages for a specific channel. Filtering by
 * channelId is done client-side because Firestore would otherwise need a
 * composite (channelId, ts) index. Channels typically aren't chatty
 * enough for the un-indexed read to matter at this scale.
 */
export function watchServerMessages(serverId, channelId, cb) {
  if (!serverId) return () => {};
  const q = query(
    collection(firestoreDb, "nova_servers", serverId, "messages"),
    orderBy("ts", "asc"),
    limit(250),
  );
  return onSnapshot(q,
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Default to the channel filter when one is provided; otherwise all.
      const filtered = channelId ? all.filter(m => (m.channelId || "general") === channelId) : all;
      cb(filtered);
    },
    err => { console.warn("[servers] watchServerMessages error:", err?.message || err); cb([]); },
  );
}

/**
 * Resolve an invite code → server metadata. Returns null if the code
 * doesn't exist or read is denied. The invite doc holds a denormalized
 * snapshot of {name, icon, ownerUsername} for a "preview before joining"
 * UX; the real serverId is what the join flow uses.
 */
export async function resolveInvite(code) {
  const c = (code || "").toString().trim().toUpperCase();
  if (!c) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, "nova_server_invites", c));
    return snap.exists() ? { code: c, ...snap.data() } : null;
  } catch (e) {
    console.warn("[servers] resolveInvite error:", e?.message || e);
    return null;
  }
}

// ── writes ──────────────────────────────────────────────────────────────

/**
 * Create a brand-new server. Writes the server doc *and* the invite
 * lookup doc. The two writes aren't atomic (no Firestore transactions
 * across collections without a batch) — we use a batch so they succeed
 * or fail as a pair.
 *
 * Default channels: just `#general`. The owner can add more from the UI.
 */
export async function createServer({ name, icon, myUid, myUsername }) {
  if (!myUid || !myUsername) throw new Error("Sign in first.");
  const cleanName = cleanServerName(name);
  if (!cleanName) throw new Error("Server name required.");

  const serverId = "srv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const code = newInviteCode();
  const now = Date.now();
  const safeIcon = (icon || "💬").toString().slice(0, 8);

  const serverDoc = {
    name: cleanName,
    icon: safeIcon,
    ownerUid: myUid,
    ownerUsername: myUsername,
    memberUids: [myUid],
    memberUsernames: [myUsername],
    // v9.6: per-member metadata. The query + read-gating still use the
    // memberUids array; this map carries role + nickname.
    members: { [myUid]: { role: ROLE_OWNER, nick: "", user: myUsername } },
    inviteCode: code,
    channels: [{ id: "general", name: "general" }],
    createdAt: now,
  };
  const inviteDoc = {
    serverId,
    name: cleanName,
    icon: safeIcon,
    ownerUsername: myUsername,
    createdAt: now,
  };

  // Two-step (no cross-collection transaction). Server first — invite is
  // useless without it; if the invite write fails we still have a usable
  // server but no public invite, owner can regenerate.
  await setDoc(doc(firestoreDb, "nova_servers", serverId), serverDoc);
  try {
    await setDoc(doc(firestoreDb, "nova_server_invites", code), inviteDoc);
  } catch (e) {
    console.warn("[servers] invite write failed (server created OK):", e?.message || e);
  }
  return { serverId, inviteCode: code };
}

/**
 * Join a server. Caller has already resolved the invite and has the
 * serverId in hand. The update adds the user to memberUids +
 * memberUsernames via arrayUnion — Firestore rules check that it's a
 * non-member adding only themselves.
 */
export async function joinServer(serverId, myUid, myUsername) {
  if (!serverId || !myUid) throw new Error("Sign in first.");
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), {
    memberUids: arrayUnion(myUid),
    memberUsernames: arrayUnion(myUsername || ""),
    // v9.6: seed the member entry with the default role. The rules verify
    // this is the joiner's own key and role === "member".
    ["members." + myUid]: { role: ROLE_MEMBER, nick: "", user: myUsername || "" },
  });
}

/**
 * Leave a server. Owners can't leave (use deleteServer instead) — that
 * keeps the rules + UX simple (no ownership-transfer flow).
 */
export async function leaveServer(serverId, myUid, myUsername) {
  if (!serverId || !myUid) return;
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), {
    memberUids: arrayRemove(myUid),
    memberUsernames: arrayRemove(myUsername || ""),
    ["members." + myUid]: deleteField(),
  });
}

// ── v9.6: roles, nicknames, kicks, backfill ─────────────────────────────

/**
 * Set a member's per-server nickname. Allowed for the member themselves
 * (their own uid) or the owner (any uid). Empty string clears it.
 */
export async function setNickname(serverId, targetUid, nick) {
  if (!serverId || !targetUid) return;
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), {
    ["members." + targetUid + ".nick"]: cleanNick(nick),
  });
}

/**
 * Owner-only: change a member's role. Can't target the owner's own entry
 * (ownership isn't a role you toggle — it's the ownerUid field). Pass
 * ROLE_ADMIN or ROLE_MEMBER.
 */
export async function setMemberRole(serverId, targetUid, role) {
  if (!serverId || !targetUid) return;
  if (role !== ROLE_ADMIN && role !== ROLE_MEMBER) throw new Error("Invalid role.");
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), {
    ["members." + targetUid + ".role"]: role,
  });
}

/**
 * Owner-only: remove a member from the server (kick). Strips them from
 * memberUids/memberUsernames and deletes their members entry. The owner
 * can't be kicked. (Admins-kicking-members is intentionally deferred to
 * keep the rules surface small — owners do all kicking for now.)
 */
export async function kickMember(serverId, targetUid, targetUsername) {
  if (!serverId || !targetUid) return;
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), {
    memberUids: arrayRemove(targetUid),
    memberUsernames: arrayRemove(targetUsername || ""),
    ["members." + targetUid]: deleteField(),
  });
}

/**
 * Migration helper: servers created in v9.5 have no `members` map. When
 * the OWNER opens such a server, backfill the map from memberUids +
 * memberUsernames so roles/nicknames work. Only the owner can do this
 * (the owner-edit rule branch permits it). No-op if the map already
 * exists or the caller isn't the owner. Returns true if it wrote.
 */
export async function ensureMembersMap(server, myUid) {
  if (!server || !server.id) return false;
  if (server.members && Object.keys(server.members).length > 0) return false;
  if (server.ownerUid !== myUid) return false;   // only the owner can backfill
  const uids = server.memberUids || [];
  const names = server.memberUsernames || [];
  const members = {};
  uids.forEach((uid, i) => {
    members[uid] = {
      role: uid === server.ownerUid ? ROLE_OWNER : ROLE_MEMBER,
      nick: "",
      user: names[i] || "",
    };
  });
  try {
    await updateDoc(doc(firestoreDb, "nova_servers", server.id), { members });
    return true;
  } catch (e) {
    console.warn("[servers] members backfill failed:", e?.message || e);
    return false;
  }
}

/**
 * Delete a server. Best-effort cascade: try to delete the messages
 * subcollection in a batch, then the invite doc, then the server itself.
 * If any of the first two fail the server doc still goes (matches the
 * "owner is in control" rule).
 */
export async function deleteServer(serverId) {
  if (!serverId) return;
  // 1) Try to read the server so we can grab the inviteCode for cleanup.
  let inviteCode = null;
  try {
    const snap = await getDoc(doc(firestoreDb, "nova_servers", serverId));
    if (snap.exists()) inviteCode = snap.data().inviteCode || null;
  } catch {}
  // 2) Best-effort: delete the messages subcollection in batches of 100.
  try {
    let cursor = null;
    while (true) {
      const ms = await getDocs(query(
        collection(firestoreDb, "nova_servers", serverId, "messages"),
        limit(100),
      ));
      if (ms.empty) break;
      const batch = writeBatch(firestoreDb);
      ms.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (ms.docs.length < 100) break;
    }
  } catch (e) {
    console.warn("[servers] message-subcollection cleanup failed:", e?.message || e);
  }
  // 3) Delete the invite doc (silently OK if it's already gone).
  if (inviteCode) {
    try { await deleteDoc(doc(firestoreDb, "nova_server_invites", inviteCode)); } catch {}
  }
  // 4) Finally delete the server itself.
  await deleteDoc(doc(firestoreDb, "nova_servers", serverId));
}

/** Owner-only: rename the server. */
export async function renameServer(serverId, newName) {
  const clean = cleanServerName(newName);
  if (!clean) throw new Error("Name required.");
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), { name: clean });
  // Keep the denormalized invite doc in sync (cosmetic).
  try {
    const snap = await getDoc(doc(firestoreDb, "nova_servers", serverId));
    const code = snap.data()?.inviteCode;
    if (code) await updateDoc(doc(firestoreDb, "nova_server_invites", code), { name: clean });
  } catch {}
}

/** Owner-only: add a channel. */
export async function addChannel(serverId, channelName, existingChannels) {
  const clean = cleanChannelName(channelName);
  if (!clean) throw new Error("Channel name required.");
  if ((existingChannels || []).some(c => c.id === clean)) throw new Error("That channel already exists.");
  const next = [...(existingChannels || []), { id: clean, name: clean }];
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), { channels: next });
}

/** Owner-only: remove a channel. Messages tagged with the channelId stay
 *  in the subcollection (orphaned) but become invisible because no UI
 *  surfaces a channel that's no longer in the list. */
export async function removeChannel(serverId, channelId, existingChannels) {
  const next = (existingChannels || []).filter(c => c.id !== channelId);
  if (next.length === 0) throw new Error("Can't remove the last channel.");
  await updateDoc(doc(firestoreDb, "nova_servers", serverId), { channels: next });
}

/** Send a message into a server channel. */
export async function sendServerMessage(serverId, channelId, text, myUid, myUsername) {
  if (!serverId || !text || !text.trim() || !myUid) return;
  const trimmed = text.trim().slice(0, 500);
  await addDoc(collection(firestoreDb, "nova_servers", serverId, "messages"), {
    uid: myUid,
    user: myUsername || "",
    text: trimmed,
    ts: Date.now(),
    channelId: channelId || "general",
  });
  // v9.6: bump the server's activity stamp so other members' unread badges
  // light up. Best-effort + non-atomic with the message write — if it
  // fails the message still landed, only the badge lags. The rules allow
  // any member to change ONLY lastActivityTs + lastSenderUid.
  try {
    await updateDoc(doc(firestoreDb, "nova_servers", serverId), {
      lastActivityTs: Date.now(),
      lastSenderUid: myUid,
    });
  } catch { /* badge bump is best-effort */ }
}

/** Delete a server message (own message, or any if you're the owner). */
export async function deleteServerMessage(serverId, msgId) {
  if (!serverId || !msgId) return;
  await deleteDoc(doc(firestoreDb, "nova_servers", serverId, "messages", msgId));
}

/** Owner-only: regenerate the invite code (e.g. after sharing publicly). */
export async function regenerateInvite(serverId) {
  // Read old code so we can clean up the old invite doc.
  let oldCode = null;
  try {
    const snap = await getDoc(doc(firestoreDb, "nova_servers", serverId));
    if (!snap.exists()) throw new Error("Server not found");
    oldCode = snap.data().inviteCode || null;
    const newCode = newInviteCode();
    await updateDoc(doc(firestoreDb, "nova_servers", serverId), { inviteCode: newCode });
    // Write the new invite doc with a snapshot of the server fields.
    const s = snap.data();
    await setDoc(doc(firestoreDb, "nova_server_invites", newCode), {
      serverId,
      name: s.name,
      icon: s.icon || "💬",
      ownerUsername: s.ownerUsername || "",
      createdAt: Date.now(),
    });
    // Delete the old invite doc (best-effort).
    if (oldCode) try { await deleteDoc(doc(firestoreDb, "nova_server_invites", oldCode)); } catch {}
    return newCode;
  } catch (e) {
    throw e;
  }
}

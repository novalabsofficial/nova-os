// v7.4 — Online chess: Firestore helpers for 2-player chess games.
//
// Mirrors the DM helper module: each game is a doc with a deterministic ID
// based on the two participants' uids + a timestamp (so a pair of players
// can have multiple ongoing games without collisions).
//
// Data model:
//   nova_chess_games/<gameId>   {
//     participantUids: [whiteUid, blackUid],
//     participantUsernames: [whiteName, blackName],
//     fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",  // chess.js FEN
//     pgn: "1. e4 e5 ...",                                              // game history
//     currentTurn: "w" | "b",
//     status: "active" | "white_wins" | "black_wins" | "draw" | "resigned" | "abandoned",
//     createdAt: number,
//     lastMoveAt: number,
//   }
//
// FEN is the authoritative board state; PGN is human-readable history.
// chess.js parses both, so we round-trip cleanly.

import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, addDoc,
} from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { resolveUsername } from "./dms.js";

// Initial FEN for a fresh game (standard starting position).
export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Watch all chess games involving the current user — both their turn
 * and waiting. Most-recent activity first.
 */
export function watchMyGames(myUid, cb) {
  if (!myUid) return () => {};
  const q = query(
    collection(firestoreDb, "nova_chess_games"),
    where("participantUids", "array-contains", myUid),
    orderBy("lastMoveAt", "desc"),
    limit(50),
  );
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

/**
 * Watch a single game doc in real-time. The opponent's move arrives via
 * this subscription so the board re-renders instantly.
 */
export function watchGame(gameId, cb) {
  if (!gameId) return () => {};
  return onSnapshot(doc(firestoreDb, "nova_chess_games", gameId),
    snap => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => cb(null),
  );
}

/**
 * Challenge another user by username. Creates a new game with the challenger
 * as white (classical convention). Returns the new game's id.
 *
 * Throws on:
 *   - user not found ("No user with that name.")
 *   - challenging self ("You can't play yourself.")
 */
export async function challengeUserByName(otherUsername, myUid, myUsername) {
  if (!myUid || !myUsername) throw new Error("Sign in first.");
  const other = await resolveUsername(otherUsername);
  if (!other)                throw new Error("No user with that name.");
  if (other.uid === myUid)   throw new Error("You can't challenge yourself.");

  // Use addDoc rather than deterministic IDs — letting a pair of users have
  // multiple concurrent games is fine. Random IDs avoid collisions.
  const ref = await addDoc(collection(firestoreDb, "nova_chess_games"), {
    participantUids:      [myUid, other.uid],
    participantUsernames: [myUsername, other.username],
    fen: STARTING_FEN,
    pgn: "",
    currentTurn: "w",
    status: "active",
    createdAt:  Date.now(),
    lastMoveAt: Date.now(),
  });
  return ref.id;
}

/**
 * Push a move to a game doc. Caller has already validated the move locally
 * via chess.js — we just persist the new FEN + PGN + turn.
 *
 * `nextStatus` is the post-move outcome: "active", "white_wins" if the
 * mover just delivered mate as white, etc. Computed by the caller.
 */
export async function persistMove(gameId, { fen, pgn, nextTurn, nextStatus }) {
  await updateDoc(doc(firestoreDb, "nova_chess_games", gameId), {
    fen,
    pgn,
    currentTurn: nextTurn,
    status:      nextStatus,
    lastMoveAt:  Date.now(),
  });
}

/**
 * Resign the game (forfeit). The opposing color wins automatically.
 */
export async function resignGame(gameId, myColor) {
  const winnerStatus = myColor === "w" ? "black_wins" : "white_wins";
  await updateDoc(doc(firestoreDb, "nova_chess_games", gameId), {
    status: winnerStatus,
    lastMoveAt: Date.now(),
  });
}

/**
 * Delete a finished game (only allowed for completed games).
 * Used as a "clear from my list" action.
 */
export async function deleteGame(gameId) {
  await deleteDoc(doc(firestoreDb, "nova_chess_games", gameId));
}

/**
 * Given a game doc and our uid, return our color ("w" or "b") and the
 * opponent's display name.
 */
export function describeGameFromUser(game, myUid) {
  if (!game || !Array.isArray(game.participantUids)) {
    return { myColor: null, opponentName: "?", isMyTurn: false };
  }
  const myIndex = game.participantUids.indexOf(myUid);
  if (myIndex === -1) return { myColor: null, opponentName: "?", isMyTurn: false };
  // Convention: participantUids[0] = white, [1] = black (set at create time)
  const myColor = myIndex === 0 ? "w" : "b";
  const opponentName = game.participantUsernames?.[1 - myIndex] || "?";
  const isMyTurn = game.status === "active" && game.currentTurn === myColor;
  return { myColor, opponentName, isMyTurn };
}

/**
 * Pretty-print a game status into something a user understands.
 */
export function describeStatus(game, myColor) {
  if (!game) return "";
  if (game.status === "active") {
    return game.currentTurn === myColor ? "Your move" : "Waiting for opponent…";
  }
  if (game.status === "draw") return "Draw";
  if (game.status === "resigned") return "Resigned";
  if (game.status === "abandoned") return "Abandoned";
  if (game.status === "white_wins") return myColor === "w" ? "You win 🏆" : "You lose";
  if (game.status === "black_wins") return myColor === "b" ? "You win 🏆" : "You lose";
  return game.status;
}

// v8.6 — tiny in-memory photo store shared across apps for the current session.
// The Screenshot tool pushes finished screenshots here; the Photos app seeds
// from it on mount and subscribes for new ones, so a screenshot you save shows
// up in the gallery (and survives closing/reopening Photos within the session).
// Not persisted to Firestore — same session-only model as the Photos app.
//
// v9.3 — uploaded photos now also live here (issue #19). Previously the Photos
// app kept uploads in local component state, which evaporated on unmount, so
// closing the app blew away the gallery. Routing uploads through this store
// makes them survive close/reopen for the whole session.

let _photos = [];
const _subs = new Set();

function _emit() {
  _subs.forEach(fn => { try { fn(_photos); } catch { /* ignore subscriber errors */ } });
}

export function getStorePhotos() { return _photos; }

export function addStorePhoto(photo) {
  _photos = [..._photos, photo];
  _emit();
}

// v9.3: remove a photo by id. Returns the removed photo (so the caller can
// revoke its blob URL if appropriate).
export function removeStorePhoto(id) {
  const idx = _photos.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const removed = _photos[idx];
  _photos = [..._photos.slice(0, idx), ..._photos.slice(idx + 1)];
  _emit();
  return removed;
}

// v9.3: patch an existing photo's fields (used by the async width/height
// probe in PhotosApp — once the image loads, we record its intrinsic size).
export function updateStorePhoto(id, patch) {
  let changed = false;
  _photos = _photos.map(p => {
    if (p.id !== id) return p;
    changed = true;
    return { ...p, ...patch };
  });
  if (changed) _emit();
}

export function subscribeStorePhotos(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

// ── v9.7: albums ─────────────────────────────────────────────────────────
// Session-only groupings of photos. A photo's `albumId` field (optional)
// points at an album; albums themselves are { id, name }. Same session
// lifetime as the photos — no Firestore persistence, consistent with the
// blob-URL model. Deleting an album just clears the albumId off its
// photos (the photos stay in the library).
let _albums = [];
const _albumSubs = new Set();
function _emitAlbums() {
  _albumSubs.forEach(fn => { try { fn(_albums); } catch { /* ignore */ } });
}

export function getAlbums() { return _albums; }
export function subscribeAlbums(fn) { _albumSubs.add(fn); return () => _albumSubs.delete(fn); }

export function createAlbum(name) {
  const album = { id: "al-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), name: (name || "New Album").trim() || "New Album" };
  _albums = [..._albums, album];
  _emitAlbums();
  return album;
}
export function renameAlbum(id, name) {
  _albums = _albums.map(a => a.id === id ? { ...a, name: (name || "").trim() || a.name } : a);
  _emitAlbums();
}
export function deleteAlbum(id) {
  _albums = _albums.filter(a => a.id !== id);
  // Orphan the photos that belonged to it (keep them in the library).
  let changed = false;
  _photos = _photos.map(p => { if (p.albumId === id) { changed = true; return { ...p, albumId: null }; } return p; });
  _emitAlbums();
  if (changed) _emit();
}
/** Assign (or clear, with albumId=null) a photo's album. */
export function setPhotoAlbum(photoId, albumId) {
  updateStorePhoto(photoId, { albumId: albumId || null });
}

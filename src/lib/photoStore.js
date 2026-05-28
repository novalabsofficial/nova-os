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

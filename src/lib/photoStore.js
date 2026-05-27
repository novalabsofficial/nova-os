// v8.6 — tiny in-memory photo store shared across apps for the current session.
// The Screenshot tool pushes finished screenshots here; the Photos app seeds
// from it on mount and subscribes for new ones, so a screenshot you save shows
// up in the gallery (and survives closing/reopening Photos within the session).
// Not persisted to Firestore — same session-only model as the Photos app.

let _photos = [];
const _subs = new Set();

export function getStorePhotos() { return _photos; }

export function addStorePhoto(photo) {
  _photos = [..._photos, photo];
  _subs.forEach(fn => { try { fn(_photos); } catch { /* ignore subscriber errors */ } });
}

export function subscribeStorePhotos(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

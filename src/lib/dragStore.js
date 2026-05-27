// v8.6 — cross-app drag-and-drop. A tiny shared store holds the item currently
// being dragged ({type, payload, x, y}) so a source in one app (e.g. a Photos
// thumbnail) and the drop handling in NovaOS can coordinate without prop
// drilling. NovaOS renders a floating ghost following the pointer and, on
// release, resolves the drop target via the element under the cursor
// (data-drop="…"). Pure pointer events — no flaky native HTML5 drag.

let _drag = null;
const _subs = new Set();
function emit() { _subs.forEach(fn => { try { fn(_drag); } catch { /* ignore */ } }); }

export function getDrag() { return _drag; }
export function startDrag(item) { _drag = { ...item }; emit(); }
export function moveDrag(x, y) { if (_drag) { _drag = { ..._drag, x, y }; emit(); } }
export function endDrag() { const d = _drag; _drag = null; emit(); return d; }
export function subscribeDrag(fn) { _subs.add(fn); return () => _subs.delete(fn); }

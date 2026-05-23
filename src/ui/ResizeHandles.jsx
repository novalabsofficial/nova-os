// 8-direction resize handles for windows. Mouse mode = thin/precise handles;
// touch mode = fat handles (~3x hit area) so resize actually works on tablets.

import { HANDLE_DEFS_MOUSE, HANDLE_DEFS_TOUCH } from "./constants.js";

export function ResizeHandles({ winId, onStartResize, touchy }) {
  const defs = touchy ? HANDLE_DEFS_TOUCH : HANDLE_DEFS_MOUSE;
  return defs.map(h => (
    <div key={h.id}
      onPointerDown={e => { e.stopPropagation(); onStartResize(e, winId, h.id); }}
      style={{position:"absolute", ...h.s, zIndex:20, touchAction:"none"}}/>
  ));
}

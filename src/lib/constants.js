// Layout constants shared between NovaOS and helpers in lib/geometry.

// v9.0: the taskbar is now a *floating* glass dock (inset ~8px from the
// bottom/sides with rounded corners). TASKBAR_H is the reserved band at the
// bottom of the screen — it accounts for the dock's visual height (54) plus
// its 8px bottom margin plus a few px of clearance so maximized windows and
// desktop icons never tuck under the floating dock.
export const TASKBAR_H  = 66;
// v11.1 — macOS chrome: a slim status bar across the very top (clock + tray).
// TOPBAR_H is reserved at the top of the workspace so maximized windows, the
// desktop icon grid, and top-anchored panels sit BELOW it instead of under it.
export const TOPBAR_H   = 32;
export const MIN_W      = 280;
export const MIN_H      = 200;
export const ICON_W     = 76;
// v11.0 — tiles are now a fixed height = ICON_H, so the row gap equals the column
// gap (ICON_GAP) instead of leaving a big void below each short tile. 78 keeps a
// near-square tile that still fits a two-line label; 6px gap reads balanced.
export const ICON_H     = 78;
export const ICON_GAP   = 6;
export const ICON_PAD_X = 10;
export const ICON_PAD_Y = 14;
export const WIDGET_SNAP = 20;

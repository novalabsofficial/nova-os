// Layout constants shared between NovaOS and helpers in lib/geometry.

// v9.0: the taskbar is a *floating* glass dock (inset from the bottom/sides with
// rounded corners). TASKBAR_H is the reserved band at the bottom — it accounts
// for the dock's visual height plus its bottom margin plus a couple px clearance
// so maximized/snapped windows sit just above the floating dock, never under it.
// v11.1: bumped 66 -> 78 for the larger dock (height 66 + 10px margin).
export const TASKBAR_H  = 78;
// v11.1 — macOS chrome: a slim status bar across the very top (clock + tray).
// TOPBAR_H is reserved at the top of the workspace so maximized windows, the
// desktop icon grid, and top-anchored panels sit BELOW it instead of under it.
// v11.1.3 — the bar now scales to the device: its height is derived once at load
// from the viewport width (clamped 36–46) so it's comfortably clickable on small
// laptops and proportionally larger on big / high-DPI screens, mirroring the
// responsive dock. This single value drives every top-anchored layout offset, so
// the bar and everything below it stay in lockstep. (Was a flat 32.)
const _tbVw = typeof window !== "undefined" ? window.innerWidth : 1366;
export const TOPBAR_H   = Math.max(36, Math.min(Math.round(_tbVw * 0.026), 46));
export const MIN_W      = 280;
export const MIN_H      = 200;
export const ICON_W     = 64;
// v11.0 — tiles are a fixed height = ICON_H so the row gap equals the column gap
// (ICON_GAP). v11.1 — shrunk the desktop grid (76x78 -> 64x66, icon 38 -> 30) so
// it reads as a compact, professional column instead of a big phone-launcher grid.
export const ICON_H     = 66;
export const ICON_GAP   = 6;
export const ICON_PAD_X = 10;
export const ICON_PAD_Y = 14;
export const WIDGET_SNAP = 20;

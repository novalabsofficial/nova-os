// Layout constants shared between NovaOS and helpers in lib/geometry.

// v9.0: the taskbar is now a *floating* glass dock (inset ~8px from the
// bottom/sides with rounded corners). TASKBAR_H is the reserved band at the
// bottom of the screen — it accounts for the dock's visual height (54) plus
// its 8px bottom margin plus a few px of clearance so maximized windows and
// desktop icons never tuck under the floating dock.
export const TASKBAR_H  = 66;
export const MIN_W      = 280;
export const MIN_H      = 200;
export const ICON_W     = 76;
export const ICON_H     = 92;
export const ICON_GAP   = 4;
export const ICON_PAD_X = 10;
export const ICON_PAD_Y = 14;
export const WIDGET_SNAP = 20;

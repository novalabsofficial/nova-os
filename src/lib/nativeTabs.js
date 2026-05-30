// v10.0 Supernova — native browser tabs (Tauri desktop only).
//
// On the desktop build we back each browser tab with a real embedded child
// webview (Tauri 2's multi-webview, gated behind the `unstable` Cargo
// feature). Unlike an <iframe>, a native webview can load ANY site — no
// X-Frame-Options / CSP framing limits.
//
// The webview floats above the DOM at the browser window's content rect, so
// BrowserApp drives this controller to:
//   • create / navigate a webview per tab (recreated when the URL or reload
//     key changes — there's no in-place "navigate" on the JS Webview class),
//   • track the content rect every frame (place),
//   • hide everything when the browser isn't the focused window, and hide
//     non-active tabs so they don't cover the active one.
//
// Everything is wrapped in try/catch and dynamic imports so the web bundle
// never pulls in Tauri code and a missing API degrades quietly.

let _isTauri = null;
export function isTauri() {
  if (_isTauri !== null) return _isTauri;
  _isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  return _isTauri;
}

let _seq = 0;                       // unique, label-safe (no dots)

export class NativeTabs {
  constructor() {
    this.map = new Map();           // tabId -> { wv, url, rk, placed, visible }
    this.win = null;
    this.mods = null;
    this.disposed = false;
  }

  async _load() {
    if (this.mods) return this.mods;
    const [wv, win, dpi] = await Promise.all([
      import("@tauri-apps/api/webview"),
      import("@tauri-apps/api/window"),
      import("@tauri-apps/api/dpi"),
    ]);
    this.win = win.getCurrentWindow();
    this.mods = { Webview: wv.Webview, LogicalPosition: dpi.LogicalPosition, LogicalSize: dpi.LogicalSize };
    return this.mods;
  }

  // Create (or recreate, on url/reloadKey change) the webview for a tab.
  async ensure(id, url, rk, rect) {
    if (this.disposed) return;
    const cur = this.map.get(id);
    if (cur && cur.url === url && cur.rk === rk) return;   // already showing this page
    if (cur) { try { cur.wv?.close(); } catch {} this.map.delete(id); }

    let m;
    try { m = await this._load(); } catch (e) { console.warn("[nativeTabs] api load failed", e); return; }
    if (this.disposed) return;

    const p = rect ? { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) }
                   : { x: 0, y: 0, w: 800, h: 500 };
    const label = "novatab-" + (_seq++);
    const rec = { wv: null, url, rk, placed: p, visible: true };
    this.map.set(id, rec);
    try {
      rec.wv = new m.Webview(this.win, label, { url, x: p.x, y: p.y, width: p.w, height: p.h });
      rec.wv.once?.("tauri://error", e => console.warn("[nativeTabs] webview error", e));
    } catch (e) {
      console.warn("[nativeTabs] create failed (is the `unstable` Tauri feature enabled?)", e);
    }
  }

  // Pin a tab's webview to a rect (logical px == CSS px). Skips no-op updates.
  async place(id, x, y, w, h) {
    const rec = this.map.get(id);
    if (!rec) return;
    const nx = Math.round(x), ny = Math.round(y), nw = Math.max(1, Math.round(w)), nh = Math.max(1, Math.round(h));
    const pr = rec.placed;
    if (rec.visible && pr && pr.x === nx && pr.y === ny && pr.w === nw && pr.h === nh) return;
    rec.placed = { x: nx, y: ny, w: nw, h: nh };
    rec.visible = true;
    if (!rec.wv || !this.mods) return;
    try {
      await rec.wv.setPosition(new this.mods.LogicalPosition(nx, ny));
      await rec.wv.setSize(new this.mods.LogicalSize(nw, nh));
    } catch {}
  }

  async _hide(rec) {
    if (!rec || !rec.visible || !rec.wv) { if (rec) rec.visible = false; return; }
    rec.visible = false;
    try {
      // Move + shrink off-screen — reliable across platforms without needing
      // a hide() that may not exist on the embedded Webview class.
      if (this.mods) {
        await rec.wv.setSize(new this.mods.LogicalSize(1, 1));
        await rec.wv.setPosition(new this.mods.LogicalPosition(-32000, -32000));
      }
    } catch {}
  }
  async hideAll() { for (const rec of this.map.values()) await this._hide(rec); }
  async hideOthers(keepId) { for (const [id, rec] of this.map) if (id !== keepId) await this._hide(rec); }

  async close(id) {
    const rec = this.map.get(id);
    if (rec) { try { rec.wv?.close(); } catch {} this.map.delete(id); }
  }
  dispose() {
    this.disposed = true;
    for (const rec of this.map.values()) { try { rec.wv?.close(); } catch {} }
    this.map.clear();
  }
}

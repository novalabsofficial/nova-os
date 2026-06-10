// v11.0 — Custom brand logo ("bring your own logo"), mirroring the custom
// wallpaper system. The user uploads or pastes a PNG once and Nova renders it
// in every logo slot — boot splash, login mark, taskbar start button, the Store
// header, and the browser-tab favicon — fitted to a square.
//
// The image data URL is persisted per-user in Firestore by NovaOS (key
// "user:<name>:logoimg"). The <NovaLogo> component has no access to app state,
// so this module broadcasts the *current* logo to it through a tiny pub/sub
// (same shape as the achievements handler), and keeps the favicon in sync.
//
// Stored shape: { url: <dataURL>, fit: "contain"|"cover", shape: "rounded"|"square"|"circle" }

let _logo = null;
const _subs = new Set();

export function getCustomLogo() { return _logo; }

export function setCustomLogo(logo) {
  _logo = (logo && logo.url)
    ? { url: logo.url, fit: logo.fit === "cover" ? "cover" : "contain", shape: logo.shape || "rounded" }
    : null;
  _subs.forEach(fn => { try { fn(_logo); } catch {} });
  _syncFavicon(_logo);
}

// Subscribe to logo changes; returns an unsubscribe fn. Used by <NovaLogo>.
export function subscribeLogo(fn) { _subs.add(fn); return () => { _subs.delete(fn); }; }

// Swap the browser-tab favicon to the uploaded image, or restore the default.
function _syncFavicon(logo) {
  if (typeof document === "undefined") return;
  try {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "icon"); document.head.appendChild(link); }
    if (logo && logo.url) {
      link.setAttribute("type", /^data:image\/png/i.test(logo.url) ? "image/png" : "image/jpeg");
      link.setAttribute("href", logo.url);
    } else {
      link.setAttribute("type", "image/svg+xml");
      link.setAttribute("href", "/nova-icon.svg");
    }
  } catch {}
}

// Read an image File/Blob and return a downscaled data URL. PNG is preserved so
// transparency survives; the longest side is capped so the result stays well
// under Firestore's 1MB doc limit. Falls back to JPEG only if a large/photographic
// source would otherwise blow the limit. Returns a Promise<string>.
const MAX_DIM = 448;
export function processLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("no file"));
    if (!/^image\//.test(file.type || "")) return reject(new Error("not an image"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        try {
          const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
          const w = Math.max(1, Math.round(img.width * ratio));
          const h = Math.max(1, Math.round(img.height * ratio));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          let url = c.toDataURL("image/png");
          if (url.length > 900000) url = c.toDataURL("image/jpeg", 0.85);
          resolve(url);
        } catch (e) { reject(e); }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

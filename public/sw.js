/* Nova OS service worker
 * ----------------------------------------------------------------------------
 * Makes the web app installable (PWA → Add to Home Screen, and the foundation
 * for a Play Store TWA) and adds an offline shell. Deliberately minimal and
 * update-safe so it never gets in the way of the normal "push to Vercel → live"
 * workflow:
 *
 *   • Navigations            → network-first. Always tries the live server so a
 *                              new Vercel deploy loads immediately; only falls
 *                              back to the cached shell when the device is
 *                              offline.
 *   • Same-origin static GET → stale-while-revalidate. Safe because Vite emits
 *     (Vite's hashed JS/CSS)   content-hashed filenames, so a cached asset is
 *                              never stale for a *different* build.
 *   • Cross-origin (Firebase, weather APIs, fonts…) and ANY non-GET request →
 *                              passed straight through, never intercepted or
 *                              cached. This keeps Auth / Firestore untouched.
 *
 * To force-invalidate everything on the next visit, bump CACHE below.
 * Kill switch: replacing this file's body with `self.registration.unregister()`
 * cleanly removes the worker for all clients.
 */
const CACHE = "nova-os-v2";
const SHELL = "/index.html";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // never touch writes
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;  // never touch Firebase / APIs / fonts

  // The manifest must always be read fresh so install metadata changes apply
  // immediately (never serve a stale cached manifest).
  if (url.pathname === "/manifest.webmanifest") return;

  // App navigations: network-first (fresh deploys win), offline → cached shell.
  // Always resolves to a real Response, even when the network/auth fails — a
  // dangling undefined here is what threw "Failed to convert value to Response".
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        caches.open(CACHE).then((c) => c.put(SHELL, res.clone())).catch(() => {});
        return res;
      } catch {
        const cached = await caches.match(SHELL);
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate, guaranteed to yield a Response.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
        }
        return res;
      })
      .catch(() => null);
    return cached || (await network) || new Response("", { status: 504 });
  })());
});

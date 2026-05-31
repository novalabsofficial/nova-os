import React from 'react';
import ReactDOM from 'react-dom/client';
import NovaOS from './NovaOS.jsx';
import './lib/pwa.js';   // capture the install prompt as early as possible
import { initNative } from './lib/native.js';
import { initLite, isLiteMode, forceLite } from './lib/lite.js';

// Lite mode (?kiosk=1): tag the document before first paint so the GPU-heavy
// blur/drift overrides apply immediately. For low-power hosts (e.g. Nova OS as
// the Linux desktop in a VM). No-op on a normal load.
initLite();

// Native (Capacitor) one-time setup: immersive mode, back-button routing,
// nova-native document class. No-ops on the web.
initNative();

function mount() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <NovaOS />
    </React.StrictMode>
  );
}

// Nova Linux kiosk (the Tauri shell launched with NOVA_KIOSK): activate lite
// mode IN PLACE — no navigation. We used to reload once with ?kiosk=1, but on
// the production custom protocol (tauri://) that reload DROPPED the Tauri IPC
// bridge — it survives over http in dev, but breaks on tauri://, which killed
// the power controls + native detection (no Shut Down button, iframe browser).
// Instead, await the kiosk_mode invoke once (the bridge is alive on first load)
// and flip lite on before first paint, without reloading, so the bridge stays
// intact. Gated to Tauri; web/PWA/Android render immediately via the else branch.
if (!isLiteMode() && typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
  let mounted = false;
  const go = () => { if (!mounted) { mounted = true; mount(); } };
  import('./lib/system.js')
    .then(({ isKioskSession }) => isKioskSession())
    .then((kiosk) => { if (kiosk) forceLite(); })
    .catch(() => {})
    .finally(go);
  setTimeout(go, 1200);   // safety: render even if the bridge never answers
} else {
  mount();
}

// PWA — register the service worker so the app is installable (and works
// offline) on the web. Guarded so it ONLY runs on the live web build:
//   • production only        — no dev-server interference
//   • http(s) only           — skips file:// and odd protocols
//   • never inside Tauri      — the desktop shell uses a custom protocol
//   • never inside Capacitor  — the native Android app already bundles the web
//       assets locally; a service worker there intercepts the initial load and
//       can serve a blank document (the black-screen bug).
const inTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
const inCapacitor = typeof window !== 'undefined' && !!window.Capacitor &&
  ((window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || window.Capacitor.platform === 'android' || window.Capacitor.platform === 'ios');

if (inCapacitor) {
  // Recover any native install that already registered a worker / cache from a
  // previous build: tear them down so the app loads its bundled assets directly.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
  try { if (window.caches && caches.keys) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {}); } catch {}
} else if (import.meta.env.PROD && !inTauri && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import NovaOS from './NovaOS.jsx';
import './lib/pwa.js';   // capture the install prompt as early as possible

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NovaOS />
  </React.StrictMode>
);

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

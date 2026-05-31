import React from 'react';
import ReactDOM from 'react-dom/client';
import NovaOS from './NovaOS.jsx';
import './lib/pwa.js';   // capture the install prompt as early as possible
import { initNative } from './lib/native.js';
import { initLite, isLiteMode, forceLite } from './lib/lite.js';
import { log, initLogging } from './lib/log.js';

// Unified logging FIRST — capture every boot breadcrumb + uncaught error. On
// desktop these flow to the Rust log file + stdout (via the js_log bridge); on
// web they go to the console. See README "Logging & troubleshooting".
initLogging();
const hasTauri = typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
log.info('boot: main.jsx start — tauri bridge =', hasTauri, '| lite(url) =', isLiteMode());

// Lite mode (?kiosk=1): tag the document before first paint so the GPU-heavy
// blur/drift overrides apply immediately. For low-power hosts (e.g. Nova OS as
// the Linux desktop in a VM). No-op on a normal load.
initLite();

// Native (Capacitor) one-time setup: immersive mode, back-button routing,
// nova-native document class. No-ops on the web.
initNative();

function mount() {
  log.info('boot: mounting React (lite =', isLiteMode(), ')');
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <NovaOS />
    </React.StrictMode>
  );
  log.info('boot: React render dispatched');
}

// Nova Linux kiosk (the Tauri shell launched with NOVA_KIOSK): activate lite
// mode IN PLACE — no navigation. We used to reload once with ?kiosk=1, but on
// the production custom protocol (tauri://) that reload DROPPED the Tauri IPC
// bridge — it survives over http in dev, but breaks on tauri://, which killed
// the power controls + native detection (no Shut Down button, iframe browser).
// Instead, await the kiosk_mode invoke once (the bridge is alive on first load)
// and flip lite on before first paint, without reloading, so the bridge stays
// intact. Gated to Tauri; web/PWA/Android render immediately via the else branch.
if (!isLiteMode() && hasTauri) {
  let mounted = false;
  const go = () => { if (!mounted) { mounted = true; mount(); } };
  import('./lib/system.js')
    .then(({ isKioskSession }) => isKioskSession())
    .then((kiosk) => {
      log.info('boot: kiosk session =', kiosk);
      if (kiosk) { forceLite(); log.info('boot: lite mode forced on (no reload)'); }
    })
    .catch((e) => { log.warn('boot: kiosk check failed —', e); })
    .finally(go);
  setTimeout(() => { if (!mounted) log.warn('boot: kiosk check slow (>1.2s) — mounting anyway'); go(); }, 1200);
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

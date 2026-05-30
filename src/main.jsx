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
//   • production only     — no dev-server interference
//   • http(s) only        — skips file:// and odd protocols
//   • never inside Tauri  — the desktop shell uses a custom protocol that
//                           must not be intercepted
const inTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
if (import.meta.env.PROD && !inTauri && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

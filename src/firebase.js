import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';

// Firebase web config. The env vars win when present (Vercel sets them), and
// these literals are the fallback so builds WITHOUT env vars still work — e.g.
// the GitHub Actions Android APK build and a fresh clone. (Without a fallback,
// the APK got an undefined apiKey -> auth/invalid-api-key -> blank screen.)
//
// This is safe: a Firebase *web* apiKey is not a secret — it only identifies the
// project to Google and already ships in plain text in the web bundle. Access is
// enforced by Firestore Security Rules and Auth settings, not key secrecy.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD9xXEKlq-K3pyZJr-7hzY80sNcAmiclBA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nova-58d75.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nova-58d75",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nova-58d75.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "708689276281",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:708689276281:web:950cbe57cd496ed57213a8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Database and Authentication so the rest of your app can use them
export const firestoreDb = getFirestore(app);

// v11.0.1 — Auth is initialized WITHOUT a popupRedirectResolver. This is the fix
// for the Tauri *Linux* (WebKitGTK) boot crash:
//
//   getAuth(app) — what we used before — automatically wires
//   browserPopupRedirectResolver, which lazily loads Google's gapi auth-helper
//   iframe from apis.google.com. Under the Tauri Linux origin "tauri://localhost",
//   WebKit's CORS blocks that cross-origin load (apis.google.com 301-redirects to
//   developers.google.com, which the Access-Control policy refuses) — so
//   gapi.iframes never loads and the SDK throws, uncaught:
//     "TypeError: undefined is not an object (evaluating 'gapi.iframes.getContext')"
//   That crashed the Linux desktop build at boot. It worked everywhere else
//   (Windows/WebView2, all browsers) because those origins are http(s), which gapi
//   tolerates. Nova uses ONLY email/password auth — no Google OAuth popup/redirect
//   — so the resolver is unused dead weight. Omitting it means gapi is NEVER
//   loaded, on any platform, killing the crash at the source.
//
// Persistence is an ordered fallback: IndexedDB -> localStorage -> in-memory, so
// auth still initializes even on a WebView that restricts storage for a custom
// URL scheme.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
});

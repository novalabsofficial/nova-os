import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
export const auth = getAuth(app);

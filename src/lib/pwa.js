// PWA install helper.
//
// Chromium (Android Chrome / Edge) fires a `beforeinstallprompt` event when the
// app is installable. We capture and stash it so the UI can show its own
// "Install" button and trigger the prompt on demand (Chrome no longer shows a
// reliable on-page prompt by itself). iOS Safari never fires this event — it's
// always a manual Share → Add to Home Screen — so we expose isIOS() to show a
// hint instead.

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch {} });

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();          // suppress Chrome's default mini-infobar
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; notify(); });
}

// Already running as an installed app?
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || window.navigator.standalone === true;   // iOS Safari flag
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);  // iPadOS poses as Mac
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

// Are we running inside the Capacitor native Android app?
export function isNativeApp() {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch { return false; }
}

// The signed APK published by the android-release GitHub Action. "latest"
// always resolves to the newest release's asset, so this link never goes stale.
export const ANDROID_APK_URL = "https://github.com/novalabsofficial/nova-os/releases/latest/download/nova-os.apk";

// Is a one-tap install prompt available right now? (Android/Chromium only)
export function canPromptInstall() { return !!deferredPrompt; }

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch {}
  deferredPrompt = null;
  notify();
  return true;
}

// Subscribe to availability changes; returns an unsubscribe fn.
export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

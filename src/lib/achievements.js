// Achievements — v11.0 Phase D. A small catalog of unlockable badges plus a tiny
// pub/sub so any app can award one without importing NovaOS. Unlocked state lives
// in the user's profile data (data.achievements = { id: unlockedAt }), so it syncs
// across devices and rides along in profile backups.
//
// Usage from an app:  import { award } from "../lib/achievements";  award("artist");
// NovaOS registers the handler (setAwardHandler) that actually persists + toasts.

export const ACHIEVEMENTS = [
  { id: "welcome",       title: "Welcome to Nova",        desc: "Sign in to Nova OS.",                 icon: "👋", cat: "Getting started" },
  { id: "first_app",     title: "Lift-off",               desc: "Open your first app.",                icon: "🚀", cat: "Getting started" },
  { id: "decorator",     title: "Interior decorator",     desc: "Change your wallpaper.",              icon: "🖼️", cat: "Personalization" },
  { id: "colorful",      title: "Make it yours",          desc: "Pick a custom accent color.",         icon: "🎨", cat: "Personalization" },
  { id: "glassmorphic",  title: "Through the glass",      desc: "Turn on Liquid Glass.",               icon: "🫧", cat: "Personalization" },
  { id: "day_night",     title: "Day & night",            desc: "Switch between light and dark.",       icon: "🌗", cat: "Personalization" },
  { id: "explorer",      title: "Explorer",               desc: "Open 10 different apps.",             icon: "🧭", cat: "Explorer" },
  { id: "power_user",    title: "Power user",             desc: "Open 25 different apps.",             icon: "⚡", cat: "Explorer" },
  { id: "completionist", title: "Completionist",          desc: "Open every built-in app.",            icon: "🏆", cat: "Explorer" },
  { id: "commander",     title: "At your command",        desc: "Use the AI command bar (Ctrl/⌘+J).",  icon: "🅙", cat: "Power user" },
  { id: "seeker",        title: "Seek & find",            desc: "Search with Spotlight (Ctrl/⌘+K).",   icon: "🔍", cat: "Power user" },
  { id: "juggler",       title: "Juggler",                desc: "Use a second virtual desktop.",       icon: "🗂️", cat: "Power user" },
  { id: "big_screen",    title: "Big screen",             desc: "Go fullscreen.",                      icon: "🖥️", cat: "Power user" },
  { id: "artist",        title: "Artist",                 desc: "Save a drawing in Paint.",            icon: "🖌️", cat: "Creative" },
  { id: "town_crier",    title: "Town crier",             desc: "Post on the Forum.",                  icon: "📣", cat: "Creative" },
  { id: "high_scorer",   title: "High scorer",            desc: "Set a personal best in a game.",      icon: "🎮", cat: "Play" },
  { id: "shopkeeper",    title: "Open for business",      desc: "Ring up a sale in Point of Sale.",    icon: "🧾", cat: "Secret", secret: true },
  { id: "night_owl",     title: "Night owl",              desc: "Use Nova OS after midnight.",         icon: "🦉", cat: "Secret", secret: true },
];

export const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;
export const ACH_CATEGORIES = [...new Set(ACHIEVEMENTS.map(a => a.cat))];

let _handler = null;
export function setAwardHandler(fn) { _handler = fn; }
export function award(id) { try { if (_handler) _handler(id); } catch (e) { /* no-op */ } }

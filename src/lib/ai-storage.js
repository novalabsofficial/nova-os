// LocalStorage helpers for the Nova AI BYOK system. The API key, model
// preferences, and conversation history all live on the user's device — they
// never touch Firestore. That's the entire BYOK privacy promise.
//
// Both NovaAiApp (the dedicated chat app) and the cross-app AiAssist component
// import from here so they share configuration. A change in Nova AI Settings
// instantly takes effect in every app that uses AiAssist.

export const AI_LS_KEYS   = "nova-ai-keys";    // {claude, openai}
export const AI_LS_CONFIG = "nova-ai-config";  // {provider, model:{claude,openai}}
export const AI_LS_CHATS  = "nova-ai-chats";   // [{id,title,provider,model,messages,createdAt,updatedAt}]

export function aiLoad(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function aiSave(key, value) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

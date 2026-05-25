// Nova AI provider abstraction.
//
// Claude (Anthropic), ChatGPT (OpenAI), and Gemini (Google) each speak a
// slightly different chat-completion shape, but all three support
// browser-direct API calls with the user's own key. The component layer
// just hands us (provider, model, apiKey, messages) and we return a request
// spec tailored to whichever provider is selected.
//
// All API calls go *directly* from the user's browser to the provider — there
// is no Nova-side proxy. The user's API key never touches Firebase or any
// other backend. That's the entire BYOK promise.
//
// Note: Anthropic flags browser-side calls as "dangerous" because embedding
// a *publisher's* key in a public page would leak it. Here the key is the
// *user's own*, entered locally, so the leak surface is just their own
// devtools — acceptable for BYOK.

export const PROVIDERS = {
  claude: {
    label: "Claude",
    url: "https://api.anthropic.com/v1/messages",
    keyHint: "starts with sk-ant-",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-4-5",
    presetModels: [
      "claude-sonnet-4-5",
      "claude-opus-4-1",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-20241022",
    ],
  },
  openai: {
    label: "ChatGPT",
    url: "https://api.openai.com/v1/chat/completions",
    keyHint: "starts with sk-",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o",
    presetModels: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
    ],
  },
  // v7.6 — Google Gemini via the public Generative Language API. The
  // endpoint embeds the model in the URL path. We use the streaming variant
  // with `alt=sse` so the response format matches Claude/OpenAI's
  // line-delimited "data: {...}" shape — that way the same SSE reader works.
  gemini: {
    label: "Gemini",
    // URL template — model is interpolated by buildRequest.
    url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse",
    keyHint: "starts with AIza",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.5-flash",
    presetModels: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
    ],
  },
};

/**
 * Build a complete request for the given provider. Returns
 *   { url, headers, body }   — pass to fetch() with method "POST".
 *
 * @param {"claude"|"openai"} provider
 * @param {string} model
 * @param {string} apiKey
 * @param {{role:"user"|"assistant"|"system", content:string}[]} messages
 * @param {object} [opts]
 * @param {boolean} [opts.stream=false]
 * @param {number}  [opts.maxTokens=2048]
 * @param {string}  [opts.system] system prompt (Claude-only field; for OpenAI
 *                                  it's prepended as a "system" message instead)
 */
export function buildRequest(provider, model, apiKey, messages, opts = {}) {
  const stream = !!opts.stream;
  const maxTokens = opts.maxTokens ?? 2048;

  if (provider === "claude") {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required for browser-direct calls — see module header.
      "anthropic-dangerous-direct-browser-access": "true",
    };
    const body = {
      model,
      max_tokens: maxTokens,
      messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
      stream,
    };
    if (opts.system) body.system = opts.system;
    return { url: PROVIDERS.claude.url, headers, body };
  }

  if (provider === "openai") {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    };
    // OpenAI takes system as a regular message in the array.
    const msgs = opts.system
      ? [{ role: "system", content: opts.system }, ...messages]
      : messages;
    const body = {
      model,
      messages: msgs.map(m => ({ role: m.role, content: m.content })),
      stream,
    };
    return { url: PROVIDERS.openai.url, headers, body };
  }

  if (provider === "gemini") {
    // Gemini uses a different schema: "contents" array, with each message
    // having a "role" of "user" | "model" (not "assistant") and a "parts"
    // array of {text} objects. System instructions go in a separate
    // "systemInstruction" field at the top level.
    const url = PROVIDERS.gemini.url.replace("{model}", encodeURIComponent(model));
    const headers = {
      "Content-Type": "application/json",
      // x-goog-api-key keeps the key out of the URL (where it would otherwise
      // appear in `?key=...` and end up in server access logs / referrers).
      "x-goog-api-key": apiKey,
    };
    const body = {
      contents: messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
    };
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }
    return { url, headers, body };
  }

  throw new Error("unknown provider: " + provider);
}

/**
 * Parse a single SSE line and return the next text delta to append, or null
 * if the line is metadata / a heartbeat / end-of-stream.
 *
 * Lines that don't begin with "data: " (event lines, blank lines) yield null.
 *
 * @param {"claude"|"openai"} provider
 * @param {string} line  one line of the streaming response
 * @returns {string|null}
 */
export function parseStreamLine(provider, line) {
  if (typeof line !== "string") return null;
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;

  let json;
  try { json = JSON.parse(payload); } catch { return null; }

  if (provider === "claude") {
    // Claude streams a "content_block_delta" with delta.text for each chunk
    if (json.type === "content_block_delta" && json.delta && json.delta.type === "text_delta") {
      return json.delta.text || "";
    }
    return null;
  }
  if (provider === "openai") {
    // OpenAI puts the next chunk in choices[0].delta.content
    const choice = json.choices && json.choices[0];
    if (choice && choice.delta && typeof choice.delta.content === "string") {
      return choice.delta.content;
    }
    return null;
  }
  if (provider === "gemini") {
    // Gemini streams candidates[0].content.parts[*].text. Each SSE event
    // may contain multiple text parts; we concatenate them so the caller
    // gets a single coherent delta per event.
    const cand = json.candidates && json.candidates[0];
    const parts = cand?.content?.parts;
    if (Array.isArray(parts)) {
      const text = parts.map(p => (typeof p.text === "string" ? p.text : "")).join("");
      return text || null;
    }
    return null;
  }
  return null;
}

/**
 * Async generator that streams text deltas from the provider as they arrive.
 * Usage:
 *   for await (const chunk of streamResponse(...)) { append(chunk); }
 *
 * Throws an Error with the response status code + body on non-2xx responses.
 */
export async function* streamResponse(provider, model, apiKey, messages, opts = {}) {
  const req = buildRequest(provider, model, apiKey, messages, { ...opts, stream: true });
  const res = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("API " + res.status + ": " + (text || res.statusText));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Split on newline. Last fragment is kept in buffer for next iteration
    // (it might be a partial line).
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const delta = parseStreamLine(provider, line);
      if (delta) yield delta;
    }
  }
  // Flush whatever's left in the buffer
  if (buffer) {
    const delta = parseStreamLine(provider, buffer);
    if (delta) yield delta;
  }
}

/**
 * Convenience: a quick title for a conversation derived from the first user
 * message. Truncates and tidies whitespace.
 */
export function deriveTitle(text, maxLen = 40) {
  const s = (text || "").trim().replace(/\s+/g, " ");
  if (s.length <= maxLen) return s || "New chat";
  return s.slice(0, maxLen).replace(/\s\S*$/, "") + "…";
}

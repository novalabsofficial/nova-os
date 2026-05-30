// v10.0 Supernova — AI command bar planning layer.
//
// Rather than wire provider-specific function-calling (Claude `tools`,
// OpenAI `tools`, Gemini `functionDeclarations` each differ), we keep it
// provider-agnostic: we ask the model to reply with ONLY a JSON action
// plan and parse it client-side. This rides the SAME `streamResponse`
// text path the rest of Nova AI uses, so it works identically across
// Claude / ChatGPT / Gemini with zero extra plumbing.
//
// The executor (in NovaOS) maps each step's `tool` to a real OS action.
// Every tool here is safe + reversible (open an app, add a note/task,
// change a setting) so v1 needs no destructive-action confirmation.

// Tool catalogue shown to the model. Keep names + args terse and stable.
export const COMMAND_TOOLS = [
  { name: "openApp",      desc: "Open one of Nova OS's apps.",                  args: 'appId' },
  { name: "createNote",   desc: "Create a note in the Notes app.",             args: 'title, body (optional)' },
  { name: "createTask",   desc: "Add a to-do item to the Tasks app.",          args: 'text' },
  { name: "setWallpaper", desc: "Change the desktop wallpaper.",               args: 'id' },
  { name: "setAccent",    desc: "Change the accent color.",                    args: 'hex (#rrggbb)' },
  { name: "setVolume",    desc: "Set the system sound volume.",                args: 'level (0-100)' },
  { name: "answer",       desc: "No OS action — just reply to a question.",    args: '(none)' },
];

/**
 * Build the instruction prompt. We inject the live valid ids/colors so the
 * model can't invent an app or wallpaper that doesn't exist.
 */
export function buildCommandPrompt({ appIds = [], appLabels = {}, wallpaperIds = [], accents = [] }) {
  const toolLines = COMMAND_TOOLS.map(t => `  - ${t.name}(${t.args}) — ${t.desc}`).join("\n");
  const appList = appIds.map(id => appLabels[id] ? `${id} (${appLabels[id]})` : id).join(", ");
  return [
    "You are the Nova OS command bar. The user types a natural-language request; you turn it into OS actions.",
    "",
    "Reply with ONLY a JSON object — no markdown fences, no text before or after it:",
    '{ "reply": "<one short, friendly sentence describing what you did>", "steps": [ { "tool": "<name>", "args": { ... } } ] }',
    "",
    "Available tools:",
    toolLines,
    "",
    "Rules:",
    "- Use the FEWEST steps needed. Multiple steps are allowed (e.g. create a note AND open Notes).",
    "- If the request is just a question or small talk, return \"steps\": [] and put the answer in \"reply\".",
    "- Never invent tools, app ids, or wallpaper ids that aren't listed.",
    "- If you can't fulfill the request with the available tools, return \"steps\": [] and say so kindly in \"reply\".",
    `- Valid appId values: ${appList}`,
    `- Valid wallpaper id values: ${wallpaperIds.join(", ")}`,
    `- When a color is named, prefer one of these accent presets: ${accents.join(", ")} — otherwise use a sensible #rrggbb hex.`,
    "- volume level is an integer 0-100.",
    "",
    "Output the JSON object only.",
  ].join("\n");
}

/**
 * Parse the model's response into { reply, steps } — tolerant of code
 * fences and stray prose. Returns { error } if no valid JSON object is
 * found or the shape is wrong.
 */
export function parseCommandPlan(text) {
  if (!text || typeof text !== "string") return { error: "Empty response" };
  let s = text.trim();
  // strip ```json … ``` fences if present
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // extract the outermost {...}
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return { error: "No JSON found", raw: text };
  let obj;
  try { obj = JSON.parse(s.slice(start, end + 1)); }
  catch { return { error: "Could not parse the plan", raw: text }; }
  const reply = typeof obj.reply === "string" ? obj.reply : "";
  const steps = Array.isArray(obj.steps)
    ? obj.steps.filter(st => st && typeof st.tool === "string").map(st => ({ tool: st.tool, args: st.args || {} }))
    : [];
  return { reply, steps };
}

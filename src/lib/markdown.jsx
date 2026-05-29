// v9.5 — Minimal Markdown renderer for Notes preview mode.
//
// We avoid `marked` / `markdown-it` because they're a ~50 KB dependency
// and we only need the basics: headings, bold/italic, inline code, code
// blocks, lists (bullet + numbered), links, blockquotes, hr.
//
// Returns an array of React-rendered nodes — the caller wraps them in
// whatever container they want. Stays under 200 lines, no XSS risk
// because everything goes through React's auto-escape (no
// dangerouslySetInnerHTML anywhere).

import { FFM } from "../ui/styles.js";

// ── inline pass ─────────────────────────────────────────────────────────
// Walk a string left-to-right, peeling off the longest inline token at
// each position. Tokens (in priority order):
//   `code`   →  <code>
//   **bold** →  <strong>
//   *italic* / _italic_ → <em>
//   [text](url) → <a>
// Anything left over is plain text.

function renderInline(text, keyBase = "i") {
  const out = [];
  let i = 0, plain = "", k = 0;
  function flushPlain() {
    if (plain) { out.push(plain); plain = ""; }
  }
  while (i < text.length) {
    const rest = text.slice(i);

    // Inline code: `...`
    let m = rest.match(/^`([^`\n]+)`/);
    if (m) {
      flushPlain();
      out.push(<code key={keyBase + "-" + k++} style={{ fontFamily: FFM, fontSize: "0.92em", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 4, padding: "1px 5px", color: "var(--nv-text-strong)" }}>{m[1]}</code>);
      i += m[0].length; continue;
    }
    // Link [text](url)
    m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    if (m) {
      flushPlain();
      out.push(<a key={keyBase + "-" + k++} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--nv-text-strong)", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.4)" }}>{m[1]}</a>);
      i += m[0].length; continue;
    }
    // Bold **...**
    m = rest.match(/^\*\*([^*\n]+)\*\*/);
    if (m) {
      flushPlain();
      out.push(<strong key={keyBase + "-" + k++} style={{ color: "var(--nv-text-strong)", fontWeight: 700 }}>{renderInline(m[1], keyBase + "-" + k)}</strong>);
      i += m[0].length; continue;
    }
    // Italic *...* or _..._  (avoid bold-star false-match by requiring single *)
    m = rest.match(/^\*([^*\n]+)\*/) || rest.match(/^_([^_\n]+)_/);
    if (m) {
      flushPlain();
      out.push(<em key={keyBase + "-" + k++} style={{ fontStyle: "italic" }}>{renderInline(m[1], keyBase + "-" + k)}</em>);
      i += m[0].length; continue;
    }
    // Plain character
    plain += text[i]; i++;
  }
  flushPlain();
  return out;
}

// ── block pass ──────────────────────────────────────────────────────────
// Split into lines, group consecutive list lines into <ul>/<ol>, fenced
// code blocks into <pre>, blockquotes into <blockquote>, headings/hr/p
// otherwise.

export function renderMarkdown(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0, key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```...```
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // consume closing fence
      out.push(
        <pre key={key++} style={{ fontFamily: FFM, fontSize: 12.5, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 8, padding: "10px 14px", overflowX: "auto", margin: "10px 0", lineHeight: 1.6 }}>
          {buf.join("\n")}
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      out.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid var(--nv-border)", margin: "14px 0" }}/>);
      i++; continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = [0, 24, 20, 17, 15, 14, 13];   // index by level
      const Tag = "h" + Math.min(level, 6);
      out.push(
        <Tag key={key++} style={{
          margin: level === 1 ? "16px 0 8px" : "12px 0 6px",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: level <= 2 ? 700 : 600,
          fontSize: sizes[Math.min(level, 6)],
          color: "var(--nv-text-strong)",
          lineHeight: 1.3,
        }}>
          {renderInline(hMatch[2], "h" + key)}
        </Tag>
      );
      i++; continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote key={key++} style={{
          margin: "10px 0", padding: "6px 14px",
          borderLeft: "3px solid var(--nv-border-strong)",
          background: "rgba(255,255,255,0.02)",
          color: "var(--nv-text)", fontStyle: "italic",
        }}>
          {renderInline(buf.join(" "), "bq" + key)}
        </blockquote>
      );
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} style={{ margin: "8px 0", paddingLeft: 22, lineHeight: 1.6 }}>
          {items.map((it, idx) => <li key={idx} style={{ color: "var(--nv-text)" }}>{renderInline(it, "li" + key + "-" + idx)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key++} style={{ margin: "8px 0", paddingLeft: 22, lineHeight: 1.6 }}>
          {items.map((it, idx) => <li key={idx} style={{ color: "var(--nv-text)" }}>{renderInline(it, "ol" + key + "-" + idx)}</li>)}
        </ol>
      );
      continue;
    }

    // Blank line — paragraph separator
    if (line.trim() === "") { i++; continue; }

    // Paragraph: consume until blank line / structural token.
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|```|---+\s*$|>\s|[-*]\s|\d+\.\s)/.test(lines[i])) {
      paraLines.push(lines[i]); i++;
    }
    out.push(
      <p key={key++} style={{ margin: "6px 0", lineHeight: 1.65, color: "var(--nv-text)" }}>
        {renderInline(paraLines.join(" "), "p" + key)}
      </p>
    );
  }
  return out;
}

// ── Toolbar helper: wrap selection or insert template ───────────────────
// Returns { value, selectionStart, selectionEnd } so the caller can
// imperatively update the textarea state + cursor selection in one go.
export function applyMarkdownAction(action, value, selStart, selEnd) {
  const before = value.slice(0, selStart);
  const sel = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);
  const isSelEmpty = selStart === selEnd;

  function wrap(prefix, suffix, placeholder) {
    const text = sel || placeholder;
    const nv = before + prefix + text + suffix + after;
    const s = before.length + prefix.length;
    const e = s + text.length;
    return { value: nv, selectionStart: s, selectionEnd: e };
  }
  function prefixLines(linePrefix, placeholder) {
    const text = sel || placeholder;
    const lines = text.split("\n").map(l => linePrefix + l);
    const replaced = lines.join("\n");
    const nv = before + replaced + after;
    const s = before.length;
    const e = s + replaced.length;
    return { value: nv, selectionStart: s, selectionEnd: e };
  }

  switch (action) {
    case "bold":      return wrap("**", "**", "bold text");
    case "italic":    return wrap("*", "*", "italic text");
    case "code":      return wrap("`", "`", "code");
    case "h1":        return prefixLines("# ", "Heading 1");
    case "h2":        return prefixLines("## ", "Heading 2");
    case "h3":        return prefixLines("### ", "Heading 3");
    case "bullet":    return prefixLines("- ", "list item");
    case "numbered":  return prefixLines("1. ", "list item");
    case "quote":     return prefixLines("> ", "quoted text");
    case "link": {
      const linkText = sel || "link text";
      const inserted = "[" + linkText + "](url)";
      const nv = before + inserted + after;
      // Drop the cursor on `url` so the user can immediately paste.
      const urlStart = before.length + linkText.length + 3;   // "[" + text + "]("
      return { value: nv, selectionStart: urlStart, selectionEnd: urlStart + 3 };
    }
    case "hr": {
      // Insert on its own line; if mid-line, push to a new line first.
      const needsLeading = !before.endsWith("\n") && before.length > 0;
      const insertion = (needsLeading ? "\n" : "") + "---\n";
      const nv = before + insertion + after;
      const cur = before.length + insertion.length;
      return { value: nv, selectionStart: cur, selectionEnd: cur };
    }
    default:
      return { value, selectionStart: selStart, selectionEnd: selEnd };
  }
}

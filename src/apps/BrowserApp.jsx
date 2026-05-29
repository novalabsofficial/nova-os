// v9.5 — Browser refreshed to match the v9.5 OS look. Same plumbing as
// v8.x (iframe rendering, history stack, DDG + Wikipedia for Nova
// Search) but with the chrome rebuilt:
//
//   • New nav strip with the v9.5 BrowserNav (pill URL bar + theme tokens).
//   • Horizontal bookmarks rail below the nav, integrated into the chrome
//     instead of floating in the body.
//   • Refreshed home page — large "Nova Search" hero with the input
//     centered, quick-pick site tiles, and a "Recent" history list.
//   • Search results page got bigger result cards + cleaner section
//     headers.
//   • The not-embeddable card got a friendlier copy + a "Search instead"
//     escape hatch.
//
// CRITICAL: do NOT extract layouts into sub-components defined inside
// BrowserApp — see the v4.3 note below. The iframe remounts on every
// parent re-render if you do.

import { useState, useEffect } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr, isUrl } from "../lib/format.js";
import { BOOKMARKS } from "../ui/constants.js";
import { BrowserNav } from "../ui/BrowserNav.jsx";
import { rewriteForIframe, isLikelyUnframable } from "../lib/browser.js";
import { openExternalUrl } from "../lib/openUrl.js";

// Curated "quick-pick" tiles on the home page. Mix of safe-embedding
// reference sites + the existing bookmarks for continuity.
const QUICK_TILES = [
  { label: "Wikipedia",   url: "https://en.m.wikipedia.org",      icon: "📚", desc: "Encyclopedia" },
  { label: "Hacker News", url: "https://news.ycombinator.com",    icon: "🗞", desc: "Tech news" },
  { label: "MDN Web Docs",url: "https://developer.mozilla.org",   icon: "💻", desc: "Web dev reference" },
  { label: "archive.org", url: "https://archive.org",             icon: "🏛", desc: "Internet archive" },
  { label: "itch.io",     url: "https://itch.io",                 icon: "🎮", desc: "Indie games" },
  { label: "YouTube",     url: "https://www.youtube.com",         icon: "▶️", desc: "Auto-embed videos" },
];

export function BrowserApp({ AC }) {
  const [bar, setBar] = useState("");
  const [view, setView] = useState("home");
  const [results, setResults] = useState(null);
  const [frameUrl, setFrameUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  const [framing, setFraming] = useState(false);

  useEffect(() => {
    if (view === "browse" && frameUrl && !isLikelyUnframable(frameUrl)) setFraming(true);
  }, [frameUrl, reloadKey, view]);

  function browse(url) {
    const full = rewriteForIframe(url);
    if (!full) return;
    const nh = [...hist.slice(0, hIdx + 1), full];
    setHist(nh); setHIdx(nh.length - 1);
    setFrameUrl(full); setBar(full); setView("browse");
  }
  async function novaSearch(q) {
    setLoading(true); setView("results"); setResults(null);
    try {
      const [d, w] = await Promise.allSettled([
        fetch("https://api.duckduckgo.com/?q=" + encodeURIComponent(q) + "&format=json&no_html=1&skip_disambig=1").then(r => r.json()),
        fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(q) + "&format=json&origin=*&srlimit=7").then(r => r.json()),
      ]);
      setResults({ q, ddg: d.status === "fulfilled" ? d.value : null, wiki: w.status === "fulfilled" ? w.value : null });
    } catch {
      setResults({ q, ddg: null, wiki: null });
    }
    setLoading(false);
  }
  function go(i) { const q = (i || bar).trim(); if (!q) return; if (isUrl(q)) browse(q); else novaSearch(q); }
  function back() { if (hIdx > 0) { const i = hIdx - 1; setHIdx(i); setFrameUrl(hist[i]); setBar(hist[i]); setView("browse"); } }
  function fwd()  { if (hIdx < hist.length - 1) { const i = hIdx + 1; setHIdx(i); setFrameUrl(hist[i]); setBar(hist[i]); setView("browse"); } }
  function refresh() {
    if (view === "browse" && frameUrl) setReloadKey(k => k + 1);
    else if (view === "results" && results?.q) novaSearch(results.q);
  }
  function homeBack() {
    setBar(""); setView("home"); setFrameUrl(""); setResults(null);
  }

  const canRefresh = (view === "browse" && !!frameUrl) || (view === "results" && !!results?.q);
  const navProps = { bar, setBar, onGo: () => go(), onBack: back, onFwd: fwd, onRefresh: refresh, canBack: hIdx > 0, canFwd: hIdx < hist.length - 1, canRefresh, AC, view };

  // Horizontal bookmarks rail, sits just below the nav strip. Compact pills.
  const bookmarksRail = (
    <div style={{
      display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap",
      padding: "6px 12px", borderBottom: "1px solid var(--nv-border)",
      flexShrink: 0, overflowX: "auto", scrollbarWidth: "none",
    }}>
      <button
        onClick={homeBack}
        title="Home"
        style={{
          padding: "4px 10px", borderRadius: 6, cursor: "pointer",
          background: view === "home" ? fill(AC) : "transparent",
          border: "1px solid " + (view === "home" ? bdr(AC) : "transparent"),
          color: view === "home" ? AC : "var(--nv-text-dim)",
          fontFamily: FFB, fontWeight: 600, fontSize: 11, flexShrink: 0,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >🏠 Home</button>
      <div style={{ width: 1, height: 14, background: "var(--nv-border)", margin: "0 4px", flexShrink: 0 }}/>
      {BOOKMARKS.map(b => (
        <button
          key={b.url}
          onClick={() => browse(b.url)}
          title={b.url}
          style={{
            padding: "4px 10px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid transparent",
            color: "var(--nv-text-dim)",
            fontFamily: FF, fontWeight: 500, fontSize: 11, flexShrink: 0,
            transition: "background 0.12s, color 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--nv-hover)"; e.currentTarget.style.color = "var(--nv-text)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--nv-text-dim)"; }}
        >{b.label}</button>
      ))}
      <div style={{ flex: 1 }}/>
      <button
        onClick={() => openExternalUrl("https://www.google.com")}
        title="Open Google in default browser"
        style={extLinkBtn()}
      >Google ↗</button>
      <button
        onClick={() => openExternalUrl("https://www.bing.com")}
        title="Open Bing in default browser"
        style={extLinkBtn()}
      >Bing ↗</button>
    </div>
  );

  // ── Home view ───────────────────────────────────────────────────────
  if (view === "home") {
    return (
      <div style={{ width: "100%", height: "100%", fontFamily: FF, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <BrowserNav {...navProps}/>
        {bookmarksRail}

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <div style={{
            // Center column with a sensible cap so the hero doesn't sprawl
            // when the window is huge.
            maxWidth: 720, margin: "0 auto",
            padding: "40px 28px 28px",
            display: "flex", flexDirection: "column", gap: 28,
          }}>

            {/* Hero */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: `linear-gradient(135deg, ${fill(AC)}, rgba(255,255,255,0.05))`,
                border: "1px solid " + bdr(AC),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32,
                filter: `drop-shadow(0 0 22px ${AC}55)`,
              }}>🌐</div>
              <div>
                <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 26, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Nova Browser</div>
                <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", marginTop: 6, lineHeight: 1.6, maxWidth: 440, margin: "6px auto 0" }}>
                  Search with Nova Search (DuckDuckGo + Wikipedia) or paste any URL.
                  YouTube watch links auto-embed so videos play right here.
                </div>
              </div>

              {/* Big search box */}
              <div style={{
                width: "100%", maxWidth: 540, marginTop: 6,
                display: "flex", gap: 8,
              }}>
                <div style={{
                  flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10,
                  padding: "0 18px", height: 46,
                  background: "var(--nv-input-bg)",
                  border: "1px solid var(--nv-border-strong)",
                  borderRadius: 23,
                  transition: "border-color 0.18s",
                }}>
                  <span style={{ fontSize: 15, color: "var(--nv-text-dim)", lineHeight: 1 }}>🔍</span>
                  <input
                    autoFocus
                    value={bar}
                    onChange={e => setBar(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && go()}
                    placeholder="Search Nova Search or enter a URL…"
                    style={{
                      flex: 1, minWidth: 0,
                      background: "transparent", border: "none",
                      color: "var(--nv-text-strong)",
                      fontFamily: FF, fontSize: 14,
                      outline: "none", padding: 0,
                    }}
                  />
                </div>
                <button onClick={() => go()} disabled={!bar.trim()} style={{
                  padding: "0 22px", height: 46,
                  background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 23,
                  cursor: bar.trim() ? "pointer" : "default",
                  fontFamily: FFB, fontWeight: 700, fontSize: 13.5, color: AC,
                  opacity: bar.trim() ? 1 : 0.4, flexShrink: 0,
                }}>Search</button>
              </div>
            </div>

            {/* Quick-pick tiles */}
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>Quick picks</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {QUICK_TILES.map(t => (
                  <button
                    key={t.url}
                    onClick={() => browse(t.url)}
                    className="fr"
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 11, cursor: "pointer",
                      background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
                      textAlign: "left", fontFamily: FF, color: "var(--nv-text)",
                      transition: "background 0.12s, border-color 0.12s, transform 0.12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--nv-border-strong)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--nv-border)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: "var(--nv-text-strong)" }}>{t.label}</div>
                      <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2 }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent — session-only, derived from `hist` */}
            {hist.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontFamily: FFB, fontWeight: 700, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase" }}>Recent</span>
                  <button onClick={() => { setHist([]); setHIdx(-1); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--nv-text-dim)", fontFamily: FFM, fontSize: 10.5 }}>Clear</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[...hist].reverse().slice(0, 8).map((u, i) => (
                    <button
                      key={i + "-" + u}
                      onClick={() => browse(u)}
                      className="fr"
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 8,
                        background: "transparent", border: "1px solid transparent",
                        cursor: "pointer", textAlign: "left", fontFamily: FF,
                        transition: "background 0.12s",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--nv-text-dim)" }}>🕘</span>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: FFM, fontSize: 11.5, color: "var(--nv-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Browse view (iframe) ────────────────────────────────────────────
  if (view === "browse") {
    const blocked = isLikelyUnframable(frameUrl);
    return (
      <div style={{ width: "100%", height: "100%", fontFamily: FF, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <BrowserNav {...navProps}/>
        {bookmarksRail}
        {blocked ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "30px 20px", textAlign: "center", minHeight: 0 }}>
            <div style={{ fontSize: 52, opacity: 0.55 }}>🚫</div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)" }}>This site can't be embedded</div>
            <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", maxWidth: 460, lineHeight: 1.7 }}>
              <span style={{ color: "var(--nv-text)", fontFamily: FFM, fontSize: 11.5, wordBreak: "break-all" }}>{frameUrl}</span><br/>
              blocks framing via X-Frame-Options or CSP — a security feature enforced by your browser, not a Nova OS limitation.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={homeBack} style={secondaryBtn()}>← Home</button>
              <button onClick={() => { const q = frameUrl.replace(/^https?:\/\//, "").split("/")[0]; setBar(q); novaSearch(q); }} style={secondaryBtn()}>🔍 Search instead</button>
              <button onClick={() => openExternalUrl(frameUrl)} style={primaryBtn(AC)}>Open in default browser ↗</button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#fff" }}>
            {framing && (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "rgba(0,0,0,0.05)", zIndex: 2 }}>
                <div style={{ height: "100%", width: "40%", background: AC, animation: "pulse 1.2s ease-in-out infinite", boxShadow: "0 0 8px " + AC + "88" }}/>
              </div>
            )}
            <iframe
              key={frameUrl + ":" + reloadKey}
              src={frameUrl}
              title="browser"
              onLoad={() => setFraming(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: "block" }}/>
          </div>
        )}
      </div>
    );
  }

  // ── Results view (Nova Search) ──────────────────────────────────────
  const ddg = results?.ddg;
  const wiki = results?.wiki;
  const ddgT = (ddg?.RelatedTopics || []).filter(t => t.FirstURL && t.Text).slice(0, 7);
  const wikiH = wiki?.query?.search || [];
  return (
    <div style={{ width: "100%", height: "100%", fontFamily: FF, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <BrowserNav {...navProps}/>
      {bookmarksRail}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexDirection: "column", minHeight: 0 }}>
          <div style={{ width: 28, height: 28, border: "3px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
          <div style={{ fontSize: 12, color: "var(--nv-text-dim)", fontFamily: FFM }}>Searching…</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 30px" }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
              Results for "<span style={{ color: "var(--nv-text-strong)" }}>{results?.q}</span>"
            </div>

            {ddg?.AbstractText && (
              <div style={{
                padding: "16px 18px", marginBottom: 16,
                background: fill(AC),
                border: "1px solid " + bdr(AC),
                borderRadius: 11,
              }}>
                <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: AC, marginBottom: 6 }}>{ddg.Heading}</div>
                <div style={{ fontSize: 12.5, color: "var(--nv-text-strong)", lineHeight: 1.7 }}>{ddg.AbstractText}</div>
                {ddg.AbstractURL && (
                  <a href={ddg.AbstractURL} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: AC, opacity: 0.85, marginTop: 8, display: "inline-block", fontFamily: FFM, textDecoration: "none" }}>
                    Source ↗
                  </a>
                )}
              </div>
            )}

            {wikiH.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader>Wikipedia</SectionHeader>
                {wikiH.map(h => (
                  <button
                    key={h.pageid}
                    onClick={() => browse("https://en.wikipedia.org/wiki/" + encodeURIComponent(h.title))}
                    className="fr"
                    style={{
                      display: "block", textAlign: "left", width: "100%",
                      padding: "11px 14px", marginBottom: 5, borderRadius: 9,
                      background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
                      cursor: "pointer", fontFamily: FF,
                      transition: "border-color 0.12s, background 0.12s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--nv-border-strong)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--nv-border)"}
                  >
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13.5, color: "var(--nv-text-strong)", marginBottom: 4 }}>{h.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", lineHeight: 1.55 }}>{h.snippet ? h.snippet.replace(/<[^>]*>/g, "") + "…" : ""}</div>
                  </button>
                ))}
              </div>
            )}

            {ddgT.length > 0 && (
              <div>
                <SectionHeader>Related</SectionHeader>
                {ddgT.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => browse(t.FirstURL)}
                    className="fr"
                    style={{
                      display: "block", textAlign: "left", width: "100%",
                      padding: "10px 14px", marginBottom: 5, borderRadius: 8,
                      background: "transparent", border: "1px solid var(--nv-border)",
                      cursor: "pointer", fontFamily: FF,
                      transition: "background 0.12s",
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: "var(--nv-text)", lineHeight: 1.55 }}>{t.Text}</div>
                    <div style={{ fontSize: 10, fontFamily: FFM, color: "var(--nv-text-dim)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.FirstURL}</div>
                  </button>
                ))}
              </div>
            )}

            {!ddg?.AbstractText && wikiH.length === 0 && ddgT.length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 0", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic" }}>
                No results found.<br/>
                <span style={{ fontSize: 11.5 }}>Try a different query, or </span>
                <button onClick={() => openExternalUrl("https://www.google.com/search?q=" + encodeURIComponent(results?.q || ""))} style={{ background: "none", border: "none", cursor: "pointer", color: AC, fontFamily: FFM, fontSize: 11.5, padding: 0, textDecoration: "underline" }}>search on Google ↗</button>.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10.5, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 9, marginTop: 4 }}>
      {children}
    </div>
  );
}

function primaryBtn(AC) {
  return {
    padding: "8px 16px", borderRadius: 9, cursor: "pointer",
    background: fill(AC), border: "1px solid " + bdr(AC),
    fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC,
  };
}
function secondaryBtn() {
  return {
    padding: "8px 16px", borderRadius: 9, cursor: "pointer",
    background: "var(--nv-elevated)", border: "1px solid var(--nv-border)",
    fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text)",
  };
}
function extLinkBtn() {
  return {
    padding: "4px 10px", borderRadius: 6, cursor: "pointer",
    background: "transparent", border: "1px solid var(--nv-border)",
    color: "var(--nv-text-dim)", flexShrink: 0,
    fontFamily: FFM, fontWeight: 500, fontSize: 10.5,
  };
}

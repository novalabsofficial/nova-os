// v10.0 Supernova — Browser, reworked around real tabs.
//
// Each tab carries its own nav state (address bar, history stack, view).
// Content rendering has two backends:
//
//   • Web build: an <iframe> per browsing tab (subject to the usual
//     X-Frame-Options / CSP embedding limits — unchanged from before).
//   • Tauri desktop: a NATIVE child webview per tab (see lib/nativeTabs.js),
//     which can load ANY site. The webview floats above the DOM at the
//     content area's rect, so we hide it whenever the browser window isn't
//     the focused top window (prop `active`) — otherwise it would cover the
//     rest of the OS. Falls back to the iframe path if the native layer
//     can't initialise.
//
// CRITICAL: keep iframe elements stable (keyed by tab id, not recreated each
// render) or they remount — see the long-standing v4.3 note.

import { useState, useEffect, useRef, useCallback } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr, isUrl } from "../lib/format.js";
import { BOOKMARKS } from "../ui/constants.js";
import { BrowserNav } from "../ui/BrowserNav.jsx";
import { rewriteForIframe, isLikelyUnframable } from "../lib/browser.js";
import { openExternalUrl } from "../lib/openUrl.js";
import { isTauri, NativeTabs } from "../lib/nativeTabs.js";

const QUICK_TILES = [
  { label: "Wikipedia",    url: "https://en.m.wikipedia.org",    icon: "📚", desc: "Encyclopedia" },
  { label: "Hacker News",  url: "https://news.ycombinator.com",  icon: "🗞", desc: "Tech news" },
  { label: "MDN Web Docs", url: "https://developer.mozilla.org", icon: "💻", desc: "Web dev reference" },
  { label: "archive.org",  url: "https://archive.org",           icon: "🏛", desc: "Internet archive" },
  { label: "itch.io",      url: "https://itch.io",               icon: "🎮", desc: "Indie games" },
  { label: "YouTube",      url: "https://www.youtube.com",       icon: "▶️", desc: "Videos" },
];

const NATIVE = isTauri();          // native webview backend available?
let TAB_SEQ = 1;
const newTab = () => ({ id: "t" + (TAB_SEQ++), bar: "", view: "home", frameUrl: "", results: null, loading: false, hist: [], hIdx: -1, reloadKey: 0, title: "New Tab" });

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }

export function BrowserApp({ AC, active = true }) {
  const [tabs, setTabs] = useState(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const stageRef = useRef(null);           // content-area placeholder (native bounds target)
  const nativeRef = useRef(null);          // NativeTabs controller (Tauri only)

  const tab = tabs.find(t => t.id === activeId) || tabs[0];
  const update = useCallback((id, patch) => {
    setTabs(ts => ts.map(t => t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t));
  }, []);

  // ── per-tab navigation ──────────────────────────────────────────────────
  function browse(id, url) {
    const full = rewriteForIframe(url);
    if (!full) return;
    update(id, t => {
      const nh = [...t.hist.slice(0, t.hIdx + 1), full];
      return { hist: nh, hIdx: nh.length - 1, frameUrl: full, bar: full, view: "browse", title: hostOf(full), reloadKey: t.reloadKey + 1 };
    });
  }
  async function novaSearch(id, q) {
    update(id, { loading: true, view: "results", results: null, title: q });
    let payload = { q, ddg: null, wiki: null };
    try {
      const [d, w] = await Promise.allSettled([
        fetch("https://api.duckduckgo.com/?q=" + encodeURIComponent(q) + "&format=json&no_html=1&skip_disambig=1").then(r => r.json()),
        fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(q) + "&format=json&origin=*&srlimit=7").then(r => r.json()),
      ]);
      payload = { q, ddg: d.status === "fulfilled" ? d.value : null, wiki: w.status === "fulfilled" ? w.value : null };
    } catch { /* keep empty payload */ }
    update(id, { loading: false, results: payload });
  }
  function go(i) { const q = (i ?? tab.bar).trim(); if (!q) return; if (isUrl(q)) browse(tab.id, q); else novaSearch(tab.id, q); }
  function back() { if (tab.hIdx > 0) { const i = tab.hIdx - 1; update(tab.id, t => ({ hIdx: i, frameUrl: t.hist[i], bar: t.hist[i], view: "browse", title: hostOf(t.hist[i]), reloadKey: t.reloadKey + 1 })); } }
  function fwd()  { if (tab.hIdx < tab.hist.length - 1) { const i = tab.hIdx + 1; update(tab.id, t => ({ hIdx: i, frameUrl: t.hist[i], bar: t.hist[i], view: "browse", title: hostOf(t.hist[i]), reloadKey: t.reloadKey + 1 })); } }
  function refresh() {
    if (tab.view === "browse" && tab.frameUrl) update(tab.id, t => ({ reloadKey: t.reloadKey + 1 }));
    else if (tab.view === "results" && tab.results?.q) novaSearch(tab.id, tab.results.q);
  }
  function homeBack() { update(tab.id, { bar: "", view: "home", frameUrl: "", results: null, title: "New Tab" }); }
  const setBar = (v) => update(tab.id, { bar: v });

  // ── tab management ───────────────────────────────────────────────────────
  function addTab() { const t = newTab(); setTabs(ts => [...ts, t]); setActiveId(t.id); }
  function closeTab(id) {
    setTabs(ts => {
      const idx = ts.findIndex(t => t.id === id);
      const next = ts.filter(t => t.id !== id);
      if (next.length === 0) { const t = newTab(); setActiveId(t.id); return [t]; }
      if (id === activeId) setActiveId((next[idx] || next[idx - 1] || next[0]).id);
      return next;
    });
    nativeRef.current?.close(id);
  }

  // ── native webview backend (Tauri) ───────────────────────────────────────
  useEffect(() => {
    if (!NATIVE) return;
    const ctl = new NativeTabs();
    nativeRef.current = ctl;
    return () => { ctl.dispose(); nativeRef.current = null; };
  }, []);

  // Sync the native webview: show the active browsing tab's webview pinned to
  // the stage rect when the browser is the focused window; hide otherwise.
  useEffect(() => {
    const ctl = nativeRef.current;
    if (!NATIVE || !ctl) return;
    const showNative = active && tab.view === "browse" && !!tab.frameUrl;
    let raf = 0;
    if (!showNative) { ctl.hideAll(); return; }
    const rect0 = stageRef.current?.getBoundingClientRect();
    ctl.ensure(tab.id, tab.frameUrl, tab.reloadKey, rect0);
    ctl.hideOthers(tab.id);
    const tick = () => {
      const r = stageRef.current?.getBoundingClientRect();
      if (r) ctl.place(tab.id, r.left, r.top, r.width, r.height);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, tab.id, tab.view, tab.frameUrl, tab.reloadKey]);

  // Native reload = recreate the webview (no in-place navigate) by bumping the
  // tab's reload key, which re-runs the effect above.
  const onRefresh = () => {
    if (NATIVE && tab.view === "browse") update(tab.id, t => ({ reloadKey: t.reloadKey + 1 }));
    else refresh();
  };

  const navProps = {
    bar: tab.bar, setBar, onGo: () => go(), onBack: back, onFwd: fwd, onRefresh,
    canBack: tab.hIdx > 0, canFwd: tab.hIdx < tab.hist.length - 1,
    canRefresh: (tab.view === "browse" && !!tab.frameUrl) || (tab.view === "results" && !!tab.results?.q),
    AC, view: tab.view,
  };

  // ── tab strip ─────────────────────────────────────────────────────────────
  const tabStrip = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px 0", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
      {tabs.map(t => {
        const on = t.id === activeId;
        return (
          <div key={t.id} onPointerDown={() => setActiveId(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px 7px 11px", borderRadius: "9px 9px 0 0", cursor: "pointer", flexShrink: 0, maxWidth: 180,
              background: on ? "var(--nv-surface-solid)" : "transparent", border: "1px solid " + (on ? "var(--nv-border)" : "transparent"), borderBottom: "none",
              color: on ? "var(--nv-text-strong)" : "var(--nv-text-dim)" }}>
            <span style={{ fontSize: 12 }}>{t.view === "home" ? "🌐" : t.loading ? "⏳" : "📄"}</span>
            <span style={{ flex: 1, minWidth: 0, fontFamily: FF, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title || "New Tab"}</span>
            {tabs.length > 1 && (
              <button onClick={e => { e.stopPropagation(); closeTab(t.id); }} title="Close tab"
                style={{ width: 18, height: 18, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--nv-hover)"; e.currentTarget.style.color = "var(--nv-text)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--nv-text-dim)"; }}>×</button>
            )}
          </div>
        );
      })}
      <button onClick={addTab} title="New tab" className="sb"
        style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 2 }}>+</button>
    </div>
  );

  const bookmarksRail = (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" }}>
      <button onClick={homeBack} title="Home" style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: tab.view === "home" ? fill(AC) : "transparent", border: "1px solid " + (tab.view === "home" ? bdr(AC) : "transparent"), color: tab.view === "home" ? AC : "var(--nv-text-dim)", fontFamily: FFB, fontWeight: 600, fontSize: 11, flexShrink: 0 }}>🏠 Home</button>
      <div style={{ width: 1, height: 14, background: "var(--nv-border)", margin: "0 4px", flexShrink: 0 }} />
      {BOOKMARKS.map(b => (
        <button key={b.url} onClick={() => browse(tab.id, b.url)} title={b.url} className="fr"
          style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid transparent", color: "var(--nv-text-dim)", fontFamily: FF, fontWeight: 500, fontSize: 11, flexShrink: 0 }}>{b.label}</button>
      ))}
      <div style={{ flex: 1 }} />
      <button onClick={() => openExternalUrl(tab.frameUrl || "https://www.google.com")} title="Open current page in your default browser" style={extLinkBtn()}>Open externally ↗</button>
    </div>
  );

  const chrome = (body) => (
    <div style={{ width: "100%", height: "100%", fontFamily: FF, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--nv-surface-solid)" }}>
      {tabStrip}
      <BrowserNav {...navProps} />
      {bookmarksRail}
      {body}
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (tab.view === "home") {
    return chrome(
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 28px 28px", display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg, ${fill(AC)}, rgba(255,255,255,0.05))`, border: "1px solid " + bdr(AC), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, filter: `drop-shadow(0 0 22px ${AC}55)` }}>🌐</div>
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 26, color: "var(--nv-text-strong)", letterSpacing: 0.3 }}>Nova Browser</div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", marginTop: 6, lineHeight: 1.6, maxWidth: 460, margin: "6px auto 0" }}>
                {NATIVE
                  ? "Native tabs — any site loads for real. Search with Nova Search or paste a URL."
                  : "Search with Nova Search (DuckDuckGo + Wikipedia) or paste any URL. YouTube watch links auto-embed."}
              </div>
            </div>
            <div style={{ width: "100%", maxWidth: 540, marginTop: 6, display: "flex", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", height: 46, background: "var(--nv-input-bg)", border: "1px solid var(--nv-border-strong)", borderRadius: 23 }}>
                <span style={{ fontSize: 15, color: "var(--nv-text-dim)", lineHeight: 1 }}>🔍</span>
                <input autoFocus value={tab.bar} onChange={e => setBar(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="Search Nova Search or enter a URL…"
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 14, outline: "none", padding: 0 }} />
              </div>
              <button onClick={() => go()} disabled={!tab.bar.trim()} style={{ padding: "0 22px", height: 46, background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 23, cursor: tab.bar.trim() ? "pointer" : "default", fontFamily: FFB, fontWeight: 700, fontSize: 13.5, color: AC, opacity: tab.bar.trim() ? 1 : 0.4, flexShrink: 0 }}>Search</button>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>Quick picks</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {QUICK_TILES.map(t => (
                <button key={t.url} onClick={() => browse(tab.id, t.url)} className="fr"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11, cursor: "pointer", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", textAlign: "left", fontFamily: FF, color: "var(--nv-text)" }}>
                  <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{t.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: "var(--nv-text-strong)" }}>{t.label}</div>
                    <div style={{ fontFamily: FFM, fontSize: 10, color: "var(--nv-text-dim)", marginTop: 2 }}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── BROWSE ──────────────────────────────────────────────────────────────
  if (tab.view === "browse") {
    // Native: render an empty stage; the child webview is positioned over it.
    if (NATIVE) {
      return chrome(
        <div ref={stageRef} style={{ flex: 1, minHeight: 0, position: "relative", background: "#fff" }}>
          {!active && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--nv-surface-solid)", color: "var(--nv-text-dim)", fontFamily: FF }}>
              <div style={{ fontSize: 30, opacity: 0.5 }}>🌐</div>
              <div style={{ fontSize: 12.5 }}>Click the browser window to resume the page</div>
              <div style={{ fontFamily: FFM, fontSize: 10.5, opacity: 0.7, wordBreak: "break-all", maxWidth: 360, textAlign: "center" }}>{tab.frameUrl}</div>
            </div>
          )}
        </div>
      );
    }
    // Web: iframe (embedding-limited).
    const blocked = isLikelyUnframable(tab.frameUrl);
    return chrome(
      blocked ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "30px 20px", textAlign: "center", minHeight: 0 }}>
          <div style={{ fontSize: 52, opacity: 0.55 }}>🚫</div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 19, color: "var(--nv-text-strong)" }}>This site can't be embedded</div>
          <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", maxWidth: 460, lineHeight: 1.7 }}>
            <span style={{ color: "var(--nv-text)", fontFamily: FFM, fontSize: 11.5, wordBreak: "break-all" }}>{tab.frameUrl}</span><br />
            blocks framing via X-Frame-Options or CSP. The desktop app (Tauri build) loads it natively without this limit.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={homeBack} style={secondaryBtn()}>← Home</button>
            <button onClick={() => { const q = hostOf(tab.frameUrl); update(tab.id, { bar: q }); novaSearch(tab.id, q); }} style={secondaryBtn()}>🔍 Search instead</button>
            <button onClick={() => openExternalUrl(tab.frameUrl)} style={primaryBtn(AC)}>Open in default browser ↗</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#fff" }}>
          <iframe key={tab.id + ":" + tab.frameUrl + ":" + tab.reloadKey} src={tab.frameUrl} title="browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: "block" }} />
        </div>
      )
    );
  }

  // ── RESULTS (Nova Search) ─────────────────────────────────────────────────
  const ddg = tab.results?.ddg, wiki = tab.results?.wiki;
  const ddgT = (ddg?.RelatedTopics || []).filter(t => t.FirstURL && t.Text).slice(0, 7);
  const wikiH = wiki?.query?.search || [];
  return chrome(
    tab.loading ? (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexDirection: "column", minHeight: 0 }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 12, color: "var(--nv-text-dim)", fontFamily: FFM }}>Searching…</div>
      </div>
    ) : (
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 30px" }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 11, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
            Results for "<span style={{ color: "var(--nv-text-strong)" }}>{tab.results?.q}</span>"
          </div>
          {ddg?.AbstractText && (
            <div style={{ padding: "16px 18px", marginBottom: 16, background: fill(AC), border: "1px solid " + bdr(AC), borderRadius: 11 }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: AC, marginBottom: 6 }}>{ddg.Heading}</div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-strong)", lineHeight: 1.7 }}>{ddg.AbstractText}</div>
              {ddg.AbstractURL && <button onClick={() => browse(tab.id, ddg.AbstractURL)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 10.5, color: AC, opacity: 0.85, marginTop: 8, fontFamily: FFM }}>Open ↗</button>}
            </div>
          )}
          {wikiH.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader>Wikipedia</SectionHeader>
              {wikiH.map(h => (
                <button key={h.pageid} onClick={() => browse(tab.id, "https://en.wikipedia.org/wiki/" + encodeURIComponent(h.title))} className="fr"
                  style={{ display: "block", textAlign: "left", width: "100%", padding: "11px 14px", marginBottom: 5, borderRadius: 9, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", cursor: "pointer", fontFamily: FF }}>
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
                <button key={i} onClick={() => browse(tab.id, t.FirstURL)} className="fr"
                  style={{ display: "block", textAlign: "left", width: "100%", padding: "10px 14px", marginBottom: 5, borderRadius: 8, background: "transparent", border: "1px solid var(--nv-border)", cursor: "pointer", fontFamily: FF }}>
                  <div style={{ fontSize: 12.5, color: "var(--nv-text)", lineHeight: 1.55 }}>{t.Text}</div>
                  <div style={{ fontSize: 10, fontFamily: FFM, color: "var(--nv-text-dim)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.FirstURL}</div>
                </button>
              ))}
            </div>
          )}
          {!ddg?.AbstractText && wikiH.length === 0 && ddgT.length === 0 && (
            <div style={{ textAlign: "center", padding: "50px 0", color: "var(--nv-text-dim)", fontSize: 13, fontStyle: "italic" }}>
              No results found.<br />
              <span style={{ fontSize: 11.5 }}>Try a different query, or </span>
              <button onClick={() => openExternalUrl("https://www.google.com/search?q=" + encodeURIComponent(tab.results?.q || ""))} style={{ background: "none", border: "none", cursor: "pointer", color: AC, fontFamily: FFM, fontSize: 11.5, padding: 0, textDecoration: "underline" }}>search on Google ↗</button>.
            </div>
          )}
        </div>
      </div>
    )
  );
}

function SectionHeader({ children }) {
  return <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10.5, color: "var(--nv-text-dim)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 9, marginTop: 4 }}>{children}</div>;
}
function primaryBtn(AC) { return { padding: "8px 16px", borderRadius: 9, cursor: "pointer", background: fill(AC), border: "1px solid " + bdr(AC), fontFamily: FFB, fontWeight: 600, fontSize: 12, color: AC }; }
function secondaryBtn() { return { padding: "8px 16px", borderRadius: 9, cursor: "pointer", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", fontFamily: FFB, fontWeight: 600, fontSize: 12, color: "var(--nv-text)" }; }
function extLinkBtn() { return { padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid var(--nv-border)", color: "var(--nv-text-dim)", flexShrink: 0, fontFamily: FFM, fontWeight: 500, fontSize: 10.5 }; }

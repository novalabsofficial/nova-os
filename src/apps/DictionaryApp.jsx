import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// v10.9 — Dictionary.
// Free Dictionary API (dictionaryapi.dev) — keyless, CORS-friendly. Returns
// phonetics (with audio), parts of speech, definitions, examples, synonyms.
const API = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const RECENT_KEY = "nova-dict-recent";

const POS_COLOR = {
  noun: "#4f9eff", verb: "#4cef90", adjective: "#ffcc44", adverb: "#ff8c44",
  pronoun: "#cc44ff", preposition: "#44ddcc", conjunction: "#ff6b6b", interjection: "#ff44aa",
};

export function DictionaryApp({ AC }) {
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
  });
  const audioRef = useRef(null);

  const pushRecent = (word) => {
    setRecent((prev) => {
      const next = [word, ...prev.filter((w) => w.toLowerCase() !== word.toLowerCase())].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const lookup = (word) => {
    const term = (word || "").trim();
    if (!term) return;
    setQ(term);
    setLoading(true); setErr(null); setEntries(null);
    fetch(API + encodeURIComponent(term.toLowerCase()))
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) { setEntries(d); pushRecent(term); }
        else { setErr(`No definition found for "${term}".`); }
      })
      .catch(() => setErr("Network error — check your connection."))
      .finally(() => setLoading(false));
  };

  const playAudio = (url) => {
    if (!url) return;
    try {
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio(url);
      audioRef.current = a;
      a.play().catch(() => {});
    } catch (e) {}
  };

  useEffect(() => () => { if (audioRef.current) try { audioRef.current.pause(); } catch (e) {} }, []);

  const headword = entries && entries[0];
  const phonetic = headword && (headword.phonetic || (headword.phonetics || []).find((p) => p.text)?.text);
  const audioUrl = headword && (headword.phonetics || []).find((p) => p.audio)?.audio;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") lookup(q); }}
              placeholder="Look up a word…"
              autoFocus
              style={{ width: "100%", padding: "11px 14px 11px 36px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)", borderRadius: 11, color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 15, outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.5, pointerEvents: "none" }}>📖</span>
          </div>
          <button onClick={() => lookup(q)} style={{ padding: "0 18px", background: AC, border: "none", borderRadius: 11, color:"var(--nv-text-strong)", fontFamily: FFB, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Define</button>
        </div>
        {recent.length > 0 && !entries && !loading && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: 10, fontFamily: FFM, color: "var(--nv-text-dim)", letterSpacing: 1, alignSelf: "center" }}>RECENT</span>
            {recent.map((w) => (
              <button key={w} onClick={() => lookup(w)} style={{ padding: "4px 11px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 14, cursor: "pointer", fontFamily: FF, fontSize: 12, color: "var(--nv-text)" }}>{w}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--nv-text-dim)" }}>
            <div style={{ width: 16, height: 16, border: "2px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Looking up…</span>
          </div>
        )}
        {err && !loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--nv-text-dim)" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🔎</div>
            <div style={{ fontSize: 14 }}>{err}</div>
          </div>
        )}
        {!loading && !err && !entries && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--nv-text-dim)" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📚</div>
            <div style={{ fontSize: 14 }}>Search any English word for definitions, pronunciation and synonyms.</div>
          </div>
        )}

        {headword && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 30, color: "var(--nv-text-strong)" }}>{headword.word}</div>
              {phonetic && <div style={{ fontFamily: FFM, fontSize: 15, color: AC }}>{phonetic}</div>}
              {audioUrl && (
                <button onClick={() => playAudio(audioUrl)} title="Play pronunciation" style={{ width: 34, height: 34, borderRadius: "50%", background: fill(AC), border: "1px solid " + bdr(AC), color: AC, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>🔊</button>
              )}
            </div>

            {entries.flatMap((entry, ei) => (entry.meanings || []).map((m, mi) => (
              <div key={ei + "-" + mi} style={{ background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "inline-block", fontFamily: FFB, fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: POS_COLOR[m.partOfSpeech] || AC, background: fill(POS_COLOR[m.partOfSpeech] || AC), border: "1px solid " + bdr(POS_COLOR[m.partOfSpeech] || AC), padding: "3px 10px", borderRadius: 8, marginBottom: 12 }}>{m.partOfSpeech}</div>
                <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                  {(m.definitions || []).slice(0, 6).map((def, di) => (
                    <li key={di} style={{ fontSize: 14, color: "var(--nv-text)", lineHeight: 1.5 }}>
                      {def.definition}
                      {def.example && <div style={{ fontSize: 13, color: "var(--nv-text-dim)", fontStyle: "italic", marginTop: 3 }}>“{def.example}”</div>}
                    </li>
                  ))}
                </ol>
                {(m.synonyms || []).length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--nv-text-dim)", fontFamily: FFB, fontWeight: 600 }}>Synonyms</span>
                    {m.synonyms.slice(0, 10).map((s) => (
                      <button key={s} onClick={() => lookup(s)} style={{ padding: "3px 9px", background: "transparent", border: "1px solid var(--nv-border)", borderRadius: 12, cursor: "pointer", fontFamily: FF, fontSize: 12, color: AC }}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )))}
          </div>
        )}
      </div>
    </div>
  );
}

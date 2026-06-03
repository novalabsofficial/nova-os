import { useState, useEffect, useRef } from "react";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// v10.9 — Crypto market tracker.
// CoinGecko public API — keyless + CORS-friendly. Top coins by market cap,
// live prices, 24h change and a 7-day sparkline. (Stocks need an API key /
// CORS proxy, so they're intentionally out of scope here — see Markets note.)
const API = "https://api.coingecko.com/api/v3/coins/markets";
const VS = { usd: "$", eur: "€", gbp: "£" };

function Spark({ prices, up }) {
  if (!prices || prices.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / span) * h;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const color = up ? "#4cef90" : "#ff6b6b";
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function CryptoApp({ AC }) {
  const [coins, setCoins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [vs, setVs] = useState(() => localStorage.getItem("nova-crypto-vs") || "usd");
  const [filter, setFilter] = useState("");
  const [updated, setUpdated] = useState(null);
  const reqRef = useRef(0);

  const load = (cur) => {
    const id = ++reqRef.current;
    setLoading(true); setErr(null);
    fetch(`${API}?vs_currency=${cur}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => {
        if (id !== reqRef.current) return;
        if (Array.isArray(d)) { setCoins(d); setUpdated(new Date()); }
        else throw new Error("bad");
      })
      .catch((e) => { if (id === reqRef.current) setErr(String(e).includes("429") ? "Rate limited — wait a moment and refresh." : "Couldn't load prices."); })
      .finally(() => { if (id === reqRef.current) setLoading(false); });
  };

  useEffect(() => { localStorage.setItem("nova-crypto-vs", vs); load(vs); /* eslint-disable-next-line */ }, [vs]);

  const sym = VS[vs] || "";
  const fmtPrice = (n) => {
    if (n == null) return "—";
    if (n >= 1) return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };
  const fmtBig = (n) => {
    if (n == null) return "—";
    if (n >= 1e12) return sym + (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return sym + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return sym + (n / 1e6).toFixed(2) + "M";
    return sym + n.toLocaleString();
  };

  const shown = (coins || []).filter((c) => {
    const f = filter.trim().toLowerCase();
    return !f || c.name.toLowerCase().includes(f) || c.symbol.toLowerCase().includes(f);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", fontFamily: FF, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 20, color: "var(--nv-text-strong)" }}>Crypto</div>
          <div style={{ fontSize: 10.5, color: "var(--nv-text-dim)" }}>
            {updated ? "Updated " + updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live market prices"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 9, padding: 3 }}>
          {Object.keys(VS).map((c) => (
            <button key={c} onClick={() => setVs(c)} style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, textTransform: "uppercase", background: vs === c ? AC : "transparent", color: vs === c ? "#fff" : "var(--nv-text-dim)" }}>{c}</button>
          ))}
        </div>
        <button onClick={() => load(vs)} title="Refresh" disabled={loading} style={{ width: 36, height: 36, borderRadius: 9, background: fill(AC), border: "1px solid " + bdr(AC), color: AC, cursor: loading ? "default" : "pointer", fontSize: 15, opacity: loading ? 0.5 : 1 }}>↻</button>
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter coins…"
        style={{ width: "100%", padding: "9px 13px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)", borderRadius: 10, color: "var(--nv-text-strong)", fontFamily: FF, fontSize: 13.5, outline: "none", boxSizing: "border-box", flexShrink: 0 }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {loading && !coins && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--nv-text-dim)" }}>
            <div style={{ width: 16, height: 16, border: "2px solid var(--nv-border)", borderTopColor: AC, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading market…</span>
          </div>
        )}
        {err && (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--nv-text-dim)" }}>
            <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>📉</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>{err}</div>
            <button onClick={() => load(vs)} style={{ padding: "8px 16px", background: AC, border: "none", borderRadius: 9, color: "#fff", fontFamily: FFB, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Retry</button>
          </div>
        )}
        {shown.map((c) => {
          const up = (c.price_change_percentage_24h || 0) >= 0;
          const prices = c.sparkline_in_7d && c.sparkline_in_7d.price;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 11 }}>
              <span style={{ fontFamily: FFM, fontSize: 11, color: "var(--nv-text-dim)", width: 22, textAlign: "right", flexShrink: 0 }}>{c.market_cap_rank || "·"}</span>
              <img src={c.image} alt="" width={28} height={28} style={{ borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 14, color: "var(--nv-text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name} <span style={{ color: "var(--nv-text-dim)", fontWeight: 500, fontSize: 11.5, textTransform: "uppercase" }}>{c.symbol}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--nv-text-dim)" }}>Cap {fmtBig(c.market_cap)}</div>
              </div>
              <Spark prices={prices} up={up} />
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: 92 }}>
                <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "var(--nv-text-strong)" }}>{fmtPrice(c.current_price)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: up ? "#4cef90" : "#ff6b6b" }}>
                  {up ? "▲" : "▼"} {Math.abs(c.price_change_percentage_24h || 0).toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
        {coins && !shown.length && !err && (
          <div style={{ textAlign: "center", padding: "30px", color: "var(--nv-text-dim)", fontSize: 13 }}>No coins match “{filter}”.</div>
        )}
      </div>
    </div>
  );
}

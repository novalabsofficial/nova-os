import { useState, useEffect, useRef } from "react";
import { FF, FFB } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

// v10.9 — Currency converter.
// Keyless + CORS-enabled rates via the fawazahmed0 currency-api, served from
// the jsDelivr CDN (with a pages.dev fallback host) — guaranteed CORS + great
// uptime, no API key. (frankfurter.app returns no CORS header, so browsers /
// the Tauri webview block it — that was the original "Network error".)
const HOSTS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1",
  "https://latest.currency-api.pages.dev/v1",
];
async function fetchCur(path) {
  let lastErr;
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + path);
      if (r.ok) return await r.json();
      lastErr = new Error("HTTP " + r.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("fetch failed");
}

// Curated set of major fiat currencies (and their flags). Names come from the
// API; this set keeps the picker clean instead of dumping 200+ incl. crypto.
const FLAG = {
  USD:"🇺🇸",EUR:"🇪🇺",GBP:"🇬🇧",JPY:"🇯🇵",AUD:"🇦🇺",CAD:"🇨🇦",CHF:"🇨🇭",CNY:"🇨🇳",
  HKD:"🇭🇰",NZD:"🇳🇿",SEK:"🇸🇪",KRW:"🇰🇷",SGD:"🇸🇬",NOK:"🇳🇴",MXN:"🇲🇽",INR:"🇮🇳",
  ZAR:"🇿🇦",TRY:"🇹🇷",BRL:"🇧🇷",DKK:"🇩🇰",PLN:"🇵🇱",THB:"🇹🇭",IDR:"🇮🇩",HUF:"🇭🇺",
  CZK:"🇨🇿",ILS:"🇮🇱",PHP:"🇵🇭",MYR:"🇲🇾",RON:"🇷🇴",BGN:"🇧🇬",ISK:"🇮🇸",
};

export function CurrencyApp({ AC }) {
  const [currencies, setCurrencies] = useState(null); // { CODE: Name }
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState(() => localStorage.getItem("nova-cur-from") || "USD");
  const [to, setTo] = useState(() => localStorage.getItem("nova-cur-to") || "EUR");
  const [rates, setRates] = useState(null); // { codeLower: rate } for current `from`
  const [date, setDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const reqRef = useRef(0);

  // currency names — fetched once, filtered to our curated fiat set
  useEffect(() => {
    let alive = true;
    const fallback = () => { const o = {}; Object.keys(FLAG).forEach((c) => (o[c] = c)); return o; };
    fetchCur("/currencies.min.json")
      .then((all) => {
        if (!alive) return;
        const out = {};
        Object.keys(FLAG).forEach((code) => {
          const lc = code.toLowerCase();
          out[code] = all && all[lc] ? all[lc] : code;
        });
        setCurrencies(out);
      })
      .catch(() => { if (alive) setCurrencies(fallback()); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { localStorage.setItem("nova-cur-from", from); }, [from]);
  useEffect(() => { localStorage.setItem("nova-cur-to", to); }, [to]);

  // rate table for the chosen base — one fetch per `from`; all conversions
  // are then computed locally, so changing `to`/amount is instant.
  useEffect(() => {
    const id = ++reqRef.current;
    setLoading(true); setErr(null);
    fetchCur("/currencies/" + from.toLowerCase() + ".min.json")
      .then((d) => {
        if (id !== reqRef.current) return;
        const table = d && d[from.toLowerCase()];
        if (table) { setRates(table); setDate(d.date || null); }
        else { setErr("Couldn't load rates for " + from + "."); setRates(null); }
      })
      .catch(() => { if (id === reqRef.current) { setErr("Network error — check your connection."); setRates(null); } })
      .finally(() => { if (id === reqRef.current) setLoading(false); });
  }, [from]);

  const amt = parseFloat(amount);
  const rate = from === to ? 1 : rates ? rates[to.toLowerCase()] : null;
  const result = !isNaN(amt) && rate != null ? amt * rate : null;

  const swap = () => { setFrom(to); setTo(from); };
  const fmt = (n) =>
    n == null ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
  const codes = currencies ? Object.keys(currencies).sort() : [];

  const selStyle = {
    width: "100%", padding: "12px 13px", background: "var(--nv-input-bg)",
    border: "1px solid var(--nv-border)", borderRadius: 11, color: "var(--nv-text-strong)",
    fontFamily: FFB, fontWeight: 600, fontSize: 15, outline: "none", cursor: "pointer",
  };
  const labelStyle = { fontSize: 10, fontFamily: FFB, fontWeight: 600, letterSpacing: 1.4, color: "var(--nv-text-dim)", textTransform: "uppercase", marginBottom: 6 };

  const renderSelect = (val, setVal) => (
    <select value={val} onChange={(e) => setVal(e.target.value)} style={selStyle}>
      {codes.map((c) => (
        <option key={c} value={c}>{(FLAG[c] ? FLAG[c] + " " : "") + c + " — " + currencies[c]}</option>
      ))}
    </select>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", fontFamily: FF, minHeight: 0, overflowY: "auto" }}>
      <div>
        <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 21, color: "var(--nv-text-strong)" }}>Currency</div>
        <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginTop: 2 }}>Live daily exchange rates</div>
      </div>

      <div>
        <div style={labelStyle}>Amount</div>
        <input
          type="number" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
          style={{ width: "100%", padding: "12px 14px", background: "var(--nv-input-bg)", border: "1px solid var(--nv-border)", borderRadius: 11, color: "var(--nv-text-strong)", fontFamily: FFB, fontWeight: 700, fontSize: 22, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <div style={labelStyle}>From</div>
          {currencies ? renderSelect(from, setFrom) : <div style={{ ...selStyle, color: "var(--nv-text-dim)" }}>Loading…</div>}
        </div>
        <button onClick={swap} title="Swap currencies" style={{ width: 42, height: 46, borderRadius: 11, background: fill(AC), border: "1px solid " + bdr(AC), color: AC, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>⇄</button>
        <div>
          <div style={labelStyle}>To</div>
          {currencies ? renderSelect(to, setTo) : <div style={{ ...selStyle, color: "var(--nv-text-dim)" }}>Loading…</div>}
        </div>
      </div>

      <div style={{ background: "var(--nv-elevated)", border: "1px solid var(--nv-border)", borderRadius: 14, padding: "20px 18px", textAlign: "center" }}>
        {err ? (
          <div style={{ color: "#ff8080", fontSize: 13 }}>{err}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginBottom: 6 }}>
              {fmt(parseFloat(amount) || 0)} {from} =
            </div>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 34, color: "var(--nv-text-strong)", lineHeight: 1.1, opacity: loading ? 0.4 : 1, transition: "opacity 0.15s" }}>
              {(FLAG[to] ? FLAG[to] + " " : "")}{fmt(result)} <span style={{ fontSize: 18, color: AC }}>{to}</span>
            </div>
            {rate != null && (
              <div style={{ fontSize: 11, color: "var(--nv-text-dim)", marginTop: 10 }}>
                1 {from} = {fmt(rate)} {to}{date ? "  ·  " + date : ""}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: "auto", fontSize: 10.5, color: "var(--nv-text-dim)", textAlign: "center", lineHeight: 1.5 }}>
        Rates are daily reference rates and may differ from what banks or cards charge.
      </div>
    </div>
  );
}

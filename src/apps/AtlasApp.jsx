// Atlas — Nova OS maps. Leaflet + OpenStreetMap (no API key, no billing):
//   • Search   — find a place, fly there, and see a detail card (address,
//                category, hours, phone, website, Wikipedia summary) built from
//                OpenStreetMap tags + the Wikipedia REST API. Tap the map to
//                reverse-geocode a dropped pin.
//   • Directions — type a start + end; routes via the public OSRM server and
//                draws the line with distance + estimated drive time.
//
// All data sources are free + keyless and ToS-clean (attribution shown).
// Real star reviews would require a paid/keyed provider, so they're omitted.
// Nominatim/OSRM ask for light use — we only call them on submit/selection.

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FF, FFB, FFM } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const PIN = L.divIcon({ className: "nova-atlas-pin", html: "<div style='font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.55))'>📍</div>", iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26] });
const dotIcon = (color, label) => L.divIcon({ className: "", html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px sans-serif">${label}</div>`, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14] });

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";

const fmtDist = (m) => (m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(m < 10000 ? 1 : 0) + " km");
const fmtDur = (s) => { const min = Math.round(s / 60); if (min < 60) return min + " min"; const h = Math.floor(min / 60); return h + " h " + (min % 60) + " min"; };

function buildPlace(res) {
  const et = res.extratags || {};
  return {
    name: (res.namedetails && res.namedetails.name) || (res.display_name || "").split(",")[0] || "Pin",
    category: (res.type || res.class || "").replace(/_/g, " "),
    address: res.display_name || "",
    hours: et.opening_hours || null,
    phone: et.phone || et["contact:phone"] || null,
    website: et.website || et["contact:website"] || null,
    wikipedia: et.wikipedia || null,   // "en:Article Title"
    lat: parseFloat(res.lat), lon: parseFloat(res.lon),
    wiki: undefined,                   // filled in async
  };
}
async function geocode(q, limit = 1) {
  const r = await fetch(NOMINATIM + "/search?format=json&addressdetails=1&extratags=1&namedetails=1&limit=" + limit + "&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } });
  return r.json();
}
async function fetchWiki(wp) {
  try {
    const i = wp.indexOf(":");
    const lang = wp.slice(0, i), title = wp.slice(i + 1);
    const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return { extract: d.extract, url: d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page, thumb: d.thumbnail && d.thumbnail.source };
  } catch { return null; }
}

export function AtlasApp({ AC, showToast }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const searchMk = useRef(null);
  const routeLine = useRef(null);
  const startMk = useRef(null);
  const endMk = useRef(null);
  const modeRef = useRef("search");

  const [mode, setMode] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [place, setPlace] = useState(null);
  const [startQ, setStartQ] = useState("");
  const [endQ, setEndQ] = useState("");
  const [route, setRoute] = useState(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Build the Leaflet map once.
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.on("click", (e) => { if (modeRef.current === "search") reverseGeocode(e.latlng.lat, e.latlng.lng); });
    mapRef.current = m;
    const fix = () => m.invalidateSize();
    const t = setTimeout(fix, 200);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fix) : null;
    if (ro) ro.observe(mapEl.current);
    return () => { clearTimeout(t); if (ro) ro.disconnect(); m.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSearchMarker(lat, lon, label) {
    const m = mapRef.current; if (!m) return;
    if (searchMk.current) searchMk.current.remove();
    searchMk.current = L.marker([lat, lon], { icon: PIN }).addTo(m).bindPopup(label || (lat.toFixed(5) + ", " + lon.toFixed(5))).openPopup();
  }
  function selectPlace(res, fly) {
    const lat = parseFloat(res.lat), lon = parseFloat(res.lon);
    setSearchMarker(lat, lon, (res.namedetails && res.namedetails.name) || (res.display_name || "").split(",")[0]);
    if (fly) mapRef.current?.flyTo([lat, lon], 15, { duration: 0.8 });
    const p = buildPlace(res);
    setPlace(p); setResults([]);
    if (p.wikipedia) fetchWiki(p.wikipedia).then(w => { if (w) setPlace(cur => (cur && cur.lat === p.lat && cur.lon === p.lon) ? { ...cur, wiki: w } : cur); });
  }

  async function doSearch(e) {
    if (e) e.preventDefault();
    const q = query.trim(); if (!q) return;
    setBusy(true); setResults([]);
    try {
      const data = await geocode(q, 6);
      if (!Array.isArray(data) || !data.length) { showToast?.("No results for that search"); }
      else if (data.length === 1) selectPlace(data[0], true);
      else setResults(data);
    } catch { showToast?.("Search failed — check your connection"); }
    setBusy(false);
  }
  async function reverseGeocode(lat, lon) {
    setBusy(true);
    try {
      const r = await fetch(NOMINATIM + "/reverse?format=json&extratags=1&namedetails=1&lat=" + lat + "&lon=" + lon, { headers: { Accept: "application/json" } });
      const res = await r.json();
      if (res && res.lat) selectPlace(res, false);
      else { setSearchMarker(lat, lon, "Dropped pin"); setPlace({ name: "Dropped pin", address: lat.toFixed(5) + ", " + lon.toFixed(5), lat, lon }); }
    } catch { setSearchMarker(lat, lon, "Dropped pin"); }
    setBusy(false);
  }
  function locate() {
    if (!navigator.geolocation) { showToast?.("Geolocation isn't available here"); return; }
    showToast?.("Locating…");
    navigator.geolocation.getCurrentPosition(
      pos => { const { latitude, longitude } = pos.coords; mapRef.current?.flyTo([latitude, longitude], 14, { duration: 0.8 }); reverseGeocode(latitude, longitude); },
      () => showToast?.("Couldn't get your location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function clearRoute() {
    [routeLine, startMk, endMk].forEach(r => { if (r.current) { r.current.remove(); r.current = null; } });
    setRoute(null);
  }
  async function doRoute(e) {
    if (e) e.preventDefault();
    const a = startQ.trim(), b = endQ.trim();
    if (!a || !b) { showToast?.("Enter both a start and a destination"); return; }
    setBusy(true);
    try {
      const [sa, sb] = await Promise.all([geocode(a, 1), geocode(b, 1)]);
      const s = sa && sa[0], en = sb && sb[0];
      if (!s) { showToast?.("Couldn't find the start"); setBusy(false); return; }
      if (!en) { showToast?.("Couldn't find the destination"); setBusy(false); return; }
      const url = OSRM + `/route/v1/driving/${s.lon},${s.lat};${en.lon},${en.lat}?overview=full&geometries=geojson`;
      const d = await (await fetch(url)).json();
      if (!d.routes || !d.routes.length) { showToast?.("No driving route found between those points"); setBusy(false); return; }
      const rt = d.routes[0];
      clearRoute();
      if (searchMk.current) { searchMk.current.remove(); searchMk.current = null; }
      setPlace(null);
      const m = mapRef.current;
      routeLine.current = L.polyline(rt.geometry.coordinates.map(([lon, lat]) => [lat, lon]), { color: AC, weight: 6, opacity: 0.85, lineJoin: "round" }).addTo(m);
      startMk.current = L.marker([s.lat, s.lon], { icon: dotIcon("#2ecc71", "A") }).addTo(m).bindPopup((s.display_name || "").split(",")[0]);
      endMk.current = L.marker([en.lat, en.lon], { icon: dotIcon("#e74c3c", "B") }).addTo(m).bindPopup((en.display_name || "").split(",")[0]);
      m.fitBounds(routeLine.current.getBounds(), { padding: [50, 50] });
      setRoute({ distanceM: rt.distance, durationS: rt.duration, from: (s.display_name || "").split(",")[0], to: (en.display_name || "").split(",")[0] });
    } catch { showToast?.("Routing failed — check your connection"); }
    setBusy(false);
  }

  function switchMode(m) {
    setMode(m);
    if (m === "directions") { setResults([]); setPlace(null); }
    else { clearRoute(); }
  }
  function directionsToPlace() {
    setMode("directions");
    setEndQ(place.name);
    setStartQ("");
    showToast?.("Destination set — enter a starting point");
  }

  // ── styles ──
  const tabBtn = (active) => ({ flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, border: "1px solid " + (active ? bdr(AC) : "rgba(255,255,255,0.12)"), background: active ? fill(AC) : "rgba(255,255,255,0.05)", color: active ? AC : "var(--nv-text-dim)" });
  const input = { flex: 1, minWidth: 0, padding: "8px 12px", borderRadius: 8, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 13, outline: "none" };
  const goBtn = { padding: "8px 14px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, cursor: busy ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" };
  const ghost = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13, lineHeight: 1, whiteSpace: "nowrap" };
  const panel = { position: "absolute", zIndex: 1000, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border-strong)", borderRadius: 12, boxShadow: "0 16px 44px rgba(0,0,0,0.5)", overflowY: "auto",
    ...(isMobile ? { left: 8, right: 8, bottom: 8, maxHeight: "46%" } : { top: 12, left: 12, width: 332, maxHeight: "calc(100% - 24px)" }) };
  const linkRow = (label, value, href) => (
    <div style={{ display: "flex", gap: 8, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
      <span style={{ flexShrink: 0, color: "var(--nv-text-dim)", fontFamily: FFM, minWidth: 58 }}>{label}</span>
      {href ? <a href={href} target="_blank" rel="noreferrer" style={{ color: AC, textDecoration: "none", wordBreak: "break-word" }}>{value}</a> : <span style={{ color: "var(--nv-text)", wordBreak: "break-word" }}>{value}</span>}
    </div>
  );

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 0, fontFamily: FF, display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--nv-border)", position: "relative", zIndex: 1100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", whiteSpace: "nowrap" }}>🗺️ Atlas</span>
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            <button style={tabBtn(mode === "search")} onClick={() => switchMode("search")}>🔍 Search</button>
            <button style={tabBtn(mode === "directions")} onClick={() => switchMode("directions")}>🧭 Directions</button>
          </div>
        </div>

        {mode === "search" ? (
          <form onSubmit={doSearch} style={{ display: "flex", gap: 6 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search places, addresses…" style={input} />
            <button type="submit" disabled={busy} style={goBtn}>{busy ? "…" : "Search"}</button>
            <button type="button" onClick={locate} title="My location" style={{ ...ghost, fontSize: 15 }}>📍</button>
          </form>
        ) : (
          <form onSubmit={doRoute} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input value={startQ} onChange={e => setStartQ(e.target.value)} placeholder="🟢 Start (place or address)" style={{ ...input, flexBasis: 160 }} />
            <input value={endQ} onChange={e => setEndQ(e.target.value)} placeholder="🔴 Destination" style={{ ...input, flexBasis: 160 }} />
            <button type="submit" disabled={busy} style={goBtn}>{busy ? "…" : "Route"}</button>
            {route && <button type="button" onClick={clearRoute} style={ghost}>Clear</button>}
          </form>
        )}

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 12, right: 12, marginTop: 4, maxHeight: 280, overflowY: "auto", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border-strong)", borderRadius: 10, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", zIndex: 1101 }}>
            {results.map((r, i) => (
              <button key={r.place_id || i} onClick={() => selectPlace(r, true)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", borderBottom: i < results.length - 1 ? "1px solid var(--nv-border)" : "none", color: "var(--nv-text)", cursor: "pointer", fontFamily: FF, fontSize: 12.5, lineHeight: 1.4 }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map + floating panels */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={mapEl} style={{ position: "absolute", inset: 0, background: "#0a0c14" }} />

        {/* Place detail card (search mode) */}
        {mode === "search" && place && (
          <div style={panel}>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 16, color: "var(--nv-text-strong)", lineHeight: 1.25 }}>{place.name}</div>
                  {place.category && <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", marginTop: 2, textTransform: "capitalize" }}>{place.category}</div>}
                </div>
                <button onClick={() => { setPlace(null); if (searchMk.current) { searchMk.current.remove(); searchMk.current = null; } }} title="Close" style={{ background: "none", border: "none", color: "var(--nv-text-dim)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
              </div>

              {place.wiki && place.wiki.thumb && <img src={place.wiki.thumb} alt="" style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, margin: "10px 0 4px" }} />}

              {place.address && linkRow("Address", place.address)}
              {place.hours && linkRow("Hours", place.hours)}
              {place.phone && linkRow("Phone", place.phone, "tel:" + place.phone)}
              {place.website && linkRow("Website", place.website.replace(/^https?:\/\//, ""), place.website)}

              {place.wiki && place.wiki.extract && (
                <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.55, color: "var(--nv-text)" }}>
                  {place.wiki.extract}
                  {place.wiki.url && <> <a href={place.wiki.url} target="_blank" rel="noreferrer" style={{ color: AC, textDecoration: "none" }}>Wikipedia ↗</a></>}
                </div>
              )}

              <button onClick={directionsToPlace} style={{ ...goBtn, marginTop: 12, width: "100%", opacity: 1, cursor: "pointer" }}>🧭 Directions to here</button>
            </div>
          </div>
        )}

        {/* Route summary (directions mode) */}
        {mode === "directions" && route && (
          <div style={panel}>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 15, color: "var(--nv-text-strong)" }}>Driving route</div>
              <div style={{ display: "flex", gap: 14, marginTop: 8, alignItems: "baseline" }}>
                <div style={{ fontFamily: FFB, fontWeight: 800, fontSize: 22, color: AC }}>{fmtDur(route.durationS)}</div>
                <div style={{ fontFamily: FFM, fontSize: 14, color: "var(--nv-text)" }}>{fmtDist(route.distanceM)}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6 }}>
                <div><span style={{ color: "#2ecc71", fontWeight: 800 }}>A</span> <span style={{ color: "var(--nv-text)" }}>{route.from}</span></div>
                <div><span style={{ color: "#e74c3c", fontWeight: 800 }}>B</span> <span style={{ color: "var(--nv-text)" }}>{route.to}</span></div>
              </div>
              <button onClick={clearRoute} style={{ ...ghost, marginTop: 12, width: "100%" }}>Clear route</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "5px 12px", fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic", borderTop: "1px solid var(--nv-border)", textAlign: "center" }}>
        Map © OpenStreetMap · Search by Nominatim · Routing by OSRM · Info from Wikipedia
      </div>
    </div>
  );
}

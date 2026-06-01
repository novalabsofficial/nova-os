// Atlas — Nova OS maps. Leaflet + OpenStreetMap tiles (no API key, no billing),
// place search via the free Nominatim geocoder, "my location" via the browser
// geolocation API, and click-to-drop-a-pin. Map data © OpenStreetMap.
//
// Notes:
//  • A custom emoji DivIcon is used for the marker so we never hit Leaflet's
//    classic broken default-marker-image path under a bundler.
//  • Nominatim asks for light use (≤1 req/sec); we only query on submit.

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FF, FFB } from "../ui/styles.js";
import { fill, bdr } from "../lib/format.js";

const PIN = L.divIcon({
  className: "nova-atlas-pin",
  html: "<div style='font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.55))'>📍</div>",
  iconSize: [30, 30],
  iconAnchor: [15, 28],   // tip of the pin sits on the point
  popupAnchor: [0, -26],
});

export function AtlasApp({ AC, showToast }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Build the Leaflet map once, on mount.
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.on("click", (e) => dropPin(e.latlng.lat, e.latlng.lng));
    mapRef.current = m;

    // Leaflet measures the container on init; in a window/animation it may not
    // have its final size yet, so recalc shortly after and on every resize.
    const fix = () => m.invalidateSize();
    const t = setTimeout(fix, 200);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fix) : null;
    if (ro) ro.observe(mapEl.current);

    return () => { clearTimeout(t); if (ro) ro.disconnect(); m.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dropPin(lat, lng, label) {
    const m = mapRef.current; if (!m) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lng], { icon: PIN }).addTo(m)
      .bindPopup(label || (lat.toFixed(5) + ", " + lng.toFixed(5)))
      .openPopup();
  }

  async function search(e) {
    if (e) e.preventDefault();
    const q = query.trim(); if (!q) return;
    setSearching(true); setResults([]);
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=6&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } });
      const data = await r.json();
      setResults(Array.isArray(data) ? data : []);
      if (!data || !data.length) showToast?.("No results for that search");
    } catch { showToast?.("Search failed — check your connection"); }
    setSearching(false);
  }

  function goTo(res) {
    const lat = parseFloat(res.lat), lng = parseFloat(res.lon);
    mapRef.current?.flyTo([lat, lng], 13, { duration: 0.8 });
    dropPin(lat, lng, res.display_name);
    setResults([]);
    setQuery(res.display_name.split(",")[0]);
  }

  function locate() {
    if (!navigator.geolocation) { showToast?.("Geolocation isn't available here"); return; }
    showToast?.("Locating…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.flyTo([latitude, longitude], 14, { duration: 0.8 });
        dropPin(latitude, longitude, "You are here");
      },
      () => showToast?.("Couldn't get your location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const inputStyle = { flex: 1, minWidth: 0, padding: "8px 12px", borderRadius: 8, background: "var(--nv-input-bg)", color: "var(--nv-text)", border: "1px solid var(--nv-border-strong)", fontFamily: FF, fontSize: 13, outline: "none" };

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 0, fontFamily: FF, display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)" }}>
      {/* Search bar (kept above the map's stacking context) */}
      <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--nv-border)", alignItems: "center", flexWrap: "wrap", position: "relative", zIndex: 1000 }}>
        <span style={{ fontFamily: FFB, fontWeight: 800, fontSize: 14, color: "var(--nv-text-strong)", whiteSpace: "nowrap" }}>🗺️ Atlas</span>
        <form onSubmit={search} style={{ flex: 1, minWidth: 180, display: "flex", gap: 6 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search places, addresses…" style={inputStyle} />
          <button type="submit" disabled={searching} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + bdr(AC), background: fill(AC), color: AC, cursor: searching ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, opacity: searching ? 0.5 : 1, whiteSpace: "nowrap" }}>{searching ? "…" : "Search"}</button>
        </form>
        <button onClick={locate} title="My location" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "var(--nv-text)", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 14, lineHeight: 1 }}>📍</button>

        {results.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 12, right: 12, maxHeight: 280, overflowY: "auto", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border-strong)", borderRadius: 10, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", zIndex: 1001 }}>
            {results.map((r, i) => (
              <button key={r.place_id || i} onClick={() => goTo(r)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", borderBottom: i < results.length - 1 ? "1px solid var(--nv-border)" : "none", color: "var(--nv-text)", cursor: "pointer", fontFamily: FF, fontSize: 12.5, lineHeight: 1.4 }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapEl} style={{ flex: 1, minHeight: 0, background: "#0a0c14" }} />

      <div style={{ padding: "5px 12px", fontSize: 10, color: "var(--nv-text-dim)", fontStyle: "italic", borderTop: "1px solid var(--nv-border)", textAlign: "center" }}>
        Map data © OpenStreetMap contributors · Search by Nominatim · Tap the map to drop a pin
      </div>
    </div>
  );
}

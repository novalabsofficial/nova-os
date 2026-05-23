// Weather data helpers for the Atmos app.
//
// We use three free, no-API-key services:
//   - Nominatim (OpenStreetMap) for location search / autocomplete
//   - Open-Meteo for current conditions and 7-day forecast
//   - api.weather.gov for severe-weather alerts (US-only)
//
// All the API-facing functions in here are split into a "build URL" half and
// a "parse JSON" half so the network code can stay tiny in the React component
// AND we can unit-test the parsing without mocking fetch.

// WMO weather codes (used by Open-Meteo) → emoji + human label.
// Reference: https://open-meteo.com/en/docs (search "weather code")
const WMO_MAP = {
  0:  ["☀️",  "Clear"],
  1:  ["🌤️",  "Mainly clear"],
  2:  ["⛅",  "Partly cloudy"],
  3:  ["☁️",  "Overcast"],
  45: ["🌫️",  "Fog"],
  48: ["🌫️",  "Rime fog"],
  51: ["🌦️",  "Light drizzle"],
  53: ["🌦️",  "Drizzle"],
  55: ["🌧️",  "Heavy drizzle"],
  56: ["🌧️",  "Freezing drizzle"],
  57: ["🌧️",  "Freezing drizzle"],
  61: ["🌧️",  "Light rain"],
  63: ["🌧️",  "Rain"],
  65: ["🌧️",  "Heavy rain"],
  66: ["🌧️",  "Freezing rain"],
  67: ["🌧️",  "Freezing rain"],
  71: ["🌨️",  "Light snow"],
  73: ["🌨️",  "Snow"],
  75: ["❄️",  "Heavy snow"],
  77: ["🌨️",  "Snow grains"],
  80: ["🌦️",  "Rain showers"],
  81: ["🌧️",  "Heavy showers"],
  82: ["⛈️",  "Violent showers"],
  85: ["🌨️",  "Snow showers"],
  86: ["❄️",  "Heavy snow showers"],
  95: ["⛈️",  "Thunderstorm"],
  96: ["⛈️",  "Thunderstorm + hail"],
  99: ["⛈️",  "Severe thunderstorm"],
};
export function wmoIcon(code) { return (WMO_MAP[code] || ["❓"])[0]; }
export function wmoLabel(code) { return (WMO_MAP[code] || ["", "Unknown"])[1]; }

/** Build a Nominatim search URL for an autocomplete query. */
export function geocodeUrl(query, limit = 5) {
  const q = encodeURIComponent(String(query || "").trim());
  return "https://nominatim.openstreetmap.org/search?q=" + q +
    "&format=json&limit=" + limit + "&addressdetails=1";
}

/**
 * Parse a Nominatim response into a tidy array of suggestions. Each entry has
 * a short display name (e.g. "Atlanta, Georgia, US") and the lat/lon as numbers.
 */
export function parseGeocode(json) {
  if (!Array.isArray(json)) return [];
  return json.map(r => {
    const addr = r.address || {};
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || "";
    const region = addr.state || addr.region || "";
    const country = addr.country_code ? addr.country_code.toUpperCase() : (addr.country || "");
    const parts = [city, region, country].filter(Boolean);
    const short = parts.join(", ") || r.display_name || "(unnamed)";
    return {
      label: short,
      fullName: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      countryCode: addr.country_code ? addr.country_code.toUpperCase() : null,
    };
  }).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

/** Build an Open-Meteo forecast URL for the given lat/lon. */
export function forecastUrl(lat, lon, units = "imperial") {
  const tempUnit = units === "metric" ? "celsius" : "fahrenheit";
  const windUnit = units === "metric" ? "kmh" : "mph";
  return "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + lat + "&longitude=" + lon +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset" +
    "&temperature_unit=" + tempUnit + "&wind_speed_unit=" + windUnit +
    "&timezone=auto&forecast_days=7";
}

/**
 * Reshape the Open-Meteo response into something the UI can render without
 * a bunch of repetitive lookups. Returns null on malformed input.
 */
export function parseForecast(json) {
  if (!json || !json.current || !json.daily) return null;
  const cur = json.current;
  const dailyT = json.daily.time || [];
  const dailyCode = json.daily.weather_code || [];
  const dailyMax = json.daily.temperature_2m_max || [];
  const dailyMin = json.daily.temperature_2m_min || [];
  const dailyPrcp = json.daily.precipitation_sum || [];

  const days = dailyT.map((t, i) => ({
    date: t,                          // "2026-05-15"
    code: dailyCode[i],
    high: dailyMax[i],
    low:  dailyMin[i],
    precipitation: dailyPrcp[i],
  }));

  const hourlyT = json.hourly?.time || [];
  const hourlyTemp = json.hourly?.temperature_2m || [];
  const hourlyCode = json.hourly?.weather_code || [];
  const hourlyPop  = json.hourly?.precipitation_probability || [];
  // Slice to next 24 hours starting from the current time
  const nowMs = Date.now();
  const startIdx = Math.max(0, hourlyT.findIndex(t => new Date(t).getTime() >= nowMs));
  const hourly = [];
  for (let i = startIdx; i < startIdx + 24 && i < hourlyT.length; i++) {
    hourly.push({
      time: hourlyT[i],
      temp: hourlyTemp[i],
      code: hourlyCode[i],
      pop: hourlyPop[i],
    });
  }

  return {
    current: {
      temp: cur.temperature_2m,
      feelsLike: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      code: cur.weather_code,
      wind: cur.wind_speed_10m,
      windDir: cur.wind_direction_10m,
    },
    days,
    hourly,
    units: {
      temp: json.current_units?.temperature_2m || "°",
      wind: json.current_units?.wind_speed_10m || "",
    },
    timezone: json.timezone || null,
  };
}

/** Build an api.weather.gov active-alerts URL. */
export function alertsUrl(lat, lon) {
  return "https://api.weather.gov/alerts/active?point=" + lat + "," + lon;
}

/** Parse the NWS GeoJSON alerts response into UI-friendly entries. */
export function parseAlerts(json) {
  if (!json || !Array.isArray(json.features)) return [];
  return json.features.map(f => {
    const p = f.properties || {};
    return {
      id: f.id || p.id || Math.random().toString(36),
      event: p.event || "Alert",
      severity: p.severity || "Unknown",     // Minor | Moderate | Severe | Extreme
      urgency: p.urgency || null,
      headline: p.headline || "",
      description: p.description || "",
      sender: p.senderName || "",
      effective: p.effective || null,
      expires: p.expires || null,
    };
  });
}

/** True if the lat/lon falls inside the US (approximate). */
export function isLikelyUS(lat, lon) {
  // Contiguous + Alaska + Hawaii rough bbox. Misses territories; good enough
  // to decide whether to even hit api.weather.gov.
  if (lat == null || lon == null) return false;
  // Contiguous US
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) return true;
  // Alaska
  if (lat >= 51 && lat <= 72 && lon >= -180 && lon <= -130) return true;
  // Hawaii
  if (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) return true;
  return false;
}

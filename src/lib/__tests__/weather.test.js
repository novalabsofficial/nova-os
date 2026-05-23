import { describe, it, expect } from 'vitest';
import {
  wmoIcon, wmoLabel,
  geocodeUrl, parseGeocode,
  forecastUrl, parseForecast,
  alertsUrl, parseAlerts,
  isLikelyUS,
} from '../weather.js';

describe('wmoIcon / wmoLabel', () => {
  it('returns sensible values for known codes', () => {
    expect(wmoIcon(0)).toBe('☀️');
    expect(wmoLabel(0)).toBe('Clear');
    expect(wmoLabel(95)).toBe('Thunderstorm');
  });

  it('gracefully handles unknown codes', () => {
    expect(wmoIcon(999)).toBe('❓');
    expect(wmoLabel(999)).toBe('Unknown');
  });
});

describe('geocodeUrl', () => {
  it('URL-encodes the query', () => {
    expect(geocodeUrl('New York')).toContain('q=New%20York');
    expect(geocodeUrl('São Paulo')).toContain('q=S%C3%A3o%20Paulo');
  });

  it('includes the format=json + limit parameters', () => {
    const u = geocodeUrl('paris', 7);
    expect(u).toContain('format=json');
    expect(u).toContain('limit=7');
  });

  it('trims whitespace', () => {
    expect(geocodeUrl('  paris  ')).toContain('q=paris');
  });

  it('points at the Nominatim endpoint', () => {
    expect(geocodeUrl('x')).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
  });
});

describe('parseGeocode', () => {
  it('handles malformed input safely', () => {
    expect(parseGeocode(null)).toEqual([]);
    expect(parseGeocode(undefined)).toEqual([]);
    expect(parseGeocode({})).toEqual([]);
  });

  it('extracts a clean label and numeric coords', () => {
    const sample = [{
      lat: '40.7128', lon: '-74.0060',
      display_name: 'New York City, NY, United States',
      address: { city: 'New York City', state: 'New York', country_code: 'us', country: 'United States' },
    }];
    const out = parseGeocode(sample);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeCloseTo(40.7128);
    expect(out[0].lon).toBeCloseTo(-74.006);
    expect(out[0].countryCode).toBe('US');
    expect(out[0].label).toMatch(/New York City/);
  });

  it('falls back through city/town/village when "city" is missing', () => {
    const sample = [{
      lat: '1', lon: '2',
      display_name: 'Somewhere',
      address: { village: 'Tinytown', country_code: 'us' },
    }];
    expect(parseGeocode(sample)[0].label).toMatch(/Tinytown/);
  });

  it('drops entries with non-numeric lat/lon', () => {
    const sample = [
      { lat: 'abc', lon: '1', display_name: 'x' },
      { lat: '1', lon: 'abc', display_name: 'y' },
      { lat: '1', lon: '2',   display_name: 'z' },
    ];
    expect(parseGeocode(sample)).toHaveLength(1);
  });
});

describe('forecastUrl', () => {
  it('includes lat and lon', () => {
    const u = forecastUrl(40.7, -74);
    expect(u).toContain('latitude=40.7');
    expect(u).toContain('longitude=-74');
  });

  it('defaults to Fahrenheit / mph', () => {
    const u = forecastUrl(0, 0);
    expect(u).toContain('temperature_unit=fahrenheit');
    expect(u).toContain('wind_speed_unit=mph');
  });

  it('honors metric units when asked', () => {
    const u = forecastUrl(0, 0, 'metric');
    expect(u).toContain('temperature_unit=celsius');
    expect(u).toContain('wind_speed_unit=kmh');
  });

  it('requests 7-day forecast with timezone auto-detection', () => {
    const u = forecastUrl(0, 0);
    expect(u).toContain('forecast_days=7');
    expect(u).toContain('timezone=auto');
  });
});

describe('parseForecast', () => {
  it('returns null for malformed input', () => {
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({})).toBeNull();
  });

  it('extracts current conditions and a list of daily entries', () => {
    const sample = {
      current: { temperature_2m: 70, apparent_temperature: 68, relative_humidity_2m: 55, weather_code: 1, wind_speed_10m: 5, wind_direction_10m: 180 },
      daily: {
        time: ['2026-05-15', '2026-05-16'],
        weather_code: [0, 3],
        temperature_2m_max: [78, 72],
        temperature_2m_min: [55, 58],
        precipitation_sum: [0, 0.3],
      },
      timezone: 'America/New_York',
      current_units: { temperature_2m: '°F', wind_speed_10m: 'mph' },
    };
    const out = parseForecast(sample);
    expect(out.current.temp).toBe(70);
    expect(out.days).toHaveLength(2);
    expect(out.days[0].high).toBe(78);
    expect(out.days[1].code).toBe(3);
    expect(out.units.temp).toBe('°F');
    expect(out.timezone).toBe('America/New_York');
  });

  it('handles a missing hourly block without crashing', () => {
    const sample = {
      current: { temperature_2m: 70, weather_code: 1 },
      daily: { time: ['2026-05-15'], weather_code: [0], temperature_2m_max: [80], temperature_2m_min: [60], precipitation_sum: [0] },
    };
    const out = parseForecast(sample);
    expect(out.hourly).toEqual([]);
  });
});

describe('alertsUrl', () => {
  it('builds the NWS active-alerts endpoint', () => {
    expect(alertsUrl(40.7, -74)).toBe('https://api.weather.gov/alerts/active?point=40.7,-74');
  });
});

describe('parseAlerts', () => {
  it('returns [] for malformed input', () => {
    expect(parseAlerts(null)).toEqual([]);
    expect(parseAlerts({})).toEqual([]);
    expect(parseAlerts({ features: 'oops' })).toEqual([]);
  });

  it('extracts useful fields from each feature', () => {
    const sample = {
      features: [{
        id: 'alert-1',
        properties: {
          event: 'Tornado Warning',
          severity: 'Severe',
          urgency: 'Immediate',
          headline: 'Tornado near You',
          description: 'Take shelter immediately.',
          senderName: 'NWS',
          effective: '2026-05-15T12:00:00Z',
          expires: '2026-05-15T13:00:00Z',
        },
      }],
    };
    const out = parseAlerts(sample);
    expect(out).toHaveLength(1);
    expect(out[0].event).toBe('Tornado Warning');
    expect(out[0].severity).toBe('Severe');
    expect(out[0].headline).toMatch(/Tornado/);
  });
});

describe('isLikelyUS', () => {
  it('recognizes contiguous-US points', () => {
    expect(isLikelyUS(40.7, -74)).toBe(true);     // NYC
    expect(isLikelyUS(34.05, -118.24)).toBe(true); // LA
    expect(isLikelyUS(41.88, -87.63)).toBe(true);  // Chicago
  });

  it('recognizes Alaska and Hawaii', () => {
    expect(isLikelyUS(61.2, -149.9)).toBe(true);   // Anchorage
    expect(isLikelyUS(21.3, -157.85)).toBe(true);  // Honolulu
  });

  it('rejects clearly non-US points', () => {
    expect(isLikelyUS(48.85, 2.35)).toBe(false);   // Paris
    expect(isLikelyUS(35.68, 139.69)).toBe(false); // Tokyo
    expect(isLikelyUS(-33.86, 151.21)).toBe(false); // Sydney
  });

  it('handles null/undefined safely', () => {
    expect(isLikelyUS(null, null)).toBe(false);
    expect(isLikelyUS(undefined, undefined)).toBe(false);
  });
});

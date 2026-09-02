import type { APIRoute } from 'astro';

export const prerender = false;

// The Ávila, as seen from Caracas
const LAT = 10.4806;
const LON = -66.9036;
const PLACE = 'Caracas';

const SOURCE =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  '&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,is_day,weather_code' +
  '&timezone=America%2FCaracas';

/*
 * This deployment is a single long-lived Node process (the astro node adapter
 * in standalone mode), so a module-scope cache genuinely persists between
 * requests and one fetch serves everyone for ten minutes. On a serverless
 * host each invocation can be a cold start and this would cache almost
 * nothing - the same code would quietly become useless.
 */
const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; payload: string } | null = null;

// WMO weather interpretation codes, collapsed to the ones Caracas sees
const CODES: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  80: 'rain showers', 81: 'rain showers', 82: 'violent showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

export const GET: APIRoute = async () => {
  const fresh = cached && Date.now() - cached.at < TTL_MS;

  if (fresh) {
    return json(cached!.payload, { 'X-Cache': 'hit' });
  }

  try {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} from open-meteo`);

    const data = await response.json();
    const c = data?.current;
    if (!c) throw new Error('no current block in open-meteo response');

    const code = Number(c.weather_code);
    const payload = JSON.stringify({
      place: PLACE,
      temp: Math.round(Number(c.temperature_2m)),
      humidity: Number(c.relative_humidity_2m),
      precipitation: Number(c.precipitation) || 0,
      cloudCover: Number(c.cloud_cover) || 0,
      isDay: c.is_day === 1,
      code,
      label: CODES[code] || 'unsettled',
      localTime: c.time,
    });

    cached = { at: Date.now(), payload };
    return json(payload, { 'X-Cache': 'miss' });
  } catch (error) {
    console.error('Weather fetch failed:', error);

    // Serving a stale reading beats serving nothing - the sky changes slowly
    if (cached) {
      return json(cached.payload, { 'X-Cache': 'stale' });
    }

    return new Response(
      JSON.stringify({ error: 'Weather unavailable', details: String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
};

function json(payload: string, extra: Record<string, string> = {}) {
  return new Response(payload, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...extra },
  });
}

import type { APIRoute } from 'astro';

export const prerender = false;

// Fallback when we cannot place the visitor: the Ávila, seen from Caracas
const FALLBACK = { lat: 10.4806, lon: -66.9036, place: 'Caracas', source: 'default' };

const TTL_MS = 10 * 60 * 1000;

/*
 * Keyed by rounded coordinates, not global. A single shared slot would hand
 * the first visitor's city to everyone who came after them.
 *
 * Bounded, because the key now derives from visitor input and an unbounded
 * map keyed on that is a slow memory leak at best.
 */
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; payload: string }>();

function remember(key: string, payload: string) {
  cache.set(key, { at: Date.now(), payload });
  if (cache.size > MAX_ENTRIES) {
    // Map preserves insertion order, so the oldest key is the first one
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

type Loc = { lat: number; lon: number; place: string; source: string };

const CODES: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'violent showers',
  85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

/* A LAN or loopback address geolocates to nothing, so skip the lookup
   entirely when browsing from inside the house. */
function isPrivateAddress(ip: string): boolean {
  return (
    !ip ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/* Cloudflare can attach visitor location headers at the edge, which is the
   cheapest and most accurate source and needs no third party. It requires
   the "Add visitor location headers" managed transform to be switched on. */
function fromCloudflare(headers: Headers): Loc | null {
  const lat = Number(headers.get('cf-iplatitude'));
  const lon = Number(headers.get('cf-iplongitude'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;

  const place = headers.get('cf-ipcity') || headers.get('cf-ipcountry') || 'your corner of the world';
  return { lat, lon, place, source: 'cloudflare' };
}

async function fromIpLookup(headers: Headers): Promise<Loc | null> {
  const ip = (headers.get('cf-connecting-ip') || headers.get('x-forwarded-for') || '')
    .split(',')[0]
    .trim();

  if (isPrivateAddress(ip)) return null;

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.success) return null;

    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon, place: data.city || data.country || 'your area', source: 'ip' };
  } catch {
    return null;
  }
}

async function locate(headers: Headers): Promise<Loc> {
  return fromCloudflare(headers) || (await fromIpLookup(headers)) || FALLBACK;
}

export const GET: APIRoute = async ({ request }) => {
  const loc = await locate(request.headers);
  const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return json(hit.payload, { 'X-Cache': 'hit', 'X-Geo': loc.source });
  }

  try {
    // timezone=auto makes open-meteo report times in the visitor's own zone,
    // which is what drives the time-of-day tint
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      '&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,is_day,weather_code' +
      '&timezone=auto';

    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} from open-meteo`);

    const data = await response.json();
    const c = data?.current;
    if (!c) throw new Error('no current block in open-meteo response');

    const code = Number(c.weather_code);
    const payload = JSON.stringify({
      place: loc.place,
      temp: Math.round(Number(c.temperature_2m)),
      humidity: Number(c.relative_humidity_2m),
      precipitation: Number(c.precipitation) || 0,
      cloudCover: Number(c.cloud_cover) || 0,
      isDay: c.is_day === 1,
      code,
      label: CODES[code] || 'unsettled',
      localTime: c.time,
    });

    remember(key, payload);
    return json(payload, { 'X-Cache': 'miss', 'X-Geo': loc.source });
  } catch (error) {
    console.error('Weather fetch failed:', error);

    // A stale reading beats none - the sky changes slowly
    if (hit) return json(hit.payload, { 'X-Cache': 'stale', 'X-Geo': loc.source });

    return new Response(
      JSON.stringify({ error: 'Weather unavailable', details: String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
};

function json(payload: string, extra: Record<string, string> = {}) {
  return new Response(payload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      /* private, not public: this response is specific to one visitor's
         location and a shared cache must never hand it to the next person */
      'Cache-Control': 'private, max-age=300',
      ...extra,
    },
  });
}

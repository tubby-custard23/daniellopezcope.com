/*
 * Local sky: the site is bright in the visitor's daytime and dark at night,
 * shaded by their actual weather.
 *
 * The light/dark decision uses open-meteo's is_day rather than an hour
 * cutoff, so it tracks real sunrise and sunset instead of guessing that
 * "day" means 7am-7pm everywhere on earth.
 *
 * Three gradient stops are written as CSS variables on the root element and
 * the stylesheet consumes them, so no extra overlay elements are needed and
 * the theme can shift without touching any markup.
 */

import { setRain } from './rain';

export type Sky = {
  place: string;
  temp: number;
  humidity: number;
  precipitation: number;
  cloudCover: number;
  isDay: boolean;
  code: number;
  label: string;
  localTime: string;
};

const CACHE_KEY = 'dlc.sky.v1';
const CACHE_MS = 5 * 60 * 1000;

let current: Sky | null = null;
const subscribers = new Set<(sky: Sky) => void>();

export function getSky(): Sky | null {
  return current;
}

/** Subscribe to sky updates. Fires immediately if a reading is already in. */
export function onSky(fn: (sky: Sky) => void) {
  subscribers.add(fn);
  if (current) fn(current);
}

type Stops = [number[], number[], number[]];

const DAY_CLEAR: Stops    = [[188, 216, 239], [231, 226, 213], [221, 210, 189]];
const DAY_OVERCAST: Stops = [[185, 192, 198], [211, 211, 208], [201, 198, 189]];
const NIGHT_CLEAR: Stops  = [[10, 13, 24],    [10, 10, 10],    [8, 8, 10]];
const NIGHT_OVERCAST: Stops = [[16, 19, 28],  [13, 13, 16],    [10, 10, 12]];

function blend(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function blendStops(a: Stops, b: Stops, t: number): Stops {
  return [blend(a[0], b[0], t), blend(a[1], b[1], t), blend(a[2], b[2], t)];
}

function rgb(c: number[]) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* Dark Tales is meant to be night whatever the weather is doing. */
function pageWantsDaylight(): boolean {
  return !document.body.classList.contains('always-night');
}

export function applySky(sky: Sky | null) {
  if (!sky) return;
  current = sky;

  const root = document.documentElement;
  const cloud = Math.min(1, Math.max(0, sky.cloudCover / 100));
  const daylight = sky.isDay && pageWantsDaylight();

  const stops = daylight
    ? blendStops(DAY_CLEAR, DAY_OVERCAST, cloud)
    : blendStops(NIGHT_CLEAR, NIGHT_OVERCAST, cloud);

  root.style.setProperty('--sky-top', rgb(stops[0]));
  root.style.setProperty('--sky-mid', rgb(stops[1]));
  root.style.setProperty('--sky-bot', rgb(stops[2]));

  root.classList.toggle('day', daylight);
  root.classList.toggle('night', !daylight);

  subscribers.forEach(fn => fn(sky));

  // open-meteo reports mm in the last hour; 2mm is already a downpour
  setRain('weather', Math.min(1, sky.precipitation / 2));
}

function readCache(): Sky | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, sky } = JSON.parse(raw);
    return Date.now() - at < CACHE_MS ? sky : sky; // stale is still worth painting
  } catch {
    return null;
  }
}

function writeCache(sky: Sky) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), sky }));
  } catch {
    /* private mode */
  }
}

/**
 * Paint the last known sky immediately, then refresh from the network.
 * Without the cached first pass every load would flash dark before turning
 * light, because the markup defaults to the night palette.
 */
export async function startSky() {
  const cached = readCache();
  if (cached) applySky(cached);

  try {
    const response = await fetch('/api/weather');
    if (!response.ok) return;

    const sky: Sky = await response.json();
    writeCache(sky);
    applySky(sky);
  } catch {
    /* keep whatever is on screen - weather must never break the page */
  }
}

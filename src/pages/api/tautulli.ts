import type { APIRoute } from 'astro';

export const prerender = false;

const TAUTULLI_URL = 'https://tautulli.kyoshiisland.com/api/v2';
const USER_ID = '110160931';

export const GET: APIRoute = async () => {
  const API_KEY = process.env.TAUTULLI_API_KEY || import.meta.env.TAUTULLI_API_KEY;

  // Failures must never be cached - a 5 minute max-age would pin a broken
  // response in front of every visitor long after the problem is fixed.
  const fail = (status: number, error: string, details: string) =>
    new Response(JSON.stringify({ error, details }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  if (!API_KEY) {
    return fail(500, 'API key not configured', 'TAUTULLI_API_KEY is not set in the environment');
  }

  try {
    const url = `${TAUTULLI_URL}?apikey=${API_KEY}&cmd=get_history&user_id=${USER_ID}&length=5`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = await response.text();

    let data: any = null;
    try {
      data = JSON.parse(body);
    } catch {
      // non-JSON body - fall through to the error below
    }

    // Tautulli reports a bad key or command in the payload, and pairs it with
    // either a 200 or a 4xx depending on version, so check both.
    if (!response.ok || data?.response?.result !== 'success') {
      const details = data?.response?.message
        || (response.ok ? 'Unknown Tautulli error' : `HTTP ${response.status} from Tautulli`);
      console.error('Tautulli error:', response.status, details);
      return fail(502, 'Tautulli rejected the request', details);
    }

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('Tautulli fetch error:', error);
    return fail(502, 'Failed to reach Tautulli', String(error));
  }
};

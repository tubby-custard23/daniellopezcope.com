import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const TAUTULLI_URL = 'https://tautulli.kyoshiisland.com/api/v2';
  const API_KEY = process.env.TAUTULLI_API_KEY || import.meta.env.TAUTULLI_API_KEY;
  const USER_ID = '110160931';

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured', debug: 'No API key found in environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = `${TAUTULLI_URL}?apikey=${API_KEY}&cmd=get_history&user_id=${USER_ID}&length=5`;
    console.log('Fetching from Tautulli:', url.replace(API_KEY, '***'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('Tautulli response:', JSON.stringify(data).substring(0, 500));

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('Tautulli fetch error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from Tautulli', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

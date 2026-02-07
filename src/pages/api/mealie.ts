import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const MEALIE_URL = 'https://mealie.kyoshiisland.com/api/recipes';
  const API_TOKEN = process.env.MEALIE_API_TOKEN || import.meta.env.MEALIE_API_TOKEN;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Add auth header if token is available
    if (API_TOKEN) {
      headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }

    const response = await fetch(`${MEALIE_URL}?page=1&perPage=10&orderBy=created_at&orderDirection=desc`, {
      headers
    });

    if (!response.ok) {
      console.error('Mealie API error:', response.status, response.statusText);
      return new Response(JSON.stringify({ error: 'Failed to fetch recipes', status: response.status }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('Mealie fetch error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from Mealie', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

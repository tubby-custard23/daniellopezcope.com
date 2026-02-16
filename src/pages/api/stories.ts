import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';

export const GET: APIRoute = async () => {
  const NOTION_TOKEN = process.env.NOTION_TOKEN || import.meta.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_STORIES_DB || import.meta.env.NOTION_STORIES_DB;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return new Response(JSON.stringify({ error: 'Missing Notion credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const notion = new Client({ auth: NOTION_TOKEN });

    const response = await notion.dataSources.query({
      data_source_id: DATABASE_ID,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true
        }
      },
      sorts: [
        {
          property: 'Date',
          direction: 'descending'
        }
      ]
    });

    const stories = response.results.map((page: any) => {
      const properties = page.properties;

      return {
        id: page.id,
        title: properties.Name?.title?.[0]?.plain_text || 'Untitled',
        content: properties.Content?.rich_text?.[0]?.plain_text || '',
        date: properties.Date?.date?.start || null,
        category: properties.Category?.select?.name || 'Uncategorized',
      };
    });

    return new Response(JSON.stringify({ stories }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Notion API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch stories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

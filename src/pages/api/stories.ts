import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';

// Convert Notion rich_text to HTML, preserving links and basic formatting
function richTextToHtml(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';

  return richText.map((block: any) => {
    let text = block.plain_text || '';

    // Escape HTML entities
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply annotations
    if (block.annotations) {
      if (block.annotations.bold) text = `<strong>${text}</strong>`;
      if (block.annotations.italic) text = `<em>${text}</em>`;
      if (block.annotations.underline) text = `<u>${text}</u>`;
      if (block.annotations.strikethrough) text = `<s>${text}</s>`;
      if (block.annotations.code) text = `<code>${text}</code>`;
    }

    // Wrap in link if present
    if (block.href) {
      text = `<a href="${block.href}" target="_blank" rel="noopener noreferrer" class="text-dusty-teal hover:text-white transition-colors">${text}</a>`;
    }

    return text;
  }).join('');
}

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

      // Get cover image - check CoverURL (URL property), Cover (files property), or page cover
      let coverImage = null;
      if (properties.CoverURL?.url) {
        coverImage = properties.CoverURL.url;
      } else if (properties.Cover?.files?.[0]) {
        const file = properties.Cover.files[0];
        coverImage = file.file?.url || file.external?.url || null;
      } else if (page.cover) {
        coverImage = page.cover.file?.url || page.cover.external?.url || null;
      }

      return {
        id: page.id,
        title: properties.Name?.title?.[0]?.plain_text || 'Untitled',
        content: richTextToHtml(properties.Content?.rich_text),
        date: properties.Date?.date?.start || null,
        category: properties.Category?.select?.name || 'Uncategorized',
        coverImage,
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

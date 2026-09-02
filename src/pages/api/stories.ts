import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';

export const prerender = false;

// Convert Notion rich_text to paragraph HTML, preserving links and formatting.
//
// Each run is split on newlines and every segment is wrapped in its own
// annotation tags before the paragraphs are assembled. Splitting the joined
// HTML instead would let a paragraph break fall inside a <strong> or an <a>
// that spans a newline, producing unbalanced tags.
function richTextToHtml(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';

  const BREAK = '\u0000';

  const inline = richText.map((block: any) => {
    const annotations = block.annotations;
    const href = block.href;

    return String(block.plain_text || '').split('\n').map((segment: string) => {
      let text = segment
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (annotations) {
        if (annotations.bold) text = `<strong>${text}</strong>`;
        if (annotations.italic) text = `<em>${text}</em>`;
        if (annotations.underline) text = `<u>${text}</u>`;
        if (annotations.strikethrough) text = `<s>${text}</s>`;
        if (annotations.code) text = `<code>${text}</code>`;
      }

      if (href) {
        text = `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="text-dusty-teal hover:text-white transition-colors">${text}</a>`;
      }

      return text;
    }).join(BREAK);
  }).join('');

  return inline
    .split(BREAK)
    .map(part => part.trim())
    // a segment of pure markup with no text is a blank line, not a paragraph
    .filter(part => part.replace(/<[^>]*>/g, '').trim().length > 0)
    .map(part => `<p>${part}</p>`)
    .join('');
}

export const GET: APIRoute = async () => {
  const NOTION_TOKEN = process.env.NOTION_TOKEN || import.meta.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_STORIES_DB || import.meta.env.NOTION_STORIES_DB;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return new Response(JSON.stringify({ error: 'Missing Notion credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
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
        mood: properties.Mood?.select?.name || null,
        coverImage,
      };
    });

    return new Response(JSON.stringify({ stories }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('Notion API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch stories', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
};

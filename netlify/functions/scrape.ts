import { ApifyClient } from 'apify-client';

// Netlify Function: /.netlify/functions/scrape
export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const token = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN || '';
    if (!token) {
      return { statusCode: 500, body: JSON.stringify({ error: 'APIFY token missing' }) };
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];

    const client = new ApifyClient({ token });
    const input = { profileUrls: urls } as any;

    const run = await client.actor('2SyF0bVxmgGr8IVCZ').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'Scrape failed' }) };
  }
};


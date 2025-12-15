import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApifyClient } from 'apify-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const token = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN || '';
    if (!token) {
      res.status(500).json({ error: 'APIFY token missing' });
      return;
    }

    const urls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : [];

    const client = new ApifyClient({ token });
    const input = { profileUrls: urls } as any;

    // LinkedIn Profile Scraper actor
    const run = await client.actor('2SyF0bVxmgGr8IVCZ').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Return raw items so frontend can preview and decide mapping
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(items));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Scrape failed' });
  }
}


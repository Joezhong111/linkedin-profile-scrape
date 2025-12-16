import { ApifyClient } from "apify-client";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const token = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN || "";
    if (!token) {
      res.status(500).json({ error: "APIFY token missing" });
      return;
    }

    const urls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : [];

    const client = new ApifyClient({ token });

    try {
      const input: any = {
        profileUrls: urls,
        proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
      };

      const run = await client.actor("2SyF0bVxmgGr8IVCZ").call(input);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      res.setHeader("Content-Type", "application/json");
      res.status(200).send(JSON.stringify(items));
    } catch (err: any) {
      res.status(504).json({ error: err?.message || "Scrape failed" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Scrape failed" });
  }
}

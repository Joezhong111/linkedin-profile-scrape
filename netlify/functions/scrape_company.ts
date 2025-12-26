import { ApifyClient } from "apify-client";
import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { apifyQuotas, apifyUsage } from "../../db/schema";
import { eq, and } from "drizzle-orm";

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

// Netlify Function: /.netlify/functions/scrape_company
export const handler = async (event: any) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const apifyToken =
      process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN || "";
    if (!apifyToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "APIFY token missing" }),
      };
    }

    // Auth: require Authorization bearer (user token)
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Invalid token" };

    const userId = user.id;

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body || "{}")
        : event.body || {};

    const companyUrl = body.companyUrl;
    const maxItems = Number(body.maxItems) || 25;
    const profileScraperMode = body.profileScraperMode || "Full ($8 per 1k)";

    // Optional array filters
    const jobTitles = Array.isArray(body.jobTitles) ? body.jobTitles : [];
    const locations = Array.isArray(body.locations) ? body.locations : [];
    const yearsAtCurrentCompanyIds = Array.isArray(body.yearsAtCurrentCompanyIds) ? body.yearsAtCurrentCompanyIds : [];
    const yearsOfExperienceIds = Array.isArray(body.yearsOfExperienceIds) ? body.yearsOfExperienceIds : [];

    if (!companyUrl || typeof companyUrl !== 'string' || !companyUrl.startsWith("http")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid company URL" }),
      };
    }

    // Quota: count by requested maxItems to be safe
    const day = utcDay();

    // Read quota and usage
    const [quotaRow] = await db
      .select()
      .from(apifyQuotas)
      .where(eq(apifyQuotas.userId, userId))
      .limit(1);

    const limit = Number(quotaRow?.dailyLimit ?? 0);

    if (!limit) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Quota disabled", remaining: 0 }),
      };
    }

    const [usageRow] = await db
      .select()
      .from(apifyUsage)
      .where(and(eq(apifyUsage.userId, userId), eq(apifyUsage.day, day)))
      .limit(1);

    const used = Number(usageRow?.usedCount ?? 0);
    const remaining = Math.max(0, limit - used);

    if (maxItems > remaining) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Daily quota exceeded (based on maxItems)", remaining }),
      };
    }

    const client = new ApifyClient({ token: apifyToken });

    // Actor input for Vb6LZkh4EqRlR0Ka9
    const input: any = {
      "profileScraperMode": profileScraperMode,
      "maxItems": maxItems,
      "companies": [companyUrl],
      "companyBatchMode": "all_at_once"
    };

    if (jobTitles.length > 0) input.jobTitles = jobTitles;
    if (locations.length > 0) input.locations = locations;
    if (yearsAtCurrentCompanyIds.length > 0) input.yearsAtCurrentCompanyIds = yearsAtCurrentCompanyIds;
    if (yearsOfExperienceIds.length > 0) input.yearsOfExperienceIds = yearsOfExperienceIds;

    console.log("Apify Input:", JSON.stringify(input));
    const run = await client.actor("Vb6LZkh4EqRlR0Ka9").call(input);
    console.log("Run finished:", run.id, run.status);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log("Items fetched:", items.length);

    // Update usage: consume by actual items returned? 
    // Usually better to consume by what we asked for or what we got. 
    // Let's consume by what we got + 1 (min charge) or just items.length. 
    // Implementation plan said "update apifyUsage", let's use items.length for accuracy
    // BUT if the user spams empty searches they might not be charged. 
    // Let's stick to items.length for now as per "Results from dataset" logic.
    const consumed = items.length;

    try {
      await db
        .insert(apifyUsage)
        .values({
          userId,
          day,
          usedCount: used + consumed,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [apifyUsage.userId, apifyUsage.day],
          set: {
            usedCount: used + consumed,
            updatedAt: new Date().toISOString(),
          },
        });
    } catch (writeErr: any) {
      console.error("usage upsert error", writeErr?.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Scrape failed" }),
    };
  }
};

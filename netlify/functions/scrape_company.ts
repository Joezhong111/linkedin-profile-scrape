import { ApifyClient } from "apify-client";
import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { monthlyQuotas, monthlyUsage } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentMonthPeriod } from "../../lib/quota-server";

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

    // Quota: monthly limit
    const period = getCurrentMonthPeriod();

    // Read quota and usage
    const [quotaRow] = await db
      .select()
      .from(monthlyQuotas)
      .where(eq(monthlyQuotas.userId, userId))
      .limit(1);

    const limit = Number(quotaRow?.monthlyLimit ?? 0);

    if (!limit) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Quota disabled or not set", remaining: 0 }),
      };
    }

    const [usageRow] = await db
      .select()
      .from(monthlyUsage)
      .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.periodStart, period.start)))
      .limit(1);

    const used = Number(usageRow?.usedCount ?? 0);
    const remaining = Math.max(0, limit - used);

    if (maxItems > remaining) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Monthly quota exceeded (based on maxItems)", remaining }),
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

    const run = await client.actor("Vb6LZkh4EqRlR0Ka9").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Update usage
    const consumed = items.length;

    try {
      await db
        .insert(monthlyUsage)
        .values({
          userId,
          periodStart: period.start,
          periodEnd: period.end,
          usedCount: used + consumed,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [monthlyUsage.userId, monthlyUsage.periodStart],
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

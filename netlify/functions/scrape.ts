import { ApifyClient } from "apify-client";
import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { monthlyQuotas, monthlyUsage } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentMonthPeriod } from "../../lib/quota-server";

// Netlify Function: /.netlify/functions/scrape
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
    const urls: string[] = (Array.isArray(body?.urls) ? body.urls : []).filter(
      (u: any) => typeof u === "string" && u.startsWith("http")
    );

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

    if (urls.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No URLs provided", remaining }),
      };
    }

    if (urls.length > remaining) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Monthly quota exceeded", remaining }),
      };
    }

    const client = new ApifyClient({ token: apifyToken });
    const input = { profileUrls: urls } as any;

    const run = await client.actor("2SyF0bVxmgGr8IVCZ").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Update usage
    const consumed = urls.length;

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

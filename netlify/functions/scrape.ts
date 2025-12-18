import { ApifyClient } from "apify-client";
import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { apifyQuotas, apifyUsage } from "../../db/schema";
import { eq, and } from "drizzle-orm";

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

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

    // Quota: count by requested URLs (conservative, avoids running Apify when over limit)
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

    if (urls.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No URLs provided", remaining }),
      };
    }

    if (urls.length > remaining) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Daily quota exceeded", remaining }),
      };
    }

    const client = new ApifyClient({ token: apifyToken });
    const input = { profileUrls: urls } as any;

    const run = await client.actor("2SyF0bVxmgGr8IVCZ").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Update usage: consume by requested URLs (consistent with preflight)
    const consumed = urls.length;

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
      // Non-fatal: log and continue
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

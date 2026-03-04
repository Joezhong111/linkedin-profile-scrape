import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { companyScrapeHistory } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";

// Netlify Function: /.netlify/functions/check_company_history
export const handler = async (event: any) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Auth: require Authorization bearer (user token)
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Invalid token" };

    const userId = user.id;

    // Get companyUrl from query parameters
    const companyUrl = event.queryStringParameters?.companyUrl;

    if (!companyUrl || typeof companyUrl !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing or invalid companyUrl parameter" }),
      };
    }

    // Query history records for this user and company, ordered by most recent first
    const historyRecords = await db
      .select()
      .from(companyScrapeHistory)
      .where(
        and(
          eq(companyScrapeHistory.ownerId, userId),
          eq(companyScrapeHistory.companyUrl, companyUrl)
        )
      )
      .orderBy(desc(companyScrapeHistory.scrapedAt));

    const hasHistory = historyRecords.length > 0;
    const lastScrape = hasHistory ? historyRecords[0] : null;
    const totalScrapes = historyRecords.length;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hasHistory,
        lastScrape: lastScrape ? {
          scrapedAt: lastScrape.scrapedAt,
          maxItemsRequested: lastScrape.maxItemsRequested,
          itemsReturned: lastScrape.itemsReturned,
          itemsSaved: lastScrape.itemsSaved,
          filtersUsed: lastScrape.filtersUsed,
        } : null,
        totalScrapes,
      }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Failed to check company history" }),
    };
  }
};

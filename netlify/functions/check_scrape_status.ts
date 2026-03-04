import { ApifyClient } from "apify-client";
import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads, companyScrapeHistory, monthlyUsage } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentMonthPeriod } from "../../lib/quota-server";

// Netlify Function: /.netlify/functions/check_scrape_status
export const handler = async (event: any) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const apifyToken = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN || "";
    if (!apifyToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "APIFY token missing" }),
      };
    }

    // Auth
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);
    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Invalid token" };
    const userId = user.id;

    // Get runId and other params from query
    const runId = event.queryStringParameters?.runId;
    const companyUrl = event.queryStringParameters?.companyUrl;
    const maxItems = Number(event.queryStringParameters?.maxItems) || 25;
    const jobTitles = event.queryStringParameters?.jobTitles ? JSON.parse(event.queryStringParameters.jobTitles) : [];
    const locations = event.queryStringParameters?.locations ? JSON.parse(event.queryStringParameters.locations) : [];
    const yearsAtCurrentCompanyIds = event.queryStringParameters?.yearsAtCurrentCompanyIds ? JSON.parse(event.queryStringParameters.yearsAtCurrentCompanyIds) : [];
    const yearsOfExperienceIds = event.queryStringParameters?.yearsOfExperienceIds ? JSON.parse(event.queryStringParameters.yearsOfExperienceIds) : [];

    if (!runId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing runId parameter" }),
      };
    }

    const client = new ApifyClient({ token: apifyToken });

    // Get run status
    const run = await client.run(runId).get();

    console.log('Run status:', run.status);
    console.log('Run stats:', run.stats);

    if (run.status === "RUNNING" || run.status === "READY") {
      // Try to get the log to count scraped profiles
      let scrapedCount = 0;
      try {
        const log = await client.run(runId).log().get();
        if (log) {
          // Count occurrences of "Scraped profile" in the log
          const matches = log.match(/Scraped profile/g);
          scrapedCount = matches ? matches.length : 0;
        }
      } catch (logErr) {
        console.error('Failed to get log:', logErr);
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: run.status,
          message: "Scraping in progress...",
          stats: run.stats,
          scrapedCount, // Add scraped count
        }),
      };
    }

    if (run.status === "FAILED" || run.status === "ABORTED" || run.status === "TIMED-OUT") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: run.status,
          error: "Scraping failed",
        }),
      };
    }

    // Status is SUCCEEDED - get results
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Extract all profileUrls from items
    const profileUrls = items
      .map((item: any) => item.profileUrl || item.linkedinPublicUrl || item.linkedinUrl || item.url)
      .filter((url: string) => url && typeof url === 'string');

    // Check which profiles already exist in the database
    let existingProfiles: any[] = [];
    if (profileUrls.length > 0) {
      existingProfiles = await db
        .select({ profileUrl: linkedinLeads.profileUrl })
        .from(linkedinLeads)
        .where(
          and(
            eq(linkedinLeads.ownerId, userId),
            inArray(linkedinLeads.profileUrl, profileUrls)
          )
        );
    }

    const existingSet = new Set(existingProfiles.map(p => p.profileUrl));
    const newProfiles = profileUrls.filter((url: string) => !existingSet.has(url));

    // Calculate statistics
    const totalReturned = items.length;
    const alreadyExists = existingProfiles.length;
    const newProfilesCount = newProfiles.length;
    const duplicateRate = totalReturned > 0 ? (alreadyExists / totalReturned) * 100 : 0;

    const stats = {
      totalReturned,
      alreadyExists,
      newProfiles: newProfilesCount,
      duplicateRate: Math.round(duplicateRate * 100) / 100,
    };

    // Save scrape history
    if (companyUrl) {
      const filtersUsed: any = {};
      if (jobTitles.length > 0) filtersUsed.jobTitles = jobTitles;
      if (locations.length > 0) filtersUsed.locations = locations;
      if (yearsAtCurrentCompanyIds.length > 0) filtersUsed.yearsAtCurrentCompanyIds = yearsAtCurrentCompanyIds;
      if (yearsOfExperienceIds.length > 0) filtersUsed.yearsOfExperienceIds = yearsOfExperienceIds;

      try {
        await db.insert(companyScrapeHistory).values({
          ownerId: userId,
          companyUrl,
          maxItemsRequested: maxItems,
          itemsReturned: totalReturned,
          itemsSaved: newProfilesCount,
          scrapedAt: new Date().toISOString(),
          filtersUsed: Object.keys(filtersUsed).length > 0 ? filtersUsed : null,
        });
      } catch (historyErr: any) {
        console.error("Failed to save scrape history", historyErr?.message);
      }
    }

    // Update usage
    const period = getCurrentMonthPeriod();
    const consumed = items.length;

    try {
      const [usageRow] = await db
        .select()
        .from(monthlyUsage)
        .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.periodStart, period.start)))
        .limit(1);

      const used = Number(usageRow?.usedCount ?? 0);

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
      body: JSON.stringify({
        status: "SUCCEEDED",
        items,
        stats,
      }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Failed to check scrape status" }),
    };
  }
};

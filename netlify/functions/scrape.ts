import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY as string;

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
    const bearer =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : "";
    if (!bearer) return { statusCode: 401, body: "Unauthorized" };

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: authData, error: authErr } = await authClient.auth.getUser(
      bearer
    );
    if (authErr || !authData?.user)
      return { statusCode: 401, body: "Invalid token" };
    const userId = authData.user.id as string;

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body || "{}")
        : event.body || {};
    const urls: string[] = (Array.isArray(body?.urls) ? body.urls : []).filter(
      (u: any) => typeof u === "string" && u.startsWith("http")
    );

    // Quota: count by requested URLs (conservative, avoids running Apify when over limit)
    const day = utcDay();
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    // Read quota and usage
    const { data: quotaRow } = await sb
      .from("apify_quotas")
      .select("daily_limit")
      .eq("user_id", userId)
      .maybeSingle();
    const limit = Number(quotaRow?.daily_limit ?? 0);

    if (!limit) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Quota disabled", remaining: 0 }),
      };
    }

    const { data: usageRow } = await sb
      .from("apify_usage")
      .select("used_count")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();
    const used = Number(usageRow?.used_count ?? 0);
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
    const upsert = {
      user_id: userId,
      day,
      used_count: used + consumed,
      updated_at: new Date().toISOString(),
    } as any;
    // Upsert usage (RLS allows own write)
    const { error: writeErr } = await sb
      .from("apify_usage")
      .upsert(upsert, { onConflict: "user_id,day" });
    if (writeErr) {
      // Non-fatal: log and continue
      console.error("usage upsert error", writeErr.message);
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

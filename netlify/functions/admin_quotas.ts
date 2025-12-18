import { verifyToken, extractToken, isAdmin } from "../../lib/auth-server";
import { db } from "../../db/client";
import { apifyQuotas, apifyUsage } from "../../db/schema";
import { eq, and } from "drizzle-orm";

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export const handler = async (event: any) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const admin = await isAdmin(user.id);

    if (event.httpMethod === "GET") {
      const day = (event.queryStringParameters?.day as string) || utcDay();
      const qUser = event.queryStringParameters?.user_id as string | undefined;

      if (qUser) {
        const [quota] = await db
          .select()
          .from(apifyQuotas)
          .where(eq(apifyQuotas.userId, qUser))
          .limit(1);

        const [usage] = await db
          .select()
          .from(apifyUsage)
          .where(and(eq(apifyUsage.userId, qUser), eq(apifyUsage.day, day)))
          .limit(1);

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: qUser,
            daily_limit: quota?.dailyLimit ?? 0,
            used_count: usage?.usedCount ?? 0,
            day,
          }),
        };
      }

      // list first N users with quotas (admin only)
      if (!admin) return { statusCode: 403, body: "Forbidden" };

      const quotas = await db.select().from(apifyQuotas).limit(200);

      const result: any[] = [];
      for (const q of quotas) {
        const [u] = await db
          .select()
          .from(apifyUsage)
          .where(and(eq(apifyUsage.userId, q.userId), eq(apifyUsage.day, day)))
          .limit(1);

        result.push({
          user_id: q.userId,
          daily_limit: q.dailyLimit,
          used_count: u?.usedCount ?? 0,
          day,
        });
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      };
    }

    if (event.httpMethod === "POST") {
      if (!admin) return { statusCode: 403, body: "Forbidden" };

      const body =
        typeof event.body === "string"
          ? JSON.parse(event.body || "{}")
          : event.body || {};
      const user_id = body.user_id as string;
      const daily_limit = Number(body.daily_limit);

      if (!user_id || !Number.isFinite(daily_limit))
        return { statusCode: 400, body: "user_id and daily_limit required" };

      await db
        .insert(apifyQuotas)
        .values({
          userId: user_id,
          dailyLimit: daily_limit,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: apifyQuotas.userId,
          set: {
            dailyLimit: daily_limit,
            updatedAt: new Date().toISOString(),
          },
        });

      return { statusCode: 200, body: "OK" };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};

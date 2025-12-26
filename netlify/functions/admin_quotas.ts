import { verifyToken, extractToken, isAdmin } from "../../lib/auth-server";
import { db } from "../../db/client";
import { monthlyQuotas, monthlyUsage, users } from "../../db/schema";
import { eq, and } from "drizzle-orm";

function getCurrentMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
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
      const period = getCurrentMonthPeriod();
      const qEmail = event.queryStringParameters?.email as string | undefined;
      const qUserId = event.queryStringParameters?.user_id as string | undefined;

      // Query by email or user_id
      if (qEmail || qUserId) {
        const [targetUser] = qEmail
          ? await db.select().from(users).where(eq(users.email, qEmail)).limit(1)
          : await db.select().from(users).where(eq(users.id, qUserId!)).limit(1);

        if (!targetUser) {
          return { statusCode: 404, body: "User not found" };
        }

        const [quota] = await db
          .select()
          .from(monthlyQuotas)
          .where(eq(monthlyQuotas.userId, targetUser.id))
          .limit(1);

        const [usage] = await db
          .select()
          .from(monthlyUsage)
          .where(
            and(
              eq(monthlyUsage.userId, targetUser.id),
              eq(monthlyUsage.periodStart, period.start)
            )
          )
          .limit(1);

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: targetUser.id,
            email: targetUser.email,
            monthly_limit: quota?.monthlyLimit ?? 0,
            used_count: usage?.usedCount ?? 0,
            period_start: period.start,
            period_end: period.end,
          }),
        };
      }

      // List all users with quotas (admin only)
      if (!admin) return { statusCode: 403, body: "Forbidden" };

      // Get all users and their quotas
      const allUsers = await db.select().from(users).limit(200);

      const result: any[] = [];
      for (const targetUser of allUsers) {
        const [quota] = await db
          .select()
          .from(monthlyQuotas)
          .where(eq(monthlyQuotas.userId, targetUser.id))
          .limit(1);

        const [usage] = await db
          .select()
          .from(monthlyUsage)
          .where(
            and(
              eq(monthlyUsage.userId, targetUser.id),
              eq(monthlyUsage.periodStart, period.start)
            )
          )
          .limit(1);

        result.push({
          user_id: targetUser.id,
          email: targetUser.email,
          monthly_limit: quota?.monthlyLimit ?? 0,
          used_count: usage?.usedCount ?? 0,
          period_start: period.start,
          period_end: period.end,
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

      const email = body.email as string;
      const user_id = body.user_id as string;
      const monthly_limit = Number(body.monthly_limit);

      if ((!email && !user_id) || !Number.isFinite(monthly_limit))
        return { statusCode: 400, body: "email or user_id and monthly_limit required" };

      // Find user by email or user_id
      const [targetUser] = email
        ? await db.select().from(users).where(eq(users.email, email)).limit(1)
        : await db.select().from(users).where(eq(users.id, user_id)).limit(1);

      if (!targetUser) {
        return { statusCode: 404, body: "User not found" };
      }

      await db
        .insert(monthlyQuotas)
        .values({
          userId: targetUser.id,
          monthlyLimit: monthly_limit,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: monthlyQuotas.userId,
          set: {
            monthlyLimit: monthly_limit,
            updatedAt: new Date().toISOString(),
          },
        });

      return { statusCode: 200, body: "OK" };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (e: any) {
    console.error("Quota handler error:", e);
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};

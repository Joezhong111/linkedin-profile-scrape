import {
  verifyToken,
  extractToken,
  isAdmin,
  createUser,
} from "../../lib/auth-server";
import { db } from "../../db/client";
import { monthlyQuotas } from "../../db/schema";

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST")
      return { statusCode: 405, body: "Method Not Allowed" };

    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    if (!(await isAdmin(user.id)))
      return { statusCode: 403, body: "Forbidden" };

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body || "{}")
        : event.body || {};
    const email = String(body.email || "").trim();
    const password = body.password ? String(body.password) : undefined;
    const fullName = body.fullName ? String(body.fullName) : undefined;
    const monthly_limit = Number.isFinite(Number(body.monthly_limit))
      ? Number(body.monthly_limit)
      : undefined;

    if (!email) return { statusCode: 400, body: "email required" };
    if (!password) return { statusCode: 400, body: "password required" };

    // Create user
    const newUser = await createUser(email, password, fullName);

    // Set quota if provided
    if (monthly_limit !== undefined) {
      await db.insert(monthlyQuotas).values({
        userId: newUser.id,
        monthlyLimit: monthly_limit,
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: newUser.id,
        email: newUser.email,
        monthly_limit,
      }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};

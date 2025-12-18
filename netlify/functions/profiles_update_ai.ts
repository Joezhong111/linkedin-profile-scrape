import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinProfiles } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body || "{}")
        : event.body || {};

    if (!body.id || !body.ai_summary) {
      return { statusCode: 400, body: "id and ai_summary are required" };
    }

    await db
      .update(linkedinProfiles)
      .set({ aiSummary: body.ai_summary })
      .where(
        and(
          eq(linkedinProfiles.id, body.id),
          eq(linkedinProfiles.ownerId, user.id)
        )
      );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};


import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export const handler = async (event: any) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        const token = extractToken(authHeader);

        if (!token) return { statusCode: 401, body: "Unauthorized" };

        const user = await verifyToken(token);
        if (!user) return { statusCode: 401, body: "Unauthorized" };

        const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};

        if (!body.id) {
            return { statusCode: 400, body: "id is required" };
        }

        await db
            .delete(linkedinLeads)
            .where(
                and(
                    eq(linkedinLeads.ownerId, user.id),
                    eq(linkedinLeads.id, body.id)
                )
            );

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (e: any) {
        console.error("Delete lead error:", e);
        return { statusCode: 500, body: e?.message || "Server error" };
    }
};

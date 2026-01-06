import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads } from "../../db/schema";
import { inArray, eq, and } from "drizzle-orm";

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
        const ids: string[] = body.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return { statusCode: 400, body: "ids array is required" };
        }

        // Delete leads that belong to this user
        const result = await db
            .delete(linkedinLeads)
            .where(
                and(
                    eq(linkedinLeads.ownerId, user.id),
                    inArray(linkedinLeads.id, ids)
                )
            )
            .returning({ id: linkedinLeads.id });

        console.log(`Batch deleted ${result.length} leads for user ${user.id}`);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deleted: result.length }),
        };
    } catch (e: any) {
        console.error("Batch delete error:", e);
        return { statusCode: 500, body: e?.message || "Server error" };
    }
};

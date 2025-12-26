import { verifyToken, extractToken, isAdmin, hashPassword } from "../../lib/auth-server";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export const handler = async (event: any) => {
    try {
        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        const token = extractToken(authHeader);

        if (!token) return { statusCode: 401, body: "Unauthorized" };

        const actingUser = await verifyToken(token);
        if (!actingUser) return { statusCode: 401, body: "Unauthorized" };

        if (!(await isAdmin(actingUser.id))) {
            return { statusCode: 403, body: "Forbidden" };
        }

        const { httpMethod } = event;
        const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
        const targetUserId = body.user_id || event.queryStringParameters?.user_id;

        if (!targetUserId) {
            return { statusCode: 400, body: "user_id required" };
        }

        // Prevent self-deletion or self-password change via this admin endpoint if desired,
        // but usually admins can manage themselves. Let's just avoid accidental self-deletion.
        if (httpMethod === "DELETE" && actingUser.id === targetUserId) {
            return { statusCode: 400, body: "Cannot delete yourself" };
        }

        if (httpMethod === "PATCH") {
            const { password } = body;
            if (!password) return { statusCode: 400, body: "password required" };

            const passwordHash = hashPassword(password);
            await db.update(users).set({ passwordHash, updatedAt: new Date().toISOString() }).where(eq(users.id, targetUserId));

            return { statusCode: 200, body: JSON.stringify({ message: "Password updated" }) };
        }

        if (httpMethod === "DELETE") {
            await db.delete(users).where(eq(users.id, targetUserId));
            return { statusCode: 200, body: JSON.stringify({ message: "User deleted" }) };
        }

        return { statusCode: 405, body: "Method Not Allowed" };
    } catch (e: any) {
        console.error("Admin user action error:", e);
        return { statusCode: 500, body: e?.message || "Server error" };
    }
};

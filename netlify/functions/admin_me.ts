import { verifyToken, extractToken, getUserRole } from "../../lib/auth-server";

export const handler = async (event: any) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Missing Authorization" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Invalid token" };

    const role = await getUserRole(user.id);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        role,
        isAdmin: role === "admin",
      }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};

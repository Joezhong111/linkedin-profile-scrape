import { verifyToken, extractToken } from "../../lib/auth-server";

export const handler = async (event: any) => {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) {
      return { statusCode: 401, body: "Missing Authorization" };
    }

    const user = await verifyToken(token);
    if (!user) {
      return { statusCode: 401, body: "Invalid or expired token" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      }),
    };
  } catch (e: any) {
    console.error("Auth me error:", e);
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};


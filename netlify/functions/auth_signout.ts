import { deleteSession, extractToken } from "../../lib/auth-server";

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (token) {
      await deleteSession(token);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (e: any) {
    console.error("Sign out error:", e);
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};


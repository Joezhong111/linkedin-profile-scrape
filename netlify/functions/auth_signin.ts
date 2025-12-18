import { getUserByEmail, verifyPassword, createSession, updateLastLogin } from "../../lib/auth-server";

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
    const email = String(body.email || "").trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return { statusCode: 400, body: "Email and password are required" };
    }

    // Find user
    const user = await getUserByEmail(email);
    if (!user) {
      return { statusCode: 401, body: "Invalid email or password" };
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return { statusCode: 401, body: "Invalid email or password" };
    }

    // Create session
    const session = await createSession(user.id);

    // Update last login
    await updateLastLogin(user.id);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        token: session.token,
        expiresAt: session.expiresAt,
      }),
    };
  } catch (e: any) {
    console.error("Sign in error:", e);
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};


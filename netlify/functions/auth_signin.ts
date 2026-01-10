import { getUserByEmail, verifyPassword, createSession, updateLastLogin } from "../../lib/auth-server";
import { signInSchema } from "../../lib/validation";

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};

    // Validate input using Zod
    const validationResult = signInSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return { statusCode: 400, body: errors };
    }

    const { email, password } = validationResult.data;

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
    if (!session) {
      return { statusCode: 500, body: "Failed to create session" };
    }

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


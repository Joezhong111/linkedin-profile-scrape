import { createUser, getUserByEmail, createSession } from "../../lib/auth-server";
import { db } from "../../db/client";
import { appSettings } from "../../db/schema";

async function isRegistrationOpen(): Promise<boolean> {
  try {
    const [settings] = await db.select().from(appSettings).limit(1);
    return settings?.registrationOpen ?? true;
  } catch {
    return true; // Default to open if settings not found
  }
}

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Check if registration is open
    const registrationOpen = await isRegistrationOpen();
    if (!registrationOpen) {
      return { statusCode: 403, body: "Registration is currently closed" };
    }

    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const fullName = body.fullName ? String(body.fullName).trim() : undefined;

    if (!email || !password) {
      return { statusCode: 400, body: "Email and password are required" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { statusCode: 400, body: "Invalid email format" };
    }

    // Validate password length
    if (password.length < 6) {
      return { statusCode: 400, body: "Password must be at least 6 characters" };
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return { statusCode: 400, body: "User with this email already exists" };
    }

    // Create user
    const user = await createUser(email, password, fullName);

    // Create session
    const session = await createSession(user.id);

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
    console.error("Sign up error:", e);
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};


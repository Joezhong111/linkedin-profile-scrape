import { verifyToken, extractToken, isAdmin } from "../../lib/auth-server";
import { db } from "../../db/client";
import { appSettings } from "../../db/schema";

export const handler = async (event: any) => {
  try {
    if (event.httpMethod === "GET") {
      // Public read for login toggles
      const [settings] = await db.select().from(appSettings).limit(1);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          settings
            ? {
                registration_open: settings.registrationOpen,
                google_oauth_open: settings.googleOauthOpen,
              }
            : { registration_open: true, google_oauth_open: true }
        ),
      };
    }

    if (event.httpMethod === "POST") {
      const authHeader =
        event.headers?.authorization || event.headers?.Authorization;
      const token = extractToken(authHeader);

      if (!token) return { statusCode: 401, body: "Unauthorized" };

      const user = await verifyToken(token);
      if (!user) return { statusCode: 401, body: "Unauthorized" };

      if (!(await isAdmin(user.id)))
        return { statusCode: 403, body: "Forbidden" };

      const body =
        typeof event.body === "string"
          ? JSON.parse(event.body || "{}")
          : event.body || {};
      const registration_open =
        typeof body.registration_open === "boolean"
          ? body.registration_open
          : undefined;
      const google_oauth_open =
        typeof body.google_oauth_open === "boolean"
          ? body.google_oauth_open
          : undefined;

      if (registration_open === undefined && google_oauth_open === undefined) {
        return { statusCode: 400, body: "No toggles provided" };
      }

      // Upsert single row; use a constant id
      const settingsId = "00000000-0000-0000-0000-000000000001";
      const updateData: any = {
        id: settingsId,
        updatedAt: new Date().toISOString(),
      };

      if (registration_open !== undefined)
        updateData.registrationOpen = registration_open;
      if (google_oauth_open !== undefined)
        updateData.googleOauthOpen = google_oauth_open;

      await db
        .insert(appSettings)
        .values(updateData)
        .onConflictDoUpdate({
          target: appSettings.id,
          set: updateData,
        });

      return { statusCode: 200, body: "OK" };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};

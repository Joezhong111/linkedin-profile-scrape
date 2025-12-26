import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads } from "../../db/schema";
import { eq, desc, sql } from "drizzle-orm";

function mapRowToClient(r: any) {
    return {
        id: r.id,
        created_at: r.createdAt,
        owner_id: r.ownerId,
        profile_url: r.profileUrl,
        full_name: r.fullName,
        headline: r.headline,
        location: r.location,
        about: r.about,
        photo_url: r.photoUrl,
        raw_data: r.rawData,
        ai_summary: r.aiSummary,
        linkedin_public_url: r.linkedinPublicUrl,
        linkedin_id: r.linkedinId,
        public_identifier: r.publicIdentifier,
        first_name: r.firstName,
        last_name: r.lastName,
        connections: r.connections,
        followers: r.followers,
        email: r.email,
        mobile_number: r.mobileNumber,
        job_title: r.jobTitle,
        company_name: r.companyName,
        company_industry: r.companyIndustry,
        company_linkedin: r.companyLinkedin,
        source_company_url: r.sourceCompanyUrl
    };
}

export const handler = async (event: any) => {
    try {
        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        const token = extractToken(authHeader);

        if (!token) return { statusCode: 401, body: "Unauthorized" };

        const user = await verifyToken(token);
        if (!user) return { statusCode: 401, body: "Unauthorized" };

        console.log("Checking DB connection...");
        try {
            const result = await db.execute(sql`SELECT 1 as health`);
            console.log("DB health check success:", result);
        } catch (dbErr: any) {
            console.error("DB Health Check Failed:", dbErr);
            throw new Error("Database connection failed: " + dbErr.message);
        }

        if (!linkedinLeads) {
            console.error("linkedinLeads is undefined");
            throw new Error("linkedinLeads table definition is missing");
        }

        console.log("Fetching leads for user:", user.id);
        try {
            const rows = await db
                .select()
                .from(linkedinLeads)
                .where(eq(linkedinLeads.ownerId, user.id));

            console.log(`Found ${rows.length} leads`);

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rows.map(mapRowToClient)),
            };
        } catch (queryErr: any) {
            console.error("Query Failed:", queryErr);
            throw new Error("Querying leads failed: " + queryErr.message);
        }
    } catch (e: any) {
        console.error("CRITICAL: Leads list error:", e);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                error: e?.message || "Server error",
                stack: e?.stack,
                tableExists: !!linkedinLeads
            })
        };
    }
};

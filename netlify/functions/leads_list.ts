import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads } from "../../db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

function mapRowToClient(r: any) {
    // Extract duration and period from raw_data if available
    const rawData = r.rawData || {};
    const currentExp = rawData.experience?.[0];
    const duration = currentExp?.duration || null;
    const period = currentExp ? `${currentExp.startDate?.text || ''} - ${currentExp.endDate?.text || ''}`.trim() : null;

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
        source_company_url: r.sourceCompanyUrl,
        current_job_duration: duration,
        job_period: period
    };
}

export const handler = async (event: any) => {
    try {
        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        const token = extractToken(authHeader);

        if (!token) return { statusCode: 401, body: "Unauthorized" };

        const user = await verifyToken(token);
        if (!user) return { statusCode: 401, body: "Unauthorized" };

        // Parse pagination parameters from query string
        const params = event.queryStringParameters || {};
        const page = Math.max(1, parseInt(params.page) || 1);
        const pageSize = Math.min(200, Math.max(10, parseInt(params.pageSize) || 50));
        const offset = (page - 1) * pageSize;

        console.log(`Pagination: page=${page}, pageSize=${pageSize}, offset=${offset}`);

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
            // Get total count first
            const countResult = await db
                .select({ count: count() })
                .from(linkedinLeads)
                .where(eq(linkedinLeads.ownerId, user.id));

            const total = countResult[0]?.count || 0;
            const totalPages = Math.ceil(total / pageSize);

            console.log(`Total leads: ${total}, Total pages: ${totalPages}`);

            // Get paginated data
            const rows = await db
                .select()
                .from(linkedinLeads)
                .where(eq(linkedinLeads.ownerId, user.id))
                .orderBy(desc(linkedinLeads.createdAt))
                .limit(pageSize)
                .offset(offset);

            console.log(`Returned ${rows.length} leads for page ${page}`);

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: rows.map(mapRowToClient),
                    total,
                    page,
                    pageSize,
                    totalPages
                }),
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

import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads } from "../../db/schema";
import { eq, desc, sql, count, and, or, ilike, isNotNull } from "drizzle-orm";

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

        const payload = await verifyToken(token);
        if (!payload) return { statusCode: 401, body: "Invalid token" };
        const userId = payload.id;

        // Parse pagination parameters
        const params = event.queryStringParameters || {};
        const page = Math.max(1, parseInt(params.page || "1", 10));
        const pageSize = Math.min(200, Math.max(1, parseInt(params.pageSize || "50", 10)));
        const offset = (page - 1) * pageSize;

        // Parse filter parameters
        const searchQuery = params.q?.trim() || "";
        const companyFilter = params.company?.trim() || "";
        const locationFilter = params.location?.trim() || "";
        const jobTitleFilter = params.jobTitle?.trim() || "";
        const hasEmail = params.hasEmail === "true";

        console.log(`Pagination: page=${page}, pageSize=${pageSize}, offset=${offset}`);
        console.log(`Filters: q=${searchQuery}, company=${companyFilter}, location=${locationFilter}, jobTitle=${jobTitleFilter}, hasEmail=${hasEmail}`);

        console.log("Fetching leads for user:", userId);

        // Build dynamic filter conditions
        const conditions = [eq(linkedinLeads.ownerId, userId)];

        // Text search across multiple fields
        if (searchQuery) {
            const searchPattern = `%${searchQuery}%`;
            conditions.push(
                or(
                    ilike(linkedinLeads.fullName, searchPattern),
                    ilike(linkedinLeads.headline, searchPattern),
                    ilike(linkedinLeads.jobTitle, searchPattern),
                    ilike(linkedinLeads.companyName, searchPattern),
                    ilike(linkedinLeads.location, searchPattern),
                    ilike(linkedinLeads.email, searchPattern)
                )!
            );
        }

        // Company filter
        if (companyFilter) {
            conditions.push(eq(linkedinLeads.companyName, companyFilter));
        }

        // Location filter (uses ILIKE for partial matching)
        if (locationFilter) {
            conditions.push(ilike(linkedinLeads.location, `%${locationFilter}%`));
        }

        // Job title filter
        if (jobTitleFilter) {
            conditions.push(ilike(linkedinLeads.jobTitle, `%${jobTitleFilter}%`));
        }

        // Has email filter
        if (hasEmail) {
            conditions.push(isNotNull(linkedinLeads.email));
        }

        const whereClause = and(...conditions);

        // Get total count with filters
        const countResult = await db
            .select({ count: count() })
            .from(linkedinLeads)
            .where(whereClause);

        const total = countResult[0]?.count || 0;
        const totalPages = Math.ceil(total / pageSize);

        console.log(`Total leads: ${total}, Total pages: ${totalPages}`);

        // Get paginated data with filters
        const rows = await db
            .select()
            .from(linkedinLeads)
            .where(whereClause)
            .orderBy(desc(linkedinLeads.createdAt))
            .limit(pageSize)
            .offset(offset);

        console.log(`Returned ${rows.length} leads for page ${page}`);

        // Get unique companies and locations for filter dropdowns
        const allRows = await db
            .select({
                companyName: linkedinLeads.companyName,
                location: linkedinLeads.location,
            })
            .from(linkedinLeads)
            .where(eq(linkedinLeads.ownerId, userId));

        const companies = [...new Set(allRows.map(r => r.companyName).filter(Boolean))].sort() as string[];

        // Extract region from location (first part before comma usually)
        const locationsRaw = allRows.map(r => r.location).filter(Boolean) as string[];
        const regions = [...new Set(locationsRaw.map(l => {
            // Try to extract a meaningful region
            const parts = l.split(',').map(s => s.trim());
            return parts[parts.length - 1] || parts[0]; // Take last part (usually country/region)
        }))].sort();

        return {
            statusCode: 200,
            body: JSON.stringify({
                data: rows.map(r => mapRowToClient(r)),
                page,
                pageSize,
                total,
                totalPages,
                filters: {
                    companies,
                    locations: regions,
                },
            }),
        };
    } catch (error: any) {
        console.error("CRITICAL: Leads list error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

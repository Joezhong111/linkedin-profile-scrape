import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinLeads } from "../../db/schema";
import { eq, and } from "drizzle-orm";

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
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        const token = extractToken(authHeader);

        if (!token) return { statusCode: 401, body: "Unauthorized" };

        const user = await verifyToken(token);
        if (!user) return { statusCode: 401, body: "Unauthorized" };

        const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};

        if (!body.profile_url) {
            return { statusCode: 400, body: "profile_url is required" };
        }

        // Check if lead already exists
        const [existing] = await db
            .select()
            .from(linkedinLeads)
            .where(
                and(
                    eq(linkedinLeads.ownerId, user.id),
                    eq(linkedinLeads.profileUrl, body.profile_url)
                )
            )
            .limit(1);

        const leadData = {
            ownerId: user.id,
            profileUrl: body.profile_url,
            rawData: body.raw_data,
            fullName: body.full_name,
            headline: body.headline,
            location: body.location,
            about: body.about,
            photoUrl: body.photo_url,
            linkedinPublicUrl: body.linkedin_public_url,
            linkedinId: body.linkedin_id,
            publicIdentifier: body.public_identifier,
            firstName: body.first_name,
            lastName: body.last_name,
            connections: body.connections,
            followers: body.followers ? parseInt(String(body.followers)) : null,
            email: body.email,
            mobileNumber: body.mobile_number,
            jobTitle: body.job_title,
            companyName: body.company_name,
            companyIndustry: body.company_industry,
            companyLinkedin: body.company_linkedin,
            sourceCompanyUrl: body.source_company_url,
        };

        let result;
        if (existing) {
            [result] = await db
                .update(linkedinLeads)
                .set(leadData)
                .where(eq(linkedinLeads.id, existing.id))
                .returning();
        } else {
            [result] = await db
                .insert(linkedinLeads)
                .values(leadData)
                .returning();
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mapRowToClient(result)),
        };
    } catch (e: any) {
        console.error("Save lead error:", e);
        return { statusCode: 500, body: e?.message || "Server error" };
    }
};

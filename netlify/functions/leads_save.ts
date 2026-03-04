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
        source_company_url: r.sourceCompanyUrl,
        current_job_duration: r.currentJobDuration,
        job_period: r.jobPeriod
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
            currentJobDuration: body.current_job_duration,
            jobPeriod: body.job_period,
        };

        let result;
        if (existing) {
            // Smart merge: only update fields that have new non-null values
            const updateData: any = { ownerId: user.id, profileUrl: body.profile_url };

            // Helper function to check if a value should be updated
            const shouldUpdate = (newValue: any, existingValue: any) => {
                // Update if new value is not null/undefined and is different from existing
                return newValue !== null && newValue !== undefined && newValue !== '' && newValue !== existingValue;
            };

            // Only update fields that have new non-empty values
            if (shouldUpdate(body.raw_data, existing.rawData)) updateData.rawData = body.raw_data;
            if (shouldUpdate(body.full_name, existing.fullName)) updateData.fullName = body.full_name;
            if (shouldUpdate(body.headline, existing.headline)) updateData.headline = body.headline;
            if (shouldUpdate(body.location, existing.location)) updateData.location = body.location;
            if (shouldUpdate(body.about, existing.about)) updateData.about = body.about;
            if (shouldUpdate(body.photo_url, existing.photoUrl)) updateData.photoUrl = body.photo_url;
            if (shouldUpdate(body.linkedin_public_url, existing.linkedinPublicUrl)) updateData.linkedinPublicUrl = body.linkedin_public_url;
            if (shouldUpdate(body.linkedin_id, existing.linkedinId)) updateData.linkedinId = body.linkedin_id;
            if (shouldUpdate(body.public_identifier, existing.publicIdentifier)) updateData.publicIdentifier = body.public_identifier;
            if (shouldUpdate(body.first_name, existing.firstName)) updateData.firstName = body.first_name;
            if (shouldUpdate(body.last_name, existing.lastName)) updateData.lastName = body.last_name;
            if (shouldUpdate(body.connections, existing.connections)) updateData.connections = body.connections;
            if (body.followers && shouldUpdate(parseInt(String(body.followers)), existing.followers)) {
                updateData.followers = parseInt(String(body.followers));
            }
            if (shouldUpdate(body.email, existing.email)) updateData.email = body.email;
            if (shouldUpdate(body.mobile_number, existing.mobileNumber)) updateData.mobileNumber = body.mobile_number;
            if (shouldUpdate(body.job_title, existing.jobTitle)) updateData.jobTitle = body.job_title;
            if (shouldUpdate(body.company_name, existing.companyName)) updateData.companyName = body.company_name;
            if (shouldUpdate(body.company_industry, existing.companyIndustry)) updateData.companyIndustry = body.company_industry;
            if (shouldUpdate(body.company_linkedin, existing.companyLinkedin)) updateData.companyLinkedin = body.company_linkedin;
            if (shouldUpdate(body.source_company_url, existing.sourceCompanyUrl)) updateData.sourceCompanyUrl = body.source_company_url;
            if (shouldUpdate(body.current_job_duration, existing.currentJobDuration)) updateData.currentJobDuration = body.current_job_duration;
            if (shouldUpdate(body.job_period, existing.jobPeriod)) updateData.jobPeriod = body.job_period;

            [result] = await db
                .update(linkedinLeads)
                .set(updateData)
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

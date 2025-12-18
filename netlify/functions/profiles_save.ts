import { verifyToken, extractToken } from "../../lib/auth-server";
import { db } from "../../db/client";
import { linkedinProfiles } from "../../db/schema";
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
    address_country_only: r.addressCountryOnly,
    address_with_country: r.addressWithCountry,
    address_without_country: r.addressWithoutCountry,
    profile_pic: r.profilePic,
    profile_pic_high_quality: r.profilePicHighQuality,
    background_pic: r.backgroundPic,
    is_premium: r.isPremium,
    is_verified: r.isVerified,
    is_job_seeker: r.isJobSeeker,
    is_retired: r.isRetired,
    is_creator: r.isCreator,
    is_influencer: r.isInfluencer,
    is_currently_employed: r.isCurrentlyEmployed,
    open_connection: r.openConnection,
    urn: r.urn,
    total_recommendations_received: r.totalRecommendationsReceived,
    total_recommendations_given: r.totalRecommendationsGiven,
    experiences_count: r.experiencesCount,
    job_title: r.jobTitle,
    job_started_on: r.jobStartedOn,
    job_location: r.jobLocation,
    job_still_working: r.jobStillWorking,
    company_name: r.companyName,
    company_industry: r.companyIndustry,
    company_website: r.companyWebsite,
    company_linkedin: r.companyLinkedin,
    company_founded_in: r.companyFoundedIn,
    company_size: r.companySize,
    current_job_duration: r.currentJobDuration,
    current_job_duration_years: r.currentJobDurationYears,
  };
}

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;
    const token = extractToken(authHeader);

    if (!token) return { statusCode: 401, body: "Unauthorized" };

    const user = await verifyToken(token);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body || "{}")
        : event.body || {};

    if (!body.profile_url) {
      return { statusCode: 400, body: "profile_url is required" };
    }

    // Check if profile already exists
    const [existing] = await db
      .select()
      .from(linkedinProfiles)
      .where(
        and(
          eq(linkedinProfiles.ownerId, user.id),
          eq(linkedinProfiles.profileUrl, body.profile_url)
        )
      )
      .limit(1);

    const profileData = {
      ownerId: user.id,
      profileUrl: body.profile_url,
      rawData: body.raw_data,
      aiSummary: body.ai_summary,
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
      followers: body.followers,
      email: body.email,
      mobileNumber: body.mobile_number,
      addressCountryOnly: body.address_country_only,
      addressWithCountry: body.address_with_country,
      addressWithoutCountry: body.address_without_country,
      profilePic: body.profile_pic,
      profilePicHighQuality: body.profile_pic_high_quality,
      backgroundPic: body.background_pic,
      isPremium: body.is_premium,
      isVerified: body.is_verified,
      isJobSeeker: body.is_job_seeker,
      isRetired: body.is_retired,
      isCreator: body.is_creator,
      isInfluencer: body.is_influencer,
      isCurrentlyEmployed: body.is_currently_employed,
      openConnection: body.open_connection,
      urn: body.urn,
      totalRecommendationsReceived: body.total_recommendations_received,
      totalRecommendationsGiven: body.total_recommendations_given,
      experiencesCount: body.experiences_count,
      jobTitle: body.job_title,
      jobStartedOn: body.job_started_on,
      jobLocation: body.job_location,
      jobStillWorking: body.job_still_working,
      companyName: body.company_name,
      companyIndustry: body.company_industry,
      companyWebsite: body.company_website,
      companyLinkedin: body.company_linkedin,
      companyFoundedIn: body.company_founded_in,
      companySize: body.company_size,
      currentJobDuration: body.current_job_duration,
      currentJobDurationYears: body.current_job_duration_years,
    };

    let result;
    if (existing) {
      // Update existing profile
      [result] = await db
        .update(linkedinProfiles)
        .set(profileData)
        .where(eq(linkedinProfiles.id, existing.id))
        .returning();
    } else {
      // Insert new profile
      [result] = await db
        .insert(linkedinProfiles)
        .values(profileData)
        .returning();
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapRowToClient(result)),
    };
  } catch (e: any) {
    console.error("Save profile error:", e);
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};

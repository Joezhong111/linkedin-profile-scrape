import type { linkedinLeads, linkedinProfiles } from '../db/schema';

/**
 * Client-facing snake_case shapes. The SPA (`types.ts`) consumes these exact
 * keys; keep the two in lockstep when a saved column changes.
 */
export function mapProfileRow(r: typeof linkedinProfiles.$inferSelect) {
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

export function mapLeadRow(r: typeof linkedinLeads.$inferSelect) {
  const raw = (r.rawData ?? {}) as {
    experience?: Array<{
      duration?: string;
      startDate?: { text?: string };
      endDate?: { text?: string };
    }>;
  };
  const firstExperience = raw.experience?.[0];
  const derivedPeriod = firstExperience
    ? `${firstExperience.startDate?.text ?? ''} - ${firstExperience.endDate?.text ?? ''}`.trim()
    : null;

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
    is_premium: r.isPremium,
    is_verified: r.isVerified,
    job_title: r.jobTitle,
    company_name: r.companyName,
    company_industry: r.companyIndustry,
    company_linkedin: r.companyLinkedin,
    source_company_url: r.sourceCompanyUrl,
    current_job_duration: r.currentJobDuration ?? firstExperience?.duration ?? null,
    current_job_duration_years: r.currentJobDurationYears,
    job_period: r.jobPeriod ?? derivedPeriod,
  };
}

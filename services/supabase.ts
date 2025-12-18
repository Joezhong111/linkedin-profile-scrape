import { LinkedInProfile } from "../types";
import { authClient } from "../lib/auth";

export const isSupabaseReady = true; // Always ready with new auth system

async function getCurrentUserId(): Promise<string> {
  const user = authClient.getUser();
  if (!user?.id) throw new Error("Not authenticated");
  return user.id;
}

function getAuthHeaders() {
  return authClient.getAuthHeaders();
}

export const saveProfile = async (profile: LinkedInProfile) => {
  const userId = await getCurrentUserId();
  const rd: any = profile.raw_data || {};

  const payload = {
    owner_id: userId,
    profile_url: profile.profile_url,
    raw_data: profile.raw_data,
    ai_summary: profile.ai_summary,
    about: rd.about,
    address_country_only: rd.addressCountryOnly,
    address_with_country: rd.addressWithCountry,
    address_without_country: rd.addressWithoutCountry,
    background_pic: rd.backgroundPic,
    company_founded_in: rd.companyFoundedIn,
    company_industry: rd.companyIndustry,
    company_linkedin: rd.companyLinkedin,
    company_name: rd.companyName,
    company_size: rd.companySize,
    company_website: rd.companyWebsite,
    connections: rd.connections,
    current_job_duration: rd.currentJobDuration,
    current_job_duration_years: rd.currentJobDurationInYrs,
    email: rd.email,
    experiences_count: rd.experiencesCount,
    first_name: rd.firstName,
    followers: rd.followers,
    full_name: rd.fullName,
    headline: rd.headline,
    is_creator: rd.isCreator,
    is_currently_employed: rd.isCurrentlyEmployed,
    is_influencer: rd.isInfluencer,
    is_job_seeker: rd.isJobSeeker,
    is_premium: rd.isPremium,
    is_retired: rd.isRetired,
    is_verified: rd.isVerified,
    job_location: rd.jobLocation,
    job_started_on: rd.jobStartedOn,
    job_still_working: rd.jobStillWorking,
    job_title: rd.jobTitle,
    last_name: rd.lastName,
    linkedin_id: rd.linkedinId,
    linkedin_public_url: rd.linkedinPublicUrl,
    mobile_number: rd.mobileNumber,
    open_connection: rd.openConnection,
    profile_pic: rd.profilePic,
    profile_pic_high_quality: rd.profilePicHighQuality,
    public_identifier: rd.publicIdentifier,
    total_recommendations_given: rd.totalRecommendationsGiven,
    total_recommendations_received: rd.totalRecommendationsReceived,
    urn: rd.urn,
  };

  const res = await fetch("/api/profiles/save", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || "Failed to save profile");
  }

  return await res.json();
};

export const fetchAllProfiles = async () => {
  try {
    await getCurrentUserId();
  } catch {
    return [];
  }

  const res = await fetch("/api/profiles/list", {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch profiles");
  }

  return (await res.json()) as LinkedInProfile[];
};

export const deleteProfile = async (id: string) => {
  const res = await fetch(`/api/profiles/delete`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || "Failed to delete profile");
  }
};

export const updateProfileAI = async (id: string, summary: string) => {
  const res = await fetch(`/api/profiles/update-ai`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, ai_summary: summary }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || "Failed to update AI summary");
  }
};

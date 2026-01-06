import { LinkedInProfile } from "../types";
import { authClient } from "../lib/auth";

export const isApiReady = true; // Always ready with new auth system

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

export const saveLead = async (lead: LinkedInProfile, sourceCompanyUrl?: string) => {
  const userId = await getCurrentUserId();
  const rd: any = lead.raw_data || {};

  const payload = {
    owner_id: userId,
    profile_url: lead.profile_url,
    raw_data: lead.raw_data,
    ai_summary: lead.ai_summary,
    full_name: lead.full_name,
    first_name: lead.first_name || rd.firstName,
    last_name: lead.last_name || rd.lastName,
    headline: lead.headline || rd.headline,
    location: lead.location || rd.location,
    photo_url: lead.photo_url || rd.photoUrl,
    email: lead.email || rd.email,
    mobile_number: lead.mobile_number || rd.mobileNumber,
    job_title: lead.job_title || rd.jobTitle,
    company_name: lead.company_name || rd.companyName,
    company_industry: lead.company_industry || rd.companyIndustry,
    company_linkedin: lead.company_linkedin || rd.companyLinkedin,
    followers: lead.followers || rd.followers,
    source_company_url: sourceCompanyUrl,
    current_job_duration: lead.current_job_duration || rd.currentJobDuration || (rd.experience?.[0]?.duration),
    job_period: lead.job_period || (rd.experience?.[0] ? `${rd.experience[0].startDate?.text || ''} - ${rd.experience[0].endDate?.text || ''}` : null),
  };

  const res = await fetch("/api/leads/save", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Save lead failed:", res.status, errorBody);
    throw new Error(`Failed to save lead (${res.status}): ${errorBody}`);
  }

  return await res.json();
};

export interface LeadsFilterParams {
  q?: string;
  company?: string;
  location?: string;
  jobTitle?: string;
  hasEmail?: boolean;
}

export interface LeadsPaginatedResponse {
  data: LinkedInProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters?: {
    companies: string[];
    locations: string[];
  };
}

export const fetchAllLeads = async (
  page: number = 1,
  pageSize: number = 50,
  filters?: LeadsFilterParams
): Promise<LeadsPaginatedResponse> => {
  try {
    await getCurrentUserId();
  } catch {
    return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
  }

  // Build query string with filters
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (filters?.q) params.append('q', filters.q);
  if (filters?.company) params.append('company', filters.company);
  if (filters?.location) params.append('location', filters.location);
  if (filters?.jobTitle) params.append('jobTitle', filters.jobTitle);
  if (filters?.hasEmail) params.append('hasEmail', 'true');

  const res = await fetch(`/api/leads/list?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Fetch leads failed:", res.status, errorBody);
    throw new Error(`Failed to fetch leads (${res.status}): ${errorBody}`);
  }

  return (await res.json()) as LeadsPaginatedResponse;
};

export const deleteLead = async (id: string) => {
  const res = await fetch(`/api/leads/delete`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || "Failed to delete lead");
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

export const batchDeleteLeads = async (ids: string[]): Promise<{ deleted: number }> => {
  const res = await fetch(`/api/leads/batch-delete`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ids }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || "Failed to batch delete leads");
  }

  return await res.json();
};

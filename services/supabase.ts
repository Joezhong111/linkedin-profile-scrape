import { createClient } from "@supabase/supabase-js";
import { LinkedInProfile } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

// Safely initialize the client or provide a null reference to prevent startup crashes
export const supabase = isSupabaseReady
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

/**
 * Expected SQL schema for table public.linkedin_profiles:
 * - Matches the schema you provided (all columns).
 * - Optional but recommended: add a unique index on profile_url if you want to deduplicate by URL.
 *   create unique index if not exists ux_linkedin_profiles_profile_url on public.linkedin_profiles(profile_url);
 */

export const saveProfile = async (profile: LinkedInProfile) => {
  if (!supabase) throw new Error("Supabase is not configured.");

  const rd: any = profile.raw_data || {};

  const row: any = {
    // Core fields
    profile_url: profile.profile_url,
    raw_data: profile.raw_data,
    ai_summary: profile.ai_summary,

    // All fields from output.json, mapped from raw_data (rd)
    about: rd.about,
    address_country_only: rd.addressCountryOnly,
    address_with_country: rd.addressWithCountry,
    address_without_country: rd.addressWithoutCountry,
    associated_hashtag: rd.associatedHashtag,
    background_pic: rd.backgroundPic,
    birthday: rd.birthday,
    company_founded_in: rd.companyFoundedIn,
    company_industry: rd.companyIndustry,
    company_linkedin: rd.companyLinkedin,
    company_name: rd.companyName,
    company_size: rd.companySize,
    company_website: rd.companyWebsite,
    connections: rd.connections,
    courses: rd.courses,
    creator_website: rd.creatorWebsite,
    current_job_duration: rd.currentJobDuration,
    current_job_duration_years: rd.currentJobDurationInYrs,
    educations: rd.educations,
    email: rd.email,
    experiences: rd.experiences,
    experiences_count: rd.experiencesCount,
    first_name: rd.firstName,
    first_role_year: rd.firstRoleYear,
    followers: rd.followers,
    full_name: rd.fullName,
    headline: rd.headline,
    highlights: rd.highlights,
    honors_and_awards: rd.honorsAndAwards,
    interests: rd.interests,
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
    languages: rd.languages,
    last_name: rd.lastName,
    license_and_certificates: rd.licenseAndCertificates,
    linkedin_id: rd.linkedinId,
    linkedin_public_url: rd.linkedinPublicUrl,
    linkedin_url: rd.linkedinUrl,
    mobile_number: rd.mobileNumber,
    open_connection: rd.openConnection,
    organizations: rd.organizations,
    patents: rd.patents,
    people_also_viewed: rd.peopleAlsoViewed,
    profile_pic: rd.profilePic,
    profile_pic_all_dimensions: rd.profilePicAllDimensions,
    profile_pic_high_quality: rd.profilePicHighQuality,
    projects: rd.projects,
    promos: rd.promos,
    public_identifier: rd.publicIdentifier,
    publications: rd.publications,
    recommendations: rd.recommendations,
    recommendations_received: rd.recommendationsReceived,
    skills: rd.skills,
    test_scores: rd.testScores,
    top_skills_by_endorsements: rd.topSkillsByEndorsements,
    total_experience_years: rd.totalExperienceYears,
    total_recommendations_given: rd.totalRecommendationsGiven,
    total_recommendations_received: rd.totalRecommendationsReceived,
    updates: rd.updates,
    urn: rd.urn,
    verifications: rd.verifications,
    volunteer_and_awards: rd.volunteerAndAwards,
    volunteer_causes: rd.volunteerCauses,
  };

  // Upsert by profile_url requires a unique index on profile_url. If it's not present,
  // perform a manual insert-or-update.
  const { data: existing, error: findErr } = await supabase
    .from("linkedin_profiles")
    .select("id")
    .eq("profile_url", row.profile_url)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("linkedin_profiles")
      .update(row)
      .eq("id", existing.id)
      .select();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("linkedin_profiles")
      .insert(row)
      .select();
    if (error) throw error;
    return data;
  }
};

export const fetchAllProfiles = async () => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("linkedin_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as LinkedInProfile[];
};

export const deleteProfile = async (id: string) => {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("linkedin_profiles")
    .delete()
    .match({ id });

  if (error) throw error;
};

export const updateProfileAI = async (id: string, summary: string) => {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("linkedin_profiles")
    .update({ ai_summary: summary })
    .match({ id });

  if (error) throw error;
};

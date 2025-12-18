import { LinkedInProfile } from "../types";
import { authClient } from "../lib/auth";

// Frontend: call serverless function instead of bundling apify-client in the browser
export const scrapeLinkedInProfiles = async (
  urls: string[]
): Promise<any[]> => {
  // Attach Authorization header so Functions can identify current user for quotas
  const headers = authClient.getAuthHeaders();

  const res = await fetch("/api/scrape", {
    method: "POST",
    headers,
    body: JSON.stringify({ urls }),
  });

  if (!res.ok) {
    let msg = "Scraping failed";
    try {
      const data = await res.json();
      msg = (data && (data.error || data.message)) || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  return (data as any[]) || [];
};

export function mapApifyToLinkedInProfile(item: any): LinkedInProfile {
  const fullName =
    item.fullName || [item.firstName, item.lastName].filter(Boolean).join(" ");
  return {
    // Identity & branding
    profile_url: item.linkedinUrl || item.linkedinPublicUrl || item.url || "",
    linkedin_public_url: item.linkedinPublicUrl || item.linkedinUrl || item.url,
    full_name: fullName || "Unknown",
    first_name: item.firstName,
    last_name: item.lastName,
    headline: item.headline || item.title || "",
    location:
      item.addressWithCountry ||
      item.addressWithoutCountry ||
      item.location ||
      "",
    about: item.about || item.summary || "",
    photo_url: item.profilePicHighQuality || item.profilePic || "",

    // Contact & influence
    email: item.email,
    mobile_number: item.mobileNumber,
    followers: item.followers ?? item.follower_count,

    // Current role snapshot
    job_title: item.jobTitle,
    company_name: item.companyName || item.experiences?.[0]?.companyName,
    company_industry: item.companyIndustry,

    // Collections for UI convenience
    experiences: item.experiences,
    education: item.educations,

    // Raw payload for full fidelity
    raw_data: item,
  } as LinkedInProfile;
}

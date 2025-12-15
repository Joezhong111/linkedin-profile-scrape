import { LinkedInProfile } from "../types";

// Frontend: call serverless function instead of bundling apify-client in the browser
export const scrapeLinkedInProfiles = async (
  urls: string[]
): Promise<any[]> => {
  const res = await fetch("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    profile_url: item.linkedinUrl || item.linkedinPublicUrl || item.url || "",
    full_name: fullName || "Unknown",
    headline: item.headline || item.title || "",
    location:
      item.addressWithCountry ||
      item.addressWithoutCountry ||
      item.location ||
      "",
    about: item.about || item.summary || "",
    photo_url: item.profilePicHighQuality || item.profilePic || "",
    raw_data: item,
  } as LinkedInProfile;
}

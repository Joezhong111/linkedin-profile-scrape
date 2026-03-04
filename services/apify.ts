import { LinkedInProfile } from '../types';
import { authClient } from '../lib/auth';

// Frontend: call serverless function instead of bundling apify-client in the browser
export const scrapeLinkedInProfiles = async (urls: string[]): Promise<any[]> => {
  // Attach Authorization header so Functions can identify current user for quotas
  const headers = authClient.getAuthHeaders();

  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers,
    body: JSON.stringify({ urls }),
  });

  if (!res.ok) {
    let msg = 'Scraping failed';
    try {
      const data = await res.json();
      msg = (data && (data.error || data.message)) || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  return (data as any[]) || [];
};

export interface ScrapeCompanyOptions {
  companyUrl: string;
  maxItems: number;
  profileScraperMode: string;
  jobTitles?: string[];
  locations?: string[];
  yearsAtCurrentCompanyIds?: string[];
  yearsOfExperienceIds?: string[];
}

export interface CompanyHistoryResponse {
  hasHistory: boolean;
  lastScrape: {
    scrapedAt: string;
    maxItemsRequested: number;
    itemsReturned: number;
    itemsSaved: number;
    filtersUsed: any;
  } | null;
  totalScrapes: number;
}

export interface ScrapeCompanyResult {
  items: any[];
  stats?: {
    totalReturned: number;
    alreadyExists: number;
    newProfiles: number;
    duplicateRate: number;
  };
  runId?: string;
  status?: string;
  message?: string;
}

export const checkCompanyHistory = async (companyUrl: string): Promise<CompanyHistoryResponse> => {
  const headers = authClient.getAuthHeaders();

  const res = await fetch(`/api/check_company_history?companyUrl=${encodeURIComponent(companyUrl)}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    let msg = 'Failed to check company history';
    try {
      const data = await res.json();
      msg = (data && (data.error || data.message)) || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return await res.json();
};

export const scrapeCompany = async (options: ScrapeCompanyOptions): Promise<ScrapeCompanyResult> => {
  const headers = authClient.getAuthHeaders();

  const res = await fetch('/api/scrape_company', {
    method: 'POST',
    headers,
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    let msg = 'Company scraping failed';
    try {
      const data = await res.json();
      msg = (data && (data.error || data.message)) || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data;
};

export const checkScrapeStatus = async (
  runId: string,
  options: ScrapeCompanyOptions
): Promise<ScrapeCompanyResult> => {
  const headers = authClient.getAuthHeaders();

  const params = new URLSearchParams({
    runId,
    companyUrl: options.companyUrl,
    maxItems: options.maxItems.toString(),
    jobTitles: JSON.stringify(options.jobTitles || []),
    locations: JSON.stringify(options.locations || []),
    yearsAtCurrentCompanyIds: JSON.stringify(options.yearsAtCurrentCompanyIds || []),
    yearsOfExperienceIds: JSON.stringify(options.yearsOfExperienceIds || []),
  });

  const res = await fetch(`/api/check_scrape_status?${params}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    let msg = 'Failed to check scrape status';
    try {
      const data = await res.json();
      msg = (data && (data.error || data.message)) || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return await res.json();
};

export function mapApifyToLinkedInProfile(item: any): LinkedInProfile {
  const fullName = item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' ');

  // Handle location object vs string
  const loc = typeof item.location === 'object' ? item.location?.linkedinText : item.location;

  // Handle current position/experience from various possible formats
  const currentPosArr = item.currentPosition || item.currentPositions || [];
  const currentPos = currentPosArr[0] || {};
  const expArr = item.experience || item.experiences || [];
  const firstExp = expArr[0] || {};

  const jobTitle =
    item.jobTitle ||
    currentPos.title ||
    currentPos.position ||
    firstExp.position ||
    firstExp.title ||
    item.headline ||
    '';
  const companyName = item.companyName || currentPos.companyName || firstExp.companyName || '';

  // Handle emails (array in company search, string in profile search)
  const email = item.email || (item.emails && item.emails[0]?.email) || '';

  return {
    // Identity & branding
    profile_url: item.linkedinUrl || item.linkedinPublicUrl || item.url || '',
    linkedin_public_url: item.linkedinPublicUrl || item.linkedinUrl || item.url,
    full_name: fullName || 'Unknown',
    first_name: item.firstName,
    last_name: item.lastName,
    headline: item.headline || jobTitle || item.title || '',
    location: loc || item.addressWithCountry || item.addressWithoutCountry || '',
    about: item.about || item.summary || '',
    photo_url:
      item.photo ||
      item.profilePicture?.url ||
      item.pictureUrl ||
      item.profilePicHighQuality ||
      item.profilePic ||
      '',

    // Contact & influence
    email: email,
    mobile_number: item.mobileNumber,
    followers: item.followerCount ?? item.followers ?? item.follower_count,

    // Current role snapshot
    job_title: jobTitle,
    company_name: companyName,
    company_industry: item.companyIndustry,

    // Collections for UI convenience
    experiences: expArr.length > 0 ? expArr : currentPosArr,
    education: item.education || item.educations,

    // Raw payload for full fidelity
    raw_data: item,
  } as LinkedInProfile;
}

import { LinkedInProfile } from '../types';
import { authClient } from '../lib/auth';
import { normalizeScrapeItem } from '../lib/normalize';

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
    } catch {
      // Error bodies are not always JSON; keep the default message.
    }
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
  error?: string;
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
    } catch {
      // Error bodies are not always JSON; keep the default message.
    }
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
    } catch {
      // Error bodies are not always JSON; keep the default message.
    }
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
    } catch {
      // Error bodies are not always JSON; keep the default message.
    }
    throw new Error(msg);
  }

  return await res.json();
};

export function mapApifyToLinkedInProfile(item: unknown): LinkedInProfile {
  return normalizeScrapeItem(item);
}

import { LinkedInProfile } from '../types';
import { authClient } from '../lib/auth';
import { normalizeScrapeItem } from '../lib/normalize';

/** Scrape tiers accepted by `/api/scrape` and `/api/scrape_company`. */
export type ScrapeTier = 'full' | 'full_email';

// Frontend: call the Worker instead of bundling apify-client in the browser.
export const scrapeLinkedInProfiles = async (
  urls: string[],
  tier: ScrapeTier = 'full'
): Promise<any[]> => {
  // Attach Authorization header so the Worker can resolve the User's credential.
  const headers = authClient.getAuthHeaders();

  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers,
    body: JSON.stringify({ urls, tier }),
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
  tier: ScrapeTier;
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
    filtersUsed: unknown;
  } | null;
  totalScrapes: number;
}

export interface ScrapeCompanyResult {
  items?: unknown[];
  stats?: {
    totalReturned: number;
    alreadyExists: number;
    newProfiles: number;
    duplicateRate: number;
  };
  jobId?: string;
  status?: string;
  progress?: number;
  resultCount?: number;
  tier?: ScrapeTier;
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

export const checkScrapeStatus = async (jobId: string): Promise<ScrapeCompanyResult> => {
  const headers = authClient.getAuthHeaders();

  const res = await fetch(
    `/api/check_scrape_status?jobId=${encodeURIComponent(jobId)}`,
    { method: 'GET', headers }
  );

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

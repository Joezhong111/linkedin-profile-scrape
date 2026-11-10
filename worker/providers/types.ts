/**
 * The provider boundary: routes talk to one Scrape Provider, chosen from the
 * User's Active Provider. Implementations own their HTTP details; routes only
 * see these types and `ProviderError`.
 */

export type ScrapeTier = 'full' | 'full_email';

export interface ProfileScrapeInput {
  urls: string[];
  tier: ScrapeTier;
}

export interface CompanyScrapeInput {
  companyUrl: string;
  maxItems: number;
  tier: ScrapeTier;
  jobTitles: string[];
  locations: string[];
  yearsAtCurrentCompanyIds: string[];
  yearsOfExperienceIds: string[];
}

export type ProviderRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ProviderRunState {
  status: ProviderRunStatus;
  progress: number;
  resultCount: number;
  items?: unknown[];
  error?: string;
}

export type ProviderErrorKind = 'credential' | 'provider' | 'timeout' | 'input';

export interface ProviderErrorOptions {
  status?: number;
  retryAfterMs?: number;
}

/** A typed provider failure; routes translate it into a 400 or 502 response. */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(kind: ProviderErrorKind, message: string, options: ProviderErrorOptions = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** Options exist so adapter tests can poll without sleeping. */
export interface ScrapeProviderOptions {
  pollDelayMs?: number;
  maxWaitMs?: number;
}

export interface CompanyJobStart {
  providerJobRef?: string;
  candidates?: unknown[];
}

export interface ScrapeProvider {
  scrapeProfiles(
    input: ProfileScrapeInput,
    token: string,
    options?: ScrapeProviderOptions
  ): Promise<unknown[]>;
  createCompanyJob(input: CompanyScrapeInput, token: string): Promise<CompanyJobStart>;
  pollCompanyJob(
    job: unknown,
    input: CompanyScrapeInput,
    token: string
  ): Promise<ProviderRunState>;
}

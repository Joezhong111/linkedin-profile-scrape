import {
  ProviderError,
  type CompanyJobStart,
  type CompanyJobState,
  type CompanyScrapeInput,
  type ProfileScrapeInput,
  type ProviderRunState,
  type ScrapeProvider,
  type ScrapeProviderOptions,
  type ScrapeTier,
} from './types';

/**
 * Apify provider adapter.
 *
 * Uses the canonical REST API with the User's own Bearer token: start an actor
 * run, poll the run until a terminal state, then read the default dataset as a
 * bare JSON array. There is no server token and no `apify-client` dependency.
 */

const APIFY_BASE = 'https://api.apify.com/v2';
const PROFILE_ACTOR_ID = '2SyF0bVxmgGr8IVCZ';
const COMPANY_ACTOR_ID = 'Vb6LZkh4EqRlR0Ka9';
const DEFAULT_POLL_DELAY_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 120_000;

/** The Apify company actor prices its tiers by name, not by an enum. */
const COMPANY_TIER_MODE: Record<ScrapeTier, string> = {
  full: 'Full ($8 per 1k)',
  full_email: 'Full + email search ($12 per 1k)',
};

const POLLABLE_STATUS: Record<string, true> = {
  READY: true,
  RUNNING: true,
  'TIMING-OUT': true,
  ABORTING: true,
};

const FAILED_STATUS: Record<string, true> = {
  FAILED: true,
  ABORTED: true,
  'TIMED-OUT': true,
};

/** The subset of an Apify run envelope this adapter consumes. */
interface ApifyRunEnvelope {
  data?: {
    id?: unknown;
    status?: unknown;
    defaultDatasetId?: unknown;
  };
}

interface ApifyRunData {
  status?: string;
  defaultDatasetId?: string;
  itemsScraped?: number;
}

function readRunData(payload: unknown): ApifyRunData {
  const data = (payload as ApifyRunEnvelope | null | undefined)?.data;
  if (typeof data !== 'object' || data === null) {
    throw new ProviderError('provider', 'Apify returned an unexpected run response.');
  }
  let itemsScraped: number | undefined;
  if ('stats' in data && typeof data.stats === 'object' && data.stats !== null) {
    const stats = data.stats;
    if ('itemsScraped' in stats) {
      const raw = stats.itemsScraped;
      if (typeof raw === 'number' && Number.isFinite(raw)) itemsScraped = raw;
    }
  }
  return {
    status: typeof data.status === 'string' ? data.status : undefined,
    defaultDatasetId:
      typeof data.defaultDatasetId === 'string' ? data.defaultDatasetId : undefined,
    itemsScraped,
  };
}

async function requestJson(
  url: string,
  token: string,
  init?: { method?: string; body?: string }
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, { method: init?.method ?? 'GET', headers, body: init?.body });
  } catch {
    throw new ProviderError('provider', 'Could not reach Apify. Try again later.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      'credential',
      'Apify rejected your saved Scrape Credential. Update it in Settings.',
      { status: response.status }
    );
  }
  if (!response.ok) {
    throw new ProviderError(
      'provider',
      `Apify request failed (HTTP ${response.status}). Try again later.`,
      { status: response.status }
    );
  }

  try {
    return await response.json();
  } catch {
    throw new ProviderError('provider', 'Apify returned an unreadable response.');
  }
}

async function startProfileRun(
  input: ProfileScrapeInput,
  token: string
): Promise<ApifyRunData & { id: string }> {
  const payload = await requestJson(`${APIFY_BASE}/acts/${PROFILE_ACTOR_ID}/runs`, token, {
    method: 'POST',
    body: JSON.stringify({ profileUrls: input.urls }),
  });

  const data = (payload as ApifyRunEnvelope | null | undefined)?.data;
  if (typeof data !== 'object' || data === null) {
    throw new ProviderError('provider', 'Apify returned an unexpected run response.');
  }
  const id = typeof data.id === 'string' ? data.id : '';
  if (!id) {
    throw new ProviderError('provider', 'Apify did not return a run id.');
  }

  return {
    id,
    status: typeof data.status === 'string' ? data.status : undefined,
    defaultDatasetId:
      typeof data.defaultDatasetId === 'string' ? data.defaultDatasetId : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

async function scrapeProfiles(
  input: ProfileScrapeInput,
  token: string,
  options: ScrapeProviderOptions = {}
): Promise<unknown[]> {
  const pollDelayMs = options.pollDelayMs ?? DEFAULT_POLL_DELAY_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

  const started = await startProfileRun(input, token);
  let status = started.status ?? 'READY';
  let datasetId = started.defaultDatasetId;
  const startedAt = Date.now();

  while (POLLABLE_STATUS[status] === true) {
    if (Date.now() - startedAt >= maxWaitMs) {
      throw new ProviderError(
        'timeout',
        `Apify did not finish within ${Math.round(maxWaitMs / 1000)} seconds. Try again later.`
      );
    }
    await sleep(pollDelayMs);

    const payload = await requestJson(
      `${APIFY_BASE}/actor-runs/${encodeURIComponent(started.id)}`,
      token
    );
    const run = readRunData(payload);
    status = run.status ?? status;
    datasetId = run.defaultDatasetId ?? datasetId;
  }

  if (status === 'SUCCEEDED') {
    if (!datasetId) {
      throw new ProviderError('provider', 'Apify finished without a dataset.');
    }
    const items = await requestJson(
      `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true`,
      token
    );
    if (!Array.isArray(items)) {
      throw new ProviderError('provider', 'Apify returned an unexpected dataset payload.');
    }
    return items;
  }

  if (FAILED_STATUS[status] === true) {
    throw new ProviderError(
      'provider',
      `Apify run ${status === 'TIMED-OUT' ? 'timed out' : 'failed'} (status ${status}). Try again later.`
    );
  }

  throw new ProviderError(
    'provider',
    `Apify run entered an unexpected state${status ? ` "${status}"` : ''}. Try again later.`
  );
}

async function createCompanyJob(
  input: CompanyScrapeInput,
  token: string
): Promise<CompanyJobStart> {
  const actorInput: Record<string, unknown> = {
    profileScraperMode: COMPANY_TIER_MODE[input.tier],
    maxItems: input.maxItems,
    companies: [input.companyUrl],
    companyBatchMode: 'all_at_once',
  };
  if (input.jobTitles.length > 0) actorInput.jobTitles = input.jobTitles;
  if (input.locations.length > 0) actorInput.locations = input.locations;
  if (input.yearsAtCurrentCompanyIds.length > 0) {
    actorInput.yearsAtCurrentCompanyIds = input.yearsAtCurrentCompanyIds;
  }
  if (input.yearsOfExperienceIds.length > 0) {
    actorInput.yearsOfExperienceIds = input.yearsOfExperienceIds;
  }

  const payload = await requestJson(`${APIFY_BASE}/acts/${COMPANY_ACTOR_ID}/runs`, token, {
    method: 'POST',
    body: JSON.stringify(actorInput),
  });

  const data = (payload as ApifyRunEnvelope | null | undefined)?.data;
  if (typeof data !== 'object' || data === null) {
    throw new ProviderError('provider', 'Apify returned an unexpected run response.');
  }
  const id = typeof data.id === 'string' ? data.id : '';
  if (!id) {
    throw new ProviderError('provider', 'Apify did not return a run id.');
  }

  return { providerJobRef: id };
}

/**
 * Reads the run once. A SUCCEEDED run additionally reads its dataset so the
 * caller can persist the items; every other state is reported without I/O.
 */
async function pollCompanyJob(
  job: CompanyJobState,
  _input: CompanyScrapeInput,
  token: string
): Promise<ProviderRunState> {
  const ref = typeof job.providerJobRef === 'string' ? job.providerJobRef : '';
  if (!ref) {
    throw new ProviderError('provider', 'The Scrape Job has no Apify run reference.');
  }

  const payload = await requestJson(
    `${APIFY_BASE}/actor-runs/${encodeURIComponent(ref)}`,
    token
  );
  const run = readRunData(payload);
  const status = run.status ?? '';
  const progress = run.itemsScraped ?? 0;

  if (POLLABLE_STATUS[status] === true) {
    return { status: 'running', progress, resultCount: progress };
  }

  if (status === 'SUCCEEDED') {
    if (!run.defaultDatasetId) {
      throw new ProviderError('provider', 'Apify finished without a dataset.');
    }
    const items = await requestJson(
      `${APIFY_BASE}/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?format=json&clean=true`,
      token
    );
    if (!Array.isArray(items)) {
      throw new ProviderError('provider', 'Apify returned an unexpected dataset payload.');
    }
    return {
      status: 'succeeded',
      progress: items.length,
      resultCount: items.length,
      items,
    };
  }

  if (FAILED_STATUS[status] === true) {
    const reason =
      status === 'TIMED-OUT'
        ? 'timed out'
        : status === 'ABORTED'
          ? 'was aborted'
          : 'failed';
    return {
      status: 'failed',
      progress,
      resultCount: progress,
      error: `Apify run ${reason} (status ${status}). Try again later.`,
    };
  }

  throw new ProviderError(
    'provider',
    `Apify run entered an unexpected state${status ? ` "${status}"` : ''}. Try again later.`
  );
}

export const apifyProvider: ScrapeProvider = {
  scrapeProfiles,
  createCompanyJob,
  pollCompanyJob,
};

export default apifyProvider;

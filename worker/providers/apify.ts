import {
  ProviderError,
  type CompanyJobStart,
  type CompanyScrapeInput,
  type ProfileScrapeInput,
  type ProviderRunState,
  type ScrapeProvider,
  type ScrapeProviderOptions,
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
const DEFAULT_POLL_DELAY_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 120_000;

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
}

function readRunData(payload: unknown): ApifyRunData {
  const data = (payload as ApifyRunEnvelope | null | undefined)?.data;
  if (typeof data !== 'object' || data === null) {
    throw new ProviderError('provider', 'Apify returned an unexpected run response.');
  }
  return {
    status: typeof data.status === 'string' ? data.status : undefined,
    defaultDatasetId:
      typeof data.defaultDatasetId === 'string' ? data.defaultDatasetId : undefined,
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

function notImplementedCompany(): never {
  throw new ProviderError(
    'input',
    'Company scraping is not implemented for the Apify provider yet.'
  );
}

export const apifyProvider: ScrapeProvider = {
  scrapeProfiles,
  createCompanyJob(_input: CompanyScrapeInput, _token: string): Promise<CompanyJobStart> {
    return notImplementedCompany();
  },
  pollCompanyJob(
    _job: unknown,
    _input: CompanyScrapeInput,
    _token: string
  ): Promise<ProviderRunState> {
    return notImplementedCompany();
  },
};

export default apifyProvider;

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
 * treg provider adapter.
 *
 * Uses the direct call endpoint with the User's own treg token. Requests are GET
 * with query parameters only: no JSON body, one idempotency key per logical
 * call, and the response envelope is inspected because an HTTP 200 can still
 * carry a provider error.
 */

const TREG_BASE = 'https://treg.to/call';
const PROFILE_ENDPOINTS = {
  full: 'harvestapi.linkedin.user.profile',
  full_email: 'harvestapi.linkedin.user.profile.email',
} as const;
const PROFILE_CONCURRENCY = 5;
const DEFAULT_RETRY_AFTER_MS = 1000;
const REQUEST_TIMEOUT_MS = 180_000;
const PROVIDER_DETAIL_LIMIT = 300;

interface TregEnvelope {
  status?: unknown;
  error?: unknown;
  element?: unknown;
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'TimeoutError' || err.name === 'AbortError';
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function providerDetail(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'no response body';
  return trimmed.length > PROVIDER_DETAIL_LIMIT
    ? `${trimmed.slice(0, PROVIDER_DETAIL_LIMIT)}...`
    : trimmed;
}

function retryAfterMs(response: Response): number {
  const header = response.headers.get('Retry-After');
  if (header === null) return DEFAULT_RETRY_AFTER_MS;
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return DEFAULT_RETRY_AFTER_MS;
}

function readEnvelopeElement(payload: unknown): unknown {
  const envelope = (payload ?? {}) as TregEnvelope;
  if (envelope.status !== 'success') {
    const detail =
      typeof envelope.error === 'string' && envelope.error.trim()
        ? envelope.error.trim()
        : providerDetail(JSON.stringify(payload ?? null));
    throw new ProviderError('provider', `treg returned an error: ${detail}`);
  }
  if (envelope.error !== null && envelope.error !== undefined) {
    throw new ProviderError(
      'provider',
      `treg returned an error: ${providerDetail(String(envelope.error))}`
    );
  }
  if (typeof envelope.element !== 'object' || envelope.element === null) {
    throw new ProviderError('provider', 'treg did not return a profile element.');
  }
  return envelope.element;
}

/**
 * One logical profile call: one idempotency key, at most one 429 retry that
 * reuses that key. Every other failure is mapped immediately.
 */
async function callProfileEndpoint(
  endpoint: string,
  profileUrl: string,
  token: string
): Promise<unknown> {
  const idempotencyKey = crypto.randomUUID();
  const url = `${TREG_BASE}/${endpoint}?${new URLSearchParams({ url: profileUrl }).toString()}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Treg-Token': token,
    'Idempotency-Key': idempotencyKey,
  };

  const send = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (isTimeoutError(err)) {
        throw new ProviderError('timeout', 'treg did not respond in time. Try again later.');
      }
      throw new ProviderError('provider', 'Could not reach treg. Try again later.');
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await send();
  if (response.status === 429) {
    await sleep(retryAfterMs(response));
    response = await send();
  }

  const text = await response.text();

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      'credential',
      'treg rejected your saved Scrape Credential. Update it in Settings.',
      { status: response.status }
    );
  }
  if (response.status === 409 || response.status === 410 || response.status === 422) {
    throw new ProviderError(
      'provider',
      `treg rejected the request (HTTP ${response.status}): ${providerDetail(text)}`,
      { status: response.status }
    );
  }
  if (response.status === 429) {
    throw new ProviderError(
      'provider',
      `treg is rate limiting requests (HTTP 429): ${providerDetail(text)}`,
      { status: response.status, retryAfterMs: retryAfterMs(response) }
    );
  }
  if (!response.ok) {
    throw new ProviderError(
      'provider',
      `treg request failed (HTTP ${response.status}): ${providerDetail(text)}`,
      { status: response.status }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ProviderError('provider', 'treg returned an unreadable response.');
  }

  return readEnvelopeElement(payload);
}

/** Runs at most `limit` mappers at once, preserving input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  let failure: unknown;

  async function worker(): Promise<void> {
    while (!failed) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index] as T, index);
      } catch (err) {
        if (!failed) {
          failed = true;
          failure = err;
        }
        return;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);

  if (failed) throw failure;
  return results;
}

async function scrapeProfiles(
  input: ProfileScrapeInput,
  token: string,
  _options: ScrapeProviderOptions = {}
): Promise<unknown[]> {
  const endpoint = PROFILE_ENDPOINTS[input.tier];
  if (!endpoint) {
    throw new ProviderError('input', 'Profile tier must be "full" or "full_email".');
  }

  // No URL ever hits both endpoints: the email endpoint already returns the
  // full profile, so the tier decides the single call per URL.
  return mapLimit(input.urls, PROFILE_CONCURRENCY, (url) =>
    callProfileEndpoint(endpoint, url, token)
  );
}

function notImplementedCompany(): never {
  throw new ProviderError(
    'input',
    'Company scraping is not implemented for the treg provider yet.'
  );
}

export const tregProvider: ScrapeProvider = {
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

export default tregProvider;

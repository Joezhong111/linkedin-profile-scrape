import { isRecord, normalizeProfileUrl, normalizeScrapeItem } from '../../lib/normalize';
import {
  ProviderError,
  type CompanyJobStart,
  type CompanyJobState,
  type CompanyScrapeInput,
  type ProfileScrapeInput,
  type ProviderRunState,
  type ScrapeProvider,
  type ScrapeProviderOptions,
  type TregCompanySnapshot,
} from './types';
import { sleep } from './util';

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
const SEARCH_ENDPOINT = 'harvestapi.linkedin.leads.search';
/** Cheapest catalog phone provider: $0.000495 per hit, $0 on a miss. */
const PHONE_ENDPOINT = 'blitzapi.people.phone.find';
const PROFILE_CONCURRENCY = 5;
/** The lead search is paged 25 rows at a time; never read more than 10 pages. */
const SEARCH_PAGE_CAP = 10;
const DEFAULT_RETRY_AFTER_MS = 1000;
const REQUEST_TIMEOUT_MS = 180_000;
const PROVIDER_DETAIL_LIMIT = 300;

interface TregCallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

interface TregEnvelope {
  status?: unknown;
  error?: unknown;
  element?: unknown;
  elements?: unknown;
  pagination?: unknown;
}

function isTimeoutError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
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

/** A 200 response still fails when the envelope reports an error. */
function assertEnvelopeSuccess(payload: unknown): TregEnvelope {
  const envelope: TregEnvelope = isRecord(payload) ? payload : {};
  const status = envelope.status;
  // treg relays the provider's native envelope: HarvestAPI sends HTTP-like
  // numeric statuses (200), while older payloads and tests use "success".
  const statusOk =
    status === 'success' ||
    (typeof status === 'number' && status >= 200 && status < 300) ||
    (typeof status === 'string' && /^2\d\d$/.test(status.trim()));
  if (!statusOk) {
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
  return envelope;
}

function readEnvelopeElement(payload: unknown): unknown {
  const envelope = assertEnvelopeSuccess(payload);
  if (typeof envelope.element !== 'object' || envelope.element === null) {
    throw new ProviderError('provider', 'treg did not return a profile element.');
  }
  return envelope.element;
}

function readEnvelopeElements(payload: unknown): {
  elements: unknown[];
  totalPages: number;
} {
  const envelope = assertEnvelopeSuccess(payload);
  if (!Array.isArray(envelope.elements)) {
    throw new ProviderError('provider', 'treg did not return lead search results.');
  }

  const pagination = (envelope.pagination ?? {}) as { totalPages?: unknown };
  const totalPages =
    typeof pagination.totalPages === 'number' &&
    Number.isFinite(pagination.totalPages) &&
    pagination.totalPages > 0
      ? Math.floor(pagination.totalPages)
      : 1;

  return { elements: envelope.elements, totalPages };
}

/**
 * One logical treg call: one idempotency key, at most one 429 retry that
 * reuses that key. Every other failure is mapped immediately.
 */
async function callEndpoint(
  endpoint: string,
  params: Record<string, string>,
  token: string,
  options: TregCallOptions = {}
): Promise<unknown> {
  const idempotencyKey = crypto.randomUUID();
  const query = new URLSearchParams(params).toString();
  const url = query ? `${TREG_BASE}/${endpoint}?${query}` : `${TREG_BASE}/${endpoint}`;
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Treg-Token': token,
    'Idempotency-Key': idempotencyKey,
    ...options.headers,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const send = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        headers,
        body,
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

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('provider', 'treg returned an unreadable response.');
  }
}

async function callProfileEndpoint(
  endpoint: string,
  profileUrl: string,
  token: string
): Promise<unknown> {
  const params: Record<string, string> = { url: profileUrl };
  // HarvestAPI marks findEmail as required on the email variant; without it
  // treg rejects the request before it reaches the provider.
  if (endpoint === PROFILE_ENDPOINTS.full_email) params.findEmail = 'true';
  const payload = await callEndpoint(endpoint, params, token);
  return readEnvelopeElement(payload);
}

/** BlitzAPI answers `{ found, phone, fair_usage }`; a miss has `phone: null`. */
function readPhone(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const phone = payload.phone;
  if (typeof phone !== 'string') return undefined;
  const trimmed = phone.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Phone is a second, best-effort call. BlitzAPI bills only a hit, and a
 * provider failure must never discard the profile the User already paid for.
 */
async function findPhone(profileUrl: string, token: string): Promise<string | undefined> {
  try {
    const payload = await callEndpoint(PHONE_ENDPOINT, {}, token, {
      method: 'POST',
      body: { person_linkedin_url: profileUrl },
    });
    return readPhone(payload);
  } catch {
    return undefined;
  }
}

/**
 * HarvestAPI has no phone endpoint; attach the sibling lookup under
 * `mobileNumber`, which `normalizeScrapeItem` already maps to `mobile_number`.
 */
function attachPhone(element: unknown, phone: string | undefined): unknown {
  if (!phone) return element;
  if (!isRecord(element)) return element;
  return { ...element, mobileNumber: phone };
}

/** One profile call plus its best-effort phone enrichment. */
async function scrapeProfileWithPhone(
  endpoint: string,
  profileUrl: string,
  token: string
): Promise<unknown> {
  const element = await callProfileEndpoint(endpoint, profileUrl, token);
  const phone = await findPhone(profileUrl, token);
  return attachPhone(element, phone);
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

  // No URL ever hits both profile endpoints: the email endpoint already returns
  // the full profile, so the tier decides the profile call. Phone is a second,
  // best-effort call for either tier.
  return mapLimit(input.urls, PROFILE_CONCURRENCY, (url) =>
    scrapeProfileWithPhone(endpoint, url, token)
  );
}

function searchParams(input: CompanyScrapeInput, page: number): Record<string, string> {
  const params: Record<string, string> = {
    currentCompanies: input.companyUrl,
    page: String(page),
  };
  if (input.locations.length > 0) params.locations = input.locations.join(',');
  if (input.jobTitles.length > 0) params.currentJobTitles = input.jobTitles.join(',');
  if (input.yearsAtCurrentCompanyIds.length > 0) {
    params.yearsAtCurrentCompanyIds = input.yearsAtCurrentCompanyIds.join(',');
  }
  if (input.yearsOfExperienceIds.length > 0) {
    params.yearsOfExperienceIds = input.yearsOfExperienceIds.join(',');
  }
  return params;
}

/**
 * Pages the lead search at 25 rows until the page cap, the provider's last
 * page, or `maxItems` unique profile URLs are collected. Dedupe happens before
 * truncation and `maxItems` is never sent to the provider.
 */
async function createCompanyJob(
  input: CompanyScrapeInput,
  token: string
): Promise<CompanyJobStart> {
  const candidates: string[] = [];
  const seen = new Set<string>();
  let page = 1;
  let totalPages = 1;

  while (page <= Math.min(SEARCH_PAGE_CAP, totalPages) && candidates.length < input.maxItems) {
    const payload = await callEndpoint(SEARCH_ENDPOINT, searchParams(input, page), token);
    const { elements, totalPages: providerPages } = readEnvelopeElements(payload);
    if (page === 1) totalPages = providerPages;

    for (const element of elements) {
      const profileUrl = normalizeScrapeItem(element).profile_url.trim();
      const key = normalizeProfileUrl(profileUrl);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push(profileUrl);
      if (candidates.length >= input.maxItems) break;
    }

    if (elements.length === 0) break;
    page += 1;
  }

  return { candidates };
}

/**
 * Enriches at most five candidates per call. The next cursor is stored in the
 * job snapshot so repeated polls never re-persist an index.
 */
async function pollCompanyJob(
  job: CompanyJobState,
  input: CompanyScrapeInput,
  token: string
): Promise<ProviderRunState> {
  const snapshot = (job.inputSnapshot ?? input) as TregCompanySnapshot;
  const candidates = Array.isArray(snapshot.candidates)
    ? snapshot.candidates.filter(
        (url): url is string => typeof url === 'string' && url.trim().length > 0
      )
    : [];
  const cursor =
    typeof snapshot.cursor === 'number' &&
    Number.isInteger(snapshot.cursor) &&
    snapshot.cursor >= 0
      ? Math.min(snapshot.cursor, candidates.length)
      : 0;

  if (cursor >= candidates.length) {
    return {
      status: 'succeeded',
      progress: cursor,
      resultCount: cursor,
      items: [],
      cursor,
    };
  }

  const endpoint = PROFILE_ENDPOINTS[input.tier];
  if (!endpoint) {
    throw new ProviderError('input', 'Profile tier must be "full" or "full_email".');
  }

  const batch = candidates.slice(cursor, cursor + PROFILE_CONCURRENCY);
  const items = await mapLimit(batch, PROFILE_CONCURRENCY, (url) =>
    scrapeProfileWithPhone(endpoint, url, token)
  );
  const nextCursor = cursor + items.length;

  return {
    status: nextCursor >= candidates.length ? 'succeeded' : 'running',
    progress: nextCursor,
    resultCount: nextCursor,
    items,
    cursor: nextCursor,
  };
}

export const tregProvider: ScrapeProvider = {
  scrapeProfiles,
  createCompanyJob,
  pollCompanyJob,
};

export default tregProvider;

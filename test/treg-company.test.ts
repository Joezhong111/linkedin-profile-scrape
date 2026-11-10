import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import searchPage1 from './fixtures/treg-lead-search-page1.json';
import searchPage2 from './fixtures/treg-lead-search-page2.json';
import tregProfile from './fixtures/treg-profile.json';
import tregProfileEmail from './fixtures/treg-profile-email.json';
import { normalizeScrapeItem } from '../lib/normalize';
import { createDb } from '../worker/db';
import { cleanupOldJobs } from '../worker/jobs';
import { scrapeJobItems, scrapeJobs } from '../db/schema';
import { putCredential, readJson, signUp, workerFetch, type TestSession } from './helpers';

const TOKEN = 'treg_user_token_0123456789';
const COMPANY_URL = 'https://www.linkedin.com/company/acme';
const SEARCH_PATH = '/call/harvestapi.linkedin.leads.search';
const FULL_PATH = '/call/harvestapi.linkedin.user.profile';
const EMAIL_PATH = '/call/harvestapi.linkedin.user.profile.email';

type ScrapeTier = 'full' | 'full_email';

interface ProviderCall {
  url: string;
  init?: RequestInit;
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function stubFetch(handler: FetchHandler) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

interface HarnessOptions {
  search?: (page: number) => Response | Promise<Response>;
  enrich?: (profileUrl: string, tier: ScrapeTier) => Response | Promise<Response>;
}

interface Harness {
  session: TestSession;
  calls: ProviderCall[];
}

function endpointOf(call: ProviderCall): { path: string; params: URLSearchParams } {
  const parsed = new URL(call.url);
  return { path: parsed.pathname, params: parsed.searchParams };
}

function isSearchCall(call: ProviderCall): boolean {
  return endpointOf(call).path.endsWith(SEARCH_PATH);
}

function isProfileCall(call: ProviderCall): boolean {
  const { path } = endpointOf(call);
  return path.endsWith(FULL_PATH) || path.endsWith(EMAIL_PATH);
}

function idempotencyKeyOf(call: ProviderCall): string | null {
  return new Headers(call.init?.headers).get('Idempotency-Key');
}

function leadElement(profileUrl: string): Record<string, unknown> {
  return { ...(searchPage1.elements[0] as Record<string, unknown>), linkedinUrl: profileUrl };
}

function searchResponse(
  elements: unknown[],
  pageNumber: number,
  totalPages: number
): Response {
  return jsonResponse({
    status: 'success',
    error: null,
    elements,
    pagination: {
      pageSize: 25,
      pageNumber,
      totalPages,
      totalElements: elements.length,
      previousElements: (pageNumber - 1) * 25,
    },
  });
}

function enrichedResponse(profileUrl: string, tier: ScrapeTier): Response {
  const element = tier === 'full_email' ? tregProfileEmail.element : tregProfile.element;
  return jsonResponse({
    status: 'success',
    error: null,
    element: { ...element, linkedinUrl: profileUrl },
  });
}

function defaultSearch(page: number): Response {
  if (page === 1) return jsonResponse(searchPage1);
  if (page === 2) return jsonResponse(searchPage2);
  throw new Error(`Unexpected search page ${page}`);
}

/** Signs up and saves a treg credential, then routes every provider call. */
async function signUpWithTreg(options: HarnessOptions = {}): Promise<Harness> {
  const calls: ProviderCall[] = [];
  stubFetch(async (url, init) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    if (parsed.pathname.endsWith(SEARCH_PATH)) {
      const page = Number(parsed.searchParams.get('page') ?? '1');
      return options.search ? options.search(page) : defaultSearch(page);
    }
    if (parsed.pathname.endsWith(EMAIL_PATH)) {
      const profileUrl = parsed.searchParams.get('url') ?? '';
      return options.enrich
        ? options.enrich(profileUrl, 'full_email')
        : enrichedResponse(profileUrl, 'full_email');
    }
    if (parsed.pathname.endsWith(FULL_PATH)) {
      const profileUrl = parsed.searchParams.get('url') ?? '';
      return options.enrich
        ? options.enrich(profileUrl, 'full')
        : enrichedResponse(profileUrl, 'full');
    }
    throw new Error(`Unexpected treg request: ${url}`);
  });

  const session = await signUp();
  const saved = await putCredential(session, 'treg', TOKEN);
  expect(saved.status).toBe(200);
  return { session, calls };
}

function companyBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyUrl: COMPANY_URL,
    maxItems: 10,
    tier: 'full',
    ...overrides,
  };
}

function startCompany(
  token: string | undefined,
  overrides: Record<string, unknown> = {}
): Promise<Response> {
  return workerFetch(
    '/api/scrape_company',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(companyBody(overrides)),
    },
    token
  );
}

function pollStatus(token: string, jobId: string): Promise<Response> {
  return workerFetch(
    `/api/check_scrape_status?jobId=${encodeURIComponent(jobId)}`,
    undefined,
    token
  );
}

interface JobResponse {
  jobId: string;
  status: string;
  progress: number;
  resultCount: number;
}

interface StatusResponse {
  status: string;
  progress: number;
  resultCount: number;
  items?: unknown[];
  stats?: {
    totalReturned: number;
    alreadyExists: number;
    newProfiles: number;
    duplicateRate: number;
  };
  error?: string;
}

async function createJob(harness: Harness, overrides = {}): Promise<JobResponse> {
  const response = await startCompany(harness.session.token, overrides);
  expect(response.status).toBe(202);
  return readJson<JobResponse>(response);
}

interface JobRow {
  status: string;
  progress: number;
  result_count: number;
  error_message: string | null;
  provider_job_ref: string | null;
  input_snapshot: string;
}

async function getJobRow(jobId: string): Promise<JobRow | null> {
  return env.DB.prepare(
    `SELECT status, progress, result_count, error_message, provider_job_ref, input_snapshot
       FROM scrape_jobs WHERE id = ?`
  )
    .bind(jobId)
    .first<JobRow>();
}

async function itemIndexes(jobId: string): Promise<number[]> {
  const rows = await env.DB.prepare(
    'SELECT idx FROM scrape_job_items WHERE job_id = ? ORDER BY idx'
  )
    .bind(jobId)
    .all<{ idx: number }>();
  return rows.results.map((row) => row.idx);
}

async function historyCount(ownerId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM company_scrape_history WHERE owner_id = ?'
  )
    .bind(ownerId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/scrape_company (treg)', () => {
  it('pages the lead search, dedupes across pages, and never sends maxItems', async () => {
    const harness = await signUpWithTreg();

    const response = await startCompany(harness.session.token, {
      maxItems: 10,
      tier: 'full_email',
      jobTitles: ['CEO', 'CTO'],
      locations: ['Guangzhou', 'Shenzhen'],
      yearsAtCurrentCompanyIds: ['3'],
      yearsOfExperienceIds: ['2'],
    });

    expect(response.status).toBe(202);
    const body = await readJson<JobResponse>(response);
    expect(typeof body.jobId).toBe('string');
    expect(body).toMatchObject({ status: 'running', progress: 0, resultCount: 0 });

    const searchCalls = harness.calls.filter(isSearchCall);
    expect(searchCalls).toHaveLength(2);

    for (const [index, call] of searchCalls.entries()) {
      const { params } = endpointOf(call);
      expect(call.init?.method).toBe('GET');
      expect(call.init?.body).toBeUndefined();
      const headers = new Headers(call.init?.headers);
      expect(headers.get('X-Treg-Token')).toBe(TOKEN);
      expect(idempotencyKeyOf(call)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(params.get('currentCompanies')).toBe(COMPANY_URL);
      expect(params.get('page')).toBe(String(index + 1));
      expect(params.get('locations')).toBe('Guangzhou,Shenzhen');
      expect(params.get('currentJobTitles')).toBe('CEO,CTO');
      expect(params.get('yearsAtCurrentCompanyIds')).toBe('3');
      expect(params.get('yearsOfExperienceIds')).toBe('2');
      expect(params.has('maxItems')).toBe(false);
    }

    // Starting the job never enriches: that is the poll's job.
    expect(harness.calls).toHaveLength(2);

    const row = await getJobRow(body.jobId);
    expect(row?.provider_job_ref).toBeNull();
    const snapshot = JSON.parse(row?.input_snapshot ?? '{}') as {
      candidates: string[];
      cursor: number;
    };
    expect(snapshot.candidates).toEqual([
      'https://www.linkedin.com/in/remi-ounadjela',
      'https://www.linkedin.com/in/second-person',
      'https://www.linkedin.com/in/third-person',
    ]);
    expect(snapshot.cursor).toBe(0);
  });

  it('truncates to maxItems after dedupe and stops paging early', async () => {
    const harness = await signUpWithTreg();

    const body = await createJob(harness, { maxItems: 2 });

    expect(harness.calls.filter(isSearchCall)).toHaveLength(1);
    const row = await getJobRow(body.jobId);
    const snapshot = JSON.parse(row?.input_snapshot ?? '{}') as { candidates: string[] };
    expect(snapshot.candidates).toEqual([
      'https://www.linkedin.com/in/remi-ounadjela',
      'https://www.linkedin.com/in/second-person',
    ]);
  });

  it('stops at the ten-page cap even when the provider reports more pages', async () => {
    const elementsForPage = (page: number) =>
      Array.from({ length: 5 }, (_, index) => leadElement(`https://www.linkedin.com/in/cap-${page}-${index}`));
    const harness = await signUpWithTreg({
      search: (page) => searchResponse(elementsForPage(page), page, 25),
    });

    const body = await createJob(harness, { maxItems: 100 });

    expect(harness.calls.filter(isSearchCall)).toHaveLength(10);
    const row = await getJobRow(body.jobId);
    const snapshot = JSON.parse(row?.input_snapshot ?? '{}') as { candidates: string[] };
    expect(snapshot.candidates).toHaveLength(50);
  });

  it('rejects treg filter lists over 70 values and accepts 70', async () => {
    const harness = await signUpWithTreg();
    const seventyTitles = Array.from({ length: 70 }, (_, index) => `Title ${index}`);
    const seventyLocations = Array.from({ length: 70 }, (_, index) => `Place ${index}`);

    const accepted = await startCompany(harness.session.token, {
      jobTitles: seventyTitles,
      locations: seventyLocations,
    });
    expect(accepted.status).toBe(202);

    const tooManyTitles = await startCompany(harness.session.token, {
      jobTitles: [...seventyTitles, 'One more'],
    });
    expect(tooManyTitles.status).toBe(400);
    expect((await readJson<{ error: string }>(tooManyTitles)).error).toContain(
      'At most 70 Job titles'
    );

    const tooManyLocations = await startCompany(harness.session.token, {
      locations: [...seventyLocations, 'One more'],
    });
    expect(tooManyLocations.status).toBe(400);
    expect((await readJson<{ error: string }>(tooManyLocations)).error).toContain(
      'At most 70 Locations'
    );
  });

  it('creates a running job that succeeds with empty stats when search finds nothing', async () => {
    const harness = await signUpWithTreg({
      search: () => searchResponse([], 1, 0),
    });

    const created = await createJob(harness);
    const response = await pollStatus(harness.session.token, created.jobId);
    const body = await readJson<StatusResponse>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'succeeded',
      progress: 0,
      resultCount: 0,
      items: [],
      stats: { totalReturned: 0, alreadyExists: 0, newProfiles: 0, duplicateRate: 0 },
    });
    expect(await historyCount(harness.session.id)).toBe(1);
    expect(harness.calls.filter(isProfileCall)).toHaveLength(0);
  });
});

describe('GET /api/check_scrape_status (treg)', () => {
  it('enriches five candidates per poll, appends items, and reports progress', async () => {
    const candidates = Array.from(
      { length: 7 },
      (_, index) => `https://www.linkedin.com/in/chunk-${index}`
    );
    const harness = await signUpWithTreg({
      search: () => searchResponse(candidates.map(leadElement), 1, 1),
    });
    const created = await createJob(harness, { maxItems: 7 });

    const firstResponse = await pollStatus(harness.session.token, created.jobId);
    const first = await readJson<StatusResponse>(firstResponse);
    expect(firstResponse.status).toBe(200);
    expect(first).toMatchObject({ status: 'running', progress: 5, resultCount: 5 });
    expect(first.items).toBeUndefined();
    expect(harness.calls.filter(isProfileCall)).toHaveLength(5);
    expect(await itemIndexes(created.jobId)).toEqual([0, 1, 2, 3, 4]);

    const secondResponse = await pollStatus(harness.session.token, created.jobId);
    const second = await readJson<StatusResponse>(secondResponse);
    expect(second.status).toBe('succeeded');
    expect(second.progress).toBe(7);
    expect(second.resultCount).toBe(7);
    expect(second.items).toHaveLength(7);
    expect(second.stats).toEqual({
      totalReturned: 7,
      alreadyExists: 0,
      newProfiles: 7,
      duplicateRate: 0,
    });
    expect(harness.calls.filter(isProfileCall)).toHaveLength(7);
    expect(await itemIndexes(created.jobId)).toEqual([0, 1, 2, 3, 4, 5, 6]);

    const callsAfterSuccess = harness.calls.length;
    const repeat = await readJson<StatusResponse>(
      await pollStatus(harness.session.token, created.jobId)
    );
    expect(repeat.status).toBe('succeeded');
    expect(repeat.items).toEqual(second.items);
    expect(harness.calls.length).toBe(callsAfterSuccess);
    expect(await historyCount(harness.session.id)).toBe(1);
  });

  it('maps Full to the profile endpoint and never calls email for the same person', async () => {
    const harness = await signUpWithTreg({
      search: () => searchResponse([leadElement('https://www.linkedin.com/in/one-person')], 1, 1),
    });
    const created = await createJob(harness, { maxItems: 1, tier: 'full' });

    const status = await readJson<StatusResponse>(
      await pollStatus(harness.session.token, created.jobId)
    );

    expect(status.status).toBe('succeeded');
    const profileCalls = harness.calls.filter(isProfileCall);
    expect(profileCalls).toHaveLength(1);
    expect(endpointOf(profileCalls[0]!).path).toBe(FULL_PATH);
    expect(endpointOf(profileCalls[0]!).params.get('url')).toBe(
      'https://www.linkedin.com/in/one-person'
    );
  });

  it('maps Full+email to the email endpoint only and surfaces the email', async () => {
    const harness = await signUpWithTreg({
      search: () => searchResponse([leadElement('https://www.linkedin.com/in/one-person')], 1, 1),
    });
    const created = await createJob(harness, { maxItems: 1, tier: 'full_email' });

    const status = await readJson<StatusResponse>(
      await pollStatus(harness.session.token, created.jobId)
    );

    expect(status.status).toBe('succeeded');
    const profileCalls = harness.calls.filter(isProfileCall);
    expect(profileCalls).toHaveLength(1);
    expect(endpointOf(profileCalls[0]!).path).toBe(EMAIL_PATH);
    const [item] = status.items ?? [];
    expect(normalizeScrapeItem(item).email).toBe('remi.ounadjela@tiktok.com');
  });

  it('counts previously saved leads in the success stats and records history once', async () => {
    const candidates = Array.from(
      { length: 3 },
      (_, index) => `https://www.linkedin.com/in/stats-${index}`
    );
    const harness = await signUpWithTreg({
      search: () => searchResponse(candidates.map(leadElement), 1, 1),
    });

    const saveResponse = await workerFetch(
      '/api/leads/save',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_url: candidates[0], full_name: 'Existing Lead' }),
      },
      harness.session.token
    );
    expect(saveResponse.status).toBe(200);

    const created = await createJob(harness, { maxItems: 3 });
    const status = await readJson<StatusResponse>(
      await pollStatus(harness.session.token, created.jobId)
    );

    expect(status.status).toBe('succeeded');
    expect(status.stats).toEqual({
      totalReturned: 3,
      alreadyExists: 1,
      newProfiles: 2,
      duplicateRate: 33,
    });
    expect(await historyCount(harness.session.id)).toBe(1);

    const history = await workerFetch(
      `/api/check_company_history?companyUrl=${encodeURIComponent(COMPANY_URL)}`,
      undefined,
      harness.session.token
    );
    expect(await readJson<Record<string, unknown>>(history)).toMatchObject({
      hasHistory: true,
      totalScrapes: 1,
      lastScrape: { maxItemsRequested: 3, itemsReturned: 3, itemsSaved: 2 },
    });
  });

  it("never exposes another User's job or its items", async () => {
    const harness = await signUpWithTreg();
    const created = await createJob(harness);
    const stranger = await signUp();

    const response = await pollStatus(stranger.token, created.jobId);

    expect(response.status).toBe(404);
    const body = await readJson<Record<string, unknown>>(response);
    expect(body).not.toHaveProperty('items');
    expect(harness.calls.filter(isProfileCall)).toHaveLength(0);
  });

  it('returns credential_invalid without failing the job when treg rejects the token mid-job', async () => {
    const harness = await signUpWithTreg({
      search: () => searchResponse([leadElement('https://www.linkedin.com/in/one-person')], 1, 1),
      enrich: () => new Response('unauthorized', { status: 401 }),
    });
    const created = await createJob(harness, { maxItems: 1 });

    const response = await pollStatus(harness.session.token, created.jobId);

    expect(response.status).toBe(400);
    expect(await readJson<{ code: string }>(response)).toMatchObject({
      code: 'credential_invalid',
    });
    expect((await getJobRow(created.jobId))?.status).toBe('running');
  });

  it('retries a 429 once with the same idempotency key on the search call', async () => {
    let attempts = 0;
    const harness = await signUpWithTreg({
      search: () => {
        attempts += 1;
        if (attempts === 1) {
          return jsonResponse({ status: 'error', error: 'Rate limit exceeded' }, 429, {
            'Retry-After': '0',
          });
        }
        return jsonResponse(searchPage1);
      },
    });

    const body = await createJob(harness, { maxItems: 2 });

    const searchCalls = harness.calls.filter(isSearchCall);
    expect(searchCalls).toHaveLength(2);
    expect(idempotencyKeyOf(searchCalls[0]!)).toBeTruthy();
    expect(idempotencyKeyOf(searchCalls[1]!)).toBe(idempotencyKeyOf(searchCalls[0]!));
    expect(typeof body.jobId).toBe('string');
  });

  it.each([409, 410, 422])(
    'maps an explicit HTTP %i search failure to 502 with the provider body',
    async (status) => {
      const harness = await signUpWithTreg({
        search: () => new Response('provider body says no', { status }),
      });

      const response = await startCompany(harness.session.token);

      expect(response.status).toBe(502);
      const body = await readJson<{ error: string }>(response);
      expect(body.error).toContain(`HTTP ${status}`);
      expect(body.error).toContain('provider body says no');
    }
  );

  it('marks a treg job failed when enrichment is definitively rejected', async () => {
    const harness = await signUpWithTreg({
      search: () => searchResponse([leadElement('https://www.linkedin.com/in/one-person')], 1, 1),
      enrich: () => new Response('unprocessable profile', { status: 422 }),
    });
    const created = await createJob(harness, { maxItems: 1 });

    const response = await pollStatus(harness.session.token, created.jobId);

    expect(response.status).toBe(200);
    const body = await readJson<StatusResponse>(response);
    expect(body.status).toBe('failed');
    expect(body.items).toBeUndefined();
    expect(body.error).toContain('HTTP 422');

    const row = await getJobRow(created.jobId);
    expect(row?.status).toBe('failed');
    expect(row?.error_message).toContain('HTTP 422');
    expect(await itemIndexes(created.jobId)).toEqual([]);
  });
});

describe('treg company results to Saved Leads', () => {
  it('saves an enriched item with populated fields and an empty phone', async () => {
    const profileUrl = 'https://www.linkedin.com/in/remi-ounadjela';
    const harness = await signUpWithTreg({
      search: () => searchResponse([leadElement(profileUrl)], 1, 1),
    });
    const created = await createJob(harness, { maxItems: 1, tier: 'full_email' });

    const status = await readJson<StatusResponse>(
      await pollStatus(harness.session.token, created.jobId)
    );
    expect(status.status).toBe('succeeded');
    const [item] = status.items ?? [];
    const profile = normalizeScrapeItem(item);
    expect(profile.is_verified).toBe(true);
    expect(profile.is_premium).toBe(false);

    const saveResponse = await workerFetch(
      '/api/leads/save',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          raw_data: item,
          source_company_url: COMPANY_URL,
        }),
      },
      harness.session.token
    );
    expect(saveResponse.status).toBe(200);

    const listResponse = await workerFetch('/api/leads/list', undefined, harness.session.token);
    const list = await readJson<{ data: Array<Record<string, unknown>> }>(listResponse);
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      profile_url: profileUrl,
      full_name: 'Rémi Ounadjela',
      first_name: 'Rémi',
      last_name: 'Ounadjela',
      location: 'San Francisco Bay Area',
      job_title: 'Senior Data Science Manager',
      company_name: 'TikTok',
      current_job_duration: '3 yrs 1 mo',
      job_period: 'Jan 2023 - Present',
      email: 'remi.ounadjela@tiktok.com',
      mobile_number: null,
      followers: 16183,
      connections: 11027,
      source_company_url: COMPANY_URL,
    });
    // The leads table has no verified/premium columns; the enriched raw data
    // keeps them so the SPA can still normalize the flags.
    expect(list.data[0]?.raw_data).toMatchObject({ verified: true, premium: false });
  });
});

describe('treg cleanupOldJobs', () => {
  it('deletes old treg jobs and items, retains fresh jobs and all history', async () => {
    const session = await signUp();
    const db = createDb(env.DB);
    const oldId = crypto.randomUUID();
    const freshId = crypto.randomUUID();
    const snapshot = companyBody();

    await db.insert(scrapeJobs).values([
      {
        id: oldId,
        ownerId: session.id,
        provider: 'treg',
        providerJobRef: null,
        jobType: 'company',
        inputSnapshot: { ...snapshot, candidates: [], cursor: 0 },
        status: 'succeeded',
        progress: 1,
        resultCount: 1,
        createdAt: '2026-10-01T00:00:00.000Z',
        completedAt: '2026-10-01T00:01:00.000Z',
      },
      {
        id: freshId,
        ownerId: session.id,
        provider: 'treg',
        providerJobRef: null,
        jobType: 'company',
        inputSnapshot: { ...snapshot, candidates: [], cursor: 0 },
        status: 'succeeded',
        progress: 1,
        resultCount: 1,
        createdAt: '2026-11-10T00:00:00.000Z',
        completedAt: '2026-11-10T00:01:00.000Z',
      },
    ]);
    await db.insert(scrapeJobItems).values([
      { jobId: oldId, idx: 0, data: { linkedinUrl: 'https://www.linkedin.com/in/old' } },
      { jobId: freshId, idx: 0, data: { linkedinUrl: 'https://www.linkedin.com/in/fresh' } },
    ]);
    await env.DB.prepare(
      `INSERT INTO company_scrape_history
         (id, owner_id, company_url, max_items_requested, items_returned, items_saved, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), session.id, COMPANY_URL, 1, 1, 1, '2026-10-01T00:00:00.000Z')
      .run();

    const deleted = await cleanupOldJobs(db, '2026-11-11T00:00:00.000Z');
    expect(deleted).toBe(1);

    const oldJobs = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, oldId));
    expect(oldJobs).toHaveLength(0);
    const freshJobs = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, freshId));
    expect(freshJobs).toHaveLength(1);

    const oldItems = await db
      .select()
      .from(scrapeJobItems)
      .where(eq(scrapeJobItems.jobId, oldId));
    expect(oldItems).toHaveLength(0);
    const freshItems = await db
      .select()
      .from(scrapeJobItems)
      .where(eq(scrapeJobItems.jobId, freshId));
    expect(freshItems).toHaveLength(1);

    expect(await historyCount(session.id)).toBe(1);
  });
});

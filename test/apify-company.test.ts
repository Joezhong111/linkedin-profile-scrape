import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import companyDataset from './fixtures/apify-company-dataset.json';
import companyRunning from './fixtures/apify-company-running.json';
import companyStarted from './fixtures/apify-company-started.json';
import companySucceeded from './fixtures/apify-company-succeeded.json';
import { normalizeScrapeItem } from '../lib/normalize';
import { createDb } from '../worker/db';
import { cleanupOldJobs } from '../worker/jobs';
import { scrapeJobItems, scrapeJobs } from '../db/schema';
import { putCredential, readJson, signUp, workerFetch, type TestSession } from './helpers';

const TOKEN = 'apify_api_user_token_0123456789';
const COMPANY_URL = 'https://www.linkedin.com/company/acme';
const APIFY_ME_URL = 'https://api.apify.com/v2/users/me';
const START_URL = 'https://api.apify.com/v2/acts/Vb6LZkh4EqRlR0Ka9/runs';
const RUN_URL = 'https://api.apify.com/v2/actor-runs/run_company1';

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface ApifyHarness {
  session: TestSession;
  calls: ProviderCall[];
  responses: Response[];
}

/** Answers Apify token validation, then serves queued run/dataset responses. */
async function signUpWithApify(responses: Response[] = []): Promise<ApifyHarness> {
  const calls: ProviderCall[] = [];
  stubFetch((url, init) => {
    calls.push({ url, init });
    if (url === APIFY_ME_URL) {
      return jsonResponse({ data: { plan: { id: 'STARTER' } } });
    }
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected Apify request: ${url}`);
    return next;
  });
  const session = await signUp();
  const saved = await putCredential(session, 'apify', TOKEN);
  expect(saved.status).toBe(200);
  return { session, calls, responses };
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

async function createAndStart(harness: ApifyHarness, overrides = {}): Promise<JobResponse> {
  const response = await startCompany(harness.session.token, overrides);
  expect(response.status).toBe(202);
  return readJson<JobResponse>(response);
}

/** Creates a job whose Apify run is already terminal in the queue. */
async function startedJob(overrides = {}): Promise<{
  harness: ApifyHarness;
  jobId: string;
}> {
  const harness = await signUpWithApify([jsonResponse(companyStarted)]);
  const created = await createAndStart(harness, overrides);
  return { harness, jobId: created.jobId };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/scrape_company', () => {
  it('returns a job id and starts the canonical company actor with the tier mapping', async () => {
    const harness = await signUpWithApify([jsonResponse(companyStarted)]);

    const response = await startCompany(harness.session.token, {
      maxItems: 10,
      tier: 'full_email',
      jobTitles: ['CEO', 'CTO'],
      locations: ['Guangzhou'],
      yearsAtCurrentCompanyIds: ['3'],
      yearsOfExperienceIds: ['2'],
    });

    expect(response.status).toBe(202);
    const body = await readJson<JobResponse>(response);
    expect(typeof body.jobId).toBe('string');
    expect(body).toMatchObject({ status: 'running', progress: 0, resultCount: 0 });

    const start = harness.calls.find((call) => call.url === START_URL);
    expect(start).toBeDefined();
    expect(start?.init?.method).toBe('POST');
    const headers = new Headers(start?.init?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(start?.init?.body))).toEqual({
      profileScraperMode: 'Full + email search ($12 per 1k)',
      maxItems: 10,
      companies: [COMPANY_URL],
      companyBatchMode: 'all_at_once',
      jobTitles: ['CEO', 'CTO'],
      locations: ['Guangzhou'],
      yearsAtCurrentCompanyIds: ['3'],
      yearsOfExperienceIds: ['2'],
    });
  });

  it('maps the full tier and omits empty filters', async () => {
    const harness = await signUpWithApify([jsonResponse(companyStarted)]);

    await createAndStart(harness, { tier: 'full', maxItems: 5 });

    const start = harness.calls.find((call) => call.url === START_URL);
    expect(JSON.parse(String(start?.init?.body))).toEqual({
      profileScraperMode: 'Full ($8 per 1k)',
      maxItems: 5,
      companies: [COMPANY_URL],
      companyBatchMode: 'all_at_once',
    });
  });

  it('requires a session and a Scrape Credential', async () => {
    const anonymous = await startCompany(undefined);
    expect(anonymous.status).toBe(401);

    const session = await signUp();
    const missing = await startCompany(session.token);
    expect(missing.status).toBe(400);
    expect(await readJson<{ code: string }>(missing)).toMatchObject({
      code: 'credential_missing',
    });
  });

  it('rejects company URL, maxItems, and filter limit violations', async () => {
    const harness = await signUpWithApify();

    const cases: Array<[Record<string, unknown>, string]> = [
      [{ companyUrl: 'https://www.linkedin.com/in/someone' }, 'companyUrl'],
      [{ maxItems: 0 }, 'maxItems'],
      [{ maxItems: 101 }, 'maxItems'],
      [{ maxItems: 1.5 }, 'maxItems'],
      [{ jobTitles: Array.from({ length: 51 }, (_, i) => `Title ${i}`) }, 'Job titles'],
      [{ locations: Array.from({ length: 51 }, (_, i) => `Place ${i}`) }, 'Locations'],
      [{ tier: 'short' }, 'tier'],
    ];

    for (const [overrides, message] of cases) {
      const response = await startCompany(harness.session.token, overrides);
      expect(response.status).toBe(400);
      expect((await readJson<{ error: string }>(response)).error).toContain(message);
    }

    // No invalid request reached the provider.
    expect(harness.calls.some((call) => call.url === START_URL)).toBe(false);
  });
});

describe('GET /api/check_scrape_status', () => {
  it("never exposes another User's job or its items", async () => {
    const { harness, jobId } = await startedJob();
    const stranger = await signUp();

    const response = await pollStatus(stranger.token, jobId);

    expect(response.status).toBe(404);
    const body = await readJson<Record<string, unknown>>(response);
    expect(body).not.toHaveProperty('items');
    expect(harness.calls.filter((call) => call.url === RUN_URL)).toHaveLength(0);
  });

  it('refuses to advance a job with a different provider and leaves it running', async () => {
    const harness = await signUpWithApify([jsonResponse(companyStarted)]);
    const created = await createAndStart(harness);

    const switched = await putCredential(harness.session, 'treg', 'treg_user_token_0123456789');
    expect(switched.status).toBe(200);

    const response = await pollStatus(harness.session.token, created.jobId);

    expect(response.status).toBe(400);
    expect(await readJson<{ error: string; code: string }>(response)).toEqual({
      error:
        'This Scrape Job was started with apify. Switch your Active Provider back to apify and save a credential to resume it.',
      code: 'provider_changed',
    });

    const jobRow = await env.DB.prepare('SELECT status FROM scrape_jobs WHERE id = ?')
      .bind(created.jobId)
      .first<{ status: string }>();
    expect(jobRow?.status).toBe('running');
    expect(harness.calls.filter((call) => call.url === RUN_URL)).toHaveLength(0);

    const historyCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM company_scrape_history WHERE owner_id = ?'
    )
      .bind(harness.session.id)
      .first<{ count: number }>();
    expect(historyCount?.count).toBe(0);
  });

  it('advances one Apify check per request and persists deduped, truncated items once', async () => {
    const harness = await signUpWithApify([
      jsonResponse(companyStarted),
      jsonResponse(companyRunning),
      jsonResponse(companySucceeded),
      jsonResponse(companyDataset),
    ]);

    const created = await createAndStart(harness, { maxItems: 2 });
    expect(created.status).toBe('running');

    const firstPoll = await pollStatus(harness.session.token, created.jobId);
    expect(firstPoll.status).toBe(200);
    expect(await readJson<StatusResponse>(firstPoll)).toMatchObject({
      status: 'running',
      progress: 1,
    });

    const successPoll = await pollStatus(harness.session.token, created.jobId);
    const success = await readJson<StatusResponse>(successPoll);
    expect(success.status).toBe('succeeded');
    expect(success.items).toHaveLength(2);
    expect(success.items?.map((item) => normalizeScrapeItem(item).profile_url)).toEqual([
      'https://www.linkedin.com/in/alice',
      'https://www.linkedin.com/in/bob',
    ]);
    expect(success.stats).toEqual({
      totalReturned: 2,
      alreadyExists: 0,
      newProfiles: 2,
      duplicateRate: 0,
    });

    const callsAfterSuccess = harness.calls.length;
    const repeatPoll = await pollStatus(harness.session.token, created.jobId);
    const repeat = await readJson<StatusResponse>(repeatPoll);
    expect(repeat.status).toBe('succeeded');
    expect(repeat.items).toEqual(success.items);
    expect(harness.calls.length).toBe(callsAfterSuccess);

    const itemCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM scrape_job_items WHERE job_id = ?'
    )
      .bind(created.jobId)
      .first<{ count: number }>();
    expect(itemCount?.count).toBe(2);

    const historyCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM company_scrape_history WHERE owner_id = ?'
    )
      .bind(harness.session.id)
      .first<{ count: number }>();
    expect(historyCount?.count).toBe(1);

    const historyResponse = await workerFetch(
      `/api/check_company_history?companyUrl=${encodeURIComponent(COMPANY_URL)}`,
      undefined,
      harness.session.token
    );
    expect(historyResponse.status).toBe(200);
    expect(await readJson<Record<string, unknown>>(historyResponse)).toMatchObject({
      hasHistory: true,
      totalScrapes: 1,
      lastScrape: { maxItemsRequested: 2, itemsReturned: 2, itemsSaved: 2 },
    });
  });

  it.each([
    ['FAILED', 'failed'],
    ['ABORTED', 'failed'],
    ['TIMED-OUT', 'failed'],
  ])('maps a %s run to a %s job with a readable error', async (runStatus) => {
    const harness = await signUpWithApify([
      jsonResponse(companyStarted),
      jsonResponse({ data: { id: 'run_company1', status: runStatus } }),
    ]);
    const created = await createAndStart(harness);

    const response = await pollStatus(harness.session.token, created.jobId);
    const body = await readJson<StatusResponse>(response);

    expect(response.status).toBe(200);
    expect(body.status).toBe('failed');
    expect(body.items).toBeUndefined();
    expect(body.error).toBeTruthy();
    expect(body.error?.length).toBeGreaterThan(0);
  });

  it.each([['TIMING-OUT'], ['ABORTING']])('keeps polling a %s run', async (runStatus) => {
    const harness = await signUpWithApify([
      jsonResponse(companyStarted),
      jsonResponse({ data: { id: 'run_company1', status: runStatus, stats: { itemsScraped: 2 } } }),
    ]);
    const created = await createAndStart(harness);

    const response = await pollStatus(harness.session.token, created.jobId);

    expect(await readJson<StatusResponse>(response)).toMatchObject({
      status: 'running',
      progress: 2,
    });
  });

  it('returns credential_invalid without failing the job when Apify rejects the token', async () => {
    const harness = await signUpWithApify([
      jsonResponse(companyStarted),
      new Response('unauthorized', { status: 401 }),
    ]);
    const created = await createAndStart(harness);

    const response = await pollStatus(harness.session.token, created.jobId);

    expect(response.status).toBe(400);
    expect(await readJson<{ code: string }>(response)).toMatchObject({
      code: 'credential_invalid',
    });

    const jobRow = await env.DB.prepare('SELECT status FROM scrape_jobs WHERE id = ?')
      .bind(created.jobId)
      .first<{ status: string }>();
    expect(jobRow?.status).toBe('running');
  });
});

describe('company results to Saved Leads', () => {
  it('saves a selected item through the existing Leads path', async () => {
    const harness = await signUpWithApify([
      jsonResponse(companyStarted),
      jsonResponse(companySucceeded),
      jsonResponse(companyDataset),
    ]);
    const created = await createAndStart(harness, { maxItems: 2 });

    const statusResponse = await pollStatus(harness.session.token, created.jobId);
    const status = await readJson<StatusResponse>(statusResponse);
    expect(status.status).toBe('succeeded');

    const [item] = status.items ?? [];
    const profile = normalizeScrapeItem(item);
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
    const list = await readJson<{ data: Array<{ profile_url: string; source_company_url: string }> }>(
      listResponse
    );
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      profile_url: companyDataset[0]?.profileUrl,
      source_company_url: COMPANY_URL,
    });

    const historyCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM company_scrape_history WHERE owner_id = ?'
    )
      .bind(harness.session.id)
      .first<{ count: number }>();
    expect(historyCount?.count).toBe(1);
  });
});

describe('cleanupOldJobs', () => {
  it('deletes old jobs and items, retains fresh jobs and all history', async () => {
    const session = await signUp();
    const db = createDb(env.DB);
    const oldId = crypto.randomUUID();
    const freshId = crypto.randomUUID();

    await db.insert(scrapeJobs).values([
      {
        id: oldId,
        ownerId: session.id,
        provider: 'apify',
        providerJobRef: 'run_old',
        jobType: 'company',
        inputSnapshot: companyBody(),
        status: 'succeeded',
        progress: 1,
        resultCount: 1,
        createdAt: '2026-10-01T00:00:00.000Z',
        completedAt: '2026-10-01T00:01:00.000Z',
      },
      {
        id: freshId,
        ownerId: session.id,
        provider: 'apify',
        providerJobRef: 'run_fresh',
        jobType: 'company',
        inputSnapshot: companyBody(),
        status: 'succeeded',
        progress: 1,
        resultCount: 1,
        createdAt: '2026-11-10T00:00:00.000Z',
        completedAt: '2026-11-10T00:01:00.000Z',
      },
    ]);
    await db.insert(scrapeJobItems).values([
      { jobId: oldId, idx: 0, data: { profileUrl: companyDataset[0]?.profileUrl } },
      { jobId: freshId, idx: 0, data: { profileUrl: companyDataset[0]?.profileUrl } },
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

    const historyCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM company_scrape_history WHERE owner_id = ?'
    )
      .bind(session.id)
      .first<{ count: number }>();
    expect(historyCount?.count).toBe(1);
  });
});

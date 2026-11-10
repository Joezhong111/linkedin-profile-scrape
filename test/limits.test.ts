import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../worker/index';
import { hashPassword } from '../worker/auth';
import { apifyProvider } from '../worker/providers/apify';
import profileItem from './fixtures/apify-profile-item.json';
import profileDataset from './fixtures/apify-dataset-profile.json';
import companyDatasetFixture from './fixtures/apify-company-dataset.json';
import companyRunning from './fixtures/apify-company-running.json';
import companyStarted from './fixtures/apify-company-started.json';
import companySucceeded from './fixtures/apify-company-succeeded.json';
import searchPage1 from './fixtures/treg-lead-search-page1.json';
import searchPage2 from './fixtures/treg-lead-search-page2.json';
import tregProfile from './fixtures/treg-profile.json';
import { putCredential, signUp, workerFetch, type TestSession } from './helpers';

/**
 * Evidence for ticket 12: every number below is measured in workerd through
 * the real Worker code. Counts are compared with the Workers Free limits
 * (10 ms CPU, 50 subrequests, 50 D1 queries per invocation).
 *
 * - D1 queries are counted by wrapping `env.DB` in a Proxy whose `prepare`
 *   trap counts statements; Drizzle prepares once per statement (a batch
 *   prepares each statement it contains).
 * - Subrequests are counted by stubbing the global `fetch`, which is the only
 *   outbound path used by the providers and credential validation.
 * - Timings are medians so a single slow iteration cannot make the suite
 *   flaky. The limits themselves are asserted only as generous sanity ceilings.
 */

const TOKEN = 'apify_api_user_token_0123456789';
const TREG_TOKEN = 'treg_user_token_0123456789';
const PROFILE_URL = 'https://www.linkedin.com/in/remi-ounadjela';
const COMPANY_URL = 'https://www.linkedin.com/company/acme';
const APIFY_ME_URL = 'https://api.apify.com/v2/users/me';

const FREE_CPU_MS = 10;
const FREE_SUBREQUESTS = 50;
const FREE_D1_QUERIES = 50;

interface Measurement {
  label: string;
  d1Queries: number;
  subrequests: number;
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

let outboundCalls: string[] = [];

function resetOutboundCalls(): void {
  outboundCalls = [];
}

function stubFetch(handler: FetchHandler): void {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    outboundCalls.push(url);
    return handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A D1 binding that calls `onPrepare` once per prepared statement. */
function countedDb(onPrepare: () => void): D1Database {
  return new Proxy(env.DB, {
    get(target, property, receiver) {
      if (property === 'prepare') {
        return (query: string) => {
          onPrepare();
          return target.prepare(query);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
}

interface MeasuredResponse {
  status: number;
  d1Queries: number;
  subrequests: number;
  body: unknown;
}

/** Runs one HTTP invocation with a counting DB binding and fetch stub. */
async function measure(
  path: string,
  init?: RequestInit,
  token?: string
): Promise<MeasuredResponse> {
  let d1Queries = 0;
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  resetOutboundCalls();
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(`https://limits.example.com${path}`, {
      method: init?.method,
      headers,
      body: init?.body,
    }),
    { DB: countedDb(() => (d1Queries += 1)), ASSETS: env.ASSETS, CREDENTIAL_ENCRYPTION_KEY: env.CREDENTIAL_ENCRYPTION_KEY },
    ctx
  );
  await waitOnExecutionContext(ctx);

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON responses are kept as text.
  }

  return {
    status: response.status,
    d1Queries,
    subrequests: outboundCalls.length,
    body,
  };
}

/** Logs a measured invocation and asserts it stays below the Free limits. */
function expectWithinFreeLimits(measurement: Measurement): void {
  console.log(
    `[limits] ${measurement.label}: D1 queries=${measurement.d1Queries} (limit ${FREE_D1_QUERIES}), subrequests=${measurement.subrequests} (limit ${FREE_SUBREQUESTS})`
  );
  expect(measurement.d1Queries, `${measurement.label} D1 queries`).toBeLessThan(
    FREE_D1_QUERIES
  );
  expect(measurement.subrequests, `${measurement.label} subrequests`).toBeLessThan(
    FREE_SUBREQUESTS
  );
}

function expectWithinFreeLimitsFrom(label: string, measured: MeasuredResponse): void {
  expectWithinFreeLimits({
    label,
    d1Queries: measured.d1Queries,
    subrequests: measured.subrequests,
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return ((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function companyItems(count: number): Record<string, unknown>[] {
  const base = companyDatasetFixture[0]!;
  return Array.from({ length: count }, (_, index) => ({
    ...base,
    profileUrl: `https://www.linkedin.com/in/limits-company-${index}`,
    fullName: `Limits ${index}`,
    email: `limits-${index}@example.com`,
  }));
}

async function apifySession(): Promise<TestSession> {
  stubFetch((url) => {
    if (url === APIFY_ME_URL) return jsonResponse({ data: { plan: { id: 'STARTER' } } });
    throw new Error(`Unexpected fetch during Apify credential setup: ${url}`);
  });
  const session = await signUp();
  const saved = await putCredential(session, 'apify', TOKEN);
  expect(saved.status).toBe(200);
  resetOutboundCalls();
  return session;
}

async function tregSession(): Promise<TestSession> {
  const session = await signUp();
  const saved = await putCredential(session, 'treg', TREG_TOKEN);
  expect(saved.status).toBe(200);
  resetOutboundCalls();
  return session;
}

function companyBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { companyUrl: COMPANY_URL, maxItems: 100, tier: 'full', ...overrides };
}

function tregSearchPage(
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

function tregLead(profileUrl: string): Record<string, unknown> {
  return {
    ...searchPage1.elements[0]!,
    linkedinUrl: profileUrl,
  };
}

/** Reads the job id from an untrusted response body. */
function jobIdOf(body: unknown): string {
  if (body && typeof body === 'object' && 'jobId' in body && typeof body.jobId === 'string') {
    return body.jobId;
  }
  throw new Error('Expected a jobId in the response');
}

/** Narrows a job status body to its succeeded shape. */
function succeededBodyOf(body: unknown): { status: string; items: unknown[] } {
  if (
    body &&
    typeof body === 'object' &&
    'status' in body &&
    body.status === 'succeeded' &&
    'items' in body &&
    Array.isArray(body.items)
  ) {
    return { status: body.status, items: body.items };
  }
  throw new Error('Expected a succeeded job payload with items');
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetOutboundCalls();
});

describe('Workers Free limits', () => {
  it('measures sign-in PBKDF2 wall-clock and D1 queries', async () => {
    const session = await signUp();
    const timings: number[] = [];
    let measured: MeasuredResponse | null = null;

    for (let run = 0; run < 20; run += 1) {
      const startedAt = performance.now();
      measured = await measure('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, password: session.password }),
      });
      timings.push(performance.now() - startedAt);
      expect(measured.status).toBe(200);
    }

    const signInMedian = median(timings);
    expect(measured).not.toBeNull();
    expectWithinFreeLimitsFrom('POST /api/auth/signin', measured!);
    console.log(
      `[limits] PBKDF2-SHA512 (10k iterations, 512 bits) sign-in wall-clock: median=${signInMedian.toFixed(2)}ms min=${Math.min(...timings).toFixed(2)}ms max=${Math.max(...timings).toFixed(2)}ms over 20 runs (Free CPU limit ${FREE_CPU_MS}ms; wall-clock includes local D1)`
    );

    const hashTimings: number[] = [];
    for (let run = 0; run < 20; run += 1) {
      const startedAt = performance.now();
      await hashPassword('limits-benchmark-password');
      hashTimings.push(performance.now() - startedAt);
    }
    const hashMedian = median(hashTimings);
    console.log(
      `[limits] PBKDF2-SHA512 hash only: median=${hashMedian.toFixed(2)}ms min=${Math.min(...hashTimings).toFixed(2)}ms max=${Math.max(...hashTimings).toFixed(2)}ms over 20 runs`
    );

    expect(signInMedian).toBeLessThan(2000);
    expect(hashMedian).toBeLessThan(1000);
  });

  it('measures profiles list, leads list, and leads batch-delete D1 queries', async () => {
    const session = await signUp();

    const savedProfile = await workerFetch(
      '/api/profiles/save',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_url: PROFILE_URL, full_name: 'Remi Ounjadjela' }),
      },
      session.token
    );
    expect(savedProfile.status).toBe(200);
    const profiles = await measure('/api/profiles/list', undefined, session.token);
    expect(profiles.status).toBe(200);
    expectWithinFreeLimitsFrom('GET /api/profiles/list', profiles);

    const savedLead = await workerFetch(
      '/api/leads/save',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_url: PROFILE_URL, full_name: 'Remi Ounjadjela' }),
      },
      session.token
    );
    expect(savedLead.status).toBe(200);
    const leads = await measure('/api/leads/list', undefined, session.token);
    expect(leads.status).toBe(200);
    expectWithinFreeLimitsFrom('GET /api/leads/list', leads);

    // 100 ids exercise the 90-id delete chunking twice.
    const ids = Array.from(
      { length: 100 },
      (_, index) => `${session.id}-limits-lead-${index}`
    );
    const now = new Date().toISOString();
    await env.DB.batch(
      ids.map((id, index) =>
        env.DB.prepare(
          'INSERT INTO linkedin_leads (id, created_at, owner_id, profile_url) VALUES (?, ?, ?, ?)'
        ).bind(id, now, session.id, `https://www.linkedin.com/in/limits-lead-${index}`)
      )
    );
    const batchDelete = await measure(
      '/api/leads/batch-delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      },
      session.token
    );
    expect(batchDelete.status).toBe(200);
    expect(batchDelete.body).toEqual({ deleted: 100 });
    expectWithinFreeLimitsFrom('POST /api/leads/batch-delete (100 ids)', batchDelete);
  });

  it('measures Apify company job start and poll accounting', async () => {
    const session = await apifySession();

    stubFetch(() => jsonResponse(companyStarted));
    const started = await measure(
      '/api/scrape_company',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyBody({ maxItems: 100 })),
      },
      session.token
    );
    expect(started.status).toBe(202);
    expectWithinFreeLimitsFrom('POST /api/scrape_company (Apify start)', started);
    const jobId = jobIdOf(started.body);

    stubFetch(() => jsonResponse(companyRunning));
    const running = await measure(
      `/api/check_scrape_status?jobId=${encodeURIComponent(jobId)}`,
      undefined,
      session.token
    );
    expect(running.status).toBe(200);
    expect(running.body).toMatchObject({ status: 'running' });
    expectWithinFreeLimitsFrom('GET /api/check_scrape_status (Apify running poll)', running);

    const dataset100 = companyItems(100);
    const responses = [jsonResponse(companySucceeded), jsonResponse(dataset100)];
    stubFetch(() => {
      const next = responses.shift();
      if (!next) throw new Error('Unexpected Apify request');
      return next;
    });
    const succeeded = await measure(
      `/api/check_scrape_status?jobId=${encodeURIComponent(jobId)}`,
      undefined,
      session.token
    );
    expect(succeeded.status).toBe(200);
    const succeededBody = succeededBodyOf(succeeded.body);
    expect(succeededBody.status).toBe('succeeded');
    expect(succeededBody.items).toHaveLength(100);
    expectWithinFreeLimitsFrom(
      'GET /api/check_scrape_status (Apify success poll, 100 items)',
      succeeded
    );
  });

  it('measures Apify profile scrape subrequests (start + poll + dataset)', async () => {
    resetOutboundCalls();
    const responses = [
      jsonResponse({
        data: { id: 'run_limits', status: 'RUNNING', defaultDatasetId: 'dataset_limits' },
      }),
      jsonResponse({
        data: { id: 'run_limits', status: 'SUCCEEDED', defaultDatasetId: 'dataset_limits' },
      }),
      jsonResponse(profileDataset),
    ];
    stubFetch(() => {
      const next = responses.shift();
      if (!next) throw new Error('Unexpected Apify request');
      return next;
    });

    const items = await apifyProvider.scrapeProfiles(
      { urls: [PROFILE_URL], tier: 'full' },
      TOKEN,
      { pollDelayMs: 0, maxWaitMs: 5000 }
    );
    expect(items).toEqual(profileDataset);
    expect(outboundCalls).toHaveLength(3);
    expectWithinFreeLimits({ label: 'Apify profile scrape', d1Queries: 0, subrequests: outboundCalls.length });
  });

  it('measures treg profile chunk subrequests (10-URL cap)', async () => {
    const session = await tregSession();
    stubFetch(() => jsonResponse(tregProfile));
    const urls = Array.from(
      { length: 10 },
      (_, index) => `https://www.linkedin.com/in/limits-treg-${index}`
    );

    const measured = await measure(
      '/api/scrape',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, tier: 'full' }),
      },
      session.token
    );
    expect(measured.status).toBe(200);
    expect(measured.body).toHaveLength(10);
    expect(measured.subrequests).toBe(10);
    expectWithinFreeLimitsFrom('POST /api/scrape (treg 10 profiles)', measured);
  });

  it('measures treg company start page cap and poll chunk accounting', async () => {
    const session = await tregSession();

    // One lead per page with 10 total pages: the adapter's SEARCH_PAGE_CAP.
    stubFetch((url) => {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      return tregSearchPage(
        [tregLead(`https://www.linkedin.com/in/limits-page-${page}`)],
        page,
        10
      );
    });
    const cappedStart = await measure(
      '/api/scrape_company',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyBody({ maxItems: 100 })),
      },
      session.token
    );
    expect(cappedStart.status).toBe(202);
    expect(cappedStart.subrequests).toBe(10);
    expectWithinFreeLimitsFrom('POST /api/scrape_company (treg 10 search pages)', cappedStart);

    const responses = [jsonResponse(searchPage1), jsonResponse(searchPage2)];
    stubFetch(() => {
      const next = responses.shift();
      if (!next) throw new Error('Unexpected treg search request');
      return next;
    });
    const started = await measure(
      '/api/scrape_company',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyBody({ maxItems: 5 })),
      },
      session.token
    );
    expect(started.status).toBe(202);
    expectWithinFreeLimitsFrom('POST /api/scrape_company (treg search)', started);
    const jobId = jobIdOf(started.body);

    stubFetch((url) => {
      const profileUrl = new URL(url).searchParams.get('url') ?? '';
      return jsonResponse({
        status: 'success',
        error: null,
        element: {
          ...(tregProfile.element ?? {}),
          linkedinUrl: profileUrl,
        },
      });
    });
    const poll = await measure(
      `/api/check_scrape_status?jobId=${encodeURIComponent(jobId)}`,
      undefined,
      session.token
    );
    expect(poll.status).toBe(200);
    expect(poll.body).toMatchObject({ status: 'succeeded' });
    expect(poll.subrequests).toBeLessThanOrEqual(5);
    expectWithinFreeLimitsFrom('GET /api/check_scrape_status (treg 5-profile chunk)', poll);
  });

  it('measures JSON parse cost for a profile and a 100-item company dataset', () => {
    // workerd's performance.now() has 1 ms resolution here, so each sample
    // parses 1,000 times and the median is reported per parse.
    const parsesPerSample = 1000;
    const samples = 20;

    function medianParseMs(json: string): { median: number; min: number; max: number } {
      const timings: number[] = [];
      for (let sample = 0; sample < samples; sample += 1) {
        const startedAt = performance.now();
        for (let run = 0; run < parsesPerSample; run += 1) JSON.parse(json);
        timings.push((performance.now() - startedAt) / parsesPerSample);
      }
      return { median: median(timings), min: Math.min(...timings), max: Math.max(...timings) };
    }

    const profileJson = JSON.stringify(profileItem);
    const profile = medianParseMs(profileJson);

    const datasetJson = JSON.stringify(companyItems(100));
    const dataset = medianParseMs(datasetJson);

    console.log(
      `[limits] JSON.parse profile item (${profileJson.length} chars): median=${profile.median.toFixed(4)}ms min=${profile.min.toFixed(4)}ms max=${profile.max.toFixed(4)}ms per parse (${parsesPerSample} parses x ${samples} samples)`
    );
    console.log(
      `[limits] JSON.parse 100-item company dataset (${datasetJson.length} chars): median=${dataset.median.toFixed(4)}ms min=${dataset.min.toFixed(4)}ms max=${dataset.max.toFixed(4)}ms per parse (${parsesPerSample} parses x ${samples} samples)`
    );

    expect(profile.median).toBeLessThan(100);
    expect(dataset.median).toBeLessThan(250);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import apifyItem from './fixtures/apify-profile-item.json';
import dataset from './fixtures/apify-dataset-profile.json';
import runFailed from './fixtures/apify-run-failed.json';
import runRunning from './fixtures/apify-run-running.json';
import runStarted from './fixtures/apify-run-started.json';
import runSucceeded from './fixtures/apify-run-succeeded.json';
import { normalizeScrapeItem } from '../lib/normalize';
import { apifyProvider } from '../worker/providers/apify';
import { ProviderError } from '../worker/providers/types';
import { putCredential, readJson, signUp, workerFetch, type TestSession } from './helpers';

const TOKEN = 'apify_api_user_token_0123456789';
const PROFILE_URL = 'https://www.linkedin.com/in/remi-ounadjela';
const APIFY_ME_URL = 'https://api.apify.com/v2/users/me';
const START_URL = 'https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/runs';
const RUN_URL = 'https://api.apify.com/v2/actor-runs/run_abc123';
const DATASET_URL =
  'https://api.apify.com/v2/datasets/dataset_abc123/items?format=json&clean=true';

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

/** Queues actor-run responses after answering Apify token validation. */
function stubApifyBackend(responses: Response[]) {
  return stubFetch((url) => {
    if (url === APIFY_ME_URL) {
      return jsonResponse({ data: { plan: { id: 'STARTER' } } });
    }
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected Apify request: ${url}`);
    return next;
  });
}

async function signUpWithApify(responses: Response[] = []): Promise<TestSession> {
  stubApifyBackend(responses);
  const session = await signUp();
  const saved = await putCredential(session, 'apify', TOKEN);
  expect(saved.status).toBe(200);
  return session;
}

function scrape(token: string | undefined, body: unknown): Promise<Response> {
  return workerFetch(
    '/api/scrape',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Apify profile adapter', () => {
  it('starts the canonical actor run, polls transitions, and reads a bare dataset array', async () => {
    const calls: ProviderCall[] = [];
    const responses = [
      jsonResponse(runStarted),
      jsonResponse(runRunning),
      jsonResponse(runSucceeded),
      jsonResponse(dataset),
    ];
    stubFetch((url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected Apify request: ${url}`);
      return next;
    });

    const items = await apifyProvider.scrapeProfiles(
      { urls: [PROFILE_URL], tier: 'full' },
      TOKEN,
      { pollDelayMs: 0, maxWaitMs: 5000 }
    );

    expect(items).toEqual(dataset);
    expect(calls.map((call) => call.url)).toEqual([START_URL, RUN_URL, RUN_URL, DATASET_URL]);

    const start = calls[0]!;
    expect(start.init?.method).toBe('POST');
    const startHeaders = new Headers(start.init?.headers);
    expect(startHeaders.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(startHeaders.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(start.init?.body))).toEqual({ profileUrls: [PROFILE_URL] });

    for (const call of calls) {
      expect(new Headers(call.init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    }
    expect(calls[1]!.init?.method ?? 'GET').toBe('GET');
  });

  it('returns an empty bare array when the dataset is empty', async () => {
    stubFetch((url) => {
      if (url === START_URL) return jsonResponse(runSucceeded);
      if (url === DATASET_URL) return jsonResponse([]);
      throw new Error(`Unexpected Apify request: ${url}`);
    });

    const items = await apifyProvider.scrapeProfiles(
      { urls: [PROFILE_URL], tier: 'full' },
      TOKEN,
      { pollDelayMs: 0, maxWaitMs: 5000 }
    );

    expect(items).toEqual([]);
  });

  it('maps a FAILED run to a provider error', async () => {
    stubFetch(() => jsonResponse(runFailed));

    await expect(
      apifyProvider.scrapeProfiles(
        { urls: [PROFILE_URL], tier: 'full' },
        TOKEN,
        { pollDelayMs: 0, maxWaitMs: 5000 }
      )
    ).rejects.toMatchObject({ name: 'ProviderError', kind: 'provider' });
  });

  it('maps a TIMED-OUT run to a provider error', async () => {
    stubFetch(() =>
      jsonResponse({
        data: { id: 'run_abc123', status: 'TIMED-OUT', defaultDatasetId: 'dataset_abc123' },
      })
    );

    await expect(
      apifyProvider.scrapeProfiles(
        { urls: [PROFILE_URL], tier: 'full' },
        TOKEN,
        { pollDelayMs: 0, maxWaitMs: 5000 }
      )
    ).rejects.toMatchObject({ kind: 'provider' });
  });

  it('maps a polling timeout to a timeout error without sleeping', async () => {
    stubFetch(() => jsonResponse(runStarted));

    await expect(
      apifyProvider.scrapeProfiles(
        { urls: [PROFILE_URL], tier: 'full' },
        TOKEN,
        { pollDelayMs: 0, maxWaitMs: 0 }
      )
    ).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('maps provider 401 to a credential error', async () => {
    stubFetch(() => new Response('unauthorized', { status: 401 }));

    await expect(
      apifyProvider.scrapeProfiles(
        { urls: [PROFILE_URL], tier: 'full' },
        TOKEN,
        { pollDelayMs: 0, maxWaitMs: 5000 }
      )
    ).rejects.toMatchObject({ kind: 'credential' });
  });

  it('maps provider 500 to a provider error', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));

    const error = await apifyProvider
      .scrapeProfiles({ urls: [PROFILE_URL], tier: 'full' }, TOKEN, {
        pollDelayMs: 0,
        maxWaitMs: 5000,
      })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe('provider');
    expect((error as ProviderError).message).toContain('HTTP 500');
  });
});

describe('POST /api/scrape', () => {
  it('requires a session', async () => {
    const response = await scrape(undefined, { urls: [PROFILE_URL] });
    expect(response.status).toBe(401);
  });

  it('returns credential_missing when no Scrape Credential is configured', async () => {
    const session = await signUp();

    const response = await scrape(session.token, { urls: [PROFILE_URL] });

    expect(response.status).toBe(400);
    expect(await readJson<{ error: string; code: string }>(response)).toMatchObject({
      code: 'credential_missing',
    });
  });

  it('rejects more than 10 Profile URLs', async () => {
    const session = await signUpWithApify();
    const urls = Array.from({ length: 11 }, (_, i) => `https://www.linkedin.com/in/person-${i}`);

    const response = await scrape(session.token, { urls });

    expect(response.status).toBe(400);
    expect((await readJson<{ error: string }>(response)).error).toContain('At most 10');
  });

  it('rejects a non-profile URL', async () => {
    const session = await signUpWithApify();

    const response = await scrape(session.token, {
      urls: ['https://www.linkedin.com/company/tiktok'],
    });

    expect(response.status).toBe(400);
    expect((await readJson<{ error: string }>(response)).error).toContain('linkedin.com/in/');
  });

  it('returns raw provider items as a bare array', async () => {
    const session = await signUpWithApify([jsonResponse(runSucceeded), jsonResponse(dataset)]);

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual(dataset);
  });

  it('maps a provider 401 to 400 credential_invalid', async () => {
    const session = await signUpWithApify([new Response('unauthorized', { status: 401 })]);

    const response = await scrape(session.token, { urls: [PROFILE_URL] });

    expect(response.status).toBe(400);
    expect(await readJson<{ error: string; code: string }>(response)).toMatchObject({
      code: 'credential_invalid',
    });
  });

  it('maps a provider 500 to a readable 502', async () => {
    const session = await signUpWithApify([new Response('boom', { status: 500 })]);

    const response = await scrape(session.token, { urls: [PROFILE_URL] });

    expect(response.status).toBe(502);
    expect((await readJson<{ error: string }>(response)).error).toContain('HTTP 500');
  });

  it('maps a FAILED run to 502', async () => {
    const session = await signUpWithApify([jsonResponse(runFailed)]);

    const response = await scrape(session.token, { urls: [PROFILE_URL] });

    expect(response.status).toBe(502);
    expect((await readJson<{ error: string }>(response)).error).toContain('failed');
  });

  it('maps a TIMED-OUT run to 502', async () => {
    const session = await signUpWithApify([
      jsonResponse({
        data: { id: 'run_abc123', status: 'TIMED-OUT', defaultDatasetId: 'dataset_abc123' },
      }),
    ]);

    const response = await scrape(session.token, { urls: [PROFILE_URL] });

    expect(response.status).toBe(502);
    expect((await readJson<{ error: string }>(response)).error).toContain('timed out');
  });
});

interface SavedProfile {
  profile_url: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  email: string | null;
  followers: number | null;
  job_title: string | null;
  company_name: string | null;
  raw_data: unknown;
}

describe('Apify preview to Saved Profile', () => {
  it('normalizes a scraped item into populated Saved Profile fields with raw_data retained', async () => {
    const session = await signUpWithApify([jsonResponse(runSucceeded), jsonResponse(dataset)]);

    const scrapeResponse = await scrape(session.token, { urls: [PROFILE_URL] });
    expect(scrapeResponse.status).toBe(200);
    const [item] = await readJson<unknown[]>(scrapeResponse);
    expect(item).toEqual(apifyItem);

    const profile = normalizeScrapeItem(item);
    expect(profile.profile_url).toBe(apifyItem.profileUrl);

    const saveResponse = await workerFetch(
      '/api/profiles/save',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, raw_data: item }),
      },
      session.token
    );
    expect(saveResponse.status).toBe(200);

    const listResponse = await workerFetch('/api/profiles/list', undefined, session.token);
    expect(listResponse.status).toBe(200);
    const [saved] = await readJson<SavedProfile[]>(listResponse);

    expect(saved).toMatchObject({
      profile_url: apifyItem.profileUrl,
      full_name: 'Remi Ounadjela',
      headline: 'Senior Data Science Manager at TikTok',
      location: 'San Francisco Bay Area',
      email: 'remi.ounadjela@tiktok.com',
      followers: 4231,
      job_title: 'Senior Data Science Manager',
      company_name: 'TikTok',
    });
    expect(saved?.raw_data).toEqual(apifyItem);
  });
});

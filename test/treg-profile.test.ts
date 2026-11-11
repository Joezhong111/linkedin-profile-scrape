import { afterEach, describe, expect, it, vi } from 'vitest';
import tregProfile from './fixtures/treg-profile.json';
import tregProfileEmail from './fixtures/treg-profile-email.json';
import tregProfileNoEmail from './fixtures/treg-profile-no-email.json';
import blitzapiPhone from './fixtures/blitzapi-phone.json';
import { normalizeScrapeItem } from '../lib/normalize';
import { tregProvider } from '../worker/providers/treg';
import { putCredential, readJson, signUp, workerFetch, type TestSession } from './helpers';

const TOKEN = 'treg_user_token_0123456789';
const PROFILE_URL = 'https://www.linkedin.com/in/remiounadjela';
const FULL_ENDPOINT = 'https://treg.to/call/harvestapi.linkedin.user.profile';
const EMAIL_ENDPOINT = 'https://treg.to/call/harvestapi.linkedin.user.profile.email';
const PHONE_ENDPOINT = 'https://treg.to/call/blitzapi.people.phone.find';
const PHONE_HIT = blitzapiPhone.hit;
const PHONE_MISS = blitzapiPhone.miss;

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

/** Phone is a second call; tests that do not inspect it get a clean miss. */
function stubTregFetch(
  handler: FetchHandler,
  phone: FetchHandler = () => jsonResponse(PHONE_MISS)
) {
  return stubFetch((url, init) =>
    url.startsWith(PHONE_ENDPOINT) ? phone(url, init) : handler(url, init)
  );
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function signUpWithTreg(): Promise<TestSession> {
  const session = await signUp();
  const saved = await putCredential(session, 'treg', TOKEN);
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

function endpointOf(call: ProviderCall): { origin: string; path: string; params: URLSearchParams } {
  const parsed = new URL(call.url);
  return {
    origin: parsed.origin,
    path: `${parsed.origin}${parsed.pathname}`,
    params: parsed.searchParams,
  };
}

function idempotencyKeyOf(call: ProviderCall): string | null {
  return new Headers(call.init?.headers).get('Idempotency-Key');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('treg profile adapter', () => {
  it('maps Full to the full-profile endpoint with GET query params and treg headers', async () => {
    const calls: ProviderCall[] = [];
    stubTregFetch((url, init) => {
      calls.push({ url, init });
      return jsonResponse(tregProfile);
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const endpoint = endpointOf(call);
    expect(endpoint.path).toBe(FULL_ENDPOINT);
    expect(endpoint.params.get('url')).toBe(PROFILE_URL);
    expect(call.init?.method).toBe('GET');
    expect(call.init?.body).toBeUndefined();

    const headers = new Headers(call.init?.headers);
    expect(headers.get('X-Treg-Token')).toBe(TOKEN);
    expect(idempotencyKeyOf(call)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('accepts the provider native numeric status envelope', async () => {
    stubTregFetch(() =>
      jsonResponse({ status: 200, error: null, element: tregProfile.element, cost: 3200 })
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);
  });

  it('accepts a numeric-string 2xx envelope when error is absent', async () => {
    stubTregFetch(() =>
      jsonResponse({ status: '200', element: tregProfile.element, cost: 3200 })
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);
  });

  it('rejects a native envelope with a non-2xx numeric status', async () => {
    stubTregFetch(() => jsonResponse({ status: 422, error: null, element: null }));
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    const body = await readJson<{ error: string }>(response);
    expect(body.error).toContain('treg returned an error');
    expect(body.error).not.toContain(TOKEN);
  });

  it('rejects a numeric 2xx envelope that carries a provider error', async () => {
    stubTregFetch(() =>
      jsonResponse({ status: 200, error: 'Insufficient credits', element: tregProfile.element })
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    const body = await readJson<{ error: string }>(response);
    expect(body.error).toContain('Insufficient credits');
    expect(body.error).not.toContain(TOKEN);
  });

  it('calls the full-profile endpoint once per Profile URL', async () => {
    const urls = [PROFILE_URL, 'https://www.linkedin.com/in/second-person'];
    const calls: ProviderCall[] = [];
    stubTregFetch((url, init) => {
      calls.push({ url, init });
      return jsonResponse(tregProfile);
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls, tier: 'full' });

    expect(response.status).toBe(200);
    expect(calls.map((call) => endpointOf(call).path)).toEqual([FULL_ENDPOINT, FULL_ENDPOINT]);
    expect(calls.map((call) => endpointOf(call).params.get('url'))).toEqual(urls);
    expect(calls.some((call) => endpointOf(call).params.has('findEmail'))).toBe(false);
  });

  it('enriches the profile with the cheapest phone lookup and maps mobile_number', async () => {
    const profileCalls: ProviderCall[] = [];
    const phoneCalls: ProviderCall[] = [];
    stubTregFetch(
      (url, init) => {
        profileCalls.push({ url, init });
        return jsonResponse(tregProfile);
      },
      (url, init) => {
        phoneCalls.push({ url, init });
        return jsonResponse(PHONE_HIT);
      }
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    const [element] = await readJson<Record<string, unknown>[]>(response);
    expect(element).toMatchObject({ ...tregProfile.element, mobileNumber: '+1 415 555 0100' });
    expect(normalizeScrapeItem(element).mobile_number).toBe('+1 415 555 0100');

    expect(profileCalls).toHaveLength(1);
    expect(endpointOf(profileCalls[0]!).path).toBe(FULL_ENDPOINT);

    expect(phoneCalls).toHaveLength(1);
    const phone = phoneCalls[0]!;
    const endpoint = endpointOf(phone);
    expect(endpoint.path).toBe(PHONE_ENDPOINT);
    expect(endpoint.params.toString()).toBe('');
    expect(phone.init?.method).toBe('POST');
    expect(JSON.parse(String(phone.init?.body))).toEqual({ person_linkedin_url: PROFILE_URL });
    const headers = new Headers(phone.init?.headers);
    expect(headers.get('X-Treg-Token')).toBe(TOKEN);
    expect(headers.get('X-Treg-Route-Max-Cost')).toBeNull();
    expect([...headers.keys()].filter((name) => /cost|verif/i.test(name))).toEqual([]);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it.each(['full', 'full_email'] as const)(
    'makes one profile call then one phone call per URL on the %s tier',
    async (tier) => {
      const calls: ProviderCall[] = [];
      stubFetch((url, init) => {
        calls.push({ url, init });
        if (url.startsWith(PHONE_ENDPOINT)) return jsonResponse(PHONE_HIT);
        return jsonResponse(
          url.startsWith(EMAIL_ENDPOINT) ? tregProfileEmail : tregProfile
        );
      });
      const session = await signUpWithTreg();
      const urls = [PROFILE_URL, 'https://www.linkedin.com/in/second-person'];

      const response = await scrape(session.token, { urls, tier });

      expect(response.status).toBe(200);
      const items = await readJson<Record<string, unknown>[]>(response);
      expect(items).toHaveLength(2);

      const profileEndpoint = tier === 'full' ? FULL_ENDPOINT : EMAIL_ENDPOINT;
      // Two provider calls per URL, with the phone lookup after the profile.
      expect(calls).toHaveLength(4);
      for (const profileUrl of urls) {
        expect(
          calls
            .filter((call) => {
              const endpoint = endpointOf(call);
              if (endpoint.path === PHONE_ENDPOINT) {
                const body = JSON.parse(String(call.init?.body)) as Record<string, unknown>;
                return body.person_linkedin_url === profileUrl;
              }
              return endpoint.params.get('url') === profileUrl;
            })
            .map((call) => endpointOf(call).path)
        ).toEqual([profileEndpoint, PHONE_ENDPOINT]);
      }
      for (const item of items) {
        expect(normalizeScrapeItem(item).mobile_number).toBe('+1 415 555 0100');
      }
    }
  );

  it('makes no phone call when the profile call fails', async () => {
    const phoneCalls: ProviderCall[] = [];
    stubTregFetch(
      () => jsonResponse({ status: 200, error: 'Profile could not be read' }),
      (url, init) => {
        phoneCalls.push({ url, init });
        return jsonResponse(PHONE_HIT);
      }
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    expect(phoneCalls).toHaveLength(0);
  });

  it('keeps the profile when the phone lookup times out', async () => {
    stubTregFetch(
      () => jsonResponse(tregProfile),
      () => {
        const err = new Error('timed out');
        err.name = 'TimeoutError';
        throw err;
      }
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);
  });

  it('keeps the profile when the phone lookup returns an unreadable body', async () => {
    stubTregFetch(
      () => jsonResponse(tregProfile),
      () => new Response('not-json{', { status: 200 })
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);
  });

  it('keeps the profile when the phone lookup fails', async () => {
    stubTregFetch(
      () => jsonResponse(tregProfile),
      () => new Response('phone provider down', { status: 500 })
    );
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);
  });

  it('maps Full+email to the email endpoint and never calls both for one URL', async () => {
    const calls: ProviderCall[] = [];
    stubTregFetch((url, init) => {
      calls.push({ url, init });
      return jsonResponse(tregProfileEmail);
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full_email' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfileEmail.element]);
    expect(calls).toHaveLength(1);
    const endpoint = endpointOf(calls[0]!);
    expect(endpoint.path).toBe(EMAIL_ENDPOINT);
    expect(endpoint.params.get('url')).toBe(PROFILE_URL);
    expect(endpoint.params.getAll('findEmail')).toEqual(['true']);
  });

  it('rejects an unknown tier before reaching the provider', async () => {
    const calls: ProviderCall[] = [];
    stubTregFetch((url, init) => {
      calls.push({ url, init });
      return jsonResponse(tregProfile);
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'short' });

    expect(response.status).toBe(400);
    expect(await readJson<{ error: string }>(response)).toMatchObject({
      error: expect.stringContaining('tier'),
    });
    expect(calls).toHaveLength(0);
  });

  it('treats an HTTP 200 envelope error as a provider error (502)', async () => {
    stubTregFetch(() => jsonResponse({ status: 'error', error: 'Profile could not be read' }));
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    expect((await readJson<{ error: string }>(response)).error).toContain(
      'Profile could not be read'
    );
  });

  it('treats a success envelope without an element as a provider error', async () => {
    stubTregFetch(() => jsonResponse({ status: 'success', error: null }));
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    expect((await readJson<{ error: string }>(response)).error).toContain('profile element');
  });

  it('returns the profile with an empty email when the provider has no email', async () => {
    stubTregFetch(() => jsonResponse(tregProfileNoEmail));
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full_email' });

    expect(response.status).toBe(200);
    const [element] = await readJson<unknown[]>(response);
    expect(element).toEqual(tregProfileNoEmail.element);

    const profile = normalizeScrapeItem(element);
    expect(profile.email).toBeUndefined();
    expect(profile.mobile_number).toBeUndefined();
  });

  it('maps a provider 401 to 400 credential_invalid', async () => {
    stubTregFetch(() => jsonResponse({ status: 'error', error: 'Invalid token' }, 401));
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(400);
    expect(await readJson<{ error: string; code: string }>(response)).toMatchObject({
      code: 'credential_invalid',
    });
  });

  it('maps a request timeout to a 502 timeout error', async () => {
    stubTregFetch(() => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    expect((await readJson<{ error: string }>(response)).error).toContain('respond in time');
  });

  it('honors Retry-After and retries a 429 once with the same idempotency key', async () => {
    const calls: ProviderCall[] = [];
    let attempt = 0;
    stubTregFetch((url, init) => {
      calls.push({ url, init });
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse({ status: 'error', error: 'Rate limit exceeded' }, 429, {
          'Retry-After': '0',
        });
      }
      return jsonResponse(tregProfile);
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(200);
    expect(await readJson<unknown[]>(response)).toEqual([tregProfile.element]);
    expect(calls).toHaveLength(2);
    const firstKey = idempotencyKeyOf(calls[0]!);
    expect(firstKey).toBeTruthy();
    expect(idempotencyKeyOf(calls[1]!)).toBe(firstKey);
  });

  it('maps a persistent 429 to a 502 after one retry', async () => {
    const keys: Array<string | null> = [];
    stubTregFetch((_url, init) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key'));
      return jsonResponse({ status: 'error', error: 'Rate limit exceeded' }, 429, {
        'Retry-After': '0',
      });
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it.each([409, 410, 422])('maps an explicit HTTP %i failure to 502 with the provider body', async (status) => {
    const calls: ProviderCall[] = [];
    stubTregFetch((url, init) => {
      calls.push({ url, init });
      return new Response('provider body says no', { status });
    });
    const session = await signUpWithTreg();

    const response = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });

    expect(response.status).toBe(502);
    const body = await readJson<{ error: string }>(response);
    expect(body.error).toContain(`HTTP ${status}`);
    expect(body.error).toContain('provider body says no');
    expect(calls).toHaveLength(1);
  });

  it('never exceeds five in-flight provider calls', async () => {
    interface Gate {
      promise: Promise<Response>;
      resolve: (response: Response) => void;
    }
    const gates: Gate[] = [];
    const waiters: Array<() => void> = [];
    let inFlight = 0;
    let maxInFlight = 0;
    stubTregFetch(() => {
      const gate = Promise.withResolvers<Response>();
      gates.push(gate);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      for (const wake of waiters.splice(0)) wake();
      return gate.promise.finally(() => {
        inFlight -= 1;
      });
    });
    const urls = Array.from({ length: 6 }, (_, i) => `https://www.linkedin.com/in/person-${i}`);
    const waitForCall = () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      waiters.push(resolve);
      return promise;
    };

    const result = tregProvider.scrapeProfiles({ urls, tier: 'full' }, TOKEN);

    expect(gates).toHaveLength(5);
    expect(maxInFlight).toBe(5);

    gates[0]!.resolve(jsonResponse(tregProfile));
    await waitForCall();
    expect(gates).toHaveLength(6);

    for (let index = 1; index < gates.length; index += 1) {
      gates[index]!.resolve(jsonResponse(tregProfile));
    }

    const items = await result;
    expect(items).toHaveLength(urls.length);
    expect(maxInFlight).toBe(5);
  });

  it('holds five in-flight calls across profile and phone for a 10-URL scrape', async () => {
    interface Gate {
      url: string;
      resolve: (response: Response) => void;
    }
    const gates: Gate[] = [];
    const waiters: Array<() => void> = [];
    let inFlight = 0;
    let maxInFlight = 0;
    stubFetch((url) => {
      const gate = Promise.withResolvers<Response>();
      gates.push({ url, resolve: gate.resolve });
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      for (const wake of waiters.splice(0)) wake();
      return gate.promise.finally(() => {
        inFlight -= 1;
      });
    });
    const urls = Array.from(
      { length: 10 },
      (_, index) => `https://www.linkedin.com/in/two-call-${index}`
    );

    const result = tregProvider.scrapeProfiles({ urls, tier: 'full' }, TOKEN);

    // Resolve calls in the order they start; a URL's phone call only starts
    // after its profile call has completed.
    for (let index = 0; index < 20; index += 1) {
      if (gates.length <= index) {
        const { promise, resolve } = Promise.withResolvers<void>();
        waiters.push(resolve);
        await promise;
      }
      const gate = gates[index]!;
      gate.resolve(jsonResponse(gate.url.startsWith(PHONE_ENDPOINT) ? PHONE_MISS : tregProfile));
    }

    const items = await result;
    expect(items).toHaveLength(urls.length);
    expect(gates).toHaveLength(20);
    expect(maxInFlight).toBe(5);
  });
});

interface SavedProfile {
  profile_url: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  location: string | null;
  address_country_only: string | null;
  address_with_country: string | null;
  address_without_country: string | null;
  email: string | null;
  mobile_number: string | null;
  followers: number | null;
  connections: number | null;
  experiences_count: number | null;
  job_title: string | null;
  job_still_working: boolean | null;
  company_name: string | null;
  company_linkedin: string | null;
  is_verified: boolean | null;
  is_premium: boolean | null;
  raw_data: unknown;
}

describe('treg profile to Saved Profile', () => {
  it('normalizes the HarvestAPI profile shape into populated columns with no phone', async () => {
    stubTregFetch(() => jsonResponse(tregProfileEmail));
    const session = await signUpWithTreg();

    const scrapeResponse = await scrape(session.token, {
      urls: [PROFILE_URL],
      tier: 'full_email',
    });
    expect(scrapeResponse.status).toBe(200);
    const [item] = await readJson<unknown[]>(scrapeResponse);
    expect(item).toEqual(tregProfileEmail.element);

    const profile = normalizeScrapeItem(item);
    expect(profile.experiences).toHaveLength(2);
    expect(profile.education).toHaveLength(2);

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
      profile_url: 'https://www.linkedin.com/in/remiounadjela',
      full_name: 'Rémi Ounadjela',
      first_name: 'Rémi',
      last_name: 'Ounadjela',
      headline: 'Data Science Manager @ TikTok | ex Google/Amazon',
      location: 'San Francisco Bay Area',
      address_country_only: 'United States of America',
      address_with_country: 'San Francisco, CA, United States',
      address_without_country: 'San Francisco, California',
      email: 'remi.ounadjela@tiktok.com',
      mobile_number: null,
      followers: 16183,
      connections: 11027,
      experiences_count: 2,
      job_title: 'Senior Data Science Manager',
      job_still_working: true,
      company_name: 'TikTok',
      company_linkedin: 'https://www.linkedin.com/company/tiktok/',
      is_verified: true,
      is_premium: false,
    });
    expect(saved?.raw_data).toEqual(tregProfileEmail.element);
  });

  it('persists a found phone in the Saved Profile mobile_number column', async () => {
    stubTregFetch(
      () => jsonResponse(tregProfile),
      () => jsonResponse(PHONE_HIT)
    );
    const session = await signUpWithTreg();

    const scrapeResponse = await scrape(session.token, { urls: [PROFILE_URL], tier: 'full' });
    expect(scrapeResponse.status).toBe(200);
    const [item] = await readJson<unknown[]>(scrapeResponse);

    const profile = normalizeScrapeItem(item);
    expect(profile.mobile_number).toBe('+1 415 555 0100');

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
    const [saved] = await readJson<SavedProfile[]>(listResponse);
    expect(saved).toMatchObject({
      profile_url: PROFILE_URL,
      mobile_number: '+1 415 555 0100',
    });
  });
});

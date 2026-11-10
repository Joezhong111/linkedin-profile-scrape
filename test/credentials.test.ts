import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { createDb } from '../worker/db';
import { getProviderToken } from '../worker/credentials';
import { getCredentialStatus, putCredential, readJson, signUp, workerFetch } from './helpers';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const APIFY_TOKEN = 'apify_api_0123456789abcdef';
const TREG_TOKEN = 'treg.abcdef123456';

interface CredentialResponse {
  provider: 'apify' | 'treg' | null;
  configured: boolean;
  validatedAt: string | null;
  warning?: string;
}

async function readCredentialRow(userId: string) {
  return env.DB.prepare(
    'SELECT active_provider, scrape_credential_ciphertext, scrape_credential_iv, scrape_credential_validated_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first<{
      active_provider: string | null;
      scrape_credential_ciphertext: string | null;
      scrape_credential_iv: string | null;
      scrape_credential_validated_at: string | null;
    }>();
}

async function readUser(userId: string) {
  const db = createDb(env.DB);
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row) throw new Error(`missing user ${userId}`);
  return row;
}

function apifyResponse(planId?: string): Response {
  return new Response(
    JSON.stringify({ data: planId === undefined ? {} : { plan: { id: planId } } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/account/credentials', () => {
  it('reports no credential for a fresh User', async () => {
    const session = await signUp();
    const response = await getCredentialStatus(session);

    expect(response.status).toBe(200);
    expect(await readJson<CredentialResponse>(response)).toEqual({
      provider: null,
      configured: false,
      validatedAt: null,
    });
  });

  it('requires a session', async () => {
    const response = await getCredentialStatus({ id: '', email: '', password: '', token: '' });
    expect(response.status).toBe(401);
  });
});

describe('PUT /api/account/credentials with Apify', () => {
  it('validates the token, stores AES-GCM ciphertext, and returns status only', async () => {
    const session = await signUp();
    const requestLog = stubFetch((url, init) => {
      expect(url).toBe('https://api.apify.com/v2/users/me');
      expect(init?.method).toBe('GET');
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${APIFY_TOKEN}`);
      return apifyResponse('STARTER');
    });

    const response = await putCredential(session, 'apify', APIFY_TOKEN);
    expect(response.status).toBe(200);

    const rawBody = await response.text();
    const body = JSON.parse(rawBody) as CredentialResponse;
    expect(body.provider).toBe('apify');
    expect(body.configured).toBe(true);
    expect(body.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body).not.toHaveProperty('warning');
    expect(Object.keys(body).sort()).toEqual(['configured', 'provider', 'validatedAt']);
    expect(rawBody).not.toContain(APIFY_TOKEN);
    expect(requestLog).toHaveBeenCalledTimes(1);

    const row = await readCredentialRow(session.id);
    expect(row?.active_provider).toBe('apify');
    expect(row?.scrape_credential_ciphertext).toBeTruthy();
    expect(row?.scrape_credential_iv).toBeTruthy();
    expect(row?.scrape_credential_ciphertext).not.toBe(APIFY_TOKEN);
    expect(row?.scrape_credential_iv).not.toBe(APIFY_TOKEN);
    expect(row?.scrape_credential_ciphertext).toMatch(BASE64_PATTERN);
    expect(row?.scrape_credential_iv).toMatch(BASE64_PATTERN);
    expect(atob(row!.scrape_credential_ciphertext!)).not.toBe(APIFY_TOKEN);
    expect(atob(row!.scrape_credential_iv!).length).toBe(12);

    const statusResponse = await getCredentialStatus(session);
    const statusBody = await readJson<CredentialResponse>(statusResponse);
    expect(statusBody).toEqual({
      provider: 'apify',
      configured: true,
      validatedAt: body.validatedAt,
    });
    expect(JSON.stringify(statusBody)).not.toContain(row!.scrape_credential_ciphertext!);
    expect(JSON.stringify(statusBody)).not.toContain(row!.scrape_credential_iv!);
  });

  it('warns on a free plan without blocking the save', async () => {
    const session = await signUp();
    stubFetch(() => apifyResponse('FREE'));

    const response = await putCredential(session, 'apify', APIFY_TOKEN);
    expect(response.status).toBe(200);

    const body = await readJson<CredentialResponse>(response);
    expect(body.configured).toBe(true);
    expect(body.warning).toMatch(/paid plan/i);
    expect(body.validatedAt).not.toBeNull();

    const row = await readCredentialRow(session.id);
    expect(row?.scrape_credential_ciphertext).toBeTruthy();
    expect(row?.scrape_credential_validated_at).toBe(body.validatedAt);
  });

  it('treats a missing plan as non-paying', async () => {
    const session = await signUp();
    stubFetch(() => apifyResponse(undefined));

    const response = await putCredential(session, 'apify', APIFY_TOKEN);
    const body = await readJson<CredentialResponse>(response);
    expect(body.warning).toMatch(/paid plan/i);
  });

  it('rejects a 401 without storing anything', async () => {
    const session = await signUp();
    stubFetch(() => new Response('unauthorized', { status: 401 }));

    const response = await putCredential(session, 'apify', APIFY_TOKEN);
    expect(response.status).toBe(400);
    const rawBody = await response.text();
    const body = JSON.parse(rawBody) as { error: string; code?: string };
    expect(body.code).toBe('credential_invalid');
    expect(rawBody).not.toContain(APIFY_TOKEN);

    const row = await readCredentialRow(session.id);
    expect(row?.active_provider).toBeNull();
    expect(row?.scrape_credential_ciphertext).toBeNull();
    expect(row?.scrape_credential_iv).toBeNull();
  });

  it('surfaces an Apify outage as a 502 without storing anything', async () => {
    const session = await signUp();
    stubFetch(() => new Response('boom', { status: 500 }));

    const response = await putCredential(session, 'apify', APIFY_TOKEN);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(APIFY_TOKEN);

    const row = await readCredentialRow(session.id);
    expect(row?.scrape_credential_ciphertext).toBeNull();
  });

  it('surfaces a network failure as a 502', async () => {
    const session = await signUp();
    stubFetch(() => Promise.reject(new Error('connection refused')));

    const response = await putCredential(session, 'apify', APIFY_TOKEN);
    expect(response.status).toBe(502);
  });
});

describe('PUT /api/account/credentials with treg', () => {
  it('stores after a format-only check with zero outbound requests', async () => {
    const session = await signUp();
    const requestLog = stubFetch(() => {
      throw new Error('treg save must not make a network request');
    });

    const response = await putCredential(session, 'treg', TREG_TOKEN);
    expect(response.status).toBe(200);

    const body = await readJson<CredentialResponse>(response);
    expect(body).toEqual({ provider: 'treg', configured: true, validatedAt: null });
    expect(requestLog).not.toHaveBeenCalled();

    const row = await readCredentialRow(session.id);
    expect(row?.active_provider).toBe('treg');
    expect(row?.scrape_credential_ciphertext).toBeTruthy();
    expect(row?.scrape_credential_ciphertext).not.toBe(TREG_TOKEN);
    expect(row?.scrape_credential_validated_at).toBeNull();
  });

  it('rejects a malformed token', async () => {
    const session = await signUp();
    const requestLog = stubFetch(() => apifyResponse('STARTER'));

    const response = await putCredential(session, 'treg', 'bad token!');
    expect(response.status).toBe(400);
    const body = await readJson<{ error: string; code?: string }>(response);
    expect(body.code).toBe('credential_invalid');
    expect(requestLog).not.toHaveBeenCalled();

    const row = await readCredentialRow(session.id);
    expect(row?.scrape_credential_ciphertext).toBeNull();
  });
});

describe('credential lifecycle', () => {
  it('switching provider replaces the stored ciphertext', async () => {
    const session = await signUp();
    stubFetch(() => apifyResponse('STARTER'));
    await putCredential(session, 'apify', APIFY_TOKEN);
    const first = await readCredentialRow(session.id);

    vi.unstubAllGlobals();
    const requestLog = stubFetch(() => {
      throw new Error('treg save must not make a network request');
    });
    const response = await putCredential(session, 'treg', TREG_TOKEN);
    expect(response.status).toBe(200);
    expect(requestLog).not.toHaveBeenCalled();

    const second = await readCredentialRow(session.id);
    expect(second?.active_provider).toBe('treg');
    expect(second?.scrape_credential_ciphertext).not.toBe(first?.scrape_credential_ciphertext);
    expect(second?.scrape_credential_iv).not.toBe(first?.scrape_credential_iv);
    expect(second?.scrape_credential_validated_at).toBeNull();
  });

  it('DELETE clears the credential and disables scraping state', async () => {
    const session = await signUp();
    stubFetch(() => apifyResponse('STARTER'));
    await putCredential(session, 'apify', APIFY_TOKEN);

    const response = await workerFetch(
      '/api/account/credentials',
      { method: 'DELETE' },
      session.token
    );
    expect(response.status).toBe(200);
    expect(await readJson<CredentialResponse>(response)).toEqual({
      provider: null,
      configured: false,
      validatedAt: null,
    });

    const row = await readCredentialRow(session.id);
    expect(row?.active_provider).toBeNull();
    expect(row?.scrape_credential_ciphertext).toBeNull();
    expect(row?.scrape_credential_iv).toBeNull();
    expect(row?.scrape_credential_validated_at).toBeNull();

    const status = await getCredentialStatus(session);
    expect(await readJson<CredentialResponse>(status)).toEqual({
      provider: null,
      configured: false,
      validatedAt: null,
    });
  });
});

describe('getProviderToken', () => {
  it('returns a missing-credential 400 when nothing is stored', async () => {
    const session = await signUp();
    const result = await getProviderToken(env, createDb(env.DB), await readUser(session.id));

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    expect(await readJson<{ code?: string }>(response)).toMatchObject({
      code: 'credential_missing',
    });
  });

  it('resolves the stored token for a configured User', async () => {
    const session = await signUp();
    const requestLog = stubFetch(() => {
      throw new Error('resolution must not call the network');
    });
    await putCredential(session, 'treg', TREG_TOKEN);
    expect(requestLog).not.toHaveBeenCalled();

    const result = await getProviderToken(env, createDb(env.DB), await readUser(session.id));
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({ provider: 'treg', token: TREG_TOKEN });
  });

  it('maps a wrong encryption key to credential_unreadable', async () => {
    const session = await signUp();
    const requestLog = stubFetch(() => {
      throw new Error('resolution must not call the network');
    });
    await putCredential(session, 'treg', TREG_TOKEN);
    expect(requestLog).not.toHaveBeenCalled();

    const wrongKeyEnv = {
      CREDENTIAL_ENCRYPTION_KEY: btoa('abcdefghijklmnopqrstuvwxyz123456'),
    } as unknown as Env;
    const result = await getProviderToken(
      wrongKeyEnv,
      createDb(env.DB),
      await readUser(session.id)
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    const body = await readJson<{ code?: string; error: string }>(response);
    expect(body.code).toBe('credential_unreadable');
    expect(body.error).not.toContain(TREG_TOKEN);
  });

  it('maps a corrupt IV to credential_unreadable', async () => {
    const session = await signUp();
    const requestLog = stubFetch(() => {
      throw new Error('resolution must not call the network');
    });
    await putCredential(session, 'treg', TREG_TOKEN);
    expect(requestLog).not.toHaveBeenCalled();

    await env.DB.prepare('UPDATE users SET scrape_credential_iv = ? WHERE id = ?')
      .bind(btoa('corrupt-iv!!'), session.id)
      .run();

    const result = await getProviderToken(env, createDb(env.DB), await readUser(session.id));
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    expect(await readJson<{ code?: string }>(response)).toMatchObject({
      code: 'credential_unreadable',
    });
  });
});

import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../worker/index';

export interface TestSession {
  id: string;
  email: string;
  password: string;
  token: string;
}

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Calls the Worker HTTP entry with an isolated execution context. */
export async function workerFetch(
  path: string,
  init?: RequestInit,
  token?: string
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(`https://test.example.com${path}`, {
      method: init?.method,
      headers,
      body: init?.body,
    }),
    env,
    ctx
  );
  await waitOnExecutionContext(ctx);
  return response;
}

let counter = 0;

function uniqueEmail(): string {
  counter += 1;
  return `user-${Date.now()}-${counter}@example.com`;
}

interface AuthResponse {
  user: { id: string; email: string; fullName: string | null };
  token: string;
  expiresAt: string;
}

export async function signUp(
  email = uniqueEmail(),
  password = 'password123'
): Promise<TestSession> {
  const res = await workerFetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  const body = await readJson<AuthResponse>(res);
  return { id: body.user.id, email, password, token: body.token };
}

export async function signIn(email: string, password: string): Promise<TestSession> {
  const res = await workerFetch('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn failed: ${res.status} ${await res.text()}`);
  const body = await readJson<AuthResponse>(res);
  return { id: body.user.id, email, password, token: body.token };
}

/** Promotes a User directly in D1; every other helper uses the HTTP entry. */
export async function makeAdmin(session: TestSession): Promise<void> {
  await env.DB.prepare("UPDATE user_roles SET role = 'admin' WHERE user_id = ?")
    .bind(session.id)
    .run();
}

/** PUT /api/account/credentials with the session's bearer token. */
export async function putCredential(
  session: TestSession,
  provider: 'apify' | 'treg',
  token: string
): Promise<Response> {
  return workerFetch(
    '/api/account/credentials',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token }),
    },
    session.token
  );
}

/** GET /api/account/credentials for the session's User. */
export async function getCredentialStatus(session: TestSession): Promise<Response> {
  return workerFetch('/api/account/credentials', undefined, session.token);
}

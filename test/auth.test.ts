import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { verifyPassword } from '../worker/auth';
import { getUserRole as readUserRole } from '../worker/auth';
import { createDb } from '../worker/db';
import { makeAdmin, readJson, signIn, signUp, workerFetch } from './helpers';

const LEGACY_SALT = '58a94cc7d2a68598669607fe1a4ac53f';
const LEGACY_HASH =
  'f76a2581657120a11d49b8a9e70cd970ca6b9e044e6c05ff58d4d1da001054a73a8750119aba0614f176dcda9d30ca4098acff5872bd19c05ff93a5ad7ba286b';
const HASH_FORMAT = /^[0-9a-f]{32}:[0-9a-f]{128}$/;

async function registerClosed() {
  await env.DB.prepare(
    'INSERT INTO app_settings (id, registration_open, google_oauth_open, updated_at) VALUES (?, ?, ?, ?)'
  )
    .bind('global', 0, 0, new Date().toISOString())
    .run();
}

async function readStoredUser(email: string) {
  return env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();
}

describe('POST /api/auth/signup', () => {
  it('creates a User with the default role and a fresh password hash', async () => {
    const response = await workerFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'New.User@Example.com',
        password: 'secret123',
        fullName: 'New User',
      }),
    });

    expect(response.status).toBe(200);
    const body = await readJson<{
      user: { id: string; email: string; fullName: string | null };
      token: string;
      expiresAt: string;
    }>(response);
    expect(body.user).toEqual({
      id: expect.any(String),
      email: 'new.user@example.com',
      fullName: 'New User',
    });
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body).not.toHaveProperty('user.passwordHash');
    expect(body.user).not.toHaveProperty('passwordHash');

    const stored = await readStoredUser('new.user@example.com');
    expect(stored?.password_hash).toMatch(HASH_FORMAT);

    const role = await env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(body.user.id)
      .first<{ role: string }>();
    expect(role?.role).toBe('user');
  });

  it('rejects a duplicate email with a readable 400', async () => {
    await signUp('duplicate@example.com', 'secret123');

    const response = await workerFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'duplicate@example.com', password: 'secret123' }),
    });

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: 'User with this email already exists' });
  });

  it('returns 403 when registration is closed', async () => {
    await registerClosed();
    try {
      const response = await workerFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'closed@example.com', password: 'secret123' }),
      });

      expect(response.status).toBe(403);
      expect(await readJson(response)).toEqual({ error: 'Registration is currently closed' });
    } finally {
      await env.DB.prepare("DELETE FROM app_settings WHERE id = 'global'").run();
    }
  });

  it('validates the email format and password length', async () => {
    const badEmail = await workerFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'secret123' }),
    });
    expect(badEmail.status).toBe(400);
    expect(await readJson(badEmail)).toEqual({ error: 'Invalid email format' });

    const shortPassword = await workerFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'short@example.com', password: '123' }),
    });
    expect(shortPassword.status).toBe(400);
    expect(await readJson(shortPassword)).toEqual({
      error: 'Password must be at least 6 characters',
    });
  });
});

describe('POST /api/auth/signin', () => {
  it('signs an existing User in and updates the last login', async () => {
    await signUp('signin@example.com', 'secret123');

    const response = await workerFetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'signin@example.com', password: 'secret123' }),
    });

    expect(response.status).toBe(200);
    const body = await readJson<{
      user: { id: string; email: string; fullName: string | null };
      token: string;
      expiresAt: string;
    }>(response);
    expect(body.user.email).toBe('signin@example.com');
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);

    const row = await env.DB.prepare('SELECT last_login_at FROM users WHERE email = ?')
      .bind('signin@example.com')
      .first<{ last_login_at: string | null }>();
    expect(row?.last_login_at).not.toBeNull();
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    await signUp('wrong-password@example.com', 'secret123');

    const wrongPassword = await workerFetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong-password@example.com', password: 'not-it' }),
    });
    const unknownEmail = await workerFetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'secret123' }),
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await readJson(wrongPassword)).toEqual({ error: 'Invalid email or password' });
    expect(await readJson(unknownEmail)).toEqual({ error: 'Invalid email or password' });
  });

  it('signs in a User whose password was stored by the legacy hasher', async () => {
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        crypto.randomUUID(),
        'legacy@example.com',
        `${LEGACY_SALT}:${LEGACY_HASH}`,
        'Legacy User',
        createdAt,
        createdAt,
        0
      )
      .run();

    const session = await signIn('legacy@example.com', 'legacy-password');
    expect(session.token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyPassword', () => {
  it('verifies the legacy salt:hash vector', async () => {
    expect(await verifyPassword('legacy-password', `${LEGACY_SALT}:${LEGACY_HASH}`)).toBe(true);
    expect(await verifyPassword('not-legacy-password', `${LEGACY_SALT}:${LEGACY_HASH}`)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('secret123', '')).toBe(false);
    expect(await verifyPassword('secret123', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('secret123', 'abcd:1234')).toBe(false);
    expect(await verifyPassword('secret123', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:' + 'a'.repeat(128))).toBe(
      false
    );
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current User for a valid Session Token', async () => {
    const session = await signUp('me@example.com', 'secret123');

    const response = await workerFetch('/api/auth/me', undefined, session.token);

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      user: { id: session.id, email: 'me@example.com', fullName: null },
    });
  });

  it('returns 401 when the token is missing, invalid, or expired', async () => {
    const session = await signUp('expired@example.com', 'secret123');
    const expiredToken = 'a'.repeat(64);
    const past = new Date(Date.now() - 60_000).toISOString();
    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(crypto.randomUUID(), session.id, expiredToken, past, past)
      .run();

    const missing = await workerFetch('/api/auth/me');
    const invalid = await workerFetch('/api/auth/me', undefined, 'b'.repeat(64));
    const expired = await workerFetch('/api/auth/me', undefined, expiredToken);

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(await readJson(missing)).toEqual({ error: 'Missing Authorization' });
    expect(await readJson(expired)).toEqual({ error: 'Invalid or expired token' });
  });
});

describe('POST /api/auth/signout', () => {
  it('revokes the Session Token so a later me call is 401', async () => {
    const session = await signUp('signout@example.com', 'secret123');
    expect((await workerFetch('/api/auth/me', undefined, session.token)).status).toBe(200);

    const response = await workerFetch(
      '/api/auth/signout',
      { method: 'POST' },
      session.token
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ success: true });
    expect((await workerFetch('/api/auth/me', undefined, session.token)).status).toBe(401);
  });

  it('always succeeds without a token', async () => {
    const response = await workerFetch('/api/auth/signout', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ success: true });
  });
});

describe('User roles', () => {
  it('reads the default user role and the Admin role', async () => {
    const session = await signUp('role@example.com', 'secret123');
    const db = createDb(env.DB);

    expect(await readUserRole(db, session.id)).toBe('user');

    await makeAdmin(session);

    expect(await readUserRole(db, session.id)).toBe('admin');
  });
});

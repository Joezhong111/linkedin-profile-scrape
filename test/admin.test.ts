import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { makeAdmin, readJson, signIn, signUp, workerFetch, type TestSession } from './helpers';

interface AdminUserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  created_at: string;
  last_login_at: string | null;
  has_credential: boolean;
  active_provider: 'apify' | 'treg' | null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

beforeEach(async () => {
  // The D1 storage is shared across tests in this file; start from a clean
  // user population and the documented registration defaults.
  await env.DB.prepare('DELETE FROM users').run();
  await env.DB.prepare(
    'UPDATE app_settings SET registration_open = 1, google_oauth_open = 1'
  ).run();
});

async function adminSession(): Promise<TestSession> {
  const session = await signUp();
  await makeAdmin(session);
  return session;
}

function post(path: string, body: unknown, token?: string): Promise<Response> {
  return workerFetch(
    path,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) },
    token
  );
}

async function createUser(
  admin: TestSession,
  body: Record<string, unknown>
): Promise<{ user_id: string; email: string; role: string }> {
  const res = await post('/api/admin/create-user', body, admin.token);
  expect(res.status).toBe(200);
  return readJson(res);
}

describe('admin authorization', () => {
  it('returns 401 without a Session Token', async () => {
    for (const [method, path] of [
      ['GET', '/api/admin/users'],
      ['POST', '/api/admin/create-user'],
      ['PATCH', '/api/admin/users'],
      ['DELETE', '/api/admin/users?user_id=someone'],
      ['POST', '/api/admin/toggles'],
    ] as const) {
      const res = await workerFetch(path, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('returns 403 for a non-Admin', async () => {
    const user = await signUp();
    const res = await workerFetch('/api/admin/users', undefined, user.token);
    expect(res.status).toBe(403);

    for (const [method, path, body] of [
      ['POST', '/api/admin/create-user', { email: 'x@example.com', password: 'secret123' }],
      ['PATCH', '/api/admin/users', { user_id: user.id, role: 'admin' }],
      ['DELETE', '/api/admin/users?user_id=someone', undefined],
      ['POST', '/api/admin/toggles', { registration_open: false }],
    ] as const) {
      const response = await workerFetch(
        path,
        { method, headers: JSON_HEADERS, body: body ? JSON.stringify(body) : undefined },
        user.token
      );
      expect(response.status, `${method} ${path}`).toBe(403);
    }
  });

  it('reports the caller role without requiring Admin', async () => {
    const user = await signUp();
    const asUser = await workerFetch('/api/admin/me', undefined, user.token);
    expect(asUser.status).toBe(200);
    expect(await readJson(asUser)).toEqual({
      user_id: user.id,
      role: 'user',
      isAdmin: false,
    });

    await makeAdmin(user);
    const asAdmin = await workerFetch('/api/admin/me', undefined, user.token);
    expect(await readJson(asAdmin)).toEqual({
      user_id: user.id,
      role: 'admin',
      isAdmin: true,
    });
  });
});

describe('GET /api/admin/users', () => {
  it('lists Users with roles and credential status but never secrets', async () => {
    const admin = await adminSession();
    const configured = await signUp();
    const plain = await signUp();
    await env.DB.prepare(
      "UPDATE users SET scrape_credential_ciphertext = ?, scrape_credential_iv = ?, active_provider = 'apify' WHERE id = ?"
    )
      .bind('ciphertext-secret', 'iv-secret', configured.id)
      .run();

    const res = await workerFetch('/api/admin/users', undefined, admin.token);
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain('password_hash');
    expect(raw).not.toContain('ciphertext-secret');
    expect(raw).not.toContain('iv-secret');

    const rows = JSON.parse(raw) as AdminUserRow[];
    expect(rows.map((row) => row.email).sort()).toEqual(
      [admin.email, configured.email, plain.email].sort()
    );

    const configuredRow = rows.find((row) => row.user_id === configured.id);
    expect(configuredRow).toEqual({
      user_id: configured.id,
      email: configured.email,
      full_name: null,
      role: 'user',
      created_at: expect.any(String),
      last_login_at: null,
      has_credential: true,
      active_provider: 'apify',
    });

    const adminRow = rows.find((row) => row.user_id === admin.id);
    expect(adminRow).toMatchObject({ role: 'admin', has_credential: false, active_provider: null });
    expect(Object.keys(adminRow!).sort()).toEqual(
      [
        'active_provider',
        'created_at',
        'email',
        'full_name',
        'has_credential',
        'last_login_at',
        'role',
        'user_id',
      ].sort()
    );
  });
});

describe('POST /api/admin/create-user', () => {
  it('creates the User and its role atomically without a quota table', async () => {
    const admin = await adminSession();
    const created = await createUser(admin, {
      email: 'Made.Admin@Example.com',
      password: 'secret123',
      fullName: 'Made Admin',
      role: 'admin',
    });

    expect(created).toEqual({
      user_id: expect.any(String),
      email: 'made.admin@example.com',
      role: 'admin',
    });

    const storedUser = await env.DB.prepare(
      'SELECT email, full_name FROM users WHERE id = ?'
    )
      .bind(created.user_id)
      .first<{ email: string; full_name: string | null }>();
    expect(storedUser).toEqual({ email: 'made.admin@example.com', full_name: 'Made Admin' });

    const storedRole = await env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(created.user_id)
      .first<{ role: string }>();
    expect(storedRole).toEqual({ role: 'admin' });

    const quotaTables = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name LIKE '%quota%'"
    ).first<{ count: number }>();
    expect(quotaTables).toEqual({ count: 0 });

    // The created Admin can sign in and use Admin endpoints.
    const session = await signIn('made.admin@example.com', 'secret123');
    const res = await workerFetch('/api/admin/users', undefined, session.token);
    expect(res.status).toBe(200);
  });

  it('defaults the role to user and validates input', async () => {
    const admin = await adminSession();
    const created = await createUser(admin, {
      email: 'plain@example.com',
      password: 'secret123',
    });
    expect(created.role).toBe('user');

    const duplicate = await post(
      '/api/admin/create-user',
      { email: 'plain@example.com', password: 'secret123' },
      admin.token
    );
    expect(duplicate.status).toBe(400);

    const badEmail = await post(
      '/api/admin/create-user',
      { email: 'not-an-email', password: 'secret123' },
      admin.token
    );
    expect(badEmail.status).toBe(400);

    const shortPassword = await post(
      '/api/admin/create-user',
      { email: 'short@example.com', password: '123' },
      admin.token
    );
    expect(shortPassword.status).toBe(400);
  });
});

describe('registration toggle', () => {
  it('defaults open and writes exactly one settings row', async () => {
    const admin = await adminSession();
    const initial = await workerFetch('/api/admin/toggles');
    expect(await readJson(initial)).toEqual({ registration_open: true, google_oauth_open: true });

    expect(
      (await post('/api/admin/toggles', { registration_open: false }, admin.token)).status
    ).toBe(200);
    expect(
      (await post('/api/admin/toggles', { google_oauth_open: false }, admin.token)).status
    ).toBe(200);

    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM app_settings').first<{
      count: number;
    }>();
    expect(count).toEqual({ count: 1 });

    const row = await env.DB.prepare(
      'SELECT id, registration_open, google_oauth_open FROM app_settings'
    ).first<{ id: string; registration_open: number; google_oauth_open: number }>();
    expect(row).toEqual({ id: 'global', registration_open: 0, google_oauth_open: 0 });

    const toggles = await workerFetch('/api/admin/toggles');
    expect(await readJson(toggles)).toEqual({ registration_open: false, google_oauth_open: false });
  });

  it('returns 400 when no boolean toggle is supplied', async () => {
    const admin = await adminSession();
    const before = await env.DB.prepare('SELECT COUNT(*) AS count FROM app_settings').first<{
      count: number;
    }>();
    const res = await post('/api/admin/toggles', { registration_open: 'yes' }, admin.token);
    expect(res.status).toBe(400);
    const after = await env.DB.prepare('SELECT COUNT(*) AS count FROM app_settings').first<{
      count: number;
    }>();
    expect(after).toEqual(before);
  });
});

describe('PATCH and DELETE /api/admin/users', () => {
  it('resets a password so the User signs in with the new one', async () => {
    const admin = await adminSession();
    const created = await createUser(admin, {
      email: 'reset@example.com',
      password: 'old-password',
    });
    await signIn('reset@example.com', 'old-password');

    const res = await workerFetch(
      '/api/admin/users',
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ user_id: created.user_id, password: 'new-password' }),
      },
      admin.token
    );
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ message: expect.any(String) });

    const updated = await signIn('reset@example.com', 'new-password');
    expect(updated.email).toBe('reset@example.com');

    const stale = await workerFetch('/api/auth/signin', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'reset@example.com', password: 'old-password' }),
    });
    expect(stale.status).toBe(401);
  });

  it('updates a role', async () => {
    const admin = await adminSession();
    const created = await createUser(admin, {
      email: 'promoted@example.com',
      password: 'secret123',
    });
    const session = await signIn('promoted@example.com', 'secret123');
    expect((await workerFetch('/api/admin/users', undefined, session.token)).status).toBe(403);

    const res = await workerFetch(
      '/api/admin/users',
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ user_id: created.user_id, role: 'admin' }),
      },
      admin.token
    );
    expect(res.status).toBe(200);
    expect((await workerFetch('/api/admin/users', undefined, session.token)).status).toBe(200);

    const invalid = await workerFetch(
      '/api/admin/users',
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ user_id: created.user_id, role: 'owner' }),
      },
      admin.token
    );
    expect(invalid.status).toBe(400);
  });

  it('deletes a User and cascades owned rows and sessions', async () => {
    const admin = await adminSession();
    const created = await createUser(admin, {
      email: 'delete-me@example.com',
      password: 'secret123',
    });
    const session = await signIn('delete-me@example.com', 'secret123');
    await env.DB.prepare(
      'INSERT INTO linkedin_profiles (id, created_at, owner_id, profile_url) VALUES (?, ?, ?, ?)'
    )
      .bind('profile-1', new Date().toISOString(), created.user_id, 'https://www.linkedin.com/in/delete-me')
      .run();

    const res = await workerFetch(
      `/api/admin/users?user_id=${encodeURIComponent(created.user_id)}`,
      { method: 'DELETE' },
      admin.token
    );
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ message: expect.any(String) });

    const userCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE id = ?')
      .bind(created.user_id)
      .first<{ count: number }>();
    const roleCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM user_roles WHERE user_id = ?'
    )
      .bind(created.user_id)
      .first<{ count: number }>();
    const profileCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM linkedin_profiles WHERE owner_id = ?'
    )
      .bind(created.user_id)
      .first<{ count: number }>();
    const sessionCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?'
    )
      .bind(created.user_id)
      .first<{ count: number }>();
    expect([userCount, roleCount, profileCount, sessionCount]).toEqual([
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
    ]);

    expect((await workerFetch('/api/health')).status).toBe(200);
    expect(session.token).toBeTruthy();
  });

  it('refuses to delete the calling Admin', async () => {
    const admin = await adminSession();
    const res = await workerFetch(
      `/api/admin/users?user_id=${encodeURIComponent(admin.id)}`,
      { method: 'DELETE' },
      admin.token
    );
    expect(res.status).toBe(400);
    const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(admin.id)
      .first();
    expect(row).toEqual({ id: admin.id });
  });

  it('returns 400 for a missing user_id', async () => {
    const admin = await adminSession();
    const res = await workerFetch('/api/admin/users', { method: 'DELETE' }, admin.token);
    expect(res.status).toBe(400);
  });
});

describe('quota endpoints', () => {
  it('no longer exists', async () => {
    const admin = await adminSession();
    for (const method of ['GET', 'POST']) {
      const res = await workerFetch(
        '/api/admin/quotas',
        { method, headers: JSON_HEADERS, body: method === 'POST' ? '{}' : undefined },
        admin.token
      );
      expect(res.status, method).toBe(501);
    }
  });
});

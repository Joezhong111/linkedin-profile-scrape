import { authClient } from '../lib/auth';
import { readApiError } from './http';

async function authHeaders() {
  return authClient.getAuthHeaders();
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await readApiError(res));
  return res;
}

export type AdminRole = 'admin' | 'user';

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  created_at: string;
  last_login_at: string | null;
  has_credential: boolean;
  active_provider: 'apify' | 'treg' | null;
}

export async function getMe(): Promise<{
  user_id?: string;
  role?: string;
  isAdmin?: boolean;
}> {
  const res = await fetch('/api/admin/me', { headers: await authHeaders() });
  if (!res.ok) return { isAdmin: false };
  return res.json();
}

export type Toggles = {
  registration_open: boolean;
  google_oauth_open: boolean;
};

export async function getToggles(): Promise<Toggles> {
  const res = await fetch('/api/admin/toggles');
  if (!res.ok) return { registration_open: true, google_oauth_open: true };
  return res.json();
}

export async function setToggles(p: Partial<Toggles>): Promise<void> {
  await request('/api/admin/toggles', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(p),
  });
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await request('/api/admin/users', { headers: await authHeaders() });
  return res.json();
}

export async function adminCreateUser(params: {
  email: string;
  password: string;
  fullName?: string;
  role?: AdminRole;
}): Promise<{ user_id: string; email: string; role: AdminRole }> {
  const res = await request('/api/admin/create-user', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function updatePassword(user_id: string, password: string): Promise<void> {
  await request('/api/admin/users', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ user_id, password }),
  });
}

export async function updateRole(user_id: string, role: AdminRole): Promise<void> {
  await request('/api/admin/users', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ user_id, role }),
  });
}

export async function deleteUser(user_id: string): Promise<void> {
  await request(`/api/admin/users?user_id=${encodeURIComponent(user_id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
}

import { authClient } from "../lib/auth";

async function authHeaders() {
  return authClient.getAuthHeaders();
}

export async function getMe(): Promise<{
  user_id?: string;
  role?: string;
  isAdmin?: boolean;
}> {
  const res = await fetch("/api/admin/me", { headers: await authHeaders() });
  if (!res.ok) return { isAdmin: false };
  return res.json();
}

export type Toggles = {
  registration_open: boolean;
  google_oauth_open: boolean;
};
export async function getToggles(): Promise<Toggles> {
  const res = await fetch("/api/admin/toggles");
  if (!res.ok) return { registration_open: true, google_oauth_open: true };
  return res.json();
}

export async function setToggles(p: Partial<Toggles>): Promise<void> {
  const res = await fetch("/api/admin/toggles", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getQuota(email?: string, user_id?: string): Promise<any> {
  let url = "/api/admin/quotas";
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  } else if (user_id) {
    url += `?user_id=${encodeURIComponent(user_id)}`;
  }
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setQuota(
  email: string,
  monthly_limit: number
): Promise<void> {
  const res = await fetch("/api/admin/quotas", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ email, monthly_limit }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function adminCreateUser(params: {
  email: string;
  password?: string;
  invite?: boolean;
  monthly_limit?: number;
}): Promise<any> {
  const res = await fetch("/api/admin/create-user", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

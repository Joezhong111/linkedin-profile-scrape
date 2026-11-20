import { describe, expect, it } from 'vitest';
import apifyItem from './fixtures/apify-profile-item.json';
import harvestLead from './fixtures/harvestapi-lead.json';
import tregProfileEmail from './fixtures/treg-profile-email.json';
import { readJson, signUp, workerFetch, type TestSession } from './helpers';

interface SavedProfile {
  id: string;
  owner_id: string;
  profile_url: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  email: string | null;
  followers: number | null;
  connections: number | null;
  company_name: string | null;
  company_linkedin: string | null;
  is_verified: boolean | null;
  is_premium: boolean | null;
  raw_data: unknown;
}

const APIFY_URL = apifyItem.profileUrl;
const TREG_URL = tregProfileEmail.element.linkedinUrl;

async function postJson(
  path: string,
  body: unknown,
  token?: string
): Promise<Response> {
  return workerFetch(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
}

async function save(token: string, body: unknown): Promise<SavedProfile> {
  const res = await postJson('/api/profiles/save', body, token);
  expect(res.status).toBe(200);
  return readJson<SavedProfile>(res);
}

async function list(token: string): Promise<SavedProfile[]> {
  const res = await workerFetch('/api/profiles/list', undefined, token);
  expect(res.status).toBe(200);
  return readJson<SavedProfile[]>(res);
}

describe('Profiles authentication', () => {
  it('rejects every profiles call without a session token', async () => {
    const responses = await Promise.all([
      workerFetch('/api/profiles/list'),
      postJson('/api/profiles/save', { profile_url: APIFY_URL }),
      postJson('/api/profiles/delete', { id: 'missing' }),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

describe('POST /api/profiles/save', () => {
  it('requires a profile_url', async () => {
    const user = await signUp();
    const res = await postJson('/api/profiles/save', { full_name: 'No URL' }, user.token);

    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toEqual({
      error: 'profile_url is required',
    });
  });

  it('returns the mapped saved row owned by the caller', async () => {
    const user = await signUp();
    const saved = await save(user.token, {
      profile_url: APIFY_URL,
      full_name: 'Remi Ounadjela',
      headline: 'Data leader',
      followers: 4231,
    });

    expect(saved).toMatchObject({
      owner_id: user.id,
      profile_url: APIFY_URL,
      full_name: 'Remi Ounadjela',
      headline: 'Data leader',
      followers: 4231,
    });
    expect(saved.id).toEqual(expect.any(String));
    expect(saved).not.toHaveProperty('password_hash');
  });

  it('updates the existing owner/URL record on a repeat save', async () => {
    const user = await signUp();
    const first = await save(user.token, {
      profile_url: APIFY_URL,
      full_name: 'Remi Ounadjela',
      headline: 'Old headline',
      followers: 4231,
    });

    const second = await save(user.token, {
      profile_url: APIFY_URL,
      headline: 'New headline',
    });

    expect(second.id).toBe(first.id);
    expect(second.headline).toBe('New headline');
    expect(second.full_name).toBe('Remi Ounadjela');
    expect(second.followers).toBe(4231);

    const rows = await list(user.token);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(first.id);
  });

  it('normalizes the Apify raw payload and retains raw_data', async () => {
    const user = await signUp();
    const saved = await save(user.token, {
      profile_url: APIFY_URL,
      raw_data: apifyItem,
    });

    expect(saved).toMatchObject({
      full_name: 'Remi Ounadjela',
      headline: 'Senior Data Science Manager at TikTok',
      location: 'San Francisco Bay Area',
      email: 'remi.ounadjela@tiktok.com',
      followers: 4231,
      connections: 500,
      company_name: 'TikTok',
      company_linkedin: 'https://www.linkedin.com/company/tiktok',
      is_verified: true,
      is_premium: false,
    });
    expect(saved.raw_data).toEqual(apifyItem);
  });

  it('normalizes the treg raw payload and retains raw_data', async () => {
    const user = await signUp();
    const saved = await save(user.token, {
      profile_url: TREG_URL,
      raw_data: tregProfileEmail.element,
    });

    expect(saved).toMatchObject({
      profile_url: TREG_URL,
      full_name: 'Rémi Ounadjela',
      location: 'San Francisco Bay Area',
      email: 'remi.ounadjela@tiktok.com',
      followers: 16183,
      connections: 11027,
      company_name: 'TikTok',
      company_linkedin: 'https://www.linkedin.com/company/tiktok/',
      is_verified: true,
      is_premium: false,
    });
    expect(saved.raw_data).toEqual(tregProfileEmail.element);
  });

  it('normalizes a HarvestAPI lead payload', async () => {
    const user = await signUp();
    const saved = await save(user.token, {
      profile_url: harvestLead.linkedinUrl,
      raw_data: harvestLead,
    });

    expect(saved).toMatchObject({
      full_name: 'Rémi Ounadjela',
      email: 'remi.ounadjela@tiktok.com',
      followers: 16183,
      connections: 11027,
      company_name: 'TikTok',
    });
    expect(saved.raw_data).toEqual(harvestLead);
  });
});

describe('GET /api/profiles/list', () => {
  it('returns a bare array scoped to the current User', async () => {
    const owner = await signUp();
    const stranger = await signUp();

    await save(owner.token, { profile_url: APIFY_URL, full_name: 'Owner row' });
    await save(stranger.token, { profile_url: TREG_URL, full_name: 'Stranger row' });

    const ownerRows = await list(owner.token);
    expect(Array.isArray(ownerRows)).toBe(true);
    expect(ownerRows).toHaveLength(1);
    expect(ownerRows[0]).toMatchObject({
      owner_id: owner.id,
      profile_url: APIFY_URL,
      full_name: 'Owner row',
    });

    const strangerRows = await list(stranger.token);
    expect(strangerRows).toHaveLength(1);
    expect(strangerRows[0]).toMatchObject({
      owner_id: stranger.id,
      profile_url: TREG_URL,
    });
  });
});

describe('POST /api/profiles/delete', () => {
  it('does not delete another User’s row', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const saved = await save(owner.token, { profile_url: APIFY_URL });

    const res = await postJson('/api/profiles/delete', { id: saved.id }, stranger.token);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
    expect(await list(owner.token)).toHaveLength(1);

    const own = await postJson('/api/profiles/delete', { id: saved.id }, owner.token);
    expect(own.status).toBe(200);
    expect(await list(owner.token)).toHaveLength(0);
  });
});

describe('owner scope helpers', () => {
  it('keeps distinct Users with the same profile URL separate', async () => {
    const first: TestSession = await signUp();
    const second: TestSession = await signUp();

    const a = await save(first.token, {
      profile_url: APIFY_URL,
      full_name: 'First owner',
    });
    const b = await save(second.token, {
      profile_url: APIFY_URL,
      full_name: 'Second owner',
    });

    expect(a.id).not.toBe(b.id);
    expect(await list(first.token)).toHaveLength(1);
    expect(await list(second.token)).toHaveLength(1);
  });
});

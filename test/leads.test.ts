import { describe, expect, it } from 'vitest';
import harvestLead from './fixtures/harvestapi-lead.json';
import { readJson, signUp, workerFetch, type TestSession } from './helpers';

interface SavedLead {
  id: string;
  profile_url: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  email: string | null;
  company_name: string | null;
  job_title: string | null;
  source_company_url: string | null;
  current_job_duration: string | null;
  job_period: string | null;
  raw_data: { id?: string } | null;
}

interface LeadsEnvelope {
  data: SavedLead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: { companies: string[]; locations: string[] };
}

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

async function saveLead(token: string, payload: Record<string, unknown>): Promise<SavedLead> {
  const res = await workerFetch(
    '/api/leads/save',
    { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) },
    token
  );
  if (!res.ok) throw new Error(`saveLead failed: ${res.status} ${await res.text()}`);
  return readJson<SavedLead>(res);
}

async function listLeads(token: string, query = ''): Promise<LeadsEnvelope> {
  const res = await workerFetch(`/api/leads/list${query}`, {}, token);
  if (!res.ok) throw new Error(`listLeads failed: ${res.status} ${await res.text()}`);
  return readJson<LeadsEnvelope>(res);
}

function leadUrl(handle: string): string {
  return `https://www.linkedin.com/in/${handle}/`;
}

describe('leads routes auth', () => {
  it('rejects every leads endpoint without a session token', async () => {
    const list = await workerFetch('/api/leads/list');
    expect(list.status).toBe(401);

    const save = await workerFetch('/api/leads/save', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ profile_url: leadUrl('no-token') }),
    });
    expect(save.status).toBe(401);

    const single = await workerFetch('/api/leads/delete', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id: 'anything' }),
    });
    expect(single.status).toBe(401);

    const batch = await workerFetch('/api/leads/batch-delete', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ids: ['anything'] }),
    });
    expect(batch.status).toBe(401);

    for (const res of [list, save, single, batch]) {
      expect(await readJson(res)).toHaveProperty('error');
    }
  });
});

describe('GET /api/leads/list', () => {
  it('returns the paginated envelope with a numeric total and stable page boundaries', async () => {
    const session = await signUp();
    await saveLead(session.token, { profile_url: leadUrl('page-a'), full_name: 'Page A' });
    await saveLead(session.token, { profile_url: leadUrl('page-b'), full_name: 'Page B' });
    await saveLead(session.token, { profile_url: leadUrl('page-c'), full_name: 'Page C' });

    const first = await listLeads(session.token, '?page=1&pageSize=2');
    expect(typeof first.total).toBe('number');
    expect(Number.isInteger(first.total)).toBe(true);
    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2, totalPages: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.filters.companies).toEqual([]);
    expect(first.filters.locations).toEqual([]);

    const second = await listLeads(session.token, '?page=2&pageSize=2');
    expect(second).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
    expect(second.data).toHaveLength(1);

    const beyond = await listLeads(session.token, '?page=3&pageSize=2');
    expect(beyond.data).toEqual([]);
    expect(beyond.total).toBe(3);
    expect(beyond.totalPages).toBe(2);

    const defaulted = await listLeads(session.token);
    expect(defaulted).toMatchObject({ page: 1, pageSize: 50, totalPages: 1 });

    const oversized = await listLeads(session.token, '?pageSize=500');
    expect(oversized.pageSize).toBe(200);
    const undersized = await listLeads(session.token, '?pageSize=0&page=0');
    expect(undersized).toMatchObject({ page: 1, pageSize: 1 });
  });

  it('applies free-text and column filters within the owner scope', async () => {
    const owner = await signUp();
    const other = await signUp();

    await saveLead(owner.token, {
      profile_url: leadUrl('filter-alice'),
      full_name: 'Alice Smith',
      headline: 'Staff Engineer',
      location: 'Berlin, Germany',
      email: 'alice@acme.com',
      company_name: 'Acme Inc',
      job_title: 'Backend Engineer',
    });
    await saveLead(owner.token, {
      profile_url: leadUrl('filter-bob'),
      full_name: 'Bob Jones',
      headline: 'Product Designer',
      location: 'Munich, Bavaria, Germany',
      email: '',
      company_name: 'Beta GmbH',
      job_title: 'Product Designer',
    });
    await saveLead(owner.token, {
      profile_url: leadUrl('filter-carol'),
      full_name: 'Carol White',
      headline: 'Sales Lead',
      location: 'San Francisco, CA, United States',
      company_name: 'Acme Inc',
      job_title: 'Account Executive',
    });
    await saveLead(other.token, {
      profile_url: leadUrl('filter-zed'),
      full_name: 'Zed Alien',
      headline: 'Staff Engineer',
      location: 'Berlin, Germany',
      email: 'zed@zeta.com',
      company_name: 'Zeta Corp',
      job_title: 'Backend Engineer',
    });

    const byQuery = await listLeads(owner.token, '?q=acme');
    expect(byQuery.total).toBe(2);
    expect(byQuery.data.map((lead) => lead.full_name)).toEqual(
      expect.arrayContaining(['Alice Smith', 'Carol White'])
    );

    const byEmailQuery = await listLeads(owner.token, '?q=alice%40acme');
    expect(byEmailQuery.total).toBe(1);
    expect(byEmailQuery.data[0]?.full_name).toBe('Alice Smith');

    const byExactCompany = await listLeads(owner.token, `?company=${encodeURIComponent('Acme Inc')}`);
    expect(byExactCompany.total).toBe(2);
    const byPartialCompany = await listLeads(owner.token, '?company=Acme');
    expect(byPartialCompany.total).toBe(0);

    const byLocation = await listLeads(owner.token, '?location=Berlin');
    expect(byLocation.total).toBe(1);
    expect(byLocation.data[0]?.full_name).toBe('Alice Smith');

    const byJobTitle = await listLeads(owner.token, '?jobTitle=Engineer');
    expect(byJobTitle.total).toBe(1);
    expect(byJobTitle.data[0]?.full_name).toBe('Alice Smith');

    const withEmail = await listLeads(owner.token, '?hasEmail=true');
    expect(withEmail.total).toBe(1);
    expect(withEmail.data[0]?.email).toBe('alice@acme.com');

    expect(withEmail.filters.companies).toEqual(['Acme Inc', 'Beta GmbH']);
    expect(withEmail.filters.locations).toEqual(['Germany', 'United States']);
  });
});

describe('POST /api/leads/save', () => {
  it('upserts by owner and profile URL without nulling existing columns', async () => {
    const session = await signUp();
    const url = leadUrl('duplicate-save');
    const rawData = harvestLead as unknown as Record<string, unknown>;

    const created = await saveLead(session.token, {
      profile_url: url,
      full_name: 'Original Name',
      headline: 'First Headline',
      email: 'keep@example.com',
      company_name: 'Acme Inc',
      source_company_url: 'https://www.linkedin.com/company/acme/',
      current_job_duration: '3 yrs',
      job_period: '2022 - Present',
      raw_data: rawData,
    });
    expect(created.id).toEqual(expect.any(String));
    expect(created.full_name).toBe('Original Name');
    expect(created.source_company_url).toBe('https://www.linkedin.com/company/acme/');
    expect(created.current_job_duration).toBe('3 yrs');
    expect(created.job_period).toBe('2022 - Present');
    expect(created.raw_data?.id).toBe(rawData.id);

    const updated = await saveLead(session.token, {
      profile_url: url,
      headline: 'Second Headline',
      full_name: '',
      email: null,
    });
    expect(updated.id).toBe(created.id);
    expect(updated.headline).toBe('Second Headline');
    expect(updated.full_name).toBe('Original Name');
    expect(updated.email).toBe('keep@example.com');
    expect(updated.company_name).toBe('Acme Inc');

    const afterEmptyRaw = await saveLead(session.token, {
      profile_url: url,
      raw_data: {},
    });
    expect(afterEmptyRaw.id).toBe(created.id);
    expect(afterEmptyRaw.raw_data?.id).toBe(rawData.id);

    const listed = await listLeads(session.token);
    expect(listed.total).toBe(1);
  });

  it('requires profile_url', async () => {
    const session = await signUp();
    const response = await workerFetch(
      '/api/leads/save',
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ full_name: 'No URL' }) },
      session.token
    );
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: 'profile_url is required' });
  });
});

describe('lead owner isolation', () => {
  it('never lists, deletes, or batch-deletes another User’s leads', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const url = leadUrl('isolated');
    const owned = await saveLead(owner.token, { profile_url: url, full_name: 'Owned Lead' });

    const intruderList = await listLeads(intruder.token);
    expect(intruderList.total).toBe(0);

    const intruderSave = await saveLead(intruder.token, {
      profile_url: url,
      full_name: 'Intruder Lead',
    });
    expect(intruderSave.id).not.toBe(owned.id);
    expect((await listLeads(intruder.token)).total).toBe(1);
    expect((await listLeads(owner.token)).total).toBe(1);

    const single = await workerFetch(
      '/api/leads/delete',
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: owned.id }) },
      intruder.token
    );
    expect(single.status).toBe(200);
    expect(await readJson(single)).toEqual({ success: true });
    expect((await listLeads(owner.token)).total).toBe(1);

    const batch = await workerFetch(
      '/api/leads/batch-delete',
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ids: [owned.id] }) },
      intruder.token
    );
    expect(await readJson<{ deleted: number }>(batch)).toEqual({ deleted: 0 });
    expect((await listLeads(owner.token)).total).toBe(1);
  });

  it('deletes a single owned lead and ignores unknown ids', async () => {
    const session = await signUp();
    const first = await saveLead(session.token, {
      profile_url: leadUrl('single-a'),
      full_name: 'Single A',
    });
    const second = await saveLead(session.token, {
      profile_url: leadUrl('single-b'),
      full_name: 'Single B',
    });

    const response = await workerFetch(
      '/api/leads/delete',
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: first.id }) },
      session.token
    );
    expect(await readJson(response)).toEqual({ success: true });

    const listed = await listLeads(session.token);
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.id).toBe(second.id);

    const missing = await workerFetch(
      '/api/leads/delete',
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: 'not-a-real-id' }) },
      session.token
    );
    expect(missing.status).toBe(200);
    expect((await listLeads(session.token)).total).toBe(1);
  });
});

describe('POST /api/leads/batch-delete', () => {
  it('chunks more than 100 ids and only removes the owner’s rows', async () => {
    const owner = await signUp();
    const other = await signUp();

    const ownedIds: string[] = [];
    for (let i = 0; i < 101; i += 1) {
      const lead = await saveLead(owner.token, {
        profile_url: leadUrl(`bulk-${i}`),
        full_name: `Bulk Lead ${i}`,
      });
      ownedIds.push(lead.id);
    }
    const otherLead = await saveLead(other.token, {
      profile_url: leadUrl('bulk-other'),
      full_name: 'Other Lead',
    });

    const response = await workerFetch(
      '/api/leads/batch-delete',
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids: [...ownedIds, otherLead.id] }),
      },
      owner.token
    );
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ deleted: 101 });

    expect((await listLeads(owner.token)).total).toBe(0);
    const otherList = await listLeads(other.token);
    expect(otherList.total).toBe(1);
    expect(otherList.data[0]?.id).toBe(otherLead.id);
  });

  it('rejects an empty id list', async () => {
    const session: TestSession = await signUp();
    const response = await workerFetch(
      '/api/leads/batch-delete',
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ids: [] }) },
      session.token
    );
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: 'ids array is required' });
  });
});

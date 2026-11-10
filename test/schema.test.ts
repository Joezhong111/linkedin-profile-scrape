import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { eq, inArray } from 'drizzle-orm';
import { createDb, chunk } from '../worker/db';
import {
  linkedinLeads,
  linkedinProfiles,
  scrapeJobItems,
  scrapeJobs,
  userRoles,
  users,
} from '../db/schema';

const db = createDb(env.DB);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function seedUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: 'salt:hash', fullName: 'Test User', emailVerified: true })
    .returning();
  if (!user) throw new Error('user insert returned no row');
  await db.insert(userRoles).values({ userId: user.id, role: 'admin' });
  return user;
}

describe('D1 schema', () => {
  it('round-trips ISO timestamps, integer booleans, JSON and real decimals', async () => {
    const user = await seedUser('owner@example.com');
    expect(user.createdAt).toMatch(ISO);
    expect(user.updatedAt).toMatch(ISO);
    expect(user.emailVerified).toBe(true);

    const role = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
    expect(role).toEqual([expect.objectContaining({ userId: user.id, role: 'admin' })]);

    const rawData = { experiences: [{ title: 'Engineer' }], nested: { ok: true } };
    const [profile] = await db
      .insert(linkedinProfiles)
      .values({
        ownerId: user.id,
        profileUrl: 'https://www.linkedin.com/in/owner',
        fullName: 'Owner Name',
        rawData,
        isPremium: true,
        followers: 900719925474099,
        currentJobDurationYears: 3.5,
      })
      .returning();
    if (!profile) throw new Error('profile insert returned no row');

    const [savedProfile] = await db
      .select()
      .from(linkedinProfiles)
      .where(eq(linkedinProfiles.id, profile.id));
    expect(savedProfile).toMatchObject({
      ownerId: user.id,
      fullName: 'Owner Name',
      isPremium: true,
      followers: 900719925474099,
      currentJobDurationYears: 3.5,
    });
    expect(savedProfile?.rawData).toEqual(rawData);
    expect(savedProfile?.createdAt).toMatch(ISO);

    const [lead] = await db
      .insert(linkedinLeads)
      .values({
        ownerId: user.id,
        profileUrl: 'https://www.linkedin.com/in/lead',
        fullName: 'Lead Name',
        jobPeriod: '2020 - Present',
        rawData: { source: 'company' },
      })
      .returning();
    const [savedLead] = await db
      .select()
      .from(linkedinLeads)
      .where(eq(linkedinLeads.id, lead!.id));
    expect(savedLead).toMatchObject({ jobPeriod: '2020 - Present', rawData: { source: 'company' } });

    const inputSnapshot = { companyUrl: 'https://www.linkedin.com/company/acme', maxItems: 25 };
    const [job] = await db
      .insert(scrapeJobs)
      .values({
        ownerId: user.id,
        provider: 'apify',
        jobType: 'company',
        inputSnapshot,
      })
      .returning();
    if (!job) throw new Error('job insert returned no row');
    expect(job).toMatchObject({ status: 'pending', progress: 0, resultCount: 0 });
    expect(job.inputSnapshot).toEqual(inputSnapshot);

    await db.insert(scrapeJobItems).values([
      { jobId: job.id, idx: 0, data: { profile_url: 'a' } },
      { jobId: job.id, idx: 1, data: { profile_url: 'b' } },
    ]);
    const items = await db.select().from(scrapeJobItems).where(eq(scrapeJobItems.jobId, job.id));
    expect(items.map((item) => item.idx).sort()).toEqual([0, 1]);
    expect(items.find((item) => item.idx === 1)?.data).toEqual({ profile_url: 'b' });
  });

  it('cascades owner deletion through every owned table', async () => {
    const user = await seedUser('cascade@example.com');
    await db.insert(linkedinProfiles).values({
      ownerId: user.id,
      profileUrl: 'https://www.linkedin.com/in/cascade',
    });
    await db.insert(linkedinLeads).values({
      ownerId: user.id,
      profileUrl: 'https://www.linkedin.com/in/cascade-lead',
    });
    const [job] = await db
      .insert(scrapeJobs)
      .values({ ownerId: user.id, provider: 'treg', jobType: 'profiles', inputSnapshot: {} })
      .returning();
    await db.insert(scrapeJobItems).values([{ jobId: job!.id, idx: 0, data: {} }]);

    await db.delete(users).where(eq(users.id, user.id));

    expect(await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.ownerId, user.id))).toEqual([]);
    expect(await db.select().from(linkedinLeads).where(eq(linkedinLeads.ownerId, user.id))).toEqual([]);
    expect(await db.select().from(scrapeJobs).where(eq(scrapeJobs.ownerId, user.id))).toEqual([]);
    expect(await db.select().from(scrapeJobItems).where(eq(scrapeJobItems.jobId, job!.id))).toEqual([]);
    expect(await db.select().from(userRoles).where(eq(userRoles.userId, user.id))).toEqual([]);
  });

  it('cascades job deletion to its items only', async () => {
    const user = await seedUser('jobs@example.com');
    const [job] = await db
      .insert(scrapeJobs)
      .values({ ownerId: user.id, provider: 'apify', jobType: 'company', inputSnapshot: {} })
      .returning();
    await db.insert(scrapeJobItems).values([
      { jobId: job!.id, idx: 0, data: { n: 0 } },
      { jobId: job!.id, idx: 1, data: { n: 1 } },
    ]);

    await db.delete(scrapeJobs).where(eq(scrapeJobs.id, job!.id));

    expect(await db.select().from(scrapeJobItems).where(eq(scrapeJobItems.jobId, job!.id))).toEqual([]);
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
  });
});

describe('chunk', () => {
  it('splits ids into D1-safe batches', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);

    const chunks = chunk(ids);

    expect(chunks.map((batch) => batch.length)).toEqual([90, 11]);
    expect(chunks.flat()).toEqual(ids);
  });

  it('deletes more than 100 rows through chunked inArray', async () => {
    const user = await seedUser('chunky@example.com');
    const ids: string[] = [];
    for (let i = 0; i < 101; i += 1) {
      const [row] = await db
        .insert(linkedinProfiles)
        .values({
          ownerId: user.id,
          profileUrl: `https://www.linkedin.com/in/chunk-${i}`,
        })
        .returning({ id: linkedinProfiles.id });
      ids.push(row!.id);
    }

    for (const batch of chunk(ids)) {
      await db.delete(linkedinProfiles).where(inArray(linkedinProfiles.id, batch));
    }

    expect(await db.select().from(linkedinProfiles).where(eq(linkedinProfiles.ownerId, user.id))).toEqual([]);
  });
});

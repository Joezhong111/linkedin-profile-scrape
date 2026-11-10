import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import {
  companyScrapeHistory,
  linkedinLeads,
  scrapeJobItems,
  scrapeJobs,
  type ScrapeJob,
} from '../db/schema';
import { normalizeScrapeItem } from '../lib/normalize';
import { chunk, type AppDb } from './db';
import type { CompanyScrapeInput, ScrapeProvider } from './providers/types';

/**
 * Owner-scoped Scrape Job lifecycle: create, advance one provider poll, read
 * the client status payload, and delete jobs past the retention window.
 *
 * Provider raw items are persisted verbatim (the SPA normalizes them) while
 * dedupe and statistics use the normalized Scrape Result shape.
 */

/** Scrape Jobs and their items are deleted after seven days. */
export const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Four bound parameters per item row; 20 rows stays well below D1's 100. */
const ITEM_INSERT_CHUNK = 20;
/** Owner predicate + URL list must stay below D1's 100 bound parameters. */
const LEAD_LOOKUP_CHUNK = 50;

export interface ScrapeStats {
  totalReturned: number;
  alreadyExists: number;
  newProfiles: number;
  duplicateRate: number;
}

export interface JobStatusPayload {
  status: ScrapeJob['status'];
  progress: number;
  resultCount: number;
  items?: unknown[];
  stats?: ScrapeStats;
  error?: string;
}

export interface CreateCompanyJobParams {
  ownerId: string;
  provider: 'apify' | 'treg';
  input: CompanyScrapeInput;
  providerJobRef: string;
}

/** Lower-cased, query-free, slash-free URL used only as a dedupe key. */
function normalizeProfileUrl(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
}

export async function createCompanyJobRow(
  db: AppDb,
  params: CreateCompanyJobParams
): Promise<ScrapeJob> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(scrapeJobs)
    .values({
      ownerId: params.ownerId,
      provider: params.provider,
      providerJobRef: params.providerJobRef,
      jobType: 'company',
      inputSnapshot: params.input,
      status: 'running',
      progress: 0,
      resultCount: 0,
      createdAt: now,
      startedAt: now,
    })
    .returning();
  if (!row) throw new Error('Could not create the Scrape Job row.');
  return row;
}

/** A job is only visible to the User who owns it. */
export async function findOwnedJob(
  db: AppDb,
  jobId: string,
  ownerId: string
): Promise<ScrapeJob | null> {
  const [row] = await db
    .select()
    .from(scrapeJobs)
    .where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function readJobItems(db: AppDb, jobId: string): Promise<unknown[]> {
  const rows = await db
    .select({ data: scrapeJobItems.data })
    .from(scrapeJobItems)
    .where(eq(scrapeJobItems.jobId, jobId))
    .orderBy(asc(scrapeJobItems.idx));
  return rows.map((row) => row.data);
}

function dedupeAndTruncate(items: unknown[], maxItems: number): unknown[] {
  const seen = new Set<string>();
  const kept: unknown[] = [];
  for (const item of items) {
    if (kept.length >= maxItems) break;
    const key = normalizeProfileUrl(normalizeScrapeItem(item).profile_url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }
  return kept;
}

async function computeStats(
  db: AppDb,
  ownerId: string,
  items: unknown[]
): Promise<ScrapeStats> {
  const urls = [
    ...new Set(
      items
        .map((item) => normalizeScrapeItem(item).profile_url.trim())
        .filter((url) => url.length > 0)
    ),
  ];

  let alreadyExists = 0;
  for (const batch of chunk(urls, LEAD_LOOKUP_CHUNK)) {
    const rows = await db
      .select({ profileUrl: linkedinLeads.profileUrl })
      .from(linkedinLeads)
      .where(and(eq(linkedinLeads.ownerId, ownerId), inArray(linkedinLeads.profileUrl, batch)));
    alreadyExists += rows.length;
  }

  const totalReturned = items.length;
  return {
    totalReturned,
    alreadyExists,
    newProfiles: totalReturned - alreadyExists,
    duplicateRate:
      totalReturned === 0 ? 0 : Math.round((alreadyExists / totalReturned) * 100),
  };
}

async function persistItems(db: AppDb, jobId: string, items: unknown[]): Promise<void> {
  await db.delete(scrapeJobItems).where(eq(scrapeJobItems.jobId, jobId));
  const createdAt = new Date().toISOString();
  const rows = items.map((data, idx) => ({ jobId, idx, data, createdAt }));
  for (const batch of chunk(rows, ITEM_INSERT_CHUNK)) {
    await db.insert(scrapeJobItems).values(batch);
  }
}

/**
 * Performs exactly one provider poll and applies its outcome to the job.
 * Throws provider errors (e.g. an invalid credential) without marking the job
 * failed so the caller can retry after the User updates the credential.
 */
export async function advanceCompanyJob(
  db: AppDb,
  job: ScrapeJob,
  provider: ScrapeProvider,
  token: string
): Promise<ScrapeJob> {
  // Written by createCompanyJobRow and only read back here.
  const input = job.inputSnapshot as CompanyScrapeInput;
  const state = await provider.pollCompanyJob(job.providerJobRef, input, token);
  const now = new Date().toISOString();

  if (state.status === 'running' || state.status === 'pending') {
    const progress = Math.max(job.progress, state.progress);
    const resultCount = Math.max(job.resultCount, state.resultCount);
    await db
      .update(scrapeJobs)
      .set({ status: 'running', progress, resultCount })
      .where(eq(scrapeJobs.id, job.id));
    return { ...job, status: 'running', progress, resultCount };
  }

  if (state.status === 'failed') {
    const errorMessage = state.error ?? 'The provider reported a failed scrape. Try again.';
    await db
      .update(scrapeJobs)
      .set({
        status: 'failed',
        progress: state.progress,
        resultCount: state.resultCount,
        errorMessage,
        completedAt: now,
      })
      .where(eq(scrapeJobs.id, job.id));
    return {
      ...job,
      status: 'failed',
      progress: state.progress,
      resultCount: state.resultCount,
      errorMessage,
      completedAt: now,
    };
  }

  const items = dedupeAndTruncate(state.items ?? [], input.maxItems);
  const stats = await computeStats(db, job.ownerId, items);

  await persistItems(db, job.id, items);
  await db.insert(companyScrapeHistory).values({
    ownerId: job.ownerId,
    companyUrl: input.companyUrl,
    maxItemsRequested: input.maxItems,
    itemsReturned: items.length,
    itemsSaved: stats.newProfiles,
    filtersUsed: {
      jobTitles: input.jobTitles,
      locations: input.locations,
      yearsAtCurrentCompanyIds: input.yearsAtCurrentCompanyIds,
      yearsOfExperienceIds: input.yearsOfExperienceIds,
    },
    scrapedAt: now,
  });
  await db
    .update(scrapeJobs)
    .set({
      status: 'succeeded',
      progress: items.length,
      resultCount: items.length,
      errorMessage: null,
      completedAt: now,
    })
    .where(eq(scrapeJobs.id, job.id));

  return {
    ...job,
    status: 'succeeded',
    progress: items.length,
    resultCount: items.length,
    errorMessage: null,
    completedAt: now,
  };
}

/** Builds the client payload for a job in any state. Succeeded jobs read items. */
export async function jobStatusPayload(
  db: AppDb,
  job: ScrapeJob
): Promise<JobStatusPayload> {
  if (job.status === 'succeeded') {
    const items = await readJobItems(db, job.id);
    const stats = await computeStats(db, job.ownerId, items);
    return {
      status: 'succeeded',
      progress: job.progress,
      resultCount: items.length,
      items,
      stats,
    };
  }

  if (job.status === 'failed') {
    return {
      status: 'failed',
      progress: job.progress,
      resultCount: job.resultCount,
      error: job.errorMessage ?? 'The scrape failed. Try again.',
    };
  }

  return { status: job.status, progress: job.progress, resultCount: job.resultCount };
}

/**
 * Deletes Scrape Jobs older than the retention window; items are removed
 * explicitly so cleanup does not depend on the connection's FK pragma.
 * Company Scrape History is intentionally retained.
 */
export async function cleanupOldJobs(
  db: AppDb,
  now: Date | string = new Date()
): Promise<number> {
  const nowMs = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('cleanupOldJobs received an invalid date.');
  const cutoff = new Date(nowMs - JOB_RETENTION_MS).toISOString();

  const oldJobs = await db
    .select({ id: scrapeJobs.id })
    .from(scrapeJobs)
    .where(lt(scrapeJobs.createdAt, cutoff));
  if (oldJobs.length === 0) return 0;

  const ids = oldJobs.map((row) => row.id);
  for (const batch of chunk(ids, 90)) {
    await db.delete(scrapeJobItems).where(inArray(scrapeJobItems.jobId, batch));
    await db.delete(scrapeJobs).where(inArray(scrapeJobs.id, batch));
  }
  return ids.length;
}

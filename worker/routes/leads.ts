import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  like,
  ne,
  or,
  type SQL,
} from 'drizzle-orm';
import { linkedinLeads, type NewLinkedInLead } from '../../db/schema';
import { chunk, createDb } from '../db';
import { error, json, parseJsonBody, requireUser, type Route } from '../http';
import { mapLeadRow } from '../mappers';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
/** Owner predicate + 90 ids stays below D1's 100 bound-parameter limit. */
const DELETE_CHUNK_SIZE = 90;

const TEXT_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['full_name', 'fullName'],
  ['headline', 'headline'],
  ['location', 'location'],
  ['about', 'about'],
  ['photo_url', 'photoUrl'],
  ['ai_summary', 'aiSummary'],
  ['linkedin_public_url', 'linkedinPublicUrl'],
  ['linkedin_id', 'linkedinId'],
  ['public_identifier', 'publicIdentifier'],
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['email', 'email'],
  ['mobile_number', 'mobileNumber'],
  ['job_title', 'jobTitle'],
  ['company_name', 'companyName'],
  ['company_industry', 'companyIndustry'],
  ['company_linkedin', 'companyLinkedin'],
  ['source_company_url', 'sourceCompanyUrl'],
  ['current_job_duration', 'currentJobDuration'],
  ['job_period', 'jobPeriod'],
];

const INTEGER_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['connections', 'connections'],
  ['followers', 'followers'],
];

const REAL_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['current_job_duration_years', 'currentJobDurationYears'],
];

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** A non-empty incoming value is allowed to overwrite an existing column. */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Maps the snake_case lead payload onto column names. When `presentOnly` is
 * set, only non-empty incoming values are kept so an update never nulls an
 * existing column; inserts keep missing values as null.
 */
function leadWriteValues(
  body: Record<string, unknown>,
  presentOnly: boolean
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const keep = (raw: unknown) => !presentOnly || isPresent(raw);

  for (const [wire, column] of TEXT_FIELDS) {
    const raw = body[wire];
    if (!keep(raw)) continue;
    values[column] = raw == null ? null : String(raw);
  }

  for (const [wire, column] of INTEGER_FIELDS) {
    const raw = body[wire];
    if (!keep(raw)) continue;
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    values[column] = Number.isFinite(parsed) ? parsed : null;
  }

  for (const [wire, column] of REAL_FIELDS) {
    const raw = body[wire];
    if (!keep(raw)) continue;
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
    values[column] = Number.isFinite(parsed) ? parsed : null;
  }

  if (keep(body.raw_data)) values.rawData = body.raw_data;

  return values;
}

/** The filter dropdown shows the last comma-separated region segment. */
function regionOf(location: string | null): string | null {
  if (!location) return null;
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? null) : null;
}

function uniqueSorted(values: Array<string | null>): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    if (value && value.trim()) unique.add(value);
  }
  return [...unique].sort();
}

const listLeads: Route = {
  method: 'GET',
  path: '/api/leads/list',
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user instanceof Response) return user;

    const db = createDb(ctx.env.DB);
    const page = parseBoundedInt(ctx.url.searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parseBoundedInt(
      ctx.url.searchParams.get('pageSize'),
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    const q = (ctx.url.searchParams.get('q') ?? '').trim();
    const company = (ctx.url.searchParams.get('company') ?? '').trim();
    const location = (ctx.url.searchParams.get('location') ?? '').trim();
    const jobTitle = (ctx.url.searchParams.get('jobTitle') ?? '').trim();
    const hasEmail = ctx.url.searchParams.get('hasEmail') === 'true';

    const conditions: SQL[] = [eq(linkedinLeads.ownerId, user.id)];
    if (q) {
      const pattern = `%${q}%`;
      const search = or(
        like(linkedinLeads.fullName, pattern),
        like(linkedinLeads.headline, pattern),
        like(linkedinLeads.jobTitle, pattern),
        like(linkedinLeads.companyName, pattern),
        like(linkedinLeads.location, pattern),
        like(linkedinLeads.email, pattern)
      );
      if (search) conditions.push(search);
    }
    if (company) conditions.push(eq(linkedinLeads.companyName, company));
    if (location) conditions.push(like(linkedinLeads.location, `%${location}%`));
    if (jobTitle) conditions.push(like(linkedinLeads.jobTitle, `%${jobTitle}%`));
    if (hasEmail) {
      conditions.push(isNotNull(linkedinLeads.email), ne(linkedinLeads.email, ''));
    }
    const where = and(...conditions);

    const [totalRow] = await db
      .select({ value: count() })
      .from(linkedinLeads)
      .where(where);
    const total = Number(totalRow?.value ?? 0);

    const rows = await db
      .select()
      .from(linkedinLeads)
      .where(where)
      .orderBy(desc(linkedinLeads.createdAt), desc(linkedinLeads.id))
      .limit(pageSize)
      .offset(offset);

    const optionRows = await db
      .select({ companyName: linkedinLeads.companyName, location: linkedinLeads.location })
      .from(linkedinLeads)
      .where(eq(linkedinLeads.ownerId, user.id));

    return json({
      data: rows.map(mapLeadRow),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        companies: uniqueSorted(optionRows.map((row) => row.companyName)),
        locations: uniqueSorted(optionRows.map((row) => regionOf(row.location))),
      },
    });
  },
};

const saveLead: Route = {
  method: 'POST',
  path: '/api/leads/save',
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user instanceof Response) return user;

    const body = await parseJsonBody(ctx.request);
    const profileUrl = typeof body.profile_url === 'string' ? body.profile_url.trim() : '';
    if (!profileUrl) return error(400, 'profile_url is required');

    const db = createDb(ctx.env.DB);
    const [existing] = await db
      .select()
      .from(linkedinLeads)
      .where(
        and(eq(linkedinLeads.ownerId, user.id), eq(linkedinLeads.profileUrl, profileUrl))
      )
      .limit(1);

    if (existing) {
      const updates = leadWriteValues(body, true);
      if (Object.keys(updates).length === 0) return json(mapLeadRow(existing));

      const [updated] = await db
        .update(linkedinLeads)
        .set(updates as Partial<NewLinkedInLead>)
        .where(and(eq(linkedinLeads.id, existing.id), eq(linkedinLeads.ownerId, user.id)))
        .returning();
      return json(mapLeadRow(updated ?? existing));
    }

    const values = {
      ownerId: user.id,
      profileUrl,
      ...leadWriteValues(body, false),
    } as NewLinkedInLead;
    const [created] = await db.insert(linkedinLeads).values(values).returning();
    if (!created) return error(500, 'Failed to save lead');
    return json(mapLeadRow(created));
  },
};

const deleteLead: Route = {
  method: 'POST',
  path: '/api/leads/delete',
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user instanceof Response) return user;

    const body = await parseJsonBody(ctx.request);
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return error(400, 'id is required');

    const db = createDb(ctx.env.DB);
    await db
      .delete(linkedinLeads)
      .where(and(eq(linkedinLeads.ownerId, user.id), eq(linkedinLeads.id, id)));
    return json({ success: true });
  },
};

const batchDeleteLeads: Route = {
  method: 'POST',
  path: '/api/leads/batch-delete',
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user instanceof Response) return user;

    const body = await parseJsonBody(ctx.request);
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return error(400, 'ids array is required');

    const db = createDb(ctx.env.DB);
    let deleted = 0;
    for (const idsChunk of chunk(
      ids.filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
      DELETE_CHUNK_SIZE
    )) {
      const rows = await db
        .delete(linkedinLeads)
        .where(and(eq(linkedinLeads.ownerId, user.id), inArray(linkedinLeads.id, idsChunk)))
        .returning({ id: linkedinLeads.id });
      deleted += rows.length;
    }
    return json({ deleted });
  },
};

export const leadsRoutes: Route[] = [listLeads, saveLead, deleteLead, batchDeleteLeads];

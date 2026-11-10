import { and, desc, eq } from 'drizzle-orm';
import { companyScrapeHistory } from '../../db/schema';
import { getProviderToken } from '../credentials';
import { createDb } from '../db';
import { error, json, providerFailure, requireUser, type Route } from '../http';
import { advanceCompanyJob, findOwnedJob, jobStatusPayload } from '../jobs';
import { providerById } from '../providers';

/**
 * Scrape Job polling and Company Scrape History.
 *
 * Jobs are always loaded by id AND owner: another User's job id is a 404 and
 * never reveals items. A running job advances at most one provider poll per
 * request; a terminal job is served from the stored row and items.
 *
 * A job is advanced with the provider stored on the job, never the User's
 * current Active Provider: switching providers mid-job would otherwise send an
 * Apify run reference to treg and fail or invent a zero-item success.
 */

export const jobsRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/check_scrape_status',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const jobId = ctx.url.searchParams.get('jobId')?.trim() ?? '';
      if (!jobId) return error(400, 'jobId is required.');

      const db = createDb(ctx.env.DB);
      let job = await findOwnedJob(db, jobId, user.id);
      if (!job) return error(404, 'Scrape Job not found.');

      if (job.status === 'running' || job.status === 'pending') {
        const credential = await getProviderToken(ctx.env, user);
        if (credential instanceof Response) return credential;

        if (credential.provider !== job.provider) {
          return error(
            400,
            `This Scrape Job was started with ${job.provider}. Switch your Active Provider back to ${job.provider} and save a credential to resume it.`,
            'provider_changed'
          );
        }

        try {
          job = await advanceCompanyJob(db, job, providerById(job.provider), credential.token);
        } catch (err) {
          return providerFailure(err, 'Could not check the Scrape Job. Try again later.');
        }
      }

      return json(await jobStatusPayload(db, job));
    },
  },
  {
    method: 'GET',
    path: '/api/check_company_history',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const companyUrl = ctx.url.searchParams.get('companyUrl')?.trim() ?? '';
      if (!companyUrl) return error(400, 'companyUrl is required.');

      const db = createDb(ctx.env.DB);
      const rows = await db
        .select()
        .from(companyScrapeHistory)
        .where(
          and(
            eq(companyScrapeHistory.ownerId, user.id),
            eq(companyScrapeHistory.companyUrl, companyUrl)
          )
        )
        .orderBy(desc(companyScrapeHistory.scrapedAt));

      const last = rows[0];
      return json({
        hasHistory: rows.length > 0,
        lastScrape: last
          ? {
              scrapedAt: last.scrapedAt,
              maxItemsRequested: last.maxItemsRequested,
              itemsReturned: last.itemsReturned,
              itemsSaved: last.itemsSaved,
              filtersUsed: last.filtersUsed,
            }
          : null,
        totalScrapes: rows.length,
      });
    },
  },
];

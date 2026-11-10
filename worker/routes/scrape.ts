import { createDb } from '../db';
import { getProviderToken } from '../credentials';
import { error, json, parseJsonBody, requireUser, type Route } from '../http';
import { createCompanyJobRow } from '../jobs';
import { providerFor } from '../providers';
import {
  ProviderError,
  type CompanyScrapeInput,
  type ScrapeTier,
} from '../providers/types';

/**
 * `POST /api/scrape` is the synchronous Profile scrape path.
 *
 * The 10-URL cap and provider errors are enforced here so every provider gets
 * the same boundary; the provider response is returned as a bare array.
 *
 * `POST /api/scrape_company` starts an owner-scoped Scrape Job and returns its
 * identifier immediately; progress arrives through `/api/check_scrape_status`.
 */

const MAX_PROFILE_URLS = 10;
const PROFILE_URL_PATTERN = /^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/in\//i;
const COMPANY_URL_PATTERN = /^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/company\/[^\s]+$/i;
const DEFAULT_MAX_ITEMS = 25;
const MAX_ITEMS = 100;
const MAX_FILTER_VALUES = 50;

function isTier(value: unknown): value is ScrapeTier {
  return value === 'full' || value === 'full_email';
}

/** Provider messages must never leak a token in a query string or header. */
function redactSecrets(message: string): string {
  return message
    .replace(/([?&]token=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[redacted]');
}

function providerFailure(err: unknown, fallback: string): Response {
  if (err instanceof ProviderError) {
    const message = redactSecrets(err.message);
    if (err.kind === 'credential') return error(400, message, 'credential_invalid');
    if (err.kind === 'input') return error(400, message);
    return error(502, message);
  }
  return error(502, fallback);
}

type FilterListResult = { ok: true; values: string[] } | { ok: false; error: string };

/** Company filters are optional string lists capped at Apify's 50 values. */
function parseFilterList(value: unknown, label: string): FilterListResult {
  if (value === undefined || value === null) return { ok: true, values: [] };
  if (!Array.isArray(value)) return { ok: false, error: `${label} must be an array.` };
  if (value.length > MAX_FILTER_VALUES) {
    return { ok: false, error: `At most ${MAX_FILTER_VALUES} ${label} are allowed.` };
  }

  const values: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      return { ok: false, error: `${label} must contain only text values.` };
    }
    const trimmed = entry.trim();
    if (trimmed) values.push(trimmed);
  }
  if (values.length > MAX_FILTER_VALUES) {
    return { ok: false, error: `At most ${MAX_FILTER_VALUES} ${label} are allowed.` };
  }
  return { ok: true, values };
}

export const scrapeRoutes: Route[] = [
  {
    method: 'POST',
    path: '/api/scrape',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const credential = await getProviderToken(ctx.env, createDb(ctx.env.DB), user);
      if (credential instanceof Response) return credential;

      const body = await parseJsonBody(ctx.request);
      const rawUrls = Array.isArray(body.urls) ? body.urls : [];
      const urls = rawUrls
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);

      if (urls.length === 0) {
        return error(400, 'At least one Profile URL is required.');
      }
      if (urls.length > MAX_PROFILE_URLS) {
        return error(400, `At most ${MAX_PROFILE_URLS} Profile URLs can be scraped at once.`);
      }
      if (!urls.every((url) => PROFILE_URL_PATTERN.test(url))) {
        return error(400, 'Every URL must be a LinkedIn profile URL (linkedin.com/in/...).');
      }
      if (body.tier !== undefined && !isTier(body.tier)) {
        return error(400, 'tier must be "full" or "full_email".');
      }

      const tier: ScrapeTier = isTier(body.tier) ? body.tier : 'full';

      try {
        const provider = providerFor(user);
        const items = await provider.scrapeProfiles({ urls, tier }, credential.token);
        return json(items);
      } catch (err) {
        return providerFailure(err, 'Scraping failed. Try again later.');
      }
    },
  },
  {
    method: 'POST',
    path: '/api/scrape_company',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const db = createDb(ctx.env.DB);
      const credential = await getProviderToken(ctx.env, db, user);
      if (credential instanceof Response) return credential;

      const body = await parseJsonBody(ctx.request);
      const companyUrl = typeof body.companyUrl === 'string' ? body.companyUrl.trim() : '';
      if (!COMPANY_URL_PATTERN.test(companyUrl)) {
        return error(400, 'companyUrl must be a LinkedIn company URL (linkedin.com/company/...).');
      }

      if (body.maxItems !== undefined && typeof body.maxItems !== 'number') {
        return error(400, `maxItems must be an integer from 1 to ${MAX_ITEMS}.`);
      }
      const maxItems = body.maxItems === undefined ? DEFAULT_MAX_ITEMS : body.maxItems;
      if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS) {
        return error(400, `maxItems must be an integer from 1 to ${MAX_ITEMS}.`);
      }

      if (body.tier !== undefined && !isTier(body.tier)) {
        return error(400, 'tier must be "full" or "full_email".');
      }
      const tier: ScrapeTier = isTier(body.tier) ? body.tier : 'full';

      const jobTitles = parseFilterList(body.jobTitles, 'Job titles');
      if (!jobTitles.ok) return error(400, jobTitles.error);
      const locations = parseFilterList(body.locations, 'Locations');
      if (!locations.ok) return error(400, locations.error);
      const yearsAtCurrentCompany = parseFilterList(
        body.yearsAtCurrentCompanyIds,
        'Years-at-current-company filters'
      );
      if (!yearsAtCurrentCompany.ok) return error(400, yearsAtCurrentCompany.error);
      const yearsOfExperience = parseFilterList(
        body.yearsOfExperienceIds,
        'Years-of-experience filters'
      );
      if (!yearsOfExperience.ok) return error(400, yearsOfExperience.error);

      const input: CompanyScrapeInput = {
        companyUrl,
        maxItems,
        tier,
        jobTitles: jobTitles.values,
        locations: locations.values,
        yearsAtCurrentCompanyIds: yearsAtCurrentCompany.values,
        yearsOfExperienceIds: yearsOfExperience.values,
      };

      try {
        const provider = providerFor(user);
        const started = await provider.createCompanyJob(input, credential.token);
        if (!started.providerJobRef) {
          return error(502, 'The provider did not return a run reference. Try again later.');
        }
        const job = await createCompanyJobRow(db, {
          ownerId: user.id,
          provider: credential.provider,
          input,
          providerJobRef: started.providerJobRef,
        });
        return json(
          { jobId: job.id, status: 'running', progress: 0, resultCount: 0 },
          202
        );
      } catch (err) {
        return providerFailure(err, 'Could not start the company scrape. Try again later.');
      }
    },
  },
];

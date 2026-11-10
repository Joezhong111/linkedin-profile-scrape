import { createDb } from '../db';
import { getProviderToken } from '../credentials';
import { error, json, parseJsonBody, requireUser, type Route } from '../http';
import { providerFor } from '../providers';
import { ProviderError, type ScrapeTier } from '../providers/types';

/**
 * `POST /api/scrape` is the synchronous Profile scrape path.
 *
 * The 10-URL cap and provider errors are enforced here so every provider gets
 * the same boundary; the provider response is returned as a bare array.
 */

const MAX_PROFILE_URLS = 10;
const PROFILE_URL_PATTERN = /^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/in\//i;

function isTier(value: unknown): value is ScrapeTier {
  return value === 'full' || value === 'full_email';
}

/** Provider messages must never leak a token in a query string or header. */
function redactSecrets(message: string): string {
  return message
    .replace(/([?&]token=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[redacted]');
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

      const tier: ScrapeTier =
        credential.provider === 'apify' || !isTier(body.tier) ? 'full' : body.tier;

      try {
        const provider = providerFor(user);
        const items = await provider.scrapeProfiles({ urls, tier }, credential.token);
        return json(items);
      } catch (err) {
        if (err instanceof ProviderError) {
          const message = redactSecrets(err.message);
          if (err.kind === 'credential') return error(400, message, 'credential_invalid');
          if (err.kind === 'input') return error(400, message);
          return error(502, message);
        }
        return error(502, 'Scraping failed. Try again later.');
      }
    },
  },
];

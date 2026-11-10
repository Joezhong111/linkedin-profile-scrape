/**
 * Scrape limits and URL predicates shared by the Worker routes and the SPA.
 *
 * Pure module: no env, DOM, or network imports, so both TypeScript projects can
 * use it and the client validates exactly what the server enforces.
 */

export const MAX_PROFILE_URLS = 10;
export const DEFAULT_MAX_ITEMS = 25;
export const MAX_ITEMS = 100;

/** treg accepts 70 filter values per list; Apify accepts 50. */
export const FILTER_LIMITS = { apify: 50, treg: 70 } as const;

export const COMPANY_URL_PATTERN =
  /^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/company\/[^\s]+$/i;

export const PROFILE_URL_PATTERN = /^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/in\//i;

export function isProfileUrl(value: string): boolean {
  return PROFILE_URL_PATTERN.test(value.trim());
}

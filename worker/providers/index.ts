import type { User } from '../../db/schema';
import { apifyProvider } from './apify';
import { tregProvider } from './treg';
import { ProviderError, type ScrapeProvider } from './types';

/**
 * Resolves the Scrape Provider for a stored provider id. Scrape Jobs use this
 * with the provider captured when the job started, so a later Active Provider
 * change cannot advance an old job with the wrong adapter.
 */
export function providerById(provider: 'apify' | 'treg'): ScrapeProvider {
  switch (provider) {
    case 'apify':
      return apifyProvider;
    case 'treg':
      return tregProvider;
    default:
      throw new ProviderError('input', `Unknown scrape provider "${String(provider)}".`);
  }
}

/**
 * Resolves the Scrape Provider for a User's Active Provider.
 *
 * The provider is never inferred from the credential or a server token: an
 * unset Active Provider is an input error and there is no fallback provider.
 */
export function providerFor(user: User): ScrapeProvider {
  if (!user.activeProvider) {
    throw new ProviderError(
      'input',
      'No Active Provider is configured. Add a Scrape Credential in Settings.'
    );
  }
  return providerById(user.activeProvider);
}

export { apifyProvider, tregProvider };
export * from './types';

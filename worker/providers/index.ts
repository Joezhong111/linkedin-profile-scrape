import type { User } from '../../db/schema';
import { apifyProvider } from './apify';
import { ProviderError, type ScrapeProvider } from './types';

/**
 * Resolves the Scrape Provider for a User's Active Provider.
 *
 * The provider is never inferred from the credential or a server token: an
 * unset Active Provider is an input error and treg is not implemented yet.
 */
export function providerFor(user: User): ScrapeProvider {
  switch (user.activeProvider) {
    case 'apify':
      return apifyProvider;
    case 'treg':
      throw new ProviderError('input', 'The treg provider is not available yet. Use Apify.');
    default:
      throw new ProviderError(
        'input',
        'No Active Provider is configured. Add a Scrape Credential in Settings.'
      );
  }
}

export { apifyProvider };
export * from './types';

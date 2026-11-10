import { json, type Route } from '../http';
import { adminRoutes } from './admin';
import { authRoutes } from './auth';
import { credentialsRoutes } from './credentials';
import { leadsRoutes } from './leads';
import { profilesRoutes } from './profiles';
import { scrapeRoutes } from './scrape';

/**
 * Every route module contributes its `Route[]` here. Later tickets add one
 * import and one spread.
 */
export const ROUTES: Route[] = [
  {
    method: 'GET',
    path: '/api/health',
    handler: () => json({ status: 'ok', providers: ['apify', 'treg'] }),
  },
  ...authRoutes,
  ...credentialsRoutes,
  ...leadsRoutes,
  ...profilesRoutes,
  ...scrapeRoutes,
  ...adminRoutes,
];

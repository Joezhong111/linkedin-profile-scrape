import { json, type Route } from '../http';
import { authRoutes } from './auth';
import { leadsRoutes } from './leads';
import { profilesRoutes } from './profiles';

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
  ...leadsRoutes,
  ...profilesRoutes,
];

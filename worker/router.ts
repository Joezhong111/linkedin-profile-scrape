import { error, json, type Route, type RouteContext } from './http';

/**
 * Every `/api/*` request enters here. Route modules export `Route[]` and are
 * composed in `worker/routes/index.ts` once business handlers land.
 */
export const ROUTES: Route[] = [
  {
    method: 'GET',
    path: '/api/health',
    handler: () => json({ status: 'ok', providers: ['apify', 'treg'] }),
  },
];

interface Match {
  route: Route;
  params: Record<string, string>;
}

function matchPath(routePath: string, pathname: string): Record<string, string> | null {
  const routeSegments = routePath.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (routeSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i]!;
    const pathSegment = pathSegments[i]!;
    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }
    if (routeSegment !== pathSegment) return null;
  }
  return params;
}

export function matchRoute(method: string, pathname: string): Match | 'method-not-allowed' | null {
  let pathMatched = false;
  for (const route of ROUTES) {
    const params = matchPath(route.path, pathname);
    if (!params) continue;
    pathMatched = true;
    if (route.method === method) return { route, params };
  }
  return pathMatched ? 'method-not-allowed' : null;
}

export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const match = matchRoute(request.method, url.pathname);

  if (match === null) return error(501, 'Not implemented');
  if (match === 'method-not-allowed') return error(405, 'Method Not Allowed');

  const context: RouteContext = {
    request,
    env,
    ctx,
    params: match.params,
    url,
  };
  return match.route.handler(context);
}

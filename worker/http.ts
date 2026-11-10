/**
 * Minimal HTTP helpers shared by every Worker route.
 *
 * Routing types live here too so route modules only depend on this file.
 */

export interface RouteContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  params: Record<string, string>;
  url: URL;
}

export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;

export interface Route {
  method: string;
  /** Path with optional `:param` segments, e.g. `/api/leads/:id`. */
  path: string;
  handler: RouteHandler;
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function text(body: string, status = 200, headers?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    },
  });
}

export function error(status: number, message: string, code?: string): Response {
  return json(code ? { error: message, code } : { error: message }, status);
}

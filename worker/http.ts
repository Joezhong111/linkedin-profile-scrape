import type { User } from '../db/schema';
import { getUserRole, verifyToken } from './auth';
import { createDb } from './db';
import { ProviderError } from './providers/types';

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

/** Parses a JSON object body; empty or invalid bodies become `{}` instead of throwing. */
export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/** Provider messages must never leak a token in a query string or header. */
export function redactSecrets(message: string): string {
  return message
    .replace(/([?&]token=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[redacted]');
}

/** Maps a provider failure onto the user-safe 400/502 response shape. */
export function providerFailure(err: unknown, fallback: string): Response {
  if (err instanceof ProviderError) {
    const message = redactSecrets(err.message);
    if (err.kind === 'credential') return error(400, message, 'credential_invalid');
    if (err.kind === 'input') return error(400, message);
    return error(502, message);
  }
  return error(502, fallback);
}

/** Reads a Bearer token from the Authorization header, or `null`. */
export function extractToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

/** Resolves the current User, or returns a ready-made 401 response. */
export async function requireUser(ctx: RouteContext): Promise<User | Response> {
  const token = extractToken(ctx.request);
  if (!token) return error(401, 'Missing Authorization');
  const user = await verifyToken(createDb(ctx.env.DB), token);
  if (!user) return error(401, 'Invalid or expired token');
  return user;
}

/** Requires an Admin User; otherwise returns 401 (no User) or 403 (not Admin). */
export async function requireAdmin(ctx: RouteContext): Promise<User | Response> {
  const user = await requireUser(ctx);
  if (user instanceof Response) return user;
  const role = await getUserRole(createDb(ctx.env.DB), user.id);
  if (role !== 'admin') return error(403, 'Admin access required');
  return user;
}

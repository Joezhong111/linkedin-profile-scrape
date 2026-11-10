import { createDb } from '../db';
import {
  clearCredential,
  CredentialError,
  getCredentialStatus,
  isProviderId,
  saveCredential,
} from '../credentials';
import { error, json, parseJsonBody, requireUser, type Route } from '../http';

/**
 * `/api/account/credentials` is write-only: the response never includes the
 * token, its ciphertext, or an IV. Setting a credential replaces the previous
 * provider and credential in one update.
 */
export const credentialsRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/account/credentials',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;
      return json(await getCredentialStatus(user));
    },
  },
  {
    method: 'PUT',
    path: '/api/account/credentials',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const body = await parseJsonBody(ctx.request);
      const provider = body.provider;
      const token = body.token;

      if (!isProviderId(provider)) {
        return error(400, 'Provider must be "apify" or "treg".', 'credential_invalid');
      }
      if (typeof token !== 'string' || !token.trim()) {
        return error(400, 'A Scrape Credential token is required.', 'credential_invalid');
      }

      try {
        const saved = await saveCredential(
          ctx.env,
          createDb(ctx.env.DB),
          user.id,
          provider,
          token
        );
        return json(saved);
      } catch (err) {
        if (err instanceof CredentialError) {
          return error(err.status, err.message, err.code);
        }
        throw err;
      }
    },
  },
  {
    method: 'DELETE',
    path: '/api/account/credentials',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      await clearCredential(createDb(ctx.env.DB), user.id);
      return json({ provider: null, configured: false, validatedAt: null });
    },
  },
];

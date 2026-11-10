import { eq } from 'drizzle-orm';
import { appSettings, userRoles, users } from '../../db/schema';
import { createUser, getUserRole, hashPassword } from '../auth';
import { createDb } from '../db';
import { error, json, parseJsonBody, requireAdmin, requireUser, text, type Route } from '../http';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

type Role = 'admin' | 'user';

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'user';
}

function readRole(value: unknown): Role | null | undefined {
  if (value === undefined) return undefined;
  return isRole(value) ? value : null;
}

export const adminRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/admin/me',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;
      const role = await getUserRole(createDb(ctx.env.DB), user.id);
      return json({ user_id: user.id, role, isAdmin: role === 'admin' });
    },
  },
  {
    method: 'GET',
    path: '/api/admin/toggles',
    handler: async (ctx) => {
      const db = createDb(ctx.env.DB);
      const [settings] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 'global'))
        .limit(1);
      return json({
        registration_open: settings?.registrationOpen ?? true,
        google_oauth_open: settings?.googleOauthOpen ?? true,
      });
    },
  },
  {
    method: 'POST',
    path: '/api/admin/toggles',
    handler: async (ctx) => {
      const admin = await requireAdmin(ctx);
      if (admin instanceof Response) return admin;

      const body = await parseJsonBody(ctx.request);
      const registration = body.registration_open;
      const google = body.google_oauth_open;
      if (typeof registration !== 'boolean' && typeof google !== 'boolean') {
        return error(400, 'Provide registration_open or google_oauth_open as a boolean');
      }

      const db = createDb(ctx.env.DB);
      const [current] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 'global'))
        .limit(1);

      const next = {
        registrationOpen:
          typeof registration === 'boolean'
            ? registration
            : (current?.registrationOpen ?? true),
        googleOauthOpen: typeof google === 'boolean' ? google : (current?.googleOauthOpen ?? true),
        updatedAt: new Date().toISOString(),
      };

      await db
        .insert(appSettings)
        .values({ id: 'global', ...next })
        .onConflictDoUpdate({ target: appSettings.id, set: next });

      return text('OK');
    },
  },
  {
    method: 'GET',
    path: '/api/admin/users',
    handler: async (ctx) => {
      const admin = await requireAdmin(ctx);
      if (admin instanceof Response) return admin;

      const db = createDb(ctx.env.DB);
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          role: userRoles.role,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
          ciphertext: users.scrapeCredentialCiphertext,
          iv: users.scrapeCredentialIv,
          activeProvider: users.activeProvider,
        })
        .from(users)
        .leftJoin(userRoles, eq(userRoles.userId, users.id))
        .orderBy(users.createdAt, users.id);

      return json(
        rows.map((row) => ({
          user_id: row.id,
          email: row.email,
          full_name: row.fullName ?? null,
          role: row.role ?? 'user',
          created_at: row.createdAt,
          last_login_at: row.lastLoginAt ?? null,
          has_credential: Boolean(row.ciphertext && row.iv),
          active_provider: row.activeProvider ?? null,
        }))
      );
    },
  },
  {
    method: 'POST',
    path: '/api/admin/create-user',
    handler: async (ctx) => {
      const admin = await requireAdmin(ctx);
      if (admin instanceof Response) return admin;

      const body = await parseJsonBody(ctx.request);
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined;
      const role = readRole(body.role);

      if (!email || !password) return error(400, 'Email and password are required');
      if (!EMAIL_PATTERN.test(email)) return error(400, 'Invalid email format');
      if (password.length < MIN_PASSWORD_LENGTH) {
        return error(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      if (role === null) return error(400, "Role must be 'admin' or 'user'");

      const db = createDb(ctx.env.DB);
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) return error(400, 'User with this email already exists');

      const user = await createUser(db, {
        email,
        password,
        fullName,
        role: role ?? 'user',
      });
      return json({ user_id: user.id, email: user.email, role: role ?? 'user' });
    },
  },
  {
    method: 'PATCH',
    path: '/api/admin/users',
    handler: async (ctx) => {
      const admin = await requireAdmin(ctx);
      if (admin instanceof Response) return admin;

      const body = await parseJsonBody(ctx.request);
      const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
      const password = typeof body.password === 'string' ? body.password : undefined;
      const role = readRole(body.role);

      if (!userId) return error(400, 'user_id is required');
      if (role === null) return error(400, "Role must be 'admin' or 'user'");
      if (!password && role === undefined) return error(400, 'Provide password or role');
      if (password !== undefined && password.length < MIN_PASSWORD_LENGTH) {
        return error(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }

      const db = createDb(ctx.env.DB);
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!target) return error(404, 'User not found');

      if (password !== undefined && role !== undefined) {
        await db.batch([
          db
            .update(users)
            .set({
              passwordHash: await hashPassword(password),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId)),
          db
            .insert(userRoles)
            .values({ userId, role })
            .onConflictDoUpdate({ target: userRoles.userId, set: { role } }),
        ]);
      } else if (password !== undefined) {
        await db.batch([
          db
            .update(users)
            .set({
              passwordHash: await hashPassword(password),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId)),
        ]);
      } else if (role !== undefined) {
        await db.batch([
          db
            .insert(userRoles)
            .values({ userId, role })
            .onConflictDoUpdate({ target: userRoles.userId, set: { role } }),
        ]);
      }

      return json({ message: 'User updated' });
    },
  },
  {
    method: 'DELETE',
    path: '/api/admin/users',
    handler: async (ctx) => {
      const admin = await requireAdmin(ctx);
      if (admin instanceof Response) return admin;

      const userId = ctx.url.searchParams.get('user_id')?.trim();
      if (!userId) return error(400, 'user_id is required');
      if (userId === admin.id) return error(400, 'Cannot delete your own account');

      const db = createDb(ctx.env.DB);
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!target) return error(404, 'User not found');

      await db.delete(users).where(eq(users.id, userId));
      return json({ message: 'User deleted' });
    },
  },
];

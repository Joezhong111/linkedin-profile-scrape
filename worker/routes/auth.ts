import { eq } from 'drizzle-orm';
import { appSettings, users } from '../../db/schema';
import { signInSchema } from '../../lib/validation';
import {
  createSession,
  createUser,
  deleteSession,
  updateLastLogin,
  verifyPassword,
} from '../auth';
import { createDb, type AppDb } from '../db';
import {
  error,
  extractToken,
  json,
  parseJsonBody,
  requireUser,
  type Route,
} from '../http';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user: { id: string; email: string; fullName?: string | null }) {
  return { id: user.id, email: user.email, fullName: user.fullName ?? null };
}

async function isRegistrationOpen(db: AppDb): Promise<boolean> {
  const [settings] = await db.select().from(appSettings).limit(1);
  return settings?.registrationOpen ?? true;
}

export const authRoutes: Route[] = [
  {
    method: 'POST',
    path: '/api/auth/signup',
    handler: async (ctx) => {
      const db = createDb(ctx.env.DB);
      if (!(await isRegistrationOpen(db))) {
        return error(403, 'Registration is currently closed');
      }

      const body = await parseJsonBody(ctx.request);
      const email = String(body.email ?? '').trim();
      const password = typeof body.password === 'string' ? body.password : '';
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined;

      if (!email || !password) return error(400, 'Email and password are required');
      if (!EMAIL_PATTERN.test(email)) return error(400, 'Invalid email format');
      if (password.length < 6) return error(400, 'Password must be at least 6 characters');

      const normalizedEmail = email.toLowerCase();
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      if (existing) return error(400, 'User with this email already exists');

      const user = await createUser(db, { email: normalizedEmail, password, fullName });
      const session = await createSession(db, user.id);
      return json({
        user: publicUser(user),
        token: session.token,
        expiresAt: session.expiresAt,
      });
    },
  },
  {
    method: 'POST',
    path: '/api/auth/signin',
    handler: async (ctx) => {
      const body = await parseJsonBody(ctx.request);
      const parsed = signInSchema.safeParse(body);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return error(400, message);
      }

      const db = createDb(ctx.env.DB);
      const email = parsed.data.email.toLowerCase().trim();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) return error(401, 'Invalid email or password');
      if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
        return error(401, 'Invalid email or password');
      }

      const session = await createSession(db, user.id);
      await updateLastLogin(db, user.id);
      return json({
        user: publicUser(user),
        token: session.token,
        expiresAt: session.expiresAt,
      });
    },
  },
  {
    method: 'POST',
    path: '/api/auth/signout',
    handler: async (ctx) => {
      const token = extractToken(ctx.request);
      if (token) await deleteSession(createDb(ctx.env.DB), token);
      return json({ success: true });
    },
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;
      return json({ user: publicUser(user) });
    },
  },
];

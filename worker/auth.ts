import { eq } from 'drizzle-orm';
import { sessions, userRoles, users, type User } from '../db/schema';
import type { AppDb } from './db';

const PBKDF2_ITERATIONS = 10_000;
const PBKDF2_BITS = 512;
const SALT_BYTES = 16;
const SESSION_BYTES = 32;
const SESSION_TTL_DAYS = 30;
const PASSWORD_HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{128}$/;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function equalInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveHash(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  // Stored salts are the 32-character hex string itself, encoded as UTF-8.
  // The legacy fixed test vector pins this exact interpretation.
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    key,
    PBKDF2_BITS
  );
  return toHex(new Uint8Array(bits));
}

/** Hashes a password into the `salt:hash` hex format used by legacy rows. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(SALT_BYTES);
  const hash = await deriveHash(password, salt);
  return `${salt}:${hash}`;
}

/** Rejects malformed stored hashes and compares the derived hash in constant time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof stored !== 'string' || !PASSWORD_HASH_PATTERN.test(stored)) return false;
  const [salt, expected] = stored.split(':') as [string, string];
  const actual = await deriveHash(password, salt);
  return equalInConstantTime(actual, expected);
}

/** Opaque Session Token: 32 random bytes as lowercase hex. */
export function newSessionToken(): string {
  return randomHex(SESSION_BYTES);
}

export interface CreatedSession {
  token: string;
  expiresAt: string;
}

export async function createSession(db: AppDb, userId: string): Promise<CreatedSession> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(sessions).values({ userId, token, expiresAt });
  return { token, expiresAt };
}

/** Resolves an unexpired Session Token to its User, or `null`. */
export async function verifyToken(db: AppDb, token: string): Promise<User | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);
  if (!row) return null;
  if (Date.parse(row.expiresAt) <= Date.now()) return null;
  return row.user;
}

export async function deleteSession(db: AppDb, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName?: string | null;
  role?: 'admin' | 'user';
}

/**
 * Creates the User and its role row atomically. `db.batch()` is D1's only
 * transaction-like primitive; the id is pre-generated so both statements share it.
 */
export async function createUser(db: AppDb, input: CreateUserInput): Promise<User> {
  const email = input.email.toLowerCase().trim();
  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID();

  await db.batch([
    db.insert(users).values({
      id,
      email,
      passwordHash,
      fullName: input.fullName ?? null,
      emailVerified: false,
    }),
    db.insert(userRoles).values({ userId: id, role: input.role ?? 'user' }),
  ]);

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new Error('User insert returned no row');
  return user;
}

export async function getUserRole(db: AppDb, userId: string): Promise<'admin' | 'user'> {
  const [row] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);
  return row?.role ?? 'user';
}

export async function updateLastLogin(db: AppDb, userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, userId));
}

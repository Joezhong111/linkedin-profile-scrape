import { eq } from 'drizzle-orm';
import { users, type User } from '../db/schema';
import type { AppDb } from './db';
import { error } from './http';

/**
 * Scrape Credential storage: one Active Provider and one encrypted credential
 * per User. The plaintext token is only ever decrypted in memory for a provider
 * call; every API response and log line sees the status shape below.
 */

export type ProviderId = 'apify' | 'treg';

export interface CredentialStatus {
  provider: ProviderId | null;
  configured: boolean;
  validatedAt: string | null;
}

export interface SavedCredential extends CredentialStatus {
  warning?: string;
}

export interface ResolvedCredential {
  provider: ProviderId;
  token: string;
}

/** A credential failure that routes translate into an error response. */
export class CredentialError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'CredentialError';
    this.status = status;
    this.code = code;
  }
}

const APIFY_ME_URL = 'https://api.apify.com/v2/users/me';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TREG_TOKEN_PATTERN = /^[A-Za-z0-9._-]{8,}$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isProviderId(value: unknown): value is ProviderId {
  return value === 'apify' || value === 'treg';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importEncryptionKey(env: Env): Promise<CryptoKey> {
  const raw = env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new CredentialError(500, 'Credential encryption is not configured on the server.');
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(raw);
  } catch {
    throw new CredentialError(500, 'Credential encryption is misconfigured on the server.');
  }
  if (keyBytes.length !== KEY_BYTES) {
    throw new CredentialError(500, 'Credential encryption is misconfigured on the server.');
  }

  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** AES-GCM-256 encrypts the token with a fresh random 12-byte IV. */
export async function encryptCredential(
  env: Env,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

/** Decrypts a stored credential; any failure is an unreadable credential. */
export async function decryptCredential(
  env: Env,
  ciphertext: string,
  iv: string
): Promise<string> {
  try {
    const key = await importEncryptionKey(env);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) },
      key,
      base64ToBytes(ciphertext)
    );
    return decoder.decode(decrypted);
  } catch {
    throw new CredentialError(
      400,
      'The saved Scrape Credential could not be decrypted. Re-enter it in Settings.',
      'credential_unreadable'
    );
  }
}

/** The only credential shape that leaves the Worker. */
export async function getCredentialStatus(
  _db: AppDb,
  user: User
): Promise<CredentialStatus> {
  return {
    provider: user.activeProvider ?? null,
    configured: Boolean(user.scrapeCredentialCiphertext && user.scrapeCredentialIv),
    validatedAt: user.scrapeCredentialValidatedAt ?? null,
  };
}

interface ApifyMeResponse {
  data?: {
    plan?: { id?: string } | string;
  };
}

async function validateApifyToken(token: string): Promise<string | undefined> {
  let response: Response;
  try {
    response = await fetch(APIFY_ME_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new CredentialError(
      502,
      'Could not reach Apify to validate this token. Try again later.'
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new CredentialError(
      400,
      'Apify rejected this token. Check the token in your Apify account and try again.',
      'credential_invalid'
    );
  }
  if (!response.ok) {
    throw new CredentialError(
      502,
      `Apify could not validate this token (HTTP ${response.status}). Try again later.`
    );
  }

  let planId: string | undefined;
  try {
    const body = (await response.json()) as ApifyMeResponse;
    const plan = body?.data?.plan;
    planId = typeof plan === 'string' ? plan : plan?.id;
  } catch {
    // A 2xx without a JSON body still proves the token is accepted.
  }

  if (!planId || planId.toLowerCase() === 'free') {
    return 'This Apify token works, but Apify requires a paid plan to run actors through the API. Scraping will fail until the plan is upgraded.';
  }
  return undefined;
}

/**
 * Validates and stores one credential, replacing any previous provider and
 * ciphertext in a single row update. Apify is validated against its API before
 * save; treg only receives a format check and is validated by the first scrape.
 */
export async function saveCredential(
  env: Env,
  db: AppDb,
  userId: string,
  provider: ProviderId,
  token: string
): Promise<SavedCredential> {
  if (!isProviderId(provider)) {
    throw new CredentialError(400, 'Provider must be "apify" or "treg".', 'credential_invalid');
  }

  const trimmed = token.trim();
  if (!trimmed) {
    throw new CredentialError(400, 'A Scrape Credential token is required.', 'credential_invalid');
  }

  let warning: string | undefined;
  let validatedAt: string | null = null;

  if (provider === 'apify') {
    warning = await validateApifyToken(trimmed);
    validatedAt = new Date().toISOString();
  } else if (!TREG_TOKEN_PATTERN.test(trimmed)) {
    throw new CredentialError(
      400,
      'That does not look like a valid treg token. Tokens contain only letters, numbers, dots, underscores, and hyphens.',
      'credential_invalid'
    );
  }

  const { ciphertext, iv } = await encryptCredential(env, trimmed);
  await db
    .update(users)
    .set({
      activeProvider: provider,
      scrapeCredentialCiphertext: ciphertext,
      scrapeCredentialIv: iv,
      scrapeCredentialValidatedAt: validatedAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  return {
    provider,
    configured: true,
    validatedAt,
    ...(warning ? { warning } : {}),
  };
}

/** Removes the credential and the Active Provider, disabling scraping. */
export async function clearCredential(db: AppDb, userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      activeProvider: null,
      scrapeCredentialCiphertext: null,
      scrapeCredentialIv: null,
      scrapeCredentialValidatedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));
}

/** Resolves the plaintext credential for a provider call, or a 400 response. */
export async function getProviderToken(
  env: Env,
  _db: AppDb,
  user: User
): Promise<ResolvedCredential | Response> {
  const provider = user.activeProvider;
  if (!provider || !user.scrapeCredentialCiphertext || !user.scrapeCredentialIv) {
    return error(
      400,
      'No Scrape Credential is configured. Add one in Settings.',
      'credential_missing'
    );
  }

  try {
    const token = await decryptCredential(
      env,
      user.scrapeCredentialCiphertext,
      user.scrapeCredentialIv
    );
    return { provider, token };
  } catch (err) {
    if (err instanceof CredentialError) {
      return error(err.status, err.message, err.code);
    }
    return error(
      400,
      'The saved Scrape Credential could not be decrypted. Re-enter it in Settings.',
      'credential_unreadable'
    );
  }
}

/**
 * Maps a provider HTTP status to an actionable credential error response.
 * Providers call this after a non-2xx reply; `null` means "not a credential
 * failure" and the caller should surface a 502.
 */
export function providerCredentialError(status: number): Response | null {
  if (status !== 401 && status !== 403) return null;
  return error(
    400,
    'The provider rejected your saved Scrape Credential. Update it in Settings.',
    'credential_invalid'
  );
}

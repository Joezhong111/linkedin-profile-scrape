import { authClient } from '../lib/auth';
import { readApiError } from './http';

export type ProviderId = 'apify' | 'treg';

export interface CredentialStatus {
  provider: ProviderId | null;
  configured: boolean;
  validatedAt: string | null;
}

export interface SavedCredential extends CredentialStatus {
  warning?: string;
}

/** Fired after a credential is saved or cleared so app chrome can refresh. */
export const CREDENTIALS_CHANGED_EVENT = 'credentials_changed';

function notifyChanged() {
  try {
    window.dispatchEvent(new Event(CREDENTIALS_CHANGED_EVENT));
  } catch {
    // A missing window (tests, SSR) must not break the call.
  }
}

export async function getCredentialStatus(): Promise<CredentialStatus> {
  const response = await fetch('/api/account/credentials', {
    headers: authClient.getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to load credential status'));
  }
  return (await response.json()) as CredentialStatus;
}

export async function saveCredential(
  provider: ProviderId,
  token: string
): Promise<SavedCredential> {
  const response = await fetch('/api/account/credentials', {
    method: 'PUT',
    headers: authClient.getAuthHeaders(),
    body: JSON.stringify({ provider, token }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to save credential'));
  }
  const saved = (await response.json()) as SavedCredential;
  notifyChanged();
  return saved;
}

export async function clearCredential(): Promise<CredentialStatus> {
  const response = await fetch('/api/account/credentials', {
    method: 'DELETE',
    headers: authClient.getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to clear credential'));
  }
  const cleared = (await response.json()) as CredentialStatus;
  notifyChanged();
  return cleared;
}

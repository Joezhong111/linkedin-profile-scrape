/**
 * Shared client-side API error reader.
 *
 * Prefers a JSON `{ error }` body and falls back to the response text so both
 * Workers JSON errors and plain-text failures surface actionable messages.
 */
export async function readApiError(res: Response): Promise<string> {
  const fallback = await res.text();
  try {
    const parsed = JSON.parse(fallback) as { error?: unknown };
    if (parsed && typeof parsed.error === 'string' && parsed.error) return parsed.error;
  } catch {
    // Body is not JSON; use it verbatim below.
  }
  return fallback || `Request failed with status ${res.status}`;
}

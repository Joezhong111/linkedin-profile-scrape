/**
 * Reads a failed API response as a human-readable message. Prefers the JSON
 * `{ error }` contract and falls back to the raw body.
 */
export async function readApiError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (parsed && typeof parsed.error === 'string' && parsed.error) return parsed.error;
  } catch {
    // Not a JSON body; use the text as-is.
  }
  return body || `Request failed (${res.status})`;
}

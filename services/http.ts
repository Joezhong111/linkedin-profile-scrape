/**
 * Reads an API error body for the SPA.
 *
 * Prefers a JSON `{ error }` payload and falls back to the raw response text.
 */
export async function readApiError(res: Response, fallback?: string): Promise<string> {
  const defaultMessage = fallback ?? `Request failed (${res.status})`;
  let body = '';
  try {
    body = await res.text();
  } catch {
    return defaultMessage;
  }

  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed !== null && typeof parsed === 'object' && 'error' in parsed) {
        const value = parsed.error;
        if (typeof value === 'string') {
          const message = value.trim();
          if (message) return message;
        }
      }
    } catch {
      // Not JSON; use the text body below.
    }
    const trimmed = body.trim();
    if (trimmed) return trimmed;
  }

  return defaultMessage;
}

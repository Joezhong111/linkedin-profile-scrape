/**
 * Reads an API error message, preferring the JSON `{ error }` body the Worker
 * returns and falling back to plain text for non-JSON failures.
 */
export async function readApiError(
  response: Response,
  fallback = 'Request failed'
): Promise<string> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall through to the text body.
    }
  }

  try {
    const text = await response.text();
    if (text.trim()) return text;
  } catch {
    // Ignore unreadable bodies and use the fallback.
  }

  return fallback;
}

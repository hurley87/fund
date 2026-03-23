const TRANSIENT_FETCH_ERROR =
  /fetch failed|UND_ERR_SOCKET|ECONNRESET|ETIMEDOUT|other side closed|socket hang up/i;

function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const combined = `${err.message}\n${err.cause ?? ''}`;
  return TRANSIENT_FETCH_ERROR.test(combined);
}

/**
 * Wraps global fetch with a few retries on transient TLS/socket failures
 * (common with Supabase/PostgREST from Node undici).
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts || !isTransientFetchError(e)) {
        throw e;
      }
      const delayMs = 150 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

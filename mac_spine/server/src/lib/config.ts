/**
 * Cloudflare Worker environment bindings.
 * Secrets are set via `wrangler secret put` or the Cloudflare dashboard.
 */
export interface Env {
  REDCAP_API_URL: string;
  REDCAP_API_TOKEN: string;
  ALLOWED_ORIGIN: string;
  /** Service binding to mock-redcap worker (optional, for testing). */
  MOCK_REDCAP?: Fetcher;
}

/**
 * Fetch wrapper that uses the MOCK_REDCAP service binding when available
 * (avoids Cloudflare error 1042: Worker-to-Worker fetch on same account).
 * Falls through to global fetch for real REDCap.
 */
export function redcapFetch(env: Env, url: string, init: RequestInit): Promise<Response> {
  if (env.MOCK_REDCAP) {
    // Service binding requires a full URL; use a dummy origin with the real path
    const parsed = new URL(url);
    return env.MOCK_REDCAP.fetch(new Request(`https://mock${parsed.pathname}${parsed.search}`, init));
  }
  return fetch(url, init);
}

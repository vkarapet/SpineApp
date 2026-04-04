/**
 * Cloudflare Worker environment bindings.
 * Secrets are set via `wrangler secret put` or the Cloudflare dashboard.
 */
export interface Env {
  REDCAP_API_URL: string;
  REDCAP_API_TOKEN: string;
  ALLOWED_ORIGIN: string;
}

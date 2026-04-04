import type { Env } from '../lib/config';

export async function handleHealth(
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  let redcapReachable = false;

  try {
    const params = new URLSearchParams({
      token: env.REDCAP_API_TOKEN,
      content: 'version',
      format: 'json',
    });

    const response = await fetch(env.REDCAP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(5000),
    });

    redcapReachable = response.ok;
  } catch {
    redcapReachable = false;
  }

  return Response.json(
    {
      status: redcapReachable ? 'ok' : 'degraded',
      redcap_reachable: redcapReachable,
      timestamp: new Date().toISOString(),
    },
    { status: redcapReachable ? 200 : 503, headers: corsHeaders },
  );
}

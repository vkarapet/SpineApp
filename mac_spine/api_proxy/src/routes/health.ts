import { redcapFetch } from '../lib/config';
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

    const response = await redcapFetch(env, env.REDCAP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
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

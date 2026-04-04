import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { loadConfig } from '../lib/config.js';

async function healthHandler(
  _request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const config = loadConfig();
  let redcapReachable = false;

  try {
    // Lightweight call: export the API version
    const params = new URLSearchParams({
      token: config.redcapApiToken,
      content: 'version',
      format: 'json',
    });

    const response = await fetch(config.redcapApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(5000),
    });

    redcapReachable = response.ok;
  } catch {
    redcapReachable = false;
  }

  return {
    status: redcapReachable ? 200 : 503,
    jsonBody: {
      status: redcapReachable ? 'ok' : 'degraded',
      redcap_reachable: redcapReachable,
      timestamp: new Date().toISOString(),
    },
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
});

import type { Env } from './lib/config';
import { handleProxy } from './routes/proxy';
import { handleHealth } from './routes/health';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Request-Signature',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check — no origin restriction (used for monitoring)
    if (url.pathname === '/health' && request.method === 'GET') {
      return handleHealth(env, corsHeaders);
    }

    // All other routes require the allowed origin
    if (origin !== env.ALLOWED_ORIGIN) {
      return Response.json(
        { success: false, error_code: 'CORS_REJECTED', message: 'Origin not allowed' },
        { status: 403 },
      );
    }

    if (url.pathname === '/proxy' && request.method === 'POST') {
      return handleProxy(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

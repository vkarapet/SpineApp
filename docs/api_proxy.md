# MAC Spine API Proxy — Implementation Plan

## Overview

A standalone Cloudflare Worker that:

1. Accepts sync requests from the PWA at `POST /proxy`
2. Validates and authenticates each request
3. Injects the REDCap API token (server-side secret)
4. Forwards the request to the REDCap API
5. Returns REDCap's response to the PWA

The PWA is deployed separately on GitHub Pages (existing pipeline). The Worker handles only the API proxy. Since they are on different origins, the Worker includes CORS headers locked to the GitHub Pages origin.

The Worker has no database, no session state, and no user accounts. It is a stateless pass-through with authentication and validation.

```
┌─────────────────────┐        HTTPS          ┌──────────────────────┐        HTTPS        ┌──────────┐
│        PWA          │ ───────────────────>   │  Cloudflare Worker   │ ─────────────────>  │  REDCap  │
│ (GitHub Pages)      │  POST /proxy           │  mac-spine-proxy.*. │  importRecords      │   API    │
│                     │ <───────────────────   │  workers.dev         │ <─────────────────  │          │
└─────────────────────┘   { success: true }    └──────────────────────┘   REDCap response   └──────────┘
```

---

## Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | Cloudflare Workers (V8 isolates) | Serverless, no server to manage |
| Language | TypeScript | Consistent with PWA codebase |
| HTTP | Web API `fetch()` | Built-in to Workers runtime (no node-fetch) |
| HTTPS | Automatic (Cloudflare) | TLS handled at the edge, no Nginx needed |
| Rate limiting | Cloudflare dashboard rules | Built-in, no extra library |
| Secrets | Cloudflare encrypted secrets | Stored at rest, never visible after entry |

### Dependencies (minimal)

```
@cloudflare/workers-types — TypeScript types for the Workers runtime
wrangler                  — Cloudflare CLI (deploy + secret management)
```

No Express, no Helmet, no session library. CORS and security headers are written directly.

---

## Directory Structure

```
mac_spine/
├── worker/
│   ├── src/
│   │   ├── index.ts              — Entry point: route dispatch, CORS preflight
│   │   ├── routes/
│   │   │   ├── proxy.ts          — POST /proxy handler
│   │   │   └── health.ts         — GET /health handler
│   │   ├── middleware/
│   │   │   ├── validate-hmac.ts  — HMAC signature + timestamp verification
│   │   │   └── validate-body.ts  — Payload schema validation per action
│   │   ├── services/
│   │   │   └── redcap.ts         — REDCap API client (importRecords, exportRecords)
│   │   └── config.ts             — Env type declaration + validation
│   ├── tsconfig.json
│   ├── wrangler.toml             — Worker name, routes, compatibility date
│   └── package.json
└── src/                          — PWA source (unchanged, deployed via GitHub Pages)
```

Total estimated size: ~150–250 lines of application code.

---

## Environment Variables (Cloudflare Secrets)

```env
# Required — stored as encrypted Cloudflare secrets (never in source code)
REDCAP_API_URL=https://redcap.institution.org/api/
REDCAP_API_TOKEN=<64-char hex token>
ALLOWED_ORIGIN=https://<github-username>.github.io

# Optional
STUDY_SALT=<salt for record_id verification, if identity verification is enabled>
```

Secrets are set via the Cloudflare dashboard or Wrangler CLI and are **never** in source code, **never** sent to the client, and **never** logged.

---

## CORS

Because the PWA (GitHub Pages) and the Worker are on different origins, every response must include:

```
Access-Control-Allow-Origin: https://<github-username>.github.io
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Request-Signature, X-Request-Timestamp
```

The Worker also handles `OPTIONS` preflight requests, which browsers send automatically before cross-origin `POST` requests.

The `ALLOWED_ORIGIN` secret is the single source of truth — no wildcards, no other origins permitted.

---

## PWA Changes Required

### 1. Update `PROXY_URL` to point at the Worker

```typescript
// src/constants.ts — change from relative to absolute
export const PROXY_URL = 'https://mac-spine-proxy.<account>.workers.dev/proxy';
// or custom domain: 'https://api.mac-spine.institution.org/proxy'
```

### 2. Keep the mock proxy for development / GitHub Pages demo

The service worker mock intercept at `/api/proxy` continues to work for offline demo and development. It is unaffected by the new Worker URL since the real requests go to a different domain.

No build-time flag is needed — the mock intercepts the old relative path, the real sync uses the absolute Worker URL.

---

## Request Pipeline

Every `POST /proxy` goes through this sequence:

```
1. CORS preflight check  → OPTIONS → return 204 with CORS headers
2. Origin check          → reject if Origin ≠ ALLOWED_ORIGIN (403)
3. Body size limit        → reject if > 1 MB (413)
4. Parse JSON body        → reject if malformed (400)
5. Validate structure     → require: action (string), record_id (string) (400)
6. HMAC verification      → verify X-Request-Signature matches (403)
7. Action whitelist       → only upload_data (400)
8. Payload validation     → schema check per action type (422)
9. Deduplication          → for upload_data: check local_uuid against REDCap (skip if exists)
10. REDCap forwarding     → inject token, POST to REDCap API
11. Response parsing      → check for REDCap errors even on HTTP 200
12. Logging               → Cloudflare Workers built-in logging (no sensitive data)
13. Return response       → { success: true/false, error?: string }
```

### HMAC Verification Detail

The PWA currently signs requests as:

```
signatureInput = action + record_id
signatureKey   = record_id
signature      = HMAC-SHA256(signatureKey, signatureInput)
```

The Worker recomputes the same HMAC and compares using `crypto.subtle` (Web Crypto API, built into Workers).

> **Note:** Using `record_id` as the HMAC key means anyone with a participant's record_id can forge requests. For production, consider deriving the key from a shared secret: `HMAC-SHA256(SERVER_SECRET, record_id)`. This is a future hardening step, not a launch blocker.

---

## REDCap Integration

### Field Mapping

Each module defines a `redcap.fieldMap` that maps local data keys to REDCap field names. The Worker uses these mappings to transform the payload before calling `importRecords`.

### REDCap API Calls

**Upload (importRecords):**
```
POST REDCAP_API_URL
Content-Type: application/x-www-form-urlencoded

token=<REDCAP_API_TOKEN>
content=record
format=json
type=flat
overwriteBehavior=normal
data=[{
  "record_id": "abc123...",
  "redcap_repeat_instrument": "tapping_task",
  "redcap_repeat_instance": "new",
  "local_uuid": "...",
  "tap_speed": 5.2,
  ...
}]
```

**Deduplication:**
Before importing, query REDCap for existing records with the same `local_uuid`. If found, skip the import and return success. This makes retries idempotent.

---

## Health Check

`GET /health` — used for monitoring and deployment verification.

```json
{
  "status": "ok",
  "redcap_reachable": true,
  "timestamp": "2026-03-10T12:00:00Z"
}
```

---

## Worker Entry Point (sketch)

```typescript
// worker/src/index.ts
export interface Env {
  REDCAP_API_URL: string;
  REDCAP_API_TOKEN: string;
  ALLOWED_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Request-Signature, X-Request-Timestamp',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Lock to allowed origin
    if (origin !== env.ALLOWED_ORIGIN) {
      return new Response('Forbidden', { status: 403 });
    }

    const url = new URL(request.url);

    if (url.pathname === '/proxy' && request.method === 'POST') {
      return handleProxy(request, env, corsHeaders);
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return handleHealth(env, corsHeaders);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

---

## wrangler.toml

```toml
name = "mac-spine-proxy"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
# Non-secret config can go here; secrets are set via dashboard/CLI
```

---

## Deployment

### 1. Install Wrangler and authenticate

```bash
npm install -g wrangler
wrangler login
```

### 2. Store secrets

```bash
wrangler secret put REDCAP_API_TOKEN   # paste token when prompted
wrangler secret put REDCAP_API_URL
wrangler secret put ALLOWED_ORIGIN     # e.g. https://myorg.github.io
```

Or via **Cloudflare Dashboard → Workers → mac-spine-proxy → Settings → Variables → Add secret**.

### 3. Deploy

```bash
# From mac_spine/worker/
npx wrangler deploy
# → https://mac-spine-proxy.<account>.workers.dev
```

### 4. (Optional) Custom domain

In the Cloudflare dashboard: **Workers → mac-spine-proxy → Triggers → Add Custom Domain** (e.g. `api.mac-spine.institution.org`). TLS is provisioned automatically.

### 5. Update `PROXY_URL` in the PWA

```typescript
// mac_spine/src/constants.ts
export const PROXY_URL = 'https://mmat-proxy.<account>.workers.dev/proxy';
```

Push to GitHub — existing CI/CD deploys the updated PWA to GitHub Pages automatically.

---

## Security Checklist

| Measure | Implementation |
|---------|---------------|
| HTTPS only | Cloudflare automatic TLS |
| CORS locked | `ALLOWED_ORIGIN` secret, no wildcards |
| API token secret | Cloudflare encrypted secret, never in code or logs |
| Request authentication | HMAC-SHA256 via Web Crypto API |
| Rate limiting | Cloudflare dashboard rate limiting rules |
| Payload size limit | Check `Content-Length` / read limit in Worker |
| Input validation | Action whitelist, schema checks, type validation |
| Security headers | Added manually in responses |
| Deduplication | local_uuid check prevents duplicate REDCap entries |
| No direct REDCap access | Client never sees REDCap URL or token |

---

## Implementation Order

1. **Scaffold** — `worker/` directory, `package.json`, `tsconfig.json`, `wrangler.toml`
2. **Entry point** — route dispatch, CORS preflight, origin check
3. **Health endpoint** — `GET /health`
4. **Proxy route** — `POST /proxy` with body parsing + action routing
5. **HMAC middleware** — Signature + timestamp verification (Web Crypto API)
6. **REDCap client** — `importRecords` call with token injection
7. **Payload validation** — Schema checks per action type
8. **Deduplication** — local_uuid lookup before import
9. **Secrets** — Store via Wrangler CLI or dashboard
10. **Deploy** — `wrangler deploy`, verify health endpoint
11. **PWA update** — Update `PROXY_URL` in `constants.ts`, push to GitHub
12. **(Optional) Custom domain** — Cloudflare dashboard

---

## Development / Testing

```bash
# Local dev (Wrangler runs a local Worker emulator)
cd mac_spine/worker
npx wrangler dev

# Worker runs at http://localhost:8787
# Test health: curl http://localhost:8787/health
# Test proxy: curl -X POST http://localhost:8787/proxy -H "Content-Type: application/json" -d '{...}'
```

For local dev, set a `.dev.vars` file (gitignored) with dummy values:

```env
REDCAP_API_URL=https://redcap.institution.org/api/
REDCAP_API_TOKEN=test_token
ALLOWED_ORIGIN=http://localhost:5173
```

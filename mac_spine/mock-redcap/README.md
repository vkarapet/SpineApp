# Mock REDCap API — Cloudflare Worker

Simulates the REDCap API endpoints used by `mac-spine-proxy` for end-to-end
testing without a real REDCap instance or API token.

## What it supports

| REDCap operation | content param | Behaviour |
|---|---|---|
| Version check | `content=version` | Returns `"14.7.0"` |
| Export records | `content=record` (no `data`) | Returns records from KV, filtered by `records`, `fields`, `forms` |
| Import records | `content=record` (with `data`) | Stores records in KV, auto-numbers `redcap_repeat_instance: "new"` |

Plus two admin endpoints not in real REDCap:

- `GET /admin/dump` — view all stored participants and records
- `POST /admin/reset` — clear all data, re-seed participants

## Setup

### 1. Create KV namespace

```bash
cd mock-redcap
npx wrangler kv namespace create RECORDS
```

Copy the returned `id` into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RECORDS"
id = "paste-id-here"
```

### 2. Set secrets

```bash
npx wrangler secret put MOCK_API_TOKEN
# Enter any token string — e.g. mock_token_12345

npx wrangler secret put SEED_PARTICIPANTS
# Enter comma-separated participant IDs — e.g. P001,P002,P003
```

For local dev, copy `.dev.vars.example` to `.dev.vars`.

### 3. Deploy

```bash
npm run deploy
```

Note the deployed URL (e.g. `https://mac-spine-mock-redcap.<your-subdomain>.workers.dev`).

### 4. Configure the proxy

Set the proxy worker's `REDCAP_API_URL` to point at the mock:

```bash
cd ../server
npx wrangler secret put REDCAP_API_URL
# Enter: https://mac-spine-mock-redcap.<your-subdomain>.workers.dev/api/

npx wrangler secret put REDCAP_API_TOKEN
# Enter the same MOCK_API_TOKEN value you set above
```

### 5. Local development

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

The mock runs at `http://localhost:8787/api/`.

## Testing with curl

```bash
# Health check (version)
curl -X POST http://localhost:8787/api/ \
  -d "token=mock_token_12345&content=version&format=json"

# Import a record
curl -X POST http://localhost:8787/api/ \
  -d 'token=mock_token_12345&content=record&format=json&type=flat&data=[{"record_id":"P001","redcap_repeat_instrument":"grip_task","redcap_repeat_instance":"new","grip_timestamp":"2025-01-15T14:30:00Z","grip_count":28}]'

# Export records
curl -X POST http://localhost:8787/api/ \
  -d "token=mock_token_12345&content=record&format=json&records=P001"

# Dump all data (admin)
curl http://localhost:8787/admin/dump

# Reset all data (admin)
curl -X POST http://localhost:8787/admin/reset
```

# MAC Spine API Proxy — Cloudflare Worker

Stateless Cloudflare Worker that receives assessment data from the MAC Spine PWA and forwards it to REDCap. The REDCap API token is injected server-side and never exposed to the client.

Currently deployed at: `https://mac-spine-proxy.macspine.workers.dev`

---

## Architecture

```
Phone (PWA)  --HTTPS-->  Cloudflare (mac-spine-proxy)  ---->  REDCap API
                                |
                          HMAC verified
                          Fields mapped
                          _complete flag injected
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) LTS
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)

---

## Setup

### 1. Install dependencies

```bash
cd mac_spine/api_proxy
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
npx wrangler whoami          # verify
```

### 3. Set secrets

Secrets are encrypted and stored by Cloudflare. You will be prompted to paste each value.

```bash
npx wrangler secret put REDCAP_API_URL      # e.g. https://redcap.institution.org/api/
npx wrangler secret put REDCAP_API_TOKEN    # 64-character hex token from REDCap
npx wrangler secret put ALLOWED_ORIGIN      # e.g. https://vkarapet.github.io
```

Secrets can also be set via **Cloudflare Dashboard -> Workers -> mac-spine-proxy -> Settings -> Variables**.

### 4. Deploy

```bash
npx wrangler deploy
```

Wrangler will print the live Worker URL:

```
https://mac-spine-proxy.macspine.workers.dev
```

### 5. Update the PWA

Set `PROXY_URL` in `mac_spine/src/constants.ts` to the Worker URL:

```typescript
export const PROXY_URL = 'https://mac-spine-proxy.macspine.workers.dev/proxy';
```

---

## Local Development

Copy the example vars file and fill in test values:

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars with your values
```

Start a local Worker emulator:

```bash
npx wrangler dev
```

The Worker runs at `http://localhost:8787`. Test endpoints:

```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/proxy \
  -H "Content-Type: application/json" \
  -H "X-Request-Signature: <hmac>" \
  -d '{"action":"upload_data","record_id":"...","payload":{...}}'
```

---

## Updating the Worker

Edit source files, then redeploy:

```bash
npx wrangler deploy
```

To update a secret:

```bash
npx wrangler secret put REDCAP_API_TOKEN    # paste new value when prompted
```

---

## Disabling / Deleting

**Disable:** Cloudflare Dashboard -> Workers -> mac-spine-proxy -> Disable toggle.

**Delete:**

```bash
npx wrangler delete
```

> **Note:** Deleting the Worker does not delete the secrets. If you redeploy later, re-run the `wrangler secret put` commands.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/proxy` | Upload assessment data to REDCap |
| `GET` | `/health` | Check Worker and REDCap connectivity |
| `OPTIONS` | `/proxy` | CORS preflight (handled automatically) |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry point, CORS, routing |
| `src/routes/proxy.ts` | Main upload handler: validate, HMAC, transform, import |
| `src/routes/health.ts` | Health check endpoint |
| `src/lib/config.ts` | Env interface, `redcapFetch()` wrapper |
| `src/lib/field-maps.ts` | REDCap field mappings per module, `transformRecord()` |
| `src/lib/redcap-client.ts` | REDCap API calls (verify, dedup, import) |
| `src/lib/validate-hmac.ts` | HMAC-SHA256 signature verification |

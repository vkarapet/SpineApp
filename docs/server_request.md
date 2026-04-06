# Server Request for MMAT Deployment

## What We're Doing

We have a web-based research application (MMAT) that participants will access from their phones via a browser. The app itself is a set of static files (HTML, CSS, JavaScript) that runs entirely in the browser — similar to a simple website. However, it also needs a small server-side component: a lightweight API endpoint that receives assessment data from the app, attaches a secure API token, and forwards it to REDCap for storage. This server-side piece is a single Node.js process that both serves the static website files and handles the data forwarding — there is no database on the server itself, no user accounts, and no persistent state. The server acts purely as a secure relay between the participant's phone and REDCap, so that the REDCap API token is never exposed to the browser.

## Questions for the Webmaster

1. Can we run a **Node.js process** (LTS version, currently v22) on the server, either directly or inside a Docker container? The process needs to listen on a port (e.g., 3000) and stay running persistently (via PM2, systemd, or Docker).
2. Is there an **Nginx or Apache reverse proxy** available to route incoming HTTPS traffic on a domain/subdomain (e.g., `mmat.institution.org`) to our Node.js process? If not, can one be configured?
3. Can we get a **TLS/SSL certificate** for the domain — either through the institution's existing certificate infrastructure or via Let's Encrypt? HTTPS is required for the app to function on phones.
4. Can we set **server-side environment variables** (or use a `.env` file in our project directory) that are readable by our Node.js process but not publicly accessible? We need to store a REDCap API token securely.
5. Does the server have **outbound HTTPS access** to the institution's REDCap server (e.g., `redcap.institution.org/api/`)? Are there firewall rules that would block server-to-server API calls?
6. Can we get **SSH or SFTP access** to the project directory so we can upload and update application files as needed? Alternatively, can we set up a deployment pipeline (e.g., pull from a Git repository)?
7. What is the **server's operating system**, and are there any restrictions on installing packages or running background processes?

---

## Alternative: Azure Function as API Proxy

If a dedicated server or VM is not available, the API proxy can be implemented as a single **Azure Function** — a serverless endpoint that runs only when called, with no persistent server to manage. This is a natural fit for institutions that already have Microsoft 365 / Azure infrastructure.

### Architecture

In this model, the app and the API proxy live on **separate hosts**:

- **App (PWA):** Hosted on GitHub Pages at `https://vkarapet.github.io/SpineApp/` (already live)
- **API Proxy:** A single Azure Function that acts as a secure relay to REDCap

```
┌─────────────┐       HTTPS POST        ┌──────────────────┐       HTTPS       ┌──────────┐
│     PWA     │ ──────────────────────>  │  Azure Function  │ ───────────────>  │  REDCap  │
│ (GitHub     │                          │  /api/proxy      │  importRecords   │   API    │
│  Pages)     │ <──────────────────────  │                  │ <───────────────  │          │
└─────────────┘   { success/error }      └──────────────────┘  REDCap response  └──────────┘
```

### What the Azure Function Does

The function exposes two HTTP endpoints:

- **`POST /api/proxy`** — the main data relay (pipeline below)
- **`GET /api/health`** — connectivity check (pings REDCap API version endpoint, returns `{ status, redcap_reachable, timestamp }`)

The proxy pipeline for `POST /api/proxy`:

```
 1. CORS check             → reject if origin ≠ https://vkarapet.github.io   (403 CORS_REJECTED)
 2. Parse JSON body         → reject if malformed                             (400 INVALID_JSON)
 3. Validate required fields→ require: action, record_id, X-Request-Signature (400 MISSING_FIELDS)
 4. HMAC verification       → timing-safe compare of X-Request-Signature      (403 HMAC_INVALID)
 5. Action whitelist        → only: upload_data                                (400 UNKNOWN_ACTION)
 6. Verify participant      → exportRecords for record_id existence            (404 PARTICIPANT_NOT_FOUND)
 7. Validate payload        → require: local_uuid, task_type, timestamp_start  (422 INVALID_PAYLOAD)
 8. Deduplication           → check if local_uuid already exists in REDCap     (skip if duplicate)
 9. Field mapping           → transform local payload to REDCap field names
10. Inject token + forward  → attach REDCap API token, call importRecords      (502 REDCAP_ERROR)
11. Parse REDCap response   → check for errors even on HTTP 200                (502 REDCAP_REJECTED)
12. Return success          → { success, synced_count, skipped_count }         (200)
```

Supports both **single-record** and **batch uploads** (up to 10 records per request via `payload.records` array). Each record is validated, dedup-checked, and imported individually.

Every failure exits early and returns a structured error to the app:

```json
{
  "success": false,
  "error_code": "PARTICIPANT_NOT_FOUND",
  "message": "Record ID not found in REDCap"
}
```

### HMAC Authentication

The PWA signs each request as:

```
signatureInput = action + record_id     (concatenated, no separator)
signatureKey   = record_id
signature      = HMAC-SHA256(key, input) → hex string
```

Sent in the `X-Request-Signature` header. The proxy recomputes and compares using a timing-safe comparison to prevent side-channel attacks.

### Field Mapping

Each assessment module (tapping, grip, TUG) has a field map that translates local payload keys to REDCap field names. The proxy transforms the payload before calling `importRecords`. For example, `computed_metrics.frequency_hz` becomes `tap_freq` for the tapping module. Each upload creates a new repeating instrument instance in REDCap (`redcap_repeat_instance: "new"`).

### Implementation

The Cloudflare Worker code is already written and lives in `mmat/api_proxy/`:

```
mmat/api_proxy/
├── host.json                       — Azure Functions runtime config
├── local.settings.json             — Environment variables (gitignored)
├── package.json                    — Dependencies (@azure/functions)
├── tsconfig.json
└── src/
    ├── functions/
    │   ├── proxy.ts                — POST /api/proxy handler (main pipeline)
    │   └── health.ts               — GET /api/health handler
    └── lib/
        ├── config.ts               — Loads env vars (REDCAP_API_URL, REDCAP_API_TOKEN, ALLOWED_ORIGIN)
        ├── validate-hmac.ts        — HMAC-SHA256 verification (timing-safe)
        ├── field-maps.ts           — REDCap field maps for all 3 modules + transform logic
        └── redcap-client.ts        — verifyParticipant, checkDuplicate, importRecord
```

### Building and Deploying

The source code is TypeScript and must be compiled to JavaScript before deployment.

**Build step** (run from `mmat/api_proxy/`):

```bash
npm install        # install dependencies (first time only)
npm run build      # compiles src/ → dist/
```

**Files to deploy to Azure:**

```
host.json               — Azure Functions runtime config (required)
package.json            — Dependency list (Azure runs npm install on deploy)
package-lock.json       — Locks dependency versions
dist/                   — Compiled JavaScript output (required)
├── functions/
│   ├── proxy.js        — POST /api/proxy handler
│   └── health.js       — GET /api/health handler
└── lib/
    ├── config.js       — Env var loading
    ├── validate-hmac.js— HMAC verification
    ├── field-maps.js   — REDCap field maps + transform
    └── redcap-client.js— REDCap API calls
```

**Not deployed** (development-only files):

- `src/` — TypeScript source (already compiled into `dist/`)
- `node_modules/` — Azure installs these automatically from `package.json`
- `local.settings.json` — local dev secrets; production secrets go in Azure portal
- `tsconfig.json` — used only during build
- `*.d.ts`, `*.js.map` — type declarations and source maps (optional, not required to run)

Deployment can be done via the VS Code Azure Functions extension, the Azure CLI (`func azure functionapp publish <app-name>`), or a GitHub Actions workflow.

### Environment Variables (set in Azure Application Settings)

```
REDCAP_API_URL=          ← REDCap API endpoint (to be filled)
REDCAP_API_TOKEN=        ← REDCap API token (to be filled)
ALLOWED_ORIGIN=https://vkarapet.github.io
```

### What Azure Provides (No Server Management Needed)

| Concern | Azure handles it |
|---------|-----------------|
| HTTPS / TLS | Automatic — every Azure Function gets an HTTPS endpoint |
| Uptime | Managed by Azure, auto-scales, no PM2 or systemd needed |
| Environment variables | "Application Settings" in the Azure portal (encrypted at rest) |
| Deployment | Deploy from VS Code, GitHub Actions, or ZIP upload |
| Cost | Free tier: 1 million executions/month (more than sufficient for a research study) |
| Custom domain | Optional — can map a subdomain like `mmat-api.institution.org` |

### Why This Works for a Research Study

- **No persistent server to maintain** — no OS patches, no process monitoring, no SSH access needed
- **Minimal code** — ~200 lines of proxy logic across 6 small files, already written and type-checked
- **Secure** — the REDCap API token is stored in Azure Application Settings, never in code or visible to the browser
- **Free** — the Azure Functions free tier easily covers research-scale usage
- **Institutional fit** — universities with Microsoft 365 already have Azure Active Directory and can provision Function Apps through their existing tenant

---

## Questions for IT (Azure Function Option)

If the dedicated server option (above) is not feasible, we can use an Azure Function instead. To determine whether this is possible, we need answers to the following:

1. Does the institution have an **Azure subscription** (or Azure tenant through Microsoft 365)? Can we create resources in it, or does IT need to provision them for us?
2. Can we create an **Azure Function App** (Node.js runtime, Consumption/Serverless plan)? Are there policies that restrict which Azure services can be used?
3. Can we store **secrets in Application Settings** (or Azure Key Vault) within the Function App? We need to store a REDCap API token that is never exposed publicly.
4. Does the Azure environment allow **outbound HTTPS requests** from an Azure Function to the institution's REDCap server (e.g., `redcap.institution.org/api/`)? Are there network restrictions, VNet requirements, or firewall rules that would block this?
5. Can we configure **CORS** on the Function App to allow requests only from our GitHub Pages domain (`https://vkarapet.github.io`)?
6. Can we set up a **custom domain** (e.g., `mmat-api.institution.org`) pointing to the Function App, or is the default Azure-provided URL (`https://<app-name>.azurewebsites.net`) acceptable?
7. Who has **permission to deploy** updates to the Function App? Can we deploy directly (via VS Code or GitHub Actions), or does deployment go through an IT review/approval process?

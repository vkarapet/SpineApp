/**
 * Mock REDCap API — Cloudflare Worker
 *
 * Simulates the subset of the REDCap API used by mac-spine-proxy:
 *   - content=version         → returns a version string
 *   - content=record (export) → returns records from KV
 *   - content=record (import) → stores records in KV
 *
 * All requests are POST to /api/ with application/x-www-form-urlencoded body,
 * matching real REDCap at https://neurosurgery.mcmaster.ca/api/
 *
 * KV layout:
 *   key "participants"                           → JSON string[] of known record IDs
 *   key "data:{record_id}"                       → JSON array of all flat records
 *   key "counter:{record_id}:{instrument}"       → next repeat instance number (string)
 */

interface Env {
  RECORDS: KVNamespace;
  MOCK_API_TOKEN: string;
  SEED_PARTICIPANTS: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formError(message: string, format: string): Response {
  if (format === 'json') {
    return Response.json({ error: message }, { status: 400 });
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?><error>${message}</error>`,
    { status: 400, headers: { 'Content-Type': 'application/xml' } },
  );
}

async function getParticipants(env: Env): Promise<string[]> {
  const stored = await env.RECORDS.get('participants');
  if (stored) return JSON.parse(stored) as string[];

  // First call: seed from env
  const seeded = env.SEED_PARTICIPANTS
    ? env.SEED_PARTICIPANTS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  await env.RECORDS.put('participants', JSON.stringify(seeded));
  return seeded;
}

async function ensureParticipant(env: Env, recordId: string): Promise<void> {
  const participants = await getParticipants(env);
  if (!participants.includes(recordId)) {
    participants.push(recordId);
    await env.RECORDS.put('participants', JSON.stringify(participants));
  }
}

type FlatRecord = Record<string, unknown>;

async function getRecords(env: Env, recordId: string): Promise<FlatRecord[]> {
  const raw = await env.RECORDS.get(`data:${recordId}`);
  return raw ? (JSON.parse(raw) as FlatRecord[]) : [];
}

async function putRecords(env: Env, recordId: string, records: FlatRecord[]): Promise<void> {
  await env.RECORDS.put(`data:${recordId}`, JSON.stringify(records));
}

async function nextInstance(env: Env, recordId: string, instrument: string): Promise<number> {
  const key = `counter:${recordId}:${instrument}`;
  const current = await env.RECORDS.get(key);
  const next = current ? parseInt(current, 10) + 1 : 1;
  await env.RECORDS.put(key, String(next));
  return next;
}

// ── Content handlers ─────────────────────────────────────────────────────────

async function handleVersion(format: string): Promise<Response> {
  const version = '14.7.0'; // Simulated REDCap version
  if (format === 'json') return Response.json(version);
  return new Response(version, { headers: { 'Content-Type': 'text/plain' } });
}

async function handleExportRecords(
  env: Env,
  params: URLSearchParams,
  format: string,
): Promise<Response> {
  const requestedRecords = params.get('records')?.split(',').map((s) => s.trim()) ?? [];
  const requestedFields = params.get('fields')?.split(',').map((s) => s.trim()) ?? [];
  const requestedForms = params.get('forms')?.split(',').map((s) => s.trim()) ?? [];

  // If no specific records requested, return all participants
  const participants = requestedRecords.length > 0
    ? requestedRecords
    : await getParticipants(env);

  let allRecords: FlatRecord[] = [];

  for (const recordId of participants) {
    const stored = await getRecords(env, recordId);

    if (stored.length === 0) {
      // Participant exists but has no instrument data — return a base record
      // (this is how REDCap behaves: record_id exists even with no instrument data)
      const known = await getParticipants(env);
      if (known.includes(recordId)) {
        allRecords.push({ record_id: recordId });
      }
      continue;
    }

    // Filter by form/instrument
    let filtered = stored;
    if (requestedForms.length > 0) {
      filtered = filtered.filter((r) =>
        requestedForms.includes(r.redcap_repeat_instrument as string),
      );
    }

    allRecords = allRecords.concat(filtered);
  }

  // Filter fields if requested
  if (requestedFields.length > 0) {
    allRecords = allRecords.map((r) => {
      const picked: FlatRecord = {};
      for (const f of requestedFields) {
        if (f in r) picked[f] = r[f];
      }
      // Always include structural fields
      if ('redcap_repeat_instrument' in r) {
        picked.redcap_repeat_instrument = r.redcap_repeat_instrument;
      }
      if ('redcap_repeat_instance' in r) {
        picked.redcap_repeat_instance = r.redcap_repeat_instance;
      }
      return picked;
    });
  }

  if (format === 'json') {
    return Response.json(allRecords);
  }

  // CSV fallback
  if (allRecords.length === 0) {
    return new Response('', { headers: { 'Content-Type': 'text/csv' } });
  }
  const headers = Object.keys(allRecords[0]);
  const csvRows = [headers.join(',')];
  for (const rec of allRecords) {
    csvRows.push(headers.map((h) => String(rec[h] ?? '')).join(','));
  }
  return new Response(csvRows.join('\n'), { headers: { 'Content-Type': 'text/csv' } });
}

async function handleImportRecords(
  env: Env,
  params: URLSearchParams,
  format: string,
): Promise<Response> {
  const dataStr = params.get('data');
  if (!dataStr) {
    return formError('No value was provided for parameter "data"', format);
  }

  let incoming: FlatRecord[];
  try {
    incoming = JSON.parse(dataStr) as FlatRecord[];
    if (!Array.isArray(incoming)) {
      return formError('"data" must be a JSON array of records', format);
    }
  } catch {
    return formError('Invalid JSON in "data" parameter', format);
  }

  const overwrite = params.get('overwriteBehavior') === 'overwrite';
  let importedCount = 0;

  for (const record of incoming) {
    const recordId = String(record.record_id ?? '');
    if (!recordId) {
      return formError('Record is missing record_id', format);
    }

    // Ensure participant is registered
    await ensureParticipant(env, recordId);

    const instrument = record.redcap_repeat_instrument as string | undefined;
    let instanceValue = record.redcap_repeat_instance;

    // Auto-number repeat instances when value is 'new'
    if (instrument && instanceValue === 'new') {
      instanceValue = await nextInstance(env, recordId, instrument);
      record.redcap_repeat_instance = instanceValue;
    }

    const existing = await getRecords(env, recordId);

    if (instrument && instanceValue) {
      // Repeating instrument — check for existing instance
      const idx = existing.findIndex(
        (r) =>
          r.redcap_repeat_instrument === instrument &&
          String(r.redcap_repeat_instance) === String(instanceValue),
      );

      if (idx >= 0) {
        if (overwrite) {
          existing[idx] = record;
        } else {
          // Normal mode: merge non-blank fields
          for (const [key, value] of Object.entries(record)) {
            if (value !== '' && value !== null && value !== undefined) {
              existing[idx][key] = value;
            }
          }
        }
      } else {
        existing.push(record);
      }
    } else {
      // Non-repeating — update or create base record
      const idx = existing.findIndex(
        (r) => !r.redcap_repeat_instrument && r.record_id === recordId,
      );
      if (idx >= 0) {
        if (overwrite) {
          existing[idx] = record;
        } else {
          for (const [key, value] of Object.entries(record)) {
            if (value !== '' && value !== null && value !== undefined) {
              existing[idx][key] = value;
            }
          }
        }
      } else {
        existing.push(record);
      }
    }

    await putRecords(env, recordId, existing);
    importedCount++;
  }

  const returnContent = params.get('returnContent') ?? 'count';

  if (returnContent === 'ids') {
    const ids = [...new Set(incoming.map((r) => String(r.record_id)))];
    if (format === 'json') return Response.json(ids);
    return new Response(ids.join(','));
  }

  if (returnContent === 'auto_ids') {
    const pairs = incoming.map((r) => `${r.record_id},${r.record_id}`);
    if (format === 'json') return Response.json(pairs);
    return new Response(pairs.join('\n'));
  }

  // Default: count
  if (format === 'json') return Response.json({ count: importedCount });
  return new Response(String(importedCount));
}

// ── Admin endpoints (not part of REDCap API) ─────────────────────────────────

async function handleAdminDump(env: Env): Promise<Response> {
  const participants = await getParticipants(env);
  const dump: Record<string, FlatRecord[]> = {};

  for (const pid of participants) {
    dump[pid] = await getRecords(env, pid);
  }

  return Response.json({
    participants,
    records: dump,
    _note: 'Admin endpoint — not part of REDCap API',
  });
}

async function handleAdminReset(env: Env): Promise<Response> {
  const participants = await getParticipants(env);

  for (const pid of participants) {
    await env.RECORDS.delete(`data:${pid}`);
    // Delete known instrument counters
    for (const instrument of ['grip_task', 'tug_task']) {
      await env.RECORDS.delete(`counter:${pid}:${instrument}`);
    }
  }

  // Re-seed participants
  const seeded = env.SEED_PARTICIPANTS
    ? env.SEED_PARTICIPANTS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  await env.RECORDS.put('participants', JSON.stringify(seeded));

  return Response.json({ success: true, message: 'All records cleared, participants re-seeded' });
}

// ── Main router ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers — allow any origin for mock
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Admin endpoints (GET, no token required)
    if (url.pathname === '/admin/dump' && request.method === 'GET') {
      const res = await handleAdminDump(env);
      return addHeaders(res, corsHeaders);
    }
    if (url.pathname === '/admin/reset' && request.method === 'POST') {
      const res = await handleAdminReset(env);
      return addHeaders(res, corsHeaders);
    }

    // REDCap API endpoint
    if (url.pathname !== '/api/' && url.pathname !== '/api') {
      return new Response('Not Found', { status: 404 });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Parse form body
    const body = await request.text();
    const params = new URLSearchParams(body);

    // Validate token
    const token = params.get('token');
    if (!token || token !== env.MOCK_API_TOKEN) {
      const fmt = params.get('format') ?? 'json';
      const res = formError(
        'You do not have permissions to use the API',
        fmt,
      );
      return addHeaders(new Response(res.body, { status: 403, headers: res.headers }), corsHeaders);
    }

    const content = params.get('content') ?? '';
    const format = params.get('format') ?? 'json';

    let response: Response;

    switch (content) {
      case 'version':
        response = await handleVersion(format);
        break;

      case 'record': {
        const hasData = params.has('data');
        if (hasData) {
          response = await handleImportRecords(env, params, format);
        } else {
          response = await handleExportRecords(env, params, format);
        }
        break;
      }

      default:
        response = formError(`Unsupported content type: "${content}"`, format);
        break;
    }

    return addHeaders(response, corsHeaders);
  },
} satisfies ExportedHandler<Env>;

function addHeaders(response: Response, headers: Record<string, string>): Response {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

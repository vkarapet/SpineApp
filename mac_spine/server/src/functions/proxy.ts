import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { loadConfig } from '../lib/config.js';
import { verifyHmac } from '../lib/validate-hmac.js';
import { getFieldMap, transformRecord } from '../lib/field-maps.js';
import {
  verifyParticipant,
  checkDuplicate,
  importRecord,
} from '../lib/redcap-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProxyRequestBody {
  action: string;
  record_id: string;
  payload: Record<string, unknown>;
}

interface SinglePayload {
  local_uuid: string;
  task_type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse(
  status: number,
  errorCode: string,
  message: string,
): HttpResponseInit {
  return {
    status,
    jsonBody: { success: false, error_code: errorCode, message },
  };
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Request-Signature',
    'Access-Control-Max-Age': '86400',
  };
}

function log(
  context: InvocationContext,
  action: string,
  recordId: string,
  status: number,
  extra?: Record<string, unknown>,
): void {
  // Only log first 8 chars of record_id
  context.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      record_id: recordId.substring(0, 8) + '...',
      status,
      ...extra,
    }),
  );
}

/**
 * Validate that a payload record has the required fields for upload_data.
 */
function validatePayloadRecord(
  record: Record<string, unknown>,
): string | null {
  if (!record.local_uuid || typeof record.local_uuid !== 'string') {
    return 'Missing or invalid local_uuid';
  }
  if (!record.task_type || typeof record.task_type !== 'string') {
    return 'Missing or invalid task_type';
  }
  if (!record.timestamp_start) {
    return 'Missing timestamp_start';
  }
  if (!getFieldMap(record.task_type as string)) {
    return `Unknown task_type: ${record.task_type}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function proxyHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const config = loadConfig();
  const headers = corsHeaders(config.allowedOrigin);

  // ---- Preflight ----
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  // ---- 1. CORS check ----
  const origin = request.headers.get('origin') ?? '';
  if (origin !== config.allowedOrigin) {
    return { ...errorResponse(403, 'CORS_REJECTED', 'Origin not allowed'), headers };
  }

  // ---- 2. Parse JSON body ----
  let body: ProxyRequestBody;
  try {
    body = (await request.json()) as ProxyRequestBody;
  } catch {
    return { ...errorResponse(400, 'INVALID_JSON', 'Request body is not valid JSON'), headers };
  }

  // ---- 3. Validate required fields ----
  if (!body.action || typeof body.action !== 'string') {
    return { ...errorResponse(400, 'MISSING_FIELDS', 'Missing required field: action'), headers };
  }
  if (!body.record_id || typeof body.record_id !== 'string') {
    return { ...errorResponse(400, 'MISSING_FIELDS', 'Missing required field: record_id'), headers };
  }

  const signature = request.headers.get('X-Request-Signature');
  if (!signature) {
    return { ...errorResponse(400, 'MISSING_FIELDS', 'Missing required header: X-Request-Signature'), headers };
  }

  // ---- 4. HMAC verification ----
  if (!verifyHmac(body.action, body.record_id, signature)) {
    log(context, body.action, body.record_id, 403);
    return { ...errorResponse(403, 'HMAC_INVALID', 'Signature verification failed'), headers };
  }

  // ---- 5. Action whitelist ----
  if (body.action !== 'upload_data') {
    log(context, body.action, body.record_id, 400);
    return { ...errorResponse(400, 'UNKNOWN_ACTION', `Unknown action: ${body.action}`), headers };
  }

  // ---- 6. Verify participant exists in REDCap ----
  try {
    const exists = await verifyParticipant(config, body.record_id);
    if (!exists) {
      log(context, body.action, body.record_id, 404);
      return { ...errorResponse(404, 'PARTICIPANT_NOT_FOUND', 'Record ID not found in REDCap'), headers };
    }
  } catch (err) {
    log(context, body.action, body.record_id, 502, {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return { ...errorResponse(502, 'REDCAP_ERROR', 'Failed to verify participant in REDCap'), headers };
  }

  // ---- 7. Process upload ----
  // Support both single record and batch (payload.records array)
  const payload = body.payload ?? {};
  const records: SinglePayload[] = Array.isArray(payload.records)
    ? (payload.records as SinglePayload[])
    : [payload as SinglePayload];

  let syncedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    // Validate each record
    const validationError = validatePayloadRecord(record);
    if (validationError) {
      log(context, body.action, body.record_id, 422, { error: validationError });
      return {
        ...errorResponse(422, 'INVALID_PAYLOAD', validationError),
        headers,
      };
    }

    const fieldMap = getFieldMap(record.task_type)!;

    // Deduplication: skip if local_uuid already exists in REDCap
    try {
      const isDuplicate = await checkDuplicate(
        config,
        body.record_id,
        record.local_uuid,
        fieldMap.instrument,
      );
      if (isDuplicate) {
        skippedCount++;
        continue;
      }
    } catch (err) {
      log(context, body.action, body.record_id, 502, {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return { ...errorResponse(502, 'REDCAP_ERROR', 'Deduplication check failed'), headers };
    }

    // Transform local payload to REDCap format
    const redcapRecord = transformRecord(body.record_id, record, fieldMap);

    // Import into REDCap
    try {
      const result = await importRecord(config, redcapRecord);
      syncedCount += result.count;
    } catch (err) {
      log(context, body.action, body.record_id, 502, {
        error: err instanceof Error ? err.message : 'Unknown error',
        local_uuid: record.local_uuid.substring(0, 8) + '...',
      });
      return { ...errorResponse(502, 'REDCAP_REJECTED', 'REDCap rejected the import'), headers };
    }
  }

  // ---- 8. Return success ----
  log(context, body.action, body.record_id, 200, {
    synced_count: syncedCount,
    skipped_count: skippedCount,
  });

  return {
    status: 200,
    headers,
    jsonBody: {
      success: true,
      synced_count: syncedCount,
      skipped_count: skippedCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Register the function
// ---------------------------------------------------------------------------

app.http('proxy', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'proxy',
  handler: proxyHandler,
});

import type { Env } from '../lib/config';
import { verifyHmac } from '../lib/validate-hmac';
import { getFieldMap, transformRecord } from '../lib/field-maps';
import { verifyParticipant, checkDuplicate, importRecord } from '../lib/redcap-client';

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
  headers: Record<string, string>,
): Response {
  return Response.json(
    { success: false, error_code: errorCode, message },
    { status, headers },
  );
}

function log(
  action: string,
  recordId: string,
  status: number,
  extra?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      record_id: recordId.substring(0, 8) + '...',
      status,
      ...extra,
    }),
  );
}

function validatePayloadRecord(record: Record<string, unknown>): string | null {
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
// Handler
// ---------------------------------------------------------------------------

export async function handleProxy(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // ---- 1. Parse JSON body ----
  let body: ProxyRequestBody;
  try {
    body = await request.json() as ProxyRequestBody;
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Sync request was malformed. Please update the app and try again.', corsHeaders);
  }

  // ---- 2. Validate required fields ----
  if (!body.action || typeof body.action !== 'string') {
    return errorResponse(400, 'MISSING_FIELDS', 'Sync request was incomplete. Please update the app and try again.', corsHeaders);
  }
  if (!body.record_id || typeof body.record_id !== 'string') {
    return errorResponse(400, 'MISSING_FIELDS', 'Participant ID is missing. Please sign out and sign in again.', corsHeaders);
  }

  const signature = request.headers.get('X-Request-Signature');
  if (!signature) {
    return errorResponse(400, 'MISSING_FIELDS', 'Authentication is missing. Please update the app and try again.', corsHeaders);
  }

  // ---- 3. HMAC verification ----
  const valid = await verifyHmac(body.action, body.record_id, signature);
  if (!valid) {
    log(body.action, body.record_id, 403);
    return errorResponse(403, 'HMAC_INVALID', 'Authentication failed. Please sign out and sign in again.', corsHeaders);
  }

  // ---- 4. Action whitelist ----
  if (body.action !== 'upload_data') {
    log(body.action, body.record_id, 400);
    return errorResponse(400, 'UNKNOWN_ACTION', 'Unsupported request. Please update the app to the latest version.', corsHeaders);
  }

  // ---- 5. Verify participant exists in REDCap ----
  try {
    const exists = await verifyParticipant(env, body.record_id);
    if (!exists) {
      log(body.action, body.record_id, 404);
      return errorResponse(404, 'PARTICIPANT_NOT_FOUND', 'Participant ID not recognized. Please check your ID and contact the research team if this persists.', corsHeaders);
    }
  } catch (err) {
    log(body.action, body.record_id, 502, {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return errorResponse(502, 'SERVER_ERROR', 'Could not verify your participant ID. The server may be temporarily unavailable — please try again later.', corsHeaders);
  }

  // ---- 6. Process upload ----
  // Support both single record and batch (payload.records array)
  const payload = body.payload ?? {};
  const records: SinglePayload[] = Array.isArray(payload.records)
    ? (payload.records as SinglePayload[])
    : [payload as SinglePayload];

  let syncedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    const validationError = validatePayloadRecord(record);
    if (validationError) {
      log(body.action, body.record_id, 422, { error: validationError });
      return errorResponse(422, 'INVALID_PAYLOAD', validationError, corsHeaders);
    }

    const fieldMap = getFieldMap(record.task_type)!;

    // Deduplication: skip if local_uuid already exists in REDCap
    try {
      const isDuplicate = await checkDuplicate(
        env,
        body.record_id,
        record.local_uuid,
        fieldMap.instrument,
      );
      if (isDuplicate) {
        skippedCount++;
        continue;
      }
    } catch (err) {
      log(body.action, body.record_id, 502, {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return errorResponse(502, 'SERVER_ERROR', 'Server error during sync. Your data is saved locally — please try again later.', corsHeaders);
    }

    // Transform and import
    const redcapRecord = transformRecord(body.record_id, record, fieldMap);

    try {
      const result = await importRecord(env, redcapRecord);
      syncedCount += result.count;
    } catch (err) {
      log(body.action, body.record_id, 502, {
        error: err instanceof Error ? err.message : 'Unknown error',
        local_uuid: record.local_uuid.substring(0, 8) + '...',
      });
      return errorResponse(502, 'UPLOAD_REJECTED', 'The server rejected this upload. Your data is saved locally — please contact the research team. (Error code: UPLOAD_REJECTED)', corsHeaders);
    }
  }

  // ---- 7. Success ----
  log(body.action, body.record_id, 200, { synced_count: syncedCount, skipped_count: skippedCount });

  return Response.json(
    { success: true, synced_count: syncedCount, skipped_count: skippedCount },
    { status: 200, headers: corsHeaders },
  );
}

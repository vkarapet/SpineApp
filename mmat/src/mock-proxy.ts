/**
 * Mock proxy handler for the service worker.
 * Intercepts POST /api/proxy requests and returns mock success responses,
 * replacing the need for a real proxy server.
 */

export async function handleProxyRequest(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  // Validate required fields
  if (!body.action || typeof body.action !== 'string') {
    return jsonResponse(400, { error: 'Missing required field: action' });
  }
  if (!body.record_id || typeof body.record_id !== 'string') {
    return jsonResponse(400, { error: 'Missing required field: record_id' });
  }

  // Validate HMAC headers are present
  const timestamp = request.headers.get('X-Request-Timestamp');
  const signature = request.headers.get('X-Request-Signature');
  if (!timestamp || !signature) {
    return jsonResponse(400, { error: 'Missing authentication headers' });
  }

  const action = body.action as string;

  switch (action) {
    case 'upload_data':
      return handleUploadData(body);
    case 'upload_registration':
    case 'delete_data':
      return jsonResponse(200, { success: true });
    default:
      return jsonResponse(400, { error: `Unknown action: ${action}` });
  }
}

function handleUploadData(body: Record<string, unknown>): Response {
  const payload = body.payload as Record<string, unknown> | undefined;
  if (!payload) {
    return jsonResponse(400, { error: 'Missing payload for upload_data' });
  }

  // Batch upload: payload.records is an array
  if (Array.isArray(payload.records)) {
    for (let i = 0; i < payload.records.length; i++) {
      const record = payload.records[i] as Record<string, unknown>;
      const err = validateRecord(record);
      if (err) {
        return jsonResponse(400, { error: `Record ${i}: ${err}` });
      }
    }
    return jsonResponse(200, { success: true });
  }

  // Single upload
  const err = validateRecord(payload);
  if (err) {
    return jsonResponse(400, { error: err });
  }
  return jsonResponse(200, { success: true });
}

function validateRecord(record: Record<string, unknown>): string | null {
  if (!record.local_uuid) return 'Missing local_uuid';
  if (!record.task_type) return 'Missing task_type';
  if (!record.timestamp_start) return 'Missing timestamp_start';
  return null;
}

function jsonResponse(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Date': new Date().toUTCString(),
    },
  });
}

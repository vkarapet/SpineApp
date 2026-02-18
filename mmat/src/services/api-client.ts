import { hmacSha256 } from '../utils/crypto';
import { PROXY_URL } from '../constants';

export interface ApiRequest {
  action: 'upload_data' | 'upload_registration' | 'fetch_history' | 'delete_data';
  record_id: string;
  device_id: string;
  payload?: Record<string, unknown>;
}

export interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  serverTimestamp?: number;
}

export async function apiCall(request: ApiRequest): Promise<ApiResponse> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Generate HMAC signature
  const signatureInput = `${request.action}${request.record_id}${timestamp}`;
  const signatureKey = `${request.record_id}|${request.device_id}`;
  const signature = await hmacSha256(signatureKey, signatureInput);

  const body = {
    action: request.action,
    record_id: request.record_id,
    payload: request.payload ?? {},
  };

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Timestamp': timestamp,
      'X-Request-Signature': signature,
    },
    body: JSON.stringify(body),
  });

  // Get server timestamp for clock drift detection
  const dateHeader = response.headers.get('Date');
  const serverTimestamp = dateHeader ? new Date(dateHeader).getTime() : undefined;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    return {
      success: false,
      error: errorBody.error ?? `HTTP ${response.status}`,
      serverTimestamp,
    };
  }

  const data = await response.json();
  return {
    success: true,
    data,
    serverTimestamp,
  };
}

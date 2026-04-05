import { hmacSha256 } from '../utils/crypto';
import { PROXY_URL } from '../constants';

export interface ApiRequest {
  action: 'upload_data';
  record_id: string;
  payload?: Record<string, unknown>;
}

export interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  serverTimestamp?: number;
}

export async function apiCall(request: ApiRequest): Promise<ApiResponse> {
  // Generate HMAC signature
  const signatureInput = `${request.action}${request.record_id}`;
  const signatureKey = request.record_id;
  const signature = await hmacSha256(signatureKey, signatureInput);

  const body = {
    action: request.action,
    record_id: request.record_id,
    payload: request.payload ?? {},
  };

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': signature,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      success: false,
      error: 'Unable to reach the server. Please check your internet connection and try again.',
    };
  }

  // Get server timestamp for clock drift detection
  const dateHeader = response.headers.get('Date');
  const serverTimestamp = dateHeader ? new Date(dateHeader).getTime() : undefined;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorBody.message ?? errorBody.error ?? `Unexpected server error (${response.status}). Please try again later.`,
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

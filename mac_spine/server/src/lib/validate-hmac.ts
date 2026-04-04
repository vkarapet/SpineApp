/**
 * Verify the HMAC-SHA256 signature from the client using the Web Crypto API.
 *
 * The PWA signs requests as:
 *   signatureInput = action + record_id  (concatenated, no separator)
 *   signatureKey   = record_id
 *   signature      = HMAC-SHA256(signatureKey, signatureInput) → hex string
 *
 * crypto.subtle.verify() performs a constant-time comparison internally.
 */
export async function verifyHmac(
  action: string,
  recordId: string,
  signature: string,
): Promise<boolean> {
  const encoder = new TextEncoder();

  let sigBytes: Uint8Array;
  try {
    sigBytes = hexToBytes(signature);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(recordId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(`${action}${recordId}`),
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

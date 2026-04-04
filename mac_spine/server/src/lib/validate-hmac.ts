import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify the HMAC-SHA256 signature from the client.
 *
 * The PWA signs requests as:
 *   signatureInput = action + record_id  (concatenated, no separator)
 *   signatureKey   = record_id
 *   signature      = HMAC-SHA256(signatureKey, signatureInput) → hex string
 */
export function verifyHmac(
  action: string,
  recordId: string,
  signature: string,
): boolean {
  const signatureInput = `${action}${recordId}`;
  const expected = createHmac('sha256', recordId)
    .update(signatureInput)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, expectedBuffer);
}

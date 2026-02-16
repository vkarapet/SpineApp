export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // crypto.subtle is only available in secure contexts (HTTPS / localhost).
  // Fall back to a simple hash for development over plain HTTP.
  if (!crypto.subtle) {
    return sha256Fallback(data);
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Simple non-cryptographic hash for dev use when crypto.subtle is unavailable. */
function sha256Fallback(data: Uint8Array): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < data.length; i++) {
    h1 = Math.imul(h1 ^ data[i], 2654435761);
    h2 = Math.imul(h2 ^ data[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).padStart(16, '0') + h2.toString(16).padStart(8, '0') + h1.toString(16).padStart(8, '0');
}

export async function generateSubjectHash(
  email: string,
  dob: string,
  salt: string,
): Promise<string> {
  const canonical = `${email.trim().toLowerCase()}|${dob}|${salt}`;
  return sha256(canonical);
}

export async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();

  // Fallback for insecure contexts (dev over plain HTTP)
  if (!crypto.subtle) {
    return sha256(`${key}:${message}`);
  }

  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeChecksum(data: unknown): Promise<string> {
  return sha256(JSON.stringify(data));
}

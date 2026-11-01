/**
 * In-memory JWT helpers. They never print, store or send a token; callers keep the values in memory.
 */

function segments(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Not a compact JWT.');
  return parts;
}

/**
 * Copy of the token with one byte of the decoded signature changed. The byte is flipped after
 * decoding because the last base64url character can hold unused bits: editing that character may
 * leave the signature, and so the token, valid.
 */
export function tamperSignature(token, byteIndex) {
  const [header, payload, signature] = segments(token);
  const bytes = Buffer.from(signature, 'base64url');
  if (!bytes.length) throw new Error('The JWT has an empty signature.');
  const index = byteIndex ?? Math.floor(bytes.length / 2);
  if (!Number.isInteger(index) || index < 0 || index >= bytes.length) throw new RangeError('Signature byte outside the signature.');
  bytes[index] ^= 0x01;
  return `${header}.${payload}.${bytes.toString('base64url')}`;
}

/** Number of decoded signature bytes that differ; header and payload must be identical. */
export function signatureDifference(original, changed) {
  const [h1, p1, s1] = segments(original);
  const [h2, p2, s2] = segments(changed);
  if (h1 !== h2 || p1 !== p2) return null;
  const first = Buffer.from(s1, 'base64url');
  const second = Buffer.from(s2, 'base64url');
  if (first.length !== second.length) return null;
  let differences = 0;
  for (let index = 0; index < first.length; index += 1) if (first[index] !== second[index]) differences += 1;
  return differences;
}

/** The `exp` claim (seconds since the epoch), read without verifying the signature. */
export function expiryOf(token) {
  const [, payload] = segments(token);
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims?.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp : null;
  } catch {
    return null;
  }
}

/** Seconds to wait until the token has been expired for `skewSeconds`. */
export function secondsUntilExpired(token, skewSeconds, nowMs = Date.now()) {
  const expiry = expiryOf(token);
  if (expiry === null) return null;
  return Math.max(0, expiry + skewSeconds - Math.floor(nowMs / 1000));
}

/** Whether two tokens carry the same subject, compared without revealing either. */
export function sameSubject(first, second) {
  const subject = (token) => {
    try { return JSON.parse(Buffer.from(segments(token)[1], 'base64url').toString('utf8'))?.sub ?? null; } catch { return null; }
  };
  const a = subject(first);
  return a !== null && a === subject(second);
}

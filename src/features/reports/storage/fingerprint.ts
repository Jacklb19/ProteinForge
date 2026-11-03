/** Lowercase hexadecimal SHA-256 of exact file bytes: declared on save, checked again on open and download. */
export async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

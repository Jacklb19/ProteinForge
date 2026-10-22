import { ensure, LAB_CONFIG as C, LabError } from './config';

const decoder = new TextDecoder('utf-8', { fatal: true });
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 255] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
}
export function safePath(name: string): void {
  ensure(name.length > 0 && name.length <= C.maximumPathLength && /^[a-zA-Z0-9_./-]+$/.test(name), 'path');
  ensure(!name.startsWith('/') && name.split('/').every(part => part !== '' && part !== '.' && part !== '..' && !part.endsWith('.') && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)), 'path');
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join('');
}
interface Entry { name: string; headerStart: number; start: number; end: number; size: number; crc: number; method: number }
/** Shared budget includes nested campaign ZIPs and PAE arrays. No declared length allocates an output buffer. */
export interface ExpansionBudget { used: number }

async function inflate(bytes: Uint8Array, expected: number): Promise<Uint8Array> {
  let stream: DecompressionStream;
  try { stream = new DecompressionStream('deflate-raw'); } catch { throw new LabError('unsupported'); }
  const reader = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      ensure(size <= expected && size <= C.maximumEntryBytes, 'size');
      chunks.push(value);
    }
    ensure(size === expected, 'zip');
    const output = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Reads only bounded, single-volume ZIPs. Local headers, overlaps, sizes and CRC are checked independently. */
export async function readZip(bytes: Uint8Array, budget: ExpansionBudget = { used: 0 }): Promise<Map<string, Uint8Array>> {
  ensure(bytes.length <= C.maximumArchiveBytes, 'size');
  ensure(bytes.length >= 22, 'zip');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { eocd = offset; break; }
  }
  ensure(eocd >= 0, 'zip');
  const count = view.getUint16(eocd + 10, true), centralSize = view.getUint32(eocd + 12, true), centralStart = view.getUint32(eocd + 16, true);
  ensure(view.getUint32(eocd + 4, true) === 0 && view.getUint16(eocd + 8, true) === count, 'zip');
  ensure(count > 0 && count <= C.maximumEntries && centralStart + centralSize === eocd, 'zip');
  const entries: Entry[] = []; const names = new Set<string>(); let cursor = centralStart; let total = 0;
  for (let index = 0; index < count; index++) {
    ensure(cursor + 46 <= eocd && view.getUint32(cursor, true) === 0x02014b50, 'zip');
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true), compressed = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    ensure((flags & ~0x800) === 0 && (method === 0 || method === 8) && view.getUint16(cursor + 34, true) === 0, 'zip');
    ensure(cursor + 46 + nameLength + extraLength + commentLength <= eocd, 'zip');
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decoder.decode(nameBytes); safePath(name); ensure(!names.has(name.toLowerCase()), 'path'); names.add(name.toLowerCase());
    // Unix symlinks and all nonregular entries are unsupported.
    const mode = view.getUint32(cursor + 38, true) >>> 16;
    ensure((mode & 0xf000) === 0 || (mode & 0xf000) === 0x8000, 'zip');
    total += size; ensure(size <= C.maximumEntryBytes && total + budget.used <= C.maximumExpandedBytes, 'size');
    ensure(local + 30 <= centralStart && view.getUint32(local, true) === 0x04034b50, 'zip');
    ensure(view.getUint16(local + 6, true) === flags && view.getUint16(local + 8, true) === method && view.getUint32(local + 14, true) === crc, 'zip');
    const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true);
    const start = local + 30 + localNameLength + localExtraLength, end = start + compressed;
    ensure(end <= centralStart && localNameLength === nameLength && decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) === name, 'zip');
    const localCompressed = view.getUint32(local + 18, true), localSize = view.getUint32(local + 22, true);
    if (localCompressed === 0xffffffff && localSize === 0xffffffff) {
      // NumPy uses a ZIP64 local size extra even for small .npy files; central sizes remain bounded 32-bit.
      let extra = local + 30 + localNameLength; let verified = false;
      while (extra + 4 <= start) {
        const tag = view.getUint16(extra, true), length = view.getUint16(extra + 2, true);
        ensure(extra + 4 + length <= start, 'zip');
        if (tag === 1) { ensure(length === 16 && view.getBigUint64(extra + 4, true) === BigInt(size) && view.getBigUint64(extra + 12, true) === BigInt(compressed), 'zip'); verified = true; }
        extra += 4 + length;
      }
      ensure(verified && extra === start, 'zip');
    } else ensure(localCompressed === compressed && localSize === size, 'zip');
    ensure(entries.every(entry => end <= entry.headerStart || local >= entry.end), 'zip');
    entries.push({ name, headerStart: local, start, end, size, crc, method });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  ensure(cursor === eocd, 'zip'); budget.used += total;
  const result = new Map<string, Uint8Array>();
  for (const entry of entries) {
    const compressed = bytes.subarray(entry.start, entry.end);
    const data = entry.method === 0 ? compressed.slice() : await inflate(compressed, entry.size);
    ensure(data.length === entry.size && crc32(data) === entry.crc, 'zip'); result.set(entry.name, data);
  }
  return result;
}

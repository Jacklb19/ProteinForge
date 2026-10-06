import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface FontRecord { file: string; bytes: number; sha256: string }
const provenance = JSON.parse(readFileSync('public/fonts/provenance.json', 'utf8')) as { files: FontRecord[] };

describe('self-hosted font integrity', () => {
  it.each(provenance.files)('verifies WOFF2 size and SHA-256 for $file', ({ file, bytes, sha256 }) => {
    const data = readFileSync(`public/fonts/${file}`);
    expect(data.subarray(0, 4).toString()).toBe('wOF2');
    expect(data.byteLength).toBe(bytes);
    expect(data.byteLength).toBeLessThan(1_000_000);
    expect(createHash('sha256').update(data).digest('hex')).toBe(sha256);
  });

  it('includes the distribution license and precaches WOFF2 files', () => {
    expect(readFileSync('public/fonts/OFL.txt', 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(readFileSync('vite.config.ts', 'utf8')).toContain('svg,wasm,woff2');
  });
});

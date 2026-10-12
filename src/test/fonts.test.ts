import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FONT_FILES, fontUrl } from '../theme/fonts';

interface FamilyRecord { family: string; license: string }
const provenance = JSON.parse(readFileSync('public/fonts/provenance.json', 'utf8')) as { families: FamilyRecord[] };
const fontFaces = readFileSync('src/fonts.css', 'utf8');
const tokens = readFileSync('src/design-tokens.css', 'utf8');

describe('self-hosted font integrity', () => {
  it.each(FONT_FILES)('verifies WOFF2 size and SHA-256 for $file', ({ file, bytes, sha256 }) => {
    const data = readFileSync(`public/fonts/${file}`);
    expect(data.subarray(0, 4).toString()).toBe('wOF2');
    expect(data.byteLength).toBe(bytes);
    expect(data.byteLength).toBeLessThan(1_000_000);
    expect(createHash('sha256').update(data).digest('hex')).toBe(sha256);
  });

  it.each(provenance.families)('includes the SIL OFL license for $family', ({ license }) => {
    expect(readFileSync(`public/fonts/${license}`, 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('declares every manifest file in CSS with its family and weight', () => {
    const declarations = [...fontFaces.matchAll(/font-family: '([^']+)';\s*src: url\('([^']+)'\)[^}]*font-weight: (\d+);/g)]
      .map(([, family, url, weight]) => ({ family, url, weight: Number(weight) }));
    expect(declarations).toEqual(expect.arrayContaining(
      FONT_FILES.map((font) => ({ family: font.family, url: fontUrl(font), weight: font.weight })),
    ));
    expect(declarations).toHaveLength(FONT_FILES.length);
  });

  it('uses the manifest families first in the typography tokens', () => {
    const family = (name: string) => tokens.match(new RegExp(`${name}:\\s*'([^']+)'`))?.[1];
    expect(family('--font-ui')).toBe(FONT_FILES.find((font) => font.role === 'interface')?.family);
    expect(family('--font-sequence')).toBe(FONT_FILES.find((font) => font.role === 'sequence')?.family);
  });

  it('precaches WOFF2 files', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain('svg,wasm,woff2');
  });
});

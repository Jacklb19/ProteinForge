import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mappingFromSiftsXml } from '../src/features/library/siftsXml';

/** Eight explicit public endpoint rows. This intentionally never supplies a complete mapping. */
export function siftsFixture() {
  const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new () => { window: { DOMParser: typeof DOMParser; close: () => void } } };
  const dom = new JSDOM(); const previous = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  try {
    globalThis.DOMParser = dom.window.DOMParser;
    const mapping = mappingFromSiftsXml(readFileSync('src/features/library/fixtures/1trz-sifts-excerpt.xml', 'utf8'), JSON.parse(readFileSync('src/features/library/fixtures/1trz-residues-excerpt.json', 'utf8')) as unknown, '1TRZ', '2026-10-23T21:40:00Z');
    const sequence = readFileSync('src/features/descriptors/fixtures/P01308.fasta', 'utf8').split(/\r?\n/).slice(1).join('');
    return { mapping: { ...mapping, rows: mapping.rows.map(row => ({ ...row, authSeqId: row.authSeqId ?? undefined })) }, referenceSequenceVersion: 1, referenceSequenceSha256: createHash('sha256').update(sequence).digest('hex') };
  } finally {
    if (previous) Object.defineProperty(globalThis, 'DOMParser', previous); else Reflect.deleteProperty(globalThis, 'DOMParser');
    dom.window.close();
  }
}

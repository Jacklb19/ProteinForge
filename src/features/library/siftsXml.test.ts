import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import listing from './fixtures/1trz-residues-excerpt.json';
import xml from './fixtures/1trz-sifts-excerpt.xml?raw';
import { mappingFromSiftsXml } from './siftsXml';
import { createResidueMapping, MAX_MAPPING_RESIDUES, MAX_SIFTS_XML_CHARACTERS } from './residueMapping';

const retrievedAt = '2026-10-23T21:40:00Z';
const parse = (text = xml, data: unknown = listing) => mappingFromSiftsXml(text, data, '1TRZ', retrievedAt);
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test fixture value');
  return value;
}

describe('SIFTS XML residue adapter', () => {
  it('reads a traceable public excerpt without filling omitted residues', () => {
    const document = parse();
    expect(document.rows).toHaveLength(8);
    expect(document.provenance).toMatchObject({ provider: 'PDBe/SIFTS', releaseDate: '2026-10-18', retrievedAt });
    expect(document.rows.map(row => [row.labelAsymId, row.labelSeqId, row.position])).toEqual([
      ['A', 1, 90], ['A', 21, 110], ['B', 1, 25], ['B', 30, 54],
      ['C', 1, 90], ['C', 21, 110], ['D', 1, 25], ['D', 30, 54],
    ]);
    const sequence = readFileSync('src/features/descriptors/fixtures/P01308.fasta', 'utf8').split(/\r?\n/).slice(1).join('');
    const mapping = createResidueMapping(document, { accession: 'P01308', sequence }, { pdbId: '1TRZ', coordinates: [] }, 1);
    expect(mapping.fromSequence(90).status).toBe('ambiguous');
    expect(mapping.fromSequence(91).status).toBe('unmapped');
  });

  it('uses listing entity/label chain IDs instead of SIFTS author-chain entity IDs', () => {
    expect(parse().rows.find(row => row.authAsymId === 'C')).toMatchObject({ entityId: '1', labelAsymId: 'C' });
    const data = structuredClone(listing);
    required(required(data['1trz'].molecules[0]).chains[0]).struct_asym_id = 'internal-X';
    expect(parse(xml, data).rows[0]).toMatchObject({ entityId: '1', labelAsymId: 'internal-X', authAsymId: 'A' });
  });

  it('preserves negative author numbers, insertion codes and Not_Observed annotations', () => {
    const data = structuredClone(listing);
    const residue = required(required(required(data['1trz'].molecules[0]).chains[0]).residues[0]);
    residue.author_residue_number = -2; residue.author_insertion_code = 'A';
    const text = xml.replace('dbResNum="1" dbResName="GLY" dbChainId="A"', 'dbResNum="-2A" dbResName="GLY" dbChainId="A"')
      .replace('</residue>', '<residueDetail dbSource="PDBe" property="Annotation">Not_Observed</residueDetail></residue>');
    expect(parse(text, data).rows[0]).toMatchObject({ authSeqId: '-2', insertionCode: 'A', notObserved: true });
  });

  it('rejects a missing, ambiguous or inconsistent identity instead of guessing a chain', () => {
    const missing = structuredClone(listing); required(missing['1trz'].molecules[0]).chains.shift();
    expect(() => parse(xml, missing)).toThrow('identity');
    const duplicate = structuredClone(listing); duplicate['1trz'].molecules.push(required(duplicate['1trz'].molecules[0]));
    expect(() => parse(xml, duplicate)).toThrow('identity');
    expect(() => parse(xml.replace('dbResNum="1" dbResName="GLY" dbChainId="A"', 'dbResNum="2" dbResName="GLY" dbChainId="A"'))).toThrow('identity');
    expect(() => parse(xml.replace('dbResNum="90"', 'dbResNum="0"'))).toThrow();
    expect(() => parse(xml.replace('dbResNum="90"', 'dbResNum="90x"'))).toThrow('number');
  });

  it('retains nonnumeric and null author IDs using the listing instead of parsing an assumed integer', () => {
    const data = JSON.parse(JSON.stringify(listing)) as { '1trz': { molecules: { chains: { residues: { author_residue_number: string | null; author_insertion_code: string }[] }[] }[] } };
    const residue = required(required(required(data['1trz'].molecules[0]).chains[0]).residues[0]);
    residue.author_residue_number = 'author-X'; residue.author_insertion_code = 'B';
    expect(parse(xml.replace('dbResNum="1" dbResName="GLY" dbChainId="A"', 'dbResNum="author-XB" dbResName="GLY" dbChainId="A"'), data).rows[0]).toMatchObject({ authSeqId: 'author-X', insertionCode: 'B' });
    residue.author_residue_number = null; residue.author_insertion_code = '';
    expect(parse(xml.replace('dbResNum="1" dbResName="GLY" dbChainId="A"', 'dbResNum="null" dbResName="GLY" dbChainId="A"'), data).rows[0]?.authSeqId).toBeNull();
  });

  it('rejects unsafe, malformed, oversized or wrong-entry documents', () => {
    for (const text of ['<!DOCTYPE entry>' + xml, '<!ENTITY x SYSTEM "https://example.org">' + xml, xml.slice(0, -20), xml.replace('dbAccessionId="1trz"', 'dbAccessionId="2xyz"'), xml.replace('eFamily.xsd', 'wrong.xsd'), ' '.repeat(MAX_SIFTS_XML_CHARACTERS + 1)]) expect(() => parse(text)).toThrow();
    expect(() => mappingFromSiftsXml(xml, listing, '1TRZ', 'yesterday')).toThrow();
    expect(() => parse(xml, {})).toThrow();
  });

  it('keeps author strings exact instead of erasing signs, leading zeroes or insertion boundaries', () => {
    const data = JSON.parse(JSON.stringify(listing)) as { '1trz': { molecules: { chains: { residues: { author_residue_number: string; author_insertion_code: string }[] }[] }[] } };
    const residue = required(required(required(data['1trz'].molecules[0]).chains[0]).residues[0]);
    for (const author of ['001', '+1', '-0', 'author-X']) {
      residue.author_residue_number = author;
      const text = xml.replace('dbResNum="1" dbResName="GLY" dbChainId="A"', `dbResNum="${author}" dbResName="GLY" dbChainId="A"`);
      expect(parse(text, data).rows[0]?.authSeqId).toBe(author);
    }
    residue.author_residue_number = '001';
    expect(() => parse(xml, data)).toThrow('identity');
  });

  it('bounds total nested listing cardinality before touching residue members', () => {
    const tooMany = new Proxy(new Array<unknown>(MAX_MAPPING_RESIDUES + 1), { get(target, key) {
      if (key === '0') throw new Error('Visited member before cardinality guard');
      const value: unknown = Reflect.get(target, key); return value;
    } });
    expect(() => parse(xml, { '1trz': { molecules: [{ entity_id: 1, chains: [{ chain_id: 'A', struct_asym_id: 'A', residues: tooMany }] }] } })).toThrow('Oversized PDBe');
    expect(() => parse(xml, { '1trz': { molecules: new Array<unknown>(3 * MAX_MAPPING_RESIDUES + 1) } })).toThrow('Oversized PDBe');
  });

  it('retains ambiguity with many repeated identities without treating the first candidate as authoritative', () => {
    const molecule = required(listing['1trz'].molecules[0]);
    expect(() => parse(xml, { '1trz': { molecules: Array.from({ length: 5_000 }, () => molecule) } })).toThrow('ambiguous');
  });
});

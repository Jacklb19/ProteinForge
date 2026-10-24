import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { EmptyLoci } from 'molstar/lib/mol-model/loci';
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { Task } from 'molstar/lib/mol-task';
import { CifCategory, CifField } from 'molstar/lib/mol-io/reader/cif/data-model';
import { Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { MmcifFormat } from 'molstar/lib/mol-model-formats/structure/mmcif';
import xml from './fixtures/1trz-sifts-excerpt.xml?raw';
import listing from './fixtures/1trz-residues-excerpt.json';
import { mappingFromSiftsXml } from './siftsXml';
import { createResidueMapping } from './residueMapping';
import { indexStructureResidues, residueFromLoci } from './structureResidues';

let structure: Structure;
let index: ReturnType<typeof indexStructureResidues>;
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture value');
  return value;
}
beforeAll(async () => {
  const parsed = await CIF.parseBinary(new Uint8Array(readFileSync('e2e/fixtures/1TRZ.bcif'))).run();
  if (parsed.isError || !parsed.result.blocks[0]) throw new Error('Invalid real BinaryCIF fixture');
  const trajectory = await trajectoryFromMmCIF(parsed.result.blocks[0]).run();
  const model = await Task.resolveInContext(trajectory.getFrameAtIndex(0));
  structure = Structure.ofModel(model);
  index = indexStructureResidues(structure);
});

describe('Mol* coordinate adapter with public experimental 1TRZ', () => {
  it('indexes 102 polymer residues from the actual first model, excluding ions', () => {
    expect(index.coordinates).toHaveLength(102);
    expect(new Set(index.coordinates.map(row => row.modelNum))).toEqual(new Set([1]));
    expect(new Set(index.coordinates.map(row => row.labelAsymId))).toEqual(new Set(['A', 'B', 'C', 'D']));
  });

  it('round trips UniProt 90 through chain A residue 1, loci and the same reference position', () => {
    const document = mappingFromSiftsXml(xml, listing, '1TRZ', '2026-10-23T21:40:00Z');
    const sequence = readFileSync('src/features/descriptors/fixtures/P01308.fasta', 'utf8').split(/\r?\n/).slice(1).join('');
    const mapping = createResidueMapping(document, { accession: 'P01308', sequence }, index, 1);
    expect(mapping.fromSequence(90).status).toBe('ambiguous');
    const selection = mapping.fromSequence(90, 'A');
    expect(selection.status).toBe('mapped');
    const address = { ...required(selection.candidates[0]).address, modelNum: 1 };
    const loci = index.lociFor(address);
    expect(StructureElement.Loci.size(loci)).toBeGreaterThan(1);
    expect(residueFromLoci(loci)).toEqual(address);
    expect(mapping.fromStructure(required(residueFromLoci(loci)))).toMatchObject({ status: 'mapped', candidates: [{ accession: 'P01308', position: 90 }] });
    expect(mapping.fromSequence(1).status).toBe('unmapped');
    expect(mapping.fromSequence(60).status).toBe('unmapped');
    expect(mapping.fromSequence(110, 'C').status).toBe('mapped');
    expect(mapping.fromSequence(25, 'B').candidates[0]?.address.labelSeqId).toBe(1);
  });

  it('clears absent selections and refuses a multi-residue pick or incorrect model/author identity', () => {
    expect(residueFromLoci(EmptyLoci)).toBeNull();
    expect(residueFromLoci(index.lociFor(null))).toBeNull();
    expect(residueFromLoci(StructureElement.Loci.all(structure))).toBeNull();
    const first = required(index.coordinates[0]);
    expect(StructureElement.Loci.isEmpty(index.lociFor({ ...first, modelNum: 2 }))).toBe(true);
    expect(StructureElement.Loci.isEmpty(index.lociFor({ ...first, authAsymId: 'wrong' }))).toBe(true);
    expect(Object.isFrozen(index.coordinates)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('preserves a nonnumeric author ID from raw mmCIF despite integer coercion in the Mol* hierarchy', async () => {
    const source = required(structure.models[0]).sourceData;
    if (!MmcifFormat.is(source)) throw new Error('Expected real mmCIF source');
    const atomSite = required(source.data.frame.categories.atom_site);
    const fields = Object.fromEntries(atomSite.fieldNames.map(name => [name, atomSite.getField(name)]));
    fields.auth_seq_id = CifField.ofStrings(Array.from({ length: atomSite.rowCount }, (_, i) => required(atomSite.getField('label_asym_id')).str(i) === 'A' && required(atomSite.getField('label_seq_id')).int(i) === 1 ? 'author-X' : required(atomSite.getField('auth_seq_id')).str(i)));
    const frame = { ...source.data.frame, categories: { ...source.data.frame.categories, atom_site: CifCategory.ofFields('atom_site', fields) } };
    const trajectory = await trajectoryFromMmCIF(frame).run();
    const modified = indexStructureResidues(Structure.ofModel(await Task.resolveInContext(trajectory.getFrameAtIndex(0))));
    const address = required(modified.coordinates.find(row => row.labelAsymId === 'A' && row.labelSeqId === 1));
    expect(address.authSeqId).toBe('author-X');
    expect(residueFromLoci(modified.lociFor(address))?.authSeqId).toBe('author-X');
  });

  it('rejects transformed assembly coordinates until an operator-aware contract is provided', () => {
    const transformed = Structure.transform(structure, Mat4.fromTranslation(Mat4(), Vec3.create(1, 0, 0)));
    expect(() => indexStructureResidues(transformed)).toThrow('asymmetric unit');
    expect(residueFromLoci(StructureElement.Loci.all(transformed))).toBeNull();
  });
});

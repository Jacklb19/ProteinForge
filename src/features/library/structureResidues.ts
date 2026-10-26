import { OrderedSet, SortedArray } from 'molstar/lib/mol-data/int';
import { Column } from 'molstar/lib/mol-data/db';
import { MmcifFormat } from 'molstar/lib/mol-model-formats/structure/mmcif';
import type { Loci } from 'molstar/lib/mol-model/loci';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import type { Structure } from 'molstar/lib/mol-model/structure';
import { coordinateResidueSchema, MAX_MAPPING_RESIDUES, residueAddressKey } from './residueMapping';
import type { CoordinateResidue } from './residueMapping';

/** Bounds the extra atom-index allocation; this is a technical budget, not a scientific limit. */
export const MAX_INDEXED_ATOMS = 1_000_000;

function authorId(location: StructureElement.Location): string | null {
  const source = location.unit.model.sourceData;
  if (!MmcifFormat.is(source)) return null;
  const field = source.data.frame.categories.atom_site?.getField('auth_seq_id');
  const sourceIndex = StructureProperties.atom.sourceIndex(location);
  return field?.valueKind(sourceIndex) === Column.ValueKind.Present ? field.str(sourceIndex) : null;
}

function coordinate(location: StructureElement.Location): CoordinateResidue | null {
  if (!Unit.isAtomic(location.unit) || !location.unit.conformation.operator.isIdentity || StructureProperties.entity.type(location) !== 'polymer') return null;
  const residueIndex = location.unit.model.atomicHierarchy.residueAtomSegments.index[location.element];
  if (residueIndex === undefined) return null;
  const insertionCode = StructureProperties.residue.pdbx_PDB_ins_code(location);
  // Mol*'s hierarchy coerces auth_seq_id to an integer. Preserve the original mmCIF
  // string instead, so a nonnumeric author identifier cannot silently become zero.
  const source = location.unit.model.sourceData;
  if (!MmcifFormat.is(source)) return null;
  const address = coordinateResidueSchema.safeParse({
    modelNum: location.unit.model.modelNum,
    entityId: StructureProperties.chain.label_entity_id(location),
    labelAsymId: StructureProperties.chain.label_asym_id(location),
    authAsymId: StructureProperties.chain.auth_asym_id(location),
    labelSeqId: StructureProperties.residue.label_seq_id(location),
    authSeqId: authorId(location),
    insertionCode: insertionCode === '.' || insertionCode === '?' ? '' : insertionCode,
  });
  return address.success ? address.data : null;
}
function key(address: CoordinateResidue): string { return `${String(address.modelNum)}:${residueAddressKey(address)}`; }

/** Read exactly one picked polymer residue; multi-residue/coarse/symmetry picks have no unique address. */
export function residueFromLoci(loci: Loci): CoordinateResidue | null {
  if (!StructureElement.Loci.is(loci)) return null;
  const matches = new Map<string, CoordinateResidue>();
  const location = StructureElement.Location.create(loci.structure);
  for (const element of loci.elements) {
    location.unit = element.unit;
    for (let i = 0, size = OrderedSet.size(element.indices); i < size; i += 1) {
      const atom = element.unit.elements[OrderedSet.getAt(element.indices, i)];
      if (atom === undefined) return null;
      location.element = atom;
      const address = coordinate(location);
      if (!address) return null;
      matches.set(key(address), address);
      if (matches.size > 1) return null;
    }
  }
  return matches.values().next().value ?? null;
}

/** Index the actual asymmetric-unit coordinates once, including all alternate atoms of each residue. */
export function indexStructureResidues(structure: Structure) {
  if (structure.elementCount > MAX_INDEXED_ATOMS) throw new Error('Too many atoms for residue selection index');
  const entries = new Set(structure.models.map(model => model.entryId.toUpperCase()));
  const pdbId = entries.values().next().value;
  if (entries.size !== 1 || !pdbId || !/^[0-9][A-Z0-9]{3}$/.test(pdbId)) throw new Error('Residue index requires one PDB entry');
  const addresses = new Map<string, CoordinateResidue>();
  const internalIdentities = new Map<string, string>();
  const lociElements = new Map<string, StructureElement.Loci['elements'][number][]>();
  const location = StructureElement.Location.create(structure);
  for (const unit of structure.units) {
    if (!unit.conformation.operator.isIdentity) throw new Error('Residue index requires the asymmetric unit');
    const indices = new Map<string, number[]>();
    location.unit = unit;
    let previousResidue = -1;
    let address: CoordinateResidue | null = null;
    for (let i = 0; i < unit.elements.length; i += 1) {
      const atom = unit.elements[i];
      if (atom === undefined) continue;
      location.element = atom;
      const residueIndex = Unit.isAtomic(unit) ? unit.model.atomicHierarchy.residueAtomSegments.index[atom] : undefined;
      if (residueIndex === undefined || residueIndex !== previousResidue) {
        address = coordinate(location);
        previousResidue = residueIndex ?? -1;
      }
      if (!address) continue;
      // Numeric coercion can merge distinct textual author IDs in Mol*'s residue table.
      // Never include atoms with a different original ID in the same selectable locus.
      if (authorId(location) !== address.authSeqId) throw new Error('Conflicting coordinate author identity');
      const id = key(address);
      if (!addresses.has(id)) {
        const internalKey = JSON.stringify([address.modelNum, address.labelAsymId, address.labelSeqId]);
        if (internalIdentities.has(internalKey) && internalIdentities.get(internalKey) !== id) throw new Error('Conflicting coordinate author identity');
        internalIdentities.set(internalKey, id);
        if (addresses.size >= MAX_MAPPING_RESIDUES) throw new Error('Too many coordinate residues');
        addresses.set(id, Object.freeze(address));
      }
      const atoms = indices.get(id) ?? [];
      atoms.push(i); indices.set(id, atoms);
    }
    for (const [id, atoms] of indices) {
      const elements = lociElements.get(id) ?? [];
      elements.push({ unit, indices: OrderedSet.ofSortedArray(SortedArray.ofSortedArray<StructureElement.UnitIndex>(atoms)) });
      lociElements.set(id, elements);
    }
  }
  return {
    pdbId,
    coordinates: Object.freeze([...addresses.values()]),
    lociFor(address: CoordinateResidue | null): StructureElement.Loci {
      return StructureElement.Loci(structure, address ? lociElements.get(key(coordinateResidueSchema.parse(address))) ?? [] : []);
    },
  };
}

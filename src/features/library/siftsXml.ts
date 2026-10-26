import { z } from 'zod';
import { MAX_MAPPING_RESIDUES, MAX_SIFTS_XML_CHARACTERS, residueMappingSchema } from './residueMapping';
import type { ResidueMappingDocument, ResidueMappingRow } from './residueMapping';

const namespace = 'http://www.ebi.ac.uk/pdbe/docs/sifts/eFamily.xsd';
const moleculeSchema = z.object({ entity_id: z.number().int().positive(), chains: z.unknown() });
const chainSchema = z.object({ chain_id: z.string().min(1).max(128), struct_asym_id: z.string().min(1).max(128), residues: z.unknown() });
const listingResidueSchema = z.object({
  residue_number: z.number().int().positive().max(MAX_MAPPING_RESIDUES), residue_name: z.string().min(1).max(128),
  author_residue_number: z.union([z.number().int(), z.string().min(1).max(128)]).nullable(), author_insertion_code: z.string().max(16),
});
type ListingMatch = { entityId: string; labelAsymId: string; residue: z.infer<typeof listingResidueSchema> };

function listingLookup(input: unknown, pdbId: string): Map<string, ListingMatch | null> {
  const value = z.object({ [pdbId]: z.unknown() }).parse(input)[pdbId];
  const listing = z.object({ molecules: z.unknown() }).parse(value);
  let nodes = 0;
  let residueCount = 0;
  function array(input: unknown): unknown[] {
    if (!Array.isArray(input)) throw new Error('Invalid PDBe residue listing');
    // Count containers as well as residues before visiting/cloning their members.
    if (input.length > 3 * MAX_MAPPING_RESIDUES - nodes) throw new Error('Oversized PDBe residue listing');
    nodes += input.length;
    return input;
  }
  const lookup = new Map<string, ListingMatch | null>();
  for (const moleculeInput of array(listing.molecules)) {
    const molecule = moleculeSchema.parse(moleculeInput);
    for (const chainInput of array(molecule.chains)) {
      const chain = chainSchema.parse(chainInput);
      if (Array.isArray(chain.residues) && chain.residues.length > MAX_MAPPING_RESIDUES - residueCount) throw new Error('Oversized PDBe residue listing');
      for (const residueInput of array(chain.residues)) {
        residueCount += 1;
        const residue = listingResidueSchema.parse(residueInput);
        const author = residue.author_residue_number === null ? 'null' : `${String(residue.author_residue_number)}${residue.author_insertion_code}`;
        const key = JSON.stringify([chain.chain_id, residue.residue_number, author, residue.residue_name]);
        // A duplicate remains ambiguous, without accumulating a quadratic array of candidates.
        lookup.set(key, lookup.has(key) ? null : { entityId: String(molecule.entity_id), labelAsymId: chain.struct_asym_id, residue });
      }
    }
  }
  return lookup;
}

function attribute(element: Element, name: string): string {
  const value = element.getAttribute(name);
  if (!value) throw new Error(`Missing SIFTS attribute: ${name}`);
  return value;
}
function integer(value: string): number {
  if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid SIFTS number');
  return Number(value);
}
function elements(parent: Element, name: string): Element[] {
  return [...parent.getElementsByTagNameNS(namespace, name)];
}

/** Offline adapter for SIFTS residue XML + PDBe residue_listing. Never interpolate segment endpoints.
 * PDBe internal numbers are joined explicitly; author IDs and residue names must corroborate them.
 * Coordinate observation is determined later from the actual displayed model, not observed_ratio.
 */
export function mappingFromSiftsXml(xml: string, listingInput: unknown, pdbId: string, retrievedAt: string): ResidueMappingDocument {
  residueMappingSchema.shape.pdbId.parse(pdbId);
  residueMappingSchema.shape.provenance.shape.retrievedAt.parse(retrievedAt);
  if (xml.length > MAX_SIFTS_XML_CHARACTERS || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsafe or oversized SIFTS XML');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const entry = parsed.documentElement;
  if (parsed.getElementsByTagName('parsererror').length || entry.localName !== 'entry' || entry.namespaceURI !== namespace || attribute(entry, 'dbAccessionId').toUpperCase() !== pdbId) throw new Error('Invalid SIFTS entry');
  const lookup = listingLookup(listingInput, pdbId.toLowerCase());
  const rows: ResidueMappingRow[] = [];
  const residues = elements(entry, 'residue');
  if (residues.length > MAX_MAPPING_RESIDUES) throw new Error('Oversized SIFTS residue listing');
  for (const residue of residues) {
    const refs = elements(residue, 'crossRefDb');
    const uniprot = refs.filter(ref => ref.getAttribute('dbSource') === 'UniProt');
    if (!uniprot.length) continue;
    if (attribute(residue, 'dbSource') !== 'PDBe' || attribute(residue, 'dbCoordSys') !== 'PDBe') throw new Error('Unsupported SIFTS coordinates');
    const pdbRefs = refs.filter(ref => ref.getAttribute('dbSource') === 'PDB');
    const pdb = pdbRefs[0];
    if (pdbRefs.length !== 1 || !pdb || attribute(pdb, 'dbAccessionId').toUpperCase() !== pdbId || attribute(pdb, 'dbCoordSys') !== 'PDBresnum') throw new Error('Invalid SIFTS PDB reference');
    const authAsymId = attribute(pdb, 'dbChainId');
    const labelSeqId = integer(attribute(residue, 'dbResNum'));
    const authorNumber = attribute(pdb, 'dbResNum');
    // The listing separates author IDs from insertions; splitting SIFTS "12A" by a regexp
    // would assume author IDs are numeric, which the mmCIF dictionary does not require.
    const match = lookup.get(JSON.stringify([authAsymId, labelSeqId, authorNumber, attribute(pdb, 'dbResName')]));
    if (!match) throw new Error('Missing or ambiguous PDBe residue identity');
    const authSeqId = match.residue.author_residue_number === null ? null : String(match.residue.author_residue_number);
    const insertionCode = match.residue.author_insertion_code;
    const segment = residue.parentElement?.parentElement;
    if (segment?.localName !== 'segment' || segment.namespaceURI !== namespace) throw new Error('Invalid SIFTS segment');
    const notObserved = elements(residue, 'residueDetail').some(detail => detail.getAttribute('dbSource') === 'PDBe' && detail.getAttribute('property') === 'Annotation' && detail.textContent.trim().toLowerCase() === 'not_observed');
    for (const ref of uniprot) {
      if (rows.length >= MAX_MAPPING_RESIDUES || attribute(ref, 'dbCoordSys') !== 'UniProt') throw new Error('Invalid SIFTS UniProt reference');
      rows.push({ entityId: match.entityId, labelAsymId: match.labelAsymId, authAsymId, labelSeqId, authSeqId, insertionCode,
        segmentId: attribute(segment, 'segId'), accession: attribute(ref, 'dbAccessionId'), position: integer(attribute(ref, 'dbResNum')), residue: attribute(ref, 'dbResName'), notObserved });
    }
  }
  return residueMappingSchema.parse({ version: 1, pdbId, rows, provenance: {
    provider: 'PDBe/SIFTS', xmlUrl: `https://ftp.ebi.ac.uk/pub/databases/msd/sifts/xml/${pdbId.toLowerCase()}.xml.gz`,
    residueListingUrl: `https://www.ebi.ac.uk/pdbe/api/pdb/entry/residue_listing/${pdbId.toLowerCase()}`,
    retrievedAt, releaseDate: attribute(entry, 'date'),
  } });
}

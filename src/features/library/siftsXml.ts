import { z } from 'zod';
import { MAX_MAPPING_RESIDUES, MAX_SIFTS_XML_CHARACTERS, residueMappingSchema } from './residueMapping';
import type { ResidueMappingDocument, ResidueMappingRow } from './residueMapping';

const namespace = 'http://www.ebi.ac.uk/pdbe/docs/sifts/eFamily.xsd';
const listingSchema = z.object({ molecules: z.array(z.object({
  entity_id: z.number().int().positive(),
  chains: z.array(z.object({
    chain_id: z.string().min(1), struct_asym_id: z.string().min(1),
    residues: z.array(z.object({
      residue_number: z.number().int().positive(), residue_name: z.string().min(1),
      author_residue_number: z.union([z.number().int(), z.string().min(1)]).nullable(), author_insertion_code: z.string(),
    })).max(MAX_MAPPING_RESIDUES),
  })).max(MAX_MAPPING_RESIDUES),
})).max(MAX_MAPPING_RESIDUES) });

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
  if (xml.length > MAX_SIFTS_XML_CHARACTERS || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsafe or oversized SIFTS XML');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const entry = parsed.documentElement;
  if (parsed.getElementsByTagName('parsererror').length || entry.localName !== 'entry' || entry.namespaceURI !== namespace || attribute(entry, 'dbAccessionId').toUpperCase() !== pdbId) throw new Error('Invalid SIFTS entry');
  const listing = listingSchema.parse(z.record(z.string(), z.unknown()).parse(listingInput)[pdbId.toLowerCase()]);
  const lookup = new Map<string, { entityId: string; labelAsymId: string; residue: z.infer<typeof listingSchema>['molecules'][number]['chains'][number]['residues'][number] }[]>();
  let count = 0;
  for (const molecule of listing.molecules) for (const chain of molecule.chains) for (const residue of chain.residues) {
    if (++count > MAX_MAPPING_RESIDUES) throw new Error('Oversized PDBe residue listing');
    const key = JSON.stringify([chain.chain_id, residue.residue_number]);
    lookup.set(key, [...(lookup.get(key) ?? []), { entityId: String(molecule.entity_id), labelAsymId: chain.struct_asym_id, residue }]);
  }
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
    const matches = (lookup.get(JSON.stringify([authAsymId, labelSeqId])) ?? []).filter(item => {
      const author = item.residue.author_residue_number;
      return (author === null ? 'null' : `${String(author)}${item.residue.author_insertion_code}`) === authorNumber && item.residue.residue_name === attribute(pdb, 'dbResName');
    });
    const match = matches[0];
    if (matches.length !== 1 || !match) throw new Error('Missing or ambiguous PDBe residue identity');
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

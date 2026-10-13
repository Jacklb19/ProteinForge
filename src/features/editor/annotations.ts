import type { TranslationKey } from '../../i18n';
import type { SequenceSource } from './source';

/** A named stretch of a reference sequence; `mature` regions remain in the finished protein. */
export interface SequenceRegion {
  start: number;
  end: number;
  labelKey: TranslationKey;
  shortKey: TranslationKey;
  mature: boolean;
  /** Chain identifier of this region in the measured structure, when it has one. */
  chain?: string;
}

export interface SequenceAnnotations {
  accession: string;
  nameKey: TranslationKey;
  organism: string;
  regions: readonly SequenceRegion[];
  /** Disulfide bridges as pairs of one-based positions. */
  disulfides: readonly (readonly [number, number])[];
  /** Residue selected when the reference opens, so the linked views show what a selection does. */
  highlight: number;
}

/**
 * Feature annotations of bundled references, copied from their UniProt entries.
 * P01308 (INS_HUMAN): signal peptide, B chain, C peptide, A chain and disulfide bonds, consulted on 2026-10-12.
 */
const ANNOTATIONS: readonly SequenceAnnotations[] = [
  {
    accession: 'P01308',
    nameKey: 'examples.insulinName',
    organism: 'Homo sapiens',
    regions: [
      { start: 1, end: 24, labelKey: 'regions.signal', shortKey: 'regions.signalShort', mature: false },
      { start: 25, end: 54, labelKey: 'regions.chainB', shortKey: 'regions.chainBShort', mature: true, chain: 'B' },
      { start: 57, end: 87, labelKey: 'regions.peptideC', shortKey: 'regions.peptideCShort', mature: false },
      { start: 90, end: 110, labelKey: 'regions.chainA', shortKey: 'regions.chainAShort', mature: true, chain: 'A' },
    ],
    disulfides: [[31, 96], [43, 109], [95, 100]],
    highlight: 96,
  },
];

export function annotationsForAccession(accession: string): SequenceAnnotations | null {
  return ANNOTATIONS.find((entry) => entry.accession === accession) ?? null;
}

/** Annotations for an exact bundled reference; an edited or pasted sequence has none. */
export function annotationsFor(source: SequenceSource | null): SequenceAnnotations | null {
  return source ? annotationsForAccession(source.accession) : null;
}

/** Region containing a one-based position, if any. */
export function regionAt(annotations: SequenceAnnotations, position: number): SequenceRegion | undefined {
  return annotations.regions.find((region) => position >= region.start && position <= region.end);
}

/** The other end of the disulfide bridge that starts at this position, if any. */
export function disulfidePartner(annotations: SequenceAnnotations, position: number): number | undefined {
  for (const [first, second] of annotations.disulfides) {
    if (first === position) return second;
    if (second === position) return first;
  }
  return undefined;
}

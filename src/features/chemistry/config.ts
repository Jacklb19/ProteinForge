import type { TranslationKey } from '../../i18n';

/** Side-chain chemistry classes; the order is the legend order. Every interface hue maps to one of them. */
export const RESIDUE_CLASSES = ['hydrophobic', 'polar', 'acidic', 'basic', 'special', 'cysteine'] as const;
export type ResidueClass = (typeof RESIDUE_CLASSES)[number];

/** One-letter codes per class. Ambiguous or rare residues (U, O, B, Z, X) stay unclassified. */
export const RESIDUE_CLASS_MEMBERS: Record<ResidueClass, string> = {
  hydrophobic: 'AVLIMFW',
  polar: 'STNQY',
  acidic: 'DE',
  basic: 'KRH',
  special: 'GP',
  cysteine: 'C',
};

export const RESIDUE_CLASS_LABEL_KEYS = {
  hydrophobic: 'chemistry.hydrophobic',
  polar: 'chemistry.polar',
  acidic: 'chemistry.acidic',
  basic: 'chemistry.basic',
  special: 'chemistry.special',
  cysteine: 'chemistry.cysteine',
} as const satisfies Record<ResidueClass, TranslationKey>;

/** Design tokens holding the strong color of each class, for canvas drawings. */
export const RESIDUE_CLASS_TOKENS: Record<ResidueClass, string> = {
  hydrophobic: '--residue-hydrophobic',
  polar: '--residue-polar',
  acidic: '--residue-acidic',
  basic: '--residue-basic',
  special: '--residue-special',
  cysteine: '--residue-cysteine',
};

/** Three-letter names shown next to a selected residue. */
export const RESIDUE_NAMES: Readonly<Record<string, string>> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile',
  L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
};

const CLASS_BY_RESIDUE = new Map<string, ResidueClass>(
  RESIDUE_CLASSES.flatMap((name) => Array.from(RESIDUE_CLASS_MEMBERS[name], (residue) => [residue, name] as const)),
);

/** Chemistry class of a one-letter residue, or `undefined` when it has none. */
export function residueClass(residue: string): ResidueClass | undefined {
  return CLASS_BY_RESIDUE.get(residue);
}

/** Residues per class, in legend order. */
export function classComposition(sequence: string): Record<ResidueClass, number> {
  const counts = Object.fromEntries(RESIDUE_CLASSES.map((name) => [name, 0])) as Record<ResidueClass, number>;
  for (const residue of sequence) {
    const name = residueClass(residue);
    if (name) counts[name] += 1;
  }
  return counts;
}

/** Geometry of the disulfide arcs above the ribbon, in viewBox units: longer bridges rise higher, up to a limit. */
export const RIBBON_ARC = { height: 34, base: 8, slope: 0.34, limit: 30, control: 1.3 } as const;

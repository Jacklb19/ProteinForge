import { DIPEPTIDE_WEIGHTS } from './dipeptides';
import { translate } from '../../i18n/translate';

/** Results calculated from a complete sequence of twenty standard amino acids. */
export interface Descriptors {
  massDa: number;
  isoelectricPoint: number;
  instabilityIndex: number;
  aliphaticIndex: number;
  gravy: number;
  length: number;
}

/** Average residue and water masses from ExPASy FindMod, in daltons. */
const RESIDUE_MASS: Record<string, number> = {
  A: 71.0788, C: 103.1388, D: 115.0886, E: 129.1155, F: 147.1766,
  G: 57.0519, H: 137.1411, I: 113.1594, K: 128.1741, L: 113.1594,
  M: 131.1926, N: 114.1038, P: 97.1167, Q: 128.1307, R: 156.1875,
  S: 87.0782, T: 101.1051, V: 99.1326, W: 186.2132, Y: 163.1760,
};
const WATER_MASS = 18.01524;

/** Kyte–Doolittle (1982) hydropathy scale shared with the profile. */
export const HYDROPATHY: Readonly<Record<string, number>> = {
  A: 1.8, C: 2.5, D: -3.5, E: -3.5, F: 2.8,
  G: -0.4, H: -3.2, I: 4.5, K: -3.9, L: 3.8,
  M: 1.9, N: -3.5, P: -1.6, Q: -3.5, R: -4.5,
  S: -0.8, T: -0.7, V: 4.2, W: -0.9, Y: -1.3,
};

const POSITIVE_PKA: Record<string, number> = { K: 10, R: 12, H: 5.98 };
const NEGATIVE_PKA: Record<string, number> = { D: 4.05, E: 4.45, C: 9, Y: 10 };
const N_TERMINAL_PKA: Record<string, number> = {
  A: 7.59, M: 7, S: 6.93, P: 8.36, T: 6.82, V: 7.44, E: 7.7,
};
const C_TERMINAL_PKA: Record<string, number> = { D: 4.55, E: 4.75 };

function chargeAtPh(
  ph: number,
  counts: Readonly<Record<string, number>>,
  pkN: number,
  pkC: number,
): number {
  let charge = 1 / (1 + 10 ** (ph - pkN)) - 1 / (1 + 10 ** (pkC - ph));
  for (const [residue, pk] of Object.entries(POSITIVE_PKA)) {
    charge += (counts[residue] ?? 0) / (1 + 10 ** (ph - pk));
  }
  for (const [residue, pk] of Object.entries(NEGATIVE_PKA)) {
    charge -= (counts[residue] ?? 0) / (1 + 10 ** (pk - ph));
  }
  return charge;
}

function isoelectricPoint(sequence: string, counts: Readonly<Record<string, number>>): number {
  const pkN = N_TERMINAL_PKA[sequence[0] ?? ''] ?? 7.5;
  const pkC = C_TERMINAL_PKA[sequence.at(-1) ?? ''] ?? 3.55;
  let minimum = 4.05;
  let maximum = 12;
  while (maximum - minimum > 0.0001) {
    const middle = (minimum + maximum) / 2;
    if (chargeAtPh(middle, counts, pkN, pkC) > 0) minimum = middle;
    else maximum = middle;
  }
  return (minimum + maximum) / 2;
}

/** Calculates RF-03 descriptors and rejects empty or invalid inputs. */
export function calculateDescriptors(sequence: string): Descriptors {
  if (sequence.length === 0 || /[^ACDEFGHIKLMNPQRSTVWY]/.test(sequence)) {
    throw new RangeError(translate('es', 'errors.standardResidues'));
  }

  const counts: Record<string, number> = {};
  let massDa = WATER_MASS;
  let hydropathySum = 0;
  let instabilitySum = 0;
  for (let index = 0; index < sequence.length; index += 1) {
    const residue = sequence[index] ?? '';
    counts[residue] = (counts[residue] ?? 0) + 1;
    massDa += RESIDUE_MASS[residue] ?? 0;
    hydropathySum += HYDROPATHY[residue] ?? 0;
    if (index + 1 < sequence.length) {
      const next = sequence[index + 1] ?? '';
      instabilitySum += DIPEPTIDE_WEIGHTS[residue]?.[next] ?? 0;
    }
  }
  const length = sequence.length;
  return {
    massDa,
    isoelectricPoint: isoelectricPoint(sequence, counts),
    instabilityIndex: (10 * instabilitySum) / length,
    aliphaticIndex: (100 * ((counts.A ?? 0) + 2.9 * (counts.V ?? 0)
      + 3.9 * ((counts.I ?? 0) + (counts.L ?? 0)))) / length,
    gravy: hydropathySum / length,
    length,
  };
}

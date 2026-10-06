import { HYDROPATHY } from './descriptors';
import { translate } from '../../i18n/translate';

/** Supported Kyte–Doolittle windows, excluding incomplete edge windows. */
export type HydropathyWindow = 9 | 19;

/** Hydropathy value assigned to the center residue at a one-based position. */
export interface ProfilePoint {
  position: number;
  value: number | null;
}

/** Calculates equally weighted complete-window means as ProtScale does. */
export function calculateProfile(sequence: string, windowSize: HydropathyWindow): ProfilePoint[] {
  if (sequence.length === 0 || /[^ACDEFGHIKLMNPQRSTVWYUOBZX]/.test(sequence)) {
    throw new RangeError(translate('es', 'errors.invalidResidues'));
  }
  if (![9, 19].includes(windowSize)) {
    throw new RangeError(translate('es', 'errors.invalidWindow'));
  }
  if (sequence.length < windowSize) return [];

  let sum = 0;
  let missingCount = 0;
  for (let index = 0; index < windowSize; index += 1) {
    const value = HYDROPATHY[sequence[index] ?? ''];
    if (value === undefined) missingCount += 1;
    else sum += value;
  }
  const points: ProfilePoint[] = [{ position: (windowSize + 1) / 2, value: missingCount > 0 ? null : sum / windowSize }];
  for (let start = 1; start + windowSize <= sequence.length; start += 1) {
    const leaving = HYDROPATHY[sequence[start - 1] ?? ''];
    const entering = HYDROPATHY[sequence[start + windowSize - 1] ?? ''];
    if (leaving === undefined) missingCount -= 1;
    else sum -= leaving;
    if (entering === undefined) missingCount += 1;
    else sum += entering;
    points.push({ position: start + (windowSize + 1) / 2, value: missingCount > 0 ? null : sum / windowSize });
  }
  return points;
}

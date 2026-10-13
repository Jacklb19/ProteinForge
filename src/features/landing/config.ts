import type { TranslationKey } from '../../i18n';
import type { Descriptors } from '../descriptors/descriptors';

/** Descriptors quoted next to the profile; a unit or a short label says what each number is. */
export const HERO_FACTS: readonly { key: keyof Descriptors; shortKey?: TranslationKey }[] = [
  { key: 'massDa' },
  { key: 'isoelectricPoint', shortKey: 'landing.factPi' },
  { key: 'gravy', shortKey: 'descriptors.gravy' },
];

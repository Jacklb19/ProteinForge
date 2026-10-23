import type { TranslationKey } from '../../i18n';
import { RESIDUE_CLASSES, RESIDUE_CLASS_LABEL_KEYS, residueClass } from '../chemistry/config';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import type { Descriptors } from '../descriptors/descriptors';
import type { LabDraft, LabVariant } from '../design-lab/types';
import { MAX_FACTS } from './config';
import type { Fact } from './assistantApi';

/** What a screen lends the builders: its own labels and its own number formatting. */
export interface FactWriter {
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const COUNT: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
const PLDDT: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const ANGSTROM: Intl.NumberFormatOptions = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
const PTM: Intl.NumberFormatOptions = { minimumFractionDigits: 3, maximumFractionDigits: 3 };

function fact(label: string, value: string, unit?: string): Fact {
  return unit ? { label, value, unit } : { label, value };
}

/**
 * The descriptors, the composition and the profile window exactly as the screen prints them, so the
 * reading can only repeat figures the reader is looking at.
 */
export function analysisFacts({ t, formatNumber }: FactWriter, sequence: string, descriptors: Descriptors, profileWindow: number): Fact[] {
  const counts = new Map<string, number>();
  for (const residue of sequence) {
    const chemistry = residueClass(residue);
    if (chemistry) counts.set(chemistry, (counts.get(chemistry) ?? 0) + 1);
  }
  return [
    fact(t('assistant.factLength'), formatNumber(descriptors.length, COUNT), t('assistant.unitResidues')),
    ...DESCRIPTOR_FIELDS.map((field) => fact(
      t(field.labelKey),
      formatNumber(descriptors[field.key], field.format),
      field.unitKey ? t(field.unitKey) : undefined,
    )),
    ...RESIDUE_CLASSES.map((chemistry) => fact(
      t('assistant.factComposition', { chemistry: t(RESIDUE_CLASS_LABEL_KEYS[chemistry]) }),
      formatNumber(counts.get(chemistry) ?? 0, COUNT),
      t('assistant.unitResidues'),
    )),
    fact(t('assistant.factWindow'), formatNumber(profileWindow, COUNT), t('assistant.unitResidues')),
  ].slice(0, MAX_FACTS);
}

/**
 * The measurements of the active variant. An edited draft has no prediction behind it any more, so
 * its figures are left out instead of being passed off as results.
 */
export function laboratoryFacts({ t, formatNumber }: FactWriter, variant: LabVariant, draft: LabDraft, referenceId: string): Fact[] {
  const modified = draft.sequence !== variant.sequence;
  return [
    fact(t('assistant.factSample'), t('lab.variant', { sample: variant.sample })),
    fact(t('assistant.factReference'), referenceId),
    fact(t('assistant.factLength'), formatNumber(draft.sequence.length, COUNT), t('assistant.unitResidues')),
    ...(modified ? [] : [
      fact(t('lab.meanConfidence'), formatNumber(variant.meanPlddt, PLDDT)),
      fact(t('assistant.factRmsd'), formatNumber(variant.rmsd, ANGSTROM), t('units.angstrom')),
      fact(t('assistant.factPtm'), formatNumber(variant.ptm, PTM)),
      fact(t('assistant.factIdentity'), t('assistant.factIdentityValue', {
        identical: formatNumber(variant.identicalPositions, COUNT),
        length: formatNumber(variant.sequence.length, COUNT),
      })),
    ]),
    fact(t('assistant.factProtected'), formatNumber(draft.protectedPositions.length, COUNT)),
    ...(modified ? [fact(t('assistant.factDraft'), t('assistant.factDraftValue'))] : []),
  ].slice(0, MAX_FACTS);
}

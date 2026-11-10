import { useId, useState } from 'react';
import { useTranslation } from '../../i18n';
import { RESIDUE_NAMES } from '../chemistry/config';
import { DESCRIPTOR_FIELDS } from './config';
import type { Descriptors } from './descriptors';
import { substitute } from './mutation';
import { useDescriptors } from './useDescriptors';
import type { DescriptorState } from './useDescriptors';

const RESIDUES = Object.keys(RESIDUE_NAMES);

/** Each property before and after the substitution, with the signed difference. */
export function MutationFigures({ caption, current, next }: { caption: string; current: Descriptors; next: Descriptors }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  return <div className="generator-table">
    <table>
      <caption>{caption}</caption>
      <thead><tr><th scope="col">{t('mutation.property')}</th><th scope="col">{t('mutation.current')}</th><th scope="col">{t('mutation.mutated')}</th><th scope="col">{t('mutation.delta')}</th></tr></thead>
      <tbody>
        {DESCRIPTOR_FIELDS.map((field) => {
          const before = current[field.key], after = next[field.key];
          const unit = field.unitKey ? ` ${t(field.unitKey)}` : '';
          return <tr key={field.key}>
            <th scope="row">{t(field.labelKey)}</th>
            <td className="numeric" data-label={t('mutation.current')}>{formatNumber(before, field.format)}{unit}</td>
            <td className="numeric" data-label={t('mutation.mutated')}>{formatNumber(after, field.format)}{unit}</td>
            <td className="numeric" data-label={t('mutation.delta')}>{formatNumber(after - before, { ...field.format, signDisplay: 'exceptZero' })}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

/**
 * Under the sequence reader: what replacing the selected residue would do to the calculated properties,
 * before touching the draft. The second calculation runs in its own Worker, like the first.
 */
export function MutationPreview({ sequence, selected, base, onApply }: { sequence: string; selected: number | null; base: DescriptorState; onApply: (sequence: string) => void }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const id = useId();
  const residue = selected === null ? '' : sequence[selected - 1] ?? '';
  const [choice, setChoice] = useState(RESIDUES[0] ?? '');
  // The same residue changes nothing, so the choice steps to the next one.
  const replacement = choice === residue ? RESIDUES.find(letter => letter !== residue) ?? choice : choice;
  const mutated = selected !== null && residue ? substitute(sequence, selected, replacement) : null;
  const next = useDescriptors(mutated ?? '');
  const before = base.status === 'current' ? base.result : null;
  const after = next.status === 'current' ? next.result : null;
  return <section className="mutation-preview" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{t('mutation.title')}</h3>
    {!mutated || selected === null ? <p className="field-help">{t('mutation.empty')}</p> : <>
      <div className="mutation-controls">
        <label className="field" htmlFor={`${id}-residue`}>
          <span>{t('mutation.replace', { residue: RESIDUE_NAMES[residue] ?? residue, position: formatNumber(selected) })}</span>
          <select id={`${id}-residue`} className="text-input" value={replacement} onChange={(event) => { setChoice(event.target.value); }}>
            {RESIDUES.filter(letter => letter !== residue).map(letter => <option key={letter} value={letter}>{letter} · {RESIDUE_NAMES[letter]}</option>)}
          </select>
        </label>
        <button type="button" className="button button-secondary" onClick={() => { onApply(mutated); }}>{t('mutation.apply')}</button>
      </div>
      {before && after
        ? <MutationFigures caption={t('mutation.caption', { from: residue, position: formatNumber(selected), to: replacement })} current={before} next={after} />
        : <p className="status-message" role="status">{t('descriptors.calculating')}</p>}
      <p className="field-help">{t('mutation.scope')}</p>
    </>}
  </section>;
}

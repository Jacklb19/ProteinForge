import type { DescriptorState } from './useDescriptors';
import { DESCRIPTOR_FIELDS } from './config';
import { useTranslation } from '../../i18n';

/**
 * Displays the descriptors with a short reading of each one and marks stale results. Before the first
 * result the same fields hold a pending mark, so the values arrive without moving what follows.
 */
export function DescriptorPanel({ data }: { data: DescriptorState }): React.JSX.Element {
  const { t, formatNumber, localize } = useTranslation();
  const { result, status, error, excluded } = data;
  const stale = result !== null && status !== 'current';
  const pending = result === null && status === 'calculating';
  return (
    <section aria-labelledby="descriptors-title" className="descriptor-panel rail-properties">
      <h2 id="descriptors-title">{t('descriptors.title')}</h2>
      {excluded > 0 && <p className="notice" role="note">{t(excluded === 1 ? 'descriptors.excludedOne' : 'descriptors.excluded', { count: formatNumber(excluded) })}</p>}
      <p className="status-message" data-state={status} role="status" aria-live="polite">
        {status === 'invalid' && t('descriptors.invalid')}
        {status === 'calculating' && t('descriptors.calculating')}
        {status === 'error' && (error ? t('descriptors.workerMessage', { message: localize(error) }) : t('descriptors.error'))}
        {status === 'empty' && (excluded > 0 ? t('descriptors.noStandard') : t('descriptors.empty'))}
      </p>
      {(result || pending) && (
        <dl className={`property-list${stale ? ' stale-descriptors' : ''}`} aria-busy={pending || undefined}>
          {DESCRIPTOR_FIELDS.map((field) => (
            <div key={field.key} className={result ? 'property' : 'property-pending'}>
              <dt>{t(field.labelKey)}</dt>
              <dd>{result
                ? <>{formatNumber(result[field.key], field.format)}{field.unitKey ? <> <span className="property-unit">{t(field.unitKey)}</span></> : ''}</>
                : <span aria-hidden="true">{t('descriptors.pendingValue')}</span>}<span className="descriptor-explanation">{t(field.helpKey)}</span></dd>
            </div>
          ))}
        </dl>
      )}
      {result && <details className="disclosure"><summary>{t('guide.methods')}</summary><ul className="field-help">{DESCRIPTOR_FIELDS.map((field) => <li key={field.key}>{t(field.labelKey)}: {t(field.methodKey)}</li>)}</ul></details>}
    </section>
  );
}

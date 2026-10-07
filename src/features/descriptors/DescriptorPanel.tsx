import type { DescriptorState } from './useDescriptors';
import { DESCRIPTOR_FIELDS } from './config';
import { useTranslation } from '../../i18n';

/** Displays the descriptors with their method and marks stale results. */
export function DescriptorPanel({ data }: { data: DescriptorState }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { result, status, error, excluded } = data;
  const stale = result !== null && status !== 'current';
  return (
    <section aria-labelledby="descriptors-title" className="analysis-section descriptor-panel">
      <h2 id="descriptors-title">{t('descriptors.title')}</h2>
      {excluded > 0 && <p className="notice" role="note">{t(excluded === 1 ? 'descriptors.excludedOne' : 'descriptors.excluded', { count: formatNumber(excluded) })}</p>}
      <p className="status-message" data-state={status} role="status" aria-live="polite">
        {status === 'invalid' && t('descriptors.invalid')}
        {status === 'calculating' && t('descriptors.calculating')}
        {status === 'error' && (error ? t('descriptors.workerMessage', { message: error }) : t('descriptors.error'))}
        {status === 'empty' && (excluded > 0 ? t('descriptors.noStandard') : t('descriptors.empty'))}
      </p>
      {result && (
        <dl className={`property-list${stale ? ' stale-descriptors' : ''}`}>
          {DESCRIPTOR_FIELDS.map((field) => (
            <div key={field.key} className="property">
              <dt>{t(field.labelKey)}<span className="property-method">{t(field.methodKey)}</span></dt>
              <dd>{formatNumber(result[field.key], field.format)}{field.unitKey ? ` ${t(field.unitKey)}` : ''}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="field-help">{t('descriptors.scope')}</p>
    </section>
  );
}

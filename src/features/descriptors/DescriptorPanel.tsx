import type { DescriptorState } from './useDescriptors';
import { useTranslation } from '../../i18n';

const TWO_DECIMALS = { maximumFractionDigits: 2, minimumFractionDigits: 2 } as const;
const THREE_DECIMALS = { maximumFractionDigits: 3, minimumFractionDigits: 3 } as const;

/** Displays five descriptors and marks stale results. */
export function DescriptorPanel({ data }: { data: DescriptorState }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { result, status, error, excluded } = data;
  const stale = result !== null && status !== 'current';
  return (
    <section aria-labelledby="descriptors-title" className="descriptor-panel panel">
      <h2 id="descriptors-title">{t('descriptors.title')}</h2>
      {excluded > 0 && <p className="notice" role="note">{t(excluded === 1 ? 'descriptors.excludedOne' : 'descriptors.excluded', { count: formatNumber(excluded) })}</p>}
      <p className="status-message" data-state={status} role="status" aria-live="polite">
        {status === 'invalid' && t('descriptors.invalid')}
        {status === 'calculating' && t('descriptors.calculating')}
        {status === 'error' && (error ? t('descriptors.workerMessage', { message: error }) : t('descriptors.error'))}
        {status === 'empty' && (excluded > 0 ? t('descriptors.noStandard') : t('descriptors.empty'))}
      </p>
      {result && (
        <dl className={stale ? 'stale-descriptors' : undefined}>
          <div><dt>{t('descriptors.mass')}</dt><dd>{formatNumber(result.massDa, TWO_DECIMALS)} {t('units.dalton')}</dd></div>
          <div><dt>{t('descriptors.isoelectricPoint')}</dt><dd>{formatNumber(result.isoelectricPoint, TWO_DECIMALS)}</dd></div>
          <div><dt>{t('descriptors.instabilityIndex')}</dt><dd>{formatNumber(result.instabilityIndex, TWO_DECIMALS)}</dd></div>
          <div><dt>{t('descriptors.aliphaticIndex')}</dt><dd>{formatNumber(result.aliphaticIndex, TWO_DECIMALS)}</dd></div>
          <div><dt>{t('descriptors.gravy')}</dt><dd>{formatNumber(result.gravy, THREE_DECIMALS)}</dd></div>
        </dl>
      )}
    </section>
  );
}

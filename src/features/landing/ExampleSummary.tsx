import { useTranslation } from '../../i18n';
import { DESIGN_ASSETS } from '../../shared/designAssets';
import { useDescriptors } from '../descriptors/useDescriptors';
import { exampleEntry } from '../editor/examples';
import { HERO_EXAMPLE, HERO_METRICS, HERO_WINDOW } from './config';

/** Example values use the same Worker as the workbench, rather than copied fixture numbers. */
export function ExampleSummary(): React.JSX.Element | null {
  const { t, formatNumber } = useTranslation();
  const sequence = HERO_EXAMPLE ? exampleEntry(HERO_EXAMPLE.fasta)?.sequence ?? '' : '';
  const descriptors = useDescriptors(sequence);
  const result = descriptors.result;
  if (!HERO_EXAMPLE) return null;

  return (
    <section className="example-summary" aria-labelledby="sample-title">
      <div className="sample-reference">
        <div>
          <p className="sample-accession">{t('landing.exampleLabel', { accession: HERO_EXAMPLE.accession })}</p>
          <h2 id="sample-title">{t(HERO_EXAMPLE.labelKey)}</h2>
          <p>{t('landing.exampleLength', { count: formatNumber(sequence.length) })}</p>
        </div>
        <figure className="sample-profile">
          <img src={DESIGN_ASSETS.profile} alt={t('landing.artLabel')} />
          <figcaption>{t('landing.profileCaption', { count: formatNumber(HERO_WINDOW) })}</figcaption>
        </figure>
      </div>
      {result ? (
        <dl className="sample-properties">
          {HERO_METRICS.map((field) => (
            <div key={field.key}>
              <dt><abbr title={t(field.labelKey)}>{t(field.shortLabelKey)}</abbr></dt>
              <dd>{formatNumber(result[field.key], field.format)}{field.unitKey && <> <span>{t(field.unitKey)}</span></>}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="sample-status" role="status">{t(descriptors.status === 'error' ? 'descriptors.error' : 'descriptors.calculating')}</p>}
      <p className="sample-caption">{t('landing.ornamentCaption')}</p>
    </section>
  );
}

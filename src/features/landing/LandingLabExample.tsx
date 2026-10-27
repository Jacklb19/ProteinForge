import { useTranslation } from '../../i18n';
import { BackboneView } from '../structure/BackboneView';
import { DEFAULT_COLOR_MODE } from '../structure/config';
import { traceModel } from '../design-lab/presentation';
import example from '../design-lab/fixtures/ubiquitin.json';

/** First stored redesign of the bundled ubiquitin example: its predicted Cα trace and the figures saved with it. */
export function LandingLabExample(): React.JSX.Element | null {
  const { t, formatNumber } = useTranslation();
  const sample = example.samples[0];
  if (!sample) return null;
  const model = traceModel(sample.sequenceSha256, sample.sequence, sample.keys, sample.ca as [number, number, number][]);
  return <figure className="public-evidence">
    <BackboneView label={t('public.labFigureLabel', { id: example.reference.id })} colorMode={DEFAULT_COLOR_MODE} model={model} showEnds />
    <figcaption>
      <strong>{t('public.labFigureTitle')}</strong>
      <span>{t('public.labFigureFacts', {
        confidence: formatNumber(sample.meanPlddt, { maximumFractionDigits: 1 }),
        rmsd: formatNumber(sample.rmsd, { maximumFractionDigits: 2 }),
        id: example.reference.id,
      })}</span>
      <span>{t('public.labFigureScope')}</span>
    </figcaption>
  </figure>;
}

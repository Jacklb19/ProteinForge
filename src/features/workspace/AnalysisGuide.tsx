import { useTranslation } from '../../i18n';
import { Icon } from '../../shared/Icon';

/** A quiet progress trail reflects the real Worker state, without hiding any tool controls. */
export function AnalysisGuide({ hasInput, ready }: { hasInput: boolean; ready: boolean }): React.JSX.Element {
  const { t } = useTranslation();
  const steps = ['guide.input', 'guide.properties', 'guide.profile'] as const;
  return (
    <ol className="analysis-guide" aria-label={t('guide.label')}>
      {steps.map((key, index) => {
        const complete = index === 0 ? hasInput : ready;
        const current = !hasInput ? index === 0 : !ready ? index === 1 : index === 2;
        return <li key={key} data-complete={complete} aria-current={current ? 'step' : undefined}><span className="guide-number" aria-hidden="true">{complete ? <Icon name="check" /> : index + 1}</span><span>{t(key)}</span></li>;
      })}
    </ol>
  );
}

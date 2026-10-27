import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { DESCRIPTOR_FIELDS, HYDROPATHY_WINDOWS, METHOD_REFERENCES, WINDOW_PURPOSE_KEYS } from '../descriptors/config';
import { EVIDENCE_KINDS, GUIDE_SECTIONS } from './config';

function GuideSection({ section, children }: { section: (typeof GUIDE_SECTIONS)[keyof typeof GUIDE_SECTIONS]; children: ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  return <section className="guide-section" id={section.id} aria-labelledby={`${section.id}-title`} tabIndex={-1}>
    <h2 id={`${section.id}-title`}>{t(section.titleKey)}</h2>
    {children}
  </section>;
}

/** Methods and reading criteria already used by the tools, gathered in one place with a way back to each tool. */
export function GuidePage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const toolLink = (route: string, labelKey: TranslationKey): React.JSX.Element =>
    <Link className="inline-link" to={route}>{t('guide.openTool', { tool: t(labelKey) })}</Link>;

  return (
    <main className="page guide-page">
      <PageHeading titleKey="guide.title" introduction="guide.intro" />
      <div className="legal-layout">
        <nav className="legal-index" aria-label={t('workbench.legalIndex')}>
          {Object.values(GUIDE_SECTIONS).map(entry => <a key={entry.id} href={`#${entry.id}`}>{t(entry.titleKey)}</a>)}
        </nav>
        <div className="guide-sections">
          <GuideSection section={GUIDE_SECTIONS.properties}>
            <p>{t('workbench.analysisScope')}</p>
            <dl className="guide-terms">
              {DESCRIPTOR_FIELDS.map(field => <div key={field.key}>
                <dt>{t(field.labelKey)}</dt>
                <dd>{t(field.helpKey)}<span className="guide-method">{t(field.methodKey)}</span></dd>
              </div>)}
            </dl>
            {toolLink(ROUTES.analyze, 'nav.analyze')}
          </GuideSection>

          <GuideSection section={GUIDE_SECTIONS.profile}>
            <p>{t('profile.scaleNote')}</p>
            <ul>{HYDROPATHY_WINDOWS.map(size => <li key={size}>{t(WINDOW_PURPOSE_KEYS[size], { count: formatNumber(size) })}</li>)}</ul>
            <p>{t('profile.chouFasmanNote')}</p>
            <ul>{METHOD_REFERENCES.map(reference => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{t(reference.labelKey)}</a></li>)}</ul>
          </GuideSection>

          <GuideSection section={GUIDE_SECTIONS.comparison}>
            <p>{t('workbench.compareHelp')}</p>
            <dl className="guide-terms">
              <div><dt>{t('alignment.identity')}</dt><dd>{t('workbench.identityHelp')}</dd></div>
              <div><dt>{t('alignment.similarity')}</dt><dd>{t('workbench.similarityHelp')}</dd></div>
              <div><dt>{t('alignment.score')}</dt><dd>{t('workbench.scoreHelp')}</dd></div>
            </dl>
            {toolLink(ROUTES.alignment, 'nav.alignment')}
          </GuideSection>

          <GuideSection section={GUIDE_SECTIONS.design}>
            <p>{t('generator.methodText')}</p>
            <p>{t('generator.scope')}</p>
            {toolLink(ROUTES.generate, 'nav.generate')}
          </GuideSection>

          <GuideSection section={GUIDE_SECTIONS.structures}>
            <p>{t('library.viewerScope')}</p>
            <p>{t('library.mappingScope')}</p>
            <p>{t('lab.provenanceMethod')}</p>
            <p>{t('lab.provenanceScope')}</p>
            <div className="actions">{toolLink(ROUTES.library, 'nav.library')}{toolLink(ROUTES.laboratory, 'workbench.laboratory')}</div>
          </GuideSection>

          <GuideSection section={GUIDE_SECTIONS.evidence}>
            <p>{t('public.evidenceText')}</p>
            <dl className="guide-terms">
              {EVIDENCE_KINDS.map(kind => <div key={kind.titleKey}><dt>{t(kind.titleKey)}</dt><dd>{t(kind.textKey)}</dd></div>)}
            </dl>
          </GuideSection>
        </div>
      </div>
    </main>
  );
}

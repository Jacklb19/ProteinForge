import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { AlignmentMap, AlignmentMapKey } from '../alignment/AlignmentMap';
import { changesInside } from '../alignment/columns';
import { useExampleAlignment } from '../alignment/examples';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';
import { SequenceRibbon } from '../chemistry/SequenceRibbon';
import { DEFAULT_HYDROPATHY_WINDOW, DESCRIPTOR_FIELDS } from '../descriptors/config';
import { ProfileSketch } from '../descriptors/ProfileSketch';
import { calculateProfile } from '../descriptors/profile';
import { useDescriptors } from '../descriptors/useDescriptors';
import { annotationsFor } from '../editor/annotations';
import { DEFAULT_EXAMPLE } from '../editor/examples';
import { CandidateRows } from '../generator/CandidateRows';
import { useGenerator } from '../generator/context';
import { StructureStage } from '../structure/StructureStage';
import { HERO_FACTS } from './config';

/** The site opens on a real protein: its measured structure, its sequence and what each tool says about it. */
export function LandingPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const sequence = DEFAULT_EXAMPLE.text;
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
  const [selected, setSelected] = useState<number | null>(annotations?.highlight ?? null);
  const descriptors = useDescriptors(sequence);
  // The bundled example is short and fixed, so its profile is drawn without a worker round trip.
  const profile = useMemo(() => calculateProfile(sequence, DEFAULT_HYDROPATHY_WINDOW), [sequence]);
  const alignment = useExampleAlignment();
  const auth = useAuth();
  const generator = useGenerator();
  const { result: search, status: searchStatus, run: runSearch } = generator;
  useEffect(() => { if (search === null && searchStatus === 'idle') runSearch(); }, [search, searchStatus, runSearch]);

  const result = descriptors.result;
  const facts = result
    ? HERO_FACTS.map((fact) => {
      const field = DESCRIPTOR_FIELDS.find((entry) => entry.key === fact.key);
      if (!field) return '';
      const value = formatNumber(result[field.key], field.format);
      return [fact.shortKey ? t(fact.shortKey) : '', value, field.unitKey ? t(field.unitKey) : ''].filter(Boolean).join(' ');
    }).filter(Boolean).join(' · ')
    : '';
  const mature = annotations ? annotations.regions.filter((region) => region.mature) : [];
  const changes = alignment ? changesInside(alignment, mature) : null;

  return (
    <main className="page landing">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" className="display">{t('landing.title')}</h1>
          <p className="lead">{t('workbench.homeLead')}</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" to={ROUTES.analyze}>{t('landing.analyzeAction')}</Link>
            <Link className="button button-secondary button-large" to={ROUTES.alignment}>{t('landing.compareAction')}</Link>
          </div>
          <p className="hero-note">{t('landing.note')}</p>
          <nav className="home-tasks" aria-label={t('workbench.exploration')}>
            {([
              ['workbench.homeAnalyze', 'workbench.homeAnalyzeHelp', ROUTES.analyze],
              ['workbench.homeCompare', 'workbench.homeCompareHelp', ROUTES.alignment],
              ['workbench.homeLab', 'workbench.homeLabHelp', ROUTES.laboratory],
            ] as const).map(([title, help, route]) => <Link key={route} to={route}>
              <span><strong>{t(title)}</strong><span className="field-help">{t(help)}</span></span><span aria-hidden="true">↗</span>
            </Link>)}
          </nav>
        </div>
        {annotations && <StructureStage variant="hero" annotations={annotations} selected={selected} onSelect={setSelected} />}
      </section>

      {annotations && (
        <section className="strand" aria-labelledby="strand-title">
          <div className="split-heading">
            <h2 id="strand-title">{t('landing.strandTitle')}</h2>
            <p>{t('landing.strandText', { count: formatNumber(sequence.length), bridges: formatNumber(annotations.disulfides.length) })}</p>
          </div>
          <SequenceRibbon sequence={sequence} annotations={annotations} letters bridges selected={selected} onSelect={setSelected} label={t('landing.strandLabel', { count: formatNumber(sequence.length) })} />
          <div className="strand-foot"><ChemistryLegend /><span className="bridge-key">{t('chemistry.bridge')}</span></div>
        </section>
      )}

      <section className="view" aria-labelledby="view-profile">
        <div className="view-copy">
          <h2 id="view-profile">{t('landing.profileTitle')}</h2>
          <p>{t('landing.profileText')}</p>
          {facts && <p className="view-fact">{facts}</p>}
          <Link className="text-link" to={ROUTES.analyze}>{t('landing.openAnalyze')}</Link>
        </div>
        <div className="view-figure">
          <ProfileSketch points={profile} length={sequence.length} label={t('landing.profileLabel')} />
          <p className="figure-caption">{t('landing.profileCaption', { count: formatNumber(DEFAULT_HYDROPATHY_WINDOW) })}</p>
        </div>
      </section>

      <section className="view" aria-labelledby="view-alignment">
        <div className="view-copy">
          <h2 id="view-alignment">{t('landing.alignmentTitle')}</h2>
          {alignment && changes
            ? <p>{t('landing.alignmentText', { identical: formatNumber(alignment.identities), total: formatNumber(alignment.columns), mature: formatNumber(changes.inside) })}</p>
            : <p role="status">{t('landing.alignmentPending')}</p>}
          <Link className="text-link" to={ROUTES.alignment}>{t('landing.openAlignment')}</Link>
        </div>
        {alignment && (
          <div className="view-figure">
            <AlignmentMap result={alignment} annotations={annotations} label={t('alignment.mapLabel', { identical: formatNumber(alignment.identities), total: formatNumber(alignment.columns) })} />
            <AlignmentMapKey />
          </div>
        )}
      </section>

      <section className="view" aria-labelledby="view-design">
        <div className="view-copy">
          <h2 id="view-design">{t('landing.designTitle')}</h2>
          {search
            ? <p>{t('landing.designText', { budget: formatNumber(search.parameters.budget), guided: formatNumber(search.guided.matchingEvaluations), reference: formatNumber(search.reference.matchingEvaluations) })}</p>
            : <p role="status">{t('landing.designPending')}</p>}
          <Link className="text-link" to={ROUTES.generate}>{t('landing.openDesign')}</Link>
        </div>
        {search && (
          <div className="view-figure">
            <CandidateRows candidates={search.guided.candidates} label={t('generator.guided')} />
            <p className="figure-caption">{t('landing.designCaption', { length: formatNumber(search.parameters.length) })}</p>
          </div>
        )}
      </section>

      {auth.status === 'anonymous' && (
        <section className="view" aria-labelledby="view-account">
          <div className="view-copy">
            <h2 id="view-account">{t('landing.accountTitle')}</h2>
            <div className="actions">
              <Link className="button button-primary" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>
              <Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
            </div>
          </div>
          <dl className="account-compare">
            <div><dt>{t('landing.withoutAccount')}</dt><dd>{t('landing.withoutAccountText')}</dd></div>
            <div data-account="true"><dt>{t('landing.withAccount')}</dt><dd>{t('landing.withAccountText')}</dd></div>
          </dl>
        </section>
      )}
    </main>
  );
}

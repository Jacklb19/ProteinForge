import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { ViewTabs } from '../../shared/ViewTabs';
import { AFTER_SIGN_IN_ROUTE, ROUTES } from '../../shared/navigation';
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
import { INITIAL_SEARCH_FORM } from '../generator/context';
import { EVIDENCE_KINDS } from '../guide/config';
import { StructureStage } from '../structure/StructureStage';
import { HERO_FACTS, INTRO_POINTS, LANDING_TOOLS, QUESTIONS, WORKFLOW_STEPS } from './config';
import type { LandingTool } from './config';

const LandingLabExample = lazy(async () => ({ default: (await import('./LandingLabExample')).LandingLabExample }));

/**
 * Sections play their entrance once, just before they come into view. Without an observer they are
 * marked at once; the content is visible either way and never depends on the animation.
 */
function useReveal(): React.RefObject<HTMLElement | null> {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    if (typeof IntersectionObserver !== 'function') { target.dataset.revealed = 'true'; return; }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      target.dataset.revealed = 'true';
      observer.disconnect();
    }, { rootMargin: '0px 0px 15% 0px' });
    observer.observe(target);
    return () => { observer.disconnect(); };
  }, []);
  return element;
}

function Section({ id, labelledBy, className, children }: { id?: string; labelledBy: string; className: string; children: ReactNode }): React.JSX.Element {
  const reveal = useReveal();
  return <section ref={reveal} id={id} className={`public-section reveal ${className}`} aria-labelledby={labelledBy} tabIndex={id ? -1 : undefined}>{children}</section>;
}

/** The descriptor worker starts when this example is shown, not when the page opens. */
function AnalyzeExample(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const sequence = DEFAULT_EXAMPLE.text;
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
  const descriptors = useDescriptors(sequence);
  // The bundled example is short and fixed, so its profile is drawn without a worker round trip.
  const profile = useMemo(() => calculateProfile(sequence, DEFAULT_HYDROPATHY_WINDOW), [sequence]);
  const result = descriptors.result;
  const facts = result
    ? HERO_FACTS.map((fact) => {
      const field = DESCRIPTOR_FIELDS.find((entry) => entry.key === fact.key);
      return field ? { label: t(field.labelKey), value: [formatNumber(result[field.key], field.format), field.unitKey ? t(field.unitKey) : ''].filter(Boolean).join(' ') } : null;
    }).filter((fact) => fact !== null)
    : [];
  return <figure className="public-evidence">
    <SequenceRibbon sequence={sequence} annotations={annotations} label={t('landing.strandLabel', { count: formatNumber(sequence.length) })} />
    <ProfileSketch points={profile} length={sequence.length} label={t('landing.profileLabel')} />
    {facts.length > 0
      ? <dl className="public-facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd className="numeric">{fact.value}</dd></div>)}</dl>
      : <p role="status">{t('profile.calculating')}</p>}
    <figcaption>{t('landing.profileCaption', { count: formatNumber(DEFAULT_HYDROPATHY_WINDOW) })}</figcaption>
  </figure>;
}

/** The alignment worker starts when this example is shown; the result is shared with Comparar. */
function CompareExample(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const alignment = useExampleAlignment();
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
  const mature = annotations ? annotations.regions.filter((region) => region.mature) : [];
  const changes = alignment ? changesInside(alignment, mature) : null;
  if (!alignment || !changes) return <p className="public-evidence" role="status">{t('landing.alignmentPending')}</p>;
  return <figure className="public-evidence">
    <AlignmentMap result={alignment} annotations={annotations} label={t('alignment.mapLabel', { identical: formatNumber(alignment.identities), total: formatNumber(alignment.columns) })} />
    <AlignmentMapKey />
    <figcaption>{t('landing.alignmentText', { identical: formatNumber(alignment.identities), total: formatNumber(alignment.columns), mature: formatNumber(changes.inside) })}</figcaption>
  </figure>;
}

/** The design example shows the conditions of a search; it does not run one from the public page. */
function DesignExample(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const form = INITIAL_SEARCH_FORM;
  return <figure className="public-evidence">
    <dl className="public-facts">
      <div><dt>{t('generator.length')}</dt><dd className="numeric">{formatNumber(Number(form.length))}</dd></div>
      <div><dt>{t('descriptors.gravy')}</dt><dd className="numeric">{t('public.designRange', { minimum: formatNumber(Number(form.gravyMinimum), { minimumFractionDigits: 1 }), maximum: formatNumber(Number(form.gravyMaximum), { minimumFractionDigits: 1 }) })}</dd></div>
      <div><dt>{t('generator.budget')}</dt><dd className="numeric">{formatNumber(Number(form.budget))}</dd></div>
    </dl>
    <figcaption>{t('public.designCaption')}</figcaption>
  </figure>;
}

function ToolExample({ tool }: { tool: LandingTool }): React.JSX.Element {
  const { t } = useTranslation();
  if (tool === 'analyze') return <AnalyzeExample />;
  if (tool === 'compare') return <CompareExample />;
  if (tool === 'design') return <DesignExample />;
  return <Suspense fallback={<p className="public-evidence" role="status">{t('shell.loadingPage')}</p>}><LandingLabExample /></Suspense>;
}

/** Tabbed examples; nothing is calculated until the section is on screen and a tool is shown. */
function ToolsSection(): React.JSX.Element {
  const { t } = useTranslation();
  const [tool, setTool] = useState<LandingTool>('analyze');
  // Without an observer there is no way to wait for the section, so the examples are shown at once.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== 'function');
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = area.current;
    if (!target || seen) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect(); } }, { rootMargin: '200px' });
    observer.observe(target);
    return () => { observer.disconnect(); };
  }, [seen]);
  return <Section id="tools" labelledBy="tools-title" className="public-tools">
    <header className="public-section-head">
      <h2 id="tools-title">{t('public.toolsTitle')}</h2>
      <p>{t('public.toolsLead')}</p>
    </header>
    <ViewTabs id="public-tools" label={t('public.toolsTabs')} value={tool} onChange={setTool}
      options={LANDING_TOOLS.map(entry => ({ value: entry.id, label: t(entry.labelKey) }))} />
    <div ref={area}>
      {LANDING_TOOLS.map(entry => <div key={entry.id} className="public-tool" role="tabpanel" id={`public-tools-${entry.id}-panel`}
        aria-labelledby={`public-tools-${entry.id}-tab`} hidden={entry.id !== tool}>
        <div className="public-tool-copy">
          <h3>{t(entry.questionKey)}</h3>
          <p>{t(entry.textKey)}</p>
          <Link className="button button-secondary" to={entry.route}><span>{t('public.tryTool', { tool: t(entry.labelKey) })}</span><Icon name="arrow" /></Link>
          <p className="public-scope">{t(entry.scopeKey)}</p>
        </div>
        {seen && entry.id === tool && <ToolExample tool={entry.id} />}
      </div>)}
    </div>
  </Section>;
}

/** Public presentation: what ProteinForge is, real examples of each tool, how work flows and where its limits are. */
export function LandingPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { status } = useAuth();
  const sequence = DEFAULT_EXAMPLE.text;
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
  const [selected, setSelected] = useState<number | null>(annotations?.highlight ?? null);
  const signedIn = status === 'signed-in';
  const canSignUp = status === 'anonymous';

  return (
    <main className="public-page">
      <section className="public-hero" aria-labelledby="hero-title">
        <div className="public-hero-copy">
          <p className="public-kicker">{t('public.kicker')}</p>
          <h1 id="hero-title" className="display">{t('public.heroTitle')}</h1>
          <p className="lead">{t('public.heroLead')}</p>
          <div className="hero-actions">
            {signedIn
              ? <Link className="button button-primary button-large" to={AFTER_SIGN_IN_ROUTE}><Icon name="arrow" /><span>{t('public.openLaboratory')}</span></Link>
              : canSignUp && <Link className="button button-primary button-large" to={ROUTES.signUp}><Icon name="arrow" /><span>{t('auth.signUpAction')}</span></Link>}
            {!signedIn && <Link className="button button-secondary button-large" to={ROUTES.analyze}>{t('public.exploreExample')}</Link>}
          </div>
          <p className="hero-note">{t(signedIn ? 'public.heroNoteSignedIn' : 'public.heroNote')}</p>
        </div>
        {annotations && <StructureStage variant="hero" annotations={annotations} selected={selected} onSelect={setSelected} />}
        {annotations && <div className="public-strand">
          <SequenceRibbon sequence={sequence} annotations={annotations} letters bridges selected={selected} onSelect={setSelected} label={t('landing.strandLabel', { count: formatNumber(sequence.length) })} />
          <div className="strand-foot"><ChemistryLegend /><span className="bridge-key">{t('chemistry.bridge')}</span></div>
        </div>}
      </section>

      <Section id="about" labelledBy="about-title" className="public-about">
        <header className="public-section-head">
          <h2 id="about-title">{t('public.aboutTitle')}</h2>
          <p>{t('public.aboutText')}</p>
        </header>
        <ul className="public-points">
          {INTRO_POINTS.map(point => <li key={point.titleKey}><Icon name={point.icon} /><h3>{t(point.titleKey)}</h3><p>{t(point.textKey)}</p></li>)}
        </ul>
      </Section>

      <ToolsSection />

      <Section id="workflow" labelledBy="workflow-title" className="public-workflow">
        <header className="public-section-head"><h2 id="workflow-title">{t('public.workflowTitle')}</h2></header>
        <ol className="public-points">
          {WORKFLOW_STEPS.map(step => <li key={step.titleKey}><Icon name={step.icon} /><h3>{t(step.titleKey)}</h3><p>{t(step.textKey)}</p></li>)}
        </ol>
      </Section>

      <Section labelledBy="evidence-title" className="public-evidence-kinds">
        <header className="public-section-head">
          <h2 id="evidence-title">{t('public.evidenceTitle')}</h2>
          <p>{t('public.evidenceText')}</p>
        </header>
        <dl className="public-kinds">
          {EVIDENCE_KINDS.map(kind => <div key={kind.titleKey}><dt>{t(kind.titleKey)}</dt><dd>{t(kind.textKey)}</dd></div>)}
        </dl>
      </Section>

      <Section labelledBy="cta-title" className="public-cta">
        <h2 id="cta-title">{t(signedIn ? 'public.ctaSignedInTitle' : 'public.ctaTitle')}</h2>
        <p>{t(signedIn ? 'public.ctaSignedInText' : canSignUp ? 'public.ctaText' : 'public.ctaLocalText')}</p>
        <div className="actions">
          {signedIn
            ? <Link className="button button-primary button-large" to={AFTER_SIGN_IN_ROUTE}>{t('public.openLaboratory')}</Link>
            : <>
              {canSignUp && <Link className="button button-primary button-large" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>}
              {status !== 'disabled' && status !== 'loading' && <Link className="button button-secondary button-large" to={ROUTES.signIn}>{t('shell.signIn')}</Link>}
              {!canSignUp && <Link className="button button-secondary button-large" to={ROUTES.analyze}>{t('public.exploreExample')}</Link>}
            </>}
        </div>
      </Section>

      <Section labelledBy="questions-title" className="public-questions">
        <h2 id="questions-title">{t('public.questionsTitle')}</h2>
        <div className="public-faq">
          {QUESTIONS.map(question => <details key={question.questionKey}><summary>{t(question.questionKey)}</summary><p>{t(question.answerKey)}</p></details>)}
        </div>
      </Section>
    </main>
  );
}

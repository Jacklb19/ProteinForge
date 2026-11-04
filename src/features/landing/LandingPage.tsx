import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { Icon } from '../../shared/Icon';
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
import { HERO_FACTS, LANDING_USES, OPEN_QUESTION, QUESTIONS } from './config';
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

/** Sign up and sign in without a session, the laboratory with one; nothing on this page opens a tool signed out. */
function AccountActions({ className }: { className: string }): React.JSX.Element | null {
  const { t } = useTranslation();
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-in') return <div className={className}><Link className="button button-primary button-large" to={AFTER_SIGN_IN_ROUTE}><Icon name="arrow" /><span>{t('public.openLaboratory')}</span></Link></div>;
  return <div className={className}>
    {status === 'anonymous' && <Link className="button button-primary button-large" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>}
    <Link className="button button-secondary button-large" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
  </div>;
}

function ToolExample({ tool }: { tool: LandingTool }): React.JSX.Element {
  const { t } = useTranslation();
  if (tool === 'analyze') return <AnalyzeExample />;
  if (tool === 'compare') return <CompareExample />;
  if (tool === 'design') return <DesignExample />;
  return <Suspense fallback={<p className="public-evidence" role="status">{t('shell.loadingPage')}</p>}><LandingLabExample /></Suspense>;
}

/** Whether an element has reached the screen; without an observer it counts as seen at once. Arrival never starts tool work. */
function useNearScreen(): [React.RefObject<HTMLElement | null>, boolean] {
  const element = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== 'function');
  useEffect(() => {
    const target = element.current;
    if (!target || seen) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect(); } });
    observer.observe(target);
    return () => { observer.disconnect(); };
  }, [seen]);
  return [element, seen];
}

/** One tool, what it answers and its real result; the result is calculated only once the row is on screen. */
function UseRow({ use }: { use: (typeof LANDING_USES)[number] }): React.JSX.Element {
  const { t } = useTranslation();
  const [row, seen] = useNearScreen();
  return <article ref={row} className="public-use" aria-labelledby={`use-${use.id}-title`}>
    <div className="public-use-copy">
      <h3 id={`use-${use.id}-title`}>{t(use.titleKey)}</h3>
      <p>{t(use.textKey)}</p>
      {use.scopeKey && <p className="public-scope">{t(use.scopeKey)}</p>}
    </div>
    {seen && <ToolExample tool={use.id} />}
  </article>;
}

/** Public site: what ProteinForge does, shown with the real result of each tool, provenance, questions and the way to an account. */
export function LandingPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const { status } = useAuth();
  const sequence = DEFAULT_EXAMPLE.text;
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
  const [selected, setSelected] = useState<number | null>(annotations?.highlight ?? null);
  const signedIn = status === 'signed-in';

  return (
    <main className="public-page">
      <section className="public-hero" aria-labelledby="hero-title">
        <div className="public-hero-copy">
          <h1 id="hero-title" className="display">{t('public.heroTitle')}</h1>
          <p className="lead">{t('public.heroLead')}</p>
          <AccountActions className="hero-actions" />
          {status !== 'loading' && <p className="hero-note">{t(signedIn ? 'public.heroNoteSignedIn' : 'public.heroNote')}</p>}
        </div>
        {annotations && <StructureStage variant="hero" annotations={annotations} selected={selected} onSelect={setSelected} />}
        {annotations && <div className="public-strand">
          <SequenceRibbon sequence={sequence} annotations={annotations} letters bridges selected={selected} onSelect={setSelected} label={t('landing.strandLabel', { count: formatNumber(sequence.length) })} />
          <div className="strand-foot"><ChemistryLegend /><span className="bridge-key">{t('chemistry.bridge')}</span></div>
        </div>}
      </section>

      <Section id="uses" labelledBy="uses-title" className="public-uses">
        <header className="public-section-head">
          <h2 id="uses-title">{t('public.usesTitle')}</h2>
          <p>{t('public.usesLead')}</p>
        </header>
        {LANDING_USES.map(use => <UseRow key={use.id} use={use} />)}
      </Section>

      <Section id="evidence" labelledBy="evidence-title" className="public-evidence-kinds">
        <header className="public-section-head">
          <h2 id="evidence-title">{t('public.evidenceTitle')}</h2>
          <p>{t('public.evidenceText')}</p>
        </header>
        <dl className="public-kinds">
          {EVIDENCE_KINDS.map(kind => <div key={kind.titleKey}><dt>{t(kind.titleKey)}</dt><dd>{t(kind.textKey)}</dd></div>)}
        </dl>
      </Section>

      <Section labelledBy="questions-title" className="public-questions">
        <h2 id="questions-title">{t('public.questionsTitle')}</h2>
        <div className="public-faq">
          {QUESTIONS.map(question => <details key={question.questionKey} open={question.questionKey === OPEN_QUESTION}><summary>{t(question.questionKey)}</summary><p>{t(question.answerKey)}</p></details>)}
        </div>
      </Section>

      <Section labelledBy="cta-title" className="public-cta">
        <h2 id="cta-title">{t(signedIn ? 'public.ctaSignedInTitle' : 'public.ctaTitle')}</h2>
        <p>{t(signedIn ? 'public.ctaSignedInText' : 'public.ctaText')}</p>
        <AccountActions className="actions" />
      </Section>
    </main>
  );
}

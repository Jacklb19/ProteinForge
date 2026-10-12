import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { PUBLIC_SECTIONS, ROUTES } from '../../shared/navigation';
import { useReveal } from '../../shared/useReveal';
import { useAuth } from '../auth/authContext';
import { MAX_FASTA_MEGABYTES } from '../editor/config';
import { exampleEntry } from '../editor/examples';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { OrnamentalChain } from './OrnamentalChain';
import { ExampleSummary } from './ExampleSummary';
import { bundledSequenceSource } from '../editor/source';
import { HelixScene } from './HelixScene';
import { HERO_EXAMPLE, LANDING_HONESTY_KEYS, LANDING_STEPS, LANDING_TOOLS, TOOL_STATUS_LABEL_KEYS } from './config';

/** The product explained with its own data: the hero is a real profile, every card states its status. */
export function LandingPage(): React.JSX.Element {
  const { t, formatNumber, formatUnit } = useTranslation();
  const navigate = useNavigate();
  const draft = useSequenceDraft();
  const auth = useAuth();
  const tools = useReveal<HTMLElement>();
  const flow = useReveal<HTMLElement>();
  const honesty = useReveal<HTMLElement>();
  const account = useReveal<HTMLElement>();

  const openExample = () => {
    const entry = HERO_EXAMPLE ? exampleEntry(HERO_EXAMPLE.fasta) : undefined;
    if (entry) { draft.setText(entry.sequence); draft.setSource(bundledSequenceSource(entry)); }
    void navigate(ROUTES.analyze);
  };

  return (
    <main className="landing">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{t('landing.eyebrow')}</p>
          <h1 id="hero-title" className="display">{t('landing.title')}</h1>
          <p className="lead">{t('landing.lead')}</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" to={ROUTES.workspace}>{t('landing.primaryAction')}<Icon name="arrow" /></Link>
            {HERO_EXAMPLE && (
              <button className="button button-secondary" type="button" onClick={openExample}>
                {t('landing.exampleAction')}
              </button>
            )}
          </div>
          <p className="hero-local-note">{t('landing.localNote')}</p>
        </div>
        <div className="hero-art">
          <OrnamentalChain />
        </div>
        <div className="hero-evidence"><ExampleSummary /></div>
      </section>

      <section id={PUBLIC_SECTIONS.product} ref={tools} className="landing-section container reveal" aria-labelledby="tools-title">
        <header className="section-heading">
          <p className="eyebrow">{t('landing.toolsEyebrow')}</p>
          <h2 id="tools-title">{t('landing.toolsTitle')}</h2>
          <p className="lead">{t('landing.toolsLead')}</p>
        </header>
        <ul className="tool-grid">
          {LANDING_TOOLS.filter((tool) => tool.status === 'available').map((tool, index) => {
            const body = (
              <>
                <span className="tool-icon"><Icon name={tool.icon} /></span>
                <span className="tool-body">
                  <span className="tool-title">{t(tool.titleKey)}</span>
                  <span className="tool-text">{t(tool.textKey)}</span>
                </span>
                <span className="status-badge" data-status={tool.status}>{t(TOOL_STATUS_LABEL_KEYS[tool.status])}</span>
              </>
            );
            return (
              <li key={tool.id} className="tool-card" data-status={tool.status} style={{ '--i': index } as React.CSSProperties}>
                {tool.path ? <Link className="tool-link" to={tool.path}>{body}<span className="tool-open">{t('landing.open')}<Icon name="arrow" /></span></Link> : <div className="tool-link">{body}</div>}
              </li>
            );
          })}
        </ul>
        <details className="landing-roadmap">
          <summary>{t('landing.roadmapToggle')}</summary>
          <ul className="roadmap-list">
            {LANDING_TOOLS.filter((tool) => tool.status !== 'available').map((tool) => (
              <li key={tool.id}>
                <Icon name={tool.icon} />
                <div><h3>{t(tool.titleKey)}</h3><p>{t(tool.textKey)}</p></div>
                <span className="status-badge" data-status={tool.status}>{t(TOOL_STATUS_LABEL_KEYS[tool.status])}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section id={PUBLIC_SECTIONS.flow} ref={flow} className="landing-section container reveal" aria-labelledby="flow-title">
        <header className="section-heading">
          <p className="eyebrow">{t('landing.flowEyebrow')}</p>
          <h2 id="flow-title">{t('landing.flowTitle')}</h2>
        </header>
        <ol className="step-list">
          {LANDING_STEPS.map((step, index) => (
            <li key={step.titleKey} className="step" style={{ '--i': index } as React.CSSProperties}>
              <span className="step-number" aria-hidden="true">{formatNumber(index + 1)}</span>
              <span className="step-icon"><Icon name={step.icon} /></span>
              <h3>{t(step.titleKey)}</h3>
              <p>{t(step.textKey, { limit: formatUnit(MAX_FASTA_MEGABYTES, 'megabyte') })}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id={PUBLIC_SECTIONS.criterion} ref={honesty} className="landing-section container reveal" aria-labelledby="honesty-title">
        <div className="honesty">
          <div className="honesty-copy">
            <header className="section-heading">
              <p className="eyebrow">{t('landing.honestyEyebrow')}</p>
              <h2 id="honesty-title">{t('landing.honestyTitle')}</h2>
            </header>
            <ul className="honesty-list">
              {LANDING_HONESTY_KEYS.map((key, index) => (
                <li key={key} style={{ '--i': index } as React.CSSProperties}><Icon name="shield" /><span>{t(key)}</span></li>
              ))}
            </ul>
          </div>
          <HelixScene />
        </div>
      </section>

      <section ref={account} className="landing-section container reveal" aria-labelledby="account-title">
        <div className="account-callout">
          <div>
            <h2 id="account-title">{t('landing.accountTitle')}</h2>
            <p className="lead">{t('landing.accountText')}</p>
          </div>
          <div className="hero-actions">
            {auth.status === 'signed-in' ? (
              <Link className="button button-primary button-large" to={ROUTES.workspace}>{t('landing.primaryAction')}<Icon name="arrow" /></Link>
            ) : (
              <>
                <Link className="button button-primary button-large" to={ROUTES.signUp}>{t('landing.accountPrimary')}</Link>
                <Link className="button button-secondary button-large" to={ROUTES.signIn}>{t('landing.accountSecondary')}</Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';
import { EXAMPLE_SEQUENCES } from '../editor/config';
import { exampleEntry } from '../editor/examples';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { validateSequence } from '../editor/sequence';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { OrnamentalChain } from '../landing/OrnamentalChain';
import { GETTING_STARTED_STEPS, SAMPLE_RESIDUES, SEQUENCE_PREVIEW_LENGTH, WORKSPACE_TASKS } from './config';
import { ProjectLibrary } from '../projects/ProjectLibrary';

/** A task-oriented starting point for visitors who have never used a protein workbench. */
export function WorkspacePage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const draft = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const navigate = useNavigate();
  const sequence = validateSequence(draft.text).sequence;
  const hasDraft = draft.text.trim().length > 0;

  function openExample(fasta: string): void {
    const entry = exampleEntry(fasta);
    if (!entry) return;
    draft.setText(entry.sequence);
    void navigate(ROUTES.analyze);
  }

  return (
    <main className="page workspace-page">
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow"><span className="availability-dot" />{t('workspace.eyebrow')}</p>
          <h1 id="welcome-title">{t(hasDraft ? 'workspace.returnTitle' : 'workspace.title')}</h1>
          <p className="lead">{t(hasDraft ? 'workspace.returnText' : 'workspace.introduction')}</p>
          {hasDraft ? (
            <Link className="button button-primary button-large" to={ROUTES.analyze}>{t('workspace.continue')}<Icon name="arrow" /></Link>
          ) : EXAMPLE_SEQUENCES.map((example) => (
            <button className="button button-primary button-large" key={example.accession} onClick={() => { openExample(example.fasta); }}>
              {t('workspace.tryExample')}<Icon name="arrow" />
            </button>
          ))}
          <p className="welcome-note"><Icon name="shield" />{t('workspace.localNote')}</p>
        </div>
        <div className="welcome-specimen">
          <OrnamentalChain />
          <p className="specimen-caption">{t('workspace.specimen')}</p>
        </div>
      </section>

      {hasDraft && (
        <section className="draft-strip" aria-labelledby="draft-title">
          <span className="task-symbol"><Icon name="sequence" /></span>
          <div><h2 id="draft-title">{t('workspace.draftTitle')}</h2><p>{t('workspace.draftCount', { count: formatNumber(sequence.length) })}</p></div>
          <code>{sequence.slice(0, SEQUENCE_PREVIEW_LENGTH)}{sequence.length > SEQUENCE_PREVIEW_LENGTH && '…'}</code>
          <Link className="button button-secondary" to={ROUTES.analyze}>{t('workspace.resume')}<Icon name="arrow" /></Link>
        </section>
      )}

      <section className="workspace-tasks" aria-labelledby="task-title">
        <div className="section-header"><h2 id="task-title">{t('workspace.chooseTitle')}</h2><p className="field-help">{t('workspace.chooseHelp')}</p></div>
        <div className="task-grid">
          {WORKSPACE_TASKS.map((task, index) => (
            <Link to={task.path} className="task-launcher" key={task.path} style={{ '--i': index } as React.CSSProperties}>
              <span className="task-symbol"><Icon name={task.icon} /></span>
              <h3>{t(task.title)}</h3><p>{t(task.text)}</p>
              <span className="task-action">{t(task.action)}<Icon name="arrow" /></span>
            </Link>
          ))}
        </div>
        {(alignment.first || alignment.second) && <p className="field-help">{t('workspace.comparisonDraft')} <Link className="inline-link" to={ROUTES.alignment}>{t('workspace.compareAction')}</Link></p>}
      </section>

      <ProjectLibrary />
      <section className="first-steps" aria-labelledby="first-steps-title">
        <div className="sequence-explanation">
          <div className="residue-sample" aria-hidden="true">{SAMPLE_RESIDUES.map((letter, index) => <span key={index} style={{ '--i': index } as React.CSSProperties}>{letter}</span>)}</div>
          <h2 id="first-steps-title">{t('workspace.sequenceTitle')}</h2>
          <p>{t('workspace.sequenceText')}</p>
        </div>
        <ol>{GETTING_STARTED_STEPS.map((key, index) => <li key={key}><span className="guide-number" aria-hidden="true">{formatNumber(index + 1)}</span><p>{t(key)}</p></li>)}</ol>
      </section>
      <p className="workspace-retention"><Icon name="lock" />{t('workspace.retention')}</p>
    </main>
  );
}

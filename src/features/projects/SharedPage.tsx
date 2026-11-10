import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/apiClient';
import { AlignmentMap, AlignmentMapKey } from '../alignment/AlignmentMap';
import { PERCENT_FORMAT } from '../alignment/config';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import { downloadSequenceFasta, sequenceFasta } from '../reports/descriptorReport';
import { SHARED_SEQUENCE_BLOCK, SHARED_SEQUENCE_LINE } from './config';
import { createSharedApi, tokenFromHash } from './sharing';
import type { SharedProject } from './sharing';

type State = { kind: 'loading' } | { kind: 'ready'; project: SharedProject } | { kind: 'error'; code: 'not-found' | 'rate-limit' | 'unavailable' };

/** The sequence in lines of sixty, blocks of ten, as it is read in print. */
function SequenceLines({ sequence }: { sequence: string }): React.JSX.Element {
  const lines = sequence.match(new RegExp(`.{1,${String(SHARED_SEQUENCE_LINE)}}`, 'g')) ?? [];
  const block = new RegExp(`.{1,${String(SHARED_SEQUENCE_BLOCK)}}`, 'g');
  return <pre className="shared-sequence">{lines.map((line, index) => `${String(index * SHARED_SEQUENCE_LINE + 1).padStart(6)}  ${(line.match(block) ?? []).join(' ')}`).join('\n')}</pre>;
}

/**
 * What a read-only link shows to anyone who holds it, with or without an account: the saved analysis and
 * comparison of one project, as its owner last saved them. Nothing is calculated here.
 */
export function SharedPage(): React.JSX.Element {
  const { t, formatNumber, formatDate } = useTranslation();
  const { hash } = useLocation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const token = tokenFromHash(hash);
    const base = readApiBaseUrl();
    if (!token || !base) { queueMicrotask(() => { setState({ kind: 'error', code: token ? 'unavailable' : 'not-found' }); }); return; }
    const operation = new AbortController();
    queueMicrotask(() => { setState({ kind: 'loading' }); });
    createSharedApi(base).open(token, operation.signal).then(
      (project) => { setState({ kind: 'ready', project }); },
      (error: unknown) => {
        if (operation.signal.aborted) return;
        const code = error instanceof ApiError ? error.code : 'unknown';
        setState({ kind: 'error', code: code === 'not-found' ? 'not-found' : code === 'rate-limit' ? 'rate-limit' : 'unavailable' });
      },
    );
    return () => { operation.abort(); };
  }, [hash]);

  const date = (value: string): string => formatDate(new Date(value), { dateStyle: 'long' });
  return (
    <main className="page shared-page">
      {/* A link is private to whoever was given it: search engines must not keep it. */}
      <meta name="robots" content="noindex" />
      {state.kind === 'loading' && <p role="status">{t('shared.loading')}</p>}
      {state.kind === 'error' && <section className="shared-missing" aria-labelledby="shared-missing-title">
        <h1 id="shared-missing-title">{t('shared.missingTitle')}</h1>
        <p>{t(state.code === 'not-found' ? 'shared.missing' : state.code === 'rate-limit' ? 'projects.rateLimit' : 'shared.unavailable')}</p>
        <Link className="button button-secondary" to={ROUTES.home}>{t('notFound.home')}</Link>
      </section>}
      {state.kind === 'ready' && (() => {
        const { project } = state;
        const { descriptors, alignment, source } = project.workspace;
        const sequence = project.activeSequence;
        const result = alignment.result;
        return <>
          <header className="page-head">
            <div className="page-head-text">
              <p className="page-kicker">{t('shared.kicker')}</p>
              <h1>{project.name}</h1>
              <p className="page-meta">{[
                sequence ? t('fasta.residues', { count: formatNumber(sequence.length) }) : '',
                source ? source.accession : '',
                t('shared.savedOn', { date: date(project.updatedAt) }),
              ].filter(Boolean).join(' · ')}</p>
              <p className="field-help">{t('shared.scope', { date: date(project.expiresAt) })}</p>
            </div>
            {sequence && <div className="toolbar">
              <button type="button" className="button button-secondary" onClick={() => { downloadSequenceFasta(sequenceFasta(sequence, project.name, source?.accession ?? null)); }}>{t('report.fasta')}</button>
              <button type="button" className="button button-secondary" onClick={() => { void navigator.clipboard.writeText(sequence).then(() => { setCopied(true); }, () => undefined); }}>{t('shared.copy')}</button>
            </div>}
          </header>
          <p className="status-message" data-state={copied ? 'success' : undefined} role="status">{copied ? t('shared.copied') : ''}</p>

          {descriptors && <section className="section" aria-labelledby="shared-properties">
            <h2 id="shared-properties">{t('descriptors.title')}</h2>
            <dl className="figures">
              {DESCRIPTOR_FIELDS.map(field => <div key={field.key}>
                <dt>{t(field.labelKey)}</dt>
                <dd>{formatNumber(descriptors.result[field.key], field.format)}{field.unitKey ? ` ${t(field.unitKey)}` : ''}</dd>
              </div>)}
            </dl>
            <p className="field-help">{t('workbench.analysisScope')}</p>
          </section>}

          {sequence && <section className="section" aria-labelledby="shared-sequence">
            <h2 id="shared-sequence">{t('shared.sequence')}</h2>
            <SequenceLines sequence={sequence} />
          </section>}

          {result && <section className="section" aria-labelledby="shared-comparison">
            <h2 id="shared-comparison">{t('shared.comparison')}</h2>
            <p className="verdict">{t('alignment.verdict', { count: formatNumber(result.identities), total: formatNumber(result.columns) })}</p>
            <dl className="figures">
              <div><dt>{t('alignment.identity')}</dt><dd>{formatNumber(result.identities / result.columns, PERCENT_FORMAT)}</dd></div>
              <div><dt>{t('alignment.similarity')}</dt><dd>{formatNumber(result.similarities / result.columns, PERCENT_FORMAT)}</dd></div>
              <div><dt>{t('alignment.score')}</dt><dd>{formatNumber(result.score)}</dd></div>
            </dl>
            <AlignmentMap result={result} label={t('shared.mapLabel')} />
            <AlignmentMapKey />
            <p className="field-help">{t(`alignment.${alignment.mode}`)} · {alignment.matrix}</p>
          </section>}

          <section className="section shared-invite" aria-labelledby="shared-invite">
            <h2 id="shared-invite">{t('shared.inviteTitle')}</h2>
            <p>{t('shared.invite')}</p>
            <div className="actions">
              <Link className="button button-primary" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>
              <Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
            </div>
          </section>
        </>;
      })()}
    </main>
  );
}

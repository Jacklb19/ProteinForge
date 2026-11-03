import { useContext, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { MAX_PROJECT_NAME_LENGTH, PROJECT_ERROR_KEYS } from './config';
import { ProjectContext, useProjects } from './projectContext';
import { isOpen, laboratoryVariants } from './syncQueue';
import type { ConflictChoice, SyncEntry } from './syncQueue';
import { useOtherAccountWaiting, useRelativeTime, useSyncShortLabel, useSyncSummary } from './syncSummary';

const ROW_KEYS = { analysis: 'sync.rowChanges', laboratory: 'sync.rowLaboratory', search: 'sync.rowSearch' } as const satisfies Record<SyncEntry['kind'], TranslationKey>;

/** Beside a save button: what happened to the save that is waiting. Null when nothing waits. */
export function SyncQueued({ entry }: { entry: SyncEntry | null }): React.JSX.Element | null {
  const { t } = useTranslation();
  const projects = useProjects();
  const auth = useAuth();
  if (!entry || !isOpen(entry)) return null;
  const name = <strong>{t('sync.queued', { name: entry.name })}</strong>;
  return <div className="sync-state" role="status">
    {entry.state === 'failed' ? <>
      <p><strong>{t('sync.failed')}</strong> {entry.error && t(PROJECT_ERROR_KEYS[entry.error])}</p>
      <button className="button button-quiet" type="button" onClick={() => { projects.discard(entry.key); }}>{t('sync.discard')}</button>
      <button className="button button-secondary" type="button" onClick={() => { projects.retry(entry.key); }}>{t('sync.retry')}</button>
    </> : entry.state === 'conflict' ? <>
      <p><strong>{t('sync.changedRemote')}</strong></p>
      <Link className="button button-secondary" to={ROUTES.projects}>{t('sync.chooseVersion')}</Link>
    </> : auth.status !== 'signed-in' ? <>
      <p>{name} {t('sync.sessionEndedPanel')}</p>
      <Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
    </> : <>
      <p>{name} {t('sync.queuedHelp')}</p>
      <button className="button button-quiet" type="button" onClick={() => { projects.discard(entry.key); }}>{t('sync.discardQueued')}</button>
    </>}
  </div>;
}

/** The row's state in place of its date. */
export function SyncNote({ entry }: { entry: SyncEntry }): React.JSX.Element {
  const { t } = useTranslation();
  const { syncing } = useProjects();
  const relative = useRelativeTime();
  const time = relative(entry.changedAt);
  const [text, state]: [string, 'error' | 'success' | undefined] =
    entry.state === 'saved' ? [t(syncing ? 'sync.saved' : 'sync.savedNow'), 'success']
      : entry.state === 'saving' ? [t('sync.savingShort'), undefined]
        : entry.state === 'conflict' ? [t('sync.changedRemote'), 'error']
          : entry.state === 'failed' ? [t('sync.failed'), 'error']
            : syncing ? [t('sync.waiting'), undefined]
              : !entry.projectId ? [t('sync.rowNew'), undefined] : [t(ROW_KEYS[entry.kind], { time }), undefined];
  return <>
    <p className="sync-note" data-state={state}>{text}</p>
    {entry.state === 'failed' && entry.error && <p className="field-help sync-detail">{t(PROJECT_ERROR_KEYS[entry.error])}</p>}
  </>;
}

/** Discard and retry after a failure, or the way into a conflict; null keeps the row's own actions. */
export function SyncActions({ entry, choosing, onChoose }: { entry: SyncEntry; choosing: boolean; onChoose: () => void }): React.JSX.Element | null {
  const { t } = useTranslation();
  const projects = useProjects();
  if (entry.state === 'conflict') return <div className="actions">
    <button className="button button-secondary" type="button" aria-expanded={choosing} aria-controls={conflictId(entry)} onClick={onChoose}>{t('sync.chooseVersion')}</button>
  </div>;
  if (entry.state === 'failed') return <div className="actions">
    <button className="button button-quiet" type="button" onClick={() => { projects.discard(entry.key); }}>{t('sync.discard')}</button>
    <button className="button button-secondary" type="button" onClick={() => { projects.retry(entry.key); }}>{t('sync.retry')}</button>
  </div>;
  return null;
}

const conflictId = (entry: SyncEntry): string => `conflict-${entry.key}`;

/** Both versions side by side inside the row; nothing changes until a choice is made. */
export function ConflictSection({ entry, onDone }: { entry: SyncEntry; onDone: () => void }): React.JSX.Element | null {
  const { t, formatNumber } = useTranslation();
  const projects = useProjects();
  const relative = useRelativeTime();
  const title = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => { title.current?.focus(); }, []);
  const mine = entry.write, theirs = entry.remote;
  if (!mine || !theirs) return null;
  const copy = t('projects.copyName', { name: entry.name }).slice(0, MAX_PROJECT_NAME_LENGTH);
  const laboratory = entry.kind === 'laboratory';
  const summary = (version: typeof mine, variants: number): React.JSX.Element => <strong>{laboratory
    ? t('sync.variants', { count: formatNumber(variants) }) : t('fasta.residues', { count: formatNumber(version.activeSequence.length) })}</strong>;
  const detail = (version: typeof mine, when: string): string => laboratory ? when : `${t('sync.profileWindow', { count: version.workspace.profileWindow })} · ${when}`;
  // After the choice the focus returns to the project's title; the sidebar status announces the outcome.
  const choose = (choice: ConflictChoice): void => {
    const heading = title.current?.closest('article')?.querySelector<HTMLElement>('h2');
    void projects.resolve(entry.key, choice, copy).then(() => { onDone(); heading?.focus(); });
  };
  return <section className="project-conflict" id={conflictId(entry)} aria-labelledby={`${conflictId(entry)}-title`}>
    <p id={`${conflictId(entry)}-title`} ref={title} tabIndex={-1}>{t('sync.conflictTitle')}</p>
    <dl className="versions">
      <div><dt>{t('sync.yourVersion')}</dt><dd>{summary(mine, entry.laboratory?.variants ?? 0)}{detail(mine, t('sync.changedHere', { time: relative(entry.changedAt) }))}</dd></div>
      <div><dt>{t('sync.accountVersion')}</dt><dd>{summary(theirs, laboratoryVariants(theirs))}{detail(theirs, t('sync.savedAgo', { time: relative(theirs.updatedAt) }))}</dd></div>
    </dl>
    <div className="actions">
      <button className="button button-primary" type="button" disabled={projects.busy} onClick={() => { choose('both'); }}>{t('sync.keepBoth')}</button>
      <button className="button button-secondary" type="button" disabled={projects.busy} onClick={() => { choose('mine'); }}>{t('sync.keepMine')}</button>
      <button className="button button-secondary" type="button" disabled={projects.busy} onClick={() => { choose('theirs'); }}>{t('sync.keepTheirs')}</button>
    </div>
    <p className="field-help">{t('sync.keepHelp', { copy })}</p>
  </section>;
}

/** Sidebar foot, between the guide and the account: the connection and the saves still waiting. */
export function SyncStatus({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }): React.JSX.Element | null {
  const { t, formatNumber } = useTranslation();
  const projects = useContext(ProjectContext);
  const summary = useSyncSummary();
  const others = useOtherAccountWaiting();
  const short = useSyncShortLabel();
  // A visitor without an account reads the connection in the guest note instead.
  const own = summary && !(summary.kind === 'offline' && summary.guest) ? summary : null;
  if (!projects || (!own && !others)) return null;
  if (compact) return <div className="sync-status" data-compact="true" role="status"><span aria-hidden="true">●</span><span className="visually-hidden">{short ?? t('sync.otherAccount')}</span></div>;
  const count = (one: TranslationKey, many: TranslationKey, value: number): string => t(value === 1 ? one : many, { count: formatNumber(value) });
  // Another account's saves are said apart, and this account's own state still follows.
  return <div className="sync-status" role="status">
    {others && <>
      <span>{t('sync.otherAccount')}</span>
      <button className="button button-quiet" type="button" onClick={() => { projects.discardAll('others'); }}>{t('sync.discard')}</button>
    </>}
    {!own ? null : own.kind === 'session-ended' ? <>
      <strong>{t('sync.sessionEnded')}</strong>
      <span>{t(own.count === 1 ? 'sync.sessionEndedHelpOne' : 'sync.sessionEndedHelp', { email: own.email, count: formatNumber(own.count) })}</span>
      <Link className="button button-quiet" to={ROUTES.signIn} onClick={onNavigate}>{t('shell.signIn')}</Link>
    </> : own.kind === 'saving' ? <>
      <strong>{t('sync.saving', { current: formatNumber(own.current), total: formatNumber(own.total) })}</strong>
      <progress className="alignment-progress" max={own.total} value={own.current - 1} aria-label={t('sync.progressLabel')} />
    </> : own.kind === 'attention' ? <>
      <strong>{count('sync.attentionOne', 'sync.attentionMany', own.count)}</strong>
      <span>{own.saved ? t(own.saved === 1 ? 'sync.attentionHelp' : 'sync.attentionHelpMany', { saved: formatNumber(own.saved) }) : t('sync.attentionNone')}</span>
    </> : own.kind === 'waiting' ? <>
      {own.offline && <strong>{t('sync.offline')}</strong>}
      <span>{count('sync.pendingOne', 'sync.pendingMany', own.count)} {t('sync.keepTabOpen')}</span>
    </> : <strong>{t('sync.offline')}</strong>}
  </div>;
}

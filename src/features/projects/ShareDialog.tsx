import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { ApiError } from '../api/apiClient';
import { PROJECT_ERROR_KEYS } from './config';
import type { ProjectSummary } from './contracts';
import { useProjects } from './projectContext';
import { shareUrl } from './sharing';
import type { ProjectShare } from './sharing';

type View = { kind: 'loading' } | { kind: 'none' } | { kind: 'active'; share: ProjectShare } | { kind: 'created'; share: ProjectShare; url: string };

/**
 * A project's read-only link: what it shows, the link itself right after it is made, and how to end it.
 * The address is only known when it is created; later the dialog says until when one is active.
 */
export function ShareDialog({ project, onClose }: { project: ProjectSummary; onClose: () => void }): React.JSX.Element {
  const { t, formatDate } = useTranslation();
  const projects = useProjects();
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);
  const latest = useRef(projects);
  useLayoutEffect(() => { latest.current = projects; });
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    let current = true;
    latest.current.share(project.id).then(
      (share) => { if (current) setView(share ? { kind: 'active', share } : { kind: 'none' }); },
      (error: unknown) => { if (current) { setFailure(error as ApiError); setView({ kind: 'none' }); } },
    );
    return () => { current = false; };
  }, [project.id]);
  useEffect(() => { if (view.kind === 'created') field.current?.select(); }, [view]);

  const act = async (task: () => Promise<View>): Promise<void> => {
    setWorking(true); setFailure(null); setCopied(false);
    try { setView(await task()); } catch (error) { setFailure(error as ApiError); } finally { setWorking(false); }
  };
  const create = (): void => { void act(async () => { const created = await latest.current.createShare(project.id); return { kind: 'created', share: created.share, url: shareUrl(created.token) }; }); };
  const remove = (): void => { void act(async () => { await latest.current.removeShare(project.id); return { kind: 'none' }; }); };
  const copy = async (url: string): Promise<void> => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { field.current?.select(); }
  };
  const until = (share: ProjectShare): string => formatDate(new Date(share.expiresAt), { dateStyle: 'long', timeStyle: 'short' });
  return (
    <dialog ref={dialog} className="project-dialog share-dialog" aria-labelledby="share-title" aria-describedby="share-scope"
      onCancel={(event) => { event.preventDefault(); if (!working) onClose(); }}>
      <div className="project-confirm">
        <h2 id="share-title">{t('share.title')}</h2>
        <p className="project-dialog-name">{project.name}</p>
        <p id="share-scope" className="field-help">{t('share.scope')}</p>
        {view.kind === 'loading' && <p className="status-message" role="status">{t('share.loading')}</p>}
        {view.kind === 'none' && <p>{t('share.none')}</p>}
        {view.kind === 'active' && <p>{t('share.active', { date: until(view.share) })}</p>}
        {view.kind === 'created' && <div className="field">
          <label htmlFor="share-url">{t('share.link')}</label>
          <div className="share-url">
            <input ref={field} id="share-url" className="text-input" type="text" readOnly value={view.url} aria-describedby="share-once" onFocus={(event) => { event.currentTarget.select(); }} />
            <button type="button" className="button button-primary" onClick={() => { void copy(view.url); }}>{t('share.copy')}</button>
          </div>
          <p id="share-once" className="field-help">{t('share.once', { date: until(view.share) })}</p>
          <p className="status-message" data-state={copied ? 'success' : undefined} role="status">{copied ? t('share.copied') : ''}</p>
        </div>}
        {failure && <p className="status-message" data-state="error" role="alert">{t(PROJECT_ERROR_KEYS[failure.code])}</p>}
        <div className="actions">
          <button type="button" className="button button-secondary" disabled={working} onClick={onClose}>{t('share.close')}</button>
          {view.kind !== 'loading' && <button type="button" className={`button ${view.kind === 'created' ? 'button-secondary' : 'button-primary'}`} disabled={working} onClick={create}>
            {t(view.kind === 'none' ? 'share.create' : 'share.replace')}
          </button>}
          {(view.kind === 'active' || view.kind === 'created') && <button type="button" className="button button-quiet link-danger" disabled={working} onClick={remove}>{t('share.stop')}</button>}
        </div>
      </div>
    </dialog>
  );
}

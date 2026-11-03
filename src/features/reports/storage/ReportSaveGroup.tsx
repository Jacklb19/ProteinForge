import { useContext, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../../../i18n';
import { ROUTES } from '../../../shared/navigation';
import { SegmentedControl } from '../../../shared/SegmentedControl';
import { ProjectContext } from '../../projects/projectContext';
import type { ReportFormat } from '../reportMessages';
import { REPORT_FORMAT_LABELS, REPORT_FORMAT_NAMES, REPORT_STORAGE_LIMITS } from './config';
import type { ReportSave } from './useReportSave';
import type { SavedReports } from './useSavedReports';
import { useReportText } from './useReportText';

interface Props { formats: readonly ReportFormat[]; saved: SavedReports; save: ReportSave; onDownload: (format: ReportFormat) => void }

/** "Save to my account" inside the Export menu: format, destination, usage, the save and its outcome. */
export function ReportSaveGroup({ formats, saved, save, onDownload }: Props): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const text = useReportText();
  const location = useLocation();
  const projects = useContext(ProjectContext);
  const titleId = useId();
  const noticeId = useId();
  const group = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [chosen, setChosen] = useState<ReportFormat>(formats[0] ?? 'pdf');
  const format = formats.includes(chosen) ? chosen : formats[0] ?? 'pdf';
  const { state } = save;
  const full = saved.loaded && saved.usage.count >= REPORT_STORAGE_LIMITS.maxReports;
  const name = (value: ReportFormat): string => t(REPORT_FORMAT_NAMES[value]);
  // The outcome's own action takes the focus, unless the person has already moved elsewhere.
  useEffect(() => {
    const active = document.activeElement;
    if (active === document.body || (active && group.current?.contains(active))) action.current?.focus();
  }, [state.status]);

  const title = <p className="report-group-title" id={titleId}>{t('report.saveToAccount')}</p>;
  if (saved.mode === 'signed-out') {
    return <div className="report-save" role="group" aria-labelledby={titleId}>
      {title}
      <p className="field-help">{t('report.signedOut')}</p>
      <div className="report-state-actions">
        <Link className="button button-secondary" state={{ from: location.pathname }} to={ROUTES.signIn}>{t('shell.signIn')}</Link>
        <Link className="button button-quiet" state={{ from: location.pathname }} to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>
      </div>
    </div>;
  }

  const busy = state.status === 'saving';
  const settled = state.status === 'idle' || state.status === 'cancelled' || state.status === 'stale';
  // A full account has no save button: the quota stays explained until a report is removed.
  const quota = state.status === 'quota' || (full && settled);
  const percent = state.status === 'saving' ? formatNumber(state.progress ?? 0, { style: 'percent' }) : '';
  return <div className="report-save" role="group" aria-labelledby={titleId} ref={group}>
    {title}
    <div className="report-format">
      <SegmentedControl legend={t('report.format')} value={format} onChange={setChosen} options={formats.map((value) => ({ value, label: t(REPORT_FORMAT_LABELS[value]) }))} />
    </div>
    {state.status === 'notice' ? <>
      <div className="notice" role="group" aria-labelledby={noticeId}>
        <strong id={noticeId}>{t('report.firstSaveTitle')}</strong>
        <p>{t('report.firstSaveText')}</p>
      </div>
      <div className="report-state-actions">
        <button type="button" className="button button-primary" onClick={() => { save.confirm(format); }}>{t('report.saveToAccount')}</button>
        <button ref={action} type="button" className="button button-secondary" onClick={save.dismiss}>{t('projects.cancel')}</button>
      </div>
    </> : <>
      <p className="field-help">{projects?.active ? t('report.destinationProject', { project: projects.active.name }) : t('report.destinationNone')}</p>
      {saved.loaded && <p className="report-usage">{text.usage(saved.usage)}</p>}
      {saved.status === 'error' && <div className="report-state-actions">
        <p className="status-message" data-state="error">{t('report.listError')}</p>
        <button type="button" className="button button-quiet" onClick={saved.refresh}>{t('report.retry')}</button>
      </div>}
      {!busy && !full && saved.status === 'ready' && <button ref={settled ? action : undefined} type="button" className="button button-secondary" onClick={() => { save.save(format); }}>{t('report.saveToAccount')}</button>}
      {busy && <div className="report-state">
        <p className="status-message" role="status">{t('report.saving', { format: name(state.format), percent })}</p>
        <progress max={1} value={state.progress ?? undefined} aria-label={t('report.saving', { format: name(state.format), percent: '' }).trim()} />
        <div className="report-state-actions"><button ref={action} type="button" className="button button-secondary" onClick={save.cancel}>{t('projects.cancel')}</button></div>
      </div>}
      {state.status === 'saved' && <div className="report-state" data-state="success">
        <p className="status-message" data-state="success" role="status">{t('report.saved', { format: name(state.format) })}</p>
        <Link ref={action} className="inline-link" to={ROUTES.projects}>{t('report.viewInProjects')}</Link>
      </div>}
      {state.status === 'cancelled' && <p className="status-message" role="status">{t('report.cancelled')}</p>}
      {state.status === 'stale' && <p className="status-message" data-state="error" role="alert">{t('report.stale')}</p>}
      {state.status === 'too-large' && <div className="report-state" data-state="error">
        <p className="status-message" data-state="error" role="alert">{t('report.tooLarge', { size: text.size(state.sizeBytes), limit: text.size(REPORT_STORAGE_LIMITS.maxReportBytes) })}</p>
        <div className="report-state-actions"><button ref={action} type="button" className="button button-secondary" onClick={() => { onDownload(state.format); }}>{t('report.downloadFormat', { format: name(state.format) })}</button></div>
      </div>}
      {quota && <div className="report-state" data-state="error">
        <p className="status-message" data-state="error" role="alert">{state.status === 'quota' && state.reason === 'bytes'
          ? t('report.quotaBytes', { used: text.size(saved.usage.bytes), limit: text.size(REPORT_STORAGE_LIMITS.maxOwnerBytes) })
          : t('report.quotaCount', { max: formatNumber(REPORT_STORAGE_LIMITS.maxReports) })}</p>
        <Link ref={action} className="inline-link" to={ROUTES.projects}>{t('report.chooseToRemove')}</Link>
      </div>}
      {state.status === 'error' && <div className="report-state" data-state="error">
        <p className="status-message" data-state="error" role="alert">{t('report.saveError')}</p>
        <div className="report-state-actions"><button ref={action} type="button" className="button button-secondary" onClick={() => { save.retry(state.format); }}>{t('report.retry')}</button></div>
      </div>}
    </>}
  </div>;
}

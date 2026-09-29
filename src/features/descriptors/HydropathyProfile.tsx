import { useEffect, useMemo, useRef, useState } from 'react';
import { validateSequence } from '../editor/sequence';
import { getChartStyle } from './chartStyle';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import type { ProfilePoint, HydropathyWindow } from './profile';
import type { ResiduePropensity } from './chouFasman';
import { useTranslation } from '../../i18n';

const ROWS_PER_PAGE = 50;
const VALUE_FORMAT = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;

interface ReceivedProfile {
  sequence: string;
  windowSize: HydropathyWindow;
  points: ProfilePoint[];
  propensities: ResiduePropensity[];
}

/** Draws the profile off the main thread and presents its values in a table. */
export function HydropathyProfile({ text }: { text: string }): React.JSX.Element {
  const { t, formatNumber, locale } = useTranslation();
  const [windowSize, setWindowSize] = useState<HydropathyWindow>(9);
  const [profile, setProfile] = useState<ReceivedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const chartUnavailable = typeof HTMLCanvasElement.prototype.transferControlToOffscreen !== 'function';
  const validation = useMemo(() => validateSequence(text), [text]);
  const container = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worker = useRef<Worker | null>(null);
  const currentRequest = useRef(0);
  const sentSequence = useRef('');
  const sentWindow = useRef<HydropathyWindow>(9);

  useEffect(() => {
    try {
      const instance = new Worker(new URL('./profile.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<ProfileResponse>) => {
        if (event.data.id !== currentRequest.current) return;
        if (event.data.error) {
          setError(event.data.error);
          return;
        }
        setProfile({
          sequence: sentSequence.current,
          windowSize: sentWindow.current,
          points: event.data.points ?? [],
          propensities: event.data.propensities ?? [],
        });
        setPage(0);
        setError(null);
      };
      instance.onerror = () => { setError(t('profile.workerError')); };

      const canvas = document.createElement('canvas');
      canvas.className = 'hydropathy-chart';
      canvas.setAttribute('aria-hidden', 'true');
      container.current?.append(canvas);
      canvasRef.current = canvas;
      if (typeof canvas.transferControlToOffscreen === 'function') {
        const transferred = canvas.transferControlToOffscreen();
        const message: ProfileRequest = {
          type: 'initialize',
          canvas: transferred,
          style: getChartStyle(canvas, locale),
        };
        instance.postMessage(message, [transferred]);
      }
    } catch {
      queueMicrotask(() => { setError(t('profile.startError')); });
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
      canvasRef.current?.remove();
      canvasRef.current = null;
    };
  }, [t, locale]);

  useEffect(() => {
    currentRequest.current += 1;
    if (validation.invalidPositions.length > 0 || validation.sequence.length === 0) return;
    const send = () => {
      const canvas = canvasRef.current;
      if (!canvas || !worker.current) return;
      const id = ++currentRequest.current;
      sentSequence.current = validation.sequence;
      sentWindow.current = windowSize;
      const rectangle = canvas.getBoundingClientRect();
      const request: ProfileRequest = {
        type: 'calculate',
        id,
        sequence: validation.sequence,
        windowSize,
        width: Math.max(1, rectangle.width),
        height: Math.max(1, rectangle.height),
        scale: Math.max(1, window.devicePixelRatio || 1),
        style: getChartStyle(canvas, locale),
      };
      worker.current.postMessage(request);
    };
    send();
    window.addEventListener('resize', send);
    return () => { window.removeEventListener('resize', send); };
  }, [validation, windowSize, locale]);

  const invalid = validation.invalidPositions.length > 0;
  const tooShort = !invalid && validation.sequence.length > 0 && validation.sequence.length < windowSize;
  const current = !invalid && profile?.sequence === validation.sequence
    && profile.windowSize === windowSize;
  const points = invalid ? (profile?.points ?? []) : current ? profile.points : [];
  const propensities = invalid ? (profile?.propensities ?? []) : current ? profile.propensities : [];
  const hydropathyByResidue = new Map(points.map((point) => [point.position, point.value]));
  const displayedWindow = invalid ? (profile?.windowSize ?? windowSize) : windowSize;
  const totalPages = Math.ceil(propensities.length / ROWS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const rows = propensities.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);

  return (
    <section aria-labelledby="profile-title" className="profile-panel">
      <h2 id="profile-title">{t('profile.title')}</h2>
      <label htmlFor="hydropathy-window">{t('profile.windowLabel')}</label>
      <select
        id="hydropathy-window"
        value={windowSize}
        onChange={(event) => { setWindowSize(Number(event.target.value) as HydropathyWindow); }}
      >
        <option value="9">{t('profile.window9', { count: formatNumber(9) })}</option>
        <option value="19">{t('profile.window19', { count: formatNumber(19) })}</option>
      </select>
      <p>{t('profile.scaleNote')}</p>
      <p>
        {t('profile.chouFasmanNote')}{' '}
        <a href="https://web.expasy.org/protscale/pscale/alpha-helixFasman.html">{t('profile.helixLink')}</a>,{' '}
        <a href="https://web.expasy.org/protscale/pscale/beta-sheetFasman.html">{t('profile.sheetLink')}</a> {t('profile.and')}{' '}
        <a href="https://web.expasy.org/protscale/pscale/beta-turnFasman.html">{t('profile.turnLink')}</a>.
      </p>
      <p id="profile-status" role="status" aria-live="polite">
        {invalid && t('profile.invalid')}
        {tooShort && t('profile.tooShort', { count: formatNumber(windowSize) })}
        {!invalid && !tooShort && validation.sequence.length === 0 && t('profile.empty')}
        {!invalid && !tooShort && validation.sequence.length > 0 && !current && !error && t('profile.calculating')}
        {error && !invalid && t('profile.workerMessage', { message: error })}
        {chartUnavailable && current && !tooShort && t('profile.unavailable')}
      </p>
      <div
        className={invalid ? 'stale-chart' : !current ? 'pending-chart' : undefined}
        hidden={tooShort || validation.sequence.length === 0 || chartUnavailable}
      >
        <div ref={container} className="chart-container" />
      </div>
      {propensities.length > 0 && (
        <div className={invalid ? 'stale-table' : undefined}>
          <div className="profile-table-container">
            <table>
              <caption>{t('profile.caption', { count: formatNumber(displayedWindow) })}</caption>
              <thead><tr><th scope="col">{t('profile.position')}</th><th scope="col">{t('profile.residue')}</th><th scope="col">{t('profile.hydropathy')}</th><th scope="col">{t('profile.helix')}</th><th scope="col">{t('profile.sheet')}</th><th scope="col">{t('profile.turn')}</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.position}>
                    <th scope="row">{formatNumber(row.position)}</th>
                    <td>{row.residue}</td>
                    <td>{hydropathyByResidue.has(row.position)
                      ? hydropathyByResidue.get(row.position) === null
                        ? t('profile.missing')
                        : formatNumber(hydropathyByResidue.get(row.position) ?? 0, VALUE_FORMAT)
                      : <span aria-label={t('profile.noWindow')}>{t('profile.noValue')}</span>}</td>
                    <td>{row.helix === null ? t('profile.missing') : formatNumber(row.helix, VALUE_FORMAT)}</td>
                    <td>{row.sheet === null ? t('profile.missing') : formatNumber(row.sheet, VALUE_FORMAT)}</td>
                    <td>{row.turn === null ? t('profile.missing') : formatNumber(row.turn, VALUE_FORMAT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav aria-label={t('profile.pagesLabel')} className="profile-pages">
              <button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); }}>{t('profile.previous')}</button>
              <span aria-live="polite">{t('profile.pageCount', { page: formatNumber(currentPage + 1), total: formatNumber(totalPages) })}</span>
              <button type="button" disabled={currentPage + 1 >= totalPages} onClick={() => { setPage(currentPage + 1); }}>{t('profile.next')}</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { validateSequence } from '../editor/sequence';
import { getChartStyle } from './chartStyle';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import type { ProfilePoint } from './profile';
import type { ResiduePropensity } from './chouFasman';
import {
  DEFAULT_HYDROPATHY_WINDOW, HYDROPATHY_WINDOWS, METHOD_REFERENCES, PROFILE_ROWS_PER_PAGE, PROFILE_VALUE_FORMAT,
  WINDOW_PURPOSE_KEYS,
} from './config';
import type { HydropathyWindow } from './config';
import { positionAtX, profileX, windowRange } from './chartGeometry';
import { ResidueReader } from './ResidueReader';
import { useTranslation } from '../../i18n';
import { useThemeRevision } from '../../theme/useThemeRevision';
import type { LocalizedText } from '../../i18n/localized';
import { SegmentedControl } from '../../shared/SegmentedControl';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';
import { SequenceRibbon } from '../chemistry/SequenceRibbon';
import { RESIDUE_NAMES } from '../chemistry/config';
import { disulfidePartner, regionAt } from '../editor/annotations';
import type { SequenceAnnotations } from '../editor/annotations';
import { PropensityStrips } from './PropensityStrips';

// The reader, map and strips repeat every residue; they skip a parent render whose props did not change.
const StableRibbon = memo(SequenceRibbon);
const StableReader = memo(ResidueReader);
const StableStrips = memo(PropensityStrips);
const NO_POINTS: ProfilePoint[] = [];
const NO_PROPENSITIES: ResiduePropensity[] = [];

interface ReceivedProfile {
  sequence: string;
  windowSize: HydropathyWindow;
  points: ProfilePoint[];
  propensities: ResiduePropensity[];
}

interface Props {
  /** Visibility only: computation and selection survive view changes. */
  view?: 'all' | 'sequence' | 'profile' | 'structure' | 'none';
  panelId?: string;
  text: string;
  windowSize?: HydropathyWindow;
  onWindowChange?: (value: HydropathyWindow) => void;
  /** Selected one-based residue, when a parent links it to other views. */
  selected?: number | null;
  onSelect?: (position: number | null) => void;
  /** Regions and bridges of a bundled reference; pasted sequences have none. */
  annotations?: SequenceAnnotations | null;
}

/** The sequence, its profile drawn off the main thread and the per-residue tendencies, linked by one selection. */
export function HydropathyProfile({ text, windowSize: controlledWindow, onWindowChange, selected: controlledSelected, onSelect, annotations = null, view = 'all', panelId }: Props): React.JSX.Element {
  const { t, formatNumber, locale, localize } = useTranslation();
  const themeRevision = useThemeRevision();
  const [localWindow, setLocalWindow] = useState<HydropathyWindow>(DEFAULT_HYDROPATHY_WINDOW);
  const windowSize = controlledWindow ?? localWindow;
  const setWindowSize = onWindowChange ?? setLocalWindow;
  const [profile, setProfile] = useState<ReceivedProfile | null>(null);
  const [error, setError] = useState<LocalizedText | null>(null);
  const [page, setPage] = useState(0);
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const selected = controlledSelected === undefined ? localSelected : controlledSelected;
  const setSelected = onSelect ?? setLocalSelected;
  // Children get one stable callback; it always forwards to the latest selection handler.
  const selectionTarget = useRef(setSelected);
  useLayoutEffect(() => { selectionTarget.current = setSelected; });
  const selectResidue = useCallback((position: number | null) => { selectionTarget.current(position); }, []);
  const [chartBox, setChartBox] = useState<{ width: number; margin: number } | null>(null);
  const chartUnavailable = typeof HTMLCanvasElement.prototype.transferControlToOffscreen !== 'function';
  const validation = useMemo(() => validateSequence(text), [text]);
  const container = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worker = useRef<Worker | null>(null);
  const currentRequest = useRef(0);
  const sentSequence = useRef('');
  const sentWindow = useRef<HydropathyWindow>(DEFAULT_HYDROPATHY_WINDOW);
  const previousAppearance = useRef({ themeRevision, locale, view });

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
        const received = { sequence: sentSequence.current, windowSize: sentWindow.current, points: event.data.points, propensities: event.data.propensities };
        // Hundreds of cells arrive at once, mostly in views not shown yet; urgent updates such as typing or the
        // descriptor figures are painted first and this render yields to them.
        startTransition(() => {
          setProfile(received);
          setPage(0);
          setError(null);
        });
      };
      instance.onerror = () => { setError({ key: 'profile.workerError' }); };

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
          style: getChartStyle(canvas),
        };
        instance.postMessage(message, [transferred]);
      }
    } catch {
      queueMicrotask(() => { setError({ key: 'profile.startError' }); });
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
      canvasRef.current?.remove();
      canvasRef.current = null;
    };
  }, []);

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
  }, [validation, windowSize, locale]);

  useEffect(() => {
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !worker.current) return;
      const rectangle = canvas.getBoundingClientRect();
      const request: ProfileRequest = {
        type: 'redraw', id: currentRequest.current,
        width: Math.max(1, rectangle.width), height: Math.max(1, rectangle.height),
        scale: Math.max(1, window.devicePixelRatio || 1), style: getChartStyle(canvas, locale),
      };
      worker.current.postMessage(request);
    };
    if (previousAppearance.current.themeRevision !== themeRevision || previousAppearance.current.locale !== locale || previousAppearance.current.view !== view) redraw();
    previousAppearance.current = { themeRevision, locale, view };
    window.addEventListener('resize', redraw);
    return () => { window.removeEventListener('resize', redraw); };
  }, [themeRevision, locale, view]);

  const invalid = validation.invalidPositions.length > 0;
  const tooShort = !invalid && validation.sequence.length > 0 && validation.sequence.length < windowSize;
  const current = !invalid && profile?.sequence === validation.sequence
    && profile.windowSize === windowSize;
  const shown = invalid ? profile : current ? profile : null;
  const points = shown?.points ?? NO_POINTS;
  const propensities = shown?.propensities ?? NO_PROPENSITIES;
  const hydropathyByResidue = useMemo(() => new Map(points.map((point) => [point.position, point.value])), [points]);
  const displayedWindow = shown?.windowSize ?? windowSize;
  const totalPages = Math.ceil(propensities.length / PROFILE_ROWS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const shownSequence = shown?.sequence ?? '';
  const activeSelection = selected !== null && selected <= shownSequence.length ? selected : null;
  // Only residues with a complete window have a value; elsewhere no window is highlighted.
  const selectionHasWindow = activeSelection !== null && hydropathyByResidue.has(activeSelection);
  const chartVisible = !tooShort && validation.sequence.length > 0 && !chartUnavailable;
  const hasInput = validation.sequence.length > 0 || invalid;

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    // The overlay follows the canvas box, including when the chart is revealed or resized.
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const next = { width: canvas.getBoundingClientRect().width, margin: getChartStyle(canvas, locale).margin };
      setChartBox((box) => box?.width === next.width && box.margin === next.margin ? box : next);
    });
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [locale]);

  const axis = points.length > 0 && chartBox && chartBox.width > 0
    ? { first: points[0]?.position ?? 0, last: points.at(-1)?.position ?? 0, width: chartBox.width, margin: chartBox.margin }
    : null;
  const marker = axis && activeSelection !== null && selectionHasWindow ? (() => {
    const range = windowRange(activeSelection, displayedWindow, shownSequence.length);
    const clampX = (x: number) => Math.min(axis.width, Math.max(0, x));
    const left = clampX(profileX(range.start, axis));
    return {
      left,
      width: Math.max(1, clampX(profileX(range.end, axis)) - left),
      cursor: profileX(activeSelection, axis),
    };
  })() : null;

  const selectedRow = activeSelection === null ? undefined : propensities[activeSelection - 1];
  const selectedValue = activeSelection === null ? undefined : hydropathyByResidue.get(activeSelection);
  const selectedRange = activeSelection === null ? null : windowRange(activeSelection, displayedWindow, shownSequence.length);
  const format = useCallback((value: number | null) => value === null ? t('profile.missing') : formatNumber(value, PROFILE_VALUE_FORMAT), [t, formatNumber]);
  const selectedRegion = annotations && activeSelection !== null ? regionAt(annotations, activeSelection) : undefined;
  const selectedPartner = annotations && activeSelection !== null ? disulfidePartner(annotations, activeSelection) : undefined;
  const readoutName = selectedRow ? t('profile.readerName', { name: RESIDUE_NAMES[selectedRow.residue] ?? selectedRow.residue, position: formatNumber(selectedRow.position) }) : '';
  const readout = selectedRow && selectedRange ? [
    selectedRegion ? t('profile.readerRegion', { region: t(selectedRegion.labelKey), index: formatNumber(selectedRow.position - selectedRegion.start + 1) }) : '',
    selectedPartner === undefined ? '' : t('profile.readerBridge', { position: formatNumber(selectedPartner) }),
    selectedValue === undefined ? t('profile.readerNoWindow')
      : selectedValue === null ? t('profile.readerMissing')
        : t('profile.readerHydropathy', { value: format(selectedValue), start: formatNumber(selectedRange.start), end: formatNumber(selectedRange.end) }),
    t('profile.readerPropensities', { helix: format(selectedRow.helix), sheet: format(selectedRow.sheet), turn: format(selectedRow.turn) }),
  ].filter(Boolean).join(' · ') : t('profile.readerHint');
  const isCut = useMemo(() => annotations
    ? (position: number): boolean => !annotations.regions.some((region) => region.mature && position >= region.start && position <= region.end)
    : undefined, [annotations]);
  const tableRows = useMemo(() => propensities.slice(currentPage * PROFILE_ROWS_PER_PAGE, (currentPage + 1) * PROFILE_ROWS_PER_PAGE).map((row) => (
    <tr key={row.position} aria-selected={row.position === activeSelection ? true : undefined}>
      <th scope="row">{formatNumber(row.position)}</th>
      <td className="residue-cell">{row.residue}</td>
      <td>{hydropathyByResidue.has(row.position)
        ? format(hydropathyByResidue.get(row.position) ?? null)
        : <span aria-label={t('profile.noWindow')}>{t('profile.noValue')}</span>}</td>
      <td>{format(row.helix)}</td>
      <td>{format(row.sheet)}</td>
      <td>{format(row.turn)}</td>
    </tr>
  )), [propensities, currentPage, activeSelection, hydropathyByResidue, format, formatNumber, t]);

  const selectFromChart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!axis) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setSelected(positionAtX(event.clientX - bounds.left, axis));
  };

  return (
    <>
      {shownSequence.length > 0 && (
        <section id={panelId ? `${panelId}-sequence-panel` : undefined} role={panelId && view !== 'structure' ? 'tabpanel' : undefined}
          aria-labelledby={panelId && view !== 'structure' ? `${panelId}-sequence-tab` : 'sequence-title'} hidden={view !== 'all' && view !== 'sequence' && view !== 'structure'} className={`section reader-section${invalid ? ' stale-reader' : ''}`}>
          <h2 id="sequence-title">{t('profile.readerTitle')}</h2>
          {annotations && (
            <StableRibbon sequence={shownSequence} annotations={annotations} selected={activeSelection} onSelect={selectResidue} label={t('profile.mapLabel')} />
          )}
          <StableReader
            sequence={shownSequence}
            windowSize={selectionHasWindow ? displayedWindow : 1}
            selected={activeSelection}
            onSelect={selectResidue}
            describedBy="reader-readout"
            isMuted={isCut}
          />
          <ChemistryLegend />
          <p id="reader-readout" className="reader-readout" aria-live="polite">{readoutName && <strong>{readoutName}</strong>}{readoutName ? ' · ' : ''}{readout}</p>
        </section>
      )}
      <div id={panelId ? `${panelId}-profile-panel` : undefined} role={panelId ? 'tabpanel' : undefined}
        aria-labelledby={panelId ? `${panelId}-profile-tab` : undefined} hidden={view !== 'all' && view !== 'profile'}>
      <section aria-labelledby="profile-title" className="section profile-panel">
        <div className="section-header">
          <h2 id="profile-title">{t('profile.title')}</h2>
          <div className="segmented-bare">
            <SegmentedControl
              legend={t('profile.windowLabel')}
              options={HYDROPATHY_WINDOWS.map((size) => ({ value: size, label: t('profile.windowOption', { count: formatNumber(size) }) }))}
              value={windowSize}
              onChange={setWindowSize}
              describedBy="profile-window-purpose"
            />
          </div>
        </div>
        <p id="profile-status" className="status-message" data-state={invalid ? 'invalid' : error ? 'error' : 'idle'} role="status" aria-live="polite">
          {invalid && t('profile.invalid')}
          {tooShort && t('profile.tooShort', { count: formatNumber(windowSize) })}
          {!invalid && !tooShort && validation.sequence.length === 0 && t('profile.empty')}
          {!invalid && !tooShort && validation.sequence.length > 0 && !current && !error && t('profile.calculating')}
          {error && !invalid && t('profile.workerMessage', { message: localize(error) })}
          {chartUnavailable && current && !tooShort && t('profile.unavailable')}
        </p>
        <div
          className={`chart-frame${invalid ? ' stale-chart' : !current ? ' pending-chart' : ''}`}
          hidden={!chartVisible}
          onPointerMove={(event) => { if (event.pointerType === 'mouse') selectFromChart(event); }}
          onPointerDown={selectFromChart}
        >
          <div ref={container} className="chart-container" />
          {marker && <div className="chart-window" aria-hidden="true" style={{ left: marker.left, width: marker.width }} />}
          {marker && <div className="chart-cursor" aria-hidden="true" style={{ left: marker.cursor }} />}
        </div>
        <p id="profile-window-purpose" className="field-help">{t(WINDOW_PURPOSE_KEYS[windowSize], { count: formatNumber(windowSize) })} {t('profile.scaleNote')}</p>
      </section>
      {hasInput && (
        <section aria-labelledby="tendency-title" className={`section${invalid ? ' stale-table' : ''}`}>
          <h2 id="tendency-title">{t('profile.tendencyTitle')}</h2>
          {propensities.length > 0 && <StableStrips propensities={propensities} />}
          <p className="field-help">{t('profile.tendencyNote')}</p>
          <details className="disclosure">
            <summary>{t('profile.tableToggle')}</summary>
            {propensities.length > 0 && <div>
              <div className="profile-table-container" tabIndex={0} role="region" aria-label={t('profile.tableRegion')}>
                <table>
                  <caption>{t('profile.caption', { count: formatNumber(displayedWindow) })}</caption>
                  <thead><tr><th scope="col">{t('profile.position')}</th><th scope="col">{t('profile.residue')}</th><th scope="col">{t('profile.hydropathy')}</th><th scope="col">{t('profile.helix')}</th><th scope="col">{t('profile.sheet')}</th><th scope="col">{t('profile.turn')}</th></tr></thead>
                  <tbody>{tableRows}</tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <nav aria-label={t('profile.pagesLabel')} className="profile-pages">
                  <button className="button button-secondary" type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); }}>{t('profile.previous')}</button>
                  <span aria-live="polite">{t('profile.pageCount', { page: formatNumber(currentPage + 1), total: formatNumber(totalPages) })}</span>
                  <button className="button button-secondary" type="button" disabled={currentPage + 1 >= totalPages} onClick={() => { setPage(currentPage + 1); }}>{t('profile.next')}</button>
                </nav>
              )}
            </div>}
          </details>
          <details className="disclosure">
            <summary>{t('profile.methodsToggle')}</summary>
            <p className="field-help">{t('profile.chouFasmanNote')}</p>
            <ul className="reference-list">
              {METHOD_REFERENCES.map((reference) => (
                <li key={reference.url}><a href={reference.url}>{t(reference.labelKey)}</a></li>
              ))}
            </ul>
          </details>
        </section>
      )}
      </div>
    </>
  );
}

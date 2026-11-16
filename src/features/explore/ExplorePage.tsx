import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { Icon } from '../../shared/Icon';
import { PageHeading } from '../../shared/PageHeading';
import { ApiError } from '../api/apiClient';
import type { ApiErrorCode } from '../api/apiClient';
import { readApiBaseUrl } from '../api/config';
import { useAuth } from '../auth/authContext';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';
import { RESIDUE_NAMES } from '../chemistry/config';
import { MutationPreview } from '../descriptors/MutationPreview';
import { useDescriptors } from '../descriptors/useDescriptors';
import { useSequenceDraft } from '../editor/sequenceDraft';
import type { SequenceSource } from '../editor/source';
import { REFERENCE_CATALOG } from '../library/catalog';
import { UNIPROT_QUERY_MAX_LENGTH, UNIPROT_URL } from '../library/config';
import { createLibraryApi } from '../library/libraryApi';
import type { EntrySummary, UniProtEntry } from '../library/libraryApi';
import type { ModelProblem } from './alphafold';
import {
  ALPHAFOLD_ENTRY_URL, CONFIDENCE_BANDS, EXPLORE_DEFAULT_ACCESSION, EXPLORE_PARAM, FOCUS_STICKS_MAX_RESIDUES, FUNCTION_PREVIEW_CHARACTERS,
  STOP_GROUP_LABEL_KEYS, STOP_GROUP_OF, STOP_GROUP_PREVIEW, STOP_KIND_LABEL_KEYS, STOP_KIND_MEANING_KEYS,
} from './config';
import type { StopGroup } from './config';
import { translateAnnotation, withoutCitations } from './annotationTerms';
import { groupStops, stopPositions, stopSize, stopsAt, stopsFrom } from './stops';
import type { Stop } from './stops';
import { useProtein } from './useProtein';
import type { StructureFocus } from './PredictedStructure';
import './explore.css';

const PredictedStructure = lazy(() => import('./PredictedStructure'));

const ACCESSION = /^[A-Z0-9]{6,10}$/;
const MODEL_PROBLEM_KEYS = {
  missing: 'explore.modelMissing', partial: 'explore.modelPartial', mismatch: 'explore.modelMismatch', unavailable: 'explore.modelUnavailable',
} as const satisfies Record<ModelProblem, TranslationKey>;
const SEARCH_ERROR_KEYS: Partial<Record<ApiErrorCode, TranslationKey>> = { session: 'library.session', validation: 'library.invalidQuery', 'rate-limit': 'projects.rateLimit' };
const ENTRY_ERROR_KEYS: Partial<Record<ApiErrorCode, TranslationKey>> = { session: 'library.session', 'not-found': 'library.notFound', 'rate-limit': 'projects.rateLimit' };

type Loaders = Parameters<typeof useProtein>[1];

/** A protein to walk through: its predicted model, and the annotated places of its chain as stops that explain themselves. */
export function ExplorePage({ loaders }: { loaders?: Loaders }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const [parameters, setParameters] = useSearchParams();
  const requested = parameters.get(EXPLORE_PARAM)?.toUpperCase() ?? '';
  const accession = ACCESSION.test(requested) ? requested : EXPLORE_DEFAULT_ACCESSION;
  const protein = useProtein(accession, loaders);
  const entry = protein.entry.status === 'ready' ? protein.entry.entry : null;
  const stops = useMemo(() => entry ? stopsFrom(entry.features, entry.sequence.length) : [], [entry]);
  const groups = useMemo(() => groupStops(stops), [stops]);
  const ordered = useMemo(() => groups.flatMap(group => group.stops), [groups]);
  // What is selected belongs to one protein; opening another starts from the whole chain.
  const [selection, setSelection] = useState<{ accession: string; stop: string | null; picked: number | null }>({ accession, stop: null, picked: null });
  const current = selection.accession === accession ? selection : { accession, stop: null, picked: null };
  const stop = ordered.find(item => item.id === current.stop) ?? null;
  const stopIndex = stop ? ordered.indexOf(stop) : -1;
  const heading = useRef<HTMLHeadingElement>(null);
  // A substitution is tried on one residue: the one picked on the model, or the one a single-residue stop marks.
  const trial = current.picked ?? (stop && stop.begin === stop.end ? stop.begin : null);

  function open(next: string): void { setParameters({ [EXPLORE_PARAM]: next }); }
  function visit(next: Stop | null): void {
    setSelection({ accession, stop: next?.id ?? null, picked: null });
    // The stop's explanation is what changed; reading continues from its title.
    requestAnimationFrame(() => { heading.current?.focus({ preventScroll: false }); });
  }
  // What the model shows, written over it: the stop of the tour, or the residue picked on the model.
  const caption = stop
    ? t('explore.caption', { index: formatNumber(stopIndex + 1), total: formatNumber(ordered.length), kind: t(STOP_KIND_LABEL_KEYS[stop.kind]), place: placeOf(stop, t, formatNumber) })
    : current.picked !== null && entry ? t('explore.residue', { name: residueName(entry, current.picked), position: formatNumber(current.picked) }) : null;
  const focus = useMemo<StructureFocus | null>(() => stop
    ? { key: stop.id, positions: stopPositions(stop), sticks: stopSize(stop) <= FOCUS_STICKS_MAX_RESIDUES }
    : current.picked !== null ? { key: `residue-${String(current.picked)}`, positions: [current.picked], sticks: true } : null,
  [stop, current.picked]);

  return (
    <main className="page explore-page">
      <PageHeading titleKey="explore.title" introduction="explore.introduction" />
      <ProteinChooser current={accession} onOpen={open} />

      {protein.entry.status === 'loading' && <p className="status-message" role="status">{t('explore.loading')}</p>}
      {protein.entry.status === 'error' && (
        <section className="library-section" aria-live="polite">
          <p className="status-message" data-state="error">{t(ENTRY_ERROR_KEYS[protein.entry.error.code] ?? 'explore.entryError')}</p>
          <div className="actions"><button type="button" className="button button-secondary" onClick={protein.retryEntry}>{t('explore.entryRetry')}</button></div>
        </section>
      )}

      {entry && (
        <section className="library-section explore-protein" aria-labelledby="explore-protein-name">
          <header className="explore-identity">
            <p className="field-meta">{entry.accession} · {t(entry.reviewed ? 'library.reviewed' : 'library.unreviewed')}</p>
            <h2 id="explore-protein-name">{entry.name}</h2>
            <p>{t('explore.summary', { organism: entry.organism, count: formatNumber(entry.sequence.length) })}</p>
          </header>

          {/* Without a model there is nothing to keep beside the reading, so the layout gives the text the width. */}
          <div className="explore-layout" data-model={protein.model.status}>
            <div className="explore-stage">
              {ordered.length > 0 && (
                <StopReading key={stop?.id ?? 'whole'} stop={stop} index={stopIndex} total={ordered.length} entry={entry} headingRef={heading}
                  onPrevious={() => { visit(ordered[(stopIndex - 1 + ordered.length) % ordered.length] ?? null); }}
                  onNext={() => { visit(ordered[(stopIndex + 1) % ordered.length] ?? null); }}
                  onWhole={() => { visit(null); }} />
              )}
              {protein.model.status === 'loading' && <p className="status-message" role="status">{t('explore.modelLoading')}</p>}
              {protein.model.status === 'absent' && (
                <div className="notice" role="status">
                  <p>{t(MODEL_PROBLEM_KEYS[protein.model.reason])} {t('explore.modelAbsentHelp')}</p>
                  {protein.model.reason === 'unavailable' && <button type="button" className="button button-secondary" onClick={protein.retryModel}>{t('explore.modelRetry')}</button>}
                </div>
              )}
              {protein.model.status === 'ready' && <>
                <Suspense fallback={<p className="status-message" role="status">{t('library.viewerLoading')}</p>}>
                  <PredictedStructure key={protein.model.model.url} url={protein.model.model.url} label={t('explore.modelLabel', { name: entry.name })} focus={focus} caption={caption}
                    onPick={(position) => { setSelection({ accession, stop: null, picked: position !== null && position <= entry.sequence.length ? position : null }); }} />
                </Suspense>
                <p className="field-help">{t('explore.colorNote')}</p>
                <ChemistryLegend />
                <p className="field-help">
                  {t('explore.modelProvenance', {
                    version: formatNumber(protein.model.model.version), score: formatNumber(Math.round(protein.model.model.confidence)),
                    band: t(CONFIDENCE_BANDS.find(band => protein.model.status === 'ready' && protein.model.model.confidence >= band.from)?.key ?? 'explore.confidenceVeryLow'),
                  })} {t('explore.modelScope')}
                </p>
              </>}
              {current.picked !== null && <PickedResidue position={current.picked} entry={entry} stops={stopsAt(ordered, current.picked)} onVisit={visit} />}
              {trial !== null && <ResidueTrial key={`${accession}-${String(trial)}`} position={trial} entry={entry} stops={stopsAt(ordered, trial)} />}
            </div>

            <div className="explore-reading">
              <section aria-labelledby="explore-function-title">
                <h3 id="explore-function-title">{t('explore.functionTitle')}</h3>
                {entry.function
                  ? <FunctionText key={entry.accession} text={entry.function} />
                  : <p className="field-help">{t('explore.noFunction')}</p>}
              </section>

              <section className="explore-tour" aria-labelledby="explore-tour-title">
                <h3 id="explore-tour-title">{t('explore.tourTitle')}</h3>
                {ordered.length === 0 ? <p className="field-help">{t('explore.tourEmpty')}</p>
                  : <p className="field-help">{t(ordered.length === 1 ? 'explore.tourCountOne' : 'explore.tourCount', { count: formatNumber(ordered.length) })}{entry.featuresTruncated && ` ${t('explore.tourTruncated')}`}</p>}
                {groups.map(group => <StopGroupList key={`${accession}-${group.group}`} group={group.group} stops={group.stops} current={stop} onVisit={visit} />)}
              </section>
            </div>
          </div>

          <ProteinActions entry={entry} hasModel={protein.model.status === 'ready'} />
        </section>
      )}
    </main>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];
type FormatNumber = ReturnType<typeof useTranslation>['formatNumber'];

function placeOf(stop: Stop, t: Translate, formatNumber: FormatNumber): string {
  const variables = { begin: formatNumber(stop.begin), end: formatNumber(stop.end) };
  return t(stop.begin === stop.end ? 'explore.single' : stop.paired ? 'explore.pair' : 'explore.span', variables);
}

function residueName(entry: UniProtEntry, position: number): string {
  const letter = entry.sequence[position - 1] ?? '';
  return RESIDUE_NAMES[letter] ?? letter;
}

/** UniProt's description of what the protein does, without literature references; a long one opens folded. */
function FunctionText({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation();
  const clean = withoutCitations(text);
  const long = clean.length > FUNCTION_PREVIEW_CHARACTERS;
  const [open, setOpen] = useState(false);
  return (
    <div className="entry-annotation explore-function" data-folded={long && !open}>
      <p className="field-help">{t('library.functionNote')}</p>
      <p id="explore-function-text">{clean}</p>
      {long && <button type="button" className="button button-quiet" aria-expanded={open} aria-controls="explore-function-text" onClick={() => { setOpen(value => !value); }}>
        {t(open ? 'explore.readLess' : 'explore.readMore')}
      </button>}
    </div>
  );
}

/** One group of stops; a long group shows its first stops and opens on request, or when the tour reaches a hidden one. */
function StopGroupList({ group, stops, current, onVisit }: { group: StopGroup; stops: readonly Stop[]; current: Stop | null; onVisit: (stop: Stop) => void }): React.JSX.Element {
  const { t, formatNumber, locale } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const currentIndex = current ? stops.indexOf(current) : -1;
  const open = expanded || currentIndex >= STOP_GROUP_PREVIEW;
  const shown = open ? stops : stops.slice(0, STOP_GROUP_PREVIEW);
  const listId = `explore-stops-${group}`;
  return (
    <div className="explore-group">
      <h4>{t(STOP_GROUP_LABEL_KEYS[group])}</h4>
      <ul className="explore-stops" id={listId}>
        {shown.map(item => (
          <li key={item.id}>
            <button type="button" className="explore-stop" aria-pressed={item.id === current?.id} onClick={() => { onVisit(item); }}>
              <span className="explore-stop-kind">{t(STOP_KIND_LABEL_KEYS[item.kind])}</span>
              <span className="explore-stop-place">{placeOf(item, t, formatNumber)}</span>
              {item.description && <span className="explore-stop-note">{translateAnnotation(item.description, locale)}</span>}
            </button>
          </li>
        ))}
      </ul>
      {stops.length > STOP_GROUP_PREVIEW && currentIndex < STOP_GROUP_PREVIEW && (
        <button type="button" className="button button-quiet" aria-expanded={open} aria-controls={listId} onClick={() => { setExpanded(value => !value); }}>
          {open ? t('explore.showFewer') : t('explore.showAll', { count: formatNumber(stops.length) })}
        </button>
      )}
    </div>
  );
}

interface StopReadingProps {
  stop: Stop | null; index: number; total: number; entry: UniProtEntry;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onPrevious: () => void; onNext: () => void; onWhole: () => void;
}

/** The stop on screen: where it is, what that kind of place means and what UniProt says about this one. */
function StopReading({ stop, index, total, entry, headingRef, onPrevious, onNext, onWhole }: StopReadingProps): React.JSX.Element {
  const { t, formatNumber, locale } = useTranslation();
  const residues = stop && stopSize(stop) <= FOCUS_STICKS_MAX_RESIDUES
    ? stopPositions(stop).map(position => t('explore.residue', { name: residueName(entry, position), position: formatNumber(position) })).join(' · ')
    : stop ? t('explore.spanSize', { count: formatNumber(stopSize(stop)), begin: formatNumber(stop.begin), end: formatNumber(stop.end) }) : '';
  return (
    <article className="entry-detail explore-current" data-state={stop ? 'stop' : 'whole'} aria-labelledby="explore-current-title">
      {stop ? <>
        <p className="field-meta">{t('explore.tourProgress', { index: formatNumber(index + 1), total: formatNumber(total) })}</p>
        <h4 id="explore-current-title" ref={headingRef} tabIndex={-1}>{t(STOP_KIND_LABEL_KEYS[stop.kind])}</h4>
        <p className="explore-residues">{residues}</p>
        <p>{t(STOP_KIND_MEANING_KEYS[stop.kind])}</p>
        {stop.description && <div className="entry-annotation"><p className="field-help">{t('explore.sourceNote')}</p><p>{translateAnnotation(stop.description, locale)}</p></div>}
      </> : <>
        <h4 id="explore-current-title" ref={headingRef} tabIndex={-1}>{t('explore.wholeTitle')}</h4>
        <p>{t('explore.wholeHelp', { count: formatNumber(total) })}</p>
      </>}
      <div className="actions">
        {stop ? <>
          <button type="button" className="button button-secondary" onClick={onPrevious}>{t('explore.tourPrevious')}</button>
          <button type="button" className="button button-primary" onClick={onNext}>{t('explore.tourNext')}</button>
          <button type="button" className="button button-quiet" onClick={onWhole}>{t('explore.tourWhole')}</button>
        </> : <button type="button" className="button button-primary button-large" onClick={onNext}>{t('explore.tourStart')}<Icon name="arrow" /></button>}
      </div>
    </article>
  );
}

/** The residue selected on the model and the stops it belongs to. */
function PickedResidue({ position, entry, stops, onVisit }: { position: number; entry: UniProtEntry; stops: readonly Stop[]; onVisit: (stop: Stop) => void }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  return (
    <div className="explore-picked" role="status">
      <p><strong>{t('explore.pickedTitle', { position: formatNumber(position), name: residueName(entry, position) })}</strong></p>
      {stops.length === 0 ? <p className="field-help">{t('explore.pickedNone')}</p> : <>
        <p className="field-help">{t('explore.pickedStops')}</p>
        <div className="actions">
          {stops.map(stop => <button key={stop.id} type="button" className="button button-secondary" onClick={() => { onVisit(stop); }}>{t(STOP_KIND_LABEL_KEYS[stop.kind])} · {placeOf(stop, t, formatNumber)}</button>)}
        </div>
      </>}
    </div>
  );
}

/** Takes a sequence to the analysis, asking first when that replaces a different one being analysed. */
function useAnalysis(): { open: (sequence: string, source: SequenceSource | null) => void; confirmation: React.JSX.Element | null } {
  const { t } = useTranslation();
  const draft = useSequenceDraft(); const navigate = useNavigate();
  const [pending, setPending] = useState<{ sequence: string; source: SequenceSource | null } | null>(null);
  function load(sequence: string, source: SequenceSource | null): void {
    draft.setText(sequence); draft.setSource(source); draft.setReferenceView(null);
    void navigate(ROUTES.analyze);
  }
  return {
    open: (sequence, source) => { if (draft.text && draft.text !== sequence) setPending({ sequence, source }); else load(sequence, source); },
    confirmation: pending && (
      <section className="project-confirm" aria-label={t('library.replaceTitle')}>
        <h3>{t('library.replaceTitle')}</h3>
        <p>{t('library.replaceHelp')}</p>
        <div className="actions">
          <button type="button" className="button button-secondary" onClick={() => { setPending(null); }}>{t('projects.cancel')}</button>
          <button type="button" className="button button-primary" onClick={() => { load(pending.sequence, pending.source); }}>{t('library.confirmLoad')}</button>
        </div>
      </section>
    ),
  };
}

/** What replacing one residue would do to the calculated properties, with what is annotated at that position. */
function ResidueTrial({ position, entry, stops }: { position: number; entry: UniProtEntry; stops: readonly Stop[] }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const base = useDescriptors(entry.sequence);
  const analysis = useAnalysis();
  const annotated = stops.filter(stop => STOP_GROUP_OF[stop.kind] === 'function' || STOP_GROUP_OF[stop.kind] === 'chemistry');
  const variants = stops.filter(stop => stop.kind === 'variant' && stop.description);
  return (
    <div className="explore-trial">
      <MutationPreview sequence={entry.sequence} selected={position} base={base} applyKey="explore.trialApply" onApply={(sequence) => { analysis.open(sequence, null); }} />
      <p className="field-help">{t('explore.trialHelp')}</p>
      {annotated.length > 0 && <p className="notice">{t('explore.trialAnnotated', { stops: annotated.map(stop => `${t(STOP_KIND_LABEL_KEYS[stop.kind])} (${placeOf(stop, t, formatNumber)})`).join(', ') })}</p>}
      {variants.length > 0 && <p className="field-help">{t('explore.trialVariants', { variants: variants.map(stop => stop.description).join('; ') })}</p>}
      {analysis.confirmation}
    </div>
  );
}

/** Where the protein on screen can be taken next, and the public records behind it. */
function ProteinActions({ entry, hasModel }: { entry: UniProtEntry; hasModel: boolean }): React.JSX.Element {
  const { t } = useTranslation();
  const analysis = useAnalysis();
  const source: SequenceSource = { origin: 'uniprot', accession: entry.accession, sequence: entry.sequence, entryVersion: entry.entryVersion, sequenceVersion: entry.sequenceVersion, retrievedAt: entry.retrievedAt };
  return <>
    {analysis.confirmation}
    <div className="actions explore-actions">
      <button type="button" className="button button-secondary" onClick={() => { analysis.open(entry.sequence, source); }}>{t('explore.analyze')}</button>
      <a className="inline-link" href={`${UNIPROT_URL}${entry.accession}`}>{t('library.source')}</a>
      {hasModel && <a className="inline-link" href={`${ALPHAFOLD_ENTRY_URL}${entry.accession}`}>{t('explore.alphafoldSource')}</a>}
      {entry.structures.length > 0 && <Link className="inline-link" to={ROUTES.library}>{t('explore.measured')}</Link>}
    </div>
  </>;
}

/** Bundled references to start with, and a search of UniProt for any other protein. */
function ProteinChooser({ current, onOpen }: { current: string; onOpen: (accession: string) => void }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const auth = useAuth();
  const token = auth.status === 'signed-in' ? auth.session?.accessToken ?? '' : '';
  const client = useMemo(() => { const url = readApiBaseUrl(); return url ? createLibraryApi(url) : null; }, []);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<EntrySummary[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);

  async function search(): Promise<void> {
    if (!client || !token) return;
    controller.current?.abort();
    const operation = new AbortController(); controller.current = operation;
    setBusy(true); setError(null);
    try {
      const result = await client.search(query.trim(), token, operation.signal);
      if (!operation.signal.aborted) { setItems(result.items); setTruncated(result.truncated); }
    } catch (failure) { if (!operation.signal.aborted) setError(failure instanceof ApiError ? failure : new ApiError('unknown')); }
    finally { if (controller.current === operation) setBusy(false); }
  }

  return (
    <section className="library-section" aria-labelledby="explore-choose-title">
      <h2 id="explore-choose-title">{t('explore.chooseTitle')}</h2>
      <div className="explore-suggested">
        <p className="field-help" id="explore-suggested-label">{t('explore.suggested')}</p>
        <ul aria-labelledby="explore-suggested-label">
          {REFERENCE_CATALOG.map(reference => (
            <li key={reference.accession}>
              <button type="button" className="button button-secondary" aria-pressed={reference.accession === current} onClick={() => { onOpen(reference.accession); }}>{t(reference.label)}</button>
            </li>
          ))}
        </ul>
      </div>
      {client && token && <>
        <p className="field-help" id="explore-query-help">{t('explore.searchHelp')}</p>
        <form className="library-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <div className="field">
            <label htmlFor="explore-query">{t('explore.query')}</label>
            <input id="explore-query" className="text-input" value={query} onChange={(event) => { setQuery(event.target.value); }} minLength={2} maxLength={UNIPROT_QUERY_MAX_LENGTH} aria-describedby="explore-query-help" required />
          </div>
          <button type="submit" className="button button-primary" disabled={busy || query.trim().length < 2}>{t('explore.search')}</button>
        </form>
      </>}
      <div role="status" aria-live="polite">
        {busy && <p className="status-message">{t('library.loading')}</p>}
        {error && <p className="status-message" data-state="error">{t(SEARCH_ERROR_KEYS[error.code] ?? 'library.error')}</p>}
      </div>
      {items && !busy && <>
        <p className="field-help">{t(items.length === 1 ? 'library.resultCountOne' : items.length ? 'library.resultCount' : 'library.noResults', { count: formatNumber(items.length) })}{truncated && ` ${t('library.truncated')}`}</p>
        <ul className="reference-listing">
          {items.map(record => (
            <li key={record.accession}>
              <div>
                <p className="field-meta">{record.accession} · {t(record.reviewed ? 'library.reviewed' : 'library.unreviewed')}</p>
                <h3>{record.name}</h3>
                <p className="field-help">{t('explore.summary', { organism: record.organism, count: formatNumber(record.length) })}</p>
              </div>
              <button type="button" className="button button-secondary" aria-label={t('explore.openEntry', { name: record.name })} onClick={() => { setItems(null); onOpen(record.accession); }}>{t('explore.open')}</button>
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}

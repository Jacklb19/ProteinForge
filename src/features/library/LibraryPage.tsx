import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { PageHeading } from '../../shared/PageHeading';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/apiClient';
import type { ApiErrorCode } from '../api/apiClient';
import { useSequenceDraft } from '../editor/sequenceDraft';
import type { SequenceSource } from '../editor/source';
import { REFERENCE_CATALOG } from './catalog';
import { createLibraryApi } from './libraryApi';
import type { EntrySummary, PdbReference, UniProtEntry } from './libraryApi';
import { UNIPROT_DEFAULT_QUERY, UNIPROT_QUERY_MAX_LENGTH, UNIPROT_URL } from './config';
import { annotationsForAccession } from '../editor/annotations';
import { StructureStage } from '../structure/StructureStage';
import { MappedStructure } from './MappedStructure';
import { isCurrentReference } from './referenceView';
import type { ReferenceView } from './referenceView';
import type { MappingLoader } from './mappingTypes';
import { ViewTabs } from '../../shared/ViewTabs';
import { DomainsPanel } from '../domains/DomainsPanel';
import { OPEN_PROJECT_STATE } from '../editor/config';

const INSULIN_ACCESSION = 'P01308';
const INSULIN_STRUCTURE: PdbReference = { id: '1TRZ', method: 'X-ray', resolution: '1.60 Å', chains: 'A/C=90-110, B/D=25-54' };
const INSULIN_REFERENCE = (() => {
  const reference = REFERENCE_CATALOG.find(item => item.accession === INSULIN_ACCESSION);
  if (!reference) throw new Error('Missing bundled reference');
  return reference;
})();

interface Loading { text: string; source: SequenceSource | null; view: ReferenceView | null; openProject?: boolean }

export function LibraryPage({ mappingLoader }: { mappingLoader?: MappingLoader | null }): React.JSX.Element {
  const { t, formatNumber, formatDate } = useTranslation();
  const auth = useAuth(); const draft = useSequenceDraft(); const navigate = useNavigate();
  const client = useMemo(() => { const url = readApiBaseUrl(); return url ? createLibraryApi(url) : null; }, []);
  const [query, setQuery] = useState(UNIPROT_DEFAULT_QUERY);
  const [sourceView, setSourceView] = useState<'catalog' | 'uniprot' | 'domains'>('catalog');
  const [items, setItems] = useState<EntrySummary[] | null>(null);
  const restored = isCurrentReference(draft.referenceView, draft.text, draft.source) ? draft.referenceView : null;
  const [entry, setEntry] = useState<UniProtEntry | null>(restored?.entry ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [truncated, setTruncated] = useState(false);
  // The bundled example opens with its measured structure already on screen.
  const [structure, setStructure] = useState<PdbReference | null>(() => restored ? restored.structures.find(item => item.id === restored.pdbId) ?? null : INSULIN_STRUCTURE);
  const [position, setPosition] = useState<number | null>(restored?.position ?? 90);
  const [chain, setChain] = useState<string | null>(restored?.chain ?? null);
  // A documented part or an assembly travels without a source: it is not a complete reference entry.
  const [pending, setPending] = useState<Loading | null>(null);
  const controller = useRef<AbortController | null>(null);
  const token = auth.status === 'signed-in' ? auth.session?.accessToken ?? '' : '';
  useEffect(() => () => { controller.current?.abort(); }, [token]);

  async function search(accession?: string): Promise<void> {
    if (!client || !token) return;
    controller.current?.abort();
    const operation = new AbortController(); controller.current = operation;
    setBusy(true); setError(null);
    if (accession) { setStructure(null); setEntry(null); setPosition(null); setChain(null); }
    try {
      if (accession) {
        const detail = await client.detail(accession, token, operation.signal);
        if (!operation.signal.aborted) setEntry(detail);
      } else {
        const result = await client.search(query.trim(), token, operation.signal);
        if (!operation.signal.aborted) { setItems(result.items); setTruncated(result.truncated); }
      }
    } catch (failure) { if (!operation.signal.aborted) setError(failure instanceof ApiError ? failure : new ApiError('unknown')); }
    finally { if (controller.current === operation) setBusy(false); }
  }
  function load(next: Loading): void {
    draft.setText(next.text); draft.setSource(next.source); draft.setReferenceView(next.view);
    void navigate(ROUTES.analyze, next.openProject ? { state: OPEN_PROJECT_STATE } : undefined);
  }
  function choose(source: SequenceSource, view: ReferenceView | null = null): void {
    if (view && draft.text === source.sequence && draft.source?.accession === source.accession && draft.source.sequenceVersion === source.sequenceVersion) {
      draft.setReferenceView(view); void navigate(ROUTES.analyze);
    } else if (draft.text) setPending({ text: source.sequence, source, view }); else load({ text: source.sequence, source, view });
  }
  function takeText(text: string, openProject: boolean): void {
    const next = { text, source: null, view: null, openProject };
    if (draft.text) setPending(next); else load(next);
  }
  const ERROR_KEYS: Partial<Record<ApiErrorCode, TranslationKey>> = { session: 'library.session', 'not-found': 'library.notFound', validation: 'library.invalidQuery', 'rate-limit': 'projects.rateLimit' };
  const references = entry?.structures ?? [INSULIN_STRUCTURE];
  const referenceSource = useMemo<SequenceSource>(() => entry
    ? { origin: 'uniprot', accession: entry.accession, sequence: entry.sequence, entryVersion: entry.entryVersion, sequenceVersion: entry.sequenceVersion, retrievedAt: entry.retrievedAt }
    : { origin: 'catalog', accession: INSULIN_ACCESSION, sequence: INSULIN_REFERENCE.sequence, entryVersion: null, sequenceVersion: INSULIN_REFERENCE.sequenceVersion, retrievedAt: null }, [entry]);
  // While the full viewer loads, or when it cannot, the example keeps its light drawing of the same coordinates.
  const exampleAnnotations = structure?.id === INSULIN_STRUCTURE.id ? annotationsForAccession(INSULIN_ACCESSION) : null;
  const sketch = exampleAnnotations ? <StructureStage variant="library" annotations={exampleAnnotations} /> : undefined;

  return (
    <main className="page library-page">
      <PageHeading titleKey="library.title" introduction="library.introduction">
        <Link className="button button-secondary" to={ROUTES.analyze}>{t('library.back')}</Link>
      </PageHeading>
      <ViewTabs id="library" label={t('workbench.libraryViews')} value={sourceView} onChange={setSourceView} options={[
        { value: 'catalog', label: t('library.catalogTitle') }, { value: 'uniprot', label: t('library.uniprotTitle') },
        { value: 'domains', label: t('domains.tab') },
      ]} />

      <section className="library-section" id="library-catalog-panel" role="tabpanel" aria-labelledby="library-catalog-tab" hidden={sourceView !== 'catalog'}>
        <h2 id="catalog-title">{t('library.catalogTitle')}</h2>
        <ul className="reference-listing">
          {REFERENCE_CATALOG.map((reference) => (
            <li key={reference.accession}>
              <div>
                <p className="field-meta">{reference.accession}</p>
                <h3>{t(reference.label)}</h3>
                <p className="field-help">{reference.organism} · {t('editor.residueCount', { count: formatNumber(reference.sequence.length) })}</p>
              </div>
              <div className="actions">
                <a className="inline-link" href={`${UNIPROT_URL}${reference.accession}`}>{t('library.source')}</a>
                <button
                  type="button" className="button button-secondary"
                  onClick={() => { choose({ origin: 'catalog', accession: reference.accession, sequence: reference.sequence, entryVersion: null, sequenceVersion: reference.sequenceVersion, retrievedAt: null }); }}
                >{t('library.load')}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Loading a reference replaces the sequence being analysed, so it is confirmed first. */}
      {pending && (
        <section className="project-confirm" aria-label={t('library.replaceTitle')}>
          <h2>{t('library.replaceTitle')}</h2>
          <p>{t('library.replaceHelp')}</p>
          <div className="actions">
            <button type="button" className="button button-secondary" onClick={() => { setPending(null); }}>{t('projects.cancel')}</button>
            <button type="button" className="button button-primary" onClick={() => { load(pending); }}>{t(pending.source ? 'library.confirmLoad' : 'domains.confirmLoad')}</button>
          </div>
        </section>
      )}

      <section className="library-section" id="library-uniprot-panel" role="tabpanel" aria-labelledby="library-uniprot-tab" hidden={sourceView !== 'uniprot'}>
        <h2 id="uniprot-title">{t('library.uniprotTitle')}</h2>
        <p className="field-help">{t('library.searchHelp')}</p>

        {!token ? (
          <div className="project-empty">
            <p>{t('library.signIn')}</p>
            <div className="actions">
              <Link className="button button-primary" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>
              <Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
            </div>
          </div>
        ) : !client ? <p className="notice">{t('library.config')}</p> : (
          <form className="library-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <div className="field">
              <label htmlFor="uniprot-query">{t('library.query')}</label>
              <input id="uniprot-query" className="text-input" value={query} onChange={(event) => { setQuery(event.target.value); }} minLength={2} maxLength={UNIPROT_QUERY_MAX_LENGTH} required />
            </div>
            <button type="submit" className="button button-primary" disabled={busy || query.trim().length < 2}>{t('library.search')}</button>
            {busy && <button type="button" className="button button-secondary" onClick={() => { controller.current?.abort(); setBusy(false); }}>{t('projects.cancel')}</button>}
          </form>
        )}

        <div role="status" aria-live="polite">
          {busy && <p className="status-message">{t('library.loading')}</p>}
          {error && <p className="status-message" data-state="error">{t(ERROR_KEYS[error.code] ?? 'library.error')}</p>}
        </div>

        {items && !busy && <>
          <p className="field-help">{t(items.length === 1 ? 'library.resultCountOne' : items.length ? 'library.resultCount' : 'library.noResults', { count: formatNumber(items.length) })}{truncated && ` ${t('library.truncated')}`}</p>
          <ul className="reference-listing">
            {items.map((record) => (
              <li key={record.accession}>
                <div>
                  <p className="field-meta">{record.accession} · {t(record.reviewed ? 'library.reviewed' : 'library.unreviewed')}</p>
                  <h3>{record.name}</h3>
                  <p className="field-help">{record.organism} · {t('editor.residueCount', { count: formatNumber(record.length) })}</p>
                </div>
                <button type="button" disabled={busy} className="button button-secondary" aria-label={t('library.openEntry', { id: record.accession })} onClick={() => { void search(record.accession); }}>
                  {t('library.detail')}
                </button>
              </li>
            ))}
          </ul>
        </>}

        {entry && (
          <article className="entry-detail">
            <header>
              <p className="field-meta">{entry.accession} · {t(entry.reviewed ? 'library.reviewed' : 'library.unreviewed')}</p>
              <h3>{entry.name}</h3>
              <p>{entry.organism}</p>
            </header>
            <p className="field-help">
              {t('library.provenance', { entry: formatNumber(entry.entryVersion), sequence: formatNumber(entry.sequenceVersion), date: formatDate(new Date(entry.retrievedAt), { dateStyle: 'medium' }) })}
            </p>
            {entry.function && (
              <div className="entry-annotation">
                <p className="field-help">{t('library.functionNote')}</p>
                <p>{entry.function}</p>
              </div>
            )}
            <div className="actions">
              <a className="inline-link" href={`${UNIPROT_URL}${entry.accession}`}>{t('library.source')}</a>
              <button
                type="button" className="button button-primary"
                onClick={() => { choose({ origin: 'uniprot', accession: entry.accession, sequence: entry.sequence, entryVersion: entry.entryVersion, sequenceVersion: entry.sequenceVersion, retrievedAt: entry.retrievedAt }); }}
              >{t('library.load')}</button>
            </div>
          </article>
        )}
      </section>

      <DomainsPanel hidden={sourceView !== 'domains'} signedIn={auth.status === 'signed-in'} onUse={takeText} />

      <section className="library-section" aria-labelledby="structure-title">
        <h2 id="structure-title">{t('workbench.libraryEntry')} · {entry?.name ?? t('examples.insulinName')}</h2>
        <p className="field-help">{t(entry ? 'library.structureHelp' : 'library.structureExample')}</p>

        <MappedStructure reference={referenceSource} structures={references} pdbId={structure?.id ?? ''} position={position} chain={chain}
          onStructure={id => { setStructure(references.find(item => item.id === id) ?? null); setPosition(null); setChain(null); }}
          onSelect={(next, nextChain) => { setPosition(next); setChain(nextChain); }} placeholder={sketch} mappingLoader={mappingLoader}
          onOpenAnalysis={() => { choose(referenceSource, { source: referenceSource, entry, structures: references, pdbId: structure?.id ?? '', position, chain }); }} />
      </section>
    </main>
  );
}

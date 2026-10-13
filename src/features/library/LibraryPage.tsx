import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { PageHeading } from '../../shared/PageHeading';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import { ApiError } from '../api/apiClient';
import { useSequenceDraft } from '../editor/sequenceDraft';
import type { SequenceSource } from '../editor/source';
import { REFERENCE_CATALOG } from './catalog';
import { annotatedCoverage, createLibraryApi } from './libraryApi';
import type { EntrySummary, PdbReference, UniProtEntry } from './libraryApi';
import { PDB_URL, UNIPROT_DEFAULT_QUERY, UNIPROT_QUERY_MAX_LENGTH, UNIPROT_URL } from './config';
import { annotationsForAccession } from '../editor/annotations';
import { StructureStage } from '../structure/StructureStage';

const StructureViewer = lazy(() => import('./StructureViewer'));
const INSULIN_ACCESSION = 'P01308';
const INSULIN_STRUCTURE: PdbReference = { id: '1TRZ', method: 'X-ray', resolution: '1.60 Å', chains: 'A/C=90-110, B/D=25-54' };

export function LibraryPage(): React.JSX.Element {
  const { t, formatNumber, formatDate } = useTranslation();
  const auth = useAuth(); const draft = useSequenceDraft(); const navigate = useNavigate();
  const client = useMemo(() => { const url = readApiBaseUrl(); return url ? createLibraryApi(url) : null; }, []);
  const [query, setQuery] = useState(UNIPROT_DEFAULT_QUERY);
  const [items, setItems] = useState<EntrySummary[] | null>(null);
  const [entry, setEntry] = useState<UniProtEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [truncated, setTruncated] = useState(false);
  // The bundled example opens with its measured structure already on screen.
  const [structure, setStructure] = useState<PdbReference | null>(INSULIN_STRUCTURE);
  const [pending, setPending] = useState<SequenceSource | null>(null);
  const controller = useRef<AbortController | null>(null);
  const token = auth.status === 'signed-in' ? auth.session?.accessToken ?? '' : '';
  useEffect(() => () => { controller.current?.abort(); }, [token]);

  async function search(accession?: string): Promise<void> {
    if (!client || !token) return;
    controller.current?.abort();
    const operation = new AbortController(); controller.current = operation;
    setBusy(true); setError(null); setStructure(accession ? null : structure); setEntry(null);
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
  function load(source: SequenceSource): void {
    draft.setText(source.sequence); draft.setSource(source); void navigate(ROUTES.analyze);
  }
  function choose(source: SequenceSource): void { if (draft.text) setPending(source); else load(source); }
  const references = entry?.structures ?? [INSULIN_STRUCTURE];
  const structureLength = entry?.length ?? REFERENCE_CATALOG[0]?.sequence.length ?? 0;
  const coverage = structure ? annotatedCoverage(structure.chains, structureLength) : null;
  // While the full viewer loads, or when it cannot, the example keeps its light drawing of the same coordinates.
  const exampleAnnotations = structure?.id === INSULIN_STRUCTURE.id ? annotationsForAccession(INSULIN_ACCESSION) : null;
  const sketch = exampleAnnotations ? <StructureStage variant="library" annotations={exampleAnnotations} /> : undefined;

  return <main className="page library-page">
    <PageHeading titleKey="library.title" introduction="library.introduction"><Link className="button button-secondary" to={ROUTES.analyze}>{t('library.back')}</Link></PageHeading>
    <section className="library-section" aria-labelledby="catalog-title"><h2 id="catalog-title">{t('library.catalogTitle')}</h2>
      <ul className="reference-listing">{REFERENCE_CATALOG.map((reference) => <li key={reference.accession}><div><p className="field-meta">{reference.accession}</p><h3>{t(reference.label)}</h3><p className="field-help">{reference.organism} · {t('editor.residueCount', { count: formatNumber(reference.sequence.length) })}</p></div><div className="actions"><a className="inline-link" href={`${UNIPROT_URL}${reference.accession}`}>{t('library.source')}</a><button type="button" className="button button-secondary" onClick={() => { choose({ origin: 'catalog', accession: reference.accession, sequence: reference.sequence, entryVersion: null, sequenceVersion: reference.sequenceVersion, retrievedAt: null }); }}>{t('library.load')}</button></div></li>)}</ul>
    </section>
    {pending && <section className="project-confirm" aria-label={t('library.replaceTitle')}><h2>{t('library.replaceTitle')}</h2><p>{t('library.replaceHelp')}</p><div className="actions"><button type="button" className="button button-secondary" onClick={() => { setPending(null); }}>{t('projects.cancel')}</button><button type="button" className="button button-primary" onClick={() => { load(pending); }}>{t('library.confirmLoad')}</button></div></section>}
    <section className="library-section" aria-labelledby="uniprot-title"><h2 id="uniprot-title">{t('library.uniprotTitle')}</h2><p className="field-help">{t('library.searchHelp')}</p>
      {!token ? <div className="project-empty"><p>{t('library.signIn')}</p><div className="actions"><Link className="button button-primary" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link><Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link></div></div> : !client ? <p className="notice">{t('library.config')}</p> : <form className="library-search" onSubmit={(event) => { event.preventDefault(); void search(); }}><div className="field"><label htmlFor="uniprot-query">{t('library.query')}</label><input id="uniprot-query" className="text-input" value={query} onChange={(event) => { setQuery(event.target.value); }} minLength={2} maxLength={UNIPROT_QUERY_MAX_LENGTH} required /></div><button type="submit" className="button button-primary" disabled={busy || query.trim().length < 2}>{t('library.search')}</button>{busy && <button type="button" className="button button-secondary" onClick={() => { controller.current?.abort(); setBusy(false); }}>{t('projects.cancel')}</button>}</form>}
      <div role="status" aria-live="polite">{busy && <p className="status-message">{t('library.loading')}</p>}{error && <p className="status-message" data-state="error">{t(error.code === 'session' ? 'library.session' : error.code === 'not-found' ? 'library.notFound' : error.code === 'validation' ? 'library.invalidQuery' : 'library.error')}</p>}</div>
      {items && !busy && <><p className="field-help">{t(items.length ? 'library.resultCount' : 'library.noResults', { count: formatNumber(items.length) })}{truncated && ` ${t('library.truncated')}`}</p><ul className="reference-listing">{items.map((record) => <li key={record.accession}><div><p className="field-meta">{record.accession} · {t(record.reviewed ? 'library.reviewed' : 'library.unreviewed')}</p><h3>{record.name}</h3><p className="field-help">{record.organism} · {t('editor.residueCount', { count: formatNumber(record.length) })}</p></div><button type="button" disabled={busy} className="button button-secondary" aria-label={t('library.openEntry', { id: record.accession })} onClick={() => { void search(record.accession); }}>{t('library.detail')}</button></li>)}</ul></>}
      {entry && <article className="entry-detail"><header><p className="field-meta">{entry.accession} · {t(entry.reviewed ? 'library.reviewed' : 'library.unreviewed')}</p><h3>{entry.name}</h3><p>{entry.organism}</p></header><p className="field-help">{t('library.provenance', { entry: formatNumber(entry.entryVersion), sequence: formatNumber(entry.sequenceVersion), date: formatDate(new Date(entry.retrievedAt), { dateStyle: 'medium' }) })}</p>{entry.function && <div className="entry-annotation"><p className="field-help">{t('library.functionNote')}</p><p>{entry.function}</p></div>}<div className="actions"><a className="inline-link" href={`${UNIPROT_URL}${entry.accession}`}>{t('library.source')}</a><button type="button" className="button button-primary" onClick={() => { choose({ origin: 'uniprot', accession: entry.accession, sequence: entry.sequence, entryVersion: entry.entryVersion, sequenceVersion: entry.sequenceVersion, retrievedAt: entry.retrievedAt }); }}>{t('library.load')}</button></div></article>}
    </section>
    <section className="library-section" aria-labelledby="structure-title"><h2 id="structure-title">{t('library.structureTitle')}</h2><p className="field-help">{t(entry ? 'library.structureHelp' : 'library.structureExample')}</p>
      {references.length ? <div className="field"><label htmlFor="structure-entry">{t('library.structureChoose')}</label><select className="text-input" id="structure-entry" value={structure?.id ?? ''} onChange={(event) => { setStructure(references.find((reference) => reference.id === event.target.value) ?? null); }}><option value="">{t('library.structurePlaceholder')}</option>{references.map((reference) => <option key={reference.id} value={reference.id}>{reference.id} · {reference.method}{reference.resolution ? ` · ${reference.resolution}` : ''}</option>)}</select></div> : <p className="notice">{t('library.noStructures')}</p>}
      {structure && <><div className="structure-provenance"><span>{t('library.experimental')}</span><a className="inline-link" href={`${PDB_URL}${structure.id}`}>{structure.id} · {t('library.pdbSource')}</a><p>{structure.method}{structure.resolution ? ` · ${structure.resolution}` : ''}</p>{coverage !== null && <p>{t('library.coverage', { count: formatNumber(coverage), total: formatNumber(structureLength) })}</p>}{structure.chains && <code>{structure.chains}</code>}<p className="field-help">{t('library.mappingScope')}</p></div><Suspense fallback={sketch}><StructureViewer key={structure.id} pdbId={structure.id} placeholder={sketch} /></Suspense></>}
    </section>
  </main>;
}

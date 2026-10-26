import { lazy, Suspense, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { readApiBaseUrl } from '../api/config';
import type { SequenceSource } from '../editor/source';
import { annotatedCoverage, createLibraryApi } from './libraryApi';
import type { PdbReference } from './libraryApi';
import { PDB_URL } from './config';
import type { MappingLoader } from './mappingTypes';
import type { CoordinateResidue } from './residueMapping';
import type { ReferenceBindingSelection } from './referenceBinding';
import { useResidueMapping } from './useResidueMapping';
import './mappedStructure.css';

const StructureViewer = lazy(() => import('./StructureViewer'));
interface Props {
  reference: SequenceSource;
  structures: readonly PdbReference[];
  pdbId: string;
  position: number | null;
  chain: string | null;
  onStructure: (pdbId: string) => void;
  onSelect: (position: number | null, chain: string | null) => void;
  compact?: boolean;
  placeholder?: ReactNode;
  onOpenAnalysis?: () => void;
  /** An explicit null disables acquisition, useful for offline hosts and tests. */
  mappingLoader?: MappingLoader | null;
}

/** A versioned public reference, its existing reader and independently controlled measured model. */
export function MappedStructure({ reference, structures, pdbId, position, chain, onStructure, onSelect, compact = false, placeholder, onOpenAnalysis, mappingLoader }: Props): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const id = useId(); const auth = useAuth();
  const client = useMemo(() => { const url = readApiBaseUrl(); return url ? createLibraryApi(url) : null; }, []);
  const load = mappingLoader === undefined ? client?.mapping ?? null : mappingLoader;
  const token = auth.status === 'signed-in' ? auth.session?.accessToken ?? '' : '';
  // An unselected PDB does not spend a reference lookup.
  const mapping = useResidueMapping({ reference, pdbId, token: pdbId ? token : '', load });
  const [picked, setPicked] = useState<{ binding: typeof mapping.binding; result: ReferenceBindingSelection } | null>(null);
  const structure = structures.find(item => item.id === pdbId);
  const coverage = structure ? annotatedCoverage(structure.chains, reference.sequence.length) : null;
  const result = mapping.ready ? position !== null ? mapping.binding.fromSequence(position, chain ?? undefined)
    : picked?.binding === mapping.binding ? picked.result : null : null;
  const match = result?.status === 'mapped' ? result.candidates[0] : undefined;
  const selected = match && mapping.modelNum !== undefined ? { ...match.address, modelNum: mapping.modelNum } : null;
  const addresses = result?.candidates.map(candidate => t('mapping.address', {
    chain: candidate.address.labelAsymId, authorChain: candidate.address.authAsymId,
    author: candidate.address.authSeqId === null ? t('mapping.authorMissing') : candidate.address.authSeqId + candidate.address.insertionCode,
    internal: formatNumber(candidate.address.labelSeqId),
  })).join('; ') ?? '';
  const stateKey: TranslationKey = !mapping.ready || mapping.reason !== 'ready' ? `mapping.${mapping.reason}`
    : result === null ? 'mapping.noSelection'
      : result.status === 'sequence-mismatch' || result.status === 'unverified' ? 'mapping.stale' : `mapping.${result.status}`;
  const changeSelection = (next: number | null, nextChain: string | null): void => { setPicked(null); onSelect(next, nextChain); };
  const pick = (id: string, residue: CoordinateResidue | null): void => {
    if (id !== pdbId || !mapping.ready || mapping.binding.status !== 'ready') return;
    const next = residue ? mapping.binding.fromStructure(residue) : null;
    if (next?.status === 'mapped' && next.candidates[0]) {
      setPicked(null); onSelect(next.candidates[0].position, next.candidates[0].address.labelAsymId);
    } else {
      setPicked(next ? { binding: mapping.binding, result: next } : null); onSelect(null, chain);
    }
  };
  const retryable = ['error', 'timeout', 'unavailable', 'size', 'limit', 'missing', 'stale'].includes(mapping.reason);

  return <div className={`mapped-reference${compact ? ' mapped-reference-compact' : ''}`}>
    <div className="mapped-model">
      {structures.length ? <div className="field">
        <label htmlFor={`${id}-structure`}>{t('library.structureChoose')}</label>
        <select id={`${id}-structure`} className="text-input" value={pdbId} onChange={event => { setPicked(null); onStructure(event.target.value); }}>
          <option value="">{t('library.structurePlaceholder')}</option>
          {structures.map(item => <option key={item.id} value={item.id}>{item.id} · {item.method}{item.resolution ? ` · ${item.resolution}` : ''}</option>)}
        </select>
      </div> : <p className="notice">{t('library.noStructures')}</p>}
      {structure && <>
        <div className="structure-provenance">
          <span>{t('library.experimental')}</span>
          <a className="inline-link" href={`${PDB_URL}${pdbId}`}>{pdbId} · {t('library.pdbSource')}</a>
          <p>{structure.method}{structure.resolution ? ` · ${structure.resolution}` : ''}</p>
          {coverage !== null && <p>{t('library.coverage', { count: formatNumber(coverage), total: formatNumber(reference.sequence.length) })}</p>}
          {structure.chains && <code>{structure.chains}</code>}
          <p className="field-help">{t('library.mappingScope')}</p>
        </div>
        {!compact && <div className="field">
          <label htmlFor={`${id}-position`}>{t('mapping.position')}</label>
          <input id={`${id}-position`} className="text-input" type="number" min={1} max={reference.sequence.length} step={1} value={position ?? ''} onChange={event => {
            const next = event.target.valueAsNumber;
            changeSelection(Number.isSafeInteger(next) && next >= 1 && next <= reference.sequence.length ? next : null, chain);
          }} />
        </div>}
        <div className="field">
          <label htmlFor={`${id}-chain`}>{t('mapping.chain')}</label>
          <select id={`${id}-chain`} className="text-input" value={mapping.ready && mapping.binding.chains.some(item => item.labelAsymId === chain) ? chain ?? '' : ''} disabled={!mapping.ready || !mapping.binding.chains.length} aria-describedby={`${id}-status`} onChange={event => { changeSelection(position, event.target.value || null); }}>
            <option value="">{t('mapping.chooseChain')}</option>
            {mapping.binding.chains.map(item => <option key={item.labelAsymId} value={item.labelAsymId}>{t('mapping.chainOption', { chain: item.labelAsymId, author: item.authAsymId })}</option>)}
          </select>
        </div>
        <p className="field-meta mapped-position">{position !== null ? `${reference.accession}:${formatNumber(position)} · ${reference.sequence[position - 1] ?? ''}` : t('mapping.noSelection')}</p>
        <p id={`${id}-status`} className="status-message mapping-status" role="status" aria-live="polite" data-mapping-state={stateKey.slice('mapping.'.length)}>{t(stateKey, { addresses, pdb: pdbId })}</p>
        {mapping.reason === 'session' && <Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>}
        {retryable && <button type="button" className="button button-secondary" onClick={mapping.retry}>{t('mapping.retry')}</button>}
        {onOpenAnalysis && <div className="actions"><button type="button" className="button button-secondary" onClick={onOpenAnalysis}>{t('mapping.openAnalysis')}</button></div>}
        <Suspense fallback={placeholder ?? <p className="status-message">{t('library.viewerLoading')}</p>}>
          <StructureViewer key={pdbId} pdbId={pdbId} placeholder={placeholder} residueSelection={{ pdbId, selected, onSelect: pick, onReady: mapping.onReady, onUnavailable: mapping.onUnavailable }} />
        </Suspense>
        <p className="field-help">{t('mapping.scope')}</p>
        {compact && <Link className="button button-quiet" to={ROUTES.library}>{t('structure.openViewer')}</Link>}
      </>}
    </div>
  </div>;
}

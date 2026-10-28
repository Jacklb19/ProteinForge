import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import { assemble, assemblyFasta, filterDomains, movePart, removePart, togglePart } from './assembly';
import { loadDomainCatalog } from './catalog';
import type { DomainCatalog, DomainEntry } from './catalog';
import { DOMAINS_CONFIG, DOMAIN_KIND_LABELS, DOMAIN_SOURCE_LABELS } from './config';
import { downloadAssembly } from './download';

interface Props {
  /** The tab is closed: the panel stays mounted, so filters and the assembly survive a change of view. */
  hidden: boolean;
  signedIn: boolean;
  /** Hands a sequence to Analyze without a source, as if it were pasted; `openProject` shows project saving there. */
  onUse: (text: string, openProject: boolean) => void;
}

/** Documented parts from public sources and the order the visitor joins them in. Nothing here is stored. */
export function DomainsPanel({ hidden, signedIn, onUse }: Props): React.JSX.Element {
  const { t, locale, formatNumber } = useTranslation();
  const [catalog, setCatalog] = useState<DomainCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (hidden || catalog || failed) return;
    let current = true;
    void loadDomainCatalog().then((value) => { if (current) setCatalog(value); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [hidden, catalog, failed]);

  const kindLabel = useCallback((code: string): string => { const key = DOMAIN_KIND_LABELS[code]; return key ? t(key) : code.toUpperCase(); }, [t]);
  const sourceLabel = (name: string): string => { const key = DOMAIN_SOURCE_LABELS[name]; return key ? t(key) : name; };
  const partName = (domain: DomainEntry): string =>
    t('domains.stretch', { kind: kindLabel(domain.kind), start: String(domain.feature.start), end: String(domain.feature.end) });

  const domains = useMemo(() => catalog?.domains ?? [], [catalog]);
  const kinds = useMemo(() => [...new Set(domains.map((domain) => domain.kind))]
    .map((code) => ({ code, label: kindLabel(code) }))
    .sort((first, second) => first.label.localeCompare(second.label, locale)), [domains, kindLabel, locale]);
  const shown = useMemo(() => filterDomains(domains, { kind, query }), [domains, kind, query]);
  const assembly = useMemo(() => assemble(domains, picked), [domains, picked]);
  const count = assembly.parts.length;

  return (
    <section className="library-section" id="library-domains-panel" role="tabpanel" aria-labelledby="library-domains-tab" hidden={hidden}>
      <h2 id="domains-title">{t('domains.title')}</h2>
      <p className="field-help">{t('domains.help')}</p>
      <p className="domain-caution">{t('domains.caution')}</p>

      <div role="status" aria-live="polite">
        {!catalog && !failed && <p className="status-message">{t('domains.loading')}</p>}
        {failed && <p className="status-message" data-state="error">{t('domains.loadError')}</p>}
      </div>

      {catalog && (
        <div className="domain-layout">
          <div>
            <form className="domain-filters" aria-label={t('domains.filters')} onSubmit={(event) => { event.preventDefault(); }}>
              <div className="field">
                <label htmlFor="domain-kind">{t('domains.kind')}</label>
                <select id="domain-kind" className="text-input" value={kind} onChange={(event) => { setKind(event.target.value); }}>
                  <option value="">{t('domains.allKinds')}</option>
                  {kinds.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="domain-query">{t('domains.query')}</label>
                <input id="domain-query" className="text-input" type="search" value={query} maxLength={DOMAINS_CONFIG.queryMaxLength}
                  onChange={(event) => { setQuery(event.target.value); }} />
              </div>
            </form>
            <p className="field-help" role="status" aria-live="polite">
              {t('domains.count', { shown: formatNumber(shown.length), total: formatNumber(domains.length) })}
            </p>
            {shown.length === 0 && (
              <div className="project-empty">
                <p>{t('domains.noResults')}</p>
                <button type="button" className="button button-secondary" onClick={() => { setKind(''); setQuery(''); }}>{t('domains.clearFilters')}</button>
              </div>
            )}

            <ul className="domain-cards" aria-labelledby="domains-title">
              {shown.map((domain) => {
                const chosen = picked.includes(domain.id);
                const title = `domain-${domain.id}-title`;
                const structure = domain.structure;
                return (
                  <li key={domain.id} className="domain-card" data-picked={chosen}>
                    <p className="field-meta">{t('domains.entry', { accession: domain.accession, entryName: domain.entryName, version: formatNumber(domain.entryVersion) })}</p>
                    <h3 id={title}>{partName(domain)}</h3>
                    <p className="field-help">{domain.protein} · {domain.organism} · {t('editor.residueCount', { count: formatNumber(domain.sequence.length) })}</p>
                    <p className="field-help">{domain.summary[locale]}</p>
                    <ul className="domain-facts">
                      {domain.family && <li>{t('domains.family', { database: domain.family.database, accession: domain.family.accession, name: domain.family.name })}</li>}
                      <li>{!structure ? t('domains.noStructure')
                        : structure.resolutionAngstrom === null ? t('domains.structureNoResolution', { pdb: structure.pdb, method: structure.method })
                          : t('domains.structure', { pdb: structure.pdb, method: structure.method, resolution: formatNumber(structure.resolutionAngstrom) })}</li>
                      {domain.sources.map((source) => <li key={source.name}>{t('domains.source', { source: sourceLabel(source.name), licence: source.licence })}</li>)}
                    </ul>
                    <p className="domain-sequence">{domain.sequence}</p>
                    {chosen && <p className="field-meta">{t('domains.inAssembly')}</p>}
                    <div className="domain-actions">
                      <button type="button" className={`button ${chosen ? 'button-secondary' : 'button-primary'}`} aria-pressed={chosen} aria-describedby={title}
                        onClick={() => { setPicked((current) => togglePart(current, domain.id)); }}>{t('domains.add')}</button>
                      <button type="button" className="button button-secondary" aria-describedby={title}
                        onClick={() => { onUse(domain.sequence, false); }}>{t('domains.analyzePart')}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="domain-tray" aria-labelledby="domain-tray-title">
            <h3 id="domain-tray-title">{t('domains.trayTitle')}</h3>
            <p className="field-help" role="status" aria-live="polite">
              {count ? t(count === 1 ? 'domains.trayTotalOne' : 'domains.trayTotal', { count: formatNumber(count), residues: formatNumber(assembly.length) }) : t('domains.trayEmpty')}
            </p>
            {count > 0 && (
              <ol>
                {assembly.parts.map((part, index) => {
                  const name = `${partName(part)} · ${part.accession}`;
                  return (
                    <li key={part.id} className="domain-tray-part">
                      <span>{name}</span>
                      <span className="field-meta">{t('editor.residueCount', { count: formatNumber(part.sequence.length) })}</span>
                      <span className="domain-tray-moves">
                        <button type="button" className="button button-quiet" disabled={index === 0} aria-label={t('domains.moveUpLabel', { name })}
                          onClick={() => { setPicked((current) => movePart(current, part.id, -1)); }}>{t('domains.moveUp')}</button>
                        <button type="button" className="button button-quiet" disabled={index === count - 1} aria-label={t('domains.moveDownLabel', { name })}
                          onClick={() => { setPicked((current) => movePart(current, part.id, 1)); }}>{t('domains.moveDown')}</button>
                        <button type="button" className="button button-quiet" aria-label={t('domains.removeLabel', { name })}
                          onClick={() => { setPicked((current) => removePart(current, part.id)); }}>{t('domains.remove')}</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {count > 0 && (
              <div className="domain-joined">
                <p className="field-meta">{t('domains.joined')}</p>
                <div className="domain-bounds" aria-hidden="true">
                  {assembly.bounds.map((bound) => <span key={bound.id} style={{ flexGrow: bound.end - bound.start + 1 }} />)}
                </div>
                <p className="domain-sequence">{assembly.sequence}</p>
              </div>
            )}
            <p className="domain-caution">{t('domains.trayNote')}</p>
            <div className="domain-actions">
              <button type="button" className="button button-primary" disabled={!count} onClick={() => { onUse(assembly.sequence, false); }}>{t('domains.analyzeAssembly')}</button>
              <button type="button" className="button button-secondary" disabled={!count} onClick={() => { downloadAssembly(assemblyFasta(assembly)); }}>{t('domains.download')}</button>
              <button type="button" className="button button-secondary" disabled={!count || !signedIn} aria-describedby="domain-save-help"
                onClick={() => { onUse(assembly.sequence, true); }}>{t('domains.save')}</button>
            </div>
            <p className="field-help" id="domain-save-help">{t(signedIn ? 'domains.saveHelp' : 'domains.saveNeedsSession')}</p>
          </aside>
        </div>
      )}
    </section>
  );
}

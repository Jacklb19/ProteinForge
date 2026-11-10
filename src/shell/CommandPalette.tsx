import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { ProjectContext } from '../features/projects/projectContext';
import { PALETTE_DESTINATIONS, PALETTE_ID, paletteEntries } from './paletteEntries';
import type { PaletteEntry } from './paletteEntries';

/**
 * A dialog to reach any tool or saved project by typing part of its name. A project is shown in Projects,
 * filtered by its name: opening it there keeps the confirmation that protects unsaved work.
 */
export function CommandPalette({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useContext(ProjectContext);
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const destinations = useMemo(() => PALETTE_DESTINATIONS.map(item => ({ path: item.path, label: t(item.labelKey) })), [t]);
  const entries = paletteEntries(query, destinations, projects?.items ?? []);
  const current = Math.min(active, Math.max(entries.length - 1, 0));
  const choose = (entry: PaletteEntry | undefined): void => {
    if (!entry) return;
    onClose();
    if (entry.kind === 'project' && projects) void projects.refresh(false, { query: entry.label, order: projects.listing.order });
    void navigate(entry.path);
  };
  const option = (entry: PaletteEntry, index: number): React.JSX.Element => (
    <li key={entry.id} id={`${PALETTE_ID}-${entry.id}`} role="option" aria-selected={index === current} className="palette-option"
      onPointerMove={() => { setActive(index); }} onClick={() => { choose(entry); }}>{entry.label}</li>
  );
  const firstProject = entries.findIndex(entry => entry.kind === 'project');
  const tools = firstProject === -1 ? entries : entries.slice(0, firstProject);
  const stored = firstProject === -1 ? [] : entries.slice(firstProject);
  return (
    <dialog ref={dialog} className="project-dialog command-palette" aria-label={t('palette.label')}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="palette-body">
        <input
          autoFocus className="text-input" type="text" role="combobox" aria-label={t('palette.label')} placeholder={t('palette.placeholder')}
          aria-expanded="true" aria-controls={`${PALETTE_ID}-list`} aria-autocomplete="list"
          aria-activedescendant={entries[current] ? `${PALETTE_ID}-${entries[current].id}` : undefined}
          value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive(entries.length ? (current + 1) % entries.length : 0); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(entries.length ? (current - 1 + entries.length) % entries.length : 0); }
            else if (event.key === 'Enter') { event.preventDefault(); choose(entries[current]); }
          }}
        />
        <div id={`${PALETTE_ID}-list`} role="listbox" aria-label={t('palette.label')} className="palette-list">
          {tools.length > 0 && <ul role="group" aria-label={t('palette.tools')}>
            <li role="presentation" className="palette-group">{t('palette.tools')}</li>
            {tools.map((entry, index) => option(entry, index))}
          </ul>}
          {stored.length > 0 && <ul role="group" aria-label={t('nav.projects')}>
            <li role="presentation" className="palette-group">{t('nav.projects')}</li>
            {stored.map((entry, index) => option(entry, tools.length + index))}
          </ul>}
        </div>
        <p className="status-message" role="status">{entries.length === 0 ? t('palette.empty', { query: query.trim() }) : ''}</p>
        <p className="field-help">{t('palette.hint')}</p>
      </div>
    </dialog>
  );
}

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { BrandMark } from '../shared/BrandMark';
import { Icon } from '../shared/Icon';
import { RouteBoundary } from '../shared/RouteBoundary';
import { FOOTER_LINKS, ROUTES, SIDEBAR_STORAGE_KEY } from '../shared/navigation';
import { MENU_ID } from './PublicFrame';
import { Sheet } from './Sheet';
import { SidebarContent } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { PALETTE_KEY } from './paletteEntries';
import { useSyncShortLabel } from '../features/projects/syncSummary';

/** The width choice is a visual preference; storage may be unavailable, and then it lasts for the visit. */
function readCompact(): boolean {
  try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'; } catch { return false; }
}
function writeCompact(value: boolean): void {
  try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value)); } catch { /* The choice still applies to this visit. */ }
}

/** Compact names sit outside the scrolling rail, level with the entry under the pointer or the focus. */
function placeTooltip(event: React.SyntheticEvent): void {
  const link = (event.target as Element).closest<HTMLElement>('.sidebar-link');
  if (!link) return;
  const box = link.getBoundingClientRect();
  link.style.setProperty('--tooltip-y', `${String(box.top + box.height / 2)}px`);
}

/** Laboratory frame: grouped sidebar on wide screens, a menu panel on phones, and the tool itself. */
export function WorkspaceFrame(): React.JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [compact, setCompact] = useState(readCompact);
  const [menuOpen, setMenuOpen] = useState(false);
  const syncLabel = useSyncShortLabel();
  const toggle = useRef<HTMLButtonElement>(null);
  // Focus returns to the menu button once the dialog has closed; while it is open the page behind is inert.
  const returnFocus = useRef(false);
  const closeMenu = useCallback((): void => { returnFocus.current = true; setMenuOpen(false); }, []);
  useEffect(() => {
    if (menuOpen || !returnFocus.current) return;
    returnFocus.current = false;
    toggle.current?.focus();
  }, [menuOpen]);
  useEffect(() => { writeCompact(compact); }, [compact]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== PALETTE_KEY) return;
      event.preventDefault();
      setMenuOpen(false);
      setPaletteOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div className="workspace" data-compact={compact}>
      <a className="skip-link" href="#app-content">{t('shell.skip')}</a>
      <aside className="workspace-sidebar" aria-label={t('shell.sidebar')} onPointerOver={placeTooltip} onFocus={placeTooltip}>
        <SidebarContent variant="rail" compact={compact} onToggle={() => { setCompact(value => !value); }} onPalette={() => { setPaletteOpen(true); }} />
      </aside>
      <div className="workspace-body">
        <header className="workspace-bar">
          <Link to={ROUTES.home} className="brand" aria-label={t('shell.home')}><BrandMark /><span>{t('app.name')}</span></Link>
          {/* The short form only; the sidebar foot in the menu says the rest and is the one announced. */}
          {syncLabel && <p className="bar-status">{syncLabel}</p>}
          <button ref={toggle} className="button button-icon" type="button" aria-label={t('shell.openMenu')}
            aria-expanded={menuOpen} aria-controls={MENU_ID} onClick={() => { setMenuOpen(true); }}>
            <Icon name="menu" />
          </button>
        </header>
        {menuOpen && <Sheet id={MENU_ID} label={t('shell.menu')} className="workspace-sheet" onClose={closeMenu}>
          <SidebarContent variant="sheet" onClose={closeMenu} onPalette={() => { setMenuOpen(false); setPaletteOpen(true); }} />
        </Sheet>}
        {paletteOpen && <CommandPalette onClose={() => { setPaletteOpen(false); }} />}
        <div className="app-content" id="app-content" tabIndex={-1}>
          <RouteBoundary key={pathname}>
            <Suspense fallback={<main className="page"><p role="status">{t('shell.loadingPage')}</p></main>}><Outlet /></Suspense>
          </RouteBoundary>
        </div>
        <footer className="workspace-footer">
          <nav aria-label={t('footer.navigation')}>
            <ul className="footer-links">
              {FOOTER_LINKS.map((link) => <li key={link.path}><Link to={link.path}>{t(link.labelKey)}</Link></li>)}
            </ul>
          </nav>
        </footer>
      </div>
    </div>
  );
}

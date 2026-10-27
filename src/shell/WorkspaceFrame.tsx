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

  return (
    <div className="workspace" data-compact={compact}>
      <a className="skip-link" href="#app-content">{t('shell.skip')}</a>
      <aside className="workspace-sidebar" aria-label={t('shell.sidebar')} onPointerOver={placeTooltip} onFocus={placeTooltip}>
        <SidebarContent variant="rail" compact={compact} onToggle={() => { setCompact(value => !value); }} />
      </aside>
      <div className="workspace-body">
        <header className="workspace-bar">
          <Link to={ROUTES.home} className="brand" aria-label={t('shell.home')}><BrandMark /><span>{t('app.name')}</span></Link>
          <button ref={toggle} className="button button-icon" type="button" aria-label={t('shell.openMenu')}
            aria-expanded={menuOpen} aria-controls={MENU_ID} onClick={() => { setMenuOpen(true); }}>
            <Icon name="menu" />
          </button>
        </header>
        {menuOpen && <Sheet id={MENU_ID} label={t('shell.menu')} className="workspace-sheet" onClose={closeMenu}>
          <SidebarContent variant="sheet" onClose={closeMenu} />
        </Sheet>}
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

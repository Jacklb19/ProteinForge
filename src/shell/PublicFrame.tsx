import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useAuth } from '../features/auth/authContext';
import { BrandMark } from '../shared/BrandMark';
import { Icon } from '../shared/Icon';
import { RouteBoundary } from '../shared/RouteBoundary';
import { AFTER_SIGN_IN_ROUTE, BAR_VEIL_SCROLL_PX, FOOTER_LINKS, PUBLIC_SECTIONS, ROUTES } from '../shared/navigation';
import { PreferencesFields, PreferencesMenu } from './Preferences';
import { Sheet } from './Sheet';

export const MENU_ID = 'site-menu';

/** Entry points that depend on the session: the laboratory when signed in, otherwise sign in and sign up. */
function SessionActions({ wide, onNavigate }: { wide: boolean; onNavigate?: () => void }): React.JSX.Element | null {
  const { t } = useTranslation();
  const { status } = useAuth();
  const size = wide ? 'button-large button-wide' : '';
  if (status === 'loading') return null;
  if (status === 'signed-in') return <Link className={`button button-primary ${size}`} to={AFTER_SIGN_IN_ROUTE} onClick={onNavigate}>{t('public.openLaboratory')}</Link>;
  return <>
    <Link className={`button button-secondary ${size}`} to={ROUTES.signIn} onClick={onNavigate}>{t('shell.signIn')}</Link>
    {status !== 'disabled' && <Link className={`button button-primary ${size}`} to={ROUTES.signUp} onClick={onNavigate}>{t('auth.signUpAction')}</Link>}
  </>;
}

function SectionLinks({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  return <>{PUBLIC_SECTIONS.map(section => <Link key={section.id} to={`${ROUTES.home}#${section.id}`} onClick={onNavigate}>{t(section.labelKey)}</Link>)}</>;
}

/** Presentation, access and legal pages: a top bar without the laboratory sidebar. */
export function PublicFrame(): React.JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = (): void => { setScrolled(window.scrollY > BAR_VEIL_SCROLL_PX); };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => { window.removeEventListener('scroll', update); };
  }, []);
  const closeMenu = useCallback((): void => { setMenuOpen(false); toggle.current?.focus(); }, []);

  return (
    <div className="app public-frame">
      <a className="skip-link" href="#app-content">{t('shell.skip')}</a>
      <header className="site-bar" data-scrolled={scrolled}>
        <div className="site-bar-inner">
          <Link to={ROUTES.home} className="brand" aria-label={t('shell.home')}><BrandMark /><span>{t('app.name')}</span></Link>
          <nav className="site-nav" aria-label={t('public.sections')}><SectionLinks /></nav>
          <div className="site-bar-end">
            <div className="only-wide"><PreferencesMenu placement="below" /></div>
            <div className="site-bar-session"><SessionActions wide={false} /></div>
            <button ref={toggle} className="button button-icon only-narrow" type="button" aria-label={t('shell.openMenu')}
              aria-expanded={menuOpen} aria-controls={MENU_ID} onClick={() => { setMenuOpen(true); }}>
              <Icon name="menu" />
            </button>
          </div>
        </div>
        {menuOpen && <Sheet id={MENU_ID} label={t('shell.menu')} className="public-sheet" onClose={closeMenu}>
          <div className="menu-sheet-head">
            <Link to={ROUTES.home} className="brand" onClick={closeMenu}><BrandMark /><span>{t('app.name')}</span></Link>
            <button className="button button-icon" type="button" aria-label={t('shell.closeMenu')} onClick={closeMenu} data-autofocus><Icon name="close" /></button>
          </div>
          <nav aria-label={t('public.sections')}><SectionLinks onNavigate={closeMenu} /></nav>
          <section className="menu-sheet-preferences" aria-label={t('workbench.preferences')}><PreferencesFields /></section>
          <div className="menu-sheet-end"><SessionActions wide onNavigate={closeMenu} /></div>
        </Sheet>}
      </header>
      <div className="app-content" id="app-content" tabIndex={-1}>
        <RouteBoundary key={pathname}>
          <Suspense fallback={<main className="page"><p role="status">{t('shell.loadingPage')}</p></main>}><Outlet /></Suspense>
        </RouteBoundary>
      </div>
      <footer className="site-footer">
        <div className="container site-footer-inner">
          <Link to={ROUTES.home} className="brand"><BrandMark /><span>{t('app.name')}</span></Link>
          <p>{t('app.tagline')}</p>
          <nav aria-label={t('footer.navigation')}>
            <ul className="footer-links">
              <li><Link to={AFTER_SIGN_IN_ROUTE}>{t('public.laboratory')}</Link></li>
              {FOOTER_LINKS.map((link) => <li key={link.path}><Link to={link.path}>{t(link.labelKey)}</Link></li>)}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}

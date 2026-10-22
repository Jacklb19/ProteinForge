import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { EditorPage } from './features/editor/EditorPage';
import { SequenceDraftProvider } from './features/editor/SequenceDraftProvider';
import { DEFAULT_EXAMPLE } from './features/editor/examples';
import { AlignmentPage } from './features/alignment/AlignmentPage';
import { AlignmentDraftProvider } from './features/alignment/AlignmentDraftProvider';
import { EXAMPLE_ALIGNMENT_DRAFT } from './features/alignment/examples';
import { LandingPage } from './features/landing/LandingPage';
import { ProjectProvider } from './features/projects/ProjectProvider';
import { GeneratorProvider } from './features/generator/GeneratorProvider';
import { LabProvider } from './features/design-lab/LabProvider';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/authContext';
import { PreferencesProvider } from './preferences/PreferencesProvider';
import { usePreferences } from './preferences/usePreferences';
import { LOCALE_LABEL_KEYS, THEMES, THEME_LABEL_KEYS } from './preferences/config';
import { resolveTheme, toggledTheme } from './preferences/theme';
import { useThemeRevision } from './theme/useThemeRevision';
import { useTranslation } from './i18n';
import { LOCALES } from './i18n/config';
import type { Locale } from './i18n/config';
import { Icon } from './shared/Icon';
import { BrandMark } from './shared/BrandMark';
import { NotFoundPage } from './shared/NotFoundPage';
import { SegmentedControl } from './shared/SegmentedControl';
import { BAR_VEIL_SCROLL_PX, FOOTER_LINKS, NAVIGATION_ITEMS, REDIRECTS, ROUTES } from './shared/navigation';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
const MENU_ID = 'site-menu';
const DesignLabPage = lazy(async () => ({ default: (await import('./features/design-lab/DesignLabPage')).DesignLabPage }));
const ProfilePage = lazy(async () => ({ default: (await import('./features/profile/ProfilePage')).ProfilePage }));
const ProjectsPage = lazy(async () => ({ default: (await import('./features/projects/ProjectsPage')).ProjectsPage }));
const LibraryPage = lazy(async () => ({ default: (await import('./features/library/LibraryPage')).LibraryPage }));
const GeneratorPage = lazy(async () => ({ default: (await import('./features/generator/GeneratorPage')).GeneratorPage }));
const PrivacyPage = lazy(async () => ({ default: (await import('./features/privacy/PrivacyPage')).PrivacyPage }));
const TermsPage = lazy(async () => ({ default: (await import('./features/legal/TermsPage')).TermsPage }));
const SignInPage = lazy(async () => ({ default: (await import('./features/auth/SignInPage')).SignInPage }));
const SignUpPage = lazy(async () => ({ default: (await import('./features/auth/SignUpPage')).SignUpPage }));
const RecoverPage = lazy(async () => ({ default: (await import('./features/auth/RecoverPage')).RecoverPage }));

/** Visitors without a session flip between light and dark from the bar; Perfil keeps the three-way choice. */
function ThemeToggle(): React.JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = usePreferences();
  useThemeRevision();
  const prefersDark = window.matchMedia(DARK_SCHEME_QUERY).matches;
  const shown = resolveTheme(theme, prefersDark);
  return (
    <button
      className="button button-icon only-wide"
      type="button"
      aria-label={shown === 'dark' ? t('shell.themeToLight') : t('shell.themeToDark')}
      onClick={() => { setTheme(toggledTheme(theme, prefersDark)); }}
    >
      <Icon name={shown === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/** Language for visitors without a session; signed-in visitors set it in Perfil. */
function LanguageChoice({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      legend={t('shell.languageLabel')}
      options={LOCALES.map((value) => ({ value, label: t(LOCALE_LABEL_KEYS[value]) }))}
      value={locale}
      onChange={onChange}
    />
  );
}

function SiteNavigation({ label }: { label: string }): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <nav className="site-nav" aria-label={label}>
      {NAVIGATION_ITEMS.filter(item => !item.signedInOnly || status === 'signed-in').map((item) => <NavLink key={item.path} to={item.path} end={item.end}>{t(item.labelKey)}</NavLink>)}
    </nav>
  );
}

/** Phone navigation as a panel over the page; Escape, the scrim and any destination close it. */
function MenuSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { theme, setTheme, locale, setLocale } = usePreferences();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <>
      <button className="menu-scrim" type="button" tabIndex={-1} aria-label={t('shell.closeMenu')} onClick={onClose} />
      <div className="menu-sheet" id={MENU_ID} role="dialog" aria-modal="true" aria-label={t('shell.menu')}>
        <div className="menu-sheet-head">
          <Link to={ROUTES.home} className="brand" onClick={onClose}><BrandMark /><span>{t('app.name')}</span></Link>
          <button ref={close} className="button button-icon" type="button" aria-label={t('shell.closeMenu')} onClick={onClose}><Icon name="close" /></button>
        </div>
        <nav aria-label={t('shell.menu')}>
          {NAVIGATION_ITEMS.filter(item => !item.signedInOnly || status === 'signed-in').map((item) => <NavLink key={item.path} to={item.path} end={item.end} onClick={onClose}>{t(item.labelKey)}</NavLink>)}
        </nav>
        <div className="menu-sheet-end">
          {status === 'signed-in'
            ? <Link className="button button-secondary button-large button-wide" to={ROUTES.profile} onClick={onClose}>{t('nav.profile')}</Link>
            : <>
              <SegmentedControl
                legend={t('account.appearance')}
                options={THEMES.map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) }))}
                value={theme}
                onChange={setTheme}
              />
              <LanguageChoice locale={locale} onChange={setLocale} />
              {status !== 'disabled' && <Link className="button button-primary button-large button-wide" to={ROUTES.signUp} onClick={onClose}>{t('auth.signUpAction')}</Link>}
              <Link className="button button-secondary button-large button-wide" to={ROUTES.signIn} onClick={onClose}>{t('shell.signIn')}</Link>
            </>}
        </div>
      </div>
    </>
  );
}

function SiteBar(): React.JSX.Element {
  const { t } = useTranslation();
  const { status, session } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = (): void => { setScrolled(window.scrollY > BAR_VEIL_SCROLL_PX); };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => { window.removeEventListener('scroll', update); };
  }, []);

  const closeMenu = (): void => { setMenuOpen(false); toggle.current?.focus(); };
  const signedIn = status === 'signed-in' && session !== null;

  return (
    <header className="site-bar" data-scrolled={scrolled}>
      <div className="site-bar-inner">
        <Link to={ROUTES.home} className="brand" aria-label={t('shell.home')}><BrandMark /><span>{t('app.name')}</span></Link>
        <SiteNavigation label={t('nav.main')} />
        <div className="site-bar-end">
          {signedIn
            ? (
              <NavLink className="account-link" to={ROUTES.profile} aria-label={t('shell.account', { email: session.user.email })}>
                <span className="avatar" aria-hidden="true">{session.user.email.charAt(0).toUpperCase()}</span>
                <span className="account-link-label">{t('nav.profile')}</span>
              </NavLink>
            )
            : <>
              <ThemeToggle />
              <Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
              {status !== 'disabled' && <Link className="button button-primary only-wide" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link>}
            </>}
          <button
            ref={toggle}
            className="button button-icon only-narrow"
            type="button"
            aria-label={t('shell.openMenu')}
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            onClick={() => { setMenuOpen(true); }}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
      {menuOpen && <MenuSheet onClose={closeMenu} />}
    </header>
  );
}

function SiteFooter(): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { locale, setLocale } = usePreferences();
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <Link to={ROUTES.home} className="brand"><BrandMark /><span>{t('app.name')}</span></Link>
        <p>{t('app.tagline')}</p>
        <nav aria-label={t('footer.navigation')}>
          <ul className="footer-links">
            {FOOTER_LINKS.map((link) => <li key={link.path}><Link to={link.path}>{t(link.labelKey)}</Link></li>)}
          </ul>
        </nav>
        {status !== 'signed-in' && <div className="segmented-bare footer-language"><LanguageChoice locale={locale} onChange={setLocale} /></div>}
      </div>
    </footer>
  );
}

function ApplicationRoutes(): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    window.scrollTo(0, 0);
    content.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#app-content">{t('shell.skip')}</a>
      <SiteBar />
      <div className="app-content" id="app-content" ref={content} tabIndex={-1}>
        <Suspense fallback={<main className="page"><p role="status">{t('shell.loadingPage')}</p></main>}>
        <Routes>
          <Route path={ROUTES.home} element={<LandingPage />} />
          <Route path={ROUTES.analyze} element={<EditorPage />} />
          <Route path={ROUTES.alignment} element={<AlignmentPage />} />
          <Route path={ROUTES.generate} element={<GeneratorPage />} />
          <Route path={ROUTES.laboratory} element={<DesignLabPage />} />
          <Route path={ROUTES.library} element={<LibraryPage />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.projects} element={<ProjectsPage />} />
          <Route path={ROUTES.signIn} element={<SignInPage />} />
          <Route path={ROUTES.signUp} element={<SignUpPage />} />
          <Route path={ROUTES.recover} element={<RecoverPage />} />
          <Route path={ROUTES.privacy} element={<PrivacyPage />} />
          <Route path={ROUTES.terms} element={<TermsPage />} />
          {REDIRECTS.map((redirect) => <Route key={redirect.from} path={redirect.from} element={<Navigate to={redirect.to} replace />} />)}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <SequenceDraftProvider initial={DEFAULT_EXAMPLE}>
          <AlignmentDraftProvider initial={EXAMPLE_ALIGNMENT_DRAFT}>
            <BrowserRouter>
              <LabProvider><ProjectProvider><GeneratorProvider><ApplicationRoutes /></GeneratorProvider></ProjectProvider></LabProvider>
            </BrowserRouter>
          </AlignmentDraftProvider>
        </SequenceDraftProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;

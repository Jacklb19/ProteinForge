import { useEffect, useRef } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { EditorPage } from './features/editor/EditorPage';
import { SequenceDraftProvider } from './features/editor/SequenceDraftProvider';
import { AlignmentPage } from './features/alignment/AlignmentPage';
import { AlignmentDraftProvider } from './features/alignment/AlignmentDraftProvider';
import { SettingsPage } from './features/settings/SettingsPage';
import { LandingPage } from './features/landing/LandingPage';
import { WorkspacePage } from './features/workspace/WorkspacePage';
import { ProjectProvider } from './features/projects/ProjectProvider';
import { LibraryPage } from './features/library/LibraryPage';
import { GeneratorPage } from './features/generator/GeneratorPage';
import { GeneratorProvider } from './features/generator/GeneratorProvider';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { TermsPage } from './features/legal/TermsPage';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/authContext';
import { SignInPage } from './features/auth/SignInPage';
import { SignUpPage } from './features/auth/SignUpPage';
import { RecoverPage } from './features/auth/RecoverPage';
import { PreferencesProvider } from './preferences/PreferencesProvider';
import { usePreferences } from './preferences/usePreferences';
import { resolveTheme, toggledTheme } from './preferences/theme';
import { useThemeRevision } from './theme/useThemeRevision';
import { useTranslation } from './i18n';
import { Icon } from './shared/Icon';
import { BrandMark } from './shared/BrandMark';
import { NotFoundPage } from './shared/NotFoundPage';
import { FOOTER_LINKS, NAVIGATION_ITEMS, PUBLIC_NAVIGATION, REPOSITORY_LINKS, ROUTES, WORKSPACE_PATHS } from './shared/navigation';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Flips between light and dark from the bar; Settings keeps the three-way choice. */
function ThemeToggle(): React.JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = usePreferences();
  useThemeRevision();
  const prefersDark = window.matchMedia(DARK_SCHEME_QUERY).matches;
  const shown = resolveTheme(theme, prefersDark);
  return (
    <button
      className="button button-icon"
      type="button"
      aria-label={shown === 'dark' ? t('shell.themeToLight') : t('shell.themeToDark')}
      onClick={() => { setTheme(toggledTheme(theme, prefersDark)); }}
    >
      <Icon name={shown === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

function AccountAction(): React.JSX.Element {
  const { t } = useTranslation();
  const { status, session } = useAuth();
  if (status === 'signed-in' && session) {
    return (
      <Link className="account-chip" to={ROUTES.settings} aria-label={t('shell.account', { email: session.user.email })}>
        <Icon name="user" /><span>{session.user.email}</span>
      </Link>
    );
  }
  return <Link className="button button-secondary" to={ROUTES.signIn} aria-label={t('shell.signIn')}><Icon name="user" /><span className="account-action-label">{t('shell.signIn')}</span></Link>;
}

function SiteFooter(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-brand">
          <Link to={ROUTES.home} className="brand"><BrandMark /><span>{t('app.name')}</span></Link>
          <p>{t('footer.summary')}</p>
          <p className="footer-note">{t('footer.course')}</p>
        </div>
        <nav aria-label={t('footer.navigation')}>
          <ul className="footer-links">
            {FOOTER_LINKS.map((link) => <li key={link.path}><Link to={link.path}>{t(link.labelKey)}</Link></li>)}
            {REPOSITORY_LINKS.map((link) => <li key={link.url}><a href={link.url}>{t(link.labelKey)}</a></li>)}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

function ApplicationRoutes(): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const content = useRef<HTMLDivElement>(null);
  const isWorkspace = WORKSPACE_PATHS.includes(location.pathname);
  const isIdentity = [ROUTES.signIn, ROUTES.signUp, ROUTES.recover].some((path) => path === location.pathname);
  const auth = useAuth();

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    window.scrollTo(0, 0);
    content.current?.focus();
  }, [location.pathname]);

  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.pathname, location.hash]);

  return (
    <div className={`app ${isWorkspace ? 'app-workspace' : 'app-public'}`}>
      <a className="skip-link" href="#app-content">{t('shell.skip')}</a>
      <header className="top-bar">
        <NavLink to={ROUTES.home} className="brand" aria-label={t('shell.home')}>
          <BrandMark />
          <span>{t('app.name')}</span>
        </NavLink>
        <span className="shell-context">{t(isWorkspace ? 'landing.eyebrow' : 'landing.localStatus')}</span>
        {isWorkspace ? (
          <div className="navigation-dock">
            <nav className="primary-navigation" aria-label={t('nav.main')}>
              {NAVIGATION_ITEMS.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.end}>
                  <Icon name={item.icon} /><span>{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </nav>
            <div className="dock-actions"><ThemeToggle /><AccountAction /></div>
          </div>
        ) : (
          <div className="navigation-dock public-dock">
            <nav className="primary-navigation" aria-label={t('nav.main')}>
              <NavLink to={ROUTES.home} end><Icon name="home" /><span>{t('nav.home')}</span></NavLink>
              {PUBLIC_NAVIGATION.map((item) => <Link key={item.id} to={`${ROUTES.home}#${item.id}`}>{t(item.labelKey)}</Link>)}
              <Link to={ROUTES.workspace}><span>{t('landing.primaryAction')}</span><Icon name="arrow" /></Link>
            </nav>
          </div>
        )}
        {!isWorkspace && (
          <div className="top-bar-actions">
            <ThemeToggle />
            <AccountAction />
            {!isIdentity && auth.status !== 'signed-in' && <Link className="button button-primary" to={ROUTES.signUp}>{t('landing.accountPrimary')}</Link>}
          </div>
        )}
      </header>
      <div className="app-content" id="app-content" ref={content} tabIndex={-1}>
        <Routes>
          <Route path={ROUTES.home} element={<LandingPage />} />
          <Route path={ROUTES.workspace} element={<WorkspacePage />} />
          <Route path={ROUTES.analyze} element={<EditorPage />} />
          <Route path={ROUTES.alignment} element={<AlignmentPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.library} element={<LibraryPage />} />
          <Route path={ROUTES.generate} element={<GeneratorPage />} />
          <Route path={ROUTES.signIn} element={<SignInPage />} />
          <Route path={ROUTES.signUp} element={<SignUpPage />} />
          <Route path={ROUTES.recover} element={<RecoverPage />} />
          <Route path={ROUTES.privacy} element={<PrivacyPage />} />
          <Route path={ROUTES.terms} element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      <SiteFooter />
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <SequenceDraftProvider>
          <AlignmentDraftProvider>
            <BrowserRouter>
              <ProjectProvider><GeneratorProvider><ApplicationRoutes /></GeneratorProvider></ProjectProvider>
            </BrowserRouter>
          </AlignmentDraftProvider>
        </SequenceDraftProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;

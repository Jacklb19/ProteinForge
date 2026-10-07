import { useEffect, useRef } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { EditorPage } from './features/editor/EditorPage';
import { SequenceDraftProvider } from './features/editor/SequenceDraftProvider';
import { AlignmentPage } from './features/alignment/AlignmentPage';
import { AlignmentDraftProvider } from './features/alignment/AlignmentDraftProvider';
import { SettingsPage } from './features/settings/SettingsPage';
import { PreferencesProvider } from './preferences/PreferencesProvider';
import { useTranslation } from './i18n';
import { Icon } from './shared/Icon';
import { BrandMark } from './shared/BrandMark';
import { NotFoundPage } from './shared/NotFoundPage';
import { NAVIGATION_ITEMS, ROUTES } from './shared/navigation';

function ApplicationRoutes(): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    window.scrollTo(0, 0);
    content.current?.focus();
  }, [location.pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#app-content">{t('shell.skip')}</a>
      <header className="top-bar">
        <NavLink to={ROUTES.analyze} className="brand" aria-label={t('shell.home')}>
          <BrandMark />
          <span>{t('app.name')}</span>
        </NavLink>
        <nav className="primary-navigation" aria-label={t('nav.main')}>
          {NAVIGATION_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end}>
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="app-content" id="app-content" ref={content} tabIndex={-1}>
        <Routes>
          <Route path={ROUTES.analyze} element={<EditorPage />} />
          <Route path={ROUTES.alignment} element={<AlignmentPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <PreferencesProvider>
      <SequenceDraftProvider>
        <AlignmentDraftProvider>
          <BrowserRouter>
            <ApplicationRoutes />
          </BrowserRouter>
        </AlignmentDraftProvider>
      </SequenceDraftProvider>
    </PreferencesProvider>
  );
}

export default App;

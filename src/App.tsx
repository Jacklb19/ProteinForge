import { EditorPage } from './features/editor/EditorPage';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { SettingsPage } from './features/settings/SettingsPage';
import { PreferencesProvider } from './preferences/PreferencesProvider';
import { useTranslation } from './i18n';

function ApplicationRoutes(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <nav className="site-navigation" aria-label={t('nav.main')}>
        <NavLink to="/">{t('nav.editor')}</NavLink>
        <NavLink to="/settings">{t('nav.settings')}</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  );
}

export function App(): React.JSX.Element {
  return <PreferencesProvider><BrowserRouter><ApplicationRoutes /></BrowserRouter></PreferencesProvider>;
}

export default App;

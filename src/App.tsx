import { EditorPage } from './features/editor/EditorPage';
import { AlignmentPage } from './features/alignment/AlignmentPage';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { SettingsPage } from './features/settings/SettingsPage';
import { PreferencesProvider } from './preferences/PreferencesProvider';
import { useTranslation } from './i18n';
import { Icon } from './shared/Icon';
import { BrandMark } from './shared/BrandMark';

function ApplicationRoutes(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="workspace">
      <header className="site-header">
      <div className="site-brand"><BrandMark /><span>{t('app.name')}</span></div>
      <p className="navigation-label">{t('visual.tools')}</p>
      <nav className="site-navigation" aria-label={t('nav.main')}>
        <NavLink to="/"><Icon name="sequence" />{t('nav.editor')}</NavLink>
        <NavLink to="/alignment"><Icon name="alignment" />{t('nav.alignment')}</NavLink>
        <NavLink to="/settings"><Icon name="settings" />{t('nav.settings')}</NavLink>
      </nav>
      <p className="workspace-note">{t('app.description')}</p>
      </header>
      <div className="workspace-content">
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/alignment" element={<AlignmentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      </div>
    </div>
  );
}

export function App(): React.JSX.Element {
  return <PreferencesProvider><BrowserRouter><ApplicationRoutes /></BrowserRouter></PreferencesProvider>;
}

export default App;

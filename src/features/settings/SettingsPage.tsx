import { useTranslation } from '../../i18n';
import { usePreferences } from '../../preferences/usePreferences';
import type { Theme } from '../../preferences/preferences';
import type { Locale } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';

/** Lets visitors choose a local language and appearance. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  return (
    <main className="settings-page">
      <PageHeading titleKey="settings.title" introduction="visual.settingsIntroduction" />
      <section className="panel settings-preferences" aria-labelledby="preferences-title">
      <h2 id="preferences-title">{t('visual.preferences')}</h2>
      <div className="settings-row">
      <div><label htmlFor="settings-language">{t('settings.language')}</label><p id="language-help" className="field-help">{t('visual.languageHelp')}</p></div>
      <select id="settings-language" aria-describedby="language-help" value={locale} onChange={(event) => { setLocale(event.target.value as Locale); }}>
        <option value="es">{t('settings.spanish')}</option>
        <option value="en">{t('settings.english')}</option>
      </select>
      </div>
      <div className="settings-row">
      <div><label htmlFor="settings-theme">{t('settings.theme')}</label><p id="theme-help" className="field-help">{t('visual.themeHelp')}</p></div>
      <select id="settings-theme" aria-describedby="theme-help" value={theme} onChange={(event) => { setTheme(event.target.value as Theme); }}>
        <option value="system">{t('settings.system')}</option>
        <option value="light">{t('settings.light')}</option>
        <option value="dark">{t('settings.dark')}</option>
      </select>
      </div>
      <p className="notice">{t('settings.localNote')}</p>
      </section>
    </main>
  );
}

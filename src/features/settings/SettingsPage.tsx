import { useTranslation } from '../../i18n';
import { usePreferences } from '../../preferences/usePreferences';
import type { Theme } from '../../preferences/preferences';
import type { Locale } from '../../i18n';

/** Lets visitors choose a local language and appearance. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  return (
    <main className="settings-page">
      <h1>{t('settings.title')}</h1>
      <label htmlFor="settings-language">{t('settings.language')}</label>
      <select id="settings-language" value={locale} onChange={(event) => { setLocale(event.target.value as Locale); }}>
        <option value="es">{t('settings.spanish')}</option>
        <option value="en">{t('settings.english')}</option>
      </select>
      <label htmlFor="settings-theme">{t('settings.theme')}</label>
      <select id="settings-theme" value={theme} onChange={(event) => { setTheme(event.target.value as Theme); }}>
        <option value="system">{t('settings.system')}</option>
        <option value="light">{t('settings.light')}</option>
        <option value="dark">{t('settings.dark')}</option>
      </select>
      <p>{t('settings.localNote')}</p>
    </main>
  );
}

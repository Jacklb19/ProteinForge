import { useTranslation } from '../../i18n';
import { LOCALES } from '../../i18n/config';
import { usePreferences } from '../../preferences/usePreferences';
import { LOCALE_LABEL_KEYS, THEMES, THEME_LABEL_KEYS } from '../../preferences/config';
import { PageHeading } from '../../shared/PageHeading';
import { SegmentedControl } from '../../shared/SegmentedControl';

/** Local appearance and language preferences, grouped like system settings. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  return (
    <main className="settings-page">
      <PageHeading titleKey="settings.title" introduction="settings.introduction" />
      <section className="list-group" aria-labelledby="preferences-title">
        <h2 id="preferences-title">{t('settings.preferences')}</h2>
        <div className="list-rows">
          <div className="list-row">
            <SegmentedControl
              legend={t('settings.theme')}
              options={THEMES.map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) }))}
              value={theme}
              onChange={setTheme}
              describedBy="theme-help"
            />
            <p id="theme-help" className="field-help">{t('settings.themeHelp')}</p>
          </div>
          <div className="list-row">
            <SegmentedControl
              legend={t('settings.language')}
              options={LOCALES.map((value) => ({ value, label: t(LOCALE_LABEL_KEYS[value]) }))}
              value={locale}
              onChange={setLocale}
              describedBy="language-help"
            />
            <p id="language-help" className="field-help">{t('settings.languageHelp')}</p>
          </div>
        </div>
      </section>
      <section className="list-group" aria-labelledby="privacy-title">
        <h2 id="privacy-title">{t('settings.privacy')}</h2>
        <div className="list-rows">
          <p className="list-row">{t('settings.privacyText')}</p>
        </div>
      </section>
    </main>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { LOCALES } from '../../i18n/config';
import { usePreferences } from '../../preferences/usePreferences';
import { LOCALE_LABEL_KEYS, THEMES, THEME_LABEL_KEYS } from '../../preferences/config';
import { Icon } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';
import { PageHeading } from '../../shared/PageHeading';
import { SegmentedControl } from '../../shared/SegmentedControl';
import { useAuth } from '../auth/authContext';

/** Local appearance and language preferences, the account and privacy, grouped like system settings. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const auth = useAuth();
  return (
    <main className="page settings-page">
      <PageHeading titleKey="settings.title" introduction="settings.introduction" />
      <section className="list-group" aria-labelledby="account-title">
        <h2 id="account-title">{t('settings.account')}</h2>
        <div className="list-rows">
          <div className="list-row account-row">
            {auth.status === 'signed-in' && auth.session ? (
              <>
                <p>{t('settings.accountSignedIn', { email: auth.session.user.email })}</p>
                <p className="field-help">{t('settings.accountProjects')}</p>
                <div className="hero-actions">
                  <button className="button button-secondary" type="button" onClick={() => { void auth.signOut(); }}><Icon name="logout" />{t('settings.signOut')}</button>
                </div>
              </>
            ) : auth.status === 'disabled' ? (
              <p className="field-help">{t('settings.accountDisabled')}</p>
            ) : (
              <>
                <p className="field-help">{t('settings.accountAnonymous')}</p>
                <div className="hero-actions">
                  <Link className="button button-primary" to={ROUTES.signIn}>{t('settings.signIn')}</Link>
                  <Link className="button button-secondary" to={ROUTES.signUp}>{t('settings.signUp')}</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
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
          <div className="list-row">
            <p>{t('settings.privacyText')}</p>
            <Link className="inline-link" to={ROUTES.privacy}>{t('settings.privacyLink')}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

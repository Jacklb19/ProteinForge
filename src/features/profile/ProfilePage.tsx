import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { LOCALES } from '../../i18n/config';
import { usePreferences } from '../../preferences/usePreferences';
import { LOCALE_LABEL_KEYS, THEMES, THEME_LABEL_KEYS } from '../../preferences/config';
import { ROUTES } from '../../shared/navigation';
import { SegmentedControl } from '../../shared/SegmentedControl';
import { useAuth } from '../auth/authContext';
import { SUPPORT_EMAIL_URL } from '../legal/config';

type PasswordState = 'idle' | 'sending' | 'sent' | 'error';

/** Account, appearance, language and data preferences; the project collection has its own screen. */
export function ProfilePage(): React.JSX.Element {
  const { t } = useTranslation();
  const { chosenLocale, theme, setLocale, setTheme } = usePreferences();
  const auth = useAuth();
  const [password, setPassword] = useState<PasswordState>('idle');

  if (auth.status === 'loading') return <main className="page page-narrow"><p className="status-message" role="status">{t('projects.sessionLoading')}</p></main>;
  if (auth.status !== 'signed-in' || !auth.session) return <Navigate to={ROUTES.signIn} state={{ from: ROUTES.profile }} replace />;
  const email = auth.session.user.email;

  const sendPasswordLink = (): void => {
    setPassword('sending');
    auth.recover(email).then(() => { setPassword('sent'); }).catch(() => { setPassword('error'); });
  };

  return (
    <main className="page page-narrow profile-page">
      <header className="profile-head">
        <span className="avatar avatar-large" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
        <div className="profile-head-text">
          <h1>{t('account.title')}</h1>
          <p>{email}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => { void auth.signOut(); }}>{t('settings.signOut')}</button>
      </header>
      <nav className="profile-index" aria-label={t('workbench.account')}>
        <a href="#account-title">{t('settings.account')}</a><a href="#appearance-title">{t('account.appearance')}</a><a href="#privacy-title">{t('account.privacy')}</a>
      </nav>

      <section className="profile-row" aria-labelledby="project-library-title">
        <h2 id="project-library-title">{t('projects.title')}</h2>
        <div className="profile-row-body"><p>{t('projects.profileHelp')}</p><Link className="inline-link" to={ROUTES.projects}>{t('projects.listLink')}</Link></div>
      </section>

      <section className="profile-row" aria-labelledby="account-title">
        <h2 id="account-title">{t('settings.account')}</h2>
        <div className="profile-row-body">
          <div className="setting-row"><div><h3>{t('auth.email')}</h3><p>{email}</p></div></div>
          <div className="setting-row">
            <div><h3>{t('auth.password')}</h3><p role="status">{t(password === 'sent' ? 'account.passwordSent' : password === 'error' ? 'auth.errorUnknown' : 'account.passwordHelp')}</p></div>
            <button className="button button-quiet" type="button" disabled={password === 'sending' || password === 'sent'} onClick={sendPasswordLink}>{t('account.passwordAction')}</button>
          </div>
        </div>
      </section>

      <section className="profile-row" aria-labelledby="appearance-title">
        <h2 id="appearance-title">{t('account.appearance')}</h2>
        <div className="profile-row-body segmented-bare">
          <SegmentedControl
            legend={t('settings.theme')}
            options={THEMES.map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) }))}
            value={theme}
            onChange={setTheme}
            describedBy="theme-help"
          />
          <p id="theme-help" className="field-help">{t('settings.themeHelp')}</p>
        </div>
      </section>

      <section className="profile-row" aria-labelledby="language-title">
        <h2 id="language-title">{t('settings.language')}</h2>
        <div className="profile-row-body segmented-bare">
          <SegmentedControl
            legend={t('settings.language')}
            options={LOCALES.map((value) => ({ value, label: t(LOCALE_LABEL_KEYS[value]) }))}
            value={chosenLocale}
            onChange={setLocale}
          />
        </div>
      </section>

      <section className="profile-row" aria-labelledby="privacy-title">
        <h2 id="privacy-title">{t('account.privacy')}</h2>
        <div className="profile-row-body">
          <div className="setting-row"><div><h3>{t('account.sequencesTitle')}</h3><p>{t('account.sequencesText')}</p></div></div>
          <div className="setting-row"><div><h3>{t('privacy.title')}</h3><p>{t('account.policyText')}</p></div><Link className="inline-link" to={ROUTES.privacy}>{t('account.policyAction')}</Link></div>
          <div className="setting-row"><div><h3>{t('account.deleteTitle')}</h3><p>{t('account.deleteText')}</p></div><a className="inline-link link-danger" href={SUPPORT_EMAIL_URL}>{t('account.deleteAction')}</a></div>
        </div>
      </section>
    </main>
  );
}

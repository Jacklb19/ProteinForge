import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';
import { AuthFrame } from './AuthFrame';
import { destinationAfterSignIn } from './destination';
import { useAuth } from './authContext';
import { OAUTH_PROVIDERS } from './config';
import { authErrorKey } from './errors';
import { PasswordField, TextField } from './fields';
import { fieldErrors, signInSchema } from './validation';
import type { FieldErrors } from './validation';

export function SignInPage(): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = auth.status !== 'anonymous' || busy;

  if (auth.status === 'signed-in') return <Navigate to={destinationAfterSignIn(location.state)} replace />;

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = signInSchema.safeParse({ email, password });
    const nextErrors = fieldErrors<'email' | 'password'>(result);
    setErrors(nextErrors);
    setServerError(null);
    if (!result.success) return;
    setBusy(true);
    auth.signIn(result.data.email, result.data.password)
      .catch((error: unknown) => { setServerError(authErrorKey(error)); })
      .finally(() => { setBusy(false); });
  };

  return (
    <AuthFrame
      title={t('auth.signInTitle')}
      intro={t('auth.signInIntro')}
      footer={<><span>{t('auth.noAccount')}</span><Link className="inline-link" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link></>}
    >
      <form className="auth-form" noValidate onSubmit={submit}>
        <TextField id="sign-in-email" type="email" label={t('auth.email')} value={email} onChange={setEmail} autoComplete="email" errorKey={errors.email} disabled={disabled} />
        <PasswordField id="sign-in-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="current-password" errorKey={errors.password} disabled={disabled} />
        <p className="status-message" data-state={serverError || auth.redirectError ? 'error' : 'idle'} role="status" aria-live="polite">
          {serverError ? t(serverError) : auth.redirectError ? t('auth.errorRedirect', { code: auth.redirectError }) : ''}
        </p>
        <div className="auth-actions">
          <button className="button button-primary button-wide" type="submit" disabled={disabled}>
            {busy ? t('auth.working') : t('auth.signInAction')}<Icon name="arrow" />
          </button>
          <Link className="inline-link" to={ROUTES.recover}>{t('auth.forgot')}</Link>
        </div>
      </form>
      {auth.status !== 'disabled' && OAUTH_PROVIDERS.length > 0 && (
        <div className="auth-providers">
          <span className="auth-divider" aria-hidden="true">{t('auth.or')}</span>
          {OAUTH_PROVIDERS.map((provider) => {
            const url = auth.authorizeUrl(provider.id);
            return url ? <a key={provider.id} className="button button-secondary button-wide" href={url}>{t(provider.labelKey)}</a> : null;
          })}
        </div>
      )}
    </AuthFrame>
  );
}

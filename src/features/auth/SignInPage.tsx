import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { AuthFrame } from './AuthFrame';
import { AuthError } from './authApi';
import { destinationAfterSignIn, destinationTitle, requestedDestination } from './destination';
import { useAuth } from './authContext';
import { authErrorKey } from './errors';
import { PasswordField, TextField } from './fields';
import { OAuthButtons } from './OAuthButtons';
import { useSyncSummary } from '../projects/syncSummary';
import { fieldErrors, signInSchema } from './validation';
import type { FieldErrors } from './validation';

/** Supabase refuses a password sign-in until the email is confirmed. */
const NOT_CONFIRMED = 'email_not_confirmed';

export function SignInPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = auth.status !== 'anonymous' || busy;
  const requested = requestedDestination(location.state);
  const requestedTitle = requested ? destinationTitle(requested) : null;
  // Saves left waiting when the session ended are only sent once the same account signs in again.
  const summary = useSyncSummary();
  const ended = summary?.kind === 'session-ended' ? summary : null;

  if (auth.status === 'signed-in') return <Navigate to={destinationAfterSignIn(location.state)} replace />;

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = signInSchema.safeParse({ email, password });
    setErrors(fieldErrors<'email' | 'password'>(result));
    setServerError(null);
    setUnconfirmed(null);
    if (!result.success) return;
    setBusy(true);
    auth.signIn(result.data.email, result.data.password)
      .catch((error: unknown) => {
        if (error instanceof AuthError && error.code === NOT_CONFIRMED) setUnconfirmed(result.data.email);
        else setServerError(authErrorKey(error));
      })
      .finally(() => { setBusy(false); });
  };

  return (
    <AuthFrame
      title={t('auth.signInTitle')}
      intro={requestedTitle ? undefined : t('auth.signInIntro')}
      note={<>
        {ended && <p className="auth-return" role="note"><strong>{t('sync.sessionEnded')}</strong> {t(ended.count === 1 ? 'sync.sessionEndedHelpOne' : 'sync.sessionEndedHelp', { email: ended.email, count: formatNumber(ended.count) })}</p>}
        {requestedTitle && <p className="auth-return" role="note">{t('auth.returnNote', { page: t(requestedTitle) })}</p>}
      </>}
      footer={<><span>{t('auth.noAccount')}</span><Link className="inline-link" state={{ from: requested }} to={ROUTES.signUp}>{t('auth.signUpAction')}</Link></>}
    >
      <form className="auth-form" noValidate onSubmit={submit}>
        <TextField id="sign-in-email" type="email" label={t('auth.email')} value={email} onChange={setEmail} autoComplete="email" errorKey={errors.email} disabled={disabled} />
        <PasswordField id="sign-in-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="current-password" errorKey={errors.password} disabled={disabled} />
        {unconfirmed
          ? <div className="auth-alert" role="alert">
            <p>{t('auth.errorEmailNotConfirmed')}</p>
            <Link className="button button-secondary" to={ROUTES.confirm} state={{ email: unconfirmed, from: requested }}>{t('auth.enterCode')}</Link>
          </div>
          : <p className="status-message" data-state={serverError || auth.redirectError ? 'error' : 'idle'} role="status" aria-live="polite">
            {serverError ? t(serverError) : auth.redirectError ? t('auth.errorRedirect', { code: auth.redirectError }) : ''}
          </p>}
        <div className="auth-actions">
          <button className="button button-primary button-large button-wide" type="submit" disabled={disabled}>
            {busy ? t('auth.working') : t('auth.signInAction')}
          </button>
          <Link className="inline-link" to={ROUTES.recover}>{t('auth.forgot')}</Link>
        </div>
      </form>
      <OAuthButtons destination={requested} />
    </AuthFrame>
  );
}

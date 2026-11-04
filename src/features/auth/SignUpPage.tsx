import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { destinationAfterSignIn, requestedDestination } from './destination';
import { AuthFrame } from './AuthFrame';
import { useAuth } from './authContext';
import { PASSWORD_MIN_LENGTH } from './config';
import { authErrorKey } from './errors';
import { PasswordField, TextField } from './fields';
import { OAuthButtons } from './OAuthButtons';
import { fieldErrors, signUpSchema } from './validation';
import type { FieldErrors } from './validation';

type Field = 'email' | 'password' | 'confirm';

export function SignUpPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = auth.status !== 'anonymous' || busy;
  const requested = requestedDestination(location.state);

  if (auth.status === 'signed-in') return <Navigate to={destinationAfterSignIn(location.state)} replace />;

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = signUpSchema.safeParse({ email, password, confirm });
    setErrors(fieldErrors<Field>(result));
    setServerError(null);
    if (!result.success) return;
    setBusy(true);
    const sentAt = Date.now();
    auth.signUp(result.data.email, result.data.password)
      .then((outcome) => {
        // The address travels in the page state, never in the URL.
        if (outcome.confirmationRequired) void navigate(ROUTES.confirm, { state: { email: result.data.email, from: requested, sentAt } });
      })
      .catch((error: unknown) => { setServerError(authErrorKey(error)); })
      .finally(() => { setBusy(false); });
  };

  return (
    <AuthFrame
      title={t('auth.signUpTitle')}
      footer={<><span>{t('auth.hasAccount')}</span><Link className="inline-link" state={{ from: requested }} to={ROUTES.signIn}>{t('auth.signInAction')}</Link></>}
    >
      <form className="auth-form" noValidate onSubmit={submit}>
        <TextField id="sign-up-email" type="email" label={t('auth.email')} value={email} onChange={setEmail} autoComplete="email" errorKey={errors.email} disabled={disabled} />
        <PasswordField id="sign-up-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="new-password" errorKey={errors.password} help={t('auth.passwordHelp', { count: formatNumber(PASSWORD_MIN_LENGTH) })} disabled={disabled} />
        <PasswordField id="sign-up-confirm" label={t('auth.confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" errorKey={errors.confirm} disabled={disabled} />
        <p className="status-message" data-state={serverError ? 'error' : 'idle'} role="status" aria-live="polite">{serverError ? t(serverError) : ''}</p>
        <div className="auth-actions">
          <button className="button button-primary button-large button-wide" type="submit" disabled={disabled}>
            {busy ? t('auth.working') : t('auth.signUpAction')}
          </button>
        </div>
      </form>
      <OAuthButtons destination={requested} />
    </AuthFrame>
  );
}

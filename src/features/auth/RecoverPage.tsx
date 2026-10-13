import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { AFTER_SIGN_IN_ROUTE, ROUTES } from '../../shared/navigation';
import { AuthFrame } from './AuthFrame';
import { useAuth } from './authContext';
import { PASSWORD_MIN_LENGTH } from './config';
import { authErrorKey } from './errors';
import { PasswordField, TextField } from './fields';
import { fieldErrors, newPasswordSchema, recoverSchema } from './validation';
import type { FieldErrors } from './validation';

/** Requests a recovery link, or sets the new password when the visitor arrives from that link. */
export function RecoverPage(): React.JSX.Element {
  const auth = useAuth();
  if (auth.recoveryPending) return <ResetForm />;
  if (auth.status === 'signed-in') return <Navigate to={AFTER_SIGN_IN_ROUTE} replace />;
  return <RequestForm />;
}

function RequestForm(): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email'>>({});
  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const disabled = auth.status !== 'anonymous' || busy || sent;

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = recoverSchema.safeParse({ email });
    setErrors(fieldErrors<'email'>(result));
    setServerError(null);
    if (!result.success) return;
    setBusy(true);
    auth.recover(result.data.email)
      .then(() => { setSent(true); })
      .catch((error: unknown) => { setServerError(authErrorKey(error)); })
      .finally(() => { setBusy(false); });
  };

  return (
    <AuthFrame
      title={t('auth.recoverTitle')}
      intro={t('auth.recoverIntro')}
      footer={<Link className="inline-link" to={ROUTES.signIn}>{t('auth.backToSignIn')}</Link>}
    >
      <form className="auth-form" noValidate onSubmit={submit}>
        <TextField id="recover-email" type="email" label={t('auth.email')} value={email} onChange={setEmail} autoComplete="email" errorKey={errors.email} disabled={disabled} />
        <p className="status-message" data-state={serverError || auth.redirectError ? 'error' : sent ? 'success' : 'idle'} role="status" aria-live="polite">
          {serverError ? t(serverError) : sent ? t('auth.recoverSent') : auth.redirectError ? t('auth.errorRedirect', { code: auth.redirectError }) : ''}
        </p>
        <div className="auth-actions">
          <button className="button button-primary button-large button-wide" type="submit" disabled={disabled}>
            {busy ? t('auth.working') : t('auth.recoverAction')}
          </button>
        </div>
      </form>
    </AuthFrame>
  );
}

function ResetForm(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'password' | 'confirm'>>({});
  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) return <Navigate to={AFTER_SIGN_IN_ROUTE} replace />;

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = newPasswordSchema.safeParse({ password, confirm });
    setErrors(fieldErrors<'password' | 'confirm'>(result));
    setServerError(null);
    if (!result.success) return;
    setBusy(true);
    auth.updatePassword(result.data.password)
      .then(() => { setDone(true); })
      .catch((error: unknown) => { setServerError(authErrorKey(error)); })
      .finally(() => { setBusy(false); });
  };

  return (
    <AuthFrame title={t('auth.resetTitle')} intro={t('auth.resetIntro')}>
      <form className="auth-form" noValidate onSubmit={submit}>
        <PasswordField id="reset-password" label={t('auth.newPassword')} value={password} onChange={setPassword} autoComplete="new-password" errorKey={errors.password} help={t('auth.passwordHelp', { count: formatNumber(PASSWORD_MIN_LENGTH) })} disabled={busy} />
        <PasswordField id="reset-confirm" label={t('auth.confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" errorKey={errors.confirm} disabled={busy} />
        <p className="status-message" data-state={serverError ? 'error' : 'idle'} role="status" aria-live="polite">{serverError ? t(serverError) : ''}</p>
        <div className="auth-actions">
          <button className="button button-primary button-large button-wide" type="submit" disabled={busy}>
            {busy ? t('auth.working') : t('auth.resetAction')}
          </button>
        </div>
      </form>
    </AuthFrame>
  );
}

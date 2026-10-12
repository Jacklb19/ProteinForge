import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { AFTER_SIGN_IN_ROUTE, ROUTES } from '../../shared/navigation';
import { AuthFrame } from './AuthFrame';
import { useAuth } from './authContext';
import { PASSWORD_MIN_LENGTH } from './config';
import { authErrorKey } from './errors';
import { PasswordField, TextField } from './fields';
import { fieldErrors, signUpSchema } from './validation';
import type { FieldErrors } from './validation';

type Field = 'email' | 'password' | 'confirm';

export function SignUpPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const disabled = auth.status !== 'anonymous' || busy || confirmationSent;

  if (auth.status === 'signed-in') return <Navigate to={AFTER_SIGN_IN_ROUTE} replace />;

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = signUpSchema.safeParse({ email, password, confirm });
    setErrors(fieldErrors<Field>(result));
    setServerError(null);
    if (!result.success) return;
    setBusy(true);
    auth.signUp(result.data.email, result.data.password)
      .then((outcome) => { if (outcome.confirmationRequired) setConfirmationSent(true); })
      .catch((error: unknown) => { setServerError(authErrorKey(error)); })
      .finally(() => { setBusy(false); });
  };

  return (
    <AuthFrame
      title={t('auth.signUpTitle')}
      intro={t('auth.signUpIntro', { count: formatNumber(PASSWORD_MIN_LENGTH) })}
      footer={<><span>{t('auth.hasAccount')}</span><Link className="inline-link" to={ROUTES.signIn}>{t('auth.signInAction')}</Link></>}
    >
      <form className="auth-form" noValidate onSubmit={submit}>
        <TextField id="sign-up-email" type="email" label={t('auth.email')} value={email} onChange={setEmail} autoComplete="email" errorKey={errors.email} disabled={disabled} />
        <PasswordField id="sign-up-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="new-password" errorKey={errors.password} help={t('auth.passwordHelp', { count: formatNumber(PASSWORD_MIN_LENGTH) })} disabled={disabled} />
        <PasswordField id="sign-up-confirm" label={t('auth.confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" errorKey={errors.confirm} disabled={disabled} />
        <p className="status-message" data-state={serverError ? 'error' : confirmationSent ? 'success' : 'idle'} role="status" aria-live="polite">
          {serverError ? t(serverError) : confirmationSent ? t('auth.signedUpConfirm') : ''}
        </p>
        <div className="auth-actions">
          <button className="button button-primary button-wide" type="submit" disabled={disabled}>
            {busy ? t('auth.working') : t('auth.signUpAction')}<Icon name="arrow" />
          </button>
        </div>
      </form>
    </AuthFrame>
  );
}

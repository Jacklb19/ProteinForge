import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { AuthFrame } from './AuthFrame';
import { AuthError } from './authApi';
import { useAuth } from './authContext';
import { EMAIL_CODE_INPUT_MAX_LENGTH, EMAIL_CODE_LENGTH, RESEND_WAIT_SECONDS } from './config';
import { destinationAfterSignIn, destinationTitle, requestedDestination } from './destination';
import { authErrorKey } from './errors';
import { TextField } from './fields';
import { emailCodeSchema, emailSchema } from './validation';

/** What the sign-up or sign-in page hands over; the address travels in the page state, never in the URL. */
interface ConfirmState { email?: unknown; sentAt?: unknown }

/** The service limits how often a confirmation email can be sent. */
const RESEND_LIMITED = 'over_email_send_rate_limit';
const SECOND_MS = 1000;

function readState(state: unknown): { email: string; sentAt: number | null } {
  const value = (typeof state === 'object' && state !== null ? state : {}) as ConfirmState;
  return {
    email: typeof value.email === 'string' ? value.email : '',
    sentAt: typeof value.sentAt === 'number' && Number.isFinite(value.sentAt) ? value.sentAt : null,
  };
}

/** Seconds left before another code can be requested, counted down once per second. */
function useWait(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((until - now) / SECOND_MS));
  useEffect(() => {
    if (left === 0) return;
    const timer = window.setInterval(() => { setNow(Date.now()); }, SECOND_MS);
    return () => { window.clearInterval(timer); };
  }, [left]);
  return left;
}

/** Confirms a new account with the 6-digit code sent next to the link; the link keeps working on its own. */
export function ConfirmEmailPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const handed = readState(location.state);
  const requested = requestedDestination(location.state);
  const destination = destinationAfterSignIn(location.state);
  const destinationName = t(destinationTitle(destination) ?? 'nav.analyze');
  const [email, setEmail] = useState(handed.email);
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<TranslationKey | undefined>();
  const [codeError, setCodeError] = useState<TranslationKey | undefined>();
  const [resendState, setResendState] = useState<{ key: TranslationKey; error: boolean } | null>(null);
  const [waitUntil, setWaitUntil] = useState(() => (handed.sentAt ?? 0) + RESEND_WAIT_SECONDS * SECOND_MS);
  const wait = useWait(waitUntil);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // A visitor who already has a session has nothing to confirm; right after confirming, the page says so first.
  if (auth.status === 'signed-in' && !busy && !done) return <Navigate to={destination} replace />;

  const checkedEmail = (): string | null => {
    const result = emailSchema.safeParse(email);
    setEmailError(result.success ? undefined : result.error.issues[0]?.message as TranslationKey);
    return result.success ? result.data : null;
  };

  const verify = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResendState(null);
    const address = checkedEmail();
    const result = emailCodeSchema.safeParse({ code });
    setCodeError(result.success ? undefined : result.error.issues[0]?.message as TranslationKey);
    if (!address || !result.success) return;
    setBusy(true);
    auth.verifyEmailCode(address, result.data.code)
      .then(() => { setDone(true); })
      .catch((error: unknown) => { setCodeError(authErrorKey(error)); })
      .finally(() => { setBusy(false); });
  };

  const resend = () => {
    const address = checkedEmail();
    if (!address) return;
    setResendState(null);
    setBusy(true);
    auth.resendConfirmation(address)
      .then(() => {
        setWaitUntil(Date.now() + RESEND_WAIT_SECONDS * SECOND_MS);
        setResendState({ key: 'auth.codeResent', error: false });
      })
      .catch((error: unknown) => {
        const limited = error instanceof AuthError && (error.code === RESEND_LIMITED || error.status === 429);
        if (limited) setWaitUntil(Date.now() + RESEND_WAIT_SECONDS * SECOND_MS);
        setResendState({ key: limited ? 'auth.errorResendWait' : authErrorKey(error), error: true });
      })
      .finally(() => { setBusy(false); });
  };

  if (done) {
    return (
      <AuthFrame title={t('auth.confirmedTitle')}>
        <p className="status-message auth-success" data-state="success" role="status">{t('auth.confirmedText', { email: auth.session?.user.email ?? email })}</p>
        <div className="auth-actions">
          <Link className="button button-primary button-large button-wide" to={destination} replace>{t('auth.continueTo', { page: destinationName })}</Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title={t('auth.confirmTitle')}
      intro={handed.email ? t('auth.confirmIntro', { email: handed.email, count: formatNumber(EMAIL_CODE_LENGTH) }) : t('auth.confirmIntroNoEmail', { count: formatNumber(EMAIL_CODE_LENGTH) })}
      footer={<><span>{t('auth.wrongEmail')}</span><Link className="inline-link" state={{ from: requested }} to={ROUTES.signUp}>{t('auth.changeEmail')}</Link></>}
    >
      <form className="auth-form" noValidate onSubmit={verify}>
        {!handed.email && <TextField id="confirm-email" type="email" label={t('auth.email')} value={email} onChange={setEmail} autoComplete="email" errorKey={emailError} disabled={busy} />}
        <TextField
          id="confirm-code" label={t('auth.codeLabel', { count: formatNumber(EMAIL_CODE_LENGTH) })} value={code} onChange={setCode}
          autoComplete="one-time-code" inputMode="numeric" maxLength={EMAIL_CODE_INPUT_MAX_LENGTH} inputClassName="code-input"
          help={codeError ? undefined : t('auth.codeHelp')} errorKey={codeError} disabled={busy}
        />
        <div className="auth-actions">
          <button className="button button-primary button-large button-wide" type="submit" disabled={busy}>{busy ? t('auth.working') : t('auth.verifyAction')}</button>
        </div>
        <div className="auth-resend">
          <span>{t('auth.spamHint')}</span>
          <button className="button button-quiet" type="button" disabled={busy || wait > 0} onClick={resend}>{t('auth.resendAction')}</button>
          {wait > 0 && <span>{t('auth.resendWait', { seconds: formatNumber(wait) })}</span>}
        </div>
        <p className="status-message" data-state={resendState ? (resendState.error ? 'error' : 'success') : 'idle'} role="status" aria-live="polite">{resendState ? t(resendState.key) : ''}</p>
      </form>
    </AuthFrame>
  );
}

import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from './authContext';

interface Props {
  title: string;
  intro: string;
  children: ReactNode;
  /** Links shown under the form, such as the switch between sign in and sign up. */
  footer?: ReactNode;
}

/** One centered form; the site bar already carries the identity. */
export function AuthFrame({ title, intro, children, footer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <main className="auth-page" aria-labelledby="auth-title">
      <header className="page-heading">
        <h1 id="auth-title">{title}</h1>
        <p>{intro}</p>
      </header>
      {status === 'disabled' && <p className="notice" role="note">{t('auth.disabled')}</p>}
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
    </main>
  );
}

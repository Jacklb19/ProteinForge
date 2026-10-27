import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from './authContext';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../shared/navigation';

interface Props {
  title: string;
  intro: string;
  children: ReactNode;
  /** Links shown under the form, such as the switch between sign in and sign up. */
  footer?: ReactNode;
}

/** Account context and one form, stacked on small screens. */
export function AuthFrame({ title, intro, children, footer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <main className="auth-layout" aria-labelledby="auth-title">
      <section className="auth-context" aria-labelledby="auth-context-title">
        <h2 id="auth-context-title">{t('workbench.authLead')}</h2><p>{t('workbench.authHelp')}</p>
        <Link className="button button-secondary" to={ROUTES.analyze}>{t('workbench.withoutAccount')}</Link>
      </section>
      <div className="auth-page">
      <header className="page-heading">
        <h1 id="auth-title">{title}</h1>
        <p>{intro}</p>
      </header>
      {status === 'disabled' && <p className="notice" role="note">{t('auth.disabled')}</p>}
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  );
}

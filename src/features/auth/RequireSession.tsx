import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from './authContext';

/**
 * Every tool needs a session. Without one the visitor goes to «Iniciar sesión», which returns to the
 * requested address; drafts live above the routes, so nothing is lost on the way.
 */
export function RequireSession({ children }: { children: ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <main className="page" id="app-content"><p className="status-message" role="status">{t('projects.sessionLoading')}</p></main>;
  if (status !== 'signed-in') return <Navigate to={ROUTES.signIn} replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  return <>{children}</>;
}

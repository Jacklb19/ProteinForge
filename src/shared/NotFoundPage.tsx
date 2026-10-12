import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { PageHeading } from './PageHeading';
import { ROUTES } from './navigation';

/** Recovery page for addresses that do not match a tool. */
export function NotFoundPage(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="page not-found-page">
      <PageHeading titleKey="notFound.title" introduction="notFound.text" />
      <div className="hero-actions">
        <Link className="button button-primary" to={ROUTES.analyze}>{t('notFound.action')}</Link>
        <Link className="button button-secondary" to={ROUTES.home}>{t('notFound.home')}</Link>
      </div>
    </main>
  );
}

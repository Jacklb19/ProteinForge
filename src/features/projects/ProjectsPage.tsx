import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { ProjectLibrary } from './ProjectLibrary';

export function ProjectsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  return <main className="page projects-page">
    <PageHeading titleKey="projects.title" introduction="projects.introduction"><Link className="button button-primary" to={ROUTES.analyze}>{t('projects.begin')}</Link></PageHeading>
    <ProjectLibrary key={auth.session?.user.id ?? auth.status} />
  </main>;
}

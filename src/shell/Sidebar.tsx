import { useContext } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useAuth } from '../features/auth/authContext';
import { BrandMark } from '../shared/BrandMark';
import { Icon } from '../shared/Icon';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS, ROUTES } from '../shared/navigation';
import { PreferenceControls } from './Preferences';
import { ProjectContext } from '../features/projects/projectContext';
import { SyncStatus } from '../features/projects/ProjectSync';

interface Props {
  /** `rail` is the desktop column; `sheet` is the same content inside the phone menu. */
  variant: 'rail' | 'sheet';
  compact?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

/** Signed-in identity: a plain link to the account page, which holds every setting and the session. */
function AccountLink({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }): React.JSX.Element | null {
  const { t } = useTranslation();
  const { session } = useAuth();
  if (!session) return null;
  const email = session.user.email;
  return <div className="account-area">
    <NavLink className="sidebar-link account-link" to={ROUTES.profile} onClick={onNavigate}>
      <span className="avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
      <span className={compact ? 'sidebar-label is-tooltip' : 'sidebar-label account-copy'}><strong>{t('settings.account')}</strong><small>{email}</small></span>
    </NavLink>
  </div>;
}

/** Laboratory navigation: grouped tools, help and the session; a visitor without one also finds language and theme. */
export function SidebarContent({ variant, compact = false, onToggle, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  const offline = useContext(ProjectContext)?.connection === 'offline';
  const label = (text: string): React.JSX.Element => <span className={compact ? 'sidebar-label is-tooltip' : 'sidebar-label'}>{text}</span>;
  const groups = NAVIGATION_GROUPS
    .map(group => ({ ...group, items: NAVIGATION_ITEMS.filter(item => item.group === group.id && (!item.signedInOnly || status === 'signed-in')) }))
    .filter(group => group.items.length > 0);

  return <>
    <div className="sidebar-head">
      <Link to={ROUTES.home} className="brand" aria-label={t('shell.home')} onClick={onClose}><BrandMark /><span className="brand-name">{t('app.name')}</span></Link>
      {variant === 'rail'
        ? <button className="button button-icon sidebar-toggle" type="button" aria-label={t(compact ? 'shell.expandSidebar' : 'shell.collapseSidebar')} onClick={onToggle}>
          <Icon name={compact ? 'expand' : 'collapse'} />
        </button>
        : <button className="button button-icon" type="button" aria-label={t('shell.closeMenu')} onClick={onClose} data-autofocus><Icon name="close" /></button>}
    </div>
    <nav className="sidebar-nav" aria-label={t('nav.main')}>
      {groups.map(group => <div className="sidebar-group" key={group.id}>
        <p className="sidebar-group-label" aria-hidden={compact || undefined}>{t(group.labelKey)}</p>
        <ul>
          {group.items.map(item => <li key={item.path}>
            <NavLink className="sidebar-link" to={item.path} end={item.end} onClick={onClose}><Icon name={item.icon} />{label(t(item.labelKey))}</NavLink>
          </li>)}
        </ul>
      </div>)}
    </nav>
    <div className="sidebar-foot">
      <NavLink className="sidebar-link" to={ROUTES.guide} onClick={onClose}><Icon name="help" />{label(t('nav.guide'))}</NavLink>
      <SyncStatus compact={compact} onNavigate={onClose} />
      {status === 'signed-in'
        ? <AccountLink compact={compact} onNavigate={onClose} />
        : status === 'loading' ? null
          : <>
            <PreferenceControls className="sidebar-prefs" compact={compact} />
            <div className="sidebar-guest">
              {!compact && <p>{t(offline ? 'sync.guestOffline' : 'shell.guestNote')}</p>}
              <Link className="sidebar-link" to={ROUTES.signIn} onClick={onClose}><Icon name="user" />{label(t('shell.signIn'))}</Link>
              {status !== 'disabled' && !compact && <Link className="button button-primary" to={ROUTES.signUp} onClick={onClose}>{t('auth.signUpAction')}</Link>}
            </div>
          </>}
    </div>
  </>;
}

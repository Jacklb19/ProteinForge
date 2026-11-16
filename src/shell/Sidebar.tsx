import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useAuth } from '../features/auth/authContext';
import { BrandMark } from '../shared/BrandMark';
import { Icon } from '../shared/Icon';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS, ROUTES } from '../shared/navigation';
import { SyncStatus } from '../features/projects/ProjectSync';
import { paletteShortcut } from './paletteEntries';

interface Props {
  /** `rail` is the desktop column; `sheet` is the same content inside the phone menu. */
  variant: 'rail' | 'sheet';
  compact?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  /** Opens the dialog that reaches any tool or project by name. */
  onPalette?: () => void;
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

/** Laboratory navigation: grouped tools, help, the save status and the account; the laboratory needs a session. */
export function SidebarContent({ variant, compact = false, onToggle, onClose, onPalette }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const label = (text: string): React.JSX.Element => <span className={compact ? 'sidebar-label is-tooltip' : 'sidebar-label'}>{text}</span>;
  const groups = NAVIGATION_GROUPS.map(group => ({ ...group, items: NAVIGATION_ITEMS.filter(item => item.group === group.id) }));
  const shortcut = paletteShortcut(navigator.platform);

  return <>
    <div className="sidebar-head">
      <Link to={ROUTES.home} className="brand" aria-label={t('shell.home')} onClick={onClose}><BrandMark /><span className="brand-name">{t('app.name')}</span></Link>
      {variant === 'rail'
        ? <button className="button button-icon sidebar-toggle" type="button" aria-label={t(compact ? 'shell.expandSidebar' : 'shell.collapseSidebar')} onClick={onToggle}>
          <Icon name={compact ? 'panelOpen' : 'panelClose'} />
        </button>
        : <button className="button button-icon" type="button" aria-label={t('shell.closeMenu')} onClick={onClose} data-autofocus><Icon name="close" /></button>}
    </div>
    {/* On the desktop rail "Go to…" sits at the top, drawn like a field, with its shortcut; the phone menu keeps it in the foot. */}
    {variant === 'rail' && onPalette && <button className="sidebar-link palette-trigger" type="button" aria-haspopup="dialog" aria-keyshortcuts={shortcut.aria} onClick={onPalette}>
      <Icon name="search" />{label(t('palette.open'))}<kbd className="palette-shortcut" aria-hidden="true">{shortcut.label}</kbd>
    </button>}
    <nav className="sidebar-nav" aria-label={t('nav.main')}>
      {groups.map(group => <div className="sidebar-group" key={group.id}>
        <p className="sidebar-group-label" aria-hidden={compact || undefined}>{t(group.labelKey)}</p>
        <ul>
          {group.items.map(item => <li key={item.path}>
            <NavLink className="sidebar-link" to={item.path} end={item.end} onClick={onClose} viewTransition><Icon name={item.icon} />{label(t(item.labelKey))}</NavLink>
          </li>)}
        </ul>
      </div>)}
    </nav>
    <div className="sidebar-foot">
      {variant === 'sheet' && onPalette && <button className="sidebar-link" type="button" aria-haspopup="dialog" onClick={onPalette}><Icon name="search" />{label(t('palette.open'))}</button>}
      <SyncStatus compact={compact} onNavigate={onClose} />
      <AccountLink compact={compact} onNavigate={onClose} />
    </div>
  </>;
}

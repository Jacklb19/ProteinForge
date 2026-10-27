import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useAuth } from '../features/auth/authContext';
import { BrandMark } from '../shared/BrandMark';
import { Icon } from '../shared/Icon';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS, ROUTES } from '../shared/navigation';
import { PreferencesMenu } from './Preferences';

interface Props {
  /** `rail` is the desktop column; `sheet` is the same content inside the phone menu. */
  variant: 'rail' | 'sheet';
  compact?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

/** Signed-in identity and the session actions; the menu closes on Escape or outside it. */
function AccountMenu({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }): React.JSX.Element | null {
  const { t } = useTranslation();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent): void => { if (!area.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('pointerdown', close); };
  }, [open]);
  if (!auth.session) return null;
  const email = auth.session.user.email;
  const leave = (): void => { setOpen(false); onNavigate?.(); };
  return <div className="account-area" ref={area} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} className="sidebar-link account-trigger" type="button" aria-expanded={open} aria-controls={menuId}
      onClick={() => { setOpen(value => !value); }}>
      <span className="avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
      <span className={compact ? 'sidebar-label is-tooltip' : 'sidebar-label account-copy'}><strong>{t('settings.account')}</strong><small>{email}</small></span>
    </button>
    <div className="account-menu" id={menuId} hidden={!open}>
      <Link className="sidebar-link" to={ROUTES.profile} onClick={leave}><Icon name="user" /><span className="sidebar-label">{t('workbench.account')}</span></Link>
      <Link className="sidebar-link" to={ROUTES.home} onClick={leave}><Icon name="globe" /><span className="sidebar-label">{t('shell.publicSite')}</span></Link>
      <button className="sidebar-link" type="button" onClick={() => { leave(); void auth.signOut(); }}><Icon name="arrow" /><span className="sidebar-label">{t('settings.signOut')}</span></button>
    </div>
  </div>;
}

/** Laboratory navigation: grouped tools, help, preferences and the session, in that order. */
export function SidebarContent({ variant, compact = false, onToggle, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
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
      <PreferencesMenu placement="above" compact={compact} />
      {status === 'signed-in'
        ? <AccountMenu compact={compact} onNavigate={onClose} />
        : status === 'loading' ? null
          : <div className="sidebar-guest">
            {!compact && <p>{t('shell.guestNote')}</p>}
            <Link className="sidebar-link" to={ROUTES.signIn} onClick={onClose}><Icon name="user" />{label(t('shell.signIn'))}</Link>
            {status !== 'disabled' && !compact && <Link className="button button-primary" to={ROUTES.signUp} onClick={onClose}>{t('auth.signUpAction')}</Link>}
          </div>}
    </div>
  </>;
}

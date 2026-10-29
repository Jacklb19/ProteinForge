import { useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { LOCALES } from '../i18n/config';
import { usePreferences } from '../preferences/usePreferences';
import { LOCALE_LABEL_KEYS, THEMES, THEME_LABEL_KEYS } from '../preferences/config';
import { Icon } from '../shared/Icon';
import { SegmentedControl } from '../shared/SegmentedControl';

/** Appearance and language: the same two choices wherever preferences appear. */
export function PreferencesFields(): React.JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme, chosenLocale, setLocale } = usePreferences();
  return <div className="preferences-fields">
    <SegmentedControl legend={t('account.appearance')} options={THEMES.map(value => ({ value, label: t(THEME_LABEL_KEYS[value]) }))} value={theme} onChange={setTheme} />
    <SegmentedControl legend={t('shell.languageLabel')} options={LOCALES.map(value => ({ value, label: t(LOCALE_LABEL_KEYS[value]) }))} value={chosenLocale} onChange={setLocale} />
  </div>;
}

interface Props {
  /** Where the panel opens from: below a header button or above a sidebar entry. */
  placement: 'below' | 'above';
  /** Compact sidebars keep the name for assistive technology and show it on hover or focus. */
  compact?: boolean;
}

/** Disclosure that groups appearance and language; it closes on Escape or outside the panel. */
export function PreferencesMenu({ placement, compact = false }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent): void => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('pointerdown', close); };
  }, []);
  return <details className={`preferences-menu preferences-${placement}`} ref={menu} onKeyDown={event => {
    if (event.key === 'Escape' && menu.current?.open) { event.preventDefault(); event.stopPropagation(); menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
  }}>
    <summary className="sidebar-link"><Icon name="settings" /><span className={compact ? 'sidebar-label is-tooltip' : 'sidebar-label'}>{t('workbench.preferences')}</span></summary>
    <div className="preferences-popover">
      <p className="preferences-title">{t('workbench.preferences')}</p>
      <PreferencesFields />
    </div>
  </details>;
}

import { useTranslation } from '../i18n';
import { LOCALES } from '../i18n/config';
import { usePreferences } from '../preferences/usePreferences';
import { usePrefersDark } from '../preferences/usePrefersDark';
import { LOCALE_LABEL_KEYS, LOCALE_SHORT_LABEL_KEYS, THEME_TOGGLE_ICONS, THEME_TOGGLE_LABEL_KEYS } from '../preferences/config';
import { toggledTheme } from '../preferences/theme';
import { Icon } from '../shared/Icon';

interface Props {
  /** Compact sidebars stack the controls as icon-sized entries whose names appear on hover or focus. */
  compact?: boolean;
}

/**
 * ES / EN: one short button per language, the full name being its accessible name. A compact sidebar
 * keeps a single button that switches to the other language.
 */
export function LanguageSwitch({ compact = false }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { chosenLocale, setLocale } = usePreferences();
  if (compact) {
    const other = LOCALES.find(locale => locale !== chosenLocale) ?? chosenLocale;
    return <button className="sidebar-link" type="button" lang={other} aria-label={t(LOCALE_LABEL_KEYS[other])} onClick={() => { setLocale(other); }}>
      <span aria-hidden="true">{t(LOCALE_SHORT_LABEL_KEYS[other])}</span>
      <span className="sidebar-label is-tooltip" aria-hidden="true">{t(LOCALE_LABEL_KEYS[other])}</span>
    </button>;
  }
  return <div className="text-switch" role="group" aria-label={t('shell.languageLabel')}>
    {LOCALES.map(locale => <button key={locale} type="button" lang={locale} aria-pressed={locale === chosenLocale}
      aria-label={t(LOCALE_LABEL_KEYS[locale])} onClick={() => { setLocale(locale); }}>{t(LOCALE_SHORT_LABEL_KEYS[locale])}</button>)}
  </div>;
}

/** One button that flips the appearance shown; a `system` choice is resolved through the device first. */
export function ThemeToggle({ compact = false }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = usePreferences();
  const target = toggledTheme(theme, usePrefersDark());
  const name = t(THEME_TOGGLE_LABEL_KEYS[target]);
  const choose = (): void => { setTheme(target); };
  if (compact) {
    return <button className="sidebar-link" type="button" onClick={choose}>
      <Icon name={THEME_TOGGLE_ICONS[target]} /><span className="sidebar-label is-tooltip">{name}</span>
    </button>;
  }
  return <button className="button button-icon" type="button" aria-label={name} onClick={choose}><Icon name={THEME_TOGGLE_ICONS[target]} /></button>;
}

/** Language and theme side by side, wherever a frame offers them. */
export function PreferenceControls({ className, compact = false }: Props & { className: string }): React.JSX.Element {
  return <div className={className}><LanguageSwitch compact={compact} /><ThemeToggle compact={compact} /></div>;
}

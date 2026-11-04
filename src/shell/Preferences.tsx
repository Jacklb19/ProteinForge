import { useTranslation } from '../i18n';
import { LOCALES } from '../i18n/config';
import { usePreferences } from '../preferences/usePreferences';
import { usePrefersDark } from '../preferences/usePrefersDark';
import { LOCALE_LABEL_KEYS, LOCALE_SHORT_LABEL_KEYS, THEME_TOGGLE_ICONS, THEME_TOGGLE_LABEL_KEYS } from '../preferences/config';
import { toggledTheme } from '../preferences/theme';
import { Icon } from '../shared/Icon';

/** ES / EN: one short button per language, the full name being its accessible name. */
export function LanguageSwitch(): React.JSX.Element {
  const { t } = useTranslation();
  const { chosenLocale, setLocale } = usePreferences();
  return <div className="text-switch" role="group" aria-label={t('shell.languageLabel')}>
    {LOCALES.map(locale => <button key={locale} type="button" lang={locale} aria-pressed={locale === chosenLocale}
      aria-label={t(LOCALE_LABEL_KEYS[locale])} onClick={() => { setLocale(locale); }}>{t(LOCALE_SHORT_LABEL_KEYS[locale])}</button>)}
  </div>;
}

/** One button that flips the appearance shown; a `system` choice is resolved through the device first. */
export function ThemeToggle(): React.JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = usePreferences();
  const target = toggledTheme(theme, usePrefersDark());
  return <button className="button button-icon" type="button" aria-label={t(THEME_TOGGLE_LABEL_KEYS[target])} onClick={() => { setTheme(target); }}><Icon name={THEME_TOGGLE_ICONS[target]} /></button>;
}

/** Language and theme side by side, in the public bar and its phone menu; signed in, they live on the profile. */
export function PreferenceControls({ className }: { className: string }): React.JSX.Element {
  return <div className={className}><LanguageSwitch /><ThemeToggle /></div>;
}

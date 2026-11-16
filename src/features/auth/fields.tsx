import { useId, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, PASSWORD_RULES } from './config';

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  errorKey?: TranslationKey;
  help?: string;
  disabled?: boolean;
  type?: 'email' | 'text';
  /** Keyboard to offer on touch screens, such as `numeric` for a code. */
  inputMode?: 'numeric' | 'email' | 'text';
  maxLength?: number;
  /** Extra class of the input, such as the wide digits of a code. */
  inputClassName?: string;
}

/** Labelled text input with its validation message linked for assistive technology. */
export function TextField({ id, label, value, onChange, autoComplete, errorKey, help, disabled, type = 'text', inputMode, maxLength, inputClassName }: FieldProps): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const helpId = useId();
  const errorId = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={inputClassName ? `text-input ${inputClassName}` : 'text-input'}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={errorKey ? true : undefined}
        aria-describedby={[help ? helpId : '', errorKey ? errorId : ''].filter(Boolean).join(' ') || undefined}
        onChange={(event) => { onChange(event.target.value); }}
      />
      {help && <p id={helpId} className="field-help">{help}</p>}
      {errorKey && <p id={errorId} className="field-error" role="alert">{t(errorKey, { count: formatNumber(PASSWORD_MIN_LENGTH), max: formatNumber(PASSWORD_MAX_BYTES) })}</p>}
    </div>
  );
}

/** What a new password still needs, checked on every keystroke; each rule says whether it is met. */
export function PasswordRequirements({ id, value }: { id: string; value: string }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const met = PASSWORD_RULES.map((rule) => rule.test(value));
  const strength = met.filter(Boolean).length;
  return (
    <div className="password-rules" id={id}>
      {/* The strength bar appears with the first character; the rules are there from the start. */}
      {value && <div className="password-strength" data-strength={strength} aria-hidden="true">
        {PASSWORD_RULES.map((rule, index) => <span key={rule.id} data-filled={index < strength} />)}
      </div>}
      <ul>
        {PASSWORD_RULES.map((rule, index) => <li key={rule.id} data-met={met[index]}>
          <Icon name={met[index] ? 'check' : 'dot'} />
          <span>{t(rule.labelKey, { count: formatNumber(PASSWORD_MIN_LENGTH) })}</span>
          <span className="visually-hidden">{t(met[index] ? 'auth.ruleMet' : 'auth.ruleMissing')}</span>
        </li>)}
      </ul>
    </div>
  );
}

interface PasswordFieldProps extends Omit<FieldProps, 'type' | 'inputMode' | 'maxLength' | 'inputClassName'> {
  /** A new password: list its requirements live instead of a fixed help line. */
  requirements?: boolean;
}

/** Password input with a visibility toggle that keeps a 44 px target. */
export function PasswordField({ id, label, value, onChange, autoComplete, errorKey, help, disabled, requirements = false }: PasswordFieldProps): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const [visible, setVisible] = useState(false);
  // The rules open when the field is first used and stay open, so the form starts short.
  const [engaged, setEngaged] = useState(false);
  const helpId = useId();
  const errorId = useId();
  const rulesId = useId();
  const showRules = requirements && (engaged || value !== '');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          id={id}
          className="text-input"
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={errorKey ? true : undefined}
          aria-describedby={[help ? helpId : '', showRules ? rulesId : '', errorKey ? errorId : ''].filter(Boolean).join(' ') || undefined}
          onFocus={() => { setEngaged(true); }}
          onChange={(event) => { onChange(event.target.value); }}
        />
        <button
          className="button button-icon"
          type="button"
          aria-pressed={visible}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          onClick={() => { setVisible((current) => !current); }}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      </div>
      {help && <p id={helpId} className="field-help">{help}</p>}
      {showRules && <PasswordRequirements id={rulesId} value={value} />}
      {errorKey && <p id={errorId} className="field-error" role="alert">{t(errorKey, { count: formatNumber(PASSWORD_MIN_LENGTH), max: formatNumber(PASSWORD_MAX_BYTES) })}</p>}
    </div>
  );
}

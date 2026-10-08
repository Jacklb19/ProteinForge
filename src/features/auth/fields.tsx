import { useId, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Icon } from '../../shared/Icon';
import { PASSWORD_MIN_LENGTH } from './config';

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
}

/** Labelled text input with its validation message linked for assistive technology. */
export function TextField({ id, label, value, onChange, autoComplete, errorKey, help, disabled, type = 'text' }: FieldProps): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const helpId = useId();
  const errorId = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="text-input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={errorKey ? true : undefined}
        aria-describedby={[help ? helpId : '', errorKey ? errorId : ''].filter(Boolean).join(' ') || undefined}
        onChange={(event) => { onChange(event.target.value); }}
      />
      {help && <p id={helpId} className="field-help">{help}</p>}
      {errorKey && <p id={errorId} className="field-error" role="alert">{t(errorKey, { count: formatNumber(PASSWORD_MIN_LENGTH) })}</p>}
    </div>
  );
}

/** Password input with a visibility toggle that keeps a 44 px target. */
export function PasswordField({ id, label, value, onChange, autoComplete, errorKey, help, disabled }: Omit<FieldProps, 'type'>): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const [visible, setVisible] = useState(false);
  const helpId = useId();
  const errorId = useId();
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
          aria-describedby={[help ? helpId : '', errorKey ? errorId : ''].filter(Boolean).join(' ') || undefined}
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
      {errorKey && <p id={errorId} className="field-error" role="alert">{t(errorKey, { count: formatNumber(PASSWORD_MIN_LENGTH) })}</p>}
    </div>
  );
}

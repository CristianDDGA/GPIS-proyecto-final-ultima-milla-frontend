import type { ChangeEventHandler, FC, FocusEventHandler, HTMLInputTypeAttribute } from 'react';
import { AlertCircleIcon } from './AuthIcons.js';

export interface AuthTextFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly type?: HTMLInputTypeAttribute | undefined;
  readonly inputMode?: 'text' | 'email' | 'numeric' | undefined;
  readonly autoComplete?: string | undefined;
  readonly pattern?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly value: string;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly onBlur: FocusEventHandler<HTMLInputElement>;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly isRequired?: boolean | undefined;
  readonly maxLength?: number | undefined;
  readonly spellCheck?: boolean | undefined;
  readonly isOtp?: boolean | undefined;
}

/** Campo de entrada estilizado para la tarjeta Liquid Glass con validación accesible inline. */
export const AuthTextField: FC<AuthTextFieldProps> = ({
  id,
  name,
  label,
  type = 'text',
  inputMode,
  autoComplete,
  pattern,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  isRequired = false,
  maxLength,
  spellCheck,
  isOtp = false,
}) => {
  const errorId = `${id}-error`;

  return (
    <div className="mlg-field">
      <label htmlFor={id} className="mlg-label">
        <span>{label}</span>
        {isRequired && (
          <span className="mlg-required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        pattern={pattern}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        maxLength={maxLength}
        spellCheck={spellCheck}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={
          'mlg-input' +
          (isOtp ? ' mlg-input--otp' : '') +
          (error ? ' mlg-input--error' : '')
        }
      />

      {error && (
        <p id={errorId} role="alert" className="mlg-field-error">
          <AlertCircleIcon className="mlg-field-error__icon" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

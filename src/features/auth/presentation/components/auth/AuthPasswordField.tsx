import {
  useState,
  type ChangeEventHandler,
  type FC,
  type FocusEventHandler,
  type KeyboardEvent,
} from 'react';
import { AlertCircleIcon } from './AuthIcons.js';

export interface AuthPasswordFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly autoComplete: string;
  readonly placeholder?: string | undefined;
  readonly visible: boolean;
  readonly onToggleVisible: () => void;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly onBlur: FocusEventHandler<HTMLInputElement>;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly isRequired?: boolean | undefined;
}

/**
 * Campo de contraseña accesible Liquid Glass con indicador de Bloq Mayús
 * y botón integrado Mostrar / Ocultar.
 */
export const AuthPasswordField: FC<AuthPasswordFieldProps> = ({
  id,
  name,
  label,
  value,
  autoComplete,
  placeholder = 'Mínimo 8 caracteres',
  visible,
  onToggleVisible,
  onChange,
  onBlur,
  error,
  disabled = false,
  isRequired = true,
}) => {
  const [capsLockOn, setCapsLockOn] = useState(false);
  const errorId = `${id}-error`;

  const handleKeyState = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  };

  return (
    <div className="mlg-field">
      <div className="mlg-label-row">
        <label htmlFor={id} className="mlg-label">
          <span>{label}</span>
          {isRequired && (
            <span className="mlg-required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>

        {capsLockOn && (
          <span aria-live="polite" className="mlg-capslock-badge">
            Bloq Mayús
          </span>
        )}
      </div>

      <div className="mlg-input-wrap">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyState}
          onKeyUp={handleKeyState}
          onBlur={(event) => {
            setCapsLockOn(false);
            onBlur(event);
          }}
          minLength={8}
          maxLength={128}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={
            'mlg-input mlg-input--password' + (error ? ' mlg-input--error' : '')
          }
        />

        <button
          type="button"
          className="mlg-password-toggle"
          onClick={onToggleVisible}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          disabled={disabled}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="mlg-field-error">
          <AlertCircleIcon className="mlg-field-error__icon" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

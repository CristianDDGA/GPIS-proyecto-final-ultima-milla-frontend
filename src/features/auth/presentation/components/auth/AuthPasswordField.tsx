import type { ChangeEventHandler, FC, FocusEventHandler } from 'react';

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
 * Campo de contraseña accesible con botón de visibilidad integrado en el
 * contenedor de entrada para evitar desalineaciones con etiquetas o errores.
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
  const errorId = `${id}-error`;

  return (
    <div className={`ui-input-field wf-password-field ${error ? 'ui-input-field--error' : ''}`}>
      <label htmlFor={id} className="ui-input-label">
        {label}
        {isRequired && (
          <span className="ui-input-required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      <div className="wf-input-wrap">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          maxLength={128}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="ui-input-control wf-input-wrap__control"
        />

        <button
          type="button"
          className="wf-password-toggle"
          onClick={onToggleVisible}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          disabled={disabled}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {error && (
        <p id={errorId} className="ui-input-message ui-input-message--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

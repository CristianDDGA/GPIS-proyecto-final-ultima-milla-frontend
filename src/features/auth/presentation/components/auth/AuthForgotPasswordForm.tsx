import type { FC, FormEvent } from 'react';
import { AuthTextField } from './AuthTextField.js';

export interface AuthForgotPasswordFormProps {
  readonly email: string;
  readonly onEmailChange: (value: string) => void;
  readonly onClearError: () => void;
  readonly onMarkTouched: (field: string) => void;
  readonly errorFor: (field: string) => string | undefined;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly isSubmitting: boolean;
}

export const AuthForgotPasswordForm: FC<AuthForgotPasswordFormProps> = ({
  email,
  onEmailChange,
  onClearError,
  onMarkTouched,
  errorFor,
  onSubmit,
  isSubmitting,
}) => (
  <form id="auth-panel-forgot" className="mlg-form" onSubmit={onSubmit} noValidate>
    <AuthTextField
      id="auth-forgot-email"
      label="Correo electrónico"
      type="email"
      inputMode="email"
      name="email"
      autoComplete="email"
      spellCheck={false}
      placeholder="usuario@millast.ec"
      value={email}
      onChange={(event) => {
        onEmailChange(event.target.value);
        onClearError();
      }}
      onBlur={() => onMarkTouched('email')}
      error={errorFor('email')}
      isRequired
      maxLength={254}
      disabled={isSubmitting}
    />

    <button type="submit" disabled={isSubmitting} className="mlg-submit-btn">
      {isSubmitting && <span className="mlg-spinner" aria-hidden="true" />}
      <span>{isSubmitting ? 'Enviando...' : 'Enviar código'}</span>
    </button>
  </form>
);

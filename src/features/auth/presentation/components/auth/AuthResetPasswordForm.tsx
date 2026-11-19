import { useState, type FC, type FormEvent } from 'react';
import type { PasswordStrength } from '../../../domain/index.js';
import { AuthPasswordField } from './AuthPasswordField.js';
import { AuthTextField } from './AuthTextField.js';
import { PasswordStrengthMeter } from './PasswordStrengthMeter.js';

export interface AuthResetPasswordFormProps {
  readonly email: string;
  readonly code: string;
  readonly newPassword: string;
  readonly strength: PasswordStrength;
  readonly onEmailChange: (value: string) => void;
  readonly onCodeChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onClearError: () => void;
  readonly onMarkTouched: (field: string) => void;
  readonly errorFor: (field: string) => string | undefined;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly isSubmitting: boolean;
}

export const AuthResetPasswordForm: FC<AuthResetPasswordFormProps> = ({
  email,
  code,
  newPassword,
  strength,
  onEmailChange,
  onCodeChange,
  onPasswordChange,
  onClearError,
  onMarkTouched,
  errorFor,
  onSubmit,
  isSubmitting,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form id="auth-panel-reset" className="mlg-form" onSubmit={onSubmit} noValidate>
      <AuthTextField
        id="auth-reset-email"
        label="Correo electrónico"
        type="email"
        inputMode="email"
        name="email"
        autoComplete="username"
        spellCheck={false}
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

      <AuthTextField
        id="auth-reset-code"
        label="Código de recuperación"
        type="text"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        placeholder="000000"
        value={code}
        onChange={(event) => {
          onCodeChange(event.target.value.replace(/\D/gu, '').slice(0, 6));
          onClearError();
        }}
        onBlur={() => onMarkTouched('code')}
        error={errorFor('code')}
        isRequired
        isOtp
        maxLength={6}
        disabled={isSubmitting}
      />

      <AuthPasswordField
        id="auth-reset-password"
        name="newPassword"
        label="Nueva contraseña"
        value={newPassword}
        autoComplete="new-password"
        visible={showPassword}
        onToggleVisible={() => setShowPassword((previous) => !previous)}
        onChange={(event) => {
          onPasswordChange(event.target.value);
          onClearError();
        }}
        onBlur={() => onMarkTouched('newPassword')}
        error={errorFor('newPassword')}
        disabled={isSubmitting}
      />

      {newPassword.length > 0 && <PasswordStrengthMeter strength={strength} />}

      <button type="submit" disabled={isSubmitting} className="mlg-submit-btn">
        {isSubmitting && <span className="mlg-spinner" aria-hidden="true" />}
        <span>{isSubmitting ? 'Actualizando...' : 'Restablecer contraseña'}</span>
      </button>
    </form>
  );
};

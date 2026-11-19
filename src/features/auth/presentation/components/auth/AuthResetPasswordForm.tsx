import { useState, type FC, type FormEvent } from 'react';
import type { PasswordStrength } from '../../../domain/index.js';
import { Button, TextInput } from '../../../../../shared/ui/index.js';
import { AuthPasswordField } from './AuthPasswordField.js';
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
    <form id="auth-panel-reset" className="wf-auth-form" onSubmit={onSubmit} noValidate>
      <TextInput
        id="auth-reset-email"
        label="Correo electrónico"
        type="email"
        name="email"
        autoComplete="username"
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

      <TextInput
        id="auth-reset-code"
        className="wf-code-field"
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

      <div className="wf-form-actions">
        <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
          Restablecer contraseña
        </Button>
      </div>
    </form>
  );
};

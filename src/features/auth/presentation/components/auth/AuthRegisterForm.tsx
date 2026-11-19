import { useState, type FC, type FormEvent } from 'react';
import type { PasswordStrength } from '../../../domain/index.js';
import { Button, TextInput } from '../../../../../shared/ui/index.js';
import { AuthPasswordField } from './AuthPasswordField.js';
import { PasswordStrengthMeter } from './PasswordStrengthMeter.js';

export interface AuthRegisterFormProps {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly strength: PasswordStrength;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onDisplayNameChange: (value: string) => void;
  readonly onClearError: () => void;
  readonly onMarkTouched: (field: string) => void;
  readonly errorFor: (field: string) => string | undefined;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly isSubmitting: boolean;
}

export const AuthRegisterForm: FC<AuthRegisterFormProps> = ({
  email,
  password,
  displayName,
  strength,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onClearError,
  onMarkTouched,
  errorFor,
  onSubmit,
  isSubmitting,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      id="auth-panel-register"
      role="tabpanel"
      aria-labelledby="auth-tab-register"
      className="wf-auth-form"
      onSubmit={onSubmit}
      noValidate
    >
      <TextInput
        id="auth-register-email"
        label="Correo electrónico"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="cliente@millast.ec"
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

      <AuthPasswordField
        id="auth-register-password"
        name="password"
        label="Contraseña"
        value={password}
        autoComplete="new-password"
        visible={showPassword}
        onToggleVisible={() => setShowPassword((previous) => !previous)}
        onChange={(event) => {
          onPasswordChange(event.target.value);
          onClearError();
        }}
        onBlur={() => onMarkTouched('password')}
        error={errorFor('password')}
        disabled={isSubmitting}
      />

      {password.length > 0 && <PasswordStrengthMeter strength={strength} />}

      <TextInput
        id="auth-register-display-name"
        label="Nombre para mostrar (opcional)"
        type="text"
        name="displayName"
        autoComplete="name"
        placeholder="Ej. Ana Paredes"
        value={displayName}
        onChange={(event) => {
          onDisplayNameChange(event.target.value);
          onClearError();
        }}
        onBlur={() => onMarkTouched('displayName')}
        error={errorFor('displayName')}
        maxLength={120}
        disabled={isSubmitting}
      />

      <div className="wf-form-actions">
        <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
          Crear cuenta
        </Button>
      </div>
    </form>
  );
};

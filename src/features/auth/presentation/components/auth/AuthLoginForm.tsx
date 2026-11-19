import { useState, type FC, type FormEvent } from 'react';
import { Button, TextInput } from '../../../../../shared/ui/index.js';
import { AuthPasswordField } from './AuthPasswordField.js';

export interface AuthLoginFormProps {
  readonly email: string;
  readonly password: string;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onClearError: () => void;
  readonly onMarkTouched: (field: string) => void;
  readonly errorFor: (field: string) => string | undefined;
  readonly onOpenForgotPassword: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly isSubmitting: boolean;
}

export const AuthLoginForm: FC<AuthLoginFormProps> = ({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onClearError,
  onMarkTouched,
  errorFor,
  onOpenForgotPassword,
  onSubmit,
  isSubmitting,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      id="auth-panel-login"
      role="tabpanel"
      aria-labelledby="auth-tab-login"
      className="wf-auth-form"
      onSubmit={onSubmit}
      noValidate
    >
      <TextInput
        id="auth-login-email"
        label="Correo electrónico"
        type="email"
        name="email"
        autoComplete="username"
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

      <div className="wf-password-group">
        <AuthPasswordField
          id="auth-login-password"
          name="password"
          label="Contraseña"
          value={password}
          autoComplete="current-password"
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

        <button
          type="button"
          className="wf-forgot-link"
          onClick={onOpenForgotPassword}
          disabled={isSubmitting}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <div className="wf-form-actions">
        <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
          Entrar al sistema
        </Button>
      </div>
    </form>
  );
};

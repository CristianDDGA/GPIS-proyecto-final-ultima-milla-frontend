import { useState, type FC, type FormEvent } from 'react';
import { AuthPasswordField } from './AuthPasswordField.js';
import { AuthTextField } from './AuthTextField.js';
import { GoogleSignInButton } from './GoogleSignInButton.js';

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
  readonly onGoogleCredential?: ((idToken: string) => void) | undefined;
  readonly googleDisabledByServer?: boolean | undefined;
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
  onGoogleCredential,
  googleDisabledByServer = false,
  isSubmitting,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      id="auth-panel-login"
      role="tabpanel"
      aria-labelledby="auth-tab-login"
      className="mlg-form"
      onSubmit={onSubmit}
      noValidate
    >
      <AuthTextField
        id="auth-login-email"
        label="Correo electrónico"
        type="email"
        inputMode="email"
        name="email"
        autoComplete="username"
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

      <div className="mlg-forgot-row">
        <button
          type="button"
          className="mlg-forgot-link"
          onClick={onOpenForgotPassword}
          disabled={isSubmitting}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <button type="submit" disabled={isSubmitting} className="mlg-submit-btn">
        {isSubmitting && <span className="mlg-spinner" aria-hidden="true" />}
        <span>{isSubmitting ? 'Verificando...' : 'Entrar al sistema'}</span>
      </button>

      {onGoogleCredential !== undefined && (
        <GoogleSignInButton
          disabled={isSubmitting}
          hidden={googleDisabledByServer}
          onCredential={onGoogleCredential}
        />
      )}
    </form>
  );
};

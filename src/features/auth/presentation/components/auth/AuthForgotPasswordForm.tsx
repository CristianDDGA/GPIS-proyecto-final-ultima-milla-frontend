import type { FC, FormEvent } from 'react';
import { Button, TextInput } from '../../../../../shared/ui/index.js';

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
  <form id="auth-panel-forgot" className="wf-auth-form" onSubmit={onSubmit} noValidate>
    <TextInput
      id="auth-forgot-email"
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

    <div className="wf-form-actions">
      <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
        Enviar código
      </Button>
    </div>
  </form>
);

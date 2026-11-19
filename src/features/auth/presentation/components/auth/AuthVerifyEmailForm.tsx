import type { FC, FormEvent } from 'react';
import { AuthTextField } from './AuthTextField.js';

export interface AuthVerifyEmailFormProps {
  readonly code: string;
  readonly onCodeChange: (value: string) => void;
  readonly onClearError: () => void;
  readonly onMarkTouched: (field: string) => void;
  readonly errorFor: (field: string) => string | undefined;
  readonly resendCooldown: number;
  readonly onResend: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly isSubmitting: boolean;
}

export const AuthVerifyEmailForm: FC<AuthVerifyEmailFormProps> = ({
  code,
  onCodeChange,
  onClearError,
  onMarkTouched,
  errorFor,
  resendCooldown,
  onResend,
  onSubmit,
  isSubmitting,
}) => (
  <form id="auth-panel-verify" className="mlg-form" onSubmit={onSubmit} noValidate>
    <AuthTextField
      id="auth-verify-code"
      label="Código de verificación"
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

    <div className="mlg-actions">
      <button type="submit" disabled={isSubmitting} className="mlg-submit-btn">
        {isSubmitting && <span className="mlg-spinner" aria-hidden="true" />}
        <span>{isSubmitting ? 'Verificando...' : 'Confirmar código'}</span>
      </button>

      <button
        type="button"
        className="mlg-secondary-btn"
        onClick={onResend}
        disabled={resendCooldown > 0 || isSubmitting}
      >
        {resendCooldown > 0 ? `Reenviar en ${resendCooldown} s` : 'Reenviar código'}
      </button>
    </div>
  </form>
);

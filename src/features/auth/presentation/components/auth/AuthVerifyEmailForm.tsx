import type { FC, FormEvent } from 'react';
import { Button, TextInput } from '../../../../../shared/ui/index.js';

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
  <form id="auth-panel-verify" className="wf-auth-form" onSubmit={onSubmit} noValidate>
    <TextInput
      id="auth-verify-code"
      className="wf-code-field"
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
      maxLength={6}
      disabled={isSubmitting}
    />

    <div className="wf-form-actions">
      <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
        Confirmar código
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onResend}
        disabled={resendCooldown > 0 || isSubmitting}
      >
        {resendCooldown > 0 ? 'Reenviar en ' + resendCooldown + ' s' : 'Reenviar código'}
      </Button>
    </div>
  </form>
);

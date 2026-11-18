import { useState, type FC, type FormEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  evaluatePasswordStrength,
  firstValidationError,
  validateChangePasswordInput,
} from '../../domain/index.js';
import { Alert, Button, Modal } from '../../../../shared/ui/index.js';
import { AuthPasswordField } from './auth/AuthPasswordField.js';
import { PasswordStrengthMeter } from './auth/PasswordStrengthMeter.js';
import '../styles/admin-access.css';

export interface ChangePasswordModalProps {
  readonly useCases: AuthUseCases;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

/**
 * Modal de cambio de contraseña reutilizando <Modal />, <AuthPasswordField />
 * y <PasswordStrengthMeter /> bajo el sistema Webflow Studio.
 */
export const ChangePasswordModal: FC<ChangePasswordModalProps> = ({
  useCases,
  onClose,
  onChanged,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = evaluatePasswordStrength(newPassword);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRequestError(null);

    const validation = validateChangePasswordInput({ currentPassword, newPassword });
    const nextErrors: Record<string, string> = { ...validation.errors };
    if (newPassword !== confirmation) {
      nextErrors['confirmation'] = 'La confirmación no coincide con la nueva contraseña.';
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setRequestError(firstValidationError(nextErrors) ?? 'Revisa las contraseñas ingresadas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await useCases.changePassword.execute({ currentPassword, newPassword });
      onChanged();
    } catch (error_) {
      setRequestError(toErrorMessage(error_, 'No se pudo actualizar la contraseña.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      eyebrow="Seguridad"
      title="Cambiar contraseña"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="wf-change-password-form"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Guardar cambio
          </Button>
        </>
      }
    >
      {requestError !== null && (
        <Alert type="error" title="Atención" onClose={() => setRequestError(null)}>
          {requestError}
        </Alert>
      )}

      <form
        id="wf-change-password-form"
        className="wf-admin-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <AuthPasswordField
          id="wf-current-password"
          name="currentPassword"
          label="Contraseña actual"
          value={currentPassword}
          autoComplete="current-password"
          visible={showCurrent}
          onToggleVisible={() => setShowCurrent((prev) => !prev)}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setErrors({});
          }}
          onBlur={() => undefined}
          error={errors['currentPassword']}
          disabled={isSubmitting}
        />

        <AuthPasswordField
          id="wf-new-password"
          name="newPassword"
          label="Nueva contraseña"
          value={newPassword}
          autoComplete="new-password"
          visible={showNew}
          onToggleVisible={() => setShowNew((prev) => !prev)}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setErrors({});
          }}
          onBlur={() => undefined}
          error={errors['newPassword']}
          disabled={isSubmitting}
        />

        {newPassword.length > 0 && <PasswordStrengthMeter strength={strength} />}

        <AuthPasswordField
          id="wf-confirm-password"
          name="confirmation"
          label="Confirmar nueva contraseña"
          value={confirmation}
          autoComplete="new-password"
          visible={showConfirm}
          onToggleVisible={() => setShowConfirm((prev) => !prev)}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setErrors({});
          }}
          onBlur={() => undefined}
          error={errors['confirmation']}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

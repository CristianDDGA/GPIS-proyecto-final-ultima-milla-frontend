import { useEffect, useRef, useState } from 'react';
import type { FC, FormEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  firstValidationError,
  validateChangePasswordInput,
} from '../../domain/index.js';
import { Alert, Button, TextInput } from '../../../../shared/ui/index.js';

export interface ChangePasswordModalProps {
  readonly useCases: AuthUseCases;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export const ChangePasswordModal: FC<ChangePasswordModalProps> = ({ useCases, onClose, onChanged }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    <div className="mk-modal-root" role="presentation">
      <div className="mk-modal-backdrop" aria-hidden="true" onClick={onClose} />
      <section
        className="mk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mk-change-password-title"
      >
        <header className="mk-modal__header">
          <p className="mk-eyebrow">Seguridad</p>
          <h2 id="mk-change-password-title" className="mk-modal__title">
            Cambiar contraseña
          </h2>
          <p className="mk-modal__description">
            La sesión se renovará con un token nuevo al guardar el cambio.
          </p>
        </header>

        {requestError !== null && (
          <Alert type="error" title="Atención" onClose={() => setRequestError(null)}>
            {requestError}
          </Alert>
        )}

        <form className="mk-form" onSubmit={handleSubmit} noValidate>
          <div className="mk-field-with-toggle">
            <TextInput
              ref={firstFieldRef}
              id="mk-current-password"
              label="Contraseña actual"
              type={showPassword ? 'text' : 'password'}
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setErrors({});
              }}
              error={errors['currentPassword']}
              isRequired
              maxLength={128}
              disabled={isSubmitting}
            />
          </div>

          <TextInput
            id="mk-new-password"
            label="Nueva contraseña"
            type={showPassword ? 'text' : 'password'}
            name="newPassword"
            autoComplete="new-password"
            helperText="Entre 8 y 128 caracteres, distinta de la actual."
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setErrors({});
            }}
            error={errors['newPassword']}
            isRequired
            maxLength={128}
            disabled={isSubmitting}
          />

          <TextInput
            id="mk-confirm-password"
            label="Confirmar nueva contraseña"
            type={showPassword ? 'text' : 'password'}
            name="confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setErrors({});
            }}
            error={errors['confirmation']}
            isRequired
            maxLength={128}
            disabled={isSubmitting}
          />

          <label className="mk-check">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Mostrar contraseñas
          </label>

          <footer className="mk-modal__actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
              Guardar cambio
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
};

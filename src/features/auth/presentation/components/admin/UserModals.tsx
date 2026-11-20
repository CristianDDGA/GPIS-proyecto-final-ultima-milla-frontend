import { useState, type FC, type FormEvent } from 'react';
import {
  evaluatePasswordStrength,
  type ManagedUser,
  type PublicRole,
} from '../../../domain/index.js';
import { Alert, Button, Modal, ShortIdBadge, TextInput } from '../../../../../shared/ui/index.js';
import { AuthPasswordField } from '../auth/AuthPasswordField.js';
import { PasswordStrengthMeter } from '../auth/PasswordStrengthMeter.js';
import { formatAdminDate, ROLE_LABELS } from './UserDirectoryTable.js';

const VERIFIED_VIA_LABELS: Record<string, string> = {
  code: 'Código de correo',
  admin: 'Verificado por admin',
  legacy: 'Cuenta heredada',
  demo: 'Modo demo',
  google: 'Google',
};

export interface UserCreateModalProps {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: PublicRole;
  readonly errors: Record<string, string>;
  readonly isCreating: boolean;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onDisplayNameChange: (value: string) => void;
  readonly onRoleChange: (value: PublicRole) => void;
  readonly onClearErrors: () => void;
  readonly onClose: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const UserCreateModal: FC<UserCreateModalProps> = ({
  email,
  password,
  displayName,
  role,
  errors,
  isCreating,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onRoleChange,
  onClearErrors,
  onClose,
  onSubmit,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const strength = evaluatePasswordStrength(password, email);

  return (
    <Modal
      title="Nuevo usuario"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="wf-create-user-form"
            variant="primary"
            isLoading={isCreating}
            disabled={isCreating}
          >
            Crear usuario
          </Button>
        </>
      }
    >
      <form id="wf-create-user-form" className="wf-admin-form" onSubmit={onSubmit} noValidate>
        {errors['form'] !== undefined && (
          <Alert type="error" title="No se pudo crear" onClose={onClearErrors}>
            {errors['form']}
          </Alert>
        )}

        <div className="wf-role-pills" role="radiogroup" aria-label="Rol del usuario">
          {(['admin', 'repartidor', 'cliente'] as const).map((itemRole) => (
            <button
              key={itemRole}
              type="button"
              role="radio"
              aria-checked={role === itemRole}
              className={'wf-role-pill ' + (role === itemRole ? 'wf-role-pill--active' : '')}
              onClick={() => onRoleChange(itemRole)}
            >
              {ROLE_LABELS[itemRole]}
            </button>
          ))}
        </div>

        <TextInput
          id="wf-create-email"
          label="Correo electrónico"
          type="email"
          autoComplete="off"
          placeholder="equipo@millast.ec"
          value={email}
          onChange={(event) => {
            onEmailChange(event.target.value);
            onClearErrors();
          }}
          error={errors['email']}
          isRequired
          maxLength={254}
          disabled={isCreating}
        />

        <TextInput
          id="wf-create-display-name"
          label="Nombre para mostrar (opcional)"
          type="text"
          autoComplete="off"
          placeholder="Ej. Ana Paredes"
          value={displayName}
          onChange={(event) => {
            onDisplayNameChange(event.target.value);
            onClearErrors();
          }}
          error={errors['displayName']}
          maxLength={120}
          disabled={isCreating}
        />

        <AuthPasswordField
          id="wf-create-password"
          name="password"
          label="Contraseña inicial"
          value={password}
          autoComplete="new-password"
          visible={showPassword}
          onToggleVisible={() => setShowPassword((prev) => !prev)}
          onChange={(event) => {
            onPasswordChange(event.target.value);
            onClearErrors();
          }}
          onBlur={() => undefined}
          error={errors['password']}
          disabled={isCreating}
        />

        {password.length > 0 && <PasswordStrengthMeter strength={strength} />}
      </form>
    </Modal>
  );
};

export interface UserDetailModalProps {
  readonly user: ManagedUser;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onClearError: () => void;
  readonly onClose: () => void;
}

export const UserDetailModal: FC<UserDetailModalProps> = ({
  user,
  isLoading,
  error,
  onClearError,
  onClose,
}) => (
  <Modal
    title="Detalle de la cuenta"
    description={user.email}
    onClose={onClose}
    footer={
      <Button type="button" variant="secondary" onClick={onClose}>
        Cerrar
      </Button>
    }
  >
    {error !== null && (
      <Alert type="error" title="No se pudo consultar" onClose={onClearError}>
        {error}
      </Alert>
    )}
    {isLoading && <p role="status">Consultando usuario…</p>}
    <div className="wf-detail-grid">
      <div>
        <span className="wf-detail-grid__label">Código</span>
        <ShortIdBadge id={user.id} prefix="USR" />
      </div>
      <div>
        <span className="wf-detail-grid__label">Rol</span>
        <span>{ROLE_LABELS[user.publicRole]}</span>
      </div>
      <div>
        <span className="wf-detail-grid__label">Estado</span>
        <span>{user.isActive ? 'Activo' : 'Inactivo'}</span>
      </div>
      <div>
        <span className="wf-detail-grid__label">Verificación</span>
        <span>
          {user.emailVerified
            ? (VERIFIED_VIA_LABELS[user.emailVerifiedVia ?? ''] ?? 'Verificado')
            : 'Pendiente'}
        </span>
      </div>
      <div>
        <span className="wf-detail-grid__label">Nombre</span>
        <span>{user.displayName ?? '—'}</span>
      </div>
      <div>
        <span className="wf-detail-grid__label">Creado</span>
        <span className="wf-table__mono">{formatAdminDate(user.createdAt)}</span>
      </div>
    </div>
  </Modal>
);

export interface UserToggleModalProps {
  readonly user: ManagedUser;
  readonly isToggling: boolean;
  readonly error: string | null;
  readonly onClearError: () => void;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export const UserToggleModal: FC<UserToggleModalProps> = ({
  user,
  isToggling,
  error,
  onClearError,
  onClose,
  onConfirm,
}) => (
  <Modal
    title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
    description={user.email}
    size="sm"
    onClose={onClose}
    footer={
      <>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant={user.isActive ? 'danger' : 'primary'}
          isLoading={isToggling}
          onClick={onConfirm}
        >
          {user.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </>
    }
  >
    {error !== null && (
      <Alert type="error" title="No se pudo cambiar el estado" onClose={onClearError}>
        {error}
      </Alert>
    )}
    <p className="wf-modal__paragraph">
      {user.isActive
        ? 'La cuenta dejará de iniciar sesión y se revocarán sus sesiones activas.'
        : 'La cuenta podrá volver a iniciar sesión con su contraseña actual.'}
    </p>
  </Modal>
);

export interface UserResetPasswordModalProps {
  readonly user: ManagedUser;
  readonly password: string;
  readonly errors: Record<string, string>;
  readonly requestError: string | null;
  readonly isResetting: boolean;
  readonly onPasswordChange: (value: string) => void;
  readonly onClearErrors: () => void;
  readonly onClose: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const UserResetPasswordModal: FC<UserResetPasswordModalProps> = ({
  user,
  password,
  errors,
  requestError,
  isResetting,
  onPasswordChange,
  onClearErrors,
  onClose,
  onSubmit,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const strength = evaluatePasswordStrength(password, user.email);

  return (
    <Modal
      title="Restablecer contraseña"
      description={user.email}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isResetting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="wf-reset-password-form"
            variant="primary"
            isLoading={isResetting}
            disabled={isResetting}
          >
            Restablecer
          </Button>
        </>
      }
    >
      <form id="wf-reset-password-form" className="wf-admin-form" onSubmit={onSubmit} noValidate>
        {requestError !== null && (
          <Alert type="error" title="No se pudo restablecer" onClose={onClearErrors}>
            {requestError}
          </Alert>
        )}
        <AuthPasswordField
          id="wf-reset-password"
          name="newPassword"
          label="Nueva contraseña"
          value={password}
          autoComplete="new-password"
          visible={showPassword}
          onToggleVisible={() => setShowPassword((prev) => !prev)}
          onChange={(event) => {
            onPasswordChange(event.target.value);
            onClearErrors();
          }}
          onBlur={() => undefined}
          error={errors['newPassword']}
          disabled={isResetting}
        />
        {password.length > 0 && <PasswordStrengthMeter strength={strength} />}
      </form>
    </Modal>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC, FormEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  firstValidationError,
  isPublicRole,
  validateCreateManagedUserInput,
  type AuthUser,
  type CreateManagedUserInput,
  type HealthStatus,
  type PublicRole,
} from '../../domain/index.js';
import { Alert, Button, Card, EmptyState, Select, TextInput } from '../../../../shared/ui/index.js';
import '../styles/auth.css';

const ROLE_OPTIONS: { value: PublicRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'repartidor', label: 'Repartidor' },
  { value: 'cliente', label: 'Cliente' },
];

const PUBLIC_ROLE_LABELS: Record<PublicRole, string> = {
  admin: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  checking: 'Verificando servidor...',
  online: 'Servidor en línea',
  offline: 'Servidor sin conexión',
};

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export const AdminUserManagementView: FC<{ useCases: AuthUseCases }> = ({ useCases }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<PublicRole>('repartidor');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [createdUsers, setCreatedUsers] = useState<AuthUser[]>([]);
  const mountedRef = useRef(true);

  const runHealthCheck = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) {
      return;
    }

    setIsCheckingHealth(true);
    setHealthStatus('checking');

    try {
      const nextHealthStatus = await useCases.checkHealth.execute();
      if (mountedRef.current) {
        setHealthStatus(nextHealthStatus);
      }
    } catch {
      if (mountedRef.current) {
        setHealthStatus('offline');
      }
    } finally {
      if (mountedRef.current) {
        setIsCheckingHealth(false);
      }
    }
  }, [useCases]);

  useEffect(() => {
    mountedRef.current = true;
    void runHealthCheck();

    return () => {
      mountedRef.current = false;
    };
  }, [runHealthCheck]);

  const resetFeedback = useCallback((): void => {
    setRequestError(null);
    setSuccessMessage(null);
  }, []);

  const clearError = useCallback((): void => {
    setRequestError(null);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    resetFeedback();

    const trimmedDisplayName = displayName.trim();
    const input: CreateManagedUserInput = {
      email,
      password,
      role,
      displayName: trimmedDisplayName.length === 0 ? null : trimmedDisplayName,
    };

    const validation = validateCreateManagedUserInput(input);
    setFieldErrors(validation.errors);

    if (!validation.isValid) {
      setRequestError(
        firstValidationError(validation.errors) ?? 'Revisa los datos del nuevo usuario.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const createdUser = await useCases.createManagedUser.execute(input);
      if (!mountedRef.current) {
        return;
      }

      setCreatedUsers((previous) => [createdUser, ...previous]);
      setSuccessMessage(
        `Usuario ${createdUser.email} creado con rol ${PUBLIC_ROLE_LABELS[createdUser.publicRole]}.`,
      );
      setEmail('');
      setPassword('');
      setDisplayName('');
      setFieldErrors({});
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'No se pudo crear el usuario.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <section className="auth-admin-layout" aria-labelledby="auth-admin-title">
      <header className="auth-admin-header">
        <div className="auth-admin-header__title-group">
          <h2 id="auth-admin-title">Administración de Usuarios</h2>
          <p>
            Crea cuentas con rol administrador, repartidor o cliente (POST /auth/users) y verifica
            el estado del sistema (GET /health).
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            void runHealthCheck();
          }}
          isLoading={isCheckingHealth}
          aria-label="Verificar el estado del sistema"
        >
          Verificar sistema
        </Button>
      </header>

      <div
        className={`auth-admin-health auth-admin-health--${healthStatus}`}
        role="status"
        aria-live="polite"
      >
        <span className="auth-admin-health__dot" aria-hidden="true" />
        <span>{HEALTH_LABELS[healthStatus]}</span>
      </div>

      {requestError && (
        <Alert type="error" title="Atención" onClose={clearError}>
          {requestError}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" title="Operación exitosa" onClose={resetFeedback}>
          {successMessage}
        </Alert>
      )}

      <div className="auth-admin-grid">
        <Card variant="elevated" className="auth-admin-card">
          <h3 className="auth-admin-card__title">Nuevo usuario</h3>
          <form className="auth-admin-form" onSubmit={handleSubmit} noValidate>
            <TextInput
              id="auth-admin-email"
              label="Correo electrónico"
              type="email"
              name="email"
              autoComplete="off"
              placeholder="nuevo.usuario@logistica.local"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.email}
              isRequired
              maxLength={254}
              disabled={isSubmitting}
            />

            <TextInput
              id="auth-admin-password"
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.password}
              helperText="Debe tener entre 8 y 128 caracteres."
              isRequired
              maxLength={128}
              disabled={isSubmitting}
            />

            <Select
              id="auth-admin-role"
              label="Rol"
              name="role"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(event) => {
                const nextRole = event.target.value;
                if (isPublicRole(nextRole)) {
                  setRole(nextRole);
                }
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.role}
              isRequired
              disabled={isSubmitting}
            />

            <TextInput
              id="auth-admin-display-name"
              label="Nombre para mostrar"
              type="text"
              name="displayName"
              autoComplete="off"
              placeholder="Opcional"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.displayName}
              helperText="Opcional. Máximo 120 caracteres."
              maxLength={120}
              disabled={isSubmitting}
            />

            <div className="auth-admin-form__actions">
              <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                Crear usuario
              </Button>
            </div>
          </form>
        </Card>

        <Card variant="elevated" className="auth-admin-card">
          <div className="auth-admin-card__header">
            <h3 className="auth-admin-card__title">Historial de la sesión</h3>
            <span className="auth-admin-badge-count">
              {createdUsers.length} {createdUsers.length === 1 ? 'usuario' : 'usuarios'}
            </span>
          </div>

          {createdUsers.length === 0 ? (
            <EmptyState
              title="Sin usuarios creados"
              description="Los usuarios que crees en esta sesión aparecerán aquí con su identificador UUID y su rol."
            />
          ) : (
            <div className="auth-table-wrapper">
              <table className="auth-table" aria-label="Usuarios creados en la sesión actual">
                <thead>
                  <tr>
                    <th scope="col">UUID</th>
                    <th scope="col">Correo electrónico</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {createdUsers.map((createdUser) => (
                    <tr key={createdUser.id}>
                      <td className="auth-table__id">{createdUser.id}</td>
                      <td>{createdUser.email}</td>
                      <td>{PUBLIC_ROLE_LABELS[createdUser.publicRole]}</td>
                      <td className="auth-table__muted">{createdUser.displayName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};

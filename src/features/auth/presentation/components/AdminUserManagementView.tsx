import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC, FormEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  firstValidationError,
  validateCreateManagedUserInput,
  type AuthUser,
  type CreateManagedUserInput,
  type HealthStatus,
  type PublicRole,
} from '../../domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ShortIdBadge,
  TextInput,
} from '../../../../shared/ui/index.js';
import '../styles/auth.css';

const ROLE_CARDS: readonly {
  readonly value: PublicRole;
  readonly label: string;
  readonly description: string;
  readonly scope: string;
}[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Control total de la operación y de las cuentas del equipo.',
    scope: 'Operación completa',
  },
  {
    value: 'repartidor',
    label: 'Repartidor',
    description: 'Ejecuta la hoja de ruta asignada y actualiza las entregas.',
    scope: 'Última milla',
  },
  {
    value: 'cliente',
    label: 'Cliente',
    description: 'Registra y consulta los pedidos de su cuenta.',
    scope: 'Seguimiento',
  },
];

const PUBLIC_ROLE_LABELS: Record<PublicRole, string> = {
  admin: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  checking: 'Verificando disponibilidad',
  online: 'Sistema operativo',
  offline: 'Sistema sin conexión',
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
  const [showPassword, setShowPassword] = useState(false);
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
          <h2 id="auth-admin-title">Administración de usuarios</h2>
          <p>
            Crea cuentas para el equipo y consulta el estado del servicio de identidad de la
            plataforma.
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
            <fieldset className="auth-role-picker">
              <legend className="auth-role-picker__legend">Perfil de acceso</legend>
              <div className="auth-role-picker__grid">
                {ROLE_CARDS.map((card) => (
                  <label
                    key={card.value}
                    className={`auth-role-option ${role === card.value ? 'auth-role-option--selected' : ''}`.trim()}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={card.value}
                      checked={role === card.value}
                      onChange={() => {
                        setRole(card.value);
                        setFieldErrors({});
                        setRequestError(null);
                      }}
                      disabled={isSubmitting}
                    />
                    <span className="auth-role-option__scope">{card.scope}</span>
                    <span className="auth-role-option__label">{card.label}</span>
                    <span className="auth-role-option__description">{card.description}</span>
                  </label>
                ))}
              </div>
            </fieldset>

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
              error={fieldErrors['email']}
              isRequired
              maxLength={254}
              disabled={isSubmitting}
            />

            <div className="auth-password-field">
              <TextInput
                id="auth-admin-password"
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors({});
                  setRequestError(null);
                }}
                error={fieldErrors['password']}
                helperText="Entre 8 y 128 caracteres."
                isRequired
                maxLength={128}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

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
              error={fieldErrors['displayName']}
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
            <h3 className="auth-admin-card__title">Cuentas creadas en esta sesión</h3>
            <span className="auth-admin-badge-count">
              {createdUsers.length} {createdUsers.length === 1 ? 'usuario' : 'usuarios'}
            </span>
          </div>

          {createdUsers.length === 0 ? (
            <EmptyState
              title="Sin cuentas creadas"
              description="Las cuentas que crees durante esta sesión aparecerán aquí con su rol y su código corto de referencia."
            />
          ) : (
            <div className="auth-table-wrapper">
              <table className="auth-table" aria-label="Usuarios creados en la sesión actual">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Correo electrónico</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {createdUsers.map((createdUser) => (
                    <tr key={createdUser.id}>
                      <td>
                        <ShortIdBadge id={createdUser.id} prefix="USR" />
                      </td>
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

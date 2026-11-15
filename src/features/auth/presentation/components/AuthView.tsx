import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC, FormEvent, KeyboardEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  firstValidationError,
  validateLoginInput,
  validateRegisterCustomerInput,
  type AuthUser,
  type HealthStatus,
  type RegisterCustomerInput,
} from '../../domain/index.js';
import { setToken } from '../../infrastructure/http/authTokenStorage.js';
import { Alert, Button, Card, Spinner, TextInput } from '../../../../shared/ui/index.js';
import '../styles/auth.css';

export interface AuthViewProps {
  useCases: AuthUseCases;
  /** Optional bridge so the composition root can refresh its own session state. */
  onAuthenticated?: ((user: AuthUser) => void) | undefined;
}

type AuthTab = 'login' | 'register';

interface QuickAccount {
  readonly label: string;
  readonly email: string;
  readonly password: string;
}

interface EndpointSummary {
  readonly method: string;
  readonly path: string;
  readonly description: string;
}

const QUICK_ACCOUNTS: readonly QuickAccount[] = [
  { label: 'Admin / Personal', email: 'admin@logistica.local', password: 'Admin1234!' },
  { label: 'Repartidor Demo 1', email: 'repartidor1@logistica.local', password: 'Repartidor1234!' },
  { label: 'Repartidor Demo 2', email: 'repartidor2@logistica.local', password: 'Repartidor1234!' },
  { label: 'Cliente Demo', email: 'cliente@logistica.local', password: 'Cliente1234!' },
];

const AUTH_ENDPOINTS: readonly EndpointSummary[] = [
  { method: 'POST', path: '/auth/login', description: 'Inicia sesión y emite el token JWT.' },
  { method: 'POST', path: '/auth/register', description: 'Registra una cuenta con rol cliente.' },
  { method: 'GET', path: '/auth/me', description: 'Obtiene el perfil de la sesión activa.' },
  { method: 'POST', path: '/auth/logout', description: 'Revoca el token de acceso actual.' },
  { method: 'POST', path: '/auth/users', description: 'Crea usuarios administrados (solo personal).' },
  { method: 'GET', path: '/health', description: 'Verifica la disponibilidad del servidor.' },
];

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

export const AuthView: FC<AuthViewProps> = ({ useCases, onAuthenticated }) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const mountedRef = useRef(true);
  const loginTabRef = useRef<HTMLButtonElement | null>(null);
  const registerTabRef = useRef<HTMLButtonElement | null>(null);

  const runHealthCheck = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) {
      return;
    }

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

  const selectTab = useCallback(
    (nextTab: AuthTab): void => {
      setTab(nextTab);
      setFieldErrors({});
      setRequestError(null);
      setSuccessMessage(null);
    },
    [],
  );

  const fillQuickAccount = useCallback((account: QuickAccount): void => {
    setTab('login');
    setLoginEmail(account.email);
    setLoginPassword(account.password);
    setFieldErrors({});
    setRequestError(null);
    setSuccessMessage(null);
  }, []);

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const nextTab: AuthTab = tab === 'login' ? 'register' : 'login';
      selectTab(nextTab);

      if (nextTab === 'login') {
        loginTabRef.current?.focus();
      } else {
        registerTabRef.current?.focus();
      }
    },
    [tab, selectTab],
  );

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    resetFeedback();

    const validation = validateLoginInput({ email: loginEmail, password: loginPassword });
    setFieldErrors(validation.errors);

    if (!validation.isValid) {
      setRequestError(
        firstValidationError(validation.errors) ?? 'Revisa los datos de acceso ingresados.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await useCases.login.execute({
        email: loginEmail,
        password: loginPassword,
      });

      setToken(session.token);

      if (!mountedRef.current) {
        return;
      }

      setLoginPassword('');
      setSuccessMessage('Sesión iniciada correctamente.');
      onAuthenticated?.(session.user);
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(
          toErrorMessage(error_, 'No se pudo iniciar sesión. Verifica tu correo y contraseña.'),
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    resetFeedback();

    const trimmedDisplayName = registerDisplayName.trim();
    const registerInput: RegisterCustomerInput = {
      email: registerEmail,
      password: registerPassword,
    };

    if (trimmedDisplayName.length > 0) {
      registerInput.displayName = trimmedDisplayName;
    }

    const validation = validateRegisterCustomerInput({
      email: registerEmail,
      password: registerPassword,
      displayName: trimmedDisplayName,
    });
    setFieldErrors(validation.errors);

    if (!validation.isValid) {
      setRequestError(firstValidationError(validation.errors) ?? 'Revisa los datos de registro.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await useCases.registerCustomer.execute(registerInput);
      setToken(session.token);

      if (!mountedRef.current) {
        return;
      }

      setRegisterPassword('');
      setSuccessMessage('Cuenta creada y sesión iniciada correctamente.');
      onAuthenticated?.(session.user);
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'No se pudo completar el registro de la cuenta.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <section className="auth-layout" aria-labelledby="auth-view-title">
      <Card variant="elevated" className="auth-card">
        <header className="auth-brand">
          <p className="auth-eyebrow">Gestión de Logística</p>
          <h2 id="auth-view-title" className="auth-title">
            Última Milla
          </h2>
          <p className="auth-subtitle">Acceso al sistema de gestión logística</p>
        </header>

        <div
          className={`auth-health auth-health--${healthStatus}`}
          role="status"
          aria-live="polite"
        >
          {healthStatus === 'checking' ? (
            <Spinner size="sm" label="Verificando servidor" />
          ) : (
            <span className="auth-health__dot" aria-hidden="true" />
          )}
          <span className="auth-health__label">{HEALTH_LABELS[healthStatus]}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void runHealthCheck();
            }}
            isLoading={healthStatus === 'checking'}
            aria-label="Reintentar la verificación del servidor"
          >
            Reintentar
          </Button>
        </div>

        {requestError && (
          <Alert type="error" title="Atención" onClose={clearError}>
            {requestError}
          </Alert>
        )}

        {successMessage && (
          <Alert type="success" title="Sesión iniciada">
            {successMessage}
          </Alert>
        )}

        <div className="auth-tabs" role="tablist" aria-label="Modo de acceso">
          <button
            ref={loginTabRef}
            type="button"
            role="tab"
            id="auth-tab-login"
            aria-selected={tab === 'login'}
            aria-controls="auth-panel-login"
            tabIndex={tab === 'login' ? 0 : -1}
            className={`auth-tab ${tab === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => selectTab('login')}
            onKeyDown={handleTabKeyDown}
          >
            Iniciar sesión
          </button>
          <button
            ref={registerTabRef}
            type="button"
            role="tab"
            id="auth-tab-register"
            aria-selected={tab === 'register'}
            aria-controls="auth-panel-register"
            tabIndex={tab === 'register' ? 0 : -1}
            className={`auth-tab ${tab === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => selectTab('register')}
            onKeyDown={handleTabKeyDown}
          >
            Registrarse como cliente
          </button>
        </div>

        {tab === 'login' ? (
          <form
            id="auth-panel-login"
            role="tabpanel"
            aria-labelledby="auth-tab-login"
            className="auth-form"
            onSubmit={handleLoginSubmit}
            noValidate
          >
            <TextInput
              id="auth-login-email"
              label="Correo electrónico"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="usuario@logistica.local"
              value={loginEmail}
              onChange={(event) => {
                setLoginEmail(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.email}
              isRequired
              maxLength={254}
              disabled={isSubmitting}
            />

            <TextInput
              id="auth-login-password"
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Mínimo 8 caracteres"
              value={loginPassword}
              onChange={(event) => {
                setLoginPassword(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.password}
              isRequired
              maxLength={128}
              disabled={isSubmitting}
            />

            <div className="auth-form__actions">
              <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                Entrar
              </Button>
            </div>
          </form>
        ) : (
          <form
            id="auth-panel-register"
            role="tabpanel"
            aria-labelledby="auth-tab-register"
            className="auth-form"
            onSubmit={handleRegisterSubmit}
            noValidate
          >
            <TextInput
              id="auth-register-email"
              label="Correo electrónico"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="cliente@logistica.local"
              value={registerEmail}
              onChange={(event) => {
                setRegisterEmail(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.email}
              isRequired
              maxLength={254}
              disabled={isSubmitting}
            />

            <TextInput
              id="auth-register-password"
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={registerPassword}
              onChange={(event) => {
                setRegisterPassword(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.password}
              helperText="Debe tener entre 8 y 128 caracteres."
              isRequired
              maxLength={128}
              disabled={isSubmitting}
            />

            <TextInput
              id="auth-register-display-name"
              label="Nombre para mostrar"
              type="text"
              name="displayName"
              autoComplete="name"
              placeholder="Opcional"
              value={registerDisplayName}
              onChange={(event) => {
                setRegisterDisplayName(event.target.value);
                setFieldErrors({});
                setRequestError(null);
              }}
              error={fieldErrors.displayName}
              helperText="Opcional. Se mostrará en la barra de sesión en lugar de tu correo."
              maxLength={120}
              disabled={isSubmitting}
            />

            <div className="auth-form__actions">
              <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                Crear cuenta
              </Button>
            </div>
          </form>
        )}

        <div className="auth-quick-accounts">
          <h3 className="auth-quick-accounts__title">Cuentas de prueba rápida (Entorno Local)</h3>
          <p className="auth-quick-accounts__hint">
            Selecciona una cuenta para completar el formulario de inicio de sesión.
          </p>
          <div className="auth-quick-accounts__grid">
            {QUICK_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fillQuickAccount(account)}
                disabled={isSubmitting}
                aria-label={`Rellenar credenciales de ${account.label}`}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <aside className="auth-side" aria-label="Información de autenticación">
        <Card variant="outlined" className="auth-side-card">
          <h3 className="auth-side-card__title">Endpoints de autenticación</h3>
          <p className="auth-side-card__description">
            Esta pantalla consume los servicios de acceso, registro y salud del backend.
          </p>
          <ul className="auth-endpoints">
            {AUTH_ENDPOINTS.map((endpoint) => (
              <li key={`${endpoint.method} ${endpoint.path}`} className="auth-endpoint">
                <span className="auth-endpoint__method">{endpoint.method}</span>
                <span className="auth-endpoint__path">{endpoint.path}</span>
                <span className="auth-endpoint__description">{endpoint.description}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="outlined" className="auth-side-card">
          <h3 className="auth-side-card__title">Roles del sistema</h3>
          <ul className="auth-roles">
            <li>
              <strong>Administrador:</strong> gestiona zonas, pedidos, rutas, flota y usuarios.
            </li>
            <li>
              <strong>Repartidor:</strong> ejecuta la hoja de ruta asignada y actualiza entregas.
            </li>
            <li>
              <strong>Cliente:</strong> registra y consulta sus pedidos de última milla.
            </li>
          </ul>
        </Card>
      </aside>
    </section>
  );
};

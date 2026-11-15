import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FC, FormEvent, KeyboardEvent } from 'react';
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
import {
  Alert,
  Button,
  IsometricLogisticsHub,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import '../styles/auth.css';

export interface AuthViewProps {
  useCases: AuthUseCases;
  /** Optional bridge so the composition root can refresh its own session state. */
  onAuthenticated?: ((user: AuthUser) => void) | undefined;
}

type AuthTab = 'login' | 'register';

const AUTH_TABS: readonly { readonly value: AuthTab; readonly label: string }[] = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' },
];

const HEALTH_LABELS: Record<HealthStatus, string> = {
  checking: 'Verificando disponibilidad',
  online: 'Servicios operativos',
  offline: 'Servicios no disponibles',
};

const OPERATIONAL_CAPABILITIES: readonly {
  readonly title: string;
  readonly description: string;
  readonly tag: string;
}[] = [
  {
    tag: '01',
    title: 'Cobertura',
    description: 'Define zonas y mide la demanda real de cada área de reparto.',
  },
  {
    tag: '02',
    title: 'Planificación',
    description: 'Agrupa pedidos en rutas con cupo controlado y reparto equilibrado.',
  },
  {
    tag: '03',
    title: 'Última milla',
    description: 'Despacha la flota y confirma cada entrega con telemetría en vivo.',
  },
];

const ROLE_CARDS: readonly {
  readonly role: string;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    role: 'Administrador',
    title: 'Operación completa',
    description: 'Zonas, pedidos, rutas, flota y cuentas del equipo.',
  },
  {
    role: 'Repartidor',
    title: 'Hoja de ruta',
    description: 'Paradas asignadas y avance de cada entrega.',
  },
  {
    role: 'Cliente',
    title: 'Seguimiento',
    description: 'Registro de pedidos y estado de sus entregas.',
  },
];

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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [liveErrors, setLiveErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
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

  const selectTab = useCallback((nextTab: AuthTab): void => {
    setTab(nextTab);
    setFieldErrors({});
    setLiveErrors({});
    setTouchedFields({});
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

  // Validación en vivo: sólo se muestran errores de campos ya visitados.
  const validateLive = useCallback(
    (values: { email?: string; password?: string; displayName?: string }): void => {
      const isRegister = tab === 'register';
      const validation = isRegister
        ? validateRegisterCustomerInput({
            email: values.email ?? registerEmail,
            password: values.password ?? registerPassword,
            displayName: values.displayName ?? registerDisplayName,
          })
        : validateLoginInput({
            email: values.email ?? loginEmail,
            password: values.password ?? loginPassword,
          });

      const nextErrors: Record<string, string> = {};
      for (const [field, message] of Object.entries(validation.errors)) {
        if (message !== undefined && touchedFields[field] === true) {
          nextErrors[field] = message;
        }
      }
      setLiveErrors(nextErrors);
    },
    [
      tab,
      registerEmail,
      registerPassword,
      registerDisplayName,
      loginEmail,
      loginPassword,
      touchedFields,
    ],
  );

  const markTouched = useCallback(
    (field: string): void => {
      setTouchedFields((previous) => ({ ...previous, [field]: true }));
    },
    [],
  );

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    resetFeedback();

    const validation = validateLoginInput({ email: loginEmail, password: loginPassword });
    setFieldErrors(validation.errors);
    setTouchedFields({ email: true, password: true });

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
    setTouchedFields({ email: true, password: true, displayName: true });

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

  const activeTabIndex = tab === 'login' ? 0 : 1;
  const segmentedStyle = {
    '--seg-index': activeTabIndex,
    '--seg-count': AUTH_TABS.length,
  } as CSSProperties;

  return (
    <section className="auth-shell" aria-labelledby="auth-view-title">
      <aside className="auth-hero" aria-label="Presentación de la torre de control">
        <div className="auth-hero__head">
          <p className="auth-hero__eyebrow">Gestión de logística</p>
          <h1 id="auth-view-title" className="auth-hero__title">
            Última Milla
          </h1>
          <p className="auth-hero__subtitle">
            Torre de control para la operación de reparto urbano: cobertura, demanda,
            planificación, despacho y entregas confirmadas en una sola secuencia.
          </p>
        </div>

        <div className="auth-hero__visual">
          <IsometricLogisticsHub healthStatus={healthStatus} />
        </div>

        <div className={`auth-health-pill auth-health-pill--${healthStatus}`} role="status" aria-live="polite">
          {healthStatus === 'checking' ? (
            <Spinner size="sm" label="Verificando disponibilidad del servidor" />
          ) : (
            <span className="auth-health-pill__dot" aria-hidden="true" />
          )}
          <span className="auth-health-pill__label">{HEALTH_LABELS[healthStatus]}</span>
          <button
            type="button"
            className="auth-health-pill__retry"
            onClick={() => {
              void runHealthCheck();
            }}
            disabled={healthStatus === 'checking'}
          >
            Reintentar
          </button>
        </div>

        <ul className="auth-capabilities" aria-label="Capacidades operativas del sistema">
          {OPERATIONAL_CAPABILITIES.map((capability) => (
            <li key={capability.tag} className="auth-capability">
              <span className="auth-capability__tag" aria-hidden="true">
                {capability.tag}
              </span>
              <div>
                <p className="auth-capability__title">{capability.title}</p>
                <p className="auth-capability__description">{capability.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <div className="auth-panel">
        <div className="auth-panel__card">
          <header className="auth-panel__head">
            <h2 className="auth-panel__title">Acceso al sistema</h2>
            <p className="auth-panel__subtitle">
              Ingresa con tus credenciales corporativas o crea una cuenta de cliente.
            </p>
          </header>

          <div className="auth-tabs segmented" role="tablist" aria-label="Modo de acceso" style={segmentedStyle}>
            <span className="segmented__thumb" aria-hidden="true" />
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
              Crear cuenta
            </button>
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
                  validateLive({ email: event.target.value });
                }}
                onBlur={() => {
                  markTouched('email');
                  validateLive({ email: loginEmail });
                }}
                error={liveErrors['email'] ?? fieldErrors['email']}
                isRequired
                maxLength={254}
                disabled={isSubmitting}
              />

              <div className="auth-password-field">
                <TextInput
                  id="auth-login-password"
                  label="Contraseña"
                  type={showLoginPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Mínimo 8 caracteres"
                  value={loginPassword}
                  onChange={(event) => {
                    setLoginPassword(event.target.value);
                    setFieldErrors({});
                    setRequestError(null);
                    validateLive({ password: event.target.value });
                  }}
                  onBlur={() => {
                    markTouched('password');
                    validateLive({ password: loginPassword });
                  }}
                  error={liveErrors['password'] ?? fieldErrors['password']}
                  isRequired
                  maxLength={128}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowLoginPassword((previous) => !previous)}
                  aria-pressed={showLoginPassword}
                  aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showLoginPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <div className="auth-form__actions">
                <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                  Entrar
                </Button>
                <p className="auth-form__hint">
                  El acceso se valida contra el servicio de identidad corporativo.
                </p>
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
                  validateLive({ email: event.target.value });
                }}
                onBlur={() => {
                  markTouched('email');
                  validateLive({ email: registerEmail });
                }}
                error={liveErrors['email'] ?? fieldErrors['email']}
                isRequired
                maxLength={254}
                disabled={isSubmitting}
              />

              <div className="auth-password-field">
                <TextInput
                  id="auth-register-password"
                  label="Contraseña"
                  type={showRegisterPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={registerPassword}
                  onChange={(event) => {
                    setRegisterPassword(event.target.value);
                    setFieldErrors({});
                    setRequestError(null);
                    validateLive({ password: event.target.value });
                  }}
                  onBlur={() => {
                    markTouched('password');
                    validateLive({ password: registerPassword });
                  }}
                  error={liveErrors['password'] ?? fieldErrors['password']}
                  helperText="Entre 8 y 128 caracteres; se guarda cifrada."
                  isRequired
                  maxLength={128}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowRegisterPassword((previous) => !previous)}
                  aria-pressed={showRegisterPassword}
                  aria-label={showRegisterPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showRegisterPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

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
                error={fieldErrors['displayName']}
                helperText="Opcional. Se usará en la cápsula de sesión en lugar de tu correo."
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
        </div>

        <section className="auth-roles" aria-label="Perfiles del sistema">
          {ROLE_CARDS.map((card) => (
            <article key={card.role} className="auth-role">
              <p className="auth-role__name">{card.role}</p>
              <p className="auth-role__title">{card.title}</p>
              <p className="auth-role__description">{card.description}</p>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
};

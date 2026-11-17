import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { CSSProperties, FC, FormEvent, KeyboardEvent, ReactNode } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  evaluatePasswordStrength,
  firstValidationError,
  validateForgotPasswordInput,
  validateLoginInput,
  validateRegisterCustomerInput,
  validateResetPasswordInput,
  validateVerifyEmailInput,
  type AuthUser,
  type PasswordStrength,
  type RegisterCustomerInput,
  type ValidationErrors,
} from '../../domain/index.js';
import { setToken } from '../../infrastructure/http/authTokenStorage.js';
import { HttpError } from '../../../../shared/infrastructure/http/index.js';
import { Alert, Button, IsometricLogisticsHub, TextInput } from '../../../../shared/ui/index.js';
import { IsometricFloatingCube } from './IsometricFloatingCube.js';
import { MillastLogo } from './MillastLogo.js';
import '../styles/auth.css';

export interface AuthViewProps {
  useCases: AuthUseCases;
  /** Optional bridge so the composition root can refresh its own session state. */
  onAuthenticated?: ((user: AuthUser) => void) | undefined;
}

type AuthScreen = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';

type AuthTab = 'login' | 'register';

interface Notice {
  readonly type: 'success' | 'info';
  readonly title: string;
  readonly message: string;
}

const AUTH_TABS: readonly { readonly value: AuthTab; readonly label: string }[] = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' },
];

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Débil',
  medium: 'Media',
  strong: 'Fuerte',
};

const STRENGTH_LEVEL: Record<PasswordStrength, number> = { weak: 1, medium: 2, strong: 3 };

const RESEND_COOLDOWN_SECONDS = 60;

const LAVA_BLOBS = [1, 2, 3, 4, 5] as const;

const SECONDARY_TITLES: Record<Exclude<AuthScreen, 'login' | 'register'>, string> = {
  'verify-email': 'Verificar correo',
  'forgot-password': 'Recuperar clave',
  'reset-password': 'Nueva contraseña',
};

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function isEmailNotVerified(error: unknown): boolean {
  return error instanceof HttpError && error.code === 'EMAIL_NOT_VERIFIED';
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function CtaCube(): ReactNode {
  return <span className="auth-cta-cube" aria-hidden="true" />;
}

export const AuthView: FC<AuthViewProps> = ({ useCases, onAuthenticated }) => {
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const mountedRef = useRef(true);
  const screenTitleRef = useRef<HTMLHeadingElement | null>(null);
  const loginTabRef = useRef<HTMLButtonElement | null>(null);
  const registerTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Enfriamiento del botón "Reenviar código".
  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  // Foco al título breve de las sub-vistas (accesibilidad de SPA).
  useEffect(() => {
    if (screen === 'login' || screen === 'register') {
      return;
    }

    const frame = window.requestAnimationFrame(() => screenTitleRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [screen]);

  const switchScreen = useCallback((next: AuthScreen): void => {
    const apply = (): void => {
      setScreen(next);
      setTouched({});
      setRequestError(null);
    };

    if (!prefersReducedMotion() && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        flushSync(apply);
      });
      return;
    }

    apply();
  }, []);

  const goToLogin = useCallback((): void => {
    setLoginPassword('');
    switchScreen('login');
  }, [switchScreen]);

  const clearError = useCallback((): void => setRequestError(null), []);
  const clearNotice = useCallback((): void => setNotice(null), []);

  const markTouched = useCallback((field: string): void => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }, []);

  const validation: ValidationErrors = (() => {
    switch (screen) {
      case 'register': {
        return validateRegisterCustomerInput({
          email: registerEmail,
          password: registerPassword,
          displayName: registerDisplayName,
        }).errors;
      }
      case 'verify-email': {
        return validateVerifyEmailInput({ email: verifyEmailAddress, code: verifyCode }).errors;
      }
      case 'forgot-password': {
        return validateForgotPasswordInput({ email: forgotEmail }).errors;
      }
      case 'reset-password': {
        return validateResetPasswordInput({
          email: resetEmail,
          code: resetCode,
          newPassword: resetPassword,
        }).errors;
      }
      default: {
        return validateLoginInput({ email: loginEmail, password: loginPassword }).errors;
      }
    }
  })();

  const errorFor = useCallback(
    (field: string): string | undefined => (touched[field] ? validation[field] : undefined),
    [touched, validation],
  );

  const registerStrength = evaluatePasswordStrength(registerPassword, registerEmail);
  const resetStrength = evaluatePasswordStrength(resetPassword, resetEmail);

  const activeTab: AuthTab = screen === 'register' ? 'register' : 'login';
  const segmentedStyle = {
    '--seg-index': activeTab === 'login' ? 0 : 1,
    '--seg-count': AUTH_TABS.length,
  } as CSSProperties;

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const nextTab: AuthTab = activeTab === 'login' ? 'register' : 'login';
      switchScreen(nextTab);

      if (nextTab === 'login') {
        loginTabRef.current?.focus();
      } else {
        registerTabRef.current?.focus();
      }
    },
    [activeTab, switchScreen],
  );

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRequestError(null);
    setTouched({ email: true, password: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa los datos de acceso.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await useCases.login.execute({ email: loginEmail, password: loginPassword });
      setToken(session.token);

      if (mountedRef.current) {
        setLoginPassword('');
        onAuthenticated?.(session.user);
      }
    } catch (error_) {
      if (!mountedRef.current) {
        return;
      }

      if (isEmailNotVerified(error_)) {
        setVerifyEmailAddress(loginEmail);
        setVerifyCode('');
        setNotice({
          type: 'info',
          title: 'Verifica tu correo',
          message: 'Ingresa el código de 6 dígitos que enviamos a tu bandeja.',
        });
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        switchScreen('verify-email');
      } else {
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
    setRequestError(null);
    setTouched({ email: true, password: true, displayName: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa los datos de registro.');
      return;
    }

    const trimmedDisplayName = registerDisplayName.trim();
    const registerInput: RegisterCustomerInput = {
      email: registerEmail,
      password: registerPassword,
    };

    if (trimmedDisplayName.length > 0) {
      registerInput.displayName = trimmedDisplayName;
    }

    setIsSubmitting(true);

    try {
      const outcome = await useCases.registerCustomer.execute(registerInput);

      if (!mountedRef.current) {
        return;
      }

      if (outcome.kind === 'session') {
        setToken(outcome.session.token);
        setRegisterPassword('');
        onAuthenticated?.(outcome.session.user);
        return;
      }

      setVerifyEmailAddress(registerEmail);
      setVerifyCode('');
      setNotice({
        type: 'info',
        title: 'Verifica tu correo',
        message: 'Enviamos un código de 6 dígitos para activar tu cuenta.',
      });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      switchScreen('verify-email');
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

  const handleVerifySubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRequestError(null);
    setTouched({ code: true, email: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa el código ingresado.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await useCases.verifyEmail.execute({
        email: verifyEmailAddress,
        code: verifyCode,
      });
      setToken(session.token);

      if (mountedRef.current) {
        setVerifyCode('');
        onAuthenticated?.(session.user);
      }
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'El código no es válido o ha caducado.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    if (resendCooldown > 0) {
      return;
    }

    setRequestError(null);

    try {
      await useCases.resendVerification.execute(verifyEmailAddress);
      if (mountedRef.current) {
        setNotice({
          type: 'success',
          title: 'Código reenviado',
          message: 'Si el correo está pendiente, enviamos un nuevo código.',
        });
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'No se pudo reenviar el código.'));
      }
    }
  };

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRequestError(null);
    setTouched({ email: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Ingresa un correo electrónico válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      await useCases.forgotPassword.execute({ email: forgotEmail });

      if (mountedRef.current) {
        setResetEmail(forgotEmail);
        setResetCode('');
        setResetPassword('');
        setNotice({
          type: 'success',
          title: 'Código enviado',
          message: 'Si la cuenta existe, enviamos un código de 6 dígitos a tu correo.',
        });
        switchScreen('reset-password');
      }
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'No se pudo solicitar el código de recuperación.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRequestError(null);
    setTouched({ email: true, code: true, newPassword: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa el código y la nueva contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      await useCases.resetPassword.execute({
        email: resetEmail,
        code: resetCode,
        newPassword: resetPassword,
      });

      if (mountedRef.current) {
        setLoginEmail(resetEmail);
        setLoginPassword('');
        setResetCode('');
        setResetPassword('');
        setNotice({
          type: 'success',
          title: 'Contraseña actualizada',
          message: 'Ya puedes iniciar sesión con tu nueva contraseña.',
        });
        switchScreen('login');
      }
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'No se pudo restablecer la contraseña.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const isSecondary = screen !== 'login' && screen !== 'register';

  const secondaryInstruction =
    screen === 'verify-email'
      ? verifyEmailAddress.length > 0
        ? 'Código de 6 dígitos enviado a ' + verifyEmailAddress + '.'
        : 'Código de 6 dígitos enviado a tu correo.'
      : screen === 'forgot-password'
        ? 'Enviaremos un código de 6 dígitos a tu correo.'
        : 'Código enviado a ' + (resetEmail.length > 0 ? resetEmail : 'tu correo') + '.';

  const renderStrength = (strength: PasswordStrength): ReactNode => (
    <div className="auth-strength" data-strength={strength} aria-live="polite">
      <span className="auth-strength__pills" aria-hidden="true">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={'auth-strength__pill ' + (level <= STRENGTH_LEVEL[strength] ? 'auth-strength__pill--on' : '')}
          />
        ))}
      </span>
      <span className="auth-strength__label">Seguridad: {STRENGTH_LABELS[strength]}</span>
    </div>
  );

  return (
    <section className="auth-viewport" aria-label="Acceso a Millast">
      {/* Hermano 1: lava camaleónica (fuera del Backdrop Root de la tarjeta). */}
      <div className="auth-lava-stage" aria-hidden="true">
        <svg className="auth-lava-svg-defs" width="0" height="0" focusable="false" aria-hidden="true">
          <defs>
            <filter id="auth-lava-goo" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="lava-blur" />
              <feColorMatrix
                in="lava-blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                result="lava-metaballs"
              />
              <feComposite in="SourceGraphic" in2="lava-metaballs" operator="atop" />
            </filter>
          </defs>
        </svg>

        {LAVA_BLOBS.map((index) => (
          <span key={index} className={'auth-lava-blob auth-lava-blob--' + index} />
        ))}
      </div>

      {/* Escena isométrica libre: sin caja pegada, sobre la lava. */}
      <div className="auth-scene">
        <MillastLogo className="auth-scene__logo" />

        <div className="auth-scene__stage">
          <IsometricFloatingCube className="auth-float auth-float--1" tone="sapphire" size="lg" />
          <IsometricLogisticsHub />
          <IsometricFloatingCube className="auth-float auth-float--2" tone="cyan" size="md" />
          <IsometricFloatingCube className="auth-float auth-float--3" tone="steel" size="sm" />
          <IsometricFloatingCube className="auth-float auth-float--4" tone="cyan" size="sm" />
        </div>
      </div>

      {/* Tarjeta autónoma de acceso (cristal de relleno uniforme). */}
      <div className="auth-card">
        <span className="auth-card__edge" aria-hidden="true">
          <IsometricFloatingCube tone="cyan" size="md" />
        </span>

        <div className="auth-card__body">
          {!isSecondary ? (
            <div className="auth-segmented segmented" role="tablist" aria-label="Modo de acceso" style={segmentedStyle}>
              <span className="segmented__thumb" aria-hidden="true" />
              <button
                ref={loginTabRef}
                type="button"
                role="tab"
                id="auth-tab-login"
                aria-selected={activeTab === 'login'}
                aria-controls="auth-panel-login"
                tabIndex={activeTab === 'login' ? 0 : -1}
                className={'auth-tab ' + (activeTab === 'login' ? 'auth-tab--active' : '')}
                onClick={() => {
                  setNotice(null);
                  switchScreen('login');
                }}
                onKeyDown={handleTabKeyDown}
              >
                Iniciar sesión
              </button>
              <button
                ref={registerTabRef}
                type="button"
                role="tab"
                id="auth-tab-register"
                aria-selected={activeTab === 'register'}
                aria-controls="auth-panel-register"
                tabIndex={activeTab === 'register' ? 0 : -1}
                className={'auth-tab ' + (activeTab === 'register' ? 'auth-tab--active' : '')}
                onClick={() => {
                  setNotice(null);
                  switchScreen('register');
                }}
                onKeyDown={handleTabKeyDown}
              >
                Crear cuenta
              </button>
            </div>
          ) : (
            <button type="button" className="auth-back" onClick={goToLogin}>
              ← Volver
            </button>
          )}

          {isSecondary && (
            <header className="auth-card__head">
              <h2 ref={screenTitleRef} tabIndex={-1} className="auth-card__title">
                {SECONDARY_TITLES[screen as Exclude<AuthScreen, 'login' | 'register'>]}
              </h2>
              <p className="auth-card__instruction">{secondaryInstruction}</p>
            </header>
          )}

          {requestError !== null && (
            <Alert type="error" title="Atención" onClose={clearError}>
              {requestError}
            </Alert>
          )}

          {notice !== null && (
            <Alert type={notice.type} title={notice.title} onClose={clearNotice}>
              {notice.message}
            </Alert>
          )}

          {screen === 'login' && (
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
                placeholder="usuario@millast.ec"
                value={loginEmail}
                onChange={(event) => {
                  setLoginEmail(event.target.value);
                  setRequestError(null);
                }}
                onBlur={() => markTouched('email')}
                error={errorFor('email')}
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
                    setRequestError(null);
                  }}
                  onBlur={() => markTouched('password')}
                  error={errorFor('password')}
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
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setForgotEmail(loginEmail);
                    setNotice(null);
                    switchScreen('forgot-password');
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="auth-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  rightIcon={<CtaCube />}
                >
                  Entrar al sistema
                </Button>
              </div>
            </form>
          )}

          {screen === 'register' && (
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
                placeholder="cliente@millast.ec"
                value={registerEmail}
                onChange={(event) => {
                  setRegisterEmail(event.target.value);
                  setRequestError(null);
                }}
                onBlur={() => markTouched('email')}
                error={errorFor('email')}
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
                    setRequestError(null);
                  }}
                  onBlur={() => markTouched('password')}
                  error={errorFor('password')}
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

              {registerPassword.length > 0 && renderStrength(registerStrength)}

              <TextInput
                id="auth-register-display-name"
                label="Nombre para mostrar (opcional)"
                type="text"
                name="displayName"
                autoComplete="name"
                placeholder="Ej. Ana Paredes"
                value={registerDisplayName}
                onChange={(event) => {
                  setRegisterDisplayName(event.target.value);
                  setRequestError(null);
                }}
                onBlur={() => markTouched('displayName')}
                error={errorFor('displayName')}
                maxLength={120}
                disabled={isSubmitting}
              />

              <div className="auth-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  rightIcon={<CtaCube />}
                >
                  Crear cuenta
                </Button>
              </div>
            </form>
          )}

          {screen === 'verify-email' && (
            <form id="auth-panel-verify" className="auth-form" onSubmit={handleVerifySubmit} noValidate>
              <TextInput
                id="auth-verify-code"
                className="auth-code-field"
                label="Código de verificación"
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                placeholder="000000"
                value={verifyCode}
                onChange={(event) => {
                  setVerifyCode(event.target.value.replace(/\D/gu, '').slice(0, 6));
                  setRequestError(null);
                }}
                onBlur={() => markTouched('code')}
                error={errorFor('code')}
                isRequired
                maxLength={6}
                disabled={isSubmitting}
              />

              <div className="auth-form__actions">
                <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                  Confirmar código
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void handleResendVerification();
                  }}
                  disabled={resendCooldown > 0 || isSubmitting}
                >
                  {resendCooldown > 0 ? 'Reenviar en ' + resendCooldown + ' s' : 'Reenviar código'}
                </Button>
              </div>
            </form>
          )}

          {screen === 'forgot-password' && (
            <form id="auth-panel-forgot" className="auth-form" onSubmit={handleForgotSubmit} noValidate>
              <TextInput
                id="auth-forgot-email"
                label="Correo electrónico"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="usuario@millast.ec"
                value={forgotEmail}
                onChange={(event) => {
                  setForgotEmail(event.target.value);
                  setRequestError(null);
                }}
                onBlur={() => markTouched('email')}
                error={errorFor('email')}
                isRequired
                maxLength={254}
                disabled={isSubmitting}
              />

              <div className="auth-form__actions">
                <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                  Enviar código
                </Button>
              </div>
            </form>
          )}

          {screen === 'reset-password' && (
            <form id="auth-panel-reset" className="auth-form" onSubmit={handleResetSubmit} noValidate>
              <TextInput
                id="auth-reset-email"
                label="Correo electrónico"
                type="email"
                name="email"
                autoComplete="username"
                value={resetEmail}
                onChange={(event) => {
                  setResetEmail(event.target.value);
                  setRequestError(null);
                }}
                onBlur={() => markTouched('email')}
                error={errorFor('email')}
                isRequired
                maxLength={254}
                disabled={isSubmitting}
              />

              <TextInput
                id="auth-reset-code"
                className="auth-code-field"
                label="Código de recuperación"
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                placeholder="000000"
                value={resetCode}
                onChange={(event) => {
                  setResetCode(event.target.value.replace(/\D/gu, '').slice(0, 6));
                  setRequestError(null);
                }}
                onBlur={() => markTouched('code')}
                error={errorFor('code')}
                isRequired
                maxLength={6}
                disabled={isSubmitting}
              />

              <div className="auth-password-field">
                <TextInput
                  id="auth-reset-password"
                  label="Nueva contraseña"
                  type={showResetPassword ? 'text' : 'password'}
                  name="newPassword"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={resetPassword}
                  onChange={(event) => {
                    setResetPassword(event.target.value);
                    setRequestError(null);
                  }}
                  onBlur={() => markTouched('newPassword')}
                  error={errorFor('newPassword')}
                  isRequired
                  maxLength={128}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowResetPassword((previous) => !previous)}
                  aria-pressed={showResetPassword}
                  aria-label={showResetPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showResetPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {resetPassword.length > 0 && renderStrength(resetStrength)}

              <div className="auth-form__actions">
                <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                  Restablecer contraseña
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

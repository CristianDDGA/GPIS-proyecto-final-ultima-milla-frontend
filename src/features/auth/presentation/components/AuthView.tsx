import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import type { AuthUser } from '../../domain/index.js';
import { useAuthFlows, type AuthScreen, type AuthTab } from '../hooks/useAuthFlows.js';
import { AuthForgotPasswordForm } from './auth/AuthForgotPasswordForm.js';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from './auth/AuthIcons.js';
import { AuthLoginForm } from './auth/AuthLoginForm.js';
import { AuthRegisterForm } from './auth/AuthRegisterForm.js';
import { AuthResetPasswordForm } from './auth/AuthResetPasswordForm.js';
import { AuthStudioShowcase } from './auth/AuthStudioShowcase.js';
import { AuthTopNav } from './auth/AuthTopNav.js';
import { AuthVerifyEmailForm } from './auth/AuthVerifyEmailForm.js';
import { LiquidGlassCardChrome } from './auth/LiquidGlassCardChrome.js';
import '../styles/auth.css';

export interface AuthViewProps {
  useCases: AuthUseCases;
  /** Optional bridge so the composition root can refresh its own session state. */
  onAuthenticated?: ((user: AuthUser) => void) | undefined;
}

const AUTH_TABS: readonly { readonly value: AuthTab; readonly label: string }[] = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' },
];

const SECONDARY_TITLES: Record<Exclude<AuthScreen, 'login' | 'register'>, string> = {
  'verify-email': 'Verificar correo',
  'forgot-password': 'Recuperar contraseña',
  'reset-password': 'Nueva contraseña',
};

function getSecondaryInstruction(
  screen: Exclude<AuthScreen, 'login' | 'register'>,
  verifyEmail: string,
  resetEmail: string,
): string {
  switch (screen) {
    case 'verify-email':
      return verifyEmail.length > 0
        ? `Ingresa el código de 6 dígitos enviado a ${verifyEmail}.`
        : 'Ingresa el código de 6 dígitos enviado a tu correo.';
    case 'forgot-password':
      return 'Ingresa tu correo registrado para recibir un código de recuperación de 6 dígitos.';
    case 'reset-password':
      return `Ingresa el código enviado a ${resetEmail.length > 0 ? resetEmail : 'tu correo'} y define tu nueva contraseña.`;
  }
}

export const AuthView: FC<AuthViewProps> = ({ useCases, onAuthenticated }) => {
  const flows = useAuthFlows({ useCases, onAuthenticated });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glintRef = useRef<HTMLDivElement | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (flows.shakeNonce === 0) return;
    setIsShaking(false);
    const frame = window.requestAnimationFrame(() => setIsShaking(true));
    return () => window.cancelAnimationFrame(frame);
  }, [flows.shakeNonce]);

  // Inclinación óptica 3D contenida (±2.1deg) + destello especular reactivo al cursor
  const handleCardPointerMove = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    if (event.pointerType === 'touch') return;
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (glintRef.current) {
      glintRef.current.style.transform = `translate3d(${(x - 88).toFixed(1)}px, ${(y - 88).toFixed(1)}px, 0)`;
    }

    const rotateY = (x / rect.width - 0.5) * 4.2;
    const rotateX = (y / rect.height - 0.5) * -4.2;
    card.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  }, []);

  const handleCardPointerLeave = useCallback((): void => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  }, []);

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const nextTab: AuthTab = flows.activeTab === 'login' ? 'register' : 'login';
      flows.selectPrimaryTab(nextTab);

      if (nextTab === 'login') {
        flows.loginTabRef.current?.focus();
      } else {
        flows.registerTabRef.current?.focus();
      }
    },
    [flows.activeTab, flows.loginTabRef, flows.registerTabRef, flows.selectPrimaryTab],
  );

  const secondaryScreen = flows.isSecondary
    ? (flows.screen as Exclude<AuthScreen, 'login' | 'register'>)
    : null;

  return (
    <div className="mlg-page">
      <div className="mlg-shell">
        <AuthTopNav />

        <div className="mlg-grid" aria-label="Acceso a Millast">
          <AuthStudioShowcase />

          <section
            className="mlg-enter mlg-delay-3 mlg-card-stage"
            aria-label="Formulario de autenticación"
          >
            <div className="mlg-card-float">
              <div
                ref={cardRef}
                onPointerMove={handleCardPointerMove}
                onPointerLeave={handleCardPointerLeave}
                onAnimationEnd={(event) => {
                  if (event.animationName === 'mlg-shake-x') {
                    setIsShaking(false);
                  }
                }}
                className={'mlg-card' + (isShaking ? ' mlg-shake' : '')}
              >
                <LiquidGlassCardChrome cardRef={cardRef} glintRef={glintRef} />

                <div className="mlg-card__content">
                  {!flows.isSecondary && (
                    <div
                      role="tablist"
                      aria-label="Modo de acceso"
                      className="mlg-segmented"
                    >
                      <div
                        aria-hidden="true"
                        className={
                          'mlg-segmented__pill' +
                          (flows.activeTab === 'register' ? ' mlg-segmented__pill--right' : '')
                        }
                      >
                        <span className="mlg-segmented__pill-bar" />
                      </div>

                      {AUTH_TABS.map((tab) => {
                        const isSelected = flows.activeTab === tab.value;
                        return (
                          <button
                            key={tab.value}
                            ref={tab.value === 'login' ? flows.loginTabRef : flows.registerTabRef}
                            type="button"
                            role="tab"
                            id={`auth-tab-${tab.value}`}
                            aria-selected={isSelected}
                            aria-controls={`auth-panel-${tab.value}`}
                            tabIndex={isSelected ? 0 : -1}
                            className={'mlg-tab' + (isSelected ? ' mlg-tab--active' : '')}
                            onClick={() => flows.selectPrimaryTab(tab.value)}
                            onKeyDown={handleTabKeyDown}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div key={flows.screen} className="mlg-panel-switch">
                    {flows.isSecondary && (
                      <button
                        type="button"
                        className="mlg-back-link"
                        onClick={flows.goToLogin}
                      >
                        <ArrowLeftIcon className="mlg-back-link__icon" />
                        <span>Volver a iniciar sesión</span>
                      </button>
                    )}

                    <div className="mlg-card__head">
                      {secondaryScreen !== null ? (
                        <>
                          <h2
                            ref={flows.screenTitleRef}
                            tabIndex={-1}
                            className="mlg-display mlg-card__title"
                          >
                            {SECONDARY_TITLES[secondaryScreen]}
                          </h2>
                          <p className="mlg-card__subtitle">
                            {getSecondaryInstruction(
                              secondaryScreen,
                              flows.verifyEmailAddress,
                              flows.resetEmail,
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <h2 className="mlg-display mlg-card__title">
                            {flows.activeTab === 'login'
                              ? 'Accede a tu consola'
                              : 'Crea tu cuenta'}
                          </h2>
                          <p className="mlg-card__subtitle">
                            {flows.activeTab === 'login'
                              ? 'Ingresa con tu cuenta de administrador, repartidor o cliente.'
                              : 'Regístrate para solicitar y seguir entregas en tu zona.'}
                          </p>
                        </>
                      )}
                    </div>

                    {flows.requestError !== null && (
                      <div
                        role="alert"
                        className="mlg-banner mlg-banner--error"
                      >
                        <AlertCircleIcon className="mlg-banner__icon" />
                        <span className="mlg-banner__text">{flows.requestError}</span>
                        <button
                          type="button"
                          className="mlg-banner__close"
                          aria-label="Cerrar alerta"
                          onClick={flows.clearError}
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {flows.notice !== null && (
                      <div
                        role="status"
                        aria-live="polite"
                        className={
                          'mlg-banner ' +
                          (flows.notice.type === 'success'
                            ? 'mlg-banner--success'
                            : 'mlg-banner--info')
                        }
                      >
                        <CheckCircleIcon className="mlg-banner__icon" />
                        <span className="mlg-banner__text">
                          <strong>{flows.notice.title}.</strong> {flows.notice.message}
                        </span>
                        <button
                          type="button"
                          className="mlg-banner__close"
                          aria-label="Cerrar aviso"
                          onClick={flows.clearNotice}
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {flows.screen === 'login' && (
                      <AuthLoginForm
                        email={flows.loginEmail}
                        password={flows.loginPassword}
                        onEmailChange={flows.setLoginEmail}
                        onPasswordChange={flows.setLoginPassword}
                        onClearError={flows.clearError}
                        onMarkTouched={flows.markTouched}
                        errorFor={flows.errorFor}
                        onOpenForgotPassword={flows.openForgotPassword}
                        onSubmit={flows.handleLoginSubmit}
                        isSubmitting={flows.isSubmitting}
                      />
                    )}

                    {flows.screen === 'register' && (
                      <AuthRegisterForm
                        email={flows.registerEmail}
                        password={flows.registerPassword}
                        displayName={flows.registerDisplayName}
                        strength={flows.registerStrength}
                        onEmailChange={flows.setRegisterEmail}
                        onPasswordChange={flows.setRegisterPassword}
                        onDisplayNameChange={flows.setRegisterDisplayName}
                        onClearError={flows.clearError}
                        onMarkTouched={flows.markTouched}
                        errorFor={flows.errorFor}
                        onSubmit={flows.handleRegisterSubmit}
                        isSubmitting={flows.isSubmitting}
                      />
                    )}

                    {flows.screen === 'verify-email' && (
                      <AuthVerifyEmailForm
                        code={flows.verifyCode}
                        onCodeChange={flows.setVerifyCode}
                        onClearError={flows.clearError}
                        onMarkTouched={flows.markTouched}
                        errorFor={flows.errorFor}
                        resendCooldown={flows.resendCooldown}
                        onResend={() => {
                          void flows.handleResendVerification();
                        }}
                        onSubmit={flows.handleVerifySubmit}
                        isSubmitting={flows.isSubmitting}
                      />
                    )}

                    {flows.screen === 'forgot-password' && (
                      <AuthForgotPasswordForm
                        email={flows.forgotEmail}
                        onEmailChange={flows.setForgotEmail}
                        onClearError={flows.clearError}
                        onMarkTouched={flows.markTouched}
                        errorFor={flows.errorFor}
                        onSubmit={flows.handleForgotSubmit}
                        isSubmitting={flows.isSubmitting}
                      />
                    )}

                    {flows.screen === 'reset-password' && (
                      <AuthResetPasswordForm
                        email={flows.resetEmail}
                        code={flows.resetCode}
                        newPassword={flows.resetPassword}
                        strength={flows.resetStrength}
                        onEmailChange={flows.setResetEmail}
                        onCodeChange={flows.setResetCode}
                        onPasswordChange={flows.setResetPassword}
                        onClearError={flows.clearError}
                        onMarkTouched={flows.markTouched}
                        errorFor={flows.errorFor}
                        onSubmit={flows.handleResetSubmit}
                        isSubmitting={flows.isSubmitting}
                      />
                    )}
                  </div>

                  <footer className="mlg-footer">
                    <ShieldCheckIcon className="mlg-footer__icon" />
                    <span>Sesión cifrada en tránsito</span>
                  </footer>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

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
  const cardRectRef = useRef<DOMRect | null>(null);
  const tiltSpringRef = useRef({
    rx: 0,
    ry: 0,
    vrx: 0,
    vry: 0,
    tx: 0,
    ty: 0,
    raf: 0,
    last: 0,
  });
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const spring = tiltSpringRef.current;
    return () => {
      if (spring.raf) {
        window.cancelAnimationFrame(spring.raf);
        spring.raf = 0;
      }
    };
  }, []);

  const stepTiltSpring = useCallback((): void => {
    const s = tiltSpringRef.current;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      const stiffness = 170;
      const damping = 22;
      const ax = stiffness * (s.tx - s.rx) - damping * s.vrx;
      const ay = stiffness * (s.ty - s.ry) - damping * s.vry;
      s.vrx += ax * dt;
      s.vry += ay * dt;
      s.rx += s.vrx * dt;
      s.ry += s.vry * dt;

      if (cardRef.current) {
        cardRef.current.style.transform = `rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;
      }

      const settled =
        Math.abs(s.tx - s.rx) < 0.015 &&
        Math.abs(s.ty - s.ry) < 0.015 &&
        Math.abs(s.vrx) < 0.02 &&
        Math.abs(s.vry) < 0.02;

      if (settled) {
        s.rx = s.tx;
        s.ry = s.ty;
        s.vrx = 0;
        s.vry = 0;
        if (cardRef.current) {
          cardRef.current.style.transform =
            s.tx === 0 && s.ty === 0 ? '' : `rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;
        }
        s.raf = 0;
      } else {
        s.raf = window.requestAnimationFrame(tick);
      }
    };
    s.raf = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (flows.shakeNonce === 0) return;
    setIsShaking(false);
    const frame = window.requestAnimationFrame(() => setIsShaking(true));
    return () => window.cancelAnimationFrame(frame);
  }, [flows.shakeNonce]);

  const handleCardPointerEnter = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'touch') return;
    cardRectRef.current = cardRef.current?.getBoundingClientRect() ?? null;
  }, []);

  // Inclinación óptica 3D contenida (±2.1deg) con resorte amortiguado + destello reactivo
  const handleCardPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }
      if (event.pointerType === 'touch') return;
      const card = cardRef.current;
      if (!card) return;

      const rect = cardRectRef.current ?? card.getBoundingClientRect();
      cardRectRef.current = rect;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (glintRef.current) {
        glintRef.current.style.transform = `translate3d(${(x - 88).toFixed(1)}px, ${(y - 88).toFixed(1)}px, 0)`;
      }

      tiltSpringRef.current.ty = (x / rect.width - 0.5) * 4.2;
      tiltSpringRef.current.tx = (y / rect.height - 0.5) * -4.2;
      stepTiltSpring();
    },
    [stepTiltSpring],
  );

  const handleCardPointerLeave = useCallback((): void => {
    cardRectRef.current = null;
    tiltSpringRef.current.tx = 0;
    tiltSpringRef.current.ty = 0;
    stepTiltSpring();
  }, [stepTiltSpring]);

  const { activeTab, loginTabRef, registerTabRef, selectPrimaryTab } = flows;

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const nextTab: AuthTab = activeTab === 'login' ? 'register' : 'login';
      selectPrimaryTab(nextTab);

      if (nextTab === 'login') {
        loginTabRef.current?.focus();
      } else {
        registerTabRef.current?.focus();
      }
    },
    [activeTab, loginTabRef, registerTabRef, selectPrimaryTab],
  );

  const secondaryScreen = flows.isSecondary
    ? (flows.screen as Exclude<AuthScreen, 'login' | 'register'>)
    : null;

  return (
    <div className="mlg-page">
      <div className="mlg-shell">
        <div className="mlg-grid" aria-label="Acceso a Millast">
          <AuthStudioShowcase />

          <section
            className="mlg-enter mlg-delay-3 mlg-card-stage"
            aria-label="Formulario de autenticación"
          >
            <div className="mlg-card-float">
              <div
                ref={cardRef}
                onPointerEnter={handleCardPointerEnter}
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
                        onGoogleCredential={(idToken) => {
                          void flows.handleGoogleLogin(idToken);
                        }}
                        onGoogleUnavailable={flows.reportGoogleUnavailable}
                        googleDisabledByServer={flows.googleDisabledByServer}
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
                        onGoogleCredential={(idToken) => {
                          void flows.handleGoogleLogin(idToken);
                        }}
                        onGoogleUnavailable={flows.reportGoogleUnavailable}
                        googleDisabledByServer={flows.googleDisabledByServer}
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
                    <span aria-hidden="true"> · </span>
                    <a href="/privacidad.html" target="_blank" rel="noopener noreferrer">
                      Privacidad
                    </a>
                    <span aria-hidden="true"> · </span>
                    <a href="/terminos.html" target="_blank" rel="noopener noreferrer">
                      Condiciones
                    </a>
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

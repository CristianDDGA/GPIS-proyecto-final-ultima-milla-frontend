import {
  useCallback,
  useEffect,
  useState,
  type FC,
  type KeyboardEvent,
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
import { GlassIconReveal } from './auth/GlassIconReveal.js';
import { PATH_MARK_SVG } from './auth/glassRevealEngine.js';
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

const CARD_LOGO_TUNING = {
  startZoom: 2.0,
  glide: 2.3,
  present: 2.5,
  response: 0.48,
  dispersion: 1.45,
  colorBleed: 1.1,
  sheen: 1.0,
  lightTurn: 1.0,
} as const;

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
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (flows.shakeNonce === 0) return;
    setIsShaking(false);
    const frame = window.requestAnimationFrame(() => setIsShaking(true));
    return () => window.cancelAnimationFrame(frame);
  }, [flows.shakeNonce]);

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
            className="mlg-enter mlg-delay-2 mlg-card-stage"
            aria-label="Formulario de autenticación"
          >
            <div
              onAnimationEnd={(event) => {
                if (event.animationName === 'mlg-shake-x') {
                  setIsShaking(false);
                }
              }}
              className={'mlg-card' + (isShaking ? ' mlg-shake' : '')}
            >
              <div className="mlg-card__content">
                <div className="mlg-card-brand">
                  <div className="mlg-card-brand__stage">
                    <GlassIconReveal
                      logo={PATH_MARK_SVG}
                      label="Millast"
                      look="light"
                      background="#ffffff"
                      logoColor="#1668f3"
                      tileSize={72}
                      logoScale={0.68}
                      finalScale={0.82}
                      loop
                      speed={0.9}
                      hold={0.9}
                      tuning={CARD_LOGO_TUNING}
                      className="mlg-card-brand__canvas"
                    />
                  </div>
                </div>

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
                    />

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

                  {secondaryScreen !== null && (
                    <div className="mlg-card__head">
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
                    </div>
                  )}

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
          </section>
        </div>
      </div>
    </div>
  );
};

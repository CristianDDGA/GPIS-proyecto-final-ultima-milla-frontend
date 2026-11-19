import { useCallback, type CSSProperties, type FC, type KeyboardEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import type { AuthUser } from '../../domain/index.js';
import { Alert } from '../../../../shared/ui/index.js';
import { useAuthFlows, type AuthScreen, type AuthTab } from '../hooks/useAuthFlows.js';
import { AuthForgotPasswordForm } from './auth/AuthForgotPasswordForm.js';
import { AuthLoginForm } from './auth/AuthLoginForm.js';
import { AuthRegisterForm } from './auth/AuthRegisterForm.js';
import { AuthResetPasswordForm } from './auth/AuthResetPasswordForm.js';
import { AuthStudioShowcase } from './auth/AuthStudioShowcase.js';
import { AuthTopNav } from './auth/AuthTopNav.js';
import { AuthVerifyEmailForm } from './auth/AuthVerifyEmailForm.js';
import { KineticText } from './auth/KineticText.js';
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
        ? `Código de 6 dígitos enviado a ${verifyEmail}.`
        : 'Código de 6 dígitos enviado a tu correo.';
    case 'forgot-password':
      return 'Enviaremos un código de verificación de 6 dígitos a tu correo.';
    case 'reset-password':
      return `Código enviado a ${resetEmail.length > 0 ? resetEmail : 'tu correo'}.`;
  }
}

export const AuthView: FC<AuthViewProps> = ({ useCases, onAuthenticated }) => {
  const flows = useAuthFlows({ useCases, onAuthenticated });

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

  const primaryTitle = flows.activeTab === 'login' ? 'Accede a tu consola' : 'Crea tu cuenta';
  const segmentedStyle = {
    '--wf-seg-index': flows.activeTab === 'login' ? 0 : 1,
  } as CSSProperties;

  return (
    <div className="wf-auth-studio">
      <AuthTopNav />

      <main className="wf-auth-main" aria-label="Acceso a Millast">
        <AuthStudioShowcase />

        <section className="wf-auth-card" aria-label="Formulario de autenticación">
          <div className="wf-auth-card__body">
            {!flows.isSecondary ? (
              <>
                <div
                  className="wf-segmented"
                  role="tablist"
                  aria-label="Modo de acceso"
                  style={segmentedStyle}
                >
                  <span className="wf-segmented__thumb" aria-hidden="true" />
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
                        className={'wf-tab ' + (isSelected ? 'wf-tab--active' : '')}
                        onClick={() => flows.selectPrimaryTab(tab.value)}
                        onKeyDown={handleTabKeyDown}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <header className="wf-auth-card__head">
                  <KineticText
                    key={primaryTitle}
                    as="h2"
                    text={primaryTitle}
                    className="wf-auth-card__title"
                    staggerMs={45}
                  />
                  <p className="wf-auth-card__instruction">
                    {flows.activeTab === 'login'
                      ? 'Ingresa con tu cuenta de administrador, repartidor o cliente.'
                      : 'Regístrate para solicitar y seguir entregas en tu zona.'}
                  </p>
                </header>
              </>
            ) : (
              <>
                <button type="button" className="wf-back-link" onClick={flows.goToLogin}>
                  ← Volver a iniciar sesión
                </button>

                {secondaryScreen !== null && (
                  <header className="wf-auth-card__head">
                    <KineticText
                      key={SECONDARY_TITLES[secondaryScreen]}
                      as="h2"
                      elementRef={flows.screenTitleRef}
                      tabIndex={-1}
                      text={SECONDARY_TITLES[secondaryScreen]}
                      className="wf-auth-card__title"
                      staggerMs={45}
                    />
                    <p className="wf-auth-card__instruction">
                      {getSecondaryInstruction(
                        secondaryScreen,
                        flows.verifyEmailAddress,
                        flows.resetEmail,
                      )}
                    </p>
                  </header>
                )}
              </>
            )}

            {flows.requestError !== null && (
              <Alert type="error" title="Atención" onClose={flows.clearError}>
                {flows.requestError}
              </Alert>
            )}

            {flows.notice !== null && (
              <Alert type={flows.notice.type} title={flows.notice.title} onClose={flows.clearNotice}>
                {flows.notice.message}
              </Alert>
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

            <footer className="wf-auth-card__footer">
              <span className="wf-auth-card__trust">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path
                    d="M8 1.6 13.2 3.6v4.1c0 3.1-2.1 5.7-5.2 6.9-3.1-1.2-5.2-3.8-5.2-6.9V3.6L8 1.6Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m5.8 8 1.5 1.5L10.4 6.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sesión cifrada en tránsito
              </span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
};

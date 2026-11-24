import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
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

export type AuthScreen = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';
export type AuthTab = 'login' | 'register';

export interface AuthNotice {
  readonly type: 'success' | 'info';
  readonly title: string;
  readonly message: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function isEmailNotVerified(error: unknown): boolean {
  return error instanceof HttpError && error.code === 'EMAIL_NOT_VERIFIED';
}

function focusFirstInvalid(screen: AuthScreen, errors: ValidationErrors): void {
  const orderByScreen: Record<AuthScreen, readonly { readonly field: string; readonly id: string }[]> = {
    login: [
      { field: 'email', id: 'auth-login-email' },
      { field: 'password', id: 'auth-login-password' },
    ],
    register: [
      { field: 'displayName', id: 'auth-register-display-name' },
      { field: 'email', id: 'auth-register-email' },
      { field: 'password', id: 'auth-register-password' },
    ],
    'verify-email': [{ field: 'code', id: 'auth-verify-code' }],
    'forgot-password': [{ field: 'email', id: 'auth-forgot-email' }],
    'reset-password': [
      { field: 'email', id: 'auth-reset-email' },
      { field: 'code', id: 'auth-reset-code' },
      { field: 'newPassword', id: 'auth-reset-password' },
    ],
  };

  for (const item of orderByScreen[screen]) {
    if (errors[item.field]) {
      document.getElementById(item.id)?.focus();
      return;
    }
  }
}

function computeValidationErrors(
  screen: AuthScreen,
  values: {
    loginEmail: string;
    loginPassword: string;
    registerEmail: string;
    registerPassword: string;
    registerDisplayName: string;
    verifyEmailAddress: string;
    verifyCode: string;
    forgotEmail: string;
    resetEmail: string;
    resetCode: string;
    resetPassword: string;
  },
): ValidationErrors {
  switch (screen) {
    case 'register':
      return validateRegisterCustomerInput({
        email: values.registerEmail,
        password: values.registerPassword,
        displayName: values.registerDisplayName,
      }).errors;
    case 'verify-email':
      return validateVerifyEmailInput({
        email: values.verifyEmailAddress,
        code: values.verifyCode,
      }).errors;
    case 'forgot-password':
      return validateForgotPasswordInput({ email: values.forgotEmail }).errors;
    case 'reset-password':
      return validateResetPasswordInput({
        email: values.resetEmail,
        code: values.resetCode,
        newPassword: values.resetPassword,
      }).errors;
    default:
      return validateLoginInput({
        email: values.loginEmail,
        password: values.loginPassword,
      }).errors;
  }
}

export interface UseAuthFlowsParams {
  readonly useCases: AuthUseCases;
  readonly onAuthenticated?: ((user: AuthUser) => void) | undefined;
}

export function useAuthFlows({ useCases, onAuthenticated }: UseAuthFlowsParams) {
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [googleDisabledByServer, setGoogleDisabledByServer] = useState(false);

  const mountedRef = useRef(true);
  const screenTitleRef = useRef<HTMLHeadingElement | null>(null);
  const loginTabRef = useRef<HTMLButtonElement | null>(null);
  const registerTabRef = useRef<HTMLButtonElement | null>(null);
  const restoreLoginFocusRef = useRef(false);

  const triggerShake = useCallback((): void => {
    setShakeNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (screen !== 'login' && screen !== 'register') {
      const frame = window.requestAnimationFrame(() => screenTitleRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }

    if (screen === 'login' && restoreLoginFocusRef.current) {
      restoreLoginFocusRef.current = false;
      const frame = window.requestAnimationFrame(() => loginTabRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [screen]);

  const switchScreen = useCallback((next: AuthScreen): void => {
    setScreen(next);
    setTouched({});
    setRequestError(null);
  }, []);

  const selectPrimaryTab = useCallback(
    (tab: AuthTab): void => {
      if (isSubmitting) return;
      setNotice(null);
      switchScreen(tab);
    },
    [isSubmitting, switchScreen],
  );

  const goToLogin = useCallback((): void => {
    restoreLoginFocusRef.current = true;
    setLoginPassword('');
    switchScreen('login');
  }, [switchScreen]);

  const openForgotPassword = useCallback((): void => {
    if (isSubmitting) return;
    setForgotEmail(loginEmail);
    setNotice(null);
    switchScreen('forgot-password');
  }, [isSubmitting, loginEmail, switchScreen]);

  const clearError = useCallback((): void => setRequestError(null), []);
  const clearNotice = useCallback((): void => setNotice(null), []);

  const markTouched = useCallback((field: string): void => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }, []);

  const validation = computeValidationErrors(screen, {
    loginEmail,
    loginPassword,
    registerEmail,
    registerPassword,
    registerDisplayName,
    verifyEmailAddress,
    verifyCode,
    forgotEmail,
    resetEmail,
    resetCode,
    resetPassword,
  });

  const errorFor = useCallback(
    (field: string): string | undefined => (touched[field] ? validation[field] : undefined),
    [touched, validation],
  );

  const registerStrength: PasswordStrength = evaluatePasswordStrength(
    registerPassword,
    registerEmail,
  );
  const resetStrength: PasswordStrength = evaluatePasswordStrength(resetPassword, resetEmail);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    setRequestError(null);
    setTouched({ email: true, password: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa los datos de acceso.');
      triggerShake();
      focusFirstInvalid('login', validation);
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await useCases.login.execute({ email: loginEmail, password: loginPassword });
      setToken(session.token);

      if (mountedRef.current) {
        // No se vacía la contraseña aquí: la pantalla de acceso sigue visible hasta que /auth/me responde y,
        // con el campo ya tocado, vaciarlo hacía aparecer "La contraseña debe tener entre…" justo antes de entrar.
        // Al iniciar sesión la vista se desmonta y el estado se descarta; goToLogin ya limpia la clave si se vuelve.
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
        triggerShake();
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    setRequestError(null);
    setTouched({ email: true, password: true, displayName: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa los datos de registro.');
      triggerShake();
      focusFirstInvalid('register', validation);
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
        triggerShake();
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleVerifySubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    setRequestError(null);
    setTouched({ code: true, email: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Revisa el código ingresado.');
      triggerShake();
      focusFirstInvalid('verify-email', validation);
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
        triggerShake();
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
        triggerShake();
      }
    }
  };

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    setRequestError(null);
    setTouched({ email: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(firstValidationError(validation) ?? 'Ingresa un correo electrónico válido.');
      triggerShake();
      focusFirstInvalid('forgot-password', validation);
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
        triggerShake();
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    setRequestError(null);
    setTouched({ email: true, code: true, newPassword: true });

    if (Object.keys(validation).length > 0) {
      setRequestError(
        firstValidationError(validation) ?? 'Revisa el código y la nueva contraseña.',
      );
      triggerShake();
      focusFirstInvalid('reset-password', validation);
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
        restoreLoginFocusRef.current = true;
        switchScreen('login');
      }
    } catch (error_) {
      if (mountedRef.current) {
        setRequestError(toErrorMessage(error_, 'No se pudo restablecer la contraseña.'));
        triggerShake();
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const reportGoogleUnavailable = useCallback(
    (message: string): void => {
      setNotice(null);
      setRequestError(message);
      triggerShake();
    },
    [triggerShake],
  );

  const handleGoogleLogin = useCallback(
    async (idToken: string): Promise<void> => {
      if (isSubmitting) return;
      setRequestError(null);
      setNotice(null);
      setIsSubmitting(true);
      try {
        const session = await useCases.loginWithGoogle.execute(idToken);
        setToken(session.token);
        if (mountedRef.current) {
          onAuthenticated?.(session.user);
        }
      } catch (error_) {
        if (!mountedRef.current) return;
        if (error_ instanceof HttpError && error_.code === 'GOOGLE_NOT_ENABLED') {
          setGoogleDisabledByServer(true);
          setRequestError(
            'El inicio de sesión con Google está deshabilitado en el servidor (configura GOOGLE_CLIENT_ID en el backend).',
          );
          triggerShake();
          return;
        }
        setRequestError(
          toErrorMessage(error_, 'No se pudo iniciar sesión con Google.'),
        );
        triggerShake();
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [isSubmitting, onAuthenticated, triggerShake, useCases.loginWithGoogle],
  );

  return {
    screen,
    activeTab: (screen === 'register' ? 'register' : 'login') as AuthTab,
    isSecondary: screen !== 'login' && screen !== 'register',
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    registerDisplayName,
    setRegisterDisplayName,
    verifyEmailAddress,
    verifyCode,
    setVerifyCode,
    forgotEmail,
    setForgotEmail,
    resetEmail,
    setResetEmail,
    resetCode,
    setResetCode,
    resetPassword,
    setResetPassword,
    requestError,
    notice,
    isSubmitting,
    resendCooldown,
    shakeNonce,
    registerStrength,
    resetStrength,
    screenTitleRef,
    loginTabRef,
    registerTabRef,
    errorFor,
    markTouched,
    clearError,
    clearNotice,
    selectPrimaryTab,
    goToLogin,
    openForgotPassword,
    handleLoginSubmit,
    handleGoogleLogin,
    reportGoogleUnavailable,
    googleDisabledByServer,
    handleRegisterSubmit,
    handleVerifySubmit,
    handleResendVerification,
    handleForgotSubmit,
    handleResetSubmit,
  };
}

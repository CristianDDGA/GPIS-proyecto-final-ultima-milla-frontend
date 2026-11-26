import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthGateway } from '../../domain/authGateway.js';
import type {
  AuthStatus,
  AuthUser,
  LoginInput,
  RegisterCustomerInput,
  RegisterCustomerOutcome,
} from '../../domain/authUser.js';
import {
  firstValidationError,
  validateLoginInput,
  validateRegisterCustomerInput,
} from '../../domain/index.js';
import {
  GetCurrentUserUseCase,
  LoginUseCase,
  LogoutUseCase,
  RegisterCustomerUseCase,
} from '../../application/index.js';
import { clearToken, getToken, setToken } from '../../infrastructure/http/authTokenStorage.js';
import { HttpError } from '../../../../shared/infrastructure/http/index.js';

export interface UseAuthResult {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  isSubmitting: boolean;
  login: (input: LoginInput) => Promise<boolean>;
  registerCustomer: (input: RegisterCustomerInput) => Promise<RegisterCustomerOutcome | null>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<AuthUser | null>;
  clearError: () => void;
  forceSignOut: () => void;
}

const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha expirado. Inicia sesión nuevamente.';

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export function useAuth(gateway: AuthGateway): UseAuthResult {
  const useCases = useMemo(
    () => ({
      login: new LoginUseCase(gateway),
      registerCustomer: new RegisterCustomerUseCase(gateway),
      getCurrentUser: new GetCurrentUserUseCase(gateway),
      logout: new LogoutUseCase(gateway),
    }),
    [gateway],
  );

  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() === null ? 'unauthenticated' : 'loading',
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mountedRef = useRef(true);

  const hydrateSession = useCallback(async (): Promise<void> => {
    const token = getToken();

    if (token === null) {
      if (mountedRef.current) {
        setStatus('unauthenticated');
      }
      return;
    }

    if (mountedRef.current) {
      setStatus('loading');
    }

    try {
      const currentUser = await useCases.getCurrentUser.execute();
      if (!mountedRef.current) {
        return;
      }

      setUser(currentUser);
      setStatus('authenticated');
    } catch {
      clearToken();
      if (!mountedRef.current) {
        return;
      }

      setUser(null);
      setStatus('unauthenticated');
    }
  }, [useCases]);

  useEffect(() => {
    mountedRef.current = true;
    void hydrateSession();

    return () => {
      mountedRef.current = false;
    };
  }, [hydrateSession]);

  const login = useCallback(
    async (input: LoginInput): Promise<boolean> => {
      setError(null);

      const validation = validateLoginInput(input);
      if (!validation.isValid) {
        setError(firstValidationError(validation.errors) ?? 'Revisa los datos de acceso ingresados.');
        return false;
      }

      setIsSubmitting(true);

      try {
        const session = await useCases.login.execute(input);
        setToken(session.token);

        if (mountedRef.current) {
          setUser(session.user);
          setStatus('authenticated');
          setError(null);
        }

        return true;
      } catch (error_) {
        if (mountedRef.current) {
          setError(
            toErrorMessage(error_, 'No se pudo iniciar sesión. Verifica tu correo y contraseña.'),
          );
        }

        return false;
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [useCases],
  );

  const registerCustomer = useCallback(
    async (input: RegisterCustomerInput): Promise<RegisterCustomerOutcome | null> => {
      setError(null);

      const validation = validateRegisterCustomerInput(input);
      if (!validation.isValid) {
        setError(firstValidationError(validation.errors) ?? 'Revisa los datos de registro.');
        return null;
      }

      setIsSubmitting(true);

      try {
        const outcome = await useCases.registerCustomer.execute(input);

        // En modo verificación no hay sesión: el alta queda pendiente del código de correo.
        if (outcome.kind === 'session') {
          setToken(outcome.session.token);

          if (mountedRef.current) {
            setUser(outcome.session.user);
            setStatus('authenticated');
            setError(null);
          }
        }

        return outcome;
      } catch (error_) {
        if (mountedRef.current) {
          setError(toErrorMessage(error_, 'No se pudo completar el registro de la cuenta.'));
        }

        return null;
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [useCases],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      await useCases.logout.execute();
    } catch {
      // The local session is closed even when the server-side revocation fails.
    } finally {
      clearToken();
      if (mountedRef.current) {
        setUser(null);
        setStatus('unauthenticated');
        setIsSubmitting(false);
      }
    }
  }, [useCases]);

  const refreshMe = useCallback(async (): Promise<AuthUser | null> => {
    setError(null);

    try {
      const currentUser = await useCases.getCurrentUser.execute();
      if (!mountedRef.current) {
        return currentUser;
      }

      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch (error_) {
      if (!mountedRef.current) {
        return null;
      }

      if (error_ instanceof HttpError && error_.status === 401) {
        clearToken();
        setUser(null);
        setStatus('unauthenticated');
        setError(SESSION_EXPIRED_MESSAGE);
        return null;
      }

      setError(toErrorMessage(error_, 'No se pudo actualizar el perfil de la sesión.'));
      return null;
    }
  }, [useCases]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const forceSignOut = useCallback((): void => {
    clearToken();

    if (!mountedRef.current) {
      return;
    }

    setUser(null);
    setStatus('unauthenticated');
    setError(SESSION_EXPIRED_MESSAGE);
  }, []);

  return {
    status,
    user,
    error,
    isSubmitting,
    login,
    registerCustomer,
    logout,
    refreshMe,
    clearError,
    forceSignOut,
  };
}

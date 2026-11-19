import {useCallback, useEffect, useState} from 'react';
import type {AuthUser} from '../../domain/authUser';
import type {HttpAuthGateway} from '../../infrastructure/httpAuthGateway';
import {
  loadStoredToken,
  saveStoredToken,
} from '../../../../shared/infrastructure/storage/sessionStorage';
import {runAsync} from '../../../../shared/utils/format';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface UseAuthResult {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly applySession: (token: string, user: AuthUser) => Promise<void>;
  readonly refreshMe: () => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly forceSignOut: (message?: string) => void;
  readonly clearError: () => void;
}

export function useAuth(gateway: HttpAuthGateway, onTokenChange: (token: string | null) => void): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hydrate = useCallback(async () => {
    setStatus('loading');
    const token = await loadStoredToken();
    onTokenChange(token);
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const me = await gateway.getMe();
      setUser(me);
      setStatus('authenticated');
      setError(null);
    } catch {
      await saveStoredToken(null);
      onTokenChange(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [gateway, onTokenChange]);

  useEffect(() => {
    runAsync(hydrate());
  }, [hydrate]);

  const applySession = useCallback(
    async (token: string, nextUser: AuthUser) => {
      onTokenChange(token);
      await saveStoredToken(token);
      setUser(nextUser);
      setStatus('authenticated');
      setError(null);
    },
    [onTokenChange],
  );

  const refreshMe = useCallback(async () => {
    try {
      const me = await gateway.getMe();
      setUser(me);
      setStatus('authenticated');
    } catch {
      await saveStoredToken(null);
      onTokenChange(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [gateway, onTokenChange]);

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await gateway.logout();
    } catch {
      // Cerramos la sesión local aun si el servidor ya revocó el token.
    } finally {
      await saveStoredToken(null);
      onTokenChange(null);
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      setIsSubmitting(false);
    }
  }, [gateway, onTokenChange]);

  const forceSignOut = useCallback(
    (message?: string) => {
      runAsync(saveStoredToken(null));
      onTokenChange(null);
      setUser(null);
      setStatus('unauthenticated');
      if (message) setError(message);
    },
    [onTokenChange],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    user,
    error,
    isSubmitting,
    applySession,
    refreshMe,
    logout,
    forceSignOut,
    clearError,
  };
}

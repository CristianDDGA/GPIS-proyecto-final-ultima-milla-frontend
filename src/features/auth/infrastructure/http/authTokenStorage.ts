export const AUTH_TOKEN_STORAGE_KEY = 'gpis_ultima_milla_jwt';

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage;
  } catch {
    // Private mode or blocked storage must never break the application.
    return null;
  }
}

export function getToken(): string | null {
  try {
    const token = getStorage()?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;

    if (token === null || token.trim().length === 0) {
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    getStorage()?.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage is optional: an unavailable localStorage must not block the session.
  }
}

export function clearToken(): void {
  try {
    getStorage()?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Storage is optional: an unavailable localStorage must not block the sign out.
  }
}

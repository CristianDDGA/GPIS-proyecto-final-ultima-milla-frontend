import {
  isAuthRole,
  isPublicRole,
  type AuthSession,
  type AuthUser,
  type RegisterCustomerOutcome,
} from '../../domain/index.js';

export const CONTRACT_ERROR_MESSAGE =
  'La respuesta del servidor no cumple el contrato de la API.';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isNonEmptyString(value.authSubject) &&
    isNonEmptyString(value.email) &&
    isAuthRole(value.role) &&
    isPublicRole(value.publicRole) &&
    isNullableString(value.displayName) &&
    typeof value.isActive === 'boolean' &&
    isNullableString(value.courierId)
  );
}

export function readAuthUser(value: unknown): AuthUser {
  if (!isRecord(value) || !isAuthUser(value.user)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  return value.user;
}

export function readAuthSession(value: unknown): AuthSession {
  if (!isRecord(value) || !isNonEmptyString(value.token) || !isAuthUser(value.user)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  return {
    token: value.token,
    user: value.user,
  };
}

export function isHealthOnline(value: unknown): boolean {
  return isRecord(value) && value.status === 'ok';
}
/**
 * El registro puede responder con sesión inmediata (`{ token, user }`) o pedir la verificación
 * del correo (`{ user, verificationRequired: true }`, backend con `EMAIL_VERIFICATION_REQUIRED=true`).
 */
export function readRegisterOutcome(value: unknown): RegisterCustomerOutcome {
  if (isRecord(value) && isNonEmptyString(value['token']) && isAuthUser(value['user'])) {
    return {
      kind: 'session',
      session: { token: value['token'], user: value['user'] },
    };
  }

  if (isRecord(value) && value['verificationRequired'] === true && isAuthUser(value['user'])) {
    return { kind: 'verification_required', user: value['user'] };
  }

  throw new Error(CONTRACT_ERROR_MESSAGE);
}

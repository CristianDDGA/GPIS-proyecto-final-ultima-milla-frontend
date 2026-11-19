import {
  isAuthRole,
  isPublicRole,
  validatePasswordPolicy,
  type AuthRole,
  type AuthUser,
  type PublicRole,
  type ValidationErrors,
  type ValidationResult,
} from './authUser.js';

export type EmailVerifiedVia = 'code' | 'admin' | 'legacy' | 'demo';

export const EMAIL_VERIFIED_VIA_VALUES: readonly EmailVerifiedVia[] = ['code', 'admin', 'legacy', 'demo'];

/** Vista administrativa del usuario: nunca incluye hash de contraseña. */
export interface ManagedUser extends AuthUser {
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly emailVerifiedVia: EmailVerifiedVia | null;
}

export type ManagedUserDetail = ManagedUser;

export interface ManagedUserPage {
  readonly items: readonly ManagedUser[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ManagedUserFilters {
  readonly role?: PublicRole | 'all' | undefined;
  readonly isActive?: boolean | 'all' | undefined;
  readonly q?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface SetManagedUserActiveInput {
  readonly userId: string;
  readonly isActive: boolean;
}

export interface ResetManagedUserPasswordInput {
  readonly userId: string;
  readonly newPassword: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidText(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isEmailVerifiedVia(value: unknown): value is EmailVerifiedVia | null {
  return value === null || (typeof value === 'string' && (EMAIL_VERIFIED_VIA_VALUES as readonly string[]).includes(value));
}

export function validateChangePasswordInput(input: ChangePasswordInput): ValidationResult {
  const errors: ValidationErrors = {};

  if (input.currentPassword.trim().length === 0) {
    errors.currentPassword = 'Ingresa tu contraseña actual.';
  }

  const policyError = validatePasswordPolicy(input.newPassword);
  if (policyError !== null) {
    errors.newPassword = policyError;
  }

  if (input.newPassword === input.currentPassword && input.newPassword.length > 0) {
    errors.newPassword = 'La nueva contraseña debe ser diferente de la actual.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateResetManagedUserPasswordInput(
  input: ResetManagedUserPasswordInput,
): ValidationResult {
  const errors: ValidationErrors = {};

  if (!isUuidText(input.userId)) {
    errors.userId = 'El identificador de usuario no es válido.';
  }

  const policyError = validatePasswordPolicy(input.newPassword);
  if (policyError !== null) {
    errors.newPassword = policyError;
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/** Traduce la vista administrativa a las etiquetas visibles del producto. */
export const PUBLIC_ROLE_LABELS: Record<PublicRole, string> = {
  admin: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

export const APP_ROLE_LABELS: Record<AuthRole, string> = {
  personal: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

export { isAuthRole, isPublicRole };

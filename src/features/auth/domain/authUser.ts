export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type HealthStatus = 'checking' | 'online' | 'offline';

export type AuthRole = 'personal' | 'repartidor' | 'cliente';

export type PublicRole = 'admin' | 'repartidor' | 'cliente';

export const PUBLIC_ROLES: readonly PublicRole[] = ['admin', 'repartidor', 'cliente'];

export interface AuthUser {
  id: string;
  authSubject: string;
  email: string;
  role: AuthRole;
  publicRole: PublicRole;
  displayName: string | null;
  isActive: boolean;
  courierId: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterCustomerInput {
  email: string;
  password: string;
  displayName?: string | null | undefined;
}

export interface CreateManagedUserInput {
  email: string;
  password: string;
  role: PublicRole;
  displayName?: string | null | undefined;
}

export type ValidationErrors = Record<string, string>;

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_VALUES: ReadonlySet<string> = new Set(PUBLIC_ROLES);

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const DISPLAY_NAME_MAX_LENGTH = 120;

const AUTH_ROLE_VALUES: ReadonlySet<string> = new Set(['personal', 'repartidor', 'cliente']);

export function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === 'string' && AUTH_ROLE_VALUES.has(value);
}

export function isPublicRole(value: unknown): value is PublicRole {
  return typeof value === 'string' && ROLE_VALUES.has(value);
}

function validateEmailField(email: string, errors: ValidationErrors): void {
  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    errors.email = 'El correo electrónico es obligatorio.';
    return;
  }

  if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
    errors.email = `El correo electrónico no puede superar los ${EMAIL_MAX_LENGTH} caracteres.`;
    return;
  }

  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'El formato del correo electrónico no es válido.';
  }
}

function validatePasswordField(password: string, errors: ValidationErrors): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
}

function validateDisplayNameField(
  displayName: string | null | undefined,
  errors: ValidationErrors,
): void {
  if (typeof displayName !== 'string') {
    return;
  }

  if (displayName.trim().length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `El nombre para mostrar no puede superar los ${DISPLAY_NAME_MAX_LENGTH} caracteres.`;
  }
}

function buildResult(errors: ValidationErrors): ValidationResult {
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Returns the first validation message in insertion order, or null when the form is valid.
 * Pure helper shared by forms, use cases and the auth hook.
 */
export function firstValidationError(errors: ValidationErrors): string | null {
  for (const message of Object.values(errors)) {
    if (message.length > 0) {
      return message;
    }
  }

  return null;
}

export function validateLoginInput(input: { email: string; password: string }): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors);
  validatePasswordField(input.password, errors);

  return buildResult(errors);
}

export function validateRegisterCustomerInput(input: {
  email: string;
  password: string;
  displayName?: string | null | undefined;
}): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors);
  validatePasswordField(input.password, errors);
  validateDisplayNameField(input.displayName, errors);

  return buildResult(errors);
}

export function validateCreateManagedUserInput(input: {
  email: string;
  password: string;
  role: string;
  displayName?: string | null | undefined;
}): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors);
  validatePasswordField(input.password, errors);

  if (!ROLE_VALUES.has(input.role)) {
    errors.role = 'Selecciona un rol válido: administrador, repartidor o cliente.';
  }

  validateDisplayNameField(input.displayName, errors);

  return buildResult(errors);
}

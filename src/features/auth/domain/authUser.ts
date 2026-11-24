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
  /** Presente desde el contrato de verificación de correo; opcional para respuestas antiguas. */
  emailVerified?: boolean | undefined;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

/** Resultado del registro propio: sesión directa (modo demo) o verificación de correo pendiente. */
export type RegisterCustomerOutcome =
  | { readonly kind: 'session'; readonly session: AuthSession }
  | { readonly kind: 'verification_required'; readonly user: AuthUser };

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterCustomerInput {
  email: string;
  password: string;
  displayName?: string | null | undefined;
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
}

export type ValidationErrors = Record<string, string>;

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

/** Forma básica usuario@dominio.tld sin espacios (sin regex con retroceso). */
function isBasicEmail(value: string): boolean {
  if (/\s/.test(value)) {
    return false;
  }
  const parts = value.split('@');
  if (parts.length !== 2) {
    return false;
  }
  const [local = '', domain = ''] = parts;
  const lastDot = domain.lastIndexOf('.');
  return local.length > 0 && lastDot > 0 && lastDot < domain.length - 1;
}

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

/** Mensajes alineados con `password-policy.ts` del backend. */
const WEAK_PASSWORD_MESSAGE =
  'La contraseña es demasiado común o fácil de adivinar. Usa una frase o combinación más larga y única.';
const DIGITS_ONLY_MESSAGE = 'La contraseña no puede ser solo números.';
const EMAIL_INSIDE_PASSWORD_MESSAGE = 'La contraseña no puede contener tu correo electrónico.';

const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', '123123123', '11111111', '00000000', '87654321', '12341234',
  'qwertyui', 'qwerty123', 'qwertyuiop', 'qwerty12', '1q2w3e4r', '1qaz2wsx', 'abc12345', 'abcd1234', 'abcdefgh',
  'iloveyou', 'admin123', 'admin1234', 'administrator', 'welcome1', 'welcome123', 'letmein1', 'monkey123',
  'dragon123', 'football1', 'baseball1', 'superman1', 'sunshine1', 'princess1', 'changeme', 'changeme123',
  'contrasena', 'contrasena1', 'contrasena123', 'clave1234', 'clave12345', 'bienvenido', 'bienvenido1',
  'usuario123', 'test1234', 'ecuador123', 'ambato123', 'uta12345',
]);

const WEAK_BASE_WORDS: ReadonlySet<string> = new Set([
  'password', 'contrasena', 'contraseña', 'qwerty', 'admin', 'administrator', 'welcome', 'letmein', 'clave',
  'bienvenido', 'usuario', 'iloveyou',
]);

const MAX_DECORATION = 6;

const EMAIL_LOCAL = /^[a-z0-9]+(?:[._%+-][a-z0-9]+)*$/;
const EMAIL_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_TLD = /^[a-z]{2,24}$/;
const PERSON_NAME = /^\p{L}[\p{L}\p{M}]*(?:(?:\.? |['’-])\p{L}[\p{L}\p{M}]*)*\.?$/u;
const ONE_TIME_CODE = /^\d{6}$/;

function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function countLetters(value: string): number {
  return (value.match(/\p{L}/gu) ?? []).length;
}

function validateEmailField(email: string, errors: ValidationErrors, strict: boolean): void {
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedEmail.length === 0) {
    errors.email = 'El correo electrónico es obligatorio.';
    return;
  }

  if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
    errors.email = 'El correo electrónico no puede superar los ' + EMAIL_MAX_LENGTH + ' caracteres.';
    return;
  }

  if (!strict) {
    if (!isBasicEmail(trimmedEmail)) {
      errors.email = 'El formato del correo electrónico no es válido.';
    }
    return;
  }

  const parts = trimmedEmail.split('@');
  const domain = parts[1] ?? '';
  const labels = domain.split('.');
  const hasValidShape =
    parts.length === 2 &&
    trimmedEmail.length <= 254 &&
    (parts[0]?.length ?? 0) > 0 &&
    (parts[0]?.length ?? 0) <= 64 &&
    EMAIL_LOCAL.test(parts[0] ?? '') &&
    labels.length >= 2 &&
    labels.every((label) => EMAIL_LABEL.test(label)) &&
    EMAIL_TLD.test(labels[labels.length - 1] ?? '');

  if (!hasValidShape) {
    errors.email =
      'El formato del correo electrónico no es válido. Usa letras, números y . _ % + - sin emojis ni espacios.';
  }
}

function validatePasswordField(password: string, errors: ValidationErrors): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    errors.password =
      'La contraseña debe tener entre ' + PASSWORD_MIN_LENGTH + ' y ' + PASSWORD_MAX_LENGTH + ' caracteres.';
  }
}

/** Mismas reglas que `validateNewPassword` del backend (registro, alta administrativa y recuperación). */
function validateNewPasswordField(
  password: string,
  email: string,
  errors: ValidationErrors,
  field: 'password' | 'newPassword' = 'password',
): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    errors[field] =
      'La contraseña debe tener entre ' + PASSWORD_MIN_LENGTH + ' y ' + PASSWORD_MAX_LENGTH + ' caracteres.';
    return;
  }

  const lower = password.toLowerCase();
  const letters = lower.replace(/[^a-záéíóúñ]/g, '');
  const localPart = email.trim().toLowerCase().split('@')[0] ?? '';

  if (new Set(lower).size < 3) {
    errors[field] = WEAK_PASSWORD_MESSAGE;
    return;
  }

  if (/^\d+$/.test(password)) {
    errors[field] = DIGITS_ONLY_MESSAGE;
    return;
  }

  if (COMMON_PASSWORDS.has(lower)) {
    errors[field] = WEAK_PASSWORD_MESSAGE;
    return;
  }

  if (WEAK_BASE_WORDS.has(letters) && lower.length <= letters.length + MAX_DECORATION) {
    errors[field] = WEAK_PASSWORD_MESSAGE;
    return;
  }

  if (
    email.trim().length > 0 &&
    (lower === email.trim().toLowerCase() || (localPart.length >= 4 && lower.includes(localPart)))
  ) {
    errors[field] = EMAIL_INSIDE_PASSWORD_MESSAGE;
  }
}

function validateDisplayNameField(
  displayName: string | null | undefined,
  errors: ValidationErrors,
  strict: boolean,
): void {
  if (typeof displayName !== 'string') {
    return;
  }

  const text = normalizeText(displayName);

  if (text.length === 0) {
    return;
  }

  if (text.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = 'El nombre para mostrar no puede superar los ' + DISPLAY_NAME_MAX_LENGTH + ' caracteres.';
    return;
  }

  if (!strict) {
    return;
  }

  if (countLetters(text) < 2) {
    errors.displayName = 'El nombre debe tener al menos 2 letras.';
    return;
  }

  if (!PERSON_NAME.test(text)) {
    errors.displayName =
      'El nombre solo admite letras, espacios, apóstrofo, guion y punto; no se permiten números, emojis ni símbolos.';
  }
}

function validateOneTimeCodeField(code: string, errors: ValidationErrors, field = 'code'): void {
  if (!ONE_TIME_CODE.test(code.trim())) {
    errors[field] = 'El código debe tener exactamente 6 dígitos.';
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

  validateEmailField(input.email, errors, false);
  validatePasswordField(input.password, errors);

  return buildResult(errors);
}

export function validateRegisterCustomerInput(input: {
  email: string;
  password: string;
  displayName?: string | null | undefined;
}): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors, true);
  validateNewPasswordField(input.password, input.email, errors);
  validateDisplayNameField(input.displayName, errors, true);

  return buildResult(errors);
}

export function validateVerifyEmailInput(input: VerifyEmailInput): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors, false);
  validateOneTimeCodeField(input.code, errors);

  return buildResult(errors);
}

export function validateForgotPasswordInput(input: ForgotPasswordInput): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors, false);

  return buildResult(errors);
}

export function validateResetPasswordInput(input: ResetPasswordInput): ValidationResult {
  const errors: ValidationErrors = {};

  validateEmailField(input.email, errors, false);
  validateOneTimeCodeField(input.code, errors);
  validateNewPasswordField(input.newPassword, input.email, errors, 'newPassword');

  return buildResult(errors);
}

/** Fuerza percibida para el medidor compacto de 3 píldoras (no sustituye la validación). */
export function evaluatePasswordStrength(password: string, email = ''): PasswordStrength {
  const errors: ValidationErrors = {};
  validateNewPasswordField(password, email, errors);

  if (password.length === 0 || Object.keys(errors).length > 0) {
    return 'weak';
  }

  const distinct = new Set(password.toLowerCase()).size;
  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^\p{L}\d]/u.test(password);
  const variety = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length;

  if (password.length >= 14 && distinct >= 8 && variety >= 2) {
    return 'strong';
  }

  if (password.length >= 10 && distinct >= 5 && variety >= 2) {
    return 'medium';
  }

  return 'weak';
}

/** Mensaje de la política de contraseñas del backend, o null si la clave es válida. */
export function validatePasswordPolicy(password: string, email = ''): string | null {
  const errors: ValidationErrors = {};
  validateNewPasswordField(password, email, errors, 'newPassword');
  return errors['newPassword'] ?? null;
}

/** Valida solo el nombre para mostrar (mismas reglas que el registro); null si es válido. */
export function validateDisplayName(displayName: string): string | null {
  const errors: ValidationErrors = {};
  validateDisplayNameField(displayName, errors, true);
  return errors.displayName ?? null;
}

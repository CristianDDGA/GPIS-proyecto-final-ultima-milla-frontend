export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const EMAIL_LOCAL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const EMAIL_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const EMAIL_TLD_RE = /^[a-z]{2,24}$/i;
const SAFE_NAME_RE = /^[\p{L}\p{M} .'-]+$/u;
const SAFE_TEXT_RE = /^[\p{L}\p{N}\p{M} .,;:()/#°'-]+$/u;

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'admin1234',
  'welcome1',
  'letmein1',
  'abc12345',
  'iloveyou',
  '00000000',
  '11111111',
]);

const WEAK_BASE_WORDS = ['password', 'contraseña', 'contrasena', 'admin', 'qwerty', 'usuario', 'repartidor', 'cliente', 'millast'];

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function validateEmailLogin(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return 'El correo electrónico es obligatorio.';
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@') || /\s/.test(trimmed)) {
    return 'Ingresa un correo electrónico válido.';
  }
  const domain = trimmed.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return 'Ingresa un correo electrónico válido.';
  }
  return null;
}

export function validateNewEmailStrict(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) {
    return 'El correo debe tener entre 3 y 254 caracteres.';
  }
  const parts = trimmed.split('@');
  if (parts.length !== 2) return 'Correo electrónico no válido.';
  const [local, domain] = parts;
  if (!local || !domain || !EMAIL_LOCAL_RE.test(local)) {
    return 'El usuario del correo solo admite caracteres ASCII válidos.';
  }
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => !EMAIL_LABEL_RE.test(label))) {
    return 'Dominio del correo no válido.';
  }
  const tld = labels[labels.length - 1] ?? '';
  if (!EMAIL_TLD_RE.test(tld)) {
    return 'El dominio superior del correo no es válido.';
  }
  return null;
}

export function validatePersonName(value: string, label: string, required = true): string | null {
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return required ? `${label} es obligatorio.` : null;
  }
  if (normalized.length < 2 || normalized.length > 120) {
    return `${label} debe tener entre 2 y 120 caracteres.`;
  }
  if (!SAFE_NAME_RE.test(normalized)) {
    return `${label} solo puede contener letras, espacios, puntos, guiones o apóstrofos.`;
  }
  return null;
}

export function validatePlaceName(value: string, label = 'El nombre de la zona'): string | null {
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (normalized.length < 2 || normalized.length > 80) {
    return `${label} debe tener entre 2 y 80 caracteres.`;
  }
  if (!SAFE_TEXT_RE.test(normalized)) {
    return `${label} contiene caracteres no permitidos.`;
  }
  return null;
}

export function validateAddress(value: string): string | null {
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (normalized.length < 5 || normalized.length > 200) {
    return 'La dirección debe tener entre 5 y 200 caracteres.';
  }
  if (!SAFE_TEXT_RE.test(normalized)) {
    return 'La dirección contiene caracteres no permitidos.';
  }
  return null;
}

export function validateNewPasswordPolicy(password: string, email: string): string | null {
  if (password.length < 8 || password.length > 128) {
    return 'La contraseña debe tener entre 8 y 128 caracteres.';
  }
  if (/^\d+$/.test(password)) {
    return 'La contraseña no puede ser únicamente numérica.';
  }
  const distinctChars = new Set(password).size;
  if (distinctChars < 3) {
    return 'Usa al menos 3 caracteres distintos en tu contraseña.';
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return 'Esta contraseña es demasiado común.';
  }
  for (const base of WEAK_BASE_WORDS) {
    if (lower.includes(base) && password.length - base.length <= 6) {
      return 'La contraseña se parece demasiado a una palabra débil.';
    }
  }
  const localPart = email.trim().toLowerCase().split('@')[0] ?? '';
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return 'La contraseña no puede contener tu correo.';
  }
  return null;
}

export type PasswordStrength = {
  readonly level: 0 | 1 | 2 | 3;
  readonly label: string;
};

export function evaluatePasswordStrength(password: string, email: string): PasswordStrength {
  if (password.length === 0) return {level: 0, label: 'Sin ingresar'};
  if (validateNewPasswordPolicy(password, email) !== null) {
    return {level: 1, label: 'Débil (no cumple política)'};
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (password.length >= 12 && classes >= 3) {
    return {level: 3, label: 'Fuerte'};
  }
  return {level: 2, label: 'Aceptable'};
}

export function isValidEcuadorianNationalId(raw: string): boolean {
  const digits = raw.trim();
  if (!/^\d{10}$/.test(digits)) return false;
  const province = Number(digits.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  const thirdDigit = Number(digits.charAt(2));
  if (thirdDigit >= 6) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const val = Number(digits.charAt(i));
    const doubled = i % 2 === 0 ? val * 2 : val;
    sum += doubled >= 10 ? doubled - 9 : doubled;
  }
  const nextTen = Math.ceil(sum / 10) * 10;
  const check = (nextTen - sum) % 10;
  return check === Number(digits.charAt(9));
}

import { describe, expect, it } from 'vitest';
import {
  evaluatePasswordStrength,
  firstValidationError,
  isAuthRole,
  isPublicRole,
  validateForgotPasswordInput,
  validateLoginInput,
  validatePasswordPolicy,
  validateRegisterCustomerInput,
  validateResetPasswordInput,
  validateVerifyEmailInput,
} from './authUser.js';
import {
  isEmailVerifiedVia,
  isUuidText,
  validateChangePasswordInput,
  validateResetManagedUserPasswordInput,
} from './managedUser.js';

const STRONG = 'Rio-Ambato-2026';

describe('roles', () => {
  it('reconoce los roles de la API y los públicos', () => {
    expect(isAuthRole('personal')).toBe(true);
    expect(isAuthRole('admin')).toBe(false);
    expect(isPublicRole('admin')).toBe(true);
    expect(isPublicRole('personal')).toBe(false);
    expect(isAuthRole(3)).toBe(false);
  });
});

describe('validateLoginInput', () => {
  it('acepta credenciales con formato válido', () => {
    expect(validateLoginInput({ email: 'Admin@UltimaMilla.com', password: '12345678' }).isValid).toBe(true);
  });

  it('exige correo y longitud mínima de clave', () => {
    const result = validateLoginInput({ email: '  ', password: 'corta' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toMatch(/obligatorio/);
    expect(result.errors.password).toMatch(/entre 8 y 128/);
  });

  it('rechaza un correo mal formado', () => {
    expect(validateLoginInput({ email: 'sin-arroba', password: '12345678' }).errors.email).toBeDefined();
  });
});

describe('validateRegisterCustomerInput (reglas estrictas del backend)', () => {
  it('acepta un registro correcto', () => {
    const result = validateRegisterCustomerInput({
      email: 'ana.perez@millast.ec',
      password: STRONG,
      displayName: 'Ana María Pérez',
    });
    expect(result).toEqual({ isValid: true, errors: {} });
  });

  it.each([
    ['ana pérez@millast.ec'],
    ['ana@millast'],
    ['ana@@millast.ec'],
    ['ñandú@millast.ec'],
  ])('rechaza el correo %s', (email) => {
    expect(validateRegisterCustomerInput({ email, password: STRONG }).errors.email).toBeDefined();
  });

  it.each([
    ['password123', /común/],
    ['12345678901', /solo números/],
    ['aaaaaaaaaa', /común/],
    ['Admin!2026', /común/],
    ['anaperez-segura', /correo/],
  ])('aplica la política de contraseñas a %s', (password, message) => {
    const result = validateRegisterCustomerInput({ email: 'anaperez@millast.ec', password });
    expect(result.errors.password).toMatch(message);
  });

  it('rechaza nombres con números o emojis', () => {
    expect(
      validateRegisterCustomerInput({ email: 'a.b@millast.ec', password: STRONG, displayName: 'Ana 2' }).errors
        .displayName,
    ).toBeDefined();
    expect(
      validateRegisterCustomerInput({ email: 'a.b@millast.ec', password: STRONG, displayName: 'Ana 😀' }).errors
        .displayName,
    ).toBeDefined();
  });

  it('permite omitir el nombre', () => {
    expect(validateRegisterCustomerInput({ email: 'a.b@millast.ec', password: STRONG, displayName: '  ' }).isValid).toBe(
      true,
    );
  });
});

describe('verificación y recuperación', () => {
  it('el código debe tener 6 dígitos', () => {
    expect(validateVerifyEmailInput({ email: 'a@b.ec', code: '123456' }).isValid).toBe(true);
    expect(validateVerifyEmailInput({ email: 'a@b.ec', code: '12a456' }).errors.code).toMatch(/6 dígitos/);
  });

  it('forgot-password solo pide un correo válido', () => {
    expect(validateForgotPasswordInput({ email: 'a@b.ec' }).isValid).toBe(true);
    expect(validateForgotPasswordInput({ email: '' }).isValid).toBe(false);
  });

  it('reset-password valida código y nueva clave', () => {
    const result = validateResetPasswordInput({ email: 'a@b.ec', code: '1', newPassword: 'password' });
    expect(Object.keys(result.errors).sort()).toEqual(['code', 'newPassword']);
  });
});

describe('fuerza y política de contraseña', () => {
  it('clasifica la fuerza de la clave', () => {
    expect(evaluatePasswordStrength('')).toBe('weak');
    expect(evaluatePasswordStrength('password123')).toBe('weak');
    expect(evaluatePasswordStrength('Rio-Ambato1')).toBe('medium');
    expect(evaluatePasswordStrength('Rio-Ambato-Quito-2026')).toBe('strong');
  });

  it('devuelve null cuando la clave cumple la política', () => {
    expect(validatePasswordPolicy(STRONG)).toBeNull();
    expect(validatePasswordPolicy('qwerty123')).not.toBeNull();
  });

  it('firstValidationError devuelve el primer mensaje o null', () => {
    expect(firstValidationError({})).toBeNull();
    expect(firstValidationError({ a: '', b: 'segundo' })).toBe('segundo');
  });
});

describe('usuarios administrados', () => {
  it('reconoce UUID y origen de verificación', () => {
    expect(isUuidText('3f2b8c1e-9a4d-4c2b-8e1f-123456789abc')).toBe(true);
    expect(isUuidText('no-uuid')).toBe(false);
    expect(isEmailVerifiedVia(null)).toBe(true);
    expect(isEmailVerifiedVia('desconocido')).toBe(false);
  });

  it('el cambio de clave exige la actual y una nueva distinta', () => {
    expect(validateChangePasswordInput({ currentPassword: '', newPassword: STRONG }).errors.currentPassword).toBeDefined();
    expect(validateChangePasswordInput({ currentPassword: STRONG, newPassword: STRONG }).errors.newPassword).toMatch(
      /diferente/,
    );
    expect(validateChangePasswordInput({ currentPassword: 'Anterior-2025', newPassword: STRONG }).isValid).toBe(true);
  });

  it('el restablecimiento por el admin exige un usuario válido', () => {
    const result = validateResetManagedUserPasswordInput({ userId: 'x', newPassword: STRONG });
    expect(result.errors.userId).toBeDefined();
  });
});

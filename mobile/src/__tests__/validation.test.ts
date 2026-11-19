import {describe, expect, it} from '@jest/globals';
import {
  evaluatePasswordStrength,
  isValidEcuadorianNationalId,
  isValidUuid,
  validateAddress,
  validateEmailLogin,
  validateNewEmailStrict,
  validateNewPasswordPolicy,
  validatePersonName,
  validatePlaceName,
} from '../shared/utils/validation';

describe('validation utilities', () => {
  it('validates UUID v1-v5 format strictly', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('not-a-uuid')).toBe(false);
  });

  it('validates login and strict registration emails', () => {
    expect(validateEmailLogin('  user@millast.ec ')).toBeNull();
    expect(validateEmailLogin('invalid-email')).not.toBeNull();

    expect(validateNewEmailStrict('ana.perez@empresa.ec')).toBeNull();
    expect(validateNewEmailStrict('ana@localhost')).not.toBeNull();
    expect(validateNewEmailStrict('ñandu@dominio.ec')).not.toBeNull();
  });

  it('validates person names, zone names, and delivery addresses', () => {
    expect(validatePersonName('María José O\'Connor', 'Nombre')).toBeNull();
    expect(validatePersonName('1234', 'Nombre')).not.toBeNull();
    expect(validatePersonName('', 'Nombre', false)).toBeNull();

    expect(validatePlaceName('Centro Histórico')).toBeNull();
    expect(validatePlaceName('A')).not.toBeNull();

    expect(validateAddress('Av. 10 de Agosto N34-12 y Colón')).toBeNull();
    expect(validateAddress('Abc')).not.toBeNull();
  });

  it('enforces password policy and evaluates strength', () => {
    expect(validateNewPasswordPolicy('12345678', 'ana@millast.ec')).not.toBeNull();
    expect(validateNewPasswordPolicy('password123', 'ana@millast.ec')).not.toBeNull();
    expect(validateNewPasswordPolicy('ClaveSegura#2026', 'ana@millast.ec')).toBeNull();

    expect(evaluatePasswordStrength('', 'ana@millast.ec').level).toBe(0);
    expect(evaluatePasswordStrength('password123', 'ana@millast.ec').level).toBe(1);
    expect(evaluatePasswordStrength('Segura2026', 'ana@millast.ec').level).toBe(2);
    expect(evaluatePasswordStrength('RutaSegura#2026!', 'ana@millast.ec').level).toBe(3);
  });

  it('validates Ecuadorian national IDs using province and modulo-10 checksum', () => {
    expect(isValidEcuadorianNationalId('1710034065')).toBe(true);
    expect(isValidEcuadorianNationalId('1710034066')).toBe(false);
    expect(isValidEcuadorianNationalId('9910034065')).toBe(false);
    expect(isValidEcuadorianNationalId('1760034065')).toBe(false);
  });
});

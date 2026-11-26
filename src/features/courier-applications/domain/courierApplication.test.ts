import { describe, expect, it } from 'vitest';
import {
  detectImageType,
  isValidEcuadorianNationalId,
  isValidIsoDate,
  subtractYears,
  todayInEcuador,
  validateApplicationDraft,
  validateImageFile,
  type ApplicationDraftInput,
} from './courierApplication.js';

const TODAY = '2026-11-23';
const VALID_DRAFT: ApplicationDraftInput = {
  fullName: 'Luis Andrade',
  nationalId: '1710034065',
  phone: '+593 99 123 4567',
  birthDate: '1995-04-10',
  vehicleType: 'moto',
  licenseNumber: 'abc-12345',
  licenseCategory: 'A',
  licenseExpiresOn: '2028-01-01',
};

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('cédula ecuatoriana (módulo 10)', () => {
  it('acepta una cédula válida', () => {
    expect(isValidEcuadorianNationalId('1710034065')).toBe(true);
  });

  it.each([
    ['1710034066', 'dígito verificador'],
    ['2510034065', 'provincia'],
    ['1770034065', 'tercer dígito'],
    ['171003406', 'longitud'],
  ])('rechaza %s (%s)', (value) => {
    expect(isValidEcuadorianNationalId(value)).toBe(false);
  });
});

describe('fechas', () => {
  it('valida fechas de calendario', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('29-02-2024')).toBe(false);
  });

  it('resta años ajustando el 29 de febrero', () => {
    expect(subtractYears('2026-11-23', 18)).toBe('2008-11-23');
    expect(subtractYears('2024-02-29', 1)).toBe('2023-02-28');
  });

  it('calcula el día en la zona horaria de Ecuador', () => {
    expect(todayInEcuador(new Date('2026-11-24T03:00:00Z'))).toBe('2026-11-23');
  });
});

describe('validateApplicationDraft', () => {
  it('acepta un borrador correcto', () => {
    expect(validateApplicationDraft(VALID_DRAFT, TODAY)).toEqual({ isValid: true, errors: {} });
  });

  it('exige mayoría de edad y licencia vigente', () => {
    const result = validateApplicationDraft(
      { ...VALID_DRAFT, birthDate: '2010-01-01', licenseExpiresOn: TODAY },
      TODAY,
    );
    expect(result.errors.birthDate).toMatch(/18/);
    expect(result.errors.licenseExpiresOn).toMatch(/caducada/);
  });

  it('marca todos los campos mal llenados', () => {
    const result = validateApplicationDraft(
      {
        fullName: 'Luis',
        nationalId: '1710034066',
        phone: '12',
        birthDate: '1900-01-01',
        vehicleType: 'avion' as never,
        licenseNumber: 'ñ',
        licenseCategory: 'Z',
        licenseExpiresOn: 'mañana',
      },
      TODAY,
    );
    expect(Object.keys(result.errors).sort()).toEqual([
      'birthDate',
      'fullName',
      'licenseCategory',
      'licenseExpiresOn',
      'licenseNumber',
      'nationalId',
      'phone',
      'vehicleType',
    ]);
    expect(result.errors.fullName).toMatch(/nombres y apellidos/);
  });
});

describe('imágenes', () => {
  it('detecta JPEG y PNG por su firma', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('valida tipo, firma y tamaño del archivo', async () => {
    expect(await validateImageFile(new File([JPEG], 'a.jpg', { type: 'image/jpeg' }))).toEqual({
      ok: true,
      contentType: 'image/jpeg',
    });
    expect((await validateImageFile(new File([JPEG], 'a.gif', { type: 'image/gif' }))).ok).toBe(false);
    expect((await validateImageFile(new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' }))).error).toMatch(
      /no es una imagen/,
    );
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    expect((await validateImageFile(big)).error).toMatch(/5 MB/);
  });
});

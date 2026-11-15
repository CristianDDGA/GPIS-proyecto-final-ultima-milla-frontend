export interface Zone {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneInput {
  name: string;
}

export interface ZoneValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Identificador UUID aceptado por el backend para una zona.
 * Se usa una variante laxa (v1-v5, sin exigir la variante RFC 4122) porque
 * el backend valida el formato posicional del UUID y no su versión.
 */
const ZONE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Comprueba si el valor recibido tiene forma de UUID de zona válido.
 * Es una regla pura de dominio reutilizable por casos de uso e infraestructura.
 */
export function isZoneId(value: string): boolean {
  return typeof value === 'string' && ZONE_ID_PATTERN.test(value.trim());
}

/**
 * Regla de negocio para Zonas:
 * Una zona válida requiere un nombre no vacío (rechazar espacios vacíos o cadenas vacías).
 */
export function validateZoneName(name: string): ZoneValidationResult {
  if (typeof name !== 'string') {
    return {
      isValid: false,
      error: 'El nombre de la zona debe ser un texto.',
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'El nombre de la zona no puede estar vacío ni contener solo espacios.',
    };
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'El nombre de la zona debe tener al menos 2 caracteres.',
    };
  }

  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: 'El nombre de la zona no puede exceder 50 caracteres.',
    };
  }

  return { isValid: true };
}

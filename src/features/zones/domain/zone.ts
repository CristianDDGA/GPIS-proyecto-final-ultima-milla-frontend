/** Círculo de cobertura de una zona: centro en el mapa y radio en km. */
export interface ZoneCoverage {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface Zone {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** `null` o ausente: la zona no tiene cobertura y se elige a mano. */
  coverage?: ZoneCoverage | null | undefined;
}

export const MIN_COVERAGE_RADIUS_KM = 0.1;
export const MAX_COVERAGE_RADIUS_KM = 50;

/** Límites de Ecuador (incluye Galápagos), iguales a los del backend. */
const ECUADOR_LAT = { min: -5.1, max: 1.5 } as const;
const ECUADOR_LNG = { min: -92.5, max: -75.0 } as const;

/** Regla de dominio: centro dentro de Ecuador y radio entre 0,1 y 50 km. */
export function validateCoverage(coverage: ZoneCoverage): ZoneValidationResult {
  const { latitude, longitude, radiusKm } = coverage;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { isValid: false, error: 'Marca el centro de la zona en el mapa.' };
  }
  if (
    latitude < ECUADOR_LAT.min ||
    latitude > ECUADOR_LAT.max ||
    longitude < ECUADOR_LNG.min ||
    longitude > ECUADOR_LNG.max
  ) {
    return { isValid: false, error: 'El centro debe estar dentro de Ecuador.' };
  }
  if (
    !Number.isFinite(radiusKm) ||
    radiusKm < MIN_COVERAGE_RADIUS_KM ||
    radiusKm > MAX_COVERAGE_RADIUS_KM
  ) {
    return {
      isValid: false,
      error: `El radio debe estar entre ${MIN_COVERAGE_RADIUS_KM} y ${MAX_COVERAGE_RADIUS_KM} km.`,
    };
  }
  return { isValid: true };
}

/** Texto corto para listados: "3 km" o "Sin cobertura". */
export function describeCoverage(coverage: ZoneCoverage | null | undefined): string {
  if (!coverage) return 'Sin cobertura';
  const radius = String(Number(coverage.radiusKm.toFixed(2)));
  return `${radius.replace('.', ',')} km`;
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

  if (trimmed.length > 80) {
    return {
      isValid: false,
      error: 'El nombre de la zona no puede exceder 80 caracteres.',
    };
  }

  return { isValid: true };
}

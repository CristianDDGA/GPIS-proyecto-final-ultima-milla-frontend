import { distanceKm, isWithinEcuador } from '../../../shared/geo.js';

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
  /** `false`: no recibe pedidos ni entra en la planificación. Ausente cuenta como activa (servidor antiguo). */
  isActive?: boolean | undefined;
}

/** Una zona activa recibe pedidos; las inactivas se conservan con su historial y cobertura. */
export function isZoneActive(zone: Pick<Zone, 'isActive'>): boolean {
  return zone.isActive !== false;
}

export const MIN_COVERAGE_RADIUS_KM = 0.1;
export const MAX_COVERAGE_RADIUS_KM = 50;


/** Regla de dominio: centro dentro de Ecuador y radio entre 0,1 y 50 km. */
export function validateCoverage(coverage: ZoneCoverage): ZoneValidationResult {
  const { latitude, longitude, radiusKm } = coverage;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { isValid: false, error: 'Marca el centro de la zona en el mapa.' };
  }
  if (!isWithinEcuador(latitude, longitude)) {
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

/** Convierte el texto del radio (acepta coma decimal) a número; `NaN` si no es válido. */
export function parseRadius(text: string): number {
  const normalized = text.trim().replace(',', '.');
  return normalized.length === 0 ? Number.NaN : Number(normalized);
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

/** Mismos límites que el backend (`validateZoneName`). */
export const ZONE_NAME_MIN_LENGTH = 3;
export const ZONE_NAME_MAX_LENGTH = 40;
const ZONE_NAME_MIN_LETTERS = 3;

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

  if (trimmed.length < ZONE_NAME_MIN_LENGTH || trimmed.length > ZONE_NAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `El nombre de la zona debe tener entre ${ZONE_NAME_MIN_LENGTH} y ${ZONE_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  if ((trimmed.match(/\p{L}/gu) ?? []).length < ZONE_NAME_MIN_LETTERS) {
    return {
      isValid: false,
      error: `El nombre de la zona debe tener al menos ${ZONE_NAME_MIN_LETTERS} letras.`,
    };
  }

  return { isValid: true };
}

/** true si el punto cae dentro del circulo de cobertura (misma regla que el servidor). */
export function isPointInCoverage(coverage: ZoneCoverage | null | undefined, latitude: number, longitude: number): boolean {
  if (!coverage) return false;
  return distanceKm(coverage.latitude, coverage.longitude, latitude, longitude) <= coverage.radiusKm;
}

/**
 * Zonas activas cuyo circulo se cruza con el de `coverage`. Es un aviso, no un bloqueo: un punto en la parte compartida
 * se asigna a la zona de centro mas cercano.
 */
export function findOverlappingZones(
  coverage: ZoneCoverage,
  zones: readonly Zone[],
  excludeId?: string,
): Zone[] {
  return zones.filter(
    (zone) =>
      zone.id !== excludeId &&
      isZoneActive(zone) &&
      zone.coverage != null &&
      distanceKm(coverage.latitude, coverage.longitude, zone.coverage.latitude, zone.coverage.longitude) <
        coverage.radiusKm + zone.coverage.radiusKm,
  );
}

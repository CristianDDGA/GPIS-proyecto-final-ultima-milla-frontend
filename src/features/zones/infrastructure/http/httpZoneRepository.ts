import {
  defaultHttpClient,
  HttpError,
  type HttpClient,
} from '../../../../shared/infrastructure/http/index.js';
import type { Zone, ZoneCoverage, CreateZoneInput, ZoneRepository } from '../../domain/index.js';

const CONTRACT_ERROR_MESSAGE = 'La respuesta del servidor no cumple el contrato de la API.';

/** UUID laxo (el backend valida la forma posicional, no la versión RFC 4122). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Claves de envoltorio toleradas para listados de zonas. */
const LIST_WRAPPER_KEYS = ['items', 'data', 'zones'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

/** `coverage` es opcional (zonas viejas) pero, si viene, debe ser nulo o un círculo válido. */
function isCoverageField(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return (
    isRecord(value) &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.radiusKm === 'number'
  );
}

/** Guarda de contrato para una `Zone` individual (ZoneDto del backend). */
function isZone(value: unknown): value is Zone {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    UUID_PATTERN.test(value.id) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt) &&
    isCoverageField(value.coverage)
  );
}

/** Extrae un arreglo de zonas de los formatos tolerados; si no cumple, lanza. */
function readZoneList(value: unknown): Zone[] {
  if (Array.isArray(value)) {
    return value.map((item) => readZone(item));
  }

  if (isRecord(value)) {
    for (const key of LIST_WRAPPER_KEYS) {
      const candidate = value[key];
      if (Array.isArray(candidate)) {
        return candidate.map((item) => readZone(item));
      }
    }
  }

  throw new Error(CONTRACT_ERROR_MESSAGE);
}

/** Extractor de una zona desde respuesta plana `ZoneDto` o `{ data: ZoneDto }`. */
function readZonePayload(value: unknown): Zone {
  if (isZone(value)) {
    return value;
  }

  if (isRecord(value) && isZone(value.data)) {
    return value.data;
  }

  throw new Error(CONTRACT_ERROR_MESSAGE);
}

function readZone(value: unknown): Zone {
  if (!isZone(value)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }
  return value;
}

export class HttpZoneRepository implements ZoneRepository {
  constructor(private readonly httpClient: HttpClient = defaultHttpClient) {}

  public async getAll(): Promise<Zone[]> {
    try {
      const response = await this.httpClient.get<unknown>('/zones');
      return readZoneList(response);
    } catch (error) {
      // Manejo resiliente: si la ruta no existe en el backend (404), retornamos lista vacía sin romper la UI.
      if (error instanceof HttpError && error.status === 404) {
        return [];
      }

      throw error;
    }
  }

  public async getById(id: string): Promise<Zone | null> {
    try {
      const endpoint = `/zones/${encodeURIComponent(id)}`;
      const response = await this.httpClient.get<unknown>(endpoint);
      return readZonePayload(response);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  public async create(input: CreateZoneInput): Promise<Zone> {
    const payload = {
      name: input.name,
    };

    const response = await this.httpClient.post<unknown>('/zones', payload);
    return readZonePayload(response);
  }

  public async setCoverage(id: string, coverage: ZoneCoverage | null): Promise<Zone> {
    const response = await this.httpClient.put<unknown>(
      `/zones/${encodeURIComponent(id)}/coverage`,
      { coverage },
    );
    return readZonePayload(response);
  }
}

export const defaultZoneRepository = new HttpZoneRepository();

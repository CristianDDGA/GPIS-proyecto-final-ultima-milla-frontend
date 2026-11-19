import type {MobileHttpClient} from '../../../shared/infrastructure/http/httpClient';
import type {Zone} from '../domain/zone';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseZone(value: unknown): Zone {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    id: value.id,
    name: value.name,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

export class HttpZoneGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async getAll(): Promise<Zone[]> {
    const payload = await this.http.get<unknown>('/zones');
    if (Array.isArray(payload)) {
      return payload.map(parseZone);
    }
    if (isRecord(payload) && Array.isArray(payload.items)) {
      return payload.items.map(parseZone);
    }
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }

  async getById(zoneId: string): Promise<Zone> {
    return parseZone(await this.http.get<unknown>(`/zones/${encodeURIComponent(zoneId)}`));
  }

  async create(name: string): Promise<Zone> {
    return parseZone(await this.http.post<unknown>('/zones', {name: name.trim()}));
  }
}

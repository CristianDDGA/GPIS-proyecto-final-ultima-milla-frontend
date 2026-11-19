import type {MobileHttpClient} from '../../../shared/infrastructure/http/httpClient';
import type {Order, OrderStatus} from '../domain/order';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStatus(value: unknown): OrderStatus {
  if (
    value === 'pendiente' ||
    value === 'asignado_a_ruta' ||
    value === 'recogido' ||
    value === 'en_camino' ||
    value === 'entregado'
  ) {
    return value;
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

function parseOrder(value: unknown): Order {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.zoneId !== 'string' ||
    typeof value.deliveryAddress !== 'string' ||
    typeof value.deliveryDate !== 'string' ||
    typeof value.deliveryTime !== 'string'
  ) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    id: value.id,
    zoneId: value.zoneId,
    ...(typeof value.zoneName === 'string' ? {zoneName: value.zoneName} : {}),
    deliveryAddress: value.deliveryAddress,
    deliveryDate: value.deliveryDate,
    deliveryTime: value.deliveryTime,
    status: asStatus(value.status),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

export class HttpOrderGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async getAll(filters?: {deliveryDate?: string; zoneId?: string}): Promise<Order[]> {
    const query = new URLSearchParams();
    if (filters?.deliveryDate) query.set('deliveryDate', filters.deliveryDate);
    if (filters?.zoneId) query.set('zoneId', filters.zoneId);
    const suffix = query.toString();
    const payload = await this.http.get<unknown>(`/orders${suffix ? `?${suffix}` : ''}`);
    if (Array.isArray(payload)) {
      return payload.map(parseOrder);
    }
    if (isRecord(payload) && Array.isArray(payload.items)) {
      return payload.items.map(parseOrder);
    }
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }

  async getById(orderId: string): Promise<Order> {
    return parseOrder(await this.http.get<unknown>(`/orders/${encodeURIComponent(orderId)}`));
  }

  async create(input: {
    zoneId: string;
    deliveryAddress: string;
    deliveryDate: string;
    deliveryTime: string;
  }): Promise<Order> {
    return parseOrder(await this.http.post<unknown>('/orders', input));
  }
}

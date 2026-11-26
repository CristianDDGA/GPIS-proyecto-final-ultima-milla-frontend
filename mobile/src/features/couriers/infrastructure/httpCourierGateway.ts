import type {MobileHttpClient} from '../../../shared/infrastructure/http/httpClient';
import type {
  ActiveCourierRoute,
  ActiveCourierRouteStop,
  ActiveStopStatus,
  Courier,
  CourierPage,
} from '../domain/courier';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCourier(value: unknown): Courier {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string' ||
    typeof value.maxOrdersPerTrip !== 'number'
  ) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    id: value.id,
    displayName: value.displayName,
    maxOrdersPerTrip: value.maxOrdersPerTrip,
    isEnabled: value.isEnabled !== false,
    isAvailable: value.isAvailable === true,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

function asActiveStopStatus(value: unknown): ActiveStopStatus {
  if (
    value === 'asignado_a_ruta' ||
    value === 'recogido' ||
    value === 'en_camino' ||
    value === 'entregado' ||
    value === 'entrega_fallida' ||
    value === 'cancelado'
  ) {
    return value;
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

function parseStop(value: unknown): ActiveCourierRouteStop {
  if (
    !isRecord(value) ||
    typeof value.orderId !== 'string' ||
    typeof value.position !== 'number' ||
    typeof value.deliveryAddress !== 'string'
  ) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    orderId: value.orderId,
    position: value.position,
    deliveryAddress: value.deliveryAddress,
    deliveryTime: typeof value.deliveryTime === 'string' ? value.deliveryTime : '',
    status: asActiveStopStatus(value.status),
  };
}

function parseActiveRoute(value: unknown): ActiveCourierRoute | null {
  if (!isRecord(value) || !('item' in value)) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  if (value.item === null) return null;
  if (!isRecord(value.item)) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  const route = value.item;
  if (
    typeof route.routeId !== 'string' ||
    typeof route.zoneId !== 'string' ||
    typeof route.serviceDate !== 'string' ||
    !Array.isArray(route.stops)
  ) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    routeId: route.routeId,
    zoneId: route.zoneId,
    serviceDate: route.serviceDate,
    status: route.status === 'en_curso' ? 'en_curso' : 'asignada',
    stops: route.stops.map(parseStop).sort((a, b) => a.position - b.position),
  };
}

export class HttpCourierGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async createCourier(displayName: string, maxOrdersPerTrip: number): Promise<Courier> {
    return parseCourier(
      await this.http.post<unknown>('/couriers', {displayName, maxOrdersPerTrip}),
    );
  }

  async getCouriers(filters?: {available?: boolean; limit?: number; offset?: number}): Promise<CourierPage> {
    const query = new URLSearchParams();
    if (filters?.available !== undefined) {
      query.set('available', filters.available ? 'true' : 'false');
    }
    if (filters?.limit !== undefined) query.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) query.set('offset', String(filters.offset));
    const suffix = query.toString();
    const payload = await this.http.get<unknown>(`/couriers${suffix ? `?${suffix}` : ''}`);
    if (!isRecord(payload) || !Array.isArray(payload.items)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return {
      items: payload.items.map(parseCourier),
      limit: typeof payload.limit === 'number' ? payload.limit : 25,
      offset: typeof payload.offset === 'number' ? payload.offset : 0,
    };
  }

  async updateAvailability(courierId: string, isAvailable: boolean): Promise<Courier> {
    return parseCourier(
      await this.http.patch<unknown>(
        `/couriers/${encodeURIComponent(courierId)}/availability`,
        {isAvailable},
      ),
    );
  }

  async assignRoute(routeId: string, courierId: string): Promise<{routeId: string; courierId: string}> {
    const payload = await this.http.post<unknown>('/courier-assignments', {routeId, courierId});
    if (!isRecord(payload) || typeof payload.routeId !== 'string' || typeof payload.courierId !== 'string') {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return {routeId: payload.routeId, courierId: payload.courierId};
  }

  async getActiveRoute(courierId: string): Promise<ActiveCourierRoute | null> {
    return parseActiveRoute(
      await this.http.get<unknown>(`/couriers/${encodeURIComponent(courierId)}/route`),
    );
  }
}

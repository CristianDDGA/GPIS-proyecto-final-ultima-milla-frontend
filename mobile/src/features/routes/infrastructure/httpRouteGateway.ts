import {
  createIdempotencyKey,
  type MobileHttpClient,
} from '../../../shared/infrastructure/http/httpClient';
import type {
  LateOrderPlacementResult,
  PlanRoutesResult,
  RouteDetail,
  RouteStatus,
  RouteStop,
  RouteSummary,
  StopOrderStatus,
} from '../domain/route';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRouteStatus(value: unknown): RouteStatus {
  if (
    value === 'planificada' ||
    value === 'asignada' ||
    value === 'en_curso' ||
    value === 'completada' ||
    value === 'cancelada'
  ) {
    return value;
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

function asStopStatus(value: unknown): StopOrderStatus {
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

function parseSummary(value: unknown): RouteSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.zoneId !== 'string' ||
    typeof value.serviceDate !== 'string' ||
    typeof value.capacityLimit !== 'number' ||
    typeof value.occupiedSlots !== 'number'
  ) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    id: value.id,
    zoneId: value.zoneId,
    serviceDate: value.serviceDate,
    status: asRouteStatus(value.status),
    capacityLimit: value.capacityLimit,
    occupiedSlots: value.occupiedSlots,
    courierId: typeof value.courierId === 'string' ? value.courierId : null,
  };
}

function parseStop(value: unknown): RouteStop {
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
    deliveryDate: typeof value.deliveryDate === 'string' ? value.deliveryDate : '',
    deliveryTime: typeof value.deliveryTime === 'string' ? value.deliveryTime : '',
    status: asStopStatus(value.status),
  };
}

function parseDetail(value: unknown): RouteDetail {
  const base = parseSummary(value);
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.stops)) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    ...base,
    stops: raw.stops.map(parseStop).sort((a, b) => a.position - b.position),
  };
}

export class HttpRouteGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async planRoutes(serviceDate: string, capacityLimit: number): Promise<PlanRoutesResult> {
    const payload = await this.http.post<unknown>(
      '/route-plans',
      {serviceDate, capacityLimit},
      {headers: {'Idempotency-Key': createIdempotencyKey()}},
    );
    if (!isRecord(payload) || typeof payload.serviceDate !== 'string' || !Array.isArray(payload.routeIds)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return {
      serviceDate: payload.serviceDate,
      routeIds: payload.routeIds.filter((id): id is string => typeof id === 'string'),
    };
  }

  async getRoutes(filters?: {serviceDate?: string; zoneId?: string; limit?: number}): Promise<RouteSummary[]> {
    const query = new URLSearchParams();
    if (filters?.serviceDate) query.set('serviceDate', filters.serviceDate);
    if (filters?.zoneId) query.set('zoneId', filters.zoneId);
    query.set('limit', String(filters?.limit ?? 50));
    const suffix = query.toString();
    const payload = await this.http.get<unknown>(`/routes${suffix ? `?${suffix}` : ''}`);
    if (!isRecord(payload) || !Array.isArray(payload.items)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return payload.items.map(parseSummary);
  }

  async getRouteById(routeId: string): Promise<RouteDetail> {
    return parseDetail(await this.http.get<unknown>(`/routes/${encodeURIComponent(routeId)}`));
  }

  async reorderStops(routeId: string, orderIds: string[]): Promise<void> {
    await this.http.put<unknown>(`/routes/${encodeURIComponent(routeId)}/stop-order`, {orderIds});
  }

  async cancelRoute(routeId: string): Promise<void> {
    await this.http.post<unknown>(`/routes/${encodeURIComponent(routeId)}/cancel`, {});
  }

  async moveOrder(orderId: string, destinationRouteId: string): Promise<void> {
    await this.http.post<unknown>('/route-moves', {orderId, destinationRouteId});
  }

  async placeLateOrder(orderId: string, capacityLimit: number): Promise<LateOrderPlacementResult> {
    const payload = await this.http.post<unknown>(
      '/late-order-placements',
      {orderId, capacityLimit},
      {headers: {'Idempotency-Key': createIdempotencyKey()}},
    );
    if (!isRecord(payload) || typeof payload.orderId !== 'string') {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    if (payload.status === 'asignado_a_ruta' && typeof payload.routeId === 'string') {
      return {orderId: payload.orderId, status: 'asignado_a_ruta', routeId: payload.routeId};
    }
    return {
      orderId: payload.orderId,
      status: 'pendiente',
      reason: typeof payload.reason === 'string' ? payload.reason : 'NO_AVAILABLE_COURIER',
    };
  }
}

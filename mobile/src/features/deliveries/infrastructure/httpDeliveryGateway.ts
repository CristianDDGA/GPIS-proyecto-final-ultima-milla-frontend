import {
  createIdempotencyKey,
  type MobileHttpClient,
} from '../../../shared/infrastructure/http/httpClient';
import type {OrderStatus} from '../../orders/domain/order';
import type {
  DeliveryOrder,
  DeliveryStatusChangeResult,
  DeliveryTransitionStatus,
} from '../domain/delivery';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asOrderStatus(value: unknown): OrderStatus {
  if (
    value === 'pendiente' ||
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

function parseDeliveryOrder(value: unknown): DeliveryOrder {
  if (!isRecord(value) || typeof value.orderId !== 'string') {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {
    orderId: value.orderId,
    routeId: typeof value.routeId === 'string' ? value.routeId : null,
    status: asOrderStatus(value.status),
    version: String(value.version ?? '1'),
    deliveredAt: typeof value.deliveredAt === 'string' ? value.deliveredAt : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

export class HttpDeliveryGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async getDeliveryOrder(orderId: string): Promise<DeliveryOrder> {
    return parseDeliveryOrder(
      await this.http.get<unknown>(`/delivery-orders/${encodeURIComponent(orderId)}`),
    );
  }

  async changeStatus(input: {
    orderId: string;
    newStatus: DeliveryTransitionStatus;
    expectedVersion: string;
  }): Promise<DeliveryStatusChangeResult> {
    const payload = await this.http.post<unknown>(
      '/delivery-status-changes',
      {
        orderId: input.orderId,
        newStatus: input.newStatus,
        expectedVersion: input.expectedVersion,
      },
      {headers: {'Idempotency-Key': createIdempotencyKey()}},
    );
    if (!isRecord(payload) || typeof payload.orderId !== 'string') {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return {
      orderId: payload.orderId,
      status: asOrderStatus(payload.status),
      version: String(payload.version ?? input.expectedVersion),
    };
  }

  async completeRoute(routeId: string): Promise<void> {
    await this.http.post<unknown>('/route-completions', {routeId});
  }
}

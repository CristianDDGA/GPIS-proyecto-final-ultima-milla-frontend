import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import type {
  ChangeDeliveryStatusResult,
  CompleteRouteResult,
  DeliveryGateway,
  DeliveryOrder,
  DeliveryTransitionStatus,
} from '../../domain/index.js';
import {
  readDeliveryOrder,
  readRouteCompletionResult,
  readStatusChangeResult,
} from './response.js';

export class HttpDeliveryGateway implements DeliveryGateway {
  constructor(private readonly httpClient: HttpClient) {}

  async getDeliveryOrder(orderId: string): Promise<DeliveryOrder> {
    const response = await this.httpClient.get<unknown>(
      `/delivery-orders/${encodeURIComponent(orderId)}`,
    );
    return readDeliveryOrder(response);
  }

  async changeStatus(input: {
    orderId: string;
    newStatus: DeliveryTransitionStatus;
    expectedVersion: string;
    idempotencyKey: string;
  }): Promise<ChangeDeliveryStatusResult> {
    const response = await this.httpClient.post<unknown>(
      '/delivery-status-changes',
      {
        orderId: input.orderId,
        newStatus: input.newStatus,
        expectedVersion: input.expectedVersion,
      },
      { headers: { 'Idempotency-Key': input.idempotencyKey } },
    );
    return readStatusChangeResult(response);
  }

  async completeRoute(routeId: string): Promise<CompleteRouteResult> {
    const response = await this.httpClient.post<unknown>('/route-completions', { routeId });
    return readRouteCompletionResult(response);
  }
}


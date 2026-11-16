import type {
  ChangeDeliveryStatusResult,
  CompleteRouteResult,
  DeliveryOrder,
  DeliveryTransitionStatus,
} from './delivery.js';

export interface DeliveryGateway {
  getDeliveryOrder(orderId: string): Promise<DeliveryOrder>;
  changeStatus(input: {
    orderId: string;
    newStatus: DeliveryTransitionStatus;
    expectedVersion: string;
    idempotencyKey: string;
  }): Promise<ChangeDeliveryStatusResult>;
  completeRoute(routeId: string): Promise<CompleteRouteResult>;
}

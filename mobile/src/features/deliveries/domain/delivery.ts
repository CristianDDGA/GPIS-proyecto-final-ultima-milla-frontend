import type {OrderStatus} from '../../orders/domain/order';

export type DeliveryTransitionStatus = 'recogido' | 'en_camino' | 'entregado';

export interface DeliveryOrder {
  readonly orderId: string;
  readonly routeId: string | null;
  readonly status: OrderStatus;
  readonly version: string;
  readonly deliveredAt: string | null;
  readonly updatedAt: string;
}

export interface DeliveryStatusChangeResult {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly version: string;
}

export function getNextDeliveryStatus(current: OrderStatus): DeliveryTransitionStatus | null {
  switch (current) {
    case 'asignado_a_ruta':
      return 'recogido';
    case 'recogido':
      return 'en_camino';
    case 'en_camino':
      return 'entregado';
    default:
      return null;
  }
}

export function deliveryActionLabel(next: DeliveryTransitionStatus): string {
  switch (next) {
    case 'recogido':
      return 'Marcar recogido';
    case 'en_camino':
      return 'Marcar en camino';
    case 'entregado':
      return 'Marcar entregado';
  }
}

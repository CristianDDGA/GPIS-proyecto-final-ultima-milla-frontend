import type { OrderStatus } from '../../orders/domain/index.js';

export type DeliveryTransitionStatus = 'recogido' | 'en_camino' | 'entregado';

export interface DeliveryOrder {
  readonly orderId: string;
  readonly routeId: string | null;
  readonly status: OrderStatus;
  readonly version: string;
  readonly deliveredAt: string | null;
  readonly updatedAt: string;
}

export interface ChangeDeliveryStatusInput {
  readonly orderId: string;
  readonly newStatus: DeliveryTransitionStatus;
  readonly expectedVersion?: string | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface ChangeDeliveryStatusResult {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly version: string;
}

export interface CompleteRouteResult {
  readonly routeId: string;
  readonly status: 'completada';
}

export interface DeliveryValidationResult {
  readonly isValid: boolean;
  readonly errors: Record<string, string>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL_PATTERN = /^[1-9]\d*$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isPositiveVersion(value: string): boolean {
  return POSITIVE_DECIMAL_PATTERN.test(value);
}

function isDeliveryTransitionStatus(value: string): value is DeliveryTransitionStatus {
  return value === 'recogido' || value === 'en_camino' || value === 'entregado';
}

/**
 * Reglas de negocio para el cambio de estado de una entrega:
 * - orderId: UUID obligatorio.
 * - newStatus: transición permitida (recogido, en_camino o entregado).
 * - expectedVersion: si se envía, cadena decimal positiva ("1", "2", ...).
 */
export function validateChangeDeliveryStatusInput(
  input: ChangeDeliveryStatusInput,
): DeliveryValidationResult {
  const errors: Record<string, string> = {};

  if (!isUuid(input.orderId)) {
    errors['orderId'] = 'Se requiere el UUID del pedido.';
  }

  if (!isDeliveryTransitionStatus(input.newStatus)) {
    errors['newStatus'] = 'El nuevo estado debe ser recogido, en camino o entregado.';
  }

  if (input.expectedVersion !== undefined && !isPositiveVersion(input.expectedVersion)) {
    errors['expectedVersion'] = 'La versión esperada debe ser un entero positivo.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function getNextAllowedDeliveryStatus(current: OrderStatus): DeliveryTransitionStatus | null {
  switch (current) {
    case 'asignado_a_ruta':
      return 'recogido';
    case 'recogido':
      return 'en_camino';
    case 'en_camino':
      return 'entregado';
    case 'pendiente':
    case 'entregado':
      return null;
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

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pendiente':
      return 'Pendiente';
    case 'asignado_a_ruta':
      return 'Asignado a ruta';
    case 'recogido':
      return 'Recogido';
    case 'en_camino':
      return 'En camino';
    case 'entregado':
      return 'Entregado';
  }
}

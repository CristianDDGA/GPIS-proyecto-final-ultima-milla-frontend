import type {
  ChangeDeliveryStatusResult,
  CompleteRouteResult,
  DeliveryOrder,
} from '../../domain/index.js';

const CONTRACT_ERROR = 'La respuesta del servidor no cumple el contrato de la API.';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const POSITIVE_DECIMAL_PATTERN = /^[1-9]\d*$/;

const ORDER_STATUSES = [
  'pendiente',
  'asignado_a_ruta',
  'recogido',
  'en_camino',
  'entregado',
  'entrega_fallida',
  'cancelado',
] as const;

const TARGET_STATUSES = ['recogido', 'en_camino', 'entregado'] as const;

type KnownOrderStatus = (typeof ORDER_STATUSES)[number];
type KnownTargetStatus = (typeof TARGET_STATUSES)[number];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isPositiveDecimalString(value: unknown): value is string {
  return typeof value === 'string' && POSITIVE_DECIMAL_PATTERN.test(value);
}

export function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isOrderStatus(value: unknown): value is KnownOrderStatus {
  return (
    typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

function isTargetStatus(value: unknown): value is KnownTargetStatus {
  return (
    typeof value === 'string' && (TARGET_STATUSES as readonly string[]).includes(value)
  );
}

function readNullableUuid(value: unknown): string | null {
  if (value === null) return null;
  if (!isUuid(value)) throw new Error(CONTRACT_ERROR);
  return value;
}

function readNullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (!isIsoTimestamp(value)) throw new Error(CONTRACT_ERROR);
  return value;
}

export function readDeliveryOrder(value: unknown): DeliveryOrder {
  if (!isRecord(value) || !isUuid(value['orderId'])) {
    throw new Error(CONTRACT_ERROR);
  }

  const routeId = readNullableUuid(value['routeId']);
  const status = value['status'];
  const version = value['version'];
  const deliveredAt = readNullableTimestamp(value['deliveredAt']);
  const updatedAt = value['updatedAt'];

  if (!isOrderStatus(status) || !isPositiveDecimalString(version) || !isIsoTimestamp(updatedAt)) {
    throw new Error(CONTRACT_ERROR);
  }

  return { orderId: value['orderId'], routeId, status, version, deliveredAt, updatedAt };
}

export function readStatusChangeResult(value: unknown): ChangeDeliveryStatusResult {
  if (!isRecord(value)) throw new Error(CONTRACT_ERROR);

  const orderId = value['orderId'];
  const status = value['status'];
  const version = value['version'];

  if (!isUuid(orderId) || !isTargetStatus(status) || !isPositiveDecimalString(version)) {
    throw new Error(CONTRACT_ERROR);
  }

  return { orderId, status, version };
}

export function readRouteCompletionResult(value: unknown): CompleteRouteResult {
  if (!isRecord(value)) throw new Error(CONTRACT_ERROR);

  const routeId = value['routeId'];
  if (!isUuid(routeId) || value['status'] !== 'completada') {
    throw new Error(CONTRACT_ERROR);
  }

  return { routeId, status: 'completada' };
}

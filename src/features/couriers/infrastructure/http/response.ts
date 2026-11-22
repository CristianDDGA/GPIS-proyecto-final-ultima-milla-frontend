import type {
  ActiveCourierRoute,
  ActiveCourierRouteStop,
  AssignCourierResult,
  Courier,
  CourierPage,
} from '../../domain/index.js';

const CONTRACT_ERROR = 'La respuesta del servidor no cumple el contrato de la API.';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const SERVICE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELIVERY_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const ACTIVE_ROUTE_STATUSES: ReadonlySet<string> = new Set(['asignada', 'en_curso']);
const ACTIVE_ROUTE_STOP_STATUSES: ReadonlySet<string> = new Set([
  'asignado_a_ruta',
  'recogido',
  'en_camino',
  'entregado',
  'entrega_fallida',
  'cancelado',
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isIsoDateString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCourier(value: unknown): value is Courier {
  return (
    isRecord(value) &&
    isUuid(value['id']) &&
    typeof value['displayName'] === 'string' &&
    value['displayName'].trim().length > 0 &&
    isPositiveInteger(value['maxOrdersPerTrip']) &&
    typeof value['isEnabled'] === 'boolean' &&
    typeof value['isAvailable'] === 'boolean' &&
    isIsoDateString(value['createdAt']) &&
    isIsoDateString(value['updatedAt'])
  );
}

function isActiveRouteStop(value: unknown): value is ActiveCourierRouteStop {
  return (
    isRecord(value) &&
    isUuid(value['orderId']) &&
    isPositiveInteger(value['position']) &&
    typeof value['deliveryAddress'] === 'string' &&
    value['deliveryAddress'].trim().length > 0 &&
    typeof value['deliveryTime'] === 'string' &&
    DELIVERY_TIME_PATTERN.test(value['deliveryTime']) &&
    typeof value['status'] === 'string' &&
    ACTIVE_ROUTE_STOP_STATUSES.has(value['status'])
  );
}

function isActiveRoute(value: unknown): value is ActiveCourierRoute {
  if (!isRecord(value)) return false;

  const stops = value['stops'];
  return (
    isUuid(value['routeId']) &&
    isUuid(value['zoneId']) &&
    typeof value['serviceDate'] === 'string' &&
    SERVICE_DATE_PATTERN.test(value['serviceDate']) &&
    typeof value['status'] === 'string' &&
    ACTIVE_ROUTE_STATUSES.has(value['status']) &&
    Array.isArray(stops) &&
    stops.every(isActiveRouteStop)
  );
}

export function readCourier(value: unknown): Courier {
  if (!isCourier(value)) throw new Error(CONTRACT_ERROR);
  return value;
}

export function readCourierPage(value: unknown): CourierPage {
  if (!isRecord(value)) throw new Error(CONTRACT_ERROR);

  const items = value['items'];
  const limit = value['limit'];
  const offset = value['offset'];

  if (
    !Array.isArray(items) ||
    !items.every(isCourier) ||
    !isPositiveInteger(limit) ||
    !isNonNegativeInteger(offset)
  ) {
    throw new Error(CONTRACT_ERROR);
  }

  return { items, limit, offset };
}

export function readAssignResult(value: unknown): AssignCourierResult {
  if (!isRecord(value) || !isUuid(value['routeId']) || !isUuid(value['courierId'])) {
    throw new Error(CONTRACT_ERROR);
  }

  if (value['status'] !== 'asignada') throw new Error(CONTRACT_ERROR);

  return { routeId: value['routeId'], courierId: value['courierId'], status: 'asignada' };
}

export function readActiveRouteEnvelope(value: unknown): ActiveCourierRoute | null {
  if (!isRecord(value) || !('item' in value)) throw new Error(CONTRACT_ERROR);

  const item = value['item'];
  if (item === null) return null;
  if (!isActiveRoute(item)) throw new Error(CONTRACT_ERROR);

  const stops = [...item.stops].sort((left, right) => left.position - right.position);
  return { ...item, stops };
}

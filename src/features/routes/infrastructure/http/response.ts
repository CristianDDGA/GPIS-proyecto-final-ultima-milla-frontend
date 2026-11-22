import type {
  CancelRouteResult,
  LateOrderPlacementResult,
  MoveOrderResult,
  PlanRoutesResult,
  ReorderStopsResult,
  RouteDetail,
  RouteStatus,
  RouteStop,
  RouteSummary,
  StopOrderStatus,
} from '../../domain/index.js';

const CONTRACT_ERROR_MESSAGE = 'La respuesta del servidor no cumple el contrato de la API.';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function ensure(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isRouteStatus(value: unknown): value is RouteStatus {
  return (
    value === 'planificada' ||
    value === 'asignada' ||
    value === 'en_curso' ||
    value === 'completada' ||
    value === 'cancelada'
  );
}

export function isStopOrderStatus(value: unknown): value is StopOrderStatus {
  return (
    value === 'asignado_a_ruta' ||
    value === 'recogido' ||
    value === 'en_camino' ||
    value === 'entregado' ||
    value === 'entrega_fallida' ||
    value === 'cancelado'
  );
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTimeOnly(value: unknown): value is string {
  return typeof value === 'string' && TIME_ONLY_PATTERN.test(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function readUuidList(value: unknown): string[] {
  ensure(Array.isArray(value));
  return value.map((item) => {
    ensure(isUuid(item));
    return item;
  });
}

export function readRouteSummary(value: unknown): RouteSummary {
  ensure(isRecord(value));

  const { id, zoneId, serviceDate, capacityLimit, status, courierId, occupiedSlots } = value;
  ensure(isUuid(id));
  ensure(isUuid(zoneId));
  ensure(isDateOnly(serviceDate));
  ensure(isPositiveInteger(capacityLimit));
  ensure(isRouteStatus(status));
  ensure(courierId === null || isUuid(courierId));
  ensure(isNonNegativeInteger(occupiedSlots) && occupiedSlots <= capacityLimit);

  return { id, zoneId, serviceDate, capacityLimit, status, courierId, occupiedSlots };
}

export function readRouteSummaryList(value: unknown): { items: RouteSummary[]; limit: number; offset: number } {
  ensure(isRecord(value));

  const { items, limit, offset } = value;
  ensure(Array.isArray(items));
  ensure(isPositiveInteger(limit));
  ensure(isNonNegativeInteger(offset));

  return { items: items.map(readRouteSummary), limit, offset };
}

function readRouteStop(value: unknown): RouteStop {
  ensure(isRecord(value));

  const { orderId, position, deliveryAddress, deliveryDate, deliveryTime, status } = value;
  ensure(isUuid(orderId));
  ensure(isPositiveInteger(position));
  ensure(typeof deliveryAddress === 'string' && deliveryAddress.trim().length > 0);
  ensure(isDateOnly(deliveryDate));
  ensure(isTimeOnly(deliveryTime));
  ensure(isStopOrderStatus(status));

  return { orderId, position, deliveryAddress, deliveryDate, deliveryTime, status };
}

export function readRouteDetail(value: unknown): RouteDetail {
  ensure(isRecord(value));

  const summary = readRouteSummary(value);
  const { stops } = value;
  ensure(Array.isArray(stops));

  return {
    ...summary,
    stops: stops.map(readRouteStop).sort((left, right) => left.position - right.position),
  };
}

export function readPlanResult(value: unknown): PlanRoutesResult {
  ensure(isRecord(value));

  const { serviceDate, routeIds } = value;
  ensure(isDateOnly(serviceDate));

  return { serviceDate, routeIds: readUuidList(routeIds) };
}

export function readReorderResult(value: unknown): ReorderStopsResult {
  ensure(isRecord(value));

  const { routeId, orderIds } = value;
  ensure(isUuid(routeId));

  return { routeId, orderIds: readUuidList(orderIds) };
}

export function readMoveResult(value: unknown): MoveOrderResult {
  ensure(isRecord(value));

  const { orderId, routeId } = value;
  ensure(isUuid(orderId));
  ensure(isUuid(routeId));

  return { orderId, routeId };
}

export function readCancelResult(value: unknown): CancelRouteResult {
  ensure(isRecord(value));

  const { routeId, status } = value;
  ensure(isUuid(routeId));
  ensure(status === 'cancelada');

  return { routeId, status };
}

export function readLatePlacementResult(value: unknown): LateOrderPlacementResult {
  ensure(isRecord(value));

  const { orderId, status, routeId, reason } = value;
  ensure(isUuid(orderId));

  if (status === 'asignado_a_ruta') {
    ensure(isUuid(routeId));
    return { orderId, status, routeId };
  }

  if (status === 'pendiente') {
    ensure(reason === 'NO_AVAILABLE_COURIER');
    return { orderId, status, reason };
  }

  throw new Error(CONTRACT_ERROR_MESSAGE);
}

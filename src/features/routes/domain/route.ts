export type RouteStatus = 'planificada' | 'asignada' | 'en_curso' | 'completada' | 'cancelada';

export type StopOrderStatus =
  | 'asignado_a_ruta'
  | 'recogido'
  | 'en_camino'
  | 'entregado'
  | 'entrega_fallida'
  | 'cancelado';

export interface RouteSummary {
  id: string;
  zoneId: string;
  serviceDate: string;
  capacityLimit: number;
  status: RouteStatus;
  courierId: string | null;
  occupiedSlots: number;
}

export interface RouteStop {
  orderId: string;
  position: number;
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTime: string;
  status: StopOrderStatus;
}

export interface RouteDetail extends RouteSummary {
  stops: RouteStop[];
}

export interface RouteFilters {
  serviceDate?: string | undefined;
  zoneId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PlanRoutesInput {
  serviceDate: string;
  capacityLimit: number;
  idempotencyKey?: string | undefined;
}

export interface PlanRoutesResult {
  serviceDate: string;
  routeIds: string[];
}

/** Lo que haria el plan con esa fecha y capacidad, sin crear nada (GET /route-plans/preview). */
export interface RoutePlanPreviewZone {
  zoneId: string;
  zoneName: string;
  orders: number;
  routes: number;
  /** Tamano de cada ruta que se crearia, en el orden en que se llenan. */
  routeSizes: number[];
}

export interface RoutePlanPreview {
  serviceDate: string;
  capacityLimit: number;
  zones: RoutePlanPreviewZone[];
  totalOrders: number;
  totalRoutes: number;
  /** Repartidores habilitados y disponibles, sin ruta asignada ni en curso. */
  availableCouriers: number;
}

export interface PreviewPlanInput {
  serviceDate: string;
  capacityLimit: number;
}

export interface ReorderStopsInput {
  routeId: string;
  orderIds: string[];
}

export interface ReorderStopsResult {
  routeId: string;
  orderIds: string[];
}

export interface MoveOrderInput {
  orderId: string;
  destinationRouteId: string;
}

export interface MoveOrderResult {
  orderId: string;
  routeId: string;
}

export interface CancelRouteResult {
  routeId: string;
  status: 'cancelada';
}

export interface LateOrderPlacementInput {
  orderId: string;
  capacityLimit: number;
  idempotencyKey?: string | undefined;
}

export type LateOrderPlacementResult =
  | { orderId: string; status: 'asignado_a_ruta'; routeId: string }
  | { orderId: string; status: 'pendiente'; reason: 'NO_AVAILABLE_COURIER' };

export interface RouteValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Mismos límites que el backend: tope por ruta y ventana de planificación. */
export const MAX_ROUTE_CAPACITY = 20;
export const MAX_PLANNING_DAYS_AHEAD = 60;
const MAX_CAPACITY_LIMIT = MAX_ROUTE_CAPACITY;

/**
 * Identificador UUID v1-v5 en su representación canónica de 36 caracteres.
 */
export function isUuid(value: string): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

/**
 * Fecha local en formato YYYY-MM-DD sin usar toISOString() para no desfasar por UTC.
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Suma días a una fecha YYYY-MM-DD sin depender de la zona horaria. */
export function addDaysToIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function isCalendarDate(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIntegerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

/**
 * Planificación: la fecha de servicio debe ser una fecha de calendario válida y el
 * límite de capacidad un entero dentro del rango de un entero de PostgreSQL.
 */
export function validatePlanRoutesInput(
  input: PlanRoutesInput,
  today: string = getTodayIsoDate(),
): RouteValidationResult {
  const errors: Record<string, string> = {};

  const serviceDate = input.serviceDate.trim();
  if (!isCalendarDate(serviceDate)) {
    errors['serviceDate'] = 'La fecha de servicio debe ser una fecha válida con formato AAAA-MM-DD.';
  } else if (serviceDate < today) {
    errors['serviceDate'] = 'No se puede planificar una fecha pasada.';
  } else if (serviceDate > addDaysToIsoDate(today, MAX_PLANNING_DAYS_AHEAD)) {
    errors['serviceDate'] = `Solo se puede planificar hasta ${MAX_PLANNING_DAYS_AHEAD} días adelante.`;
  }

  if (!isIntegerInRange(input.capacityLimit, 1, MAX_CAPACITY_LIMIT)) {
    errors['capacityLimit'] = `El límite de capacidad debe ser un número entero entre 1 y ${MAX_ROUTE_CAPACITY}.`;
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Reordenamiento: ruta UUID y una lista no vacía de pedidos UUID sin duplicados.
 */
export function validateReorderStopsInput(input: ReorderStopsInput): RouteValidationResult {
  const errors: Record<string, string> = {};

  if (!isUuid(input.routeId)) {
    errors['routeId'] = 'El identificador de la ruta debe ser un UUID válido.';
  }

  const orderIds = Array.isArray(input.orderIds) ? input.orderIds.map((orderId) => orderId.trim()) : [];
  if (orderIds.length === 0) {
    errors['orderIds'] = 'Debes indicar al menos una parada para reordenar.';
  } else if (orderIds.some((orderId) => !isUuid(orderId))) {
    errors['orderIds'] = 'Todas las paradas deben tener un identificador UUID válido.';
  } else if (new Set(orderIds).size !== orderIds.length) {
    errors['orderIds'] = 'El nuevo orden de paradas no puede repetir el mismo pedido.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Reubicación: el pedido y la ruta destino deben ser UUID.
 */
export function validateMoveOrderInput(input: MoveOrderInput): RouteValidationResult {
  const errors: Record<string, string> = {};

  if (!isUuid(input.orderId)) {
    errors['orderId'] = 'El identificador del pedido debe ser un UUID válido.';
  }

  if (!isUuid(input.destinationRouteId)) {
    errors['destinationRouteId'] = 'El identificador de la ruta destino debe ser un UUID válido.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Inserción tardía: pedido UUID y límite de capacidad entero positivo.
 */
export function validateLateOrderPlacementInput(input: LateOrderPlacementInput): RouteValidationResult {
  const errors: Record<string, string> = {};

  if (!isUuid(input.orderId)) {
    errors['orderId'] = 'El identificador del pedido debe ser un UUID válido.';
  }

  if (!isIntegerInRange(input.capacityLimit, 1, MAX_CAPACITY_LIMIT)) {
    errors['capacityLimit'] = `El límite de capacidad debe ser un número entero entre 1 y ${MAX_ROUTE_CAPACITY}.`;
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

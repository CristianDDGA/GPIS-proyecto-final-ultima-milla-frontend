export interface Courier {
  readonly id: string;
  readonly displayName: string;
  readonly maxOrdersPerTrip: number;
  readonly isEnabled: boolean;
  readonly isAvailable: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CourierPage {
  readonly items: readonly Courier[];
  readonly limit: number;
  readonly offset: number;
}

export interface CourierFilters {
  readonly available?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface CreateCourierInput {
  readonly displayName: string;
  readonly maxOrdersPerTrip: number;
}

export interface AssignCourierInput {
  readonly routeId: string;
  readonly courierId: string;
}

export interface AssignCourierResult {
  readonly routeId: string;
  readonly courierId: string;
  readonly status: 'asignada';
}

export interface ActiveCourierRouteStop {
  readonly orderId: string;
  readonly position: number;
  readonly deliveryAddress: string;
  readonly deliveryTime: string;
  readonly status:
    | 'asignado_a_ruta'
    | 'recogido'
    | 'en_camino'
    | 'entregado'
    | 'entrega_fallida'
    | 'cancelado';
}

export interface ActiveCourierRoute {
  readonly routeId: string;
  readonly zoneId: string;
  readonly serviceDate: string;
  readonly status: 'asignada' | 'en_curso';
  readonly stops: readonly ActiveCourierRouteStop[];
}

export interface CourierValidationResult {
  readonly isValid: boolean;
  readonly errors: Record<string, string>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_ORDERS_PER_TRIP = 2147483647;
const TWO_LETTERS_PATTERN = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Reglas de negocio para el alta de repartidores:
 * - displayName: obligatorio, mínimo 2 letras y de hasta 120 caracteres.
 * - maxOrdersPerTrip: entero positivo dentro del rango de un INT de PostgreSQL.
 */
export function validateCreateCourierInput(input: CreateCourierInput): CourierValidationResult {
  const errors: Record<string, string> = {};

  const trimmedName = input.displayName.trim();
  if (trimmedName.length === 0) {
    errors['displayName'] = 'El nombre del repartidor es obligatorio.';
  } else if (!TWO_LETTERS_PATTERN.test(trimmedName)) {
    errors['displayName'] = 'El nombre del repartidor debe incluir al menos 2 letras.';
  } else if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
    errors['displayName'] = `El nombre del repartidor no puede superar los ${MAX_DISPLAY_NAME_LENGTH} caracteres.`;
  }

  if (
    !Number.isInteger(input.maxOrdersPerTrip) ||
    input.maxOrdersPerTrip < 1 ||
    input.maxOrdersPerTrip > MAX_ORDERS_PER_TRIP
  ) {
    errors['maxOrdersPerTrip'] = 'La capacidad debe ser un entero positivo.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Reglas de negocio para la asignación de una ruta a un repartidor:
 * ambos identificadores deben ser UUID válidos.
 */
export function validateAssignCourierInput(input: AssignCourierInput): CourierValidationResult {
  const errors: Record<string, string> = {};

  if (!isUuid(input.routeId)) {
    errors['routeId'] = 'Se requiere un UUID válido para la ruta.';
  }

  if (!isUuid(input.courierId)) {
    errors['courierId'] = 'Se requiere un UUID válido para el repartidor.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}


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

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

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


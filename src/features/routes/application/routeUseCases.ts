import {
  isUuid,
  validateLateOrderPlacementInput,
  validateMoveOrderInput,
  validatePlanRoutesInput,
  validateReorderStopsInput,
  type CancelRouteResult,
  type LateOrderPlacementInput,
  type LateOrderPlacementResult,
  type MoveOrderInput,
  type MoveOrderResult,
  type PlanRoutesInput,
  type PlanRoutesResult,
  type ReorderStopsInput,
  type ReorderStopsResult,
  type RouteDetail,
  type RouteFilters,
  type RouteGateway,
  type RouteSummary,
} from '../domain/index.js';

function firstValidationError(errors: Record<string, string>): string {
  const [firstError] = Object.values(errors);
  return firstError ?? 'Los datos enviados no son válidos.';
}

/**
 * Genera el plan de rutas del día. Si no llega una clave de idempotencia explícita,
 * se resuelve una nueva para que el puerto siempre reciba un UUID estable.
 */
export class PlanRoutesUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public async execute(input: PlanRoutesInput): Promise<PlanRoutesResult> {
    const serviceDate = input.serviceDate.trim();
    const validation = validatePlanRoutesInput({ serviceDate, capacityLimit: input.capacityLimit });
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }

    const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
    return this.routeGateway.planRoutes({ serviceDate, capacityLimit: input.capacityLimit, idempotencyKey });
  }
}

/**
 * Lista rutas aplicando sólo los filtros definidos (nunca envía undefined al puerto).
 */
export class GetRoutesUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public execute(filters: RouteFilters = {}): Promise<RouteSummary[]> {
    const normalized: RouteFilters = {};

    const serviceDate = filters.serviceDate?.trim();
    if (serviceDate) {
      normalized.serviceDate = serviceDate;
    }

    const zoneId = filters.zoneId?.trim();
    if (zoneId) {
      normalized.zoneId = zoneId;
    }

    if (typeof filters.limit === 'number' && Number.isInteger(filters.limit) && filters.limit >= 1 && filters.limit <= 100) {
      normalized.limit = filters.limit;
    }

    if (typeof filters.offset === 'number' && Number.isInteger(filters.offset) && filters.offset >= 0) {
      normalized.offset = filters.offset;
    }

    return this.routeGateway.getRoutes(normalized);
  }
}

/**
 * Recupera el detalle de una ruta validando el identificador en el cliente.
 */
export class GetRouteByIdUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public execute(id: string): Promise<RouteDetail> {
    const routeId = id.trim();
    if (!isUuid(routeId)) {
      throw new Error('El identificador de la ruta debe ser un UUID válido.');
    }
    return this.routeGateway.getRouteById(routeId);
  }
}

/**
 * Define el nuevo orden de paradas de una ruta existente.
 */
export class ReorderRouteStopsUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public execute(input: ReorderStopsInput): Promise<ReorderStopsResult> {
    const normalized: ReorderStopsInput = {
      routeId: input.routeId.trim(),
      orderIds: input.orderIds.map((orderId) => orderId.trim()),
    };
    const validation = validateReorderStopsInput(normalized);
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }
    return this.routeGateway.reorderStops(normalized);
  }
}

/**
 * Cancela una ruta planificada o asignada.
 */
export class CancelRouteUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public execute(routeId: string): Promise<CancelRouteResult> {
    const normalized = routeId.trim();
    if (!isUuid(normalized)) {
      throw new Error('El identificador de la ruta debe ser un UUID válido.');
    }
    return this.routeGateway.cancelRoute(normalized);
  }
}

/**
 * Reubica una parada en otra ruta destino de la misma zona y fecha.
 */
export class MoveOrderUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public execute(input: MoveOrderInput): Promise<MoveOrderResult> {
    const normalized: MoveOrderInput = {
      orderId: input.orderId.trim(),
      destinationRouteId: input.destinationRouteId.trim(),
    };
    const validation = validateMoveOrderInput(normalized);
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }
    return this.routeGateway.moveOrder(normalized);
  }
}

/**
 * Inserta un pedido tardío en la primera ruta con cupo disponible.
 */
export class PlaceLateOrderUseCase {
  constructor(private readonly routeGateway: RouteGateway) {}

  public execute(input: LateOrderPlacementInput): Promise<LateOrderPlacementResult> {
    const orderId = input.orderId.trim();
    const validation = validateLateOrderPlacementInput({ orderId, capacityLimit: input.capacityLimit });
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }

    const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
    return this.routeGateway.placeLateOrder({ orderId, capacityLimit: input.capacityLimit, idempotencyKey });
  }
}

export interface RouteUseCases {
  planRoutes: Pick<PlanRoutesUseCase, 'execute'>;
  getRoutes: Pick<GetRoutesUseCase, 'execute'>;
  getRouteById: Pick<GetRouteByIdUseCase, 'execute'>;
  reorderStops: Pick<ReorderRouteStopsUseCase, 'execute'>;
  cancelRoute: Pick<CancelRouteUseCase, 'execute'>;
  moveOrder: Pick<MoveOrderUseCase, 'execute'>;
  placeLateOrder: Pick<PlaceLateOrderUseCase, 'execute'>;
}

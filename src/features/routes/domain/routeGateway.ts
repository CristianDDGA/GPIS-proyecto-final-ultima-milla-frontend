import type {
  CancelRouteResult,
  LateOrderPlacementInput,
  LateOrderPlacementResult,
  MoveOrderInput,
  MoveOrderResult,
  PlanRoutesInput,
  PlanRoutesResult,
  ReorderStopsInput,
  ReorderStopsResult,
  RouteDetail,
  RouteFilters,
  RouteSummary,
} from './route.js';

/**
 * Puerto de salida de la feature de rutas.
 * Implementado en infrastructure/http; el dominio no conoce HTTP.
 */
export interface RouteGateway {
  planRoutes(input: PlanRoutesInput): Promise<PlanRoutesResult>;
  getRoutes(filters?: RouteFilters): Promise<RouteSummary[]>;
  getRouteById(id: string): Promise<RouteDetail>;
  reorderStops(input: ReorderStopsInput): Promise<ReorderStopsResult>;
  cancelRoute(routeId: string): Promise<CancelRouteResult>;
  moveOrder(input: MoveOrderInput): Promise<MoveOrderResult>;
  placeLateOrder(input: LateOrderPlacementInput): Promise<LateOrderPlacementResult>;
}

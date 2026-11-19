export type RouteStatus =
  | 'planificada'
  | 'asignada'
  | 'en_curso'
  | 'completada'
  | 'cancelada';

export type StopOrderStatus =
  | 'asignado_a_ruta'
  | 'recogido'
  | 'en_camino'
  | 'entregado';

export interface RouteSummary {
  readonly id: string;
  readonly zoneId: string;
  readonly serviceDate: string;
  readonly status: RouteStatus;
  readonly capacityLimit: number;
  readonly occupiedSlots: number;
  readonly courierId: string | null;
}

export interface RouteStop {
  readonly orderId: string;
  readonly position: number;
  readonly deliveryAddress: string;
  readonly deliveryDate: string;
  readonly deliveryTime: string;
  readonly status: StopOrderStatus;
}

export interface RouteDetail extends RouteSummary {
  readonly stops: readonly RouteStop[];
}

export interface PlanRoutesResult {
  readonly serviceDate: string;
  readonly routeIds: readonly string[];
}

export type LateOrderPlacementResult =
  | {readonly orderId: string; readonly status: 'asignado_a_ruta'; readonly routeId: string}
  | {readonly orderId: string; readonly status: 'pendiente'; readonly reason: string};

export const ROUTE_STATUS_LABELS: Readonly<Record<RouteStatus, string>> = {
  planificada: 'Planificada',
  asignada: 'Asignada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

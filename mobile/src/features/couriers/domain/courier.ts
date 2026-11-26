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

export type ActiveStopStatus =
  | 'asignado_a_ruta'
  | 'recogido'
  | 'en_camino'
  | 'entregado'
  | 'entrega_fallida'
  | 'cancelado';

export interface ActiveCourierRouteStop {
  readonly orderId: string;
  readonly position: number;
  readonly deliveryAddress: string;
  readonly deliveryTime: string;
  readonly status: ActiveStopStatus;
}

export interface ActiveCourierRoute {
  readonly routeId: string;
  readonly zoneId: string;
  readonly serviceDate: string;
  readonly status: 'asignada' | 'en_curso';
  readonly stops: readonly ActiveCourierRouteStop[];
}

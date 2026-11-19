export type OrderStatus =
  | 'pendiente'
  | 'asignado_a_ruta'
  | 'recogido'
  | 'en_camino'
  | 'entregado';

export interface Order {
  readonly id: string;
  readonly zoneId: string;
  readonly zoneName?: string;
  readonly deliveryAddress: string;
  readonly deliveryDate: string;
  readonly deliveryTime: string;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  pendiente: 'Pendiente',
  asignado_a_ruta: 'Asignado a ruta',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

export const ORDER_TIMELINE: readonly {readonly status: OrderStatus; readonly label: string}[] = [
  {status: 'pendiente', label: 'Pendiente'},
  {status: 'asignado_a_ruta', label: 'Asignado a ruta'},
  {status: 'recogido', label: 'Recogido'},
  {status: 'en_camino', label: 'En camino'},
  {status: 'entregado', label: 'Entregado'},
];

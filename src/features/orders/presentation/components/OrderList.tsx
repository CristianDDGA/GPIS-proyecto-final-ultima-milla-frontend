import type { FC } from 'react';
import type { Order } from '../../domain/index.js';
import { Button, EmptyState, ShortIdBadge, Spinner } from '../../../../shared/ui/index.js';

export interface OrderListProps {
  orders: Order[];
  isLoading: boolean;
  hasActiveFilters?: boolean;
  onSelect?: (id: string) => void;
}

function formatDisplayDate(dateStr: string, timeStr: string): string {
  if (!dateStr) return '—';
  return `${dateStr} · ${timeStr || '00:00'}`;
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  asignado_a_ruta: 'Asignado a ruta',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

export const OrderList: FC<OrderListProps> = ({
  orders,
  isLoading,
  hasActiveFilters = false,
  onSelect,
}) => {
  if (isLoading && orders.length === 0) {
    return (
      <output className="orders-loading-container">
        <Spinner size="lg" label="Cargando pedidos..." />
        <p>Consultando pedidos registrados...</p>
      </output>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title={
          hasActiveFilters
            ? 'Sin coincidencias para los filtros activos'
            : 'No hay pedidos registrados'
        }
        description={
          hasActiveFilters
            ? 'No existen pedidos registrados que coincidan con la fecha o zona seleccionadas.'
            : 'Aún no hay pedidos registrados en el sistema.'
        }
      />
    );
  }

  return (
    <div className="orders-table-wrapper">
      <table className="orders-table" aria-label="Listado de pedidos registrados">
        <thead>
          <tr>
            <th scope="col">Dirección</th>
            <th scope="col">Zona</th>
            <th scope="col">Programación</th>
            <th scope="col">Estado</th>
            {onSelect && <th scope="col">Detalle</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const statusClass = `orders-status-badge--${order.status.toLowerCase().replace(/\s+/g, '_')}`;

            return (
              <tr key={order.id}>
                <td>
                  <span className="orders-table__address">{order.deliveryAddress}</span>
                  <span className="orders-table__id">
                    <ShortIdBadge id={order.id} prefix="PED" />
                  </span>
                </td>
                <td>{order.zoneName || order.zoneId}</td>
                <td className="orders-table__schedule">
                  {formatDisplayDate(order.deliveryDate, order.deliveryTime)}
                </td>
                <td>
                  <span className={`orders-status-badge ${statusClass}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
                {onSelect && (
                  <td>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onSelect(order.id)}
                      aria-label={`Ver detalle del pedido ${order.id}`}
                    >
                      Ver detalle
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

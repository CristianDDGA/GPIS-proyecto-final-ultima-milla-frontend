import { useEffect, useMemo, useState, type FC } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import type { Order } from '../../domain/index.js';
import { Button, EmptyState, ShortIdBadge, Spinner } from '../../../../shared/ui/index.js';

const PAGE_SIZE = 15;

export interface OrderListProps {
  orders: Order[];
  zones?: readonly Zone[] | undefined;
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
  entrega_fallida: 'Entrega fallida',
  cancelado: 'Cancelado',
};

export const OrderList: FC<OrderListProps> = ({
  orders,
  zones,
  isLoading,
  hasActiveFilters = false,
  onSelect,
}) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [orders]);

  const zoneNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const zone of zones ?? []) {
      map.set(zone.id, zone.name);
    }
    return map;
  }, [zones]);

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

  const total = orders.length;
  const visibleOrders = orders.slice(offset, offset + PAGE_SIZE);
  const rangeStart = offset + 1;
  const rangeEnd = Math.min(offset + visibleOrders.length, total);

  return (
    <>
      <div className="orders-table-wrapper">
        <table className="orders-table" aria-label="Listado de pedidos registrados">
          <thead>
            <tr>
              <th scope="col">Dirección</th>
              <th scope="col">Zona</th>
              <th scope="col">Programación</th>
              <th scope="col">Estado</th>
              {onSelect && <th scope="col" className="orders-table__actions-head">Detalle</th>}
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => {
              const statusClass = `orders-status-badge--${order.status.toLowerCase().replace(/\s+/g, '_')}`;
              const zoneLabel = order.zoneName || zoneNameById.get(order.zoneId) || order.zoneId;

              return (
                <tr key={order.id}>
                  <td>
                    <span className="orders-table__address">{order.deliveryAddress}</span>
                    <span className="orders-table__id">
                      <ShortIdBadge id={order.id} prefix="PED" />
                    </span>
                  </td>
                  <td>{zoneLabel}</td>
                  <td className="orders-table__schedule">
                    {formatDisplayDate(order.deliveryDate, order.deliveryTime)}
                  </td>
                  <td>
                    <span className={`orders-status-badge ${statusClass}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  {onSelect && (
                    <td className="orders-table__actions">
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

      {total > PAGE_SIZE && (
        <footer className="orders-pagination">
          <span className="orders-pagination__info">
            {rangeStart}–{rangeEnd} de {total}
          </span>
          <div className="orders-pagination__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || isLoading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Siguiente
            </Button>
          </div>
        </footer>
      )}
    </>
  );
};

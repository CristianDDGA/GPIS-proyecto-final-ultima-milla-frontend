import type { FC } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import type { RouteStatus, RouteSummary } from '../../domain/index.js';
import { Button, EmptyState, Spinner } from '../../../../shared/ui/index.js';

const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  planificada: 'Planificada',
  asignada: 'Asignada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export interface RouteTableProps {
  routes: readonly RouteSummary[];
  zones: readonly Zone[];
  isLoading: boolean;
  onInspect: (routeId: string) => void;
}

export const RouteTable: FC<RouteTableProps> = ({ routes, zones, isLoading, onInspect }) => {
  const resolveZoneName = (zoneId: string): string =>
    zones.find((zone) => zone.id === zoneId)?.name ?? zoneId;

  if (isLoading && routes.length === 0) {
    return (
      <output className="routes-loading" aria-live="polite">
        <Spinner size="lg" label="Cargando rutas..." />
        <p>Consultando rutas planificadas...</p>
      </output>
    );
  }

  if (routes.length === 0) {
    return (
      <EmptyState
        title="No hay rutas registradas"
        description="No se encontraron rutas para los filtros seleccionados. Ajusta los filtros de búsqueda o vuelve a consultar el listado."
      />
    );
  }

  return (
    <div className="routes-table-wrapper">
      <table className="routes-table" aria-label="Listado de rutas planificadas">
        <thead>
          <tr>
            <th scope="col">Fecha de servicio</th>
            <th scope="col">Zona</th>
            <th scope="col">Estado</th>
            <th scope="col">Ocupación</th>
            <th scope="col">Repartidor</th>
            <th scope="col">Paradas</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id}>
              <td>{route.serviceDate}</td>
              <td>
                <span className="routes-table__zone-name">{resolveZoneName(route.zoneId)}</span>
                <span className="routes-table__muted">{route.zoneId}</span>
              </td>
              <td>
                <span className={`routes-status-badge routes-status-badge--${route.status}`}>
                  {ROUTE_STATUS_LABELS[route.status]}
                </span>
              </td>
              <td>
                {route.occupiedSlots} / {route.capacityLimit}
              </td>
              <td>{route.courierId ?? 'Sin asignar'}</td>
              <td>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onInspect(route.id)}
                  aria-label={`Inspeccionar paradas de la ruta ${route.id}`}
                >
                  Inspeccionar paradas
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

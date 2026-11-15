import type { FC } from 'react';
import type { Courier } from '../../../couriers/domain/index.js';
import type { Zone } from '../../../zones/domain/index.js';
import type { RouteStatus, RouteSummary } from '../../domain/index.js';
import {
  Button,
  EmptyState,
  IsometricCapacityCube,
  ShortIdBadge,
  Spinner,
} from '../../../../shared/ui/index.js';

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
  couriers?: readonly Courier[] | undefined;
  isLoading: boolean;
  onInspect: (routeId: string) => void;
}

export const RouteTable: FC<RouteTableProps> = ({
  routes,
  zones,
  couriers,
  isLoading,
  onInspect,
}) => {
  const resolveZoneName = (zoneId: string): string =>
    zones.find((zone) => zone.id === zoneId)?.name ?? 'Zona sin catalogar';

  const resolveCourierName = (courierId: string | null): string | null => {
    if (courierId === null) {
      return null;
    }
    return couriers?.find((courier) => courier.id === courierId)?.displayName ?? 'Repartidor asignado';
  };

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
      <table className="routes-table routes-table--interactive" aria-label="Listado de rutas planificadas">
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
          {routes.map((route) => {
            const courierName = resolveCourierName(route.courierId);
            return (
              <tr
                key={route.id}
                className="routes-table__row"
                onClick={() => onInspect(route.id)}
              >
                <td className="routes-table__date">{route.serviceDate}</td>
                <td>
                  <span className="routes-table__zone-name">{resolveZoneName(route.zoneId)}</span>
                  <ShortIdBadge id={route.id} prefix="RUT" copyable={false} />
                </td>
                <td>
                  <span className={`routes-status-badge routes-status-badge--${route.status}`}>
                    {ROUTE_STATUS_LABELS[route.status]}
                  </span>
                </td>
                <td>
                  <div className="routes-table__capacity">
                    <IsometricCapacityCube
                      occupied={route.occupiedSlots}
                      capacity={route.capacityLimit}
                      status={route.status}
                      showCaption={false}
                    />
                    <span className="routes-table__capacity-count">
                      <strong>{route.occupiedSlots}</strong>
                      <span>/{route.capacityLimit}</span>
                    </span>
                  </div>
                </td>
                <td>
                  {courierName === null ? (
                    <span className="routes-table__unassigned">Sin asignar</span>
                  ) : (
                    <span className="routes-table__courier">{courierName}</span>
                  )}
                </td>
                <td>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onInspect(route.id);
                    }}
                    aria-label={`Inspeccionar paradas de la ruta ${route.id}`}
                  >
                    Ver paradas
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

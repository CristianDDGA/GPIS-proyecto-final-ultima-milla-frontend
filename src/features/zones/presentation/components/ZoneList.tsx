import type { FC } from 'react';
import type { Zone } from '../../domain/index.js';
import { Button, EmptyState, ShortIdBadge, Spinner } from '../../../../shared/ui/index.js';

export interface ZoneListProps {
  zones: Zone[];
  isLoading: boolean;
  onSelectZone?: ((id: string) => void) | undefined;
  /** Conteo de pedidos por zona; se muestra como señal de demanda. */
  orderCountByZone?: ReadonlyMap<string, number> | undefined;
}

function formatDate(isoDateString?: string): string {
  if (!isoDateString) return '—';
  try {
    const date = new Date(isoDateString);
    if (Number.isNaN(date.getTime())) return isoDateString;
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return isoDateString;
  }
}

export const ZoneList: FC<ZoneListProps> = ({
  zones,
  isLoading,
  onSelectZone,
  orderCountByZone,
}) => {
  if (isLoading && zones.length === 0) {
    return (
      <div className="zones-loading-container" role="status">
        <Spinner size="lg" label="Cargando listado de zonas..." />
        <p>Obteniendo zonas disponibles...</p>
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <EmptyState
        title="No hay zonas registradas"
        description="Aún no se han configurado áreas de cobertura para la última milla."
      />
    );
  }

  return (
    <div className="zones-table-wrapper">
      <table className="zones-table" aria-label="Listado de zonas de entrega">
        <thead>
          <tr>
            <th scope="col">Nombre de zona</th>
            <th scope="col">Código</th>
            <th scope="col">Demanda</th>
            <th scope="col">Registro</th>
            {onSelectZone && <th scope="col">Detalle</th>}
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => {
            const orderCount = orderCountByZone?.get(zone.id);
            return (
              <tr key={zone.id}>
                <td className="zones-table__name">{zone.name}</td>
                <td>
                  <ShortIdBadge
                    id={zone.id}
                    prefix="ZON"
                    ariaLabel={`Copiar el identificador de la zona ${zone.name}`}
                  />
                </td>
                <td className="zones-table__demand">
                  {orderCount === undefined ? (
                    <span className="zones-table__demand-empty">—</span>
                  ) : (
                    <>
                      <strong>{orderCount}</strong>
                      <span> {orderCount === 1 ? 'pedido' : 'pedidos'}</span>
                    </>
                  )}
                </td>
                <td className="zones-table__date">{formatDate(zone.createdAt)}</td>
                {onSelectZone && (
                  <td className="zones-table__actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onSelectZone(zone.id)}
                      aria-label={`Ver detalle de la zona ${zone.name}`}
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
